import assert from "node:assert/strict";
import { buildPerpetualBetaReport, kstStudyWindow } from "./perpetual-beta-report-core.mjs";

const startDateKst = "2026-07-21";
const window = kstStudyWindow(startDateKst);
assert.equal(window.start.toISOString(), "2026-07-20T15:00:00.000Z");
assert.equal(window.week2Start.toISOString(), "2026-07-27T15:00:00.000Z");
assert.equal(window.end.toISOString(), "2026-08-03T15:00:00.000Z");

const cohortRows = Array.from({ length: 12 }, (_, index) => ({
  user_id: `user-${index + 1}`,
  current_period_end: "2026-08-20T00:00:00.000Z"
}));
const snapshot = { id: "snapshot-1", asset: "btc", quality: "ready" };
const events = [
  { event_id: "e1", event_name: "home_snapshot_viewed", user_id: "user-1", asset: "btc", snapshot_id: snapshot.id, attribution_id: null, properties: { mode: "on" }, occurred_at: "2026-07-20T15:00:00.000Z" },
  { event_id: "e2", event_name: "perpetual_snapshot_viewed", user_id: "user-1", asset: "btc", snapshot_id: snapshot.id, attribution_id: null, properties: {}, occurred_at: "2026-07-21T15:00:00.000Z" },
  { event_id: "e3", event_name: "scenario_opened", user_id: "user-1", asset: "btc", snapshot_id: snapshot.id, attribution_id: null, properties: { source: "alert_refreshed" }, occurred_at: "2026-07-22T15:00:00.000Z" },
  { event_id: "e4", event_name: "home_perpetual_opened", user_id: "user-1", asset: "btc", snapshot_id: snapshot.id, attribution_id: "journey-1", properties: {}, occurred_at: "2026-07-23T00:00:00.000Z" },
  { event_id: "e5", event_name: "perpetual_snapshot_viewed", user_id: "user-1", asset: "btc", snapshot_id: snapshot.id, attribution_id: "journey-1", properties: {}, occurred_at: "2026-07-23T00:01:00.000Z" },
  { event_id: "e6", event_name: "home_snapshot_viewed", user_id: "user-1", asset: "btc", snapshot_id: snapshot.id, attribution_id: null, properties: { mode: "on" }, occurred_at: "2026-07-27T15:00:00.000Z" },
  { event_id: "e7", event_name: "perpetual_snapshot_viewed", user_id: "user-1", asset: "btc", snapshot_id: snapshot.id, attribution_id: null, properties: {}, occurred_at: "2026-07-28T15:00:00.000Z" },
  { event_id: "e8", event_name: "scenario_opened", user_id: "user-1", asset: "btc", snapshot_id: snapshot.id, attribution_id: null, properties: {}, occurred_at: "2026-07-29T15:00:00.000Z" },
  { event_id: "e9", event_name: "home_snapshot_viewed", user_id: "user-2", asset: "btc", snapshot_id: snapshot.id, attribution_id: null, properties: { mode: "shadow" }, occurred_at: "2026-07-20T16:00:00.000Z" }
];
const report = buildPerpetualBetaReport({
  startDateKst,
  now: new Date("2026-08-03T15:00:00.000Z"),
  cohortRows,
  events,
  snapshots: [snapshot],
  monitors: [{ user_id: "user-1", snapshot_id: snapshot.id, created_at: "2026-07-22T00:00:00.000Z" }],
  journals: [],
  deploymentSha: "a".repeat(40)
});
assert.equal(report.gates.cohortExactly12, true);
assert.equal(report.gates.entitlementCoversStudy, true);
assert.equal(report.gates.finalAvailable, true);
assert.equal(report.funnel.readySnapshotTwoDays, 1);
assert.equal(report.funnel.monitorCreated, 1);
assert.equal(report.funnel.alertOpenedOrJournalSaved, 1);
assert.equal(report.funnel.activated, 1);
assert.equal(report.funnel.week2ThreeDays, 1);
assert.equal(report.funnel.homeToPerpetualSameJourney, 1);
assert.equal(report.study.deploymentSha, "a".repeat(40));

const early = buildPerpetualBetaReport({ startDateKst, now: new Date("2026-07-25T00:00:00.000Z"), cohortRows });
assert.equal(early.gates.finalAvailable, false);
const badCohort = buildPerpetualBetaReport({ startDateKst, now: window.end, cohortRows: cohortRows.slice(0, 11) });
assert.equal(badCohort.gates.cohortExactly12, false);
const earlyExpiry = buildPerpetualBetaReport({
  startDateKst,
  now: window.end,
  cohortRows: cohortRows.map((row, index) => index === 0 ? { ...row, current_period_end: "2026-08-01T00:00:00.000Z" } : row)
});
assert.equal(earlyExpiry.gates.entitlementCoversStudy, false);

console.log("Perpetual beta KST boundary, funnel, retention, and privacy-safe aggregate matrix passed.");
