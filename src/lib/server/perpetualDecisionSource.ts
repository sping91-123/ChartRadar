import { createHash, randomUUID } from "node:crypto";
import { fetchLargeTradeFlowReport } from "@/lib/server/largeTradeFlowSource";
import { fetchLiquidationPressureReport } from "@/lib/server/liquidationPressureSource";
import { analyzeTimeframe, type Candle } from "@/lib/marketAnalysis";
import { parseClosedBinanceKlines, sourceAgeMs } from "@/lib/marketTime";
import {
  buildPerpetualDecisionSnapshot,
  perpetualDecisionEngineVersion,
  serializeStoredPerpetualSnapshot,
  type PerpetualAsset,
  type PerpetualDecisionSnapshot,
  type PerpetualSymbol,
  type PerpetualTimeframeObservation,
  type SourceStatus
} from "@/lib/perpetualDecisionSnapshot";
import {
  buildStalePerpetualDecisionFallback as buildStaleSnapshotFallback,
  canReuseRequestedPerpetualSnapshot as canReuseRequestedSnapshot,
  choosePersistedSnapshotWinner as chooseCanonicalSnapshotWinner
} from "@/lib/perpetualSnapshotContinuity";
import { isSupabaseAdminConfigured, supabaseAdminRest } from "@/lib/server/supabaseAdmin";

const BINANCE_FAPI = "https://fapi.binance.com";
const FETCH_TIMEOUT_MS = 5_500;
const SNAPSHOT_TTL_MS = 60_000;

type PerpetualDecisionMemoryStore = {
  snapshotsById: Map<string, PerpetualDecisionSnapshot>;
  latestByAsset: Map<PerpetualAsset, PerpetualDecisionSnapshot>;
  generationPromises: Map<string, Promise<PerpetualDecisionSnapshot>>;
};

const perpetualDecisionGlobal = globalThis as typeof globalThis & {
  __chartRadarPerpetualDecisionMemoryStore?: PerpetualDecisionMemoryStore;
};
const perpetualDecisionMemoryStore = perpetualDecisionGlobal.__chartRadarPerpetualDecisionMemoryStore ?? {
  snapshotsById: new Map<string, PerpetualDecisionSnapshot>(),
  latestByAsset: new Map<PerpetualAsset, PerpetualDecisionSnapshot>(),
  generationPromises: new Map<string, Promise<PerpetualDecisionSnapshot>>()
};
perpetualDecisionGlobal.__chartRadarPerpetualDecisionMemoryStore = perpetualDecisionMemoryStore;

const memorySnapshotsById = perpetualDecisionMemoryStore.snapshotsById;
const memoryLatestByAsset = perpetualDecisionMemoryStore.latestByAsset;
const generationPromises = perpetualDecisionMemoryStore.generationPromises;
let warnedPersistenceFailure = false;

const timeframeFreshnessMs = {
  "15m": 20 * 60 * 1000,
  "1h": 70 * 60 * 1000,
  "4h": 250 * 60 * 1000
} as const;

type SnapshotContinuityStatus = "same" | "refreshed" | "current";

export interface PerpetualSnapshotResolution {
  snapshot: PerpetualDecisionSnapshot;
  continuity: {
    status: SnapshotContinuityStatus;
    requestedSnapshotId?: string;
  };
}

interface StoredSnapshotRow {
  id: string;
  fingerprint: string;
  asset: PerpetualAsset;
  symbol: PerpetualSymbol;
  exchange: "binance";
  engine_version: string;
  generated_at: string;
  expires_at: string;
  quality: PerpetualDecisionSnapshot["quality"];
  source_status: PerpetualDecisionSnapshot["sourceStatus"];
  public_payload: Omit<PerpetualDecisionSnapshot, "pro">;
  pro_payload: PerpetualDecisionSnapshot["pro"] | null;
}

function symbolFor(asset: PerpetualAsset): PerpetualSymbol {
  return asset === "eth" ? "ETHUSDT" : "BTCUSDT";
}

export function normalizePerpetualAsset(value: string | null | undefined): PerpetualAsset | null {
  const normalized = value?.trim().toLowerCase();
  return normalized === "btc" || normalized === "eth" ? normalized : null;
}

export function isSnapshotId(value: string | null | undefined) {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

async function fetchJson<T>(url: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "ChartRadar/1.0" },
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Binance Futures ${response.status}`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchClosedCandles(symbol: PerpetualSymbol, timeframe: "15m" | "1h" | "4h", asOfMs: number) {
  const params = new URLSearchParams({ symbol, interval: timeframe, limit: "320", endTime: String(asOfMs) });
  const rows = await fetchJson<unknown>(`${BINANCE_FAPI}/fapi/v1/klines?${params.toString()}`);
  const parsed = parseClosedBinanceKlines(rows, asOfMs);
  if (parsed.candles.length < 60 || !parsed.observedAt) {
    throw new Error(`${symbol} ${timeframe} closed futures candles unavailable`);
  }
  const latest = parsed.candles.at(-1);
  if (!latest) throw new Error(`${symbol} ${timeframe} latest closed candle unavailable`);
  return {
    timeframe,
    candles: parsed.candles,
    observedAt: parsed.observedAt,
    droppedIncomplete: parsed.droppedIncomplete,
    rangeHigh: latest.high,
    rangeLow: latest.low,
    closedPrice: latest.close
  };
}

export async function fetchPerpetualFuturesPrice(symbol: PerpetualSymbol) {
  const payload = await fetchJson<{ price?: string }>(`${BINANCE_FAPI}/fapi/v1/ticker/price?symbol=${symbol}`);
  const price = Number(payload.price);
  if (!Number.isFinite(price) || price <= 0) throw new Error(`${symbol} futures price unavailable`);
  return price;
}

function candleSourceStatus(
  rows: Array<{ timeframe: "15m" | "1h" | "4h"; observedAt: string; droppedIncomplete: number }>,
  asOfMs: number,
  priceFallback: boolean
): SourceStatus {
  if (rows.length !== 3) return { status: "unavailable", observedAt: null, detail: "필수 확정 캔들을 받지 못했습니다." };
  const stale = rows.filter((row) => sourceAgeMs(row.observedAt, asOfMs) > timeframeFreshnessMs[row.timeframe]);
  const observedAt = rows.find((row) => row.timeframe === "15m")?.observedAt ?? rows[0]?.observedAt ?? null;
  if (priceFallback) return { status: "partial", observedAt, detail: "선물 현재가를 받지 못해 마지막 확정가를 사용했습니다." };
  if (stale.length) return { status: "stale", observedAt, detail: `${stale.map((row) => row.timeframe).join("·")} 확정 캔들의 시차가 큽니다.` };
  const dropped = rows.reduce((sum, row) => sum + row.droppedIncomplete, 0);
  return { status: "ready", observedAt, detail: `진행 중 캔들 ${dropped}개를 제외했습니다.` };
}

function pressureSourceStatus(report: Awaited<ReturnType<typeof fetchLiquidationPressureReport>> | null, asOfMs: number): SourceStatus {
  if (!report) return { status: "unavailable", observedAt: null, detail: "청산 압력 소스를 받지 못했습니다." };
  const observedAt = new Date(report.updatedAt).toISOString();
  const crowdingCount = [
    report.globalLongShort.longPercent,
    report.topAccountLongShort.longPercent,
    report.topPositionLongShort.longPercent,
    report.takerFlow.buyPercent
  ].filter((value) => value !== null).length;
  const hasOpenInterest = report.openInterestValue !== null && report.openInterestChangePercent !== null;
  const usesNonBinanceFunding = Boolean(report.fundingRateSource && report.fundingRateSource !== "Binance");
  if (!hasOpenInterest || crowdingCount < 2 || usesNonBinanceFunding) {
    return { status: "partial", observedAt, detail: "OI와 포지션 쏠림 근거가 충분하지 않습니다." };
  }
  if (sourceAgeMs(observedAt, asOfMs) > 75 * 60 * 1000) {
    return { status: "stale", observedAt, detail: "청산 압력 관측 시각이 75분을 넘었습니다." };
  }
  return { status: "ready", observedAt, detail: `OI와 쏠림 근거 ${crowdingCount}개를 확인했습니다.` };
}

function flowSourceStatus(report: Awaited<ReturnType<typeof fetchLargeTradeFlowReport>> | null, asOfMs: number): SourceStatus {
  if (!report || report.tradeCount <= 0) return { status: "unavailable", observedAt: null, detail: "최근 선물 체결을 받지 못했습니다." };
  const observedAt = new Date(report.updatedAt).toISOString();
  if (sourceAgeMs(observedAt, asOfMs) > 2 * 60 * 1000) {
    return { status: "stale", observedAt, detail: "최근 선물 체결 관측 시각이 2분을 넘었습니다." };
  }
  return {
    status: "ready",
    observedAt,
    detail: report.largeTradeCount > 0 ? `기준 이상 체결 ${report.largeTradeCount}건을 확인했습니다.` : "최근 체결은 정상이며 기준 이상 큰 체결은 없습니다."
  };
}

function canonicalFingerprint(input: {
  asset: PerpetualAsset;
  price: number;
  observations: PerpetualTimeframeObservation[];
  pressure: Awaited<ReturnType<typeof fetchLiquidationPressureReport>> | null;
  flow: Awaited<ReturnType<typeof fetchLargeTradeFlowReport>> | null;
}) {
  const tick = input.asset === "btc" ? 0.1 : 0.01;
  const payload = {
    engineVersion: perpetualDecisionEngineVersion,
    asset: input.asset,
    priceTick: Math.round(input.price / tick),
    timeframes: input.observations.map((observation) => ({
      timeframe: observation.timeframe,
      observedAt: observation.observedAt,
      closedPrice: observation.closedPrice,
      msb: observation.analysis.msb,
      choch: observation.analysis.choch,
      score: observation.analysis.score,
      rangeHigh: observation.rangeHigh,
      rangeLow: observation.rangeLow
    })),
    pressure: input.pressure
      ? {
          observedAt: input.pressure.updatedAt,
          dominantSide: input.pressure.dominantSide,
          grade: input.pressure.grade,
          upside: input.pressure.upsideShortPressure,
          downside: input.pressure.downsideLongPressure
        }
      : null,
    flow: input.flow
      ? {
          observedAt: input.flow.updatedAt,
          dominantSide: input.flow.dominantSide,
          grade: input.flow.grade,
          imbalance: Number(input.flow.imbalancePercent.toFixed(2)),
          count: input.flow.largeTradeCount
        }
      : null
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function snapshotFromRow(row: StoredSnapshotRow): PerpetualDecisionSnapshot {
  return {
    ...row.public_payload,
    id: row.id,
    fingerprint: row.fingerprint,
    engineVersion: row.engine_version,
    asset: row.asset,
    symbol: row.symbol,
    exchange: row.exchange,
    generatedAt: row.generated_at,
    expiresAt: row.expires_at,
    quality: row.quality,
    sourceStatus: row.source_status,
    ...(row.pro_payload ? { pro: row.pro_payload } : {})
  };
}

function rememberSnapshot(snapshot: PerpetualDecisionSnapshot) {
  memorySnapshotsById.set(snapshot.id, snapshot);
  const previous = memoryLatestByAsset.get(snapshot.asset);
  if (!previous || new Date(previous.generatedAt).getTime() <= new Date(snapshot.generatedAt).getTime()) {
    memoryLatestByAsset.set(snapshot.asset, snapshot);
  }
  if (memorySnapshotsById.size > 200) {
    const oldest = Array.from(memorySnapshotsById.values()).sort((left, right) => left.generatedAt.localeCompare(right.generatedAt)).slice(0, 50);
    oldest.forEach((entry) => memorySnapshotsById.delete(entry.id));
  }
}

function persistenceWarning(error: unknown) {
  if (warnedPersistenceFailure) return;
  warnedPersistenceFailure = true;
  console.warn("[perpetual-decision] Supabase snapshot persistence unavailable; using memory only.", error);
}

export async function getPerpetualDecisionSnapshotById(id: string) {
  const memory = memorySnapshotsById.get(id);
  if (memory) return memory;
  if (!isSupabaseAdminConfigured()) return null;
  try {
    const rows = await supabaseAdminRest<StoredSnapshotRow[]>(
      `perpetual_decision_snapshots?select=*&id=eq.${encodeURIComponent(id)}&limit=1`
    );
    if (!rows[0]) return null;
    const snapshot = snapshotFromRow(rows[0]);
    rememberSnapshot(snapshot);
    return snapshot;
  } catch (error) {
    persistenceWarning(error);
    return null;
  }
}

async function loadLatestStoredSnapshot(asset: PerpetualAsset) {
  const memory = memoryLatestByAsset.get(asset);
  if (memory) return memory;
  if (!isSupabaseAdminConfigured()) return null;
  try {
    const rows = await supabaseAdminRest<StoredSnapshotRow[]>(
      `perpetual_decision_snapshots?select=*&asset=eq.${asset}&engine_version=eq.${encodeURIComponent(perpetualDecisionEngineVersion)}&order=generated_at.desc&limit=1`
    );
    if (!rows[0]) return null;
    const snapshot = snapshotFromRow(rows[0]);
    rememberSnapshot(snapshot);
    return snapshot;
  } catch (error) {
    persistenceWarning(error);
    return null;
  }
}

export async function getReadyPerpetualSnapshotBefore(
  asset: PerpetualAsset,
  beforeAt: string,
  withinMinutes = 10
) {
  const beforeMs = Date.parse(beforeAt);
  if (!Number.isFinite(beforeMs)) return null;
  const lowerAt = new Date(beforeMs - withinMinutes * 60_000).toISOString();
  const memory = Array.from(memorySnapshotsById.values())
    .filter((snapshot) => snapshot.asset === asset && snapshot.quality === "ready" && snapshot.engineVersion === perpetualDecisionEngineVersion)
    .filter((snapshot) => snapshot.generatedAt < beforeAt && snapshot.generatedAt >= lowerAt)
    .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt))[0];
  if (memory) return memory;
  if (!isSupabaseAdminConfigured()) return null;
  try {
    const rows = await supabaseAdminRest<StoredSnapshotRow[]>(
      `perpetual_decision_snapshots?select=*&asset=eq.${asset}&quality=eq.ready&engine_version=eq.${encodeURIComponent(perpetualDecisionEngineVersion)}&generated_at=lt.${encodeURIComponent(beforeAt)}&generated_at=gte.${encodeURIComponent(lowerAt)}&order=generated_at.desc&limit=1`
    );
    if (!rows[0]) return null;
    const snapshot = snapshotFromRow(rows[0]);
    rememberSnapshot(snapshot);
    return snapshot;
  } catch (error) {
    persistenceWarning(error);
    return null;
  }
}

export async function getReadyPerpetualSnapshotAfter(
  asset: PerpetualAsset,
  afterAt: string,
  withinMinutes = 10
) {
  const afterMs = Date.parse(afterAt);
  if (!Number.isFinite(afterMs)) return null;
  const upperAt = new Date(afterMs + withinMinutes * 60_000).toISOString();
  const memory = Array.from(memorySnapshotsById.values())
    .filter((snapshot) => snapshot.asset === asset && snapshot.quality === "ready" && snapshot.engineVersion === perpetualDecisionEngineVersion)
    .filter((snapshot) => snapshot.generatedAt >= afterAt && snapshot.generatedAt <= upperAt)
    .sort((left, right) => left.generatedAt.localeCompare(right.generatedAt))[0];
  if (memory) return memory;
  if (!isSupabaseAdminConfigured()) return null;
  try {
    const rows = await supabaseAdminRest<StoredSnapshotRow[]>(
      `perpetual_decision_snapshots?select=*&asset=eq.${asset}&quality=eq.ready&engine_version=eq.${encodeURIComponent(perpetualDecisionEngineVersion)}&generated_at=gte.${encodeURIComponent(afterAt)}&generated_at=lte.${encodeURIComponent(upperAt)}&order=generated_at.asc&limit=1`
    );
    if (!rows[0]) return null;
    const snapshot = snapshotFromRow(rows[0]);
    rememberSnapshot(snapshot);
    return snapshot;
  } catch (error) {
    persistenceWarning(error);
    return null;
  }
}

export async function generatePeriodicPerpetualDecisionSnapshots(asOf = new Date()) {
  const settled = await Promise.allSettled((['btc', 'eth'] as const).map(async (asset) => (
    await resolvePerpetualDecisionSnapshot({ asset, asOf })
  ).snapshot));
  return settled.map((result, index) => ({
    asset: (['btc', 'eth'] as const)[index],
    snapshot: result.status === "fulfilled" ? result.value : null,
    error: result.status === "rejected" ? (result.reason instanceof Error ? result.reason.message : String(result.reason)) : null
  }));
}

async function loadStoredSnapshotBucketRows(asset: PerpetualAsset, bucketAt: string) {
  return supabaseAdminRest<StoredSnapshotRow[]>(
    `perpetual_decision_snapshots?select=*&asset=eq.${asset}&bucket_at=eq.${encodeURIComponent(bucketAt)}&engine_version=eq.${encodeURIComponent(perpetualDecisionEngineVersion)}&limit=1`
  );
}

async function persistSnapshot(snapshot: PerpetualDecisionSnapshot) {
  if (!isSupabaseAdminConfigured()) {
    rememberSnapshot(snapshot);
    return snapshot;
  }
  const publicPayload = serializeStoredPerpetualSnapshot(snapshot);
  const bucketAt = new Date(
    Math.floor(new Date(snapshot.generatedAt).getTime() / SNAPSHOT_TTL_MS) * SNAPSHOT_TTL_MS
  ).toISOString();
  try {
    const rows = await supabaseAdminRest<StoredSnapshotRow[]>("perpetual_decision_snapshots?on_conflict=asset,bucket_at,engine_version", {
      method: "POST",
      prefer: "resolution=ignore-duplicates,return=representation",
      body: {
        id: snapshot.id,
        fingerprint: snapshot.fingerprint,
        asset: snapshot.asset,
        symbol: snapshot.symbol,
        exchange: snapshot.exchange,
        engine_version: snapshot.engineVersion,
        bucket_at: bucketAt,
        generated_at: snapshot.generatedAt,
        expires_at: snapshot.expiresAt,
        quality: snapshot.quality,
        source_status: snapshot.sourceStatus,
        public_payload: publicPayload,
        pro_payload: snapshot.pro ?? null
      }
    });
    const conflictRows = rows[0] ? [] : await loadStoredSnapshotBucketRows(snapshot.asset, bucketAt);
    const stored = snapshotFromRow(chooseCanonicalSnapshotWinner(rows, conflictRows));
    rememberSnapshot(stored);
    return stored;
  } catch (error) {
    persistenceWarning(error);
    // Snapshot reading remains useful during a storage outage. Monitor creation
    // still fails closed because its route requires the service-role store/RPC.
    rememberSnapshot(snapshot);
    return snapshot;
  }
}

export async function hydratePerpetualDecisionChart(
  snapshot: PerpetualDecisionSnapshot,
  asOf = new Date(snapshot.generatedAt)
): Promise<PerpetualDecisionSnapshot> {
  if (snapshot.chart.candles.length > 0) return snapshot;
  try {
    const row = await fetchClosedCandles(snapshot.symbol, snapshot.primaryTimeframe, asOf.getTime());
    return {
      ...snapshot,
      chart: {
        timeframe: snapshot.primaryTimeframe,
        candles: row.candles.slice(-96)
      }
    };
  } catch {
    return snapshot;
  }
}

async function generateSnapshot(asset: PerpetualAsset, asOf: Date, previousSnapshot: PerpetualDecisionSnapshot | null) {
  const symbol = symbolFor(asset);
  const asOfMs = asOf.getTime();
  const candleRows = await Promise.all([
    fetchClosedCandles(symbol, "15m", asOfMs),
    fetchClosedCandles(symbol, "1h", asOfMs),
    fetchClosedCandles(symbol, "4h", asOfMs)
  ]);
  const [priceResult, pressureResult, flowResult] = await Promise.allSettled([
    fetchPerpetualFuturesPrice(symbol),
    fetchLiquidationPressureReport(symbol, "1h"),
    fetchLargeTradeFlowReport(symbol)
  ]);
  const fallbackPrice = candleRows[0].candles.at(-1)?.close ?? 0;
  const priceFallback = priceResult.status !== "fulfilled";
  const price = priceResult.status === "fulfilled" ? priceResult.value : fallbackPrice;
  if (!Number.isFinite(price) || price <= 0) throw new Error(`${symbol} decision price unavailable`);
  const pressure = pressureResult.status === "fulfilled" ? pressureResult.value : null;
  const flow = flowResult.status === "fulfilled" ? flowResult.value : null;
  const observations = candleRows.map((row) => ({
    timeframe: row.timeframe,
    analysis: analyzeTimeframe(row.timeframe, row.candles),
    observedAt: row.observedAt,
    closedPrice: row.closedPrice,
    rangeHigh: row.rangeHigh,
    rangeLow: row.rangeLow,
    candleTimes: row.candles.map((candle) => candle.time)
  })) as [PerpetualTimeframeObservation, PerpetualTimeframeObservation, PerpetualTimeframeObservation];
  const sourceStatus = {
    candles: candleSourceStatus(candleRows, asOfMs, priceFallback),
    pressure: pressureSourceStatus(pressure, asOfMs),
    flow: flowSourceStatus(flow, asOfMs)
  };
  const fingerprint = canonicalFingerprint({ asset, price, observations, pressure, flow });
  return buildPerpetualDecisionSnapshot({
    id: randomUUID(),
    fingerprint,
    asset,
    price,
    chartCandles: candleRows[0].candles,
    generatedAt: asOf.toISOString(),
    sourceStatus,
    timeframes: observations,
    pressure,
    flow,
    previousSnapshot
  });
}

async function currentSnapshot(asset: PerpetualAsset, asOf: Date) {
  const asOfMs = asOf.getTime();
  const latest = await loadLatestStoredSnapshot(asset);
  if (latest && latest.engineVersion === perpetualDecisionEngineVersion && new Date(latest.expiresAt).getTime() > asOfMs) {
    return latest;
  }
  const bucket = Math.floor(asOfMs / SNAPSHOT_TTL_MS);
  const key = `${asset}:${bucket}`;
  const running = generationPromises.get(key);
  if (running) return running;
  const promise = generateSnapshot(asset, asOf, latest).then(persistSnapshot).finally(() => generationPromises.delete(key));
  generationPromises.set(key, promise);
  return promise;
}

function staleFallback(snapshot: PerpetualDecisionSnapshot): PerpetualDecisionSnapshot {
  return {
    ...snapshot,
    quality: "stale",
    sourceStatus: {
      candles: { ...snapshot.sourceStatus.candles, status: "stale", detail: "최신 갱신 실패로 마지막 정상 판단을 표시합니다." },
      pressure: { ...snapshot.sourceStatus.pressure, status: "stale", detail: "최신 갱신 실패로 마지막 관측값을 표시합니다." },
      flow: { ...snapshot.sourceStatus.flow, status: "stale", detail: "최신 갱신 실패로 마지막 관측값을 표시합니다." }
    }
  };
}

export async function resolvePerpetualDecisionSnapshot({
  asset,
  requestedSnapshotId,
  allowExpiredRequestedSnapshot = false,
  asOf = new Date()
}: {
  asset: PerpetualAsset;
  requestedSnapshotId?: string | null;
  allowExpiredRequestedSnapshot?: boolean;
  asOf?: Date;
}): Promise<PerpetualSnapshotResolution> {
  const requested = requestedSnapshotId && isSnapshotId(requestedSnapshotId)
    ? await getPerpetualDecisionSnapshotById(requestedSnapshotId)
    : null;
  if (requested && canReuseRequestedSnapshot({
    snapshot: requested,
    asset,
    asOf,
    allowExpired: allowExpiredRequestedSnapshot
  })) {
    return {
      snapshot: requested,
      continuity: { status: "same", requestedSnapshotId: requestedSnapshotId ?? undefined }
    };
  }

  try {
    const current = await currentSnapshot(asset, asOf);
    return {
      snapshot: current,
      continuity: {
        status: requestedSnapshotId ? "refreshed" : "current",
        ...(requestedSnapshotId ? { requestedSnapshotId } : {})
      }
    };
  } catch (error) {
    const fallback = await loadLatestStoredSnapshot(asset);
    if (!fallback) throw error;
    return {
      snapshot: buildStaleSnapshotFallback(staleFallback(fallback)),
      continuity: {
        status: requestedSnapshotId ? "refreshed" : "current",
        ...(requestedSnapshotId ? { requestedSnapshotId } : {})
      }
    };
  }
}

export function resetPerpetualDecisionMemoryStoreForTests() {
  memorySnapshotsById.clear();
  memoryLatestByAsset.clear();
  generationPromises.clear();
}
