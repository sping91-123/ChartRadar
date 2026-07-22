// Vercel Cron이 공식 매크로 소스를 확인해 서버 캐시를 예열하는 엔드포인트입니다.
import { NextResponse } from "next/server";
import { runMacroSync } from "@/lib/macro/macroSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0"
};

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStoreHeaders });
  }

  const result = await runMacroSync();
  return NextResponse.json(
    {
      ok: result.status !== "degraded",
      ...result
    },
    { status: result.status === "degraded" ? 503 : 200, headers: noStoreHeaders }
  );
}
