// 국내 KRW 현물 시장의 public ticker 데이터를 판단 보조용으로 정리합니다.
import { NextResponse } from "next/server";
import { normalizeSpotExchange, getSpotRadar } from "@/lib/server/spotRadar";
import { rateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limit = await rateLimit(request, { key: "spot-radar", limit: 45, windowMs: 5 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "현물 레이더 요청이 잠시 많습니다. 잠시 후 다시 확인해 주세요." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const url = new URL(request.url);
  const exchange = normalizeSpotExchange(url.searchParams.get("exchange"));

  try {
    const payload = await getSpotRadar(exchange);
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate"
      }
    });
  } catch (error) {
    console.error("[api/spot-radar] 오류:", error);
    return NextResponse.json({ error: "국내 현물 시장을 잠시 확인하지 못했습니다." }, { status: 500 });
  }
}
