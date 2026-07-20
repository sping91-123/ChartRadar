import assert from "node:assert/strict";
import {
  isClientProductEventName,
  isProductEventSurface,
  sanitizeProductEventProperties,
  selectRecentPurchaseAttribution
} from "../src/lib/productEvents";
import { anonymousProductRateKey, hashAnonymousProductId } from "../src/lib/server/productEventPrivacy";

assert.equal(isClientProductEventName("home_snapshot_viewed"), true);
assert.equal(isClientProductEventName("entitlement_activated"), false, "server-authoritative events must not be accepted from clients");
assert.equal(isClientProductEventName("monitor_created"), false);
assert.equal(isProductEventSurface("perpetual"), true);
assert.equal(isProductEventSurface("admin"), false);

assert.deepEqual(
  sanitizeProductEventProperties("monitor_failed", {
    code: "monitor_limit_reached",
    conditionRole: "primary",
    source: "perpetual",
    token: "must-not-survive",
    free_text: "must-not-survive",
    nested: { token: "must-not-survive" },
    list: ["must-not-survive"]
  }),
  {
    code: "monitor_limit_reached",
    conditionRole: "primary",
    source: "perpetual"
  }
);

assert.deepEqual(
  sanitizeProductEventProperties("home_snapshot_viewed", {
    quality: "ready",
    mode: "shadow",
    agreement: "mismatch",
    symbol: "must-not-survive"
  }),
  { quality: "ready", mode: "shadow", agreement: "mismatch" }
);

assert.deepEqual(
  sanitizeProductEventProperties("scenario_opened", {
    source: "alert_refreshed",
    snapshot: "must-not-survive"
  }),
  { source: "alert_refreshed" }
);

const attributionNow = Date.parse("2026-07-20T00:30:00.000Z");
const matchingAttribution = "61000000-0000-4000-8000-000000000001";
assert.equal(
  selectRecentPurchaseAttribution([
    {
      event_id: "61000000-0000-4000-8000-000000000002",
      occurred_at: "2026-07-19T23:00:00.000Z",
      properties: { provider: "revenuecat", planId: "crypto_monthly" }
    },
    {
      event_id: matchingAttribution,
      occurred_at: "2026-07-20T00:20:00.000Z",
      properties: { provider: "revenuecat", planId: "crypto_monthly" }
    }
  ], {
    provider: "revenuecat",
    planId: "crypto_monthly",
    now: attributionNow
  }),
  matchingAttribution,
  "verified entitlement activation must link to the recent matching purchase attempt"
);
assert.equal(
  selectRecentPurchaseAttribution([
    {
      event_id: matchingAttribution,
      occurred_at: "2026-07-20T00:20:00.000Z",
      properties: { provider: "revenuecat", planId: "stocks_monthly" }
    }
  ], {
    provider: "revenuecat",
    planId: "crypto_monthly",
    now: attributionNow
  }),
  null,
  "a different plan must not receive purchase attribution"
);

assert.deepEqual(
  sanitizeProductEventProperties("purchase_failed", {
    planId: "crypto_monthly",
    provider: "revenuecat",
    code: "network",
    source: "pro_page",
    order_id: "forbidden"
  }),
  { planId: "crypto_monthly", provider: "revenuecat", code: "network", source: "pro_page" }
);

process.env.PRODUCT_ANALYTICS_HMAC_SECRET = "product-event-test-secret";
const anonymousId = "60000000-0000-4000-8000-000000000001";
const firstHash = hashAnonymousProductId(anonymousId);
const secondHash = hashAnonymousProductId(anonymousId);
assert.equal(firstHash, secondHash);
assert.match(firstHash, /^[0-9a-f]{64}$/);
assert.equal(firstHash.includes(anonymousId), false, "the stored identifier must not contain the raw anonymous UUID");
assert.equal(anonymousProductRateKey(firstHash).includes(anonymousId), false, "anonymous rate limits must never use the raw device identifier");
assert.match(anonymousProductRateKey(firstHash), /^product-events:anonymous:[0-9a-f]{24}$/);

console.log("Product event allowlist, scalar sanitizer, and anonymous HMAC contract passed.");
