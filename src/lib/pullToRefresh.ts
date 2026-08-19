export const pullToRefreshSlopPx = 8;
export const pullToRefreshThresholdPx = 72;
export const pullToRefreshMaxVisualPx = 64;

export type PullGestureState = "pending" | "cancelled" | "pulling" | "armed";

export interface PullGestureProgress {
  state: PullGestureState;
  visualDistance: number;
}

export type PullGestureEndAction = "ignore" | "cancel" | "refresh";

export function canStartPullToRefresh({
  scrollTop,
  touchCount,
  refreshing,
  blocked
}: {
  scrollTop: number;
  touchCount: number;
  refreshing: boolean;
  blocked: boolean;
}) {
  return scrollTop <= 1 && touchCount === 1 && !refreshing && !blocked;
}

export function pullGestureProgress({
  startX,
  startY,
  currentX,
  currentY
}: {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}): PullGestureProgress {
  const deltaX = Math.abs(currentX - startX);
  const deltaY = currentY - startY;

  if (deltaY <= 0) return { state: "cancelled", visualDistance: 0 };
  if (deltaX > deltaY && Math.max(deltaX, deltaY) >= pullToRefreshSlopPx) {
    return { state: "cancelled", visualDistance: 0 };
  }
  if (deltaY < pullToRefreshSlopPx) return { state: "pending", visualDistance: 0 };

  const visualDistance = Math.min(
    pullToRefreshMaxVisualPx,
    Math.max(0, (deltaY - pullToRefreshSlopPx) * 0.55)
  );
  return {
    state: deltaY >= pullToRefreshThresholdPx ? "armed" : "pulling",
    visualDistance
  };
}

export function pullGestureEndAction({
  active,
  armed,
  remainingTouchCount
}: {
  active: boolean;
  armed: boolean;
  remainingTouchCount: number;
}): PullGestureEndAction {
  if (!active) return "ignore";
  if (remainingTouchCount > 0) return "cancel";
  return armed ? "refresh" : "cancel";
}

export function shouldEnablePerpetualPullRefresh({
  initialContinuityAvailable,
  activeAsset,
  initialAsset,
  initialSource
}: {
  initialContinuityAvailable: boolean;
  activeAsset: string;
  initialAsset: string;
  initialSource: "home" | "alert" | "news" | null;
}) {
  return !(
    initialContinuityAvailable
    && activeAsset === initialAsset
    && (initialSource === "alert" || initialSource === "news")
  );
}

export function isResolvedHistoricalPullLocked({
  source,
  continuityStatus,
  hasNewsContext
}: {
  source: "home" | "alert" | "news" | null;
  continuityStatus: string;
  hasNewsContext: boolean;
}) {
  if (source === "alert") return continuityStatus === "same";
  if (source === "news") return continuityStatus === "same" && hasNewsContext;
  return false;
}

export function isPullRefreshHandlerVersionCurrent(startVersion: number, currentVersion: number) {
  return startVersion === currentVersion;
}
