import type { NewsImpactEvent } from "./newsImpact";

const importanceRank = { critical: 3, high: 2, normal: 1 } as const;
const reactionRank = {
  risk_increase: 7,
  decision_state_changed: 7,
  conflicts_with_existing_state: 7,
  supports_existing_state: 6,
  pending: 5,
  no_material_reaction: 4,
  insufficient_data: 1
} as const;
const ONE_DAY_MS = 24 * 60 * 60_000;

function eventUsefulnessRank(event: NewsImpactEvent) {
  if (event.reaction) return reactionRank[event.reaction.classification];
  if (event.reactionEligibility === "context_only") return 1;
  return event.category === "corporate_sector" && event.importance === "normal" ? 2 : 3;
}

export function isMeaningfulNewsImpactLead(event: NewsImpactEvent) {
  if (event.reactionEligibility === "context_only") {
    return event.importance === "critical";
  }
  if (event.importance !== "normal" || event.category !== "corporate_sector") return true;
  return Boolean(
    event.reaction &&
    !["insufficient_data", "no_material_reaction"].includes(event.reaction.classification)
  );
}

export function selectMeaningfulNewsImpactEvent(events: NewsImpactEvent[]) {
  return events.find(isMeaningfulNewsImpactLead) ?? null;
}

export function sortNewsImpactEvents(events: NewsImpactEvent[], nowMs = Date.now()) {
  return [...events].sort((left, right) => {
    const leftAge = nowMs - Date.parse(left.occurredAt);
    const rightAge = nowMs - Date.parse(right.occurredAt);
    const leftRecent = leftAge >= -5 * 60_000 && leftAge <= ONE_DAY_MS ? 1 : 0;
    const rightRecent = rightAge >= -5 * 60_000 && rightAge <= ONE_DAY_MS ? 1 : 0;
    const recent = rightRecent - leftRecent;
    if (recent) return recent;
    const usefulness = eventUsefulnessRank(right) - eventUsefulnessRank(left);
    if (usefulness) return usefulness;
    const importance = importanceRank[right.importance] - importanceRank[left.importance];
    return importance || right.occurredAt.localeCompare(left.occurredAt) || right.id.localeCompare(left.id);
  });
}
