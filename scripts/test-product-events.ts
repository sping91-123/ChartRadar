import assert from "node:assert/strict";
import {
  isClientProductEventName,
  isProductEventSurface,
  sanitizeProductEventProperties,
  selectRecentPurchaseAttribution
} from "../src/lib/productEvents";
import {
  anonymousProductRateKey,
  hashAnonymousProductId,
  hashFunnelSessionId,
  isInternalProductTester,
  verifyProductQaSignature
} from "../src/lib/server/productEventPrivacy";
import { createHmac } from "node:crypto";

assert.equal(isClientProductEventName("home_snapshot_viewed"), true);
assert.equal(isClientProductEventName("pro_cta_clicked"), true);
assert.equal(isClientProductEventName("store_purchase_succeeded"), true);
assert.equal(isClientProductEventName("entitlement_sync_pending"), true);
assert.equal(isClientProductEventName("verified_trial_started"), false);
assert.equal(isClientProductEventName("trial_converted"), false);
assert.equal(isClientProductEventName("entitlement_activated"), false, "server-authoritative events must not be accepted from clients");
assert.equal(isClientProductEventName("monitor_created"), false);
assert.equal(isProductEventSurface("perpetual"), true);
assert.equal(isProductEventSurface("alts"), true);
assert.equal(isProductEventSurface("scout"), true);
assert.equal(isProductEventSurface("watchlist"), true);
assert.equal(isProductEventSurface("news"), true);
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
  sanitizeProductEventProperties("news_impact_viewed", {
    market: "crypto",
    classification: "risk_increase",
    source: "news",
    headline: "must-not-survive",
    token: "must-not-survive"
  }),
  { market: "crypto", classification: "risk_increase", source: "news" }
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

const newestMatchingAttribution = "61000000-0000-4000-8000-000000000003";
assert.equal(
  selectRecentPurchaseAttribution([
    {
      event_id: matchingAttribution,
      occurred_at: "2026-07-20T00:10:00.000Z",
      properties: { provider: "revenuecat", planId: "crypto_monthly" }
    },
    {
      event_id: newestMatchingAttribution,
      occurred_at: "2026-07-20T00:25:00.000Z",
      properties: { provider: "revenuecat", planId: "bundle_monthly" }
    }
  ], {
    provider: "revenuecat",
    planIds: ["crypto_monthly", "bundle_monthly"],
    now: attributionNow
  }),
  newestMatchingAttribution,
  "the newest real store plan must win attribution without a synthetic bundle plan"
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
assert.equal(
  selectRecentPurchaseAttribution([
    {
      event_id: matchingAttribution,
      occurred_at: "2026-07-06T00:30:00.000Z",
      properties: { provider: "revenuecat", planId: "crypto_monthly" }
    }
  ], {
    provider: "revenuecat",
    planId: "crypto_monthly",
    now: attributionNow,
    maxAgeMs: 30 * 24 * 60 * 60 * 1000
  }),
  matchingAttribution,
  "a trial conversion may recover the originating funnel after the 14-day trial"
);

assert.deepEqual(
  sanitizeProductEventProperties("purchase_failed", {
    planId: "crypto_monthly",
    provider: "revenuecat",
    code: "network",
    source: "direct",
    placement: "direct_paywall",
    routeKey: "crypto_home",
    symbol: "BTCUSDT.P",
    offerId: "trial-14d",
    platform: "android",
    authState: "authenticated",
    variant: "coin-pro-v2",
    order_id: "forbidden"
  }),
  {
    planId: "crypto_monthly",
    provider: "revenuecat",
    code: "network",
    source: "direct",
    placement: "direct_paywall",
    routeKey: "crypto_home",
    symbol: "BTCUSDT.P",
    offerId: "trial-14d",
    platform: "android",
    authState: "authenticated",
    variant: "coin-pro-v2"
  }
);

assert.deepEqual(
  sanitizeProductEventProperties("paywall_viewed", {
    source: "https://evil.example/raw",
    placement: "unknown-placement",
    routeKey: "/raw/url",
    symbol: "BTC/USDT?token=secret",
    offerId: "trial 14 days",
    platform: "desktop",
    authState: "logged-in",
    variant: "experiment-secret",
    returnTo: "https://evil.example",
    email: "person@example.com"
  }),
  {},
  "funnel events must keep only allowlisted scalar values"
);

assert.deepEqual(
  sanitizeProductEventProperties("paywall_viewed", {
    source: "direct",
    placement: "direct_paywall",
    routeKey: "crypto_home",
    platform: "android",
    authState: "authenticated",
    offerId: "monthly:trial-14d",
    variant: "coin-pro-v2-trial-eligible"
  }),
  {
    source: "direct",
    placement: "direct_paywall",
    routeKey: "crypto_home",
    platform: "android",
    authState: "authenticated",
    offerId: "monthly:trial-14d",
    variant: "coin-pro-v2-trial-eligible"
  },
  "a store-resolved trial eligibility stamp must be reconstructable without free text"
);

assert.deepEqual(
  sanitizeProductEventProperties("purchase_failed", {
    planId: "person@example.com",
    provider: "https://evil.example/checkout",
    code: "010-1234-5678",
    stage: "person@example.com",
    source: "direct",
    placement: "direct_paywall",
    routeKey: "crypto_home"
  }),
  {
    source: "direct",
    placement: "direct_paywall",
    routeKey: "crypto_home"
  },
  "allowed property names must still reject email, URL, phone, and free-form values"
);
assert.deepEqual(
  sanitizeProductEventProperties("news_source_opened", {
    market: "crypto",
    source: "Federal Reserve https://example.com person@example.com"
  }),
  { market: "crypto" },
  "official source labels must not become a free-text analytics channel"
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

const funnelSessionId = "62000000-0000-4000-8000-000000000001";
const funnelHash = hashFunnelSessionId(funnelSessionId);
assert.match(funnelHash, /^[0-9a-f]{64}$/);
assert.notEqual(funnelHash, hashAnonymousProductId(funnelSessionId), "anonymous and funnel identifiers need domain separation");

process.env.PRODUCT_ANALYTICS_INTERNAL_USER_IDS = "user-a,user-b";
assert.equal(isInternalProductTester("user-a"), true);
assert.equal(isInternalProductTester("user-c"), false);
process.env.PRODUCT_ANALYTICS_QA_SECRET = "qa-event-test-secret";
const qaTimestamp = "1785552000";
const qaSignature = createHmac("sha256", process.env.PRODUCT_ANALYTICS_QA_SECRET)
  .update(`${qaTimestamp}.${funnelSessionId}`)
  .digest("hex");
assert.equal(
  verifyProductQaSignature({
    header: `t=${qaTimestamp},v1=${qaSignature}`,
    funnelSessionId,
    nowMs: Number(qaTimestamp) * 1000
  }),
  true
);
assert.equal(
  verifyProductQaSignature({
    header: `t=${qaTimestamp},v1=${qaSignature}`,
    funnelSessionId: "different-session",
    nowMs: Number(qaTimestamp) * 1000
  }),
  false
);

console.log("Product funnel allowlist, attribution, traffic classification, and 24-hour session HMAC contract passed.");
