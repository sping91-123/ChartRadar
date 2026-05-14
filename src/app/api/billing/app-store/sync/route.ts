// 앱스토어 구독 상태를 RevenueCat에서 확인하고 Pro 권한을 동기화합니다.
import { NextResponse } from "next/server";
import {
  findBillingPlan,
  findBillingPlanByAppStoreProductId,
  type BillingPlanId
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

const entitlementFallbackPlans: Record<string, BillingPlanId> = {
  coin_pro: "crypto_monthly",
  crypto_pro: "crypto_monthly",
  global_pro: "stocks_monthly",
  all_market_pro: "bundle_monthly",
  bundle_pro: "bundle_monthly"
};

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

function resolveActivePlan(payload: RevenueCatSubscriberResponse, requestedPlanId?: string) {
  const requestedPlan = findBillingPlan(requestedPlanId);
  const subscriptions = payload.subscriber?.subscriptions ?? {};
  const activeProductIds = Object.entries(subscriptions)
    .filter(([, value]) => isStillActive(value.expires_date))
    .map(([productId]) => productId);

  const activePlans = activeProductIds
    .map((productId) => findBillingPlanByAppStoreProductId(productId))
    .filter(Boolean);

  if (requestedPlan && requestedPlan.id !== "free" && activePlans.some((plan) => plan?.id === requestedPlan.id)) {
    return requestedPlan;
  }

  const bundlePlan = activePlans.find((plan) => plan?.marketScope === "bundle");
  if (bundlePlan) return bundlePlan;
  if (activePlans[0]) return activePlans[0];

  const entitlements = payload.subscriber?.entitlements ?? {};
  const activeEntitlement = Object.entries(entitlements)
    .find(([, value]) => isStillActive(value.expires_date))?.[0];
  const fallbackPlan = activeEntitlement ? findBillingPlan(entitlementFallbackPlans[activeEntitlement]) : null;
  return fallbackPlan?.id === "free" ? null : fallbackPlan;
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
      status: "setup_required",
      message: "앱 구독 확인이 조금 지연되고 있습니다. 잠시 후 다시 확인해 주세요."
    });
  }

  const plan = resolveActivePlan(revenueCatResult.payload ?? {}, body.planId);
  if (!plan || plan.id === "free") {
    return NextResponse.json({ status: "not_active", message: "현재 활성화된 앱 구독을 찾지 못했습니다." }, { status: 404 });
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({
      status: "setup_required",
      planId: plan.id,
      message: "앱 구독은 확인했지만 Pro 기능을 여는 과정이 지연되고 있습니다. 고객센터로 문의해 주세요."
    });
  }

  try {
    await grantBillingEntitlement({
      userId: user.id,
      planId: plan.id,
      provider: "revenuecat",
      providerOrderId: `rc_${user.id}_${plan.id}`,
      providerPaymentId: body.appUserId
    });
  } catch {
    return NextResponse.json(
      { status: "setup_required", planId: plan.id, message: "앱 구독은 확인했지만 Pro 기능을 여는 과정에서 문제가 발생했습니다." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    status: "active",
    planId: plan.id,
    message: "앱 구독이 확인되어 Pro 기능이 열렸습니다."
  });
}
