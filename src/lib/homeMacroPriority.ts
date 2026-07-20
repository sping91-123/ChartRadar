import type { MacroEventItem } from "@/data/macroEvents";

const upcomingPriorityWindowMs = 24 * 60 * 60 * 1000;
const releasedPriorityWindowMs = 2 * 60 * 60 * 1000;

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
