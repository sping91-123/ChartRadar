import assert from "node:assert/strict";
import { buildConversionHealth } from "./conversion-health-core.mjs";
const startAt = "2026-08-01T00:00:00Z", endAt = "2026-09-06T00:00:00Z";
let id = 0;
const event = (event_name, occurred_at, extra = {}) => ({ event_id: String(++id), event_name, occurred_at, traffic_class: "user", user_id: "mature", funnel_session_hash: "session-1", ...extra });
const rows = [
  event("paywall_viewed", "2026-08-01T01:00:00Z"),
  event("pro_gate_viewed", "2026-08-01T02:00:00Z", { properties: { platform: "android" } }),
  event("paywall_viewed", "2026-08-01T03:00:00Z"),
  event("pro_gate_viewed", "2026-08-01T02:00:00Z", { user_id: "mature", funnel_session_hash: "session-2" }),
  event("home_snapshot_viewed", "2026-08-02T00:00:00Z"),
  event("verified_trial_started", "2026-08-03T00:00:00Z"),
  event("monitor_created", "2026-08-03T23:59:59Z"),
  event("trial_converted", "2026-08-17T00:00:00Z"),
  event("verified_trial_started", "2026-09-05T23:00:00Z", { user_id: "immature" }),
  event("pro_gate_viewed", "2026-08-02T00:00:00Z", { traffic_class: "internal", funnel_session_hash: "qa" }),
  event("pro_gate_viewed", "2026-08-02T00:00:00Z", { traffic_class: null, funnel_session_hash: "missing" }),
  event("purchase_failed", "2026-08-02T00:00:00Z", { properties: { category: "private-user-text" } })
];
const report = buildConversionHealth({ events: [...rows.slice().reverse(), rows[0]], startAt, endAt });
assert.deepEqual(report.gateToPaywallSessions, { numerator: 1, denominator: 2, rate: 0.5 });
assert.deepEqual(report.firstGatePlatformSessions, { android: 1, missing: 1 });
assert.deepEqual(report.loggedInHomeToMonitorUsers, { numerator: 1, denominator: 1, rate: 1 });
assert.deepEqual(report.firstMonitorWithin24h, { numerator: 1, denominator: 1, rate: 1 });
assert.deepEqual(report.matureD15PaidConversion, { numerator: 1, denominator: 1, rate: 1 });
assert.equal(report.immatureTrialUsers, 1);
assert.deepEqual(report.purchaseFailureCategories, { unclassified: 1 });
assert.equal(JSON.stringify(report).includes("private-user-text"), false);
assert.equal(JSON.stringify(report).includes("session-1"), false);
const earlyPaywall = buildConversionHealth({ events: rows.slice(0, 2), startAt, endAt });
assert.equal(earlyPaywall.gateToPaywallSessions.numerator, 0);
assert.equal(earlyPaywall.matureD15PaidConversion.rate, null);
assert.throws(() => buildConversionHealth({ events: [], startAt: "invalid", endAt }));
console.log("Conversion health: ordered sessions, internal exclusion, deduplication, maturity and privacy passed.");
