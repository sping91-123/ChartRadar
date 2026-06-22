import { NextResponse } from "next/server";
import { getCryptoHomeTicker, normalizeCryptoExchangeId } from "@/lib/server/cryptoExchangeData";
import { rateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limited = await rateLimit(request, { key: "crypto-home-ticker", limit: 240, windowMs: 5 * 60 * 1000 });
  if (!limited.allowed) {
    return NextResponse.json({ error: "가격 갱신 요청이 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  const url = new URL(request.url);
  const exchangeId = normalizeCryptoExchangeId(url.searchParams.get("exchange")) ?? "binance";
  const symbol = url.searchParams.get("symbol") ?? "BTC/USDT:USDT";

  try {
    const ticker = await getCryptoHomeTicker(exchangeId, symbol);
    return NextResponse.json({ ticker });
  } catch (error) {
    console.error("[api/crypto-home-ticker] error:", error);
    return NextResponse.json({ error: "관심코인 가격을 갱신하지 못했습니다." }, { status: 500 });
  }
}
