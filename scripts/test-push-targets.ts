import assert from "node:assert/strict";
import {
  perpetualAlertContextFromPushData,
  resolvePushTargetPath,
  sanitizePushTargetPath
} from "../src/lib/pushTargetPath";
import { allowsPerpetualPushMarket, isPerpetualSnapshotScopedStateCurrent, journalMonitorIdForSnapshot, monitorLinksSnapshot, pendingEventNeedsDelivery, perpetualPushDeliveryStatus } from "../src/lib/perpetualMonitor";
import {
  isPerpetualSnapshotGenerationEnabled,
  shouldRunPerpetualRevenueMaintenance
} from "../src/lib/server/perpetualRevenueCore";
import { collectPaginatedRows } from "../src/lib/pagination";
import { readOptionalJson } from "../src/lib/server/push/optionalJson";
import { resolvePushScannerOrigin } from "../src/lib/server/push/scannerOrigin";

const payload = {
  type: "perpetual_scenario",
  destination: "perpetual_snapshot",
  asset: "btc",
  snapshotId: "70000000-0000-4000-8000-000000000001",
  monitorId: "70000000-0000-4000-8000-000000000002",
  conditionId: "perpetual-v1:btc:primary",
  targetPath: "https://example.invalid/steal"
};
assert.equal(
  resolvePushTargetPath(payload),
  "/crypto/perpetual?asset=btc&snapshot=70000000-0000-4000-8000-000000000001&source=alert"
);
assert.deepEqual(perpetualAlertContextFromPushData(payload), {
  asset: "btc",
  snapshotId: payload.snapshotId,
  monitorId: payload.monitorId,
  conditionId: payload.conditionId
});

assert.equal(resolvePushTargetPath({ ...payload, asset: "doge" }), "/alerts");
assert.equal(resolvePushTargetPath({ ...payload, snapshotId: "not-a-uuid" }), "/alerts");
assert.equal(resolvePushTargetPath({ ...payload, monitorId: "not-a-uuid" }), "/alerts");
assert.equal(resolvePushTargetPath({ ...payload, asset: "doge", targetPath: "/crypto" }), "/alerts");
assert.equal(
  resolvePushTargetPath({ ...payload, type: "other", destination: "other", targetPath: "/crypto" }),
  "/crypto"
);
assert.equal(sanitizePushTargetPath("//evil.invalid"), null);
assert.equal(sanitizePushTargetPath("/crypto\\evil"), null);

const now = Date.now();
assert.equal(pendingEventNeedsDelivery({ delivery_status: "pending", delivery_lease_until: null }, now), true);
assert.equal(pendingEventNeedsDelivery({ delivery_status: "failed", delivery_lease_until: null }, now), true);
assert.equal(pendingEventNeedsDelivery({ delivery_status: "sending", delivery_lease_until: new Date(now - 1_000).toISOString() }, now), true);
assert.equal(pendingEventNeedsDelivery({ delivery_status: "sending", delivery_lease_until: new Date(now + 1_000).toISOString() }, now), false);
assert.equal(pendingEventNeedsDelivery({ delivery_status: "sent", delivery_lease_until: null }, now), false);
assert.equal(allowsPerpetualPushMarket(null), true, "legacy tokens without scoped markets remain eligible");
assert.equal(allowsPerpetualPushMarket([]), true);
assert.equal(allowsPerpetualPushMarket(["crypto"]), true);
assert.equal(allowsPerpetualPushMarket(["stocks"]), false, "a global-only token must not receive a crypto scenario push");
assert.equal(perpetualPushDeliveryStatus(0, 0), "in_app_only", "a monitor without FCM tokens must still complete as an in-app alert");
assert.equal(perpetualPushDeliveryStatus(2, 2), "sent");
assert.equal(perpetualPushDeliveryStatus(2, 1), "partial");
assert.equal(perpetualPushDeliveryStatus(2, 0), "failed");

const monitorLink = {
  snapshot_id: "70000000-0000-4000-8000-000000000010",
  last_snapshot_id: payload.snapshotId
};
assert.equal(monitorLinksSnapshot(monitorLink, payload.snapshotId), false);
assert.equal(
  monitorLinksSnapshot(monitorLink, payload.snapshotId, true),
  true,
  "alert Journal and scenario events must accept the evaluated trigger snapshot"
);
assert.equal(
  journalMonitorIdForSnapshot("snapshot-current", { monitorId: "monitor-current", snapshotId: "snapshot-current" }, null, false),
  "monitor-current",
  "Journal may link a monitor created from the current snapshot"
);
assert.equal(
  journalMonitorIdForSnapshot("snapshot-refreshed", { monitorId: "monitor-old", snapshotId: "snapshot-old" }, null, false),
  null,
  "Journal must not link a monitor from an older refreshed snapshot"
);
assert.equal(
  journalMonitorIdForSnapshot("snapshot-alert", null, "monitor-alert", true),
  "monitor-alert",
  "exact alert continuity may preserve its monitor link"
);
assert.equal(
  journalMonitorIdForSnapshot("snapshot-refreshed", null, "monitor-alert", false),
  null,
  "refreshed alert continuity must drop its stale monitor link"
);
assert.equal(isPerpetualSnapshotScopedStateCurrent("snapshot-a", { snapshotId: "snapshot-a" }), true);
assert.equal(
  isPerpetualSnapshotScopedStateCurrent("snapshot-b", { snapshotId: "snapshot-a" }),
  false,
  "a Journal result from snapshot A must not appear as the saved state for refreshed snapshot B"
);

assert.equal(isPerpetualSnapshotGenerationEnabled("off"), false, "off must be a real snapshot generation kill switch");
assert.equal(isPerpetualSnapshotGenerationEnabled("shadow"), true);
assert.equal(shouldRunPerpetualRevenueMaintenance("shadow"), true, "shadow data must still receive retention maintenance");
assert.equal(shouldRunPerpetualRevenueMaintenance("off"), true, "retention must continue after the feature kill switch is turned off");
assert.equal(
  resolvePushScannerOrigin("https://protected-deployment.vercel.app/api/push-cron", "https://chartradar.kr/", "production"),
  "https://chartradar.kr",
  "production optional sources must use the public canonical host"
);
assert.equal(
  resolvePushScannerOrigin("http://127.0.0.1:3000/api/push-cron", undefined, "development"),
  "http://127.0.0.1:3000",
  "local development may self-fetch its request origin"
);
assert.throws(
  () => resolvePushScannerOrigin("https://protected-deployment.vercel.app/api/push-cron", "http://chartradar.kr", "production"),
  /canonical HTTPS production host/
);
assert.throws(
  () => resolvePushScannerOrigin("https://protected-deployment.vercel.app/api/push-cron", "https://chartradar.ai", "production"),
  /canonical HTTPS production host/
);
assert.throws(
  () => resolvePushScannerOrigin("https://protected-deployment.vercel.app/api/push-cron", "not a URL", "production"),
  /Invalid URL/
);

const paginationSource = Array.from({ length: 1_001 }, (_, index) => index);
const pageOffsets: number[] = [];
async function runAsyncAssertions() {
  const paginated = await collectPaginatedRows(async (offset, limit) => {
    pageOffsets.push(offset);
    return paginationSource.slice(offset, offset + limit);
  }, 500);
  assert.equal(paginated.length, 1_001, "service-role scans must not silently stop at the REST 1,000-row boundary");
  assert.deepEqual(pageOffsets, [0, 500, 1_000]);

  const jsonPayload = await readOptionalJson<{ briefing?: { headline?: string } }>(new Response(
    JSON.stringify({ briefing: { headline: "fixture headline" } }),
    { status: 200, headers: { "content-type": "application/json; charset=utf-8" } }
  ), "radar-news-crypto");
  assert.equal(jsonPayload?.briefing?.headline, "fixture headline", "a JSON optional source must remain readable");
  await assert.rejects(
    () => readOptionalJson(new Response("<!doctype html><title>Vercel Login</title>", {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" }
    }), "radar-news-crypto"),
    /non-JSON response/,
    "deployment protection HTML must be reported as a controlled optional-source failure"
  );

  console.log("Structured Perpetual push target and delivery recovery contract passed.");
}

void runAsyncAssertions().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
