// 諛붿씠?몄뒪?먯꽌 嫄곕옒 以묒씤 USDT-M 肄붿씤 紐⑸줉???쒓났?섎뒗 API ?쇱슦??
import { NextResponse } from "next/server";
import { getCryptoSymbols } from "@/lib/cryptoUniverse";
import { rateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limit = await rateLimit(request, { key: "crypto-symbols", limit: 60, windowMs: 5 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "肄붿씤 紐⑸줉 ?붿껌???덈Т 留롮뒿?덈떎. ?좎떆 ???ㅼ떆 ?쒕룄?섏꽭??" },
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
    console.error("[api/crypto-symbols] ?ㅻ쪟:", error);
    return NextResponse.json({ error: "諛붿씠?몄뒪 肄붿씤 紐⑸줉??遺덈윭?ㅼ? 紐삵뻽?듬땲??" }, { status: 500 });
  }
}
