// 코인 차트가 사용할 Binance USDT-M 캔들을 서버에서 중계합니다.
import { NextResponse } from "next/server";
import type { Candle, ChartTimeframe } from "@/lib/marketAnalysis";
import { rateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BINANCE_FAPI = "https://fapi.binance.com";
const BINANCE_SPOT_DATA_API = "https://data-api.binance.vision";
const intervalMap: Record<ChartTimeframe, string> = {
  "5m": "5m",
  "15m": "15m",
  "1h": "1h",
  "4h": "4h",
  "1d": "1d"
};

function normalizeSymbol(raw: string | null) {
  if (!raw) return null;
  const cleaned = raw.toUpperCase().replace(".P", "").replace("/", "").trim();
  if (!/^[A-Z0-9]{2,30}$/.test(cleaned)) return null;
  return cleaned.endsWith("USDT") ? cleaned : `${cleaned}USDT`;
}

function normalizeTimeframe(raw: string | null): ChartTimeframe | null {
  if (raw === "5m" || raw === "15m" || raw === "1h" || raw === "4h" || raw === "1d") return raw;
  return null;
}

function normalizeLimit(raw: string | null) {
  const value = Number(raw ?? 320);
  if (!Number.isFinite(value)) return 320;
  return Math.max(50, Math.min(500, Math.round(value)));
}

function parseRows(rows: unknown): Candle[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const values = Array.isArray(row) ? row : [];
    return {
      time: Math.floor(Number(values[0]) / 1000),
      open: Number(values[1]),
      high: Number(values[2]),
      low: Number(values[3]),
      close: Number(values[4]),
      volume: Number(values[5])
    };
  }).filter((candle) =>
    Number.isFinite(candle.time) &&
    Number.isFinite(candle.open) &&
    Number.isFinite(candle.high) &&
    Number.isFinite(candle.low) &&
    Number.isFinite(candle.close) &&
    Number.isFinite(candle.volume)
  );
}

function candleEndpoints(params: URLSearchParams) {
  return [
    { source: "binance-usdt-m", url: `${BINANCE_FAPI}/fapi/v1/klines?${params.toString()}` },
    { source: "binance-spot", url: `${BINANCE_SPOT_DATA_API}/api/v3/klines?${params.toString()}` }
  ];
}

export async function GET(request: Request) {
  const limited = await rateLimit(request, {
    key: "crypto-candles",
    limit: 180,
    windowMs: 60_000
  });

  if (!limited.allowed) {
    return NextResponse.json({ error: "캔들 요청이 잠시 많습니다.", retryAfter: limited.retryAfter }, { status: 429 });
  }

  const url = new URL(request.url);
  const symbol = normalizeSymbol(url.searchParams.get("symbol"));
  const timeframe = normalizeTimeframe(url.searchParams.get("timeframe"));
  const limit = normalizeLimit(url.searchParams.get("limit"));

  if (!symbol || !timeframe) {
    return NextResponse.json({ error: "지원하지 않는 코인 또는 타임프레임입니다." }, { status: 400 });
  }

  const params = new URLSearchParams({
    symbol,
    interval: intervalMap[timeframe],
    limit: String(limit)
  });

  try {
    let lastError: unknown = null;

    for (const endpoint of candleEndpoints(params)) {
      try {
        const response = await fetch(endpoint.url, {
          headers: { Accept: "application/json" },
          cache: "no-store"
        });
        if (!response.ok) throw new Error(`Binance ${response.status}`);

        const candles = parseRows(await response.json());
        if (candles.length > 0) {
          return NextResponse.json({ candles, source: endpoint.source });
        }
        throw new Error("Binance empty candles");
      } catch (endpointError) {
        lastError = endpointError;
      }
    }

    throw lastError ?? new Error("Binance candles unavailable");
  } catch (error) {
    console.error("[api/crypto-candles] error:", error);
    return NextResponse.json({ error: "캔들 흐름을 잠시 확인하지 못했습니다." }, { status: 500 });
  }
}
