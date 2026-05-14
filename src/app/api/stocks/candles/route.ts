// 글로벌 시장 주요 종목의 캔들 데이터를 제공하는 API 라우트입니다.
import { NextResponse } from "next/server";
import { fetchStockCandles, findStockSymbol, normalizeStockSymbol, stockSymbols } from "@/lib/stockMarket";
import { chartTimeframes, type ChartTimeframe } from "@/lib/marketAnalysis";
import { rateLimit } from "@/lib/server/rateLimit";
import { entitlementRateKey, getRequestEntitlement } from "@/lib/server/requestEntitlement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isChartTimeframe(value: string): value is ChartTimeframe {
  return chartTimeframes.includes(value as ChartTimeframe);
}

export async function GET(request: Request) {
  const entitlement = await getRequestEntitlement(request, "stocks");
  const limit = await rateLimit(request, {
    key: entitlementRateKey("stocks-candles", entitlement),
    limit: entitlement.isPaid ? 160 : 50,
    windowMs: 5 * 60 * 1000
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "글로벌 시장 데이터 요청이 잠시 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const url = new URL(request.url);
  const symbol = normalizeStockSymbol(url.searchParams.get("symbol") ?? "QQQ");
  const timeframeParam = url.searchParams.get("timeframe");
  if (timeframeParam && !isChartTimeframe(timeframeParam)) {
    return NextResponse.json(
      {
        error: "지원하지 않는 타임프레임입니다.",
        allowedTimeframes: chartTimeframes
      },
      { status: 400 }
    );
  }

  const timeframe: ChartTimeframe = timeframeParam ? (timeframeParam as ChartTimeframe) : "1d";
  const info = findStockSymbol(symbol);
  if (!symbol || !info) {
    return NextResponse.json(
      {
        error: "지원하지 않는 글로벌 종목입니다.",
        universe: stockSymbols
      },
      { status: 400 }
    );
  }

  try {
    const candles = await fetchStockCandles(symbol, timeframe);
    return NextResponse.json({
      symbol,
      info,
      timeframe,
      candles,
      universe: stockSymbols,
      dataSource: "글로벌 시장 데이터",
      cachedAt: Date.now()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "글로벌 시장 흐름을 잠시 확인하지 못했습니다.";
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
