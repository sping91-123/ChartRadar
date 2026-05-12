// 글로벌 시장 주요 종목의 캔들 데이터를 제공하는 API 라우트.
import { NextResponse } from "next/server";
import { fetchStockCandles, findStockSymbol, normalizeStockSymbol, stockSymbols } from "@/lib/stockMarket";
import { chartTimeframes, type ChartTimeframe } from "@/lib/marketAnalysis";
import { rateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseTimeframe(value: string | null): ChartTimeframe {
  return chartTimeframes.includes(value as ChartTimeframe) ? (value as ChartTimeframe) : "1d";
}

export async function GET(request: Request) {
  const limit = rateLimit(request, { key: "stocks-candles", limit: 50, windowMs: 5 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "글로벌 시장 데이터 요청이 너무 많습니다. 잠시 후 다시 시도하세요." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const url = new URL(request.url);
  const symbol = normalizeStockSymbol(url.searchParams.get("symbol") ?? "QQQ");
  const timeframe = parseTimeframe(url.searchParams.get("timeframe"));
  const info = findStockSymbol(symbol);

  try {
    const candles = await fetchStockCandles(symbol, timeframe);
    return NextResponse.json({
      symbol,
      info,
      timeframe,
      candles,
      universe: stockSymbols,
      dataSource: "Yahoo Finance 비공식 지연 데이터",
      cachedAt: Date.now()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "글로벌 시장 데이터를 불러오지 못했습니다.";
    console.error("[api/stocks/candles] 오류:", error);
    return NextResponse.json(
      {
        error: message,
        universe: stockSymbols
      },
      { status: 500 }
    );
  }
}
