// 앱스토어 구독 상태를 RevenueCat에서 확인하고 Pro 권한을 갱신합니다.
import { NextResponse } from "next/server";
import {
  findBillingPlan,
  findBillingPlanByAppStoreProductId,
  resolveCombinedBillingEntitlementPlan,
  resolveStoreEntitlementMarkets
} from "@/lib/billing";
import { grantBillingEntitlement } from "@/lib/server/billingEntitlements";
import { isBodyTooLarge, rateLimit } from "@/lib/server/rateLimit";
import {
  fetchSupabaseUserOnServer,
  isSupabaseAdminConfigured
} from "@/lib/server/supabaseAdmin";

interface AppStoreSyncRequest {
  appUserId?: string;
  planId?: string;
  platform?: "android" | "ios";
}

interface RevenueCatSubscriberResponse {
  subscriber?: {
    entitlements?: Record<string, { expires_date?: string | null }>;
    subscriptions?: Record<string, { expires_date?: string | null; store?: string | null }>;
  };
}

interface ResolvedAppStorePlan {
  plan: NonNullable<ReturnType<typeof findBillingPlan>>;
  expiresDate: string | null;
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const [type, token] = authorization.split(" ");
  return type?.toLowerCase() === "bearer" ? token : "";
}

function isStillActive(expiresDate: string | null | undefined) {
  if (!expiresDate) return true;
  return new Date(expiresDate).getTime() > Date.now();
}

async function fetchRevenueCatSubscriber(appUserId: string) {
  const apiKey = process.env.REVENUECAT_REST_API_KEY ?? "";
  if (!apiKey) return { configured: false, payload: null as RevenueCatSubscriberResponse | null };

  const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json"
    },
    cache: "no-store"
  });

  const payload = (await response.json().catch(() => ({}))) as RevenueCatSubscriberResponse & {
    message?: string;
  };

  if (!response.ok) {
    throw new Error(payload.message ?? "앱 구독 상태를 확인하지 못했습니다.");
  }

  return { configured: true, payload };
}

function uniqueActivePlans(activePlans: ResolvedAppStorePlan[]) {
  const byPlanId = new Map<string, ResolvedAppStorePlan>();
  for (const activePlan of activePlans) {
    const previousPlan = byPlanId.get(activePlan.plan.id);
    if (!previousPlan) {
      byPlanId.set(activePlan.plan.id, activePlan);
      continue;
    }

    const previousTime = previousPlan.expiresDate ? new Date(previousPlan.expiresDate).getTime() : Number.POSITIVE_INFINITY;
    const nextTime = activePlan.expiresDate ? new Date(activePlan.expiresDate).getTime() : Number.POSITIVE_INFINITY;
    if (nextTime > previousTime) byPlanId.set(activePlan.plan.id, activePlan);
  }

  return Array.from(byPlanId.values());
}

function sortActivePlans(activePlans: ResolvedAppStorePlan[], requestedPlanId?: string) {
  const priorityPlanId = resolveCombinedBillingEntitlementPlan(
    activePlans.map((activePlan) => activePlan.plan.id),
    "all"
  );
  const priorityByPlanId = new Map(
    ["bundle_yearly", "bundle_monthly", "crypto_yearly", "stocks_yearly", "crypto_monthly", "stocks_monthly"].map((planId, index) => [
      planId,
      index
    ])
  );

  return [...activePlans].sort((left, right) => {
    if (requestedPlanId && left.plan.id === requestedPlanId) return -1;
    if (requestedPlanId && right.plan.id === requestedPlanId) return 1;
    if (priorityPlanId && left.plan.id === priorityPlanId) return -1;
    if (priorityPlanId && right.plan.id === priorityPlanId) return 1;
    return (priorityByPlanId.get(left.plan.id) ?? 99) - (priorityByPlanId.get(right.plan.id) ?? 99);
  });
}

function getActiveRevenueCatEntitlements(payload: RevenueCatSubscriberResponse) {
  const entitlements = payload.subscriber?.entitlements ?? {};
  return Object.fromEntries(Object.entries(entitlements).filter(([, value]) => isStillActive(value.expires_date)));
}

function resolveActivePlans(payload: RevenueCatSubscriberResponse, requestedPlanId?: string) {
  const requestedPlan = findBillingPlan(requestedPlanId);
  const subscriptions = payload.subscriber?.subscriptions ?? {};
  const activeProductIds = Object.entries(subscriptions)
    .filter(([, value]) => isStillActive(value.expires_date))
    .map(([productId, value]) => ({ productId, expiresDate: value.expires_date ?? null }));

  const activePlans = activeProductIds
    .map(({ productId, expiresDate }) => {
      const plan = findBillingPlanByAppStoreProductId(productId);
      return plan ? { plan, expiresDate } : null;
    })
    .filter(Boolean) as ResolvedAppStorePlan[];

  const knownActivePlans = uniqueActivePlans(activePlans);
  const activeEntitlements = getActiveRevenueCatEntitlements(payload);
  const entitlementMarkets = resolveStoreEntitlementMarkets(activeEntitlements);

  return {
    plans: sortActivePlans(knownActivePlans, requestedPlan?.id === "free" ? undefined : requestedPlan?.id),
    entitlementMarkets
  };
}

export async function POST(request: Request) {
  const limit = await rateLimit(request, { key: "app-store-sync", limit: 30, windowMs: 10 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { status: "rate_limited", message: "구독 확인 요청이 잠시 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  if (isBodyTooLarge(request, 8_000)) {
    return NextResponse.json({ status: "rejected", message: "구독 확인 요청을 처리하지 못했습니다. 다시 시도해 주세요." }, { status: 413 });
  }

  const body = (await request.json().catch(() => ({}))) as AppStoreSyncRequest;
  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return NextResponse.json({ status: "login_required", message: "구독 상태를 확인하려면 로그인이 필요합니다." }, { status: 401 });
  }

  if (body.platform !== "android" && body.platform !== "ios") {
    return NextResponse.json({ status: "rejected", message: "현재 기기에서는 앱 결제를 확인하지 못했습니다." }, { status: 400 });
  }

  let user: Awaited<ReturnType<typeof fetchSupabaseUserOnServer>>;
  try {
    user = await fetchSupabaseUserOnServer(accessToken);
  } catch {
    return NextResponse.json({ status: "login_required", message: "로그인 정보를 확인하지 못했습니다. 다시 로그인해 주세요." }, { status: 401 });
  }

  if (!body.appUserId || body.appUserId !== user.id) {
    return NextResponse.json({ status: "rejected", message: "앱 구독 사용자와 로그인 계정이 일치하지 않습니다." }, { status: 400 });
  }

  let revenueCatResult: Awaited<ReturnType<typeof fetchRevenueCatSubscriber>>;
  try {
    revenueCatResult = await fetchRevenueCatSubscriber(body.appUserId);
  } catch (error) {
    return NextResponse.json(
      { status: "pending", message: error instanceof Error ? error.message : "앱 구독 상태 확인 중 오류가 발생했습니다." },
      { status: 502 }
    );
  }

  if (!revenueCatResult.configured) {
    return NextResponse.json({
      active: false,
      status: "setup_required",
      message: "앱 구독 확인이 조금 지연되고 있습니다. 잠시 후 다시 확인해 주세요."
    });
  }

  const activePlanResult = resolveActivePlans(revenueCatResult.payload ?? {}, body.planId);
  const activePlans = activePlanResult.plans;
  if (activePlans.length === 0) {
    if (activePlanResult.entitlementMarkets.crypto || activePlanResult.entitlementMarkets.stocks || activePlanResult.entitlementMarkets.bundle) {
      return NextResponse.json({
        active: false,
        status: "setup_required",
        message: "활성 앱 구독은 확인했지만 요금제 상품 ID를 연결하지 못했습니다. 고객센터로 문의해 주세요."
      }, { status: 409 });
    }

    return NextResponse.json({ active: false, status: "not_active", message: "현재 활성화된 앱 구독을 찾지 못했습니다." }, { status: 404 });
  }

  const primaryPlan = activePlans[0];
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({
      active: false,
      status: "setup_required",
      planId: primaryPlan.plan.id,
      planIds: activePlans.map((activePlan) => activePlan.plan.id),
      message: "앱 구독은 확인했지만 Pro 기능을 여는 과정이 지연되고 있습니다. 고객센터로 문의해 주세요."
    });
  }

  try {
    await Promise.all(
      activePlans.map((activePlan) =>
        grantBillingEntitlement({
          userId: user.id,
          planId: activePlan.plan.id,
          provider: "revenuecat",
          providerOrderId: `rc_${user.id}_${activePlan.plan.id}`,
          providerPaymentId: body.appUserId,
          currentPeriodEndIso: activePlan.expiresDate ?? undefined
        })
      )
    );
  } catch {
    return NextResponse.json(
      {
        active: false,
        status: "setup_required",
        planId: primaryPlan.plan.id,
        planIds: activePlans.map((activePlan) => activePlan.plan.id),
        message: "앱 구독은 확인했지만 Pro 기능을 여는 과정에서 문제가 발생했습니다."
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    active: true,
    status: "active",
    planId: primaryPlan.plan.id,
    planIds: activePlans.map((activePlan) => activePlan.plan.id),
    message: "앱 구독이 확인되어 Pro 기능이 열렸습니다."
  });
}
