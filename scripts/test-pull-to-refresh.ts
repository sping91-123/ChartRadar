import assert from "node:assert/strict";
import {
  canStartPullToRefresh,
  isPullRefreshHandlerVersionCurrent,
  isResolvedHistoricalPullLocked,
  pullGestureEndAction,
  pullGestureProgress,
  pullToRefreshMaxVisualPx,
  shouldEnablePerpetualPullRefresh
} from "../src/lib/pullToRefresh";

assert.equal(canStartPullToRefresh({ scrollTop: 0, touchCount: 1, refreshing: false, blocked: false }), true);
assert.equal(canStartPullToRefresh({ scrollTop: 2, touchCount: 1, refreshing: false, blocked: false }), false, "mid-page pulls must not refresh");
assert.equal(canStartPullToRefresh({ scrollTop: 0, touchCount: 2, refreshing: false, blocked: false }), false, "pinch gestures must not refresh");
assert.equal(canStartPullToRefresh({ scrollTop: 0, touchCount: 1, refreshing: true, blocked: false }), false, "refresh must be single-flight");
assert.equal(canStartPullToRefresh({ scrollTop: 0, touchCount: 1, refreshing: false, blocked: true }), false, "interactive targets must be ignored");

assert.equal(pullGestureProgress({ startX: 10, startY: 20, currentX: 10, currentY: 26 }).state, "pending");
assert.equal(pullGestureProgress({ startX: 10, startY: 20, currentX: 10, currentY: 18 }).state, "cancelled", "upward gestures must remain normal scrolling");
assert.equal(pullGestureProgress({ startX: 10, startY: 20, currentX: 40, currentY: 35 }).state, "cancelled", "horizontal chart gestures must not refresh");
assert.equal(pullGestureProgress({ startX: 10, startY: 20, currentX: 14, currentY: 70 }).state, "pulling");
assert.equal(pullGestureProgress({ startX: 10, startY: 20, currentX: 14, currentY: 92 }).state, "armed");
assert.equal(
  pullGestureProgress({ startX: 0, startY: 0, currentX: 0, currentY: 1_000 }).visualDistance,
  pullToRefreshMaxVisualPx,
  "indicator travel must stay capped"
);

assert.equal(
  pullGestureEndAction({ active: false, armed: false, remainingTouchCount: 0 }),
  "ignore",
  "unrelated touchend events must not unlock an active refresh"
);
assert.equal(
  pullGestureEndAction({ active: true, armed: true, remainingTouchCount: 1 }),
  "cancel",
  "multi-touch sequences must not refresh"
);
assert.equal(
  pullGestureEndAction({ active: true, armed: false, remainingTouchCount: 0 }),
  "cancel"
);
assert.equal(
  pullGestureEndAction({ active: true, armed: true, remainingTouchCount: 0 }),
  "refresh"
);

assert.equal(shouldEnablePerpetualPullRefresh({
  initialContinuityAvailable: true,
  activeAsset: "btc",
  initialAsset: "btc",
  initialSource: "alert"
}), false, "linked alert snapshots must remain immutable");
assert.equal(shouldEnablePerpetualPullRefresh({
  initialContinuityAvailable: true,
  activeAsset: "eth",
  initialAsset: "btc",
  initialSource: "news"
}), true, "switching assets leaves the linked historical context");
assert.equal(shouldEnablePerpetualPullRefresh({
  initialContinuityAvailable: false,
  activeAsset: "btc",
  initialAsset: "btc",
  initialSource: "news"
}), true, "expired continuity may return to live refresh");

assert.equal(isResolvedHistoricalPullLocked({
  source: "alert",
  continuityStatus: "same",
  hasNewsContext: false
}), true);
assert.equal(isResolvedHistoricalPullLocked({
  source: "news",
  continuityStatus: "same",
  hasNewsContext: false
}), false, "missing news context must unlock the now-live screen");
assert.equal(isResolvedHistoricalPullLocked({
  source: "news",
  continuityStatus: "refreshed",
  hasNewsContext: true
}), false, "refreshed news links must unlock live pull-to-refresh");
assert.equal(isPullRefreshHandlerVersionCurrent(4, 4), true);
assert.equal(
  isPullRefreshHandlerVersionCurrent(4, 5),
  false,
  "a screen change during refresh must suppress the old handler result"
);

console.log("Pull-to-refresh gesture contract passed.");
