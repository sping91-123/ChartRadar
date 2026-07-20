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

function scanSummaryLog(result: Awaited<ReturnType<typeof runPushAlertScan>>, scannedAt: string, dryRun: boolean) {
  return {
    scannedAt,
    dryRun,
    users: result.users,
    events: result.events,
    sent: result.sent,
    skipped: result.skipped,
    failed: result.failed,
    sources: result.sources,
    diagnostics: result.diagnostics,
    warningCount: result.warnings?.length ?? 0
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const dryRun =
    url.searchParams.get("dryRun") === "1" ||
    url.searchParams.get("dryRun") === "true" ||
    url.searchParams.get("diagnostics") === "1";
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "Supabase 관리자 환경변수가 필요합니다." }, { status: 503 });
  }
  const origin = url.origin;
  const result = await runPushAlertScan({
    origin,
    dryRun,
    pushDeliveryEnabled: dryRun || isFirebaseMessagingConfigured()
  });
  const scannedAt = new Date().toISOString();
  console.info("[push-cron] scan summary", JSON.stringify(scanSummaryLog(result, scannedAt, dryRun)));
  return NextResponse.json({
    ok: true,
    dryRun,
    scannedAt,
    ...result
  });
}
