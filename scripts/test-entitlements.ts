import assert from "node:assert/strict";
import { resolveEffectiveEntitlement } from "../src/lib/effectiveEntitlement";

const now = "2026-07-16T00:00:00.000Z";
const later = "2026-07-17T00:00:00.000Z";
const ended = "2026-07-16T00:00:00.000Z";

function row(overrides: Record<string, unknown> = {}) {
  return {
    status: "active",
    plan: "crypto_monthly" as const,
    market_scope: "crypto" as const,
    current_period_end: later,
    revoked_at: null,
    provider: "revenuecat",
    ...overrides
  };
}

assert.equal(resolveEffectiveEntitlement({ isAuthenticated: false, now }).state, "anonymous");
assert.equal(resolveEffectiveEntitlement({ isAuthenticated: true, now }).state, "basic");
assert.equal(resolveEffectiveEntitlement({ isAuthenticated: true, unavailable: true, now }).state, "unavailable");
assert.equal(resolveEffectiveEntitlement({ isAuthenticated: true, deletionPending: true, now }).state, "deletion_pending");

for (const status of ["past_due", "refunded", "revoked", "expired", "inactive"]) {
  const result = resolveEffectiveEntitlement({ isAuthenticated: true, subscriptions: [row({ status })], now });
  assert.equal(result.state, "basic", `${status} must fail closed`);
}

for (const status of ["trialing", "active", "canceled"]) {
  const result = resolveEffectiveEntitlement({ isAuthenticated: true, subscriptions: [row({ status })], now });
  assert.equal(result.marketAccess.crypto, true, `${status} with remaining time must stay active`);
}

assert.equal(
  resolveEffectiveEntitlement({ isAuthenticated: true, subscriptions: [row({ current_period_end: ended })], now }).state,
  "basic",
  "end == now must be expired"
);
assert.equal(
  resolveEffectiveEntitlement({ isAuthenticated: true, subscriptions: [row({ revoked_at: now })], now }).state,
  "basic",
  "revoked_at must override an otherwise active row"
);
assert.equal(
  resolveEffectiveEntitlement({
    isAuthenticated: true,
    subscriptions: [row(), row({ plan: "stocks_monthly", market_scope: "stocks" })],
    now
  }).displayPlan,
  "All Market Pro",
  "separate Coin and Global rows must combine without a synthetic stored bundle"
);
assert.equal(
  resolveEffectiveEntitlement({
    isAuthenticated: true,
    subscriptions: [row({ plan: "premium", market_scope: "bundle", provider: "legacy_beta" })],
    now
  }).displayPlan,
  "All Market Pro 베타 혜택"
);
assert.deepEqual(
  resolveEffectiveEntitlement({ isAuthenticated: true, isAdmin: true, now }).marketAccess,
  { crypto: true, stocks: true }
);

console.log("Effective entitlement matrix passed.");
