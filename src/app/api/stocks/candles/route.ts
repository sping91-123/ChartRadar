// 湲濡쒕쾶 ?쒖옣 二쇱슂 醫낅ぉ??罹붾뱾 ?곗씠?곕? ?쒓났?섎뒗 API ?쇱슦??
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
  const limit = await rateLimit(request, { key: "stocks-candles", limit: 50, windowMs: 5 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "湲濡쒕쾶 ?쒖옣 ?곗씠???붿껌???덈Т 留롮뒿?덈떎. ?좎떆 ???ㅼ떆 ?쒕룄?섏꽭??" },
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
    const message = error instanceof Error ? error.message : "湲濡쒕쾶 ?쒖옣 ?곗씠?곕? 遺덈윭?ㅼ? 紐삵뻽?듬땲??";
    console.error("[api/stocks/candles] ?ㅻ쪟:", error);
    return NextResponse.json(
      {
        error: message,
        universe: stockSymbols
      },
      { status: 500 }
    );
  }
}
