export type MarketMetricFreshness = "live" | "hourly" | "daily" | "stale" | "unavailable";
export type MarketMetricCadence = "live" | "hourly" | "daily";
export type UsdKrwSource = "exchangerate-dev" | "exchangerate-fun" | "frankfurter";

export interface CoinMarketMetricsPayload {
  /**
   * TradingView BTC.D does not expose a documented numeric REST contract.
   * The exact value is rendered through the official widget instead of
   * substituting a differently-defined global-market percentage here.
   */
  btcDominancePercent: null;
  btcDominanceSource: "tradingview";
  btcDominanceSymbol: "CRYPTOCAP:BTC.D";
  usdKrw: number | null;
  usdKrwSource: UsdKrwSource | null;
  usdKrwObservedAt: string | null;
  usdKrwReferenceDate: string | null;
  usdKrwFreshness: MarketMetricFreshness;
  usdKrwCadence: MarketMetricCadence | null;
  kimchiPremiumPercent: number | null;
  kimchiSource: "upbit-binance-spot-coinbase-usdt-usd" | null;
  kimchiStale: boolean;
  kimchiObservedAt: string | null;
  kimchiCalculatedAt: string | null;
  kimchiFxRate: number | null;
  kimchiFxSource: UsdKrwSource | null;
  kimchiFxObservedAt: string | null;
  kimchiFxReferenceDate: string | null;
  kimchiFxFreshness: MarketMetricFreshness;
  kimchiFxCadence: MarketMetricCadence | null;
  kimchiUsdtUsdRate: number | null;
  kimchiUsdtUsdObservedAt: string | null;
  upbitBtcObservedAt: string | null;
  binanceBtcObservedAt: string | null;
  cachedAt: number;
  cached: boolean;
  stale?: boolean;
  warnings: string[];
}

export interface FxMetricObservation {
  value: number;
  source: UsdKrwSource;
  observedAt: string | null;
  referenceDate: string | null;
  freshness: MarketMetricCadence;
}

export interface PriceMetricObservation {
  value: number;
  observedAt: string;
}

export interface CoinMarketMetricObservations {
  fx: FxMetricObservation | null;
  upbitBtc: PriceMetricObservation | null;
  binanceBtcUsdt: PriceMetricObservation | null;
  coinbaseUsdtUsd: PriceMetricObservation | null;
}

const DAY_MS = 24 * 60 * 60_000;
const LIVE_FX_MAX_AGE_MS = 10 * 60_000;
const HOURLY_FX_MAX_AGE_MS = 90 * 60_000;
const DAILY_FX_MAX_AGE_DAYS = 4;
const CACHED_LIVE_FX_MAX_AGE_MS = 30 * 60_000;
const CACHED_HOURLY_FX_MAX_AGE_MS = 3 * 60 * 60_000;
const LAST_GOOD_KIMCHI_TTL_MS = 15 * 60_000;
const MARKET_OBSERVATION_MAX_AGE_MS = 5 * 60_000;
const MARKET_OBSERVATION_MAX_SKEW_MS = 2 * 60_000;

export function finitePositiveNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function calculateKimchiPremium({
  upbitBtcKrw,
  binanceBtcUsdt,
  usdtUsd,
  usdKrw
}: {
  upbitBtcKrw: unknown;
  binanceBtcUsdt: unknown;
  usdtUsd: unknown;
  usdKrw: unknown;
}): number | null {
  const domestic = finitePositiveNumber(upbitBtcKrw);
  const offshoreUsdt = finitePositiveNumber(binanceBtcUsdt);
  const stablecoinUsd = finitePositiveNumber(usdtUsd);
  const exchangeRate = finitePositiveNumber(usdKrw);
  if (domestic === null || offshoreUsdt === null || stablecoinUsd === null || exchangeRate === null) return null;

  return (domestic / (offshoreUsdt * stablecoinUsd * exchangeRate) - 1) * 100;
}

export function isRecentObservation(
  observedAt: string | null | undefined,
  nowMs: number,
  maxAgeMs: number,
  futureToleranceMs = 60_000
): boolean {
  if (!observedAt) return false;
  const observedMs = Date.parse(observedAt);
  if (!Number.isFinite(observedMs)) return false;
  return observedMs <= nowMs + futureToleranceMs && nowMs - observedMs <= maxAgeMs;
}

export function isRecentReferenceDate(
  referenceDate: string | null | undefined,
  nowMs: number,
  maxAgeDays = DAILY_FX_MAX_AGE_DAYS
): boolean {
  if (!referenceDate || !/^\d{4}-\d{2}-\d{2}$/.test(referenceDate)) return false;
  const referenceMs = Date.parse(`${referenceDate}T00:00:00.000Z`);
  if (!Number.isFinite(referenceMs)) return false;
  const [year, month, day] = referenceDate.split("-").map(Number);
  const parsed = new Date(referenceMs);
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() + 1 !== month || parsed.getUTCDate() !== day) return false;

  const now = new Date(nowMs);
  const todayUtcMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const ageDays = Math.floor((todayUtcMs - referenceMs) / DAY_MS);
  return ageDays >= 0 && ageDays <= maxAgeDays;
}

export function observationsAreAligned(
  firstObservedAt: string | null | undefined,
  secondObservedAt: string | null | undefined,
  maxSkewMs: number
): boolean {
  if (!firstObservedAt || !secondObservedAt) return false;
  const firstMs = Date.parse(firstObservedAt);
  const secondMs = Date.parse(secondObservedAt);
  if (!Number.isFinite(firstMs) || !Number.isFinite(secondMs)) return false;
  return Math.abs(firstMs - secondMs) <= maxSkewMs;
}

export function marketObservationsAreActionable(
  observedAt: Array<string | null | undefined>,
  nowMs: number,
  maxAgeMs = MARKET_OBSERVATION_MAX_AGE_MS,
  maxSkewMs = MARKET_OBSERVATION_MAX_SKEW_MS
): boolean {
  if (observedAt.length === 0 || observedAt.some((value) => !isRecentObservation(value, nowMs, maxAgeMs))) return false;

  for (let index = 0; index < observedAt.length; index += 1) {
    for (let comparedIndex = index + 1; comparedIndex < observedAt.length; comparedIndex += 1) {
      if (!observationsAreAligned(observedAt[index], observedAt[comparedIndex], maxSkewMs)) return false;
    }
  }
  return true;
}

export function oldestObservationAt(observedAt: string[]): string | null {
  const timestamps = observedAt.map((value) => Date.parse(value));
  if (!timestamps.length || timestamps.some((value) => !Number.isFinite(value))) return null;
  return new Date(Math.min(...timestamps)).toISOString();
}

export function classifyExchangeRateDevFreshness(sourceClass: unknown): Extract<MarketMetricCadence, "live" | "daily"> | null {
  if (sourceClass === "live") return "live";
  if (sourceClass === "ecb_daily" || sourceClass === "fred_daily") return "daily";
  return null;
}

export function isAcceptableFxObservation(observation: FxMetricObservation, nowMs: number): boolean {
  if (observation.source === "frankfurter") {
    return observation.freshness === "daily" && isRecentReferenceDate(observation.referenceDate, nowMs);
  }
  if (observation.observedAt === null) return false;
  if (observation.source === "exchangerate-fun") {
    return observation.freshness === "hourly" && isRecentObservation(observation.observedAt, nowMs, HOURLY_FX_MAX_AGE_MS, 5 * 60_000);
  }
  if (observation.freshness === "live") {
    return isRecentObservation(observation.observedAt, nowMs, LIVE_FX_MAX_AGE_MS, 5 * 60_000);
  }
  return observation.freshness === "daily" && isRecentObservation(observation.observedAt, nowMs, DAILY_FX_MAX_AGE_DAYS * DAY_MS, 5 * 60_000);
}

function inferCachedFxCadence(payload: CoinMarketMetricsPayload): MarketMetricCadence {
  if (payload.usdKrwCadence) return payload.usdKrwCadence;
  if (payload.usdKrwSource === "frankfurter") return "daily";
  if (payload.usdKrwSource === "exchangerate-fun") return "hourly";
  return payload.usdKrwFreshness === "daily" ? "daily" : "live";
}

export function canReuseCachedUsdKrw(payload: CoinMarketMetricsPayload, nowMs: number): boolean {
  if (finitePositiveNumber(payload.usdKrw) === null || payload.usdKrwSource === null) return false;
  const cadence = inferCachedFxCadence(payload);
  if (payload.usdKrwSource === "frankfurter") {
    return isRecentReferenceDate(payload.usdKrwReferenceDate, nowMs);
  }
  if (cadence === "daily") {
    return isRecentObservation(payload.usdKrwObservedAt, nowMs, DAILY_FX_MAX_AGE_DAYS * DAY_MS, 5 * 60_000);
  }
  const maxAgeMs = cadence === "hourly" ? CACHED_HOURLY_FX_MAX_AGE_MS : CACHED_LIVE_FX_MAX_AGE_MS;
  return isRecentObservation(payload.usdKrwObservedAt, nowMs, maxAgeMs, 5 * 60_000);
}

export function canServeCoinMarketMetricsCache(
  payload: CoinMarketMetricsPayload | null,
  nowMs: number,
  cacheTtlMs: number
): payload is CoinMarketMetricsPayload {
  return Boolean(payload && nowMs >= payload.cachedAt && nowMs - payload.cachedAt < cacheTtlMs);
}

function uniqueWarnings(warnings: string[]) {
  return Array.from(new Set(warnings));
}

export function resolveCoinMarketMetrics({
  observations,
  cachedPayload,
  nowMs,
  warnings: initialWarnings = []
}: {
  observations: CoinMarketMetricObservations;
  cachedPayload: CoinMarketMetricsPayload | null;
  nowMs: number;
  warnings?: string[];
}): CoinMarketMetricsPayload {
  const warnings = [...initialWarnings];
  let fx = observations.fx && isAcceptableFxObservation(observations.fx, nowMs) ? observations.fx : null;
  let fxIsStale = false;
  if (observations.fx && !fx) warnings.push("USD/KRW 기준 시각 또는 출처 확인 제한");

  if (!fx) {
    warnings.push("USD/KRW 확인 제한");
    if (cachedPayload && canReuseCachedUsdKrw(cachedPayload, nowMs)) {
      fx = {
        value: cachedPayload.usdKrw!,
        source: cachedPayload.usdKrwSource!,
        observedAt: cachedPayload.usdKrwObservedAt,
        referenceDate: cachedPayload.usdKrwReferenceDate,
        freshness: inferCachedFxCadence(cachedPayload)
      };
      fxIsStale = true;
      warnings.push("USD/KRW 마지막 정상값 유지");
    }
  }

  const { upbitBtc: upbit, binanceBtcUsdt: binance, coinbaseUsdtUsd: usdtUsd } = observations;
  if (!upbit) warnings.push("Upbit BTC 현물 확인 제한");
  if (!binance) warnings.push("Binance BTC 현물 확인 제한");
  if (!usdtUsd) warnings.push("Coinbase USDT/USD 확인 제한");

  let kimchiPremiumPercent: number | null = null;
  let kimchiObservedAt: string | null = null;
  let kimchiCalculatedAt: string | null = null;
  let kimchiFxRate: number | null = null;
  let kimchiFxSource: UsdKrwSource | null = null;
  let kimchiFxObservedAt: string | null = null;
  let kimchiFxReferenceDate: string | null = null;
  let kimchiFxFreshness: MarketMetricFreshness = "unavailable";
  let kimchiFxCadence: MarketMetricCadence | null = null;
  let kimchiUsdtUsdRate: number | null = null;
  let kimchiUsdtUsdObservedAt: string | null = null;
  let upbitBtcObservedAt = upbit?.observedAt ?? null;
  let binanceBtcObservedAt = binance?.observedAt ?? null;
  let kimchiIsStale = false;

  if (fx && upbit && binance && usdtUsd) {
    const marketObservedAt = [upbit.observedAt, binance.observedAt, usdtUsd.observedAt];
    if (marketObservationsAreActionable(marketObservedAt, nowMs)) {
      kimchiPremiumPercent = calculateKimchiPremium({
        upbitBtcKrw: upbit.value,
        binanceBtcUsdt: binance.value,
        usdtUsd: usdtUsd.value,
        usdKrw: fx.value
      });
      kimchiObservedAt = oldestObservationAt(marketObservedAt);
      kimchiCalculatedAt = new Date(nowMs).toISOString();
      kimchiFxRate = fx.value;
      kimchiFxSource = fx.source;
      kimchiFxObservedAt = fx.observedAt;
      kimchiFxReferenceDate = fx.referenceDate;
      kimchiFxFreshness = fxIsStale ? "stale" : fx.freshness;
      kimchiFxCadence = fx.freshness;
      kimchiUsdtUsdRate = usdtUsd.value;
      kimchiUsdtUsdObservedAt = usdtUsd.observedAt;
    } else {
      warnings.push("국내외 현물 기준 시각 불일치 또는 지연");
    }
  }

  if (
    kimchiPremiumPercent === null &&
    cachedPayload &&
    cachedPayload.kimchiPremiumPercent !== null &&
    isRecentObservation(cachedPayload.kimchiCalculatedAt, nowMs, LAST_GOOD_KIMCHI_TTL_MS)
  ) {
    kimchiPremiumPercent = cachedPayload.kimchiPremiumPercent;
    kimchiObservedAt = cachedPayload.kimchiObservedAt;
    kimchiCalculatedAt = cachedPayload.kimchiCalculatedAt;
    kimchiFxRate = cachedPayload.kimchiFxRate;
    kimchiFxSource = cachedPayload.kimchiFxSource;
    kimchiFxObservedAt = cachedPayload.kimchiFxObservedAt;
    kimchiFxReferenceDate = cachedPayload.kimchiFxReferenceDate;
    kimchiFxFreshness = "stale";
    kimchiFxCadence = cachedPayload.kimchiFxCadence;
    kimchiUsdtUsdRate = cachedPayload.kimchiUsdtUsdRate;
    kimchiUsdtUsdObservedAt = cachedPayload.kimchiUsdtUsdObservedAt;
    upbitBtcObservedAt = cachedPayload.upbitBtcObservedAt;
    binanceBtcObservedAt = cachedPayload.binanceBtcObservedAt;
    kimchiIsStale = true;
    warnings.push("김프 마지막 정상값 유지");
  }

  return {
    btcDominancePercent: null,
    btcDominanceSource: "tradingview",
    btcDominanceSymbol: "CRYPTOCAP:BTC.D",
    usdKrw: fx?.value ?? null,
    usdKrwSource: fx?.source ?? null,
    usdKrwObservedAt: fx?.observedAt ?? null,
    usdKrwReferenceDate: fx?.referenceDate ?? null,
    usdKrwFreshness: fx ? (fxIsStale ? "stale" : fx.freshness) : "unavailable",
    usdKrwCadence: fx?.freshness ?? null,
    kimchiPremiumPercent,
    kimchiSource: kimchiPremiumPercent === null ? null : "upbit-binance-spot-coinbase-usdt-usd",
    kimchiStale: kimchiIsStale || (kimchiPremiumPercent !== null && fxIsStale),
    kimchiObservedAt,
    kimchiCalculatedAt,
    kimchiFxRate,
    kimchiFxSource,
    kimchiFxObservedAt,
    kimchiFxReferenceDate,
    kimchiFxFreshness,
    kimchiFxCadence,
    kimchiUsdtUsdRate,
    kimchiUsdtUsdObservedAt,
    upbitBtcObservedAt,
    binanceBtcObservedAt,
    cachedAt: nowMs,
    cached: false,
    stale: fxIsStale || kimchiIsStale,
    warnings: uniqueWarnings(warnings)
  };
}
