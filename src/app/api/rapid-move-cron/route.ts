import { NextResponse } from "next/server";
import { isFirebaseMessagingConfigured } from "@/lib/server/firebaseMessaging";
import { isSupabaseAdminConfigured } from "@/lib/server/supabaseAdmin";
import { runRapidMoveScan } from "@/lib/server/push/rapidMoveDelivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";
export const maxDuration = 50;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  if (!isSupabaseAdminConfigured() || (!dryRun && !isFirebaseMessagingConfigured())) return NextResponse.json({ error: "Push service unavailable" }, { status: 503 });
  try {
    const result = await runRapidMoveScan({ dryRun });
    console.info("[rapid-move-cron] scan summary", JSON.stringify({ scannedAt: new Date().toISOString(), dryRun, ...result }));
    return NextResponse.json({ ok: result.errors.length === 0, ...result }, { status: result.errors.length ? 503 : 200 });
  } catch {
    console.error("[rapid-move-cron] scan failed");
    return NextResponse.json({ error: "Rapid move scan unavailable" }, { status: 503 });
  }
}
