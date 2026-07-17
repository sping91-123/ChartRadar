import { getMarketScopeForPlan, type BillingPlanId } from "@/lib/billing";
import { supabaseAdminRpc } from "@/lib/server/supabaseAdmin";

export type BillingMutationResult = {
  status: "active" | "not_active" | "duplicate" | "stale";
  changed: boolean;
};

export interface ProviderSnapshotEntitlement {
  plan: BillingPlanId;
  market_scope: "crypto" | "stocks" | "bundle";
  status: "trialing" | "active" | "canceled";
  current_period_start: string;
  current_period_end: string;
  provider_product_id: string;
  provider_order_id: string;
  provider_payment_id?: string | null;
}

function validFutureIso(value: string, observedAt: string) {
  const timestamp = Date.parse(value);
  const observedTimestamp = Date.parse(observedAt);
  return Number.isFinite(timestamp) && Number.isFinite(observedTimestamp) && timestamp > observedTimestamp;
}

export async function applyBillingEntitlement(params: {
  userId: string;
  provider: "manual" | "revenuecat" | "legacy_beta";
  eventId: string;
  planId?: BillingPlanId;
  status?: "trialing" | "active" | "canceled";
  currentPeriodStartIso?: string;
  currentPeriodEndIso?: string;
  providerProductId?: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  observedAtIso?: string;
  revoke?: boolean;
  revocationReason?: string;
  actorUserId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}) {
  const observedAt = params.observedAtIso ?? new Date().toISOString();
  if (!params.revoke) {
    if (!params.planId || !params.currentPeriodEndIso || !params.providerOrderId) {
      throw new Error("Entitlement plan, period end, and provider order are required.");
    }
    if (!validFutureIso(params.currentPeriodEndIso, observedAt)) {
      throw new Error("Entitlement period end must be later than the observed time.");
    }
  }

  return supabaseAdminRpc<BillingMutationResult>("apply_billing_entitlement", {
    p_user_id: params.userId,
    p_provider: params.provider,
    p_event_id: params.eventId,
    p_plan: params.planId ?? null,
    p_market_scope: params.planId ? getMarketScopeForPlan(params.planId) : null,
    p_status: params.status ?? "active",
    p_period_start: params.currentPeriodStartIso ?? observedAt,
    p_period_end: params.currentPeriodEndIso ?? null,
    p_provider_product_id: params.providerProductId ?? null,
    p_provider_order_id: params.providerOrderId ?? null,
    p_provider_payment_id: params.providerPaymentId ?? null,
    p_observed_at: observedAt,
    p_revoke: params.revoke ?? false,
    p_revocation_reason: params.revocationReason ?? null,
    p_actor_user_id: params.actorUserId ?? null,
    p_reason: params.reason ?? null,
    p_metadata: params.metadata ?? {}
  });
}

export async function reconcileProviderEntitlements(params: {
  userId: string;
  provider: "revenuecat";
  eventId: string;
  snapshot: ProviderSnapshotEntitlement[];
  observedAtIso: string;
  verifiedEmpty: boolean;
}) {
  return supabaseAdminRpc<BillingMutationResult>("reconcile_provider_entitlements", {
    p_user_id: params.userId,
    p_provider: params.provider,
    p_event_id: params.eventId,
    p_snapshot: params.snapshot,
    p_observed_at: params.observedAtIso,
    p_verified_empty: params.verifiedEmpty
  });
}

// Compatibility name for narrow call sites while all mutations now go through
// one transactional service-role RPC.
export async function grantBillingEntitlement(params: {
  userId: string;
  planId: BillingPlanId;
  provider: "revenuecat";
  providerOrderId: string;
  providerPaymentId?: string;
  providerProductId?: string;
  currentPeriodStartIso?: string;
  currentPeriodEndIso: string;
  eventId: string;
  observedAtIso?: string;
}) {
  return applyBillingEntitlement({
    ...params,
    eventId: params.eventId,
    provider: params.provider
  });
}
