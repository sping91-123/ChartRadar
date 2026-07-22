// 선물 판단의 배경값을 서로 같은 정의와 확인 가능한 기준 시각으로 정리합니다.
import { NextResponse } from "next/server";
import {
  canServeCoinMarketMetricsCache,
  classifyExchangeRateDevFreshness,
  finitePositiveNumber,
  isAcceptableFxObservation,
  resolveCoinMarketMetrics,
  type CoinMarketMetricsPayload,
  type FxMetricObservation,
  type PriceMetricObservation
} from "@/lib/coinMarketMetrics";
import { rateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESPONSE_CACHE_TTL_MS = 60_000;
const FETCH_TIMEOUT_MS = 5_000;
const EXCHANGE_RATE_DEV_URL = "https://api.exchangerate.dev/v1/latest/USD?symbols=KRW";
const EXCHANGE_RATE_FUN_URL = "https://api.exchangerate.fun/latest?base=USD";
const FRANKFURTER_USDKRW_URL = "https://api.frankfurter.app/latest?from=USD&to=KRW";
const UPBIT_BTC_TICKER_URL = "https://api.upbit.com/v1/ticker?markets=KRW-BTC";
const COINBASE_USDT_USD_TICKER_URL = "https://api.exchange.coinbase.com/products/USDT-USD/ticker";
const BINANCE_BTC_SPOT_ENDPOINTS = [
  "https://data-api.binance.vision/api/v3/ticker/24hr?symbol=BTCUSDT",
  "https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT"
] as const;

interface ExchangeRateDevPayload {
  result?: string;
  rates?: { KRW?: number | string };
  timestamp?: string;
  data_updated_at?: string;
  source?: string;
  sources?: { KRW?: string };
}

interface ExchangeRateFunPayload {
  timestamp?: number | string;
  rates?: { KRW?: number | string };
}

interface FrankfurterPayload {
  date?: string;
  rates?: { KRW?: number | string };
}

interface UpbitTickerPayload {
  market?: string;
  trade_price?: number | string;
  trade_timestamp?: number | string;
}

interface BinanceSpotTickerPayload {
  symbol?: string;
  lastPrice?: number | string;
  closeTime?: number | string;
}

interface CoinbaseTickerPayload {
  ask?: number | string;
  bid?: number | string;
  price?: number | string;
  time?: string;
}

let cachedPayload: CoinMarketMetricsPayload | null = null;

function inRange(value: unknown, minimum: number, maximum: number, label: string): number {
  const parsed = finitePositiveNumber(value);
  if (parsed === null || parsed < minimum || parsed > maximum) throw new Error(`${label} 범위 오류`);
  return parsed;
}

function isoFromEpochMilliseconds(value: unknown, label: string): string {
  const timestamp = finitePositiveNumber(value);
  if (timestamp === null) throw new Error(`${label} 기준 시각 누락`);
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) throw new Error(`${label} 기준 시각 오류`);
  return date.toISOString();
}

function isoFromEpochSeconds(value: unknown, label: string): string {
  const timestamp = finitePositiveNumber(value);
  if (timestamp === null) throw new Error(`${label} 기준 시각 누락`);
  return isoFromEpochMilliseconds(timestamp * 1_000, label);
}

function parseIso(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} 기준 시각 누락`);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error(`${label} 기준 시각 오류`);
  return new Date(timestamp).toISOString();
}

async function fetchJson<T>(url: string, headers: HeadersInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "ChartRadar/1.0 (+https://chartradar.kr)",
        ...headers
      },
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`${new URL(url).hostname} returned ${response.status}`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchExchangeRateDev(apiKey: string): Promise<FxMetricObservation> {
  const payload = await fetchJson<ExchangeRateDevPayload>(EXCHANGE_RATE_DEV_URL, {
    Authorization: `Bearer ${apiKey}`
  });
  if (payload.result !== "success") throw new Error("exchangerate.dev 응답 오류");

  const freshness = classifyExchangeRateDevFreshness(payload.sources?.KRW ?? payload.source);
  if (!freshness) throw new Error("exchangerate.dev 출처 분류 오류");
  const observation: FxMetricObservation = {
    value: inRange(payload.rates?.KRW, 500, 3_000, "USD/KRW"),
    source: "exchangerate-dev",
    observedAt: parseIso(payload.data_updated_at ?? payload.timestamp, "USD/KRW"),
    referenceDate: null,
    freshness
  };
  if (!isAcceptableFxObservation(observation, Date.now())) throw new Error("exchangerate.dev 오래된 환율");
  return observation;
}

async function fetchExchangeRateFun(): Promise<FxMetricObservation> {
  const payload = await fetchJson<ExchangeRateFunPayload>(EXCHANGE_RATE_FUN_URL);
  const observation: FxMetricObservation = {
    value: inRange(payload.rates?.KRW, 500, 3_000, "USD/KRW"),
    source: "exchangerate-fun",
    observedAt: isoFromEpochSeconds(payload.timestamp, "USD/KRW"),
    referenceDate: null,
    freshness: "hourly"
  };
  if (!isAcceptableFxObservation(observation, Date.now())) throw new Error("ExchangeRate.fun 오래된 환율");
  return observation;
}

async function fetchFrankfurter(): Promise<FxMetricObservation> {
  const payload = await fetchJson<FrankfurterPayload>(FRANKFURTER_USDKRW_URL);
  if (!payload.date || !/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) throw new Error("Frankfurter 기준일 누락");
  const observation: FxMetricObservation = {
    value: inRange(payload.rates?.KRW, 500, 3_000, "USD/KRW"),
    source: "frankfurter",
    observedAt: null,
    referenceDate: payload.date,
    freshness: "daily"
  };
  if (!isAcceptableFxObservation(observation, Date.now())) throw new Error("Frankfurter 오래된 환율");
  return observation;
}

async function fetchUsdKrw(warnings: string[]): Promise<FxMetricObservation> {
  const apiKey = process.env.EXCHANGE_RATE_DEV_API_KEY?.trim();
  if (apiKey) {
    try {
      return await fetchExchangeRateDev(apiKey);
    } catch {
      warnings.push("실시간 환율 공급자 확인 제한");
    }
  }

  try {
    return await fetchExchangeRateFun();
  } catch {
    warnings.push("시간 단위 환율 확인 제한");
  }

  const fallback = await fetchFrankfurter();
  warnings.push("USD/KRW 전일 기준값 사용");
  return fallback;
}

async function fetchUpbitBtc(): Promise<PriceMetricObservation> {
  const payload = await fetchJson<UpbitTickerPayload[]>(UPBIT_BTC_TICKER_URL);
  const ticker = payload.find((row) => row.market === "KRW-BTC");
  if (!ticker) throw new Error("Upbit KRW-BTC 누락");
  return {
    value: inRange(ticker.trade_price, 1_000_000, 1_000_000_000, "Upbit BTC"),
    observedAt: isoFromEpochMilliseconds(ticker.trade_timestamp, "Upbit BTC")
  };
}

async function fetchBinanceBtcSpot(): Promise<PriceMetricObservation> {
  let lastError: unknown = null;
  for (const endpoint of BINANCE_BTC_SPOT_ENDPOINTS) {
    try {
      const ticker = await fetchJson<BinanceSpotTickerPayload>(endpoint);
      if (ticker.symbol !== "BTCUSDT") throw new Error("Binance BTCUSDT 누락");
      return {
        value: inRange(ticker.lastPrice, 1_000, 1_000_000, "Binance BTC 현물"),
        observedAt: isoFromEpochMilliseconds(ticker.closeTime, "Binance BTC 현물")
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("Binance BTC 현물 확인 제한");
}

async function fetchCoinbaseUsdtUsd(): Promise<PriceMetricObservation> {
  const ticker = await fetchJson<CoinbaseTickerPayload>(COINBASE_USDT_USD_TICKER_URL);
  const bid = inRange(ticker.bid, 0.95, 1.05, "Coinbase USDT/USD bid");
  const ask = inRange(ticker.ask, 0.95, 1.05, "Coinbase USDT/USD ask");
  if (bid > ask || ask - bid > 0.02) throw new Error("Coinbase USDT/USD 호가 오류");
  return {
    value: inRange(ticker.price, 0.95, 1.05, "Coinbase USDT/USD 체결가"),
    observedAt: parseIso(ticker.time, "Coinbase USDT/USD")
  };
}

function logDegradedProviders(results: Array<{ provider: string; result: PromiseSettledResult<unknown> }>) {
  const failedProviders = results
    .filter(({ result }) => result.status === "rejected")
    .map(({ provider, result }) => ({
      provider,
      status: "rejected",
      reason: result.status === "rejected" && result.reason instanceof Error ? result.reason.message : "unknown"
    }));
  if (failedProviders.length > 0) console.warn("[coin-market-metrics] provider degraded", failedProviders);
}

export async function GET(request: Request) {
  const limited = await rateLimit(request, { key: "coin-market-metrics", limit: 30, windowMs: 5 * 60 * 1_000 });
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "코인 시장 환경 요청이 잠시 많습니다. 잠시 뒤 다시 시도해 주세요." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
    );
  }

  const nowMs = Date.now();
  if (canServeCoinMarketMetricsCache(cachedPayload, nowMs, RESPONSE_CACHE_TTL_MS)) {
    return NextResponse.json({ ...cachedPayload, cached: true });
  }

  const warnings: string[] = [];
  const [fxResult, upbitResult, binanceResult, coinbaseResult] = await Promise.allSettled([
    fetchUsdKrw(warnings),
    fetchUpbitBtc(),
    fetchBinanceBtcSpot(),
    fetchCoinbaseUsdtUsd()
  ]);

  logDegradedProviders([
    { provider: "usd-krw", result: fxResult },
    { provider: "upbit-btc-krw", result: upbitResult },
    { provider: "binance-btc-usdt", result: binanceResult },
    { provider: "coinbase-usdt-usd", result: coinbaseResult }
  ]);
  if (warnings.length > 0) {
    console.warn("[coin-market-metrics] source fallback", { warnings: Array.from(new Set(warnings)) });
  }

  const payload = resolveCoinMarketMetrics({
    observations: {
      fx: fxResult.status === "fulfilled" ? fxResult.value : null,
      upbitBtc: upbitResult.status === "fulfilled" ? upbitResult.value : null,
      binanceBtcUsdt: binanceResult.status === "fulfilled" ? binanceResult.value : null,
      coinbaseUsdtUsd: coinbaseResult.status === "fulfilled" ? coinbaseResult.value : null
    },
    cachedPayload,
    nowMs,
    warnings
  });

  cachedPayload = payload;
  return NextResponse.json(payload);
}
