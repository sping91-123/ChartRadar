import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyRevenueCatWebhookSignature } from "../src/lib/server/revenueCatWebhook";
import {
  buildRevenueCatSnapshot,
  extractRevenueCatWebhookUserIds,
  RevenueCatSnapshotError
} from "../src/lib/server/revenueCatSnapshot";
import {
  deriveSubscriptionLifecycleTransitions,
  resolveTerminalSubscriptionTarget,
  stableProductLifecycleEventId
} from "../src/lib/server/subscriptionLifecycleEvents";

const rawBody = '{"event":{"id":"evt_1"}}';
const secret = "test-signing-secret";
const timestamp = 1_700_000_000;
const signature = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
assert.equal(verifyRevenueCatWebhookSignature({ rawBody, secret, signatureHeader: `t=${timestamp},v1=${signature}`, nowMs: timestamp * 1000 }), true);
assert.equal(verifyRevenueCatWebhookSignature({ rawBody: `${rawBody} `, secret, signatureHeader: `t=${timestamp},v1=${signature}`, nowMs: timestamp * 1000 }), false);
assert.equal(verifyRevenueCatWebhookSignature({ rawBody, secret, signatureHeader: `t=${timestamp},v1=${signature}`, nowMs: (timestamp + 301) * 1000 }), false);

const observedAt = "2026-07-16T00:00:00.000Z";
const future = "2026-08-16T00:00:00.000Z";
const productId = "chart_radar_crypto_monthly";
const sourceId = "00000000-0000-4000-8000-000000000001";
function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    subscriber: {
      entitlements: {
        crypto: { expires_date: future, product_identifier: productId }
      },
      subscriptions: {
        [productId]: {
          expires_date: future,
          purchase_date: "2026-07-16T00:00:00.000Z",
          original_purchase_date: "2026-06-16T00:00:00.000Z",
          store: "play_store",
          ...overrides
        }
      }
    }
  };
}

const active = buildRevenueCatSnapshot(snapshot(), observedAt);
assert.equal(active.length, 1);
assert.equal(active[0].status, "active");
assert.match(active[0].provider_order_id, /^rc:[0-9a-f]{64}$/);
assert.equal(
  buildRevenueCatSnapshot(snapshot({ unsubscribe_detected_at: observedAt }), observedAt)[0].status,
  "canceled",
  "canceled access remains valid until its future expiry"
);
assert.equal(
  buildRevenueCatSnapshot(snapshot({ period_type: "TRIAL" }), observedAt)[0].status,
  "trialing",
  "verified store trial periods must remain distinct from paid active subscriptions"
);

const trialSnapshot = buildRevenueCatSnapshot(snapshot({ period_type: "TRIAL" }), observedAt);
const trialTransitions = deriveSubscriptionLifecycleTransitions({
  userId: sourceId,
  previous: [],
  current: trialSnapshot
});
assert.deepEqual(
  trialTransitions.map((transition) => transition.eventName),
  ["verified_trial_started", "entitlement_activated"],
  "a new verified trial starts one trial and one entitlement transition"
);
assert.deepEqual(
  deriveSubscriptionLifecycleTransitions({
    userId: sourceId,
    previous: trialSnapshot.map((entry) => ({
      provider_order_id: entry.provider_order_id,
      status: entry.status,
      plan: entry.plan,
      revoked_at: null
    })),
    current: trialSnapshot
  }),
  [],
  "repeated subscriber refreshes must not duplicate lifecycle events"
);
const convertedTransitions = deriveSubscriptionLifecycleTransitions({
  userId: sourceId,
  previous: trialSnapshot.map((entry) => ({
    provider_order_id: entry.provider_order_id,
    status: entry.status,
    plan: entry.plan,
    revoked_at: null
  })),
  current: active
});
assert.deepEqual(convertedTransitions.map((transition) => transition.eventName), ["trial_converted"]);
assert.equal(
  stableProductLifecycleEventId(sourceId, trialSnapshot[0].provider_order_id, "verified_trial_started"),
  trialTransitions[0].eventId,
  "sync and webhook paths must use the same deterministic UUID"
);
const graceEndsAt = "2026-07-23T00:00:00.000Z";
const graceSnapshot = buildRevenueCatSnapshot({
  subscriber: {
    entitlements: {
      crypto: {
        expires_date: "2026-07-15T23:59:59.000Z",
        product_identifier: productId
      }
    },
    subscriptions: {
      [productId]: {
        expires_date: "2026-07-15T23:59:59.000Z",
        grace_period_expires_date: graceEndsAt,
        billing_issues_detected_at: observedAt,
        purchase_date: "2026-06-16T00:00:00.000Z",
        original_purchase_date: "2026-06-16T00:00:00.000Z",
        store: "play_store"
      }
    }
  }
}, observedAt);
assert.equal(graceSnapshot.length, 1, "billing issues keep access while RevenueCat reports an active grace entitlement");
assert.equal(graceSnapshot[0].status, "active");
assert.equal(graceSnapshot[0].current_period_end, graceEndsAt, "grace expiry extends the effective access window");
assert.deepEqual(
  buildRevenueCatSnapshot({
    subscriber: {
      entitlements: {},
      subscriptions: snapshot({ billing_issues_detected_at: observedAt }).subscriber.subscriptions
    }
  }, observedAt),
  [],
  "account hold removes access when RevenueCat no longer reports an active entitlement"
);
assert.equal(
  buildRevenueCatSnapshot(snapshot(), observedAt).length,
  1,
  "a recovered billing issue restores the active entitlement"
);
assert.deepEqual(
  buildRevenueCatSnapshot(snapshot({ refunded_at: observedAt }), observedAt),
  [],
  "refunded purchases must be removed from the full snapshot"
);
assert.throws(
  () => buildRevenueCatSnapshot({
    subscriber: {
      entitlements: { unknown: { expires_date: future, product_identifier: "unknown_product" } },
      subscriptions: {
        unknown_product: {
          expires_date: future,
          original_purchase_date: observedAt,
          store: "play_store"
        }
      }
    }
  }, observedAt),
  (error) => error instanceof RevenueCatSnapshotError && error.code === "unknown_product"
);
assert.throws(
  () => buildRevenueCatSnapshot(snapshot({ original_purchase_date: null }), observedAt),
  (error) => error instanceof RevenueCatSnapshotError && error.code === "incomplete"
);

const currentId = "00000000-0000-4000-8000-000000000002";
const targetId = "00000000-0000-4000-8000-000000000003";
assert.deepEqual(
  extractRevenueCatWebhookUserIds({
    type: "INITIAL_PURCHASE",
    transferred_from: [sourceId],
    app_user_id: currentId,
    aliases: ["$RCAnonymousID:ignored", currentId],
    transferred_to: [targetId]
  }),
  [currentId],
  "normal events reconcile one canonical RevenueCat customer instead of every alias"
);
assert.deepEqual(
  extractRevenueCatWebhookUserIds({
    type: "TRANSFER",
    transferred_from: ["$RCAnonymousID:source", sourceId, currentId],
    transferred_to: ["$RCAnonymousID:target", targetId]
  }),
  [sourceId, targetId],
  "transfers reconcile one source before one destination"
);

const globalOrderId = `rc:${"b".repeat(64)}`;
const globalEntitlement = {
  ...active[0],
  plan: "stocks_monthly" as const,
  market_scope: "stocks" as const,
  provider_product_id: "chart_radar_global_monthly",
  provider_order_id: globalOrderId
};
const previousSubscriptions = [
  {
    provider_order_id: active[0].provider_order_id,
    provider_product_id: productId,
    status: "active",
    plan: "crypto_monthly",
    revoked_at: null
  },
  {
    provider_order_id: globalOrderId,
    provider_product_id: "chart_radar_global_monthly",
    status: "active",
    plan: "stocks_monthly",
    revoked_at: null
  }
];
assert.deepEqual(
  resolveTerminalSubscriptionTarget({
    productId,
    previous: previousSubscriptions,
    current: [active[0], globalEntitlement]
  }),
  { planId: "crypto_monthly", providerOrderId: active[0].provider_order_id },
  "a cancellation targets the signed Coin product even when Global is also active"
);
assert.deepEqual(
  resolveTerminalSubscriptionTarget({
    productId,
    previous: previousSubscriptions,
    current: [globalEntitlement]
  }),
  { planId: "crypto_monthly", providerOrderId: active[0].provider_order_id },
  "an expiration targets the signed Coin product from the previous ledger row"
);
assert.equal(
  resolveTerminalSubscriptionTarget({
    productId: "unknown_product",
    previous: previousSubscriptions,
    current: [globalEntitlement]
  }),
  null,
  "unknown signed products cannot create terminal analytics events"
);

console.log("RevenueCat webhook, lifecycle, and identity matrix passed.");
