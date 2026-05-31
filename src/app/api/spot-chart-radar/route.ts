import { NextResponse } from "next/server";
import type { SpotChartRadarPayload, SpotChartSummary, SpotExchange, SpotChartTone } from "@/lib/spotRadarTypes";
import { normalizeSpotExchange } from "@/lib/server/spotRadar";
import { rateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SpotCandleRow {
  market: string;
  candle_date_time_kst?: string;
  opening_price: number;
  high_price: number;
  low_price: number;
  trade_price: number;
  timestamp?: number;
  candle_acc_trade_price: number;
  candle_acc_trade_volume: number;
}

interface Candle {
  market: string;
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volumeValue: number;
}

const exchangeConfig: Record<SpotExchange, { label: string; baseUrl: string }> = {
  upbit: { label: "업비트", baseUrl: "https://api.upbit.com" },
  bithumb: { label: "빗썸", baseUrl: "https://api.bithumb.com" }
};

const CACHE_TTL_MS = 60 * 1000;
const FETCH_TIMEOUT_MS = 6000;
const MAX_MARKETS = 8;
const DEFAULT_LIMIT = 80;

const cache = new Map<string, { cachedAt: number; payload: SpotChartRadarPayload }>();

function safeNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeMarket(raw: string) {
  const cleaned = raw.toUpperCase().trim();
  if (!/^KRW-[A-Z0-9]{1,20}$/.test(cleaned)) return null;
  return cleaned;
}

function normalizeMarkets(raw: string | null) {
  if (!raw) return [];
  const seen = new Set<string>();
  const markets: string[] = [];

  raw
    .split(",")
    .map((item) => normalizeMarket(item))
    .filter((item): item is string => Boolean(item))
    .forEach((market) => {
      if (!seen.has(market) && markets.length < MAX_MARKETS) {
        seen.add(market);
        markets.push(market);
      }
    });

  return markets;
}

function normalizeLimit(raw: string | null) {
  const value = Number(raw ?? DEFAULT_LIMIT);
  if (!Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.max(40, Math.min(120, Math.round(value)));
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

async function fetchCandles(exchange: SpotExchange, market: string, limit: number) {
  const config = exchangeConfig[exchange];
  const url = `${config.baseUrl}/v1/candles/minutes/60?market=${encodeURIComponent(market)}&count=${limit}`;
  const payload = await fetchJson<unknown>(url);
  if (!Array.isArray(payload)) throw new Error(`${market} candle payload is not an array`);

  return (payload as SpotCandleRow[])
    .map((row) => {
      const open = safeNumber(row.opening_price);
      const high = safeNumber(row.high_price);
      const low = safeNumber(row.low_price);
      const close = safeNumber(row.trade_price);
      const volumeValue = safeNumber(row.candle_acc_trade_price);
      const timestamp = safeNumber(row.timestamp) ?? (row.candle_date_time_kst ? Date.parse(row.candle_date_time_kst) : null);

      if ([open, high, low, close, volumeValue, timestamp].some((value) => value === null)) return null;
      return {
        market: row.market,
        time: timestamp as number,
        open: open as number,
        high: high as number,
        low: low as number,
        close: close as number,
        volumeValue: volumeValue as number
      };
    })
    .filter((item): item is Candle => Boolean(item))
    .reverse();
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatPrice(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "확인 중";
  return `${value.toLocaleString("ko-KR", { maximumFractionDigits: value >= 100 ? 0 : 2 })}원`;
}

function buildSparkline(candles: Candle[]) {
  const closes = candles.slice(-24).map((candle) => candle.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min;
  if (!Number.isFinite(range) || range <= 0) return closes.map(() => 50);
  return closes.map((close) => Math.round(((close - min) / range) * 100));
}

function analyzeCandles(exchange: SpotExchange, market: string, candles: Candle[]): SpotChartSummary | null {
  if (candles.length < 30) return null;

  const latest = candles[candles.length - 1];
  const first = candles[0];
  const recent = candles.slice(-80);
  const recent20 = candles.slice(-20);
  const recent6 = candles.slice(-6);
  const previous24 = candles.slice(-30, -6);
  const highest = Math.max(...recent.map((candle) => candle.high));
  const lowest = Math.min(...recent.map((candle) => candle.low));
  const range = highest - lowest;
  const rangePositionPercent = range > 0 ? ((latest.close - lowest) / range) * 100 : null;
  const changePercent = first.close > 0 ? ((latest.close - first.close) / first.close) * 100 : null;
  const ma20 = average(recent20.map((candle) => candle.close));
  const ma60 = average(candles.slice(-60).map((candle) => candle.close));
  const volumeRatioBase = average(previous24.map((candle) => candle.volumeValue));
  const volumeRatioNow = average(recent6.map((candle) => candle.volumeValue));
  const volumeRatio = volumeRatioBase && volumeRatioNow ? volumeRatioNow / volumeRatioBase : null;
  const ma20Position = ma20 === null ? "unknown" : latest.close > ma20 * 1.002 ? "above" : latest.close < ma20 * 0.998 ? "below" : "flat";
  const supportPrice = Math.min(...recent20.map((candle) => candle.low));
  const resistancePrice = Math.max(...recent20.map((candle) => candle.high));
  const nearTop = (rangePositionPercent ?? 50) >= 82;
  const nearBottom = (rangePositionPercent ?? 50) <= 18;
  const aboveTrend = ma20 !== null && ma60 !== null && latest.close >= ma20 && ma20 >= ma60;
  const belowTrend = ma20 !== null && ma60 !== null && latest.close <= ma20 && ma20 <= ma60;

  let tone: SpotChartTone = "watch";
  let structureLabel = "박스권 확인";

  if (nearTop && (changePercent ?? 0) >= 3) {
    tone = "risk";
    structureLabel = "상단 과열 확인";
  } else if (nearBottom && (changePercent ?? 0) <= -3) {
    tone = "short";
    structureLabel = "하단 압력 확인";
  } else if ((changePercent ?? 0) <= -5) {
    tone = "short";
    structureLabel = "흐름 약세 확인";
  } else if (aboveTrend) {
    tone = "long";
    structureLabel = "추세 유지 확인";
  } else if (belowTrend) {
    tone = "short";
    structureLabel = "추세 약세 확인";
  } else if (nearBottom) {
    tone = "watch";
    structureLabel = "하단 반응 대기";
  } else if (nearTop) {
    tone = "watch";
    structureLabel = "상단 돌파 확인";
  }

  const rangeText = rangePositionPercent === null ? "범위 위치 확인 중" : `80시간 범위 ${Math.round(rangePositionPercent)}% 위치`;
  const volumeText = volumeRatio === null ? "거래대금 확인 중" : volumeRatio >= 1.4 ? "최근 거래대금 증가" : volumeRatio <= 0.7 ? "최근 거래대금 둔화" : "거래대금 보통";
  const trendText = ma20Position === "above" ? "20봉 평균 위" : ma20Position === "below" ? "20봉 평균 아래" : ma20Position === "flat" ? "20봉 평균 부근" : "평균선 확인 중";

  return {
    exchange,
    market,
    symbol: market.replace("KRW-", ""),
    timeframe: "1h",
    structureLabel,
    currentPrice: latest.close,
    rangePositionPercent,
    changePercent,
    volumeRatio,
    ma20Position,
    supportPrice,
    resistancePrice,
    tone,
    detail: `${rangeText} · ${trendText} · ${volumeText}. 지지 ${formatPrice(supportPrice)}, 저항 ${formatPrice(resistancePrice)}를 확인합니다.`,
    updatedAt: new Date(latest.time).toISOString(),
    sparkline: buildSparkline(candles)
  };
}

export async function GET(request: Request) {
  const limit = await rateLimit(request, { key: "spot-chart-radar", limit: 80, windowMs: 60_000 });
  if (!limit.allowed) {
    return NextResponse.json({ error: "현물 차트 근거 요청이 잠시 많습니다.", retryAfter: limit.retryAfter }, { status: 429 });
  }

  const url = new URL(request.url);
  const exchange = normalizeSpotExchange(url.searchParams.get("exchange"));
  const markets = normalizeMarkets(url.searchParams.get("markets"));
  const candleLimit = normalizeLimit(url.searchParams.get("limit"));

  if (markets.length === 0) {
    return NextResponse.json({ error: "확인할 KRW 마켓이 없습니다." }, { status: 400 });
  }

  const cacheKey = `${exchange}:${markets.join(",")}:${candleLimit}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    return NextResponse.json({ ...cached.payload, cached: true });
  }

  const results = await Promise.allSettled(
    markets.map(async (market) => {
      const candles = await fetchCandles(exchange, market, candleLimit);
      return analyzeCandles(exchange, market, candles);
    })
  );

  const items: SpotChartSummary[] = [];
  const failedMarkets: string[] = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled" && result.value) {
      items.push(result.value);
    } else {
      failedMarkets.push(markets[index]);
    }
  });

  const payload: SpotChartRadarPayload = {
    exchange,
    exchangeLabel: exchangeConfig[exchange].label,
    items,
    failedMarkets,
    cachedAt: Date.now(),
    cached: false
  };

  cache.set(cacheKey, { cachedAt: payload.cachedAt, payload });
  return NextResponse.json(payload);
}
