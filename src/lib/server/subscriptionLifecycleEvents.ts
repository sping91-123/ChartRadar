import { createHash } from "node:crypto";
import { findBillingPlanByAppStoreProductId, type BillingPlanId } from "../billing";
import type { ProviderSnapshotEntitlement } from "./billingEntitlements";

export type SubscriptionLifecycleEventName =
  | "verified_trial_started"
  | "trial_converted"
  | "entitlement_activated";

export interface PreviousSubscriptionState {
  provider_order_id: string | null;
  provider_product_id?: string | null;
  status: string | null;
  plan: string | null;
  revoked_at?: string | null;
}

export interface SubscriptionLifecycleTransition {
  eventId: string;
  eventName: SubscriptionLifecycleEventName;
  planId: BillingPlanId;
  providerOrderId: string;
}

export interface TerminalSubscriptionTarget {
  planId: BillingPlanId;
  providerOrderId: string;
}

export function resolveTerminalSubscriptionTarget(params: {
  productId: unknown;
  previous: readonly PreviousSubscriptionState[];
  current: readonly ProviderSnapshotEntitlement[];
}): TerminalSubscriptionTarget | null {
  if (typeof params.productId !== "string" || params.productId.length > 240) return null;
  const plan = findBillingPlanByAppStoreProductId(params.productId);
  if (!plan || plan.id === "free") return null;

  const currentMatch = params.current.find((entry) =>
    entry.plan === plan.id && findBillingPlanByAppStoreProductId(entry.provider_product_id)?.id === plan.id
  );
  if (currentMatch) {
    return { planId: plan.id, providerOrderId: currentMatch.provider_order_id };
  }

  const previousMatch = params.previous.find((entry) =>
    entry.plan === plan.id &&
    Boolean(entry.provider_order_id) &&
    findBillingPlanByAppStoreProductId(entry.provider_product_id)?.id === plan.id
  );
  return previousMatch?.provider_order_id
    ? { planId: plan.id, providerOrderId: previousMatch.provider_order_id }
    : null;
}

export function stableProductLifecycleEventId(
  userId: string,
  providerIdentity: string,
  eventName: string
) {
  const hex = createHash("sha256")
    .update(`product-lifecycle\u0000${userId}\u0000${providerIdentity}\u0000${eventName}`)
    .digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function deriveSubscriptionLifecycleTransitions(params: {
  userId: string;
  previous: readonly PreviousSubscriptionState[];
  current: readonly ProviderSnapshotEntitlement[];
}) {
  const previousByOrder = new Map(
    params.previous
      .filter((entry): entry is PreviousSubscriptionState & { provider_order_id: string } => Boolean(entry.provider_order_id))
      .map((entry) => [entry.provider_order_id, entry])
  );
  const transitions: SubscriptionLifecycleTransition[] = [];

  for (const entitlement of params.current) {
    const previous = previousByOrder.get(entitlement.provider_order_id);
    const previouslyInactive = !previous || Boolean(previous.revoked_at) || [
      "inactive", "expired", "revoked", "refunded", "past_due"
    ].includes(previous.status ?? "");

    if (entitlement.status === "trialing" && previous?.status !== "trialing") {
      transitions.push({
        eventId: stableProductLifecycleEventId(params.userId, entitlement.provider_order_id, "verified_trial_started"),
        eventName: "verified_trial_started",
        planId: entitlement.plan,
        providerOrderId: entitlement.provider_order_id
      });
    }
    if (entitlement.status === "active" && previous?.status === "trialing") {
      transitions.push({
        eventId: stableProductLifecycleEventId(params.userId, entitlement.provider_order_id, "trial_converted"),
        eventName: "trial_converted",
        planId: entitlement.plan,
        providerOrderId: entitlement.provider_order_id
      });
    }
    if (previouslyInactive) {
      transitions.push({
        eventId: stableProductLifecycleEventId(params.userId, entitlement.provider_order_id, "entitlement_activated"),
        eventName: "entitlement_activated",
        planId: entitlement.plan,
        providerOrderId: entitlement.provider_order_id
      });
    }
  }

  return transitions;
}
