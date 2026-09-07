import assert from "node:assert/strict";
import { browserAlertStorageKey, freshBrowserPerpetualAlerts, parseBrowserAlertLedger, BROWSER_ALERT_MAX_AGE_MS } from "../src/lib/browserPerpetualAlerts";
import { resolvePushTargetPath } from "../src/lib/pushTargetPath";

const now = Date.parse("2026-09-07T06:00:00Z");
const ledger = { enabledAt: now - 300_000, checkedAt: 0, delivered: ["seen"] };
const event = {
  id: "fresh", title: "BTC 조건 변화", body: "판단 상태가 달라졌습니다.", created_at: new Date(now - 1_000).toISOString(),
  payload: { type: "perpetual_scenario", destination: "perpetual_snapshot", asset: "btc", snapshotId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", monitorId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" }
};
const events = [
  event, event, { ...event, id: "seen" }, { ...event, id: "read", read_at: new Date(now).toISOString() },
  { ...event, id: "old", created_at: new Date(now - BROWSER_ALERT_MAX_AGE_MS - 1).toISOString() },
  { ...event, id: "before-enable", created_at: new Date(ledger.enabledAt - 1).toISOString() },
  { ...event, id: "future", created_at: new Date(now + 60_000).toISOString() },
  { ...event, id: "invalid-date", created_at: "bad" },
  { ...event, id: "invalid-target", payload: { ...event.payload, snapshotId: "https://evil.invalid" } },
  { ...event, id: "other-type", payload: { type: "news_impact" } }, null, 1
];
assert.deepEqual(freshBrowserPerpetualAlerts(events, ledger, now).map(item => item.id), ["fresh"]);
assert.deepEqual(freshBrowserPerpetualAlerts([event], parseBrowserAlertLedger(null, now), now), [], "first enable does not replay old alerts");
assert.deepEqual(parseBrowserAlertLedger("bad", now), { enabledAt: now, checkedAt: 0, delivered: [] });
assert.equal(parseBrowserAlertLedger(JSON.stringify({ ...ledger, checkedAt: now + 1 }), now).checkedAt, 0, "clock rollback must not block polling");
assert.notEqual(browserAlertStorageKey("account-a"), browserAlertStorageKey("account-b"));
const restored = parseBrowserAlertLedger(JSON.stringify({ ...ledger, delivered: [...ledger.delivered, event.id] }), now);
assert.deepEqual(freshBrowserPerpetualAlerts([event], restored, now), [], "reload and other tabs do not deliver twice");
assert.equal(resolvePushTargetPath(event.payload), "/crypto/perpetual?asset=btc&snapshot=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb&source=alert");
console.log("PASS browser alerts: fresh unread server events, age/baseline, duplicate/reload, account isolation, safe historical target");
