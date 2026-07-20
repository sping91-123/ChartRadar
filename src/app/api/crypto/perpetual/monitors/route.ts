import { NextResponse } from "next/server";
import { cryptoAlertConditionLimit } from "@/lib/billing";
import { findSnapshotCondition, isMonitorConditionMet, type PerpetualDecisionSnapshot } from "@/lib/perpetualDecisionSnapshot";
import { isUuid, type PerpetualMonitorStatus } from "@/lib/perpetualMonitor";
import {
  getPerpetualDecisionSnapshotById,
  resolvePerpetualDecisionSnapshot
} from "@/lib/server/perpetualDecisionSource";
import {
  createPerpetualMonitor,
  listUserPerpetualMonitors,
  markExpiredPerpetualMonitors,
  reconcilePerpetualMonitorLimit,
  sharedCryptoConditionUsage
} from "@/lib/server/perpetualMonitorStore";
import { recordServerProductEvent } from "@/lib/server/productEventStore";
import { isPerpetualRevenueCoreUserEnabled } from "@/lib/server/perpetualRevenueCore";
import { entitlementRateKey, getRequestEntitlement, type RequestEntitlement } from "@/lib/server/requestEntitlement";
import { rateLimit, readJsonBodyLimited } from "@/lib/server/rateLimit";
import { isSupabaseAdminConfigured } from "@/lib/server/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const listableStatuses = new Set<PerpetualMonitorStatus>([
  "active",
  "paused",
  "paused_entitlement",
  "triggered",
  "expired",
  "canceled"
]);

function privateJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Vary", "Authorization");
  return response;
}

function authFailure(entitlement: RequestEntitlement) {
  if (!entitlement.isAuthenticated || !entitlement.userId) {
    return privateJson({ error: "로그인이 필요합니다.", code: "authentication_required" }, { status: 401 });
  }
  if (entitlement.state === "deletion_pending") {
    return privateJson({ error: "계정 삭제 대기 중에는 조건 감시를 변경할 수 없습니다.", code: "deletion_pending" }, { status: 409 });
  }
  if (entitlement.state === "unavailable") {
    return privateJson({ error: "구독 권한을 확인하지 못해 조건 감시를 잠시 중단했습니다.", code: "entitlement_unavailable" }, { status: 503 });
  }
  return null;
}

function storeFailure(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("monitor_limit_reached")) {
    return privateJson({
      error: "저장 가능한 조건 수를 모두 사용했습니다.",
      code: "monitor_limit_reached",
      upgrade: { href: "/pro?market=crypto&source=perpetual-monitor-limit", label: "Coin Pro 기준 보기" }
    }, { status: 403 });
  }
  if (message.includes("snapshot_not_actionable") || message.includes("condition_expired")) {
    return privateJson({ error: "이 snapshot은 만료됐거나 감시에 사용할 수 없습니다. 최신 상태를 다시 확인해 주세요.", code: "snapshot_not_actionable" }, { status: 409 });
  }
  if (message.includes("monitor_not_rearmable")) {
    return privateJson({ error: "완료되거나 취소된 1회성 조건은 같은 snapshot에서 다시 시작할 수 없습니다.", code: "snapshot_not_actionable" }, { status: 409 });
  }
  if (message.includes("snapshot_not_found")) {
    return privateJson({ error: "저장된 snapshot을 찾지 못했습니다. 최신 상태를 다시 확인해 주세요.", code: "snapshot_not_actionable" }, { status: 409 });
  }
  console.error("[api/crypto/perpetual/monitors] store error", error);
  return privateJson({ error: "조건 감시 저장소를 사용할 수 없습니다.", code: "monitor_store_unavailable" }, { status: 503 });
}

export async function GET(request: Request) {
  const entitlement = await getRequestEntitlement(request, "crypto");
  const denied = authFailure(entitlement);
  if (denied) return denied;
  if (!isPerpetualRevenueCoreUserEnabled(entitlement.userId)) {
    return privateJson({ error: "조건 감시는 아직 활성화되지 않았습니다.", code: "revenue_core_not_active" }, { status: 409 });
  }
  if (!isSupabaseAdminConfigured()) return privateJson({ error: "조건 감시 저장소가 설정되지 않았습니다." }, { status: 503 });

  const limited = await rateLimit(request, {
    key: entitlementRateKey("crypto-perpetual-monitors-list", entitlement),
    limit: 90,
    windowMs: 5 * 60 * 1000
  });
  if (!limited.allowed) return privateJson({ error: "조건 감시 요청이 많습니다." }, { status: 429 });

  const rawStatus = new URL(request.url).searchParams.get("status");
  const status = rawStatus && listableStatuses.has(rawStatus as PerpetualMonitorStatus)
    ? rawStatus as PerpetualMonitorStatus
    : undefined;
  try {
    const monitorLimit = cryptoAlertConditionLimit(entitlement.plan);
    await markExpiredPerpetualMonitors("perpetual-v1.0.0");
    await reconcilePerpetualMonitorLimit(entitlement.userId!, monitorLimit);
    const [monitors, usage] = await Promise.all([
      listUserPerpetualMonitors(entitlement.userId!, status),
      sharedCryptoConditionUsage(entitlement.userId!)
    ]);
    return privateJson({
      monitors,
      capabilities: {
        monitorLimit,
        activeMonitorCount: usage.total,
        scenarioMonitorCount: usage.activeMonitorCount,
        presetCount: usage.enabledPresetCount,
        canCreateMonitor: usage.total < monitorLimit
      }
    });
  } catch (error) {
    return storeFailure(error);
  }
}

export async function POST(request: Request) {
  const entitlement = await getRequestEntitlement(request, "crypto");
  const denied = authFailure(entitlement);
  if (denied) return denied;
  if (!isPerpetualRevenueCoreUserEnabled(entitlement.userId)) {
    return privateJson({ error: "조건 감시는 아직 활성화되지 않았습니다.", code: "revenue_core_not_active" }, { status: 409 });
  }
  if (!isSupabaseAdminConfigured()) return privateJson({ error: "조건 감시 저장소가 설정되지 않았습니다." }, { status: 503 });

  const limited = await rateLimit(request, {
    key: entitlementRateKey("crypto-perpetual-monitors-create", entitlement),
    limit: 30,
    windowMs: 5 * 60 * 1000
  });
  if (!limited.allowed) return privateJson({ error: "조건 저장 요청이 많습니다." }, { status: 429 });

  const parsed = await readJsonBodyLimited<{ snapshotId?: unknown; conditionId?: unknown } | null>(request, 1_024);
  if (!parsed.ok && parsed.tooLarge) {
    return privateJson({ error: "조건 감시 요청이 너무 큽니다.", code: "request_too_large" }, { status: 413 });
  }
  const body = parsed.ok ? parsed.value : null;
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => key !== "snapshotId" && key !== "conditionId") ||
    !isUuid(body.snapshotId) ||
    typeof body.conditionId !== "string" ||
    body.conditionId.length > 180
  ) {
    return privateJson({ error: "snapshot과 조건을 다시 확인해 주세요.", code: "invalid_monitor_request" }, { status: 400 });
  }

  try {
    await markExpiredPerpetualMonitors("perpetual-v1.0.0");
    await reconcilePerpetualMonitorLimit(entitlement.userId!, cryptoAlertConditionLimit(entitlement.plan));
  } catch (error) {
    return storeFailure(error);
  }

  const snapshot = await getPerpetualDecisionSnapshotById(body.snapshotId);
  if (!snapshot || snapshot.quality !== "ready" || new Date(snapshot.expiresAt).getTime() <= Date.now()) {
    return privateJson({
      error: "로그인 중 snapshot이 갱신됐거나 감시 가능한 시간이 지났습니다. 최신 상태에서 조건을 다시 확인해 주세요.",
      code: "snapshot_not_actionable",
      refresh: { href: `/crypto/perpetual?asset=${snapshot?.asset ?? "btc"}&timeframe=15m` }
    }, { status: 409 });
  }

  const condition = findSnapshotCondition(snapshot, body.conditionId, entitlement.isPaid);
  if (!condition) {
    return privateJson({
      error: entitlement.isPaid ? "snapshot에 없는 조건입니다." : "Basic에서는 현재 확인 조건 1개만 저장할 수 있습니다.",
      code: "condition_not_available"
    }, { status: entitlement.isPaid ? 400 : 403 });
  }
  if (new Date(condition.expiresAt).getTime() <= Date.now()) {
    return privateJson({ error: "이 조건은 이미 만료됐습니다. 최신 상태를 다시 확인해 주세요.", code: "snapshot_not_actionable" }, { status: 409 });
  }
  let currentSnapshot: PerpetualDecisionSnapshot;
  try {
    currentSnapshot = (await resolvePerpetualDecisionSnapshot({ asset: snapshot.asset })).snapshot;
  } catch {
    return privateJson({ error: "최신 상태를 확인하지 못해 조건 감시를 저장하지 않았습니다.", code: "snapshot_not_actionable" }, { status: 409 });
  }
  if (currentSnapshot.quality !== "ready") {
    return privateJson({ error: "최신 데이터가 정상화된 뒤 조건 감시를 저장해 주세요.", code: "snapshot_not_actionable" }, { status: 409 });
  }
  if (isMonitorConditionMet(condition, currentSnapshot)) {
    return privateJson({ error: "이미 충족된 조건은 감시로 저장할 수 없습니다.", code: "condition_already_met" }, { status: 422 });
  }

  try {
    const monitor = await createPerpetualMonitor({
      userId: entitlement.userId!,
      snapshotId: snapshot.id,
      condition,
      monitorLimit: cryptoAlertConditionLimit(entitlement.plan)
    });
    if (!monitor) throw new Error("monitor_create_empty");
    await recordServerProductEvent({
      eventId: monitor.id,
      eventName: "monitor_created",
      userId: entitlement.userId!,
      surface: "perpetual",
      asset: snapshot.asset,
      snapshotId: snapshot.id,
      monitorId: monitor.id,
      properties: { conditionRole: condition.role }
    });
    const usage = await sharedCryptoConditionUsage(entitlement.userId!);
    return privateJson({ monitor, usage }, { status: 201 });
  } catch (error) {
    return storeFailure(error);
  }
}
