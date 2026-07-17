import { createHash } from "node:crypto";
import { findBillingPlanByAppStoreProductId, getMarketScopeForPlan } from "../billing";
import type { ProviderSnapshotEntitlement } from "./billingEntitlements";

export type RevenueCatSnapshotErrorCode = "incomplete" | "unknown_product" | "provider_unavailable";

export class RevenueCatSnapshotError extends Error {
  code: RevenueCatSnapshotErrorCode;

  constructor(code: RevenueCatSnapshotErrorCode, message: string) {
    super(message);
    this.name = "RevenueCatSnapshotError";
    this.code = code;
  }
}

export interface RevenueCatSubscription {
  expires_date?: string | null;
  purchase_date?: string | null;
  original_purchase_date?: string | null;
  original_transaction_id?: string | null;
  store_transaction_id?: string | null;
  store?: string | null;
  unsubscribe_detected_at?: string | null;
  billing_issues_detected_at?: string | null;
  refunded_at?: string | null;
}

export interface RevenueCatEntitlement {
  expires_date?: string | null;
  product_identifier?: string | null;
}

export interface RevenueCatSubscriberResponse {
  subscriber?: {
    entitlements?: Record<string, RevenueCatEntitlement>;
    subscriptions?: Record<string, RevenueCatSubscription>;
  };
}

function futureIso(value: string | null | undefined, observedAt: string) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  const observedTimestamp = Date.parse(observedAt);
  if (!Number.isFinite(timestamp) || !Number.isFinite(observedTimestamp) || timestamp <= observedTimestamp) return null;
  return new Date(timestamp).toISOString();
}

function providerOrderId(productId: string, subscription: RevenueCatSubscription) {
  const originalIdentity = subscription.original_transaction_id?.trim()
    || subscription.original_purchase_date?.trim();
  if (!originalIdentity) {
    throw new RevenueCatSnapshotError(
      "incomplete",
      "RevenueCat snapshot is missing a stable original purchase identifier."
    );
  }
  const digest = createHash("sha256")
    .update(`${subscription.store ?? "unknown"}\u0000${productId}\u0000${originalIdentity}`)
    .digest("hex");
  return `rc:${digest}`;
}

export function buildRevenueCatSnapshot(
  payload: RevenueCatSubscriberResponse,
  observedAt: string
): ProviderSnapshotEntitlement[] {
  const subscriber = payload.subscriber;
  if (!subscriber || !subscriber.entitlements || !subscriber.subscriptions) {
    throw new RevenueCatSnapshotError("incomplete", "RevenueCat subscriber snapshot is incomplete.");
  }

  const activeProductIds = new Set<string>();
  for (const entitlement of Object.values(subscriber.entitlements)) {
    if (!futureIso(entitlement.expires_date, observedAt)) continue;
    const productId = entitlement.product_identifier?.trim();
    if (!productId) {
      throw new RevenueCatSnapshotError(
        "incomplete",
        "An active RevenueCat entitlement has no product identifier."
      );
    }
    activeProductIds.add(productId);
  }

  const snapshot: ProviderSnapshotEntitlement[] = [];
  const seenOrders = new Set<string>();
  for (const productId of Array.from(activeProductIds)) {
    const subscription = subscriber.subscriptions[productId];
    if (!subscription) {
      throw new RevenueCatSnapshotError(
        "incomplete",
        "An active RevenueCat entitlement has no matching subscription record."
      );
    }

    // Product policy is intentionally fail-closed: billing issues are past_due
    // immediately, and refunded purchases must not retain access.
    if (subscription.billing_issues_detected_at || subscription.refunded_at) continue;

    const expiry = futureIso(subscription.expires_date, observedAt);
    if (!expiry) {
      throw new RevenueCatSnapshotError(
        "incomplete",
        "An active RevenueCat entitlement has no future subscription expiry."
      );
    }
    const plan = findBillingPlanByAppStoreProductId(productId);
    if (!plan || plan.id === "free") {
      throw new RevenueCatSnapshotError(
        "unknown_product",
        `RevenueCat snapshot contains an unknown active product: ${productId}`
      );
    }

    const orderId = providerOrderId(productId, subscription);
    if (seenOrders.has(orderId)) {
      throw new RevenueCatSnapshotError("incomplete", "RevenueCat snapshot contains a duplicate purchase identity.");
    }
    seenOrders.add(orderId);
    snapshot.push({
      plan: plan.id,
      market_scope: getMarketScopeForPlan(plan.id) as "crypto" | "stocks" | "bundle",
      status: subscription.unsubscribe_detected_at ? "canceled" : "active",
      current_period_start: subscription.purchase_date ?? subscription.original_purchase_date ?? observedAt,
      current_period_end: expiry,
      provider_product_id: productId,
      provider_order_id: orderId,
      provider_payment_id: subscription.store_transaction_id?.trim() || null
    });
  }

  return snapshot;
}

export async function fetchRevenueCatSubscriber(params: {
  appUserId: string;
  apiKey: string;
  timeoutMs?: number;
}) {
  if (!params.apiKey) {
    throw new RevenueCatSnapshotError("provider_unavailable", "RevenueCat REST API key is missing.");
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), params.timeoutMs ?? 8_000);
  try {
    const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(params.appUserId)}`, {
      headers: { Authorization: `Bearer ${params.apiKey}`, Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal
    });
    const payload = (await response.json().catch(() => ({}))) as RevenueCatSubscriberResponse & { message?: string };
    if (!response.ok) {
      throw new RevenueCatSnapshotError(
        "provider_unavailable",
        payload.message ?? `RevenueCat subscriber lookup failed (${response.status}).`
      );
    }
    if (!payload.subscriber?.entitlements || !payload.subscriber.subscriptions) {
      throw new RevenueCatSnapshotError("incomplete", "RevenueCat subscriber snapshot is incomplete.");
    }
    return payload;
  } catch (error) {
    if (error instanceof RevenueCatSnapshotError) throw error;
    throw new RevenueCatSnapshotError(
      "provider_unavailable",
      error instanceof Error && error.name === "AbortError"
        ? "RevenueCat subscriber lookup timed out."
        : "RevenueCat subscriber lookup failed."
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function identityValues(value: unknown) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return [];
}

export function extractRevenueCatWebhookUserIds(event: Record<string, unknown> | undefined) {
  if (!event) return [];
  const candidates = [
    ...identityValues(event.transferred_from),
    ...identityValues(event.app_user_id),
    ...identityValues(event.original_app_user_id),
    ...identityValues(event.aliases),
    ...identityValues(event.transferred_to)
  ];
  const unique = new Set<string>();
  for (const candidate of candidates) {
    const normalized = candidate.trim();
    if (uuidPattern.test(normalized)) unique.add(normalized.toLowerCase());
    if (unique.size >= 8) break;
  }
  return Array.from(unique);
}
