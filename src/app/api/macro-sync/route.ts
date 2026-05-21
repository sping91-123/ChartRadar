// Vercel Cron이 공식 매크로 소스를 확인해 서버 캐시를 예열하는 엔드포인트입니다.
import { NextResponse } from "next/server";
import { runMacroSync } from "@/lib/macro/macroSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runMacroSync();
  return NextResponse.json({
    ok: true,
    ...result
  });
}
