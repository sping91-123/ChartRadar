import type { DecisionState, SnapshotQuality } from "@/lib/perpetualDecisionSnapshot";

export type LegacyPerpetualDirection = "up" | "down" | "sideways";
export type PerpetualShadowAgreement = "agreement" | "mismatch" | "insufficient";

export function comparePerpetualShadowDecision({
  quality,
  state,
  legacyDirection
}: {
  quality: SnapshotQuality;
  state: DecisionState;
  legacyDirection: LegacyPerpetualDirection | null | undefined;
}): PerpetualShadowAgreement {
  if (quality !== "ready" || state === "risk" || !legacyDirection) return "insufficient";
  const newDirection: LegacyPerpetualDirection = state === "upside_watch"
    ? "up"
    : state === "downside_watch"
      ? "down"
      : "sideways";
  return newDirection === legacyDirection ? "agreement" : "mismatch";
}
