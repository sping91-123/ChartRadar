import { NextResponse } from "next/server";
import { decisionJournalContextFromSnapshot } from "@/lib/journal";
import { decisionStateLabel } from "@/lib/perpetualDecisionCopy";
import { isUuid, monitorLinksSnapshot } from "@/lib/perpetualMonitor";
import { getPerpetualDecisionSnapshotById } from "@/lib/server/perpetualDecisionSource";
import { isPerpetualRevenueCoreUserEnabled } from "@/lib/server/perpetualRevenueCore";
import { readNewsDecisionContext } from "@/lib/server/news/newsImpactStore";
import { newsImpactRuntimePolicy } from "@/lib/server/newsImpactMode";
import { recordServerProductEvent } from "@/lib/server/productEventStore";
import { entitlementRateKey, getRequestEntitlement } from "@/lib/server/requestEntitlement";
import { rateLimit, readJsonBodyLimited } from "@/lib/server/rateLimit";
import { isSupabaseAdminConfigured, supabaseAdminRest } from "@/lib/server/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface OwnedMonitorRow {
  id: string;
  user_id: string;
  snapshot_id: string;
  last_snapshot_id: string | null;
}

function privateJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Vary", "Authorization");
  return response;
}

export async function POST(request: Request) {
  const entitlement = await getRequestEntitlement(request, "crypto");
  if (!entitlement.userId || !entitlement.isAuthenticated) {
    return privateJson({ error: "로그인이 필요합니다.", code: "authentication_required" }, { status: 401 });
  }
  if (entitlement.state === "deletion_pending") {
    return privateJson({ error: "계정 삭제 대기 중에는 복기를 저장할 수 없습니다." }, { status: 409 });
  }
  if (entitlement.state === "unavailable") {
    return privateJson({ error: "구독 권한을 확인하지 못해 복기 저장을 잠시 중단했습니다." }, { status: 503 });
  }
  if (!isPerpetualRevenueCoreUserEnabled(entitlement.userId)) {
    return privateJson({ error: "선물 리스크 복기는 아직 활성화되지 않았습니다.", code: "revenue_core_not_active" }, { status: 409 });
  }
  if (!isSupabaseAdminConfigured()) return privateJson({ error: "복기 저장소가 설정되지 않았습니다." }, { status: 503 });

  const limited = await rateLimit(request, {
    key: entitlementRateKey("crypto-perpetual-journal", entitlement),
    limit: 20,
    windowMs: 5 * 60 * 1000
  });
  if (!limited.allowed) return privateJson({ error: "복기 저장 요청이 많습니다." }, { status: 429 });

  const parsed = await readJsonBodyLimited<{
    snapshotId?: unknown;
    monitorId?: unknown;
    source?: unknown;
    reactionId?: unknown;
  } | null>(request, 1_024);
  if (!parsed.ok && parsed.tooLarge) {
    return privateJson({ error: "복기 저장 요청이 너무 큽니다." }, { status: 413 });
  }
  const body = parsed.ok ? parsed.value : null;
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => key !== "snapshotId" && key !== "monitorId" && key !== "source" && key !== "reactionId") ||
    !isUuid(body.snapshotId) ||
    (body.monitorId !== undefined && body.monitorId !== null && !isUuid(body.monitorId)) ||
    (body.source !== undefined && body.source !== "snapshot" && body.source !== "alert" && body.source !== "news") ||
    (body.reactionId !== undefined && body.reactionId !== null && !isUuid(body.reactionId))
  ) {
    return privateJson({ error: "복기에 연결할 분석을 다시 확인해 주세요." }, { status: 400 });
  }
  const source = body.source === "alert" ? "alert" : body.source === "news" ? "news" : "snapshot";
  if (source === "news" && !newsImpactRuntimePolicy().mutate) {
    return privateJson({ error: "뉴스 임팩트 복기는 아직 공개되지 않았습니다.", code: "news_impact_not_active" }, { status: 409 });
  }
  const snapshot = await getPerpetualDecisionSnapshotById(body.snapshotId);
  if (!snapshot) return privateJson({ error: "복기에 연결할 분석을 찾지 못했습니다." }, { status: 404 });
  if (source === "news" && !entitlement.isPaid) {
    return privateJson({ error: "뉴스 판단 복기는 Coin Pro에서 사용할 수 있습니다.", upgradePath: "/pro?market=crypto&source=news" }, { status: 403 });
  }
  const newsContext = source === "news" && body.reactionId
    ? await readNewsDecisionContext(body.reactionId, snapshot.asset, snapshot.id).catch(() => null)
    : null;
  if (source === "news" && !newsContext) {
    return privateJson({ error: "뉴스 사건과 동일한 자산·분석 연결을 확인하지 못했습니다." }, { status: 400 });
  }

  let monitorId: string | null = null;
  if (body.monitorId) {
    const rows = await supabaseAdminRest<OwnedMonitorRow[]>(
      `perpetual_scenario_monitors?select=id,user_id,snapshot_id,last_snapshot_id&id=eq.${encodeURIComponent(body.monitorId)}&user_id=eq.${encodeURIComponent(entitlement.userId)}&limit=1`
    );
    const monitor = rows[0];
    const linkedToSnapshot = Boolean(monitor && monitorLinksSnapshot(monitor, snapshot.id, source === "alert"));
    if (!monitor || !linkedToSnapshot) {
      return privateJson({ error: "이 계정의 조건 감시와 분석 연결을 확인하지 못했습니다." }, { status: 400 });
    }
    monitorId = monitor.id;
  }

  try {
    const rows = await supabaseAdminRest<Array<{ id: string; created_at: string }>>("journals", {
      method: "POST",
      prefer: "return=representation",
      body: {
        user_id: entitlement.userId,
        title: `${snapshot.symbol} ${source === "news" ? "뉴스 판단 복기" : "선물 시장 분석"}`,
        bias: decisionStateLabel(snapshot.summary.state),
        note: `${snapshot.summary.topRisk}\n다음 확인: ${snapshot.summary.primaryCondition.label}`,
        market: "crypto",
        source,
        symbol: snapshot.symbol,
        timeframe: snapshot.primaryTimeframe,
        verdict: snapshot.summary.headline,
        decision_snapshot_id: snapshot.id,
        monitor_id: monitorId,
        decision_context: {
          ...decisionJournalContextFromSnapshot(snapshot),
          ...(newsContext ? { news: newsContext } : {})
        },
        news_event_id: newsContext?.eventId ?? null,
        news_reaction_id: newsContext?.reactionId ?? null
      }
    });
    const journal = rows[0];
    if (!journal) throw new Error("journal_create_empty");
    await recordServerProductEvent({
      eventName: source === "news" ? "news_journal_saved" : "journal_saved",
      userId: entitlement.userId,
      surface: "journal",
      asset: snapshot.asset,
      snapshotId: snapshot.id,
      monitorId,
      properties: { source },
      newsEventId: newsContext?.eventId,
      newsReactionId: newsContext?.reactionId
    });
    return privateJson({ journal }, { status: 201 });
  } catch (error) {
    console.error("[api/crypto/perpetual/journal] error", error);
    return privateJson({ error: "복기를 저장하지 못했습니다." }, { status: 503 });
  }
}
