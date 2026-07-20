import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveCombinedBillingEntitlementPlan, resolvePlanIdFromStoreProductId } from "@/lib/billing";
import { resolveEffectiveEntitlement } from "@/lib/effectiveEntitlement";
import { isUuid } from "@/lib/perpetualMonitor";
import { reconcileProviderEntitlements } from "@/lib/server/billingEntitlements";
import { findRecentPurchaseAttribution, recordServerProductEvent } from "@/lib/server/productEventStore";
import { isBodyTooLarge, rateLimit, readJsonBodyLimited } from "@/lib/server/rateLimit";
import {
  buildRevenueCatSnapshot,
  fetchRevenueCatSubscriber,
  RevenueCatSnapshotError
} from "@/lib/server/revenueCatSnapshot";
import { fetchSupabaseUserOnServer, isSupabaseAdminConfigured } from "@/lib/server/supabaseAdmin";
import { fetchSupabaseActiveSubscriptions } from "@/lib/supabase";

interface AppStoreSyncRequest {
  appUserId?: string;
  attributionId?: string;
  attributionSource?: string;
  basePlanId?: string;
  planId?: string;
  productId?: string;
  platform?: "android" | "ios";
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const [type, token] = authorization.split(" ");
  return type?.toLowerCase() === "bearer" ? token : "";
}

function requestedStorePlanId(body: AppStoreSyncRequest) {
  if (!body.productId) return null;
  return resolvePlanIdFromStoreProductId(body.basePlanId ? `${body.productId}:${body.basePlanId}` : body.productId);
}

async function readCanonicalState(accessToken: string, userId: string, isAdmin: boolean) {
  const subscriptions = await fetchSupabaseActiveSubscriptions(accessToken, userId);
  const effective = resolveEffectiveEntitlement({ isAuthenticated: true, isAdmin, subscriptions });
  const active = effective.state === "active";
  return {
    active,
    status: active ? "active" as const : "not_active" as const,
    planId: active ? effective.plan : null,
    planIds: active ? [effective.plan] : []
  };
}

export async function POST(request: Request) {
  const limit = await rateLimit(request, { key: "app-store-sync", limit: 30, windowMs: 10 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { active: false, status: "pending", message: "구독 확인 요청이 잠시 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }
  if (isBodyTooLarge(request, 8_000)) {
    return NextResponse.json({ active: false, status: "pending", message: "요청이 너무 큽니다." }, { status: 413 });
  }

  const parsed = await readJsonBodyLimited<AppStoreSyncRequest | null>(request, 8_000);
  if (!parsed.ok) {
    return NextResponse.json(
      { active: false, status: "pending", message: parsed.tooLarge ? "Request body is too large." : "Request body is invalid." },
      { status: parsed.tooLarge ? 413 : 400 }
    );
  }
  const body = parsed.value ?? {};
  const allowedKeys = new Set(["appUserId", "attributionId", "attributionSource", "basePlanId", "planId", "productId", "platform"]);
  if (typeof body !== "object" || Array.isArray(body) || Object.keys(body).some((key) => !allowedKeys.has(key))) {
    return NextResponse.json({ active: false, status: "pending", message: "Request fields are invalid." }, { status: 400 });
  }
  if (body.attributionId !== undefined && !isUuid(body.attributionId)) {
    return NextResponse.json({ active: false, status: "pending", message: "Purchase attribution is invalid." }, { status: 400 });
  }
  if (body.attributionSource !== undefined && !/^[a-z0-9_-]{1,60}$/i.test(body.attributionSource)) {
    return NextResponse.json({ active: false, status: "pending", message: "Purchase attribution source is invalid." }, { status: 400 });
  }
  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return NextResponse.json({ active: false, status: "login_required", message: "로그인이 필요합니다." }, { status: 401 });
  }
  if (body.platform !== "android" && body.platform !== "ios") {
    return NextResponse.json({ active: false, status: "pending", message: "지원하지 않는 플랫폼입니다." }, { status: 400 });
  }

  let user: Awaited<ReturnType<typeof fetchSupabaseUserOnServer>>;
  try {
    user = await fetchSupabaseUserOnServer(accessToken);
  } catch {
    return NextResponse.json({ active: false, status: "login_required", message: "로그인을 다시 확인해 주세요." }, { status: 401 });
  }
  if (!body.appUserId || body.appUserId !== user.id) {
    return NextResponse.json({ active: false, status: "pending", message: "구독 계정과 로그인 계정이 다릅니다." }, { status: 400 });
  }

  const requestPlanId = requestedStorePlanId(body);
  if (body.productId && !requestPlanId) {
    return NextResponse.json({ active: false, status: "setup_required", message: "등록되지 않은 스토어 상품입니다." }, { status: 409 });
  }
  if (body.planId && requestPlanId && body.planId !== requestPlanId) {
    return NextResponse.json({ active: false, status: "setup_required", message: "상품 매핑이 일치하지 않습니다." }, { status: 409 });
  }
  if (body.attributionId && (!body.planId || !requestPlanId)) {
    return NextResponse.json({ active: false, status: "pending", message: "Purchase attribution requires a mapped product." }, { status: 400 });
  }
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ active: false, status: "setup_required", message: "구독 원장 연결이 준비되지 않았습니다." }, { status: 503 });
  }
  const revenueCatApiKey = process.env.REVENUECAT_REST_API_KEY ?? "";
  if (!revenueCatApiKey) {
    return NextResponse.json({ active: false, status: "setup_required", message: "RevenueCat 서버 설정이 필요합니다." }, { status: 503 });
  }

  const observedAt = new Date().toISOString();
  if (body.attributionId && requestPlanId) {
    await recordServerProductEvent({
      eventId: body.attributionId,
      eventName: "purchase_started",
      userId: user.id,
      surface: "billing",
      properties: { provider: "revenuecat", planId: requestPlanId, source: body.attributionSource ?? "pro_page" }
    });
  }
  let snapshot: ReturnType<typeof buildRevenueCatSnapshot>;
  try {
    const payload = await fetchRevenueCatSubscriber({ appUserId: body.appUserId, apiKey: revenueCatApiKey });
    snapshot = buildRevenueCatSnapshot(payload, observedAt);
  } catch (error) {
    const setupRequired = error instanceof RevenueCatSnapshotError && error.code === "unknown_product";
    return NextResponse.json(
      {
        active: false,
        status: setupRequired ? "setup_required" : "pending",
        message: error instanceof Error ? error.message : "구독 확인이 지연되고 있습니다."
      },
      { status: setupRequired ? 409 : 502 }
    );
  }

  try {
    const result = await reconcileProviderEntitlements({
      userId: user.id,
      provider: "revenuecat",
      eventId: `sync:${randomUUID()}`,
      snapshot,
      observedAtIso: observedAt,
      verifiedEmpty: snapshot.length === 0
    });

    if (result.status === "stale" || result.status === "duplicate") {
      const canonical = await readCanonicalState(accessToken, user.id, user.app_metadata?.role === "admin");
      return NextResponse.json({
        ...canonical,
        changed: false,
        reconciliationStatus: result.status,
        message: "더 최신 구독 상태가 이미 저장되어 있습니다."
      });
    }

    const planIds = snapshot.map((entry) => entry.plan);
    const primaryPlan = resolveCombinedBillingEntitlementPlan(planIds, "all") ?? planIds[0] ?? null;
    const active = snapshot.length > 0;
    if (active && result.changed) {
      const attributionId = body.attributionId ?? await findRecentPurchaseAttribution({
        userId: user.id,
        provider: "revenuecat",
        planId: primaryPlan
      });
      await recordServerProductEvent({
        eventName: "entitlement_activated",
        userId: user.id,
        surface: "billing",
        attributionId,
        properties: { provider: "revenuecat", planId: primaryPlan }
      });
    }
    return NextResponse.json({
      active,
      status: active ? "active" : "not_active",
      planId: primaryPlan,
      planIds,
      changed: result.changed,
      reconciliationStatus: result.status,
      message: active ? "스토어 구독 권한을 갱신했습니다." : "현재 활성 스토어 구독이 없습니다."
    });
  } catch {
    return NextResponse.json(
      { active: false, status: "pending", message: "구독 원장 갱신을 완료하지 못했습니다. 기존 기록은 유지됩니다." },
      { status: 503 }
    );
  }
}
