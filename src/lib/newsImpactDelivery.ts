export type NewsDeliveryStatus = "pending" | "sending" | "sent" | "partial" | "failed" | "in_app_only";

function stageRank(stage: "detected" | "provisional_15m" | "final_60m") {
  return stage === "final_60m" ? 3 : stage === "provisional_15m" ? 2 : 1;
}

export function selectLatestNewsReaction<T extends {
  stage: "detected" | "provisional_15m" | "final_60m";
  created_at: string;
}>(rows: T[]) {
  return [...rows].sort((left, right) => (
    stageRank(right.stage) - stageRank(left.stage) || Date.parse(right.created_at) - Date.parse(left.created_at)
  ))[0] ?? null;
}

export function remainingNewsPushTargets<T extends { id: string }>(targets: T[], succeededTokenIds: readonly string[]) {
  const succeeded = new Set(succeededTokenIds);
  return targets.filter((target) => !succeeded.has(target.id));
}

export function resolveNewsDeliveryStatus(input: {
  deliveryEnabled: boolean;
  targetCount: number;
  sentBefore: number;
  sentNow: number;
  failedNow: number;
  attempt: number;
  allowRetry?: boolean;
}): NewsDeliveryStatus {
  const totalSent = input.sentBefore + input.sentNow;
  if (!input.deliveryEnabled || input.targetCount === 0) return totalSent > 0 ? "partial" : "in_app_only";
  if (input.failedNow === 0) return "sent";
  if (input.allowRetry === false) return totalSent > 0 ? "partial" : "in_app_only";
  if (input.attempt < 3) return "failed";
  return totalSent > 0 ? "partial" : "in_app_only";
}
