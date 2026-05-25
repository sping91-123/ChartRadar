// 관리자 전용으로 자동 푸시 운영 진단 요약을 반환합니다.
import { NextResponse } from "next/server";
import { runPushAlertScan } from "@/lib/server/pushAlertScanner";
import { fetchSupabaseUserOnServer, isSupabaseAdminConfigured, supabaseAdminRest } from "@/lib/server/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PushAlertEventRow {
  market: string;
  rule_id: string;
  title: string;
  body: string;
  payload?: {
    type?: string;
    alert_kind?: string;
    symbol?: string;
    timeframe?: string;
    sentCount?: number;
    sent?: number;
    kind?: string;
  } | null;
  created_at: string;
}

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? "";
}

function isAdminUser(user: Awaited<ReturnType<typeof fetchSupabaseUserOnServer>>) {
  return user.app_metadata?.role === "admin" || user.app_metadata?.plan === "admin";
}

function summarizeRecentEvent(row: PushAlertEventRow) {
  return {
    createdAt: row.created_at,
    market: row.market,
    ruleId: row.rule_id,
    signalType: row.payload?.type ?? row.rule_id,
    alertKind: row.payload?.alert_kind ?? null,
    symbol: row.payload?.symbol ?? null,
    timeframe: row.payload?.timeframe ?? null,
    title: row.title,
    body: row.body,
    sentCount: Number(row.payload?.sentCount ?? row.payload?.sent ?? 0)
  };
}

export async function GET(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "Supabase 관리자 환경변수가 필요합니다." }, { status: 503 });
  }

  const accessToken = bearerToken(request);
  if (!accessToken) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  try {
    const user = await fetchSupabaseUserOnServer(accessToken);
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: "관리자 계정만 사용할 수 있습니다." }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "로그인 정보를 확인하지 못했습니다." }, { status: 401 });
  }

  const url = new URL(request.url);
  const origin = url.origin;
  const scannedAt = new Date().toISOString();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  let dryRunResult: Awaited<ReturnType<typeof runPushAlertScan>>;
  let recentRows: PushAlertEventRow[];
  try {
    [dryRunResult, recentRows] = await Promise.all([
      runPushAlertScan({ origin, dryRun: true, diagnosticsLimit: 24 }),
      supabaseAdminRest<PushAlertEventRow[]>(
        `push_alert_events?select=market,rule_id,title,body,payload,created_at&created_at=gte.${encodeURIComponent(since)}&order=created_at.desc&limit=20`
      )
    ]);
  } catch (error) {
    console.warn("[push-diagnostics] dry-run failed", error);
    return NextResponse.json({ error: "자동 알림 진단을 실행하지 못했습니다." }, { status: 500 });
  }

  const recentEvents = recentRows.map(summarizeRecentEvent);

  return NextResponse.json({
    ok: true,
    mode: "dry_run",
    scannedAt,
    last24h: {
      loggedEventCount: recentRows.length,
      sentCount: recentEvents.reduce((sum, event) => sum + event.sentCount, 0),
      failureCount: dryRunResult.failed
    },
    summary: {
      users: dryRunResult.users,
      events: dryRunResult.events,
      sent: dryRunResult.sent,
      skipped: dryRunResult.skipped,
      failed: dryRunResult.failed,
      sources: dryRunResult.sources,
      warningCount: dryRunResult.warnings.length
    },
    diagnostics: dryRunResult.diagnostics,
    candidateEvents: dryRunResult.eventDiagnostics.slice(0, 24).map((event) => ({
      signalType: event.signalType,
      market: event.market,
      symbol: event.symbol ?? null,
      timeframe: event.timeframe ?? null,
      score: event.score ?? null,
      quality: event.quality ?? null,
      alertKind: event.alertKind ?? (event.isWatchlist ? "watchlist" : event.isMarketScout ? "market_scout" : event.signalType),
      skippedReason: event.skippedReason,
      threshold: event.threshold,
      wouldSend: event.wouldSend,
      alertTitle: event.alertTitle,
      alertBody: event.alertBody,
      isWatchlist: event.isWatchlist,
      isMarketScout: event.isMarketScout,
      isWatchedSymbol: event.isWatchedSymbol,
      targetTokenCount: event.targetTokenCount
    })),
    recentEvents,
    warnings: dryRunResult.warnings
  });
}
