// 글로벌 주요 자산의 하루 변동률과 시장 온도를 제공하는 API 라우트입니다.
import { NextResponse } from "next/server";
import { fetchStockCandles, findStockSymbol } from "@/lib/stockMarket";
import { rateLimit } from "@/lib/server/rateLimit";
import { entitlementRateKey, getRequestEntitlement } from "@/lib/server/requestEntitlement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pulseSymbols = ["NQ=F", "ES=F", "YM=F", "RTY=F", "^VIX", "TLT", "UUP", "GLD", "CL=F", "SMH", "QQQ", "SPY"];

function classifyChange(changePercent: number) {
  if (changePercent >= 1.2) return "strong_up";
  if (changePercent >= 0.25) return "up";
  if (changePercent <= -1.2) return "strong_down";
  if (changePercent <= -0.25) return "down";
  return "flat";
}

function headlineFromCounts(upCount: number, downCount: number, flatCount: number) {
  if (upCount >= downCount + 4) return "위험자산 쪽으로 온기가 더 강합니다.";
  if (downCount >= upCount + 4) return "방어 심리와 변동성 경계가 더 강합니다.";
  if (flatCount >= 5) return "방향이 뚜렷하지 않아 기준선 확인이 우선입니다.";
  return "상승과 하락 신호가 섞여 있어 자산군별 분리가 필요합니다.";
}

export async function GET(request: Request) {
  const entitlement = await getRequestEntitlement(request, "stocks");
  const limit = await rateLimit(request, {
    key: entitlementRateKey("stocks-market-board", entitlement),
    limit: entitlement.isPaid ? 90 : 30,
    windowMs: 5 * 60 * 1000
  });

  if (!limit.allowed) {
    return NextResponse.json(
      { error: "글로벌 시장 온도 요청이 잠시 많습니다. 잠시 후 다시 확인해 주세요." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const settled = await Promise.allSettled(
    pulseSymbols.map(async (symbol) => {
      const candles = await fetchStockCandles(symbol, "1d");
      const latest = candles[candles.length - 1];
      const previous = candles[candles.length - 2];
      if (!latest || !previous) throw new Error(`${symbol} 가격 데이터가 부족합니다.`);
      const changePercent = ((latest.close - previous.close) / previous.close) * 100;
      const info = findStockSymbol(symbol);
      return {
        symbol,
        name: info?.name ?? symbol,
        group: info?.group ?? "index_etf",
        price: latest.close,
        changePercent,
        state: classifyChange(changePercent)
      };
    })
  );

  const items = settled.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
  if (items.length === 0) {
    return NextResponse.json(
      { error: "글로벌 시장 온도 데이터를 잠시 확인하지 못했습니다. 잠시 뒤 다시 확인해 주세요." },
      { status: 503 }
    );
  }

  const upCount = items.filter((item) => item.changePercent > 0.25).length;
  const downCount = items.filter((item) => item.changePercent < -0.25).length;
  const flatCount = Math.max(0, items.length - upCount - downCount);

  return NextResponse.json({
    updatedAt: new Date().toISOString(),
    headline: headlineFromCounts(upCount, downCount, flatCount),
    counts: { up: upCount, down: downCount, flat: flatCount },
    items
  });
}
