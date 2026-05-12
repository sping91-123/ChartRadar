// Binance 공개 데이터로 청산 압력 레이더 리포트를 제공하는 API 라우트입니다.
import { NextResponse } from "next/server";
import { buildLiquidationPressureReport, type LongShortSnapshot, type TakerFlowSnapshot } from "@/lib/liquidationPressure";
import { rateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 60 * 1000;
const BINANCE_FAPI = "https://fapi.binance.com";
const allowedPeriods = new Set(["5m", "15m", "30m", "1h", "2h", "4h", "6h", "12h", "1d"]);

interface PremiumIndexPayload {
  symbol: string;
  markPrice: string;
  indexPrice: string;
  lastFundingRate: string;
  nextFundingTime: number;
}

interface OpenInterestHistRow {
  symbol: string;
  sumOpenInterest: string;
  sumOpenInterestValue: string;
  timestamp: number;
}

interface LongShortRow {
  symbol: string;
  longAccount: string;
  shortAccount: string;
  longShortRatio: string;
  timestamp: number;
}

interface TakerLongShortRow {
  buySellRatio: string;
  buyVol: string;
  sellVol: string;
  timestamp: number;
}

interface CacheValue {
  cachedAt: number;
  report: ReturnType<typeof buildLiquidationPressureReport>;
}

const cache = new Map<string, CacheValue>();

function normalizeSymbol(raw: string | null) {
  const fallback = "BTCUSDT";
  if (!raw) return fallback;
  const cleaned = raw.toUpperCase().replace(".P", "").replace("/", "").trim();
  if (!/^[A-Z0-9]{2,30}$/.test(cleaned)) return null;
  return cleaned.endsWith("USDT") ? cleaned : `${cleaned}USDT`;
}

function normalizePeriod(raw: string | null) {
  if (!raw) return "15m";
  if (allowedPeriods.has(raw)) return raw;
  return null;
}

function invalidParam(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function parseQuery(url: URL) {
  const rawSymbol = url.searchParams.get("symbol");
  const rawPeriod = url.searchParams.get("period");
  const symbol = normalizeSymbol(rawSymbol);
  const period = normalizePeriod(rawPeriod);

  if (!symbol) {
    return {
      error: invalidParam("지원하지 않는 코인 심볼입니다.")
    };
  }

  if (!period) {
    return {
      error: NextResponse.json(
        {
          error: "지원하지 않는 기간입니다.",
          allowedPeriods: Array.from(allowedPeriods)
        },
        { status: 400 }
      )
    };
  }

  return { symbol, period };
}

function toNumber(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function unwrapRows<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object" && Array.isArray((payload as { value?: unknown }).value)) {
    return (payload as { value: T[] }).value;
  }
  return [];
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Binance ${response.status}`);
  }

  return (await response.json()) as T;
}

function parseLongShort(row: LongShortRow | null): LongShortSnapshot {
  if (!row) return { longPercent: null, shortPercent: null, ratio: null };
  const long = toNumber(row.longAccount);
  const short = toNumber(row.shortAccount);

  return {
    longPercent: long === null ? null : long * 100,
    shortPercent: short === null ? null : short * 100,
    ratio: toNumber(row.longShortRatio)
  };
}

function parseTakerFlow(row: TakerLongShortRow | null): TakerFlowSnapshot {
  if (!row) return { buyVolume: null, sellVolume: null, buyPercent: null, sellPercent: null };
  const buyVolume = toNumber(row.buyVol);
  const sellVolume = toNumber(row.sellVol);
  const total = (buyVolume ?? 0) + (sellVolume ?? 0);

  return {
    buyVolume,
    sellVolume,
    buyPercent: total > 0 && buyVolume !== null ? (buyVolume / total) * 100 : null,
    sellPercent: total > 0 && sellVolume !== null ? (sellVolume / total) * 100 : null
  };
}

function openInterestChange(rows: OpenInterestHistRow[]) {
  if (rows.length < 2) return { value: null as number | null, changePercent: null as number | null };
  const first = toNumber(rows[0]?.sumOpenInterestValue);
  const last = toNumber(rows[rows.length - 1]?.sumOpenInterestValue);
  if (!first || first <= 0 || last === null) return { value: last, changePercent: null };

  return {
    value: last,
    changePercent: ((last - first) / first) * 100
  };
}

export async function GET(request: Request) {
  const limit = await rateLimit(request, { key: "liquidation-pressure", limit: 40, windowMs: 5 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "청산 압력 레이더 요청이 잠시 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const url = new URL(request.url);
  const parsedQuery = parseQuery(url);
  if ("error" in parsedQuery) return parsedQuery.error;

  const { symbol, period } = parsedQuery;
  const cacheKey = `${symbol}:${period}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);

  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    return NextResponse.json({ report: cached.report, cachedAt: cached.cachedAt, cached: true });
  }

  try {
    const [
      premiumIndexPayload,
      openInterestPayload,
      globalLongShortPayload,
      topAccountPayload,
      topPositionPayload,
      takerPayload
    ] = await Promise.all([
      fetchJson<PremiumIndexPayload>(`${BINANCE_FAPI}/fapi/v1/premiumIndex?symbol=${symbol}`),
      fetchJson<OpenInterestHistRow[]>(`${BINANCE_FAPI}/futures/data/openInterestHist?symbol=${symbol}&period=${period}&limit=12`),
      fetchJson<LongShortRow[]>(`${BINANCE_FAPI}/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=${period}&limit=1`),
      fetchJson<LongShortRow[]>(`${BINANCE_FAPI}/futures/data/topLongShortAccountRatio?symbol=${symbol}&period=${period}&limit=1`),
      fetchJson<LongShortRow[]>(`${BINANCE_FAPI}/futures/data/topLongShortPositionRatio?symbol=${symbol}&period=${period}&limit=1`),
      fetchJson<TakerLongShortRow[]>(`${BINANCE_FAPI}/futures/data/takerlongshortRatio?symbol=${symbol}&period=${period}&limit=1`)
    ]);

    const oi = openInterestChange(unwrapRows<OpenInterestHistRow>(openInterestPayload));
    const report = buildLiquidationPressureReport({
      symbol,
      period,
      markPrice: Number(premiumIndexPayload.markPrice),
      indexPrice: Number(premiumIndexPayload.indexPrice),
      fundingRate: Number(premiumIndexPayload.lastFundingRate),
      nextFundingTime: premiumIndexPayload.nextFundingTime,
      openInterestValue: oi.value,
      openInterestChangePercent: oi.changePercent,
      globalLongShort: parseLongShort(unwrapRows<LongShortRow>(globalLongShortPayload)[0] ?? null),
      topAccountLongShort: parseLongShort(unwrapRows<LongShortRow>(topAccountPayload)[0] ?? null),
      topPositionLongShort: parseLongShort(unwrapRows<LongShortRow>(topPositionPayload)[0] ?? null),
      takerFlow: parseTakerFlow(unwrapRows<TakerLongShortRow>(takerPayload)[0] ?? null),
      updatedAt: Date.now()
    });

    cache.set(cacheKey, { cachedAt: Date.now(), report });
    return NextResponse.json({ report, cachedAt: Date.now(), cached: false });
  } catch (error) {
    console.error("[api/liquidation-pressure] error:", error);
    if (cached) {
      return NextResponse.json({ report: cached.report, cachedAt: cached.cachedAt, cached: true, stale: true });
    }
    return NextResponse.json({ error: "청산 압력 데이터를 불러오지 못했습니다." }, { status: 500 });
  }
}
