import { NextResponse } from "next/server";
import { cryptoExchangeOptions, getExchangeMarkets, normalizeCryptoExchangeId } from "@/lib/server/cryptoExchangeData";
import { rateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limited = await rateLimit(request, { key: "crypto-exchange-markets", limit: 90, windowMs: 5 * 60 * 1000 });
  if (!limited.allowed) {
    return NextResponse.json({ error: "코인 목록 요청이 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  const url = new URL(request.url);
  const exchangeId = normalizeCryptoExchangeId(url.searchParams.get("exchange")) ?? "binance";

  try {
    const markets = await getExchangeMarkets(exchangeId);
    return NextResponse.json({
      exchange: exchangeId,
      exchanges: cryptoExchangeOptions(),
      markets,
      warning: "거래량이 낮거나 파생 데이터가 부족한 종목은 분석 정확도가 떨어질 수 있습니다.",
      cachedAt: Date.now()
    });
  } catch (error) {
    console.error("[api/crypto-exchange-markets] error:", error);
    return NextResponse.json({ error: "거래소 코인 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}
