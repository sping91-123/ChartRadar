// 바이낸스에서 거래 중인 USDT-M 코인 목록을 제공하는 API 라우트입니다.
import { NextResponse } from "next/server";
import { getCryptoSymbols } from "@/lib/cryptoUniverse";
import { rateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limit = await rateLimit(request, { key: "crypto-symbols", limit: 60, windowMs: 5 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "코인 목록 요청이 잠시 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  try {
    const symbols = await getCryptoSymbols();
    return NextResponse.json({
      symbols,
      cachedAt: Date.now()
    });
  } catch (error) {
    console.error("[api/crypto-symbols] 오류:", error);
    return NextResponse.json({ error: "코인 목록을 잠시 확인하지 못했습니다." }, { status: 500 });
  }
}
