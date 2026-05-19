// Vercel Cron에서 호출해 서버가 알림 조건을 스캔하고 Android 앱 푸시를 발송합니다.
import { NextResponse } from "next/server";
import { isFirebaseMessagingConfigured } from "@/lib/server/firebaseMessaging";
import { isSupabaseAdminConfigured } from "@/lib/server/supabaseAdmin";
import { runPushAlertScan } from "@/lib/server/pushAlertScanner";

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
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "Supabase 관리자 환경변수가 필요합니다." }, { status: 503 });
  }
  if (!isFirebaseMessagingConfigured()) {
    return NextResponse.json({ error: "Firebase 메시징 환경변수가 필요합니다." }, { status: 503 });
  }

  const origin = new URL(request.url).origin;
  const result = await runPushAlertScan({ origin });
  return NextResponse.json({
    ok: true,
    scannedAt: new Date().toISOString(),
    ...result
  });
}
