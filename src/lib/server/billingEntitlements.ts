// 결제 확인 후 사용자 Pro 권한을 Supabase에 반영하는 서버 유틸입니다.
import {
  getBillingPeriodMonths,
  getMarketScopeForPlan,
  type BillingPlanId
} from "@/lib/billing";
import { getSupabaseRestTableColumns, supabaseAdminRest } from "@/lib/server/supabaseAdmin";

function pickSchemaBody(columns: Set<string>, body: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(body).filter(([key, value]) => columns.has(key) && value !== undefined));
}

export async function grantBillingEntitlement(params: {
  userId: string;
  planId: BillingPlanId;
  provider: "toss" | "revenuecat";
  providerOrderId: string;
  providerPaymentId?: string;
  currentPeriodEndIso?: string;
}) {
  const marketScope = getMarketScopeForPlan(params.planId);
  const now = new Date();
  const fallbackPeriodEnd = new Date(now);
  fallbackPeriodEnd.setMonth(fallbackPeriodEnd.getMonth() + getBillingPeriodMonths(params.planId));
  const providerPeriodEnd = params.currentPeriodEndIso ? new Date(params.currentPeriodEndIso) : null;
  const periodEnd =
    providerPeriodEnd && Number.isFinite(providerPeriodEnd.getTime()) && providerPeriodEnd.getTime() > now.getTime()
      ? providerPeriodEnd
      : fallbackPeriodEnd;

  const [profileColumns, subscriptionColumns] = await Promise.all([
    getSupabaseRestTableColumns("profiles"),
    getSupabaseRestTableColumns("subscriptions")
  ]);

  await supabaseAdminRest("profiles", {
    method: "POST",
    prefer: "resolution=merge-duplicates",
    body: pickSchemaBody(profileColumns, {
      id: params.userId,
      plan: params.planId,
      membership_tier: "premium",
      updated_at: now.toISOString()
    })
  });

  const existingSubscriptionPath = subscriptionColumns.has("provider_order_id")
    ? `subscriptions?select=id&provider_order_id=eq.${encodeURIComponent(params.providerOrderId)}&limit=1`
    : [
        `subscriptions?select=id`,
        `user_id=eq.${encodeURIComponent(params.userId)}`,
        subscriptionColumns.has("provider") ? `provider=eq.${encodeURIComponent(params.provider)}` : "",
        "limit=1"
      ]
        .filter(Boolean)
        .join("&");
  const existing = await supabaseAdminRest<Array<{ id: string }>>(existingSubscriptionPath);
  const subscriptionBody = pickSchemaBody(subscriptionColumns, {
    user_id: params.userId,
    provider: params.provider,
    status: "active",
    plan: params.planId,
    tier: params.planId,
    market_scope: marketScope,
    current_period_start: now.toISOString(),
    current_period_end: periodEnd.toISOString(),
    provider_subscription_id: params.providerPaymentId ?? null,
    provider_order_id: params.providerOrderId
  });

  if (existing[0]?.id) {
    await supabaseAdminRest(`subscriptions?id=eq.${encodeURIComponent(existing[0].id)}`, {
      method: "PATCH",
      body: subscriptionBody
    });
    return;
  }

  await supabaseAdminRest("subscriptions", {
    method: "POST",
    body: subscriptionBody
  });
}
