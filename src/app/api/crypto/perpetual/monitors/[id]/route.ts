import { NextResponse } from "next/server";
import { cryptoAlertConditionLimit } from "@/lib/billing";
import { isUuid } from "@/lib/perpetualMonitor";
import { markExpiredPerpetualMonitors, reconcilePerpetualMonitorLimit, setPerpetualMonitorAction } from "@/lib/server/perpetualMonitorStore";
import { isPerpetualRevenueCoreUserEnabled } from "@/lib/server/perpetualRevenueCore";
import { entitlementRateKey, getRequestEntitlement } from "@/lib/server/requestEntitlement";
import { rateLimit, readJsonBodyLimited } from "@/lib/server/rateLimit";
import { isSupabaseAdminConfigured } from "@/lib/server/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function privateJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Vary", "Authorization");
  return response;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const entitlement = await getRequestEntitlement(request, "crypto");
  if (!entitlement.userId || !entitlement.isAuthenticated) {
    return privateJson({ error: "로그인이 필요합니다.", code: "authentication_required" }, { status: 401 });
  }
  if (entitlement.state === "deletion_pending") {
    return privateJson({ error: "계정 삭제 대기 중에는 조건 감시를 변경할 수 없습니다.", code: "deletion_pending" }, { status: 409 });
  }
  if (entitlement.state === "unavailable") {
    return privateJson({ error: "구독 권한을 확인하지 못했습니다.", code: "entitlement_unavailable" }, { status: 503 });
  }
  if (!isPerpetualRevenueCoreUserEnabled(entitlement.userId)) {
    return privateJson({ error: "조건 감시는 아직 활성화되지 않았습니다.", code: "revenue_core_not_active" }, { status: 409 });
  }
  if (!isSupabaseAdminConfigured()) return privateJson({ error: "조건 감시 저장소가 설정되지 않았습니다." }, { status: 503 });

  const limited = await rateLimit(request, {
    key: entitlementRateKey("crypto-perpetual-monitors-update", entitlement),
    limit: 60,
    windowMs: 5 * 60 * 1000
  });
  if (!limited.allowed) return privateJson({ error: "조건 감시 변경 요청이 많습니다." }, { status: 429 });

  const { id } = await context.params;
  const parsed = await readJsonBodyLimited<{ action?: unknown } | null>(request, 512);
  if (!parsed.ok && parsed.tooLarge) {
    return privateJson({ error: "조건 감시 변경 요청이 너무 큽니다.", code: "request_too_large" }, { status: 413 });
  }
  const body = parsed.ok ? parsed.value : null;
  if (
    !isUuid(id) ||
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => key !== "action") ||
    (body.action !== "pause" && body.action !== "resume" && body.action !== "cancel")
  ) {
    return privateJson({ error: "조건 감시 변경 요청이 올바르지 않습니다.", code: "invalid_monitor_request" }, { status: 400 });
  }
  try {
    const monitorLimit = cryptoAlertConditionLimit(entitlement.plan);
    await markExpiredPerpetualMonitors("perpetual-v1.0.0");
    await reconcilePerpetualMonitorLimit(entitlement.userId, monitorLimit);
    const monitor = await setPerpetualMonitorAction({
      userId: entitlement.userId,
      monitorId: id,
      action: body.action,
      monitorLimit
    });
    if (!monitor) return privateJson({ error: "조건 감시를 찾지 못했습니다.", code: "monitor_not_found" }, { status: 404 });
    return privateJson({ monitor });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("monitor_not_found")) return privateJson({ error: "조건 감시를 찾지 못했습니다.", code: "monitor_not_found" }, { status: 404 });
    if (message.includes("monitor_limit_reached")) {
      return privateJson({
        error: "재개 가능한 조건 한도를 모두 사용했습니다.",
        code: "monitor_limit_reached",
        upgrade: { href: "/pro?market=crypto&source=perpetual-monitor-limit" }
      }, { status: 403 });
    }
    if (message.includes("condition_expired") || message.includes("monitor_not_resumable")) {
      return privateJson({ error: "이 조건은 만료됐거나 다시 시작할 수 없습니다.", code: "snapshot_not_actionable" }, { status: 409 });
    }
    console.error("[api/crypto/perpetual/monitors/id] error", error);
    return privateJson({ error: "조건 감시를 변경하지 못했습니다." }, { status: 503 });
  }
}
