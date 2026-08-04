import type { MacroEventItem } from "@/data/macroEvents";

const upcomingPriorityWindowMs = 24 * 60 * 60 * 1000;
const releasedPriorityWindowMs = 2 * 60 * 60 * 1000;

export function kstDateKey(input: number | string | Date) {
  const date = input instanceof Date ? input : new Date(input);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function isSameKstDate(input: number | string | Date, now: number | string | Date = Date.now()) {
  return kstDateKey(input) === kstDateKey(now);
}

export function isHighImpactMacroEvent(item: Pick<MacroEventItem, "importance" | "label">) {
  const lower = item.label.toLowerCase();
  return (
    item.importance === 3 ||
    lower.includes("cpi") ||
    lower.includes("fomc") ||
    lower.includes("fed") ||
    lower.includes("rate") ||
    lower.includes("payroll") ||
    lower.includes("non-farm") ||
    lower.includes("nonfarm") ||
    lower.includes("employment") ||
    lower.includes("jobless") ||
    lower.includes("unemployment") ||
    lower.includes("claims") ||
    lower.includes("ppi") ||
    lower.includes("pce") ||
    lower.includes("gdp")
  );
}

export function ensureNearestHighImpactUpcoming<
  T extends Pick<MacroEventItem, "importance" | "label" | "releaseAt">
>(sortedUpcoming: T[], selectedUpcoming: T[], limit: number) {
  if (limit <= 0) return [];
  const nearestHighImpact = sortedUpcoming.find(isHighImpactMacroEvent);
  if (!nearestHighImpact) return selectedUpcoming.slice(0, limit);
  const alreadySelected = selectedUpcoming.some(
    (item) => item.label === nearestHighImpact.label && item.releaseAt === nearestHighImpact.releaseAt
  );
  if (alreadySelected) return selectedUpcoming.slice(0, limit);
  return [...selectedUpcoming.slice(0, limit - 1), nearestHighImpact]
    .sort((left, right) => Date.parse(left.releaseAt) - Date.parse(right.releaseAt));
}

export function isHomePriorityMacro(
  item: Pick<MacroEventItem, "importance" | "label" | "releaseAt">,
  now = Date.now()
) {
  if (!isHighImpactMacroEvent(item)) return false;
  const releaseAt = Date.parse(item.releaseAt);
  if (!Number.isFinite(releaseAt)) return false;
  const diff = releaseAt - now;
  return (
    (diff > 0 && diff <= upcomingPriorityWindowMs) ||
    (diff <= 0 && diff >= -releasedPriorityWindowMs)
  );
}
