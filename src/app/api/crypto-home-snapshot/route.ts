import { NextResponse } from "next/server";
import { getCryptoHomeSnapshot, normalizeCryptoExchangeId } from "@/lib/server/cryptoExchangeData";
import { rateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limited = await rateLimit(request, { key: "crypto-home-snapshot", limit: 120, windowMs: 5 * 60 * 1000 });
  if (!limited.allowed) {
    return NextResponse.json({ error: "홈 분석 요청이 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  const url = new URL(request.url);
  const exchangeId = normalizeCryptoExchangeId(url.searchParams.get("exchange")) ?? "binance";
  const symbol = url.searchParams.get("symbol") ?? "BTC/USDT:USDT";

  try {
    const snapshot = await getCryptoHomeSnapshot(exchangeId, symbol);
    return NextResponse.json({ snapshot });
  } catch (error) {
    console.error("[api/crypto-home-snapshot] error:", error);
    return NextResponse.json({ error: "관심코인 홈 분석을 불러오지 못했습니다." }, { status: 500 });
  }
}
