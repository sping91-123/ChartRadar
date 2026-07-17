import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyRevenueCatWebhookSignature } from "../src/lib/server/revenueCatWebhook";
import {
  buildRevenueCatSnapshot,
  extractRevenueCatWebhookUserIds,
  RevenueCatSnapshotError
} from "../src/lib/server/revenueCatSnapshot";

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
assert.deepEqual(
  buildRevenueCatSnapshot(snapshot({ billing_issues_detected_at: observedAt }), observedAt),
  [],
  "billing issues are past_due and fail closed immediately"
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

const sourceId = "00000000-0000-4000-8000-000000000001";
const currentId = "00000000-0000-4000-8000-000000000002";
const targetId = "00000000-0000-4000-8000-000000000003";
assert.deepEqual(
  extractRevenueCatWebhookUserIds({
    transferred_from: [sourceId],
    app_user_id: currentId,
    aliases: ["$RCAnonymousID:ignored", currentId],
    transferred_to: [targetId]
  }),
  [sourceId, currentId, targetId],
  "transfer sources must reconcile before destinations"
);

console.log("RevenueCat webhook, lifecycle, and identity matrix passed.");
