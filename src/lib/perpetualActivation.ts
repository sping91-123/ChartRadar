import type { PerpetualAsset } from "./perpetualDecisionSnapshot";
import type { PerpetualScenarioMonitor } from "./perpetualMonitor";

export function homePerpetualHref(asset: PerpetualAsset, snapshotId: string, attributionId: string | null, focusMonitor = false) {
  const query = new URLSearchParams({ asset, timeframe: "15m", snapshot: snapshotId, source: "home" });
  if (attributionId) query.set("attribution", attributionId);
  return `/crypto/perpetual?${query.toString()}${focusMonitor ? "#monitor-condition" : ""}`;
}

export function findSavedCondition(monitors: PerpetualScenarioMonitor[], asset: PerpetualAsset, conditionId: string, now = Date.now()) {
  return monitors.find((monitor) => monitor.asset === asset && monitor.conditionId === conditionId &&
    ["active", "paused", "paused_entitlement"].includes(monitor.status) && Date.parse(monitor.expiresAt) > now);
}
