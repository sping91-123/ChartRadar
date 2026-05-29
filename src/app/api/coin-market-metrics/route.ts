// Coin Radar 홈이 사용하는 BTC 도미넌스, 환율, 김프 보조값을 public source에서 정리합니다.
import { NextResponse } from "next/server";
import type { CoinMarketMetricsPayload } from "@/lib/coinMarketMetrics";
import { rateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 2 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5000;
const COINGECKO_GLOBAL_URL = "https://api.coingecko.com/api/v3/global";
const FRANKFURTER_USDKRW_URL = "https://api.frankfurter.app/latest?from=USD&to=KRW";
const UPBIT_BTC_TICKER_URL = "https://api.upbit.com/v1/ticker?markets=KRW-BTC";
const BINANCE_BTC_PRICE_ENDPOINTS = [
  "https://fapi.binance.com/fapi/v1/ticker/price?symbol=BTCUSDT",
  "https://data-api.binance.vision/api/v3/ticker/price?symbol=BTCUSDT"
];

interface CoinGeckoGlobalPayload {
  data?: {
    market_cap_percentage?: {
      btc?: number;
    };
  };
}

interface FrankfurterPayload {
  rates?: {
    KRW?: number;
  };
}

interface UpbitTickerPayload {
  trade_price?: number | string;
}

interface BinancePricePayload {
  price?: number | string;
}

let cachedPayload: CoinMarketMetricsPayload | null = null;

function safeNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

async function fetchJson<T>(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`${url} returned ${response.status}`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchBtcUsd() {
  let lastError: unknown = null;
  for (const endpoint of BINANCE_BTC_PRICE_ENDPOINTS) {
    try {
      const payload = await fetchJson<BinancePricePayload>(endpoint);
      const price = safeNumber(payload.price);
      if (price !== null && price > 0) return price;
      throw new Error("BTCUSDT price unavailable");
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("BTCUSDT price unavailable");
}

function settled<T>(result: PromiseSettledResult<T>, label: string, warnings: string[]) {
  if (result.status === "fulfilled") return result.value;
  warnings.push(`${label} 확인 제한`);
  return null;
}

export async function GET(request: Request) {
  const limited = await rateLimit(request, { key: "coin-market-metrics", limit: 30, windowMs: 5 * 60 * 1000 });
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "코인 시장 체력 요청이 잠시 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
    );
  }

  const now = Date.now();
  if (cachedPayload && now - cachedPayload.cachedAt < CACHE_TTL_MS) {
    return NextResponse.json({ ...cachedPayload, cached: true });
  }

  const warnings: string[] = [];
  const [globalResult, fxResult, upbitResult, btcUsdResult] = await Promise.allSettled([
    fetchJson<CoinGeckoGlobalPayload>(COINGECKO_GLOBAL_URL),
    fetchJson<FrankfurterPayload>(FRANKFURTER_USDKRW_URL),
    fetchJson<UpbitTickerPayload[]>(UPBIT_BTC_TICKER_URL),
    fetchBtcUsd()
  ]);

  const globalPayload = settled(globalResult, "BTC 도미넌스", warnings);
  const fxPayload = settled(fxResult, "USD/KRW", warnings);
  const upbitPayload = settled(upbitResult, "업비트 BTC", warnings);
  const btcUsd = settled(btcUsdResult, "Binance BTC", warnings);

  const btcDominancePercent = safeNumber(globalPayload?.data?.market_cap_percentage?.btc);
  const usdKrw = safeNumber(fxPayload?.rates?.KRW);
  const upbitBtcKrw = safeNumber(upbitPayload?.[0]?.trade_price);
  const kimchiPremiumPercent =
    upbitBtcKrw !== null && btcUsd !== null && usdKrw !== null && btcUsd > 0 && usdKrw > 0
      ? (upbitBtcKrw / (btcUsd * usdKrw) - 1) * 100
      : null;

  const payload: CoinMarketMetricsPayload = {
    btcDominancePercent,
    usdKrw,
    kimchiPremiumPercent,
    kimchiSource: kimchiPremiumPercent === null ? null : "upbit-btc",
    cachedAt: Date.now(),
    cached: false,
    warnings
  };

  if (
    payload.btcDominancePercent === null &&
    payload.usdKrw === null &&
    payload.kimchiPremiumPercent === null &&
    cachedPayload
  ) {
    return NextResponse.json({ ...cachedPayload, cached: true, stale: true, warnings });
  }

  cachedPayload = payload;
  return NextResponse.json(payload);
}
