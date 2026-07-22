import { type MacroEventItem } from "@/data/macroEvents";
import { type MacroValueProvenance } from "@/lib/macro/types";

const SAME_EVENT_WINDOW_MS = 5 * 60 * 1000;

function normalizedLabel(label: string) {
  return label
    .toLowerCase()
    .replace(/\bu\.?s\.?\b|\bunited states\b|미국/g, " ")
    .replace(/[^a-z0-9가-힣]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function semanticMacroEventFamily(label: string) {
  const normalized = normalizedLabel(label);

  if (
    /(?:4 week|four week|4주).*(?:average|평균).*(?:claims|실업수당)|(?:claims|실업수당).*(?:4 week|four week|4주).*(?:average|평균)/.test(normalized)
  ) {
    return "jobless-claims-four-week-average";
  }

  if (/continuing (?:jobless |unemployment )?claims|continued claims|계속 실업수당/.test(normalized)) {
    return "continuing-jobless-claims";
  }

  if (
    /initial (?:jobless |unemployment )?claims|jobless claims|unemployment claims|신규 실업수당 청구/.test(normalized)
  ) {
    return "initial-jobless-claims";
  }

  return normalized.replace(/\s+/g, "-") || "unknown-macro-event";
}

function usableValue(value: string | undefined) {
  const normalized = value?.trim();
  if (!normalized || /확인 예정|확인 필요|수집 지연|^n\/?a$/i.test(normalized)) return undefined;
  return normalized;
}

function sourceScore(item: MacroEventItem, index: number) {
  const typeScore =
    item.isOfficial && item.sourceType === "official_api"
      ? 500
      : item.isOfficial && item.sourceType === "official_page"
        ? 400
        : item.isOfficial
          ? 300
          : item.sourceType === "public_calendar"
            ? 100
            : 0;
  const actualScore = usableValue(item.actualValue ?? item.actual) ? 80 : 0;
  const confidenceScore = Math.round((item.confidence ?? 0) * 10);
  const importanceScore = item.importance;

  // Earlier adapters remain the deterministic tie breaker.
  return typeScore + actualScore + confidenceScore + importanceScore - index / 1_000;
}

function distinctValues(items: MacroEventItem[], selector: (item: MacroEventItem) => string | undefined) {
  const values = items.map(selector).map(usableValue).filter((value): value is string => Boolean(value));
  return Array.from(new Set(values));
}

function mergedValue(
  items: MacroEventItem[],
  preferred: MacroEventItem,
  selector: (item: MacroEventItem) => string | undefined,
  conflictLabel: string,
  preferOfficial: boolean
) {
  const preferredValue = usableValue(selector(preferred));
  if (preferOfficial) {
    const officialValues = distinctValues(
      items.filter((item) => item.isOfficial),
      selector
    );
    if (officialValues.length === 1) return officialValues[0];
    if (officialValues.length > 1) return conflictLabel;
  }

  const values = distinctValues(items, selector);
  if (values.length === 1) return values[0];
  if (values.length > 1) return conflictLabel;
  return preferredValue;
}

function canonicalLabel(family: string, fallback: string) {
  if (family === "initial-jobless-claims") return "Initial Jobless Claims";
  if (family === "continuing-jobless-claims") return "Continuing Jobless Claims";
  if (family === "jobless-claims-four-week-average") return "4-Week Average Jobless Claims";
  return fallback;
}

function mergedProvenance(
  items: MacroEventItem[],
  merged: string | undefined,
  valueSelector: (item: MacroEventItem) => string | undefined,
  provenanceSelector: (item: MacroEventItem) => MacroValueProvenance | undefined,
  preferOfficial: boolean
): MacroValueProvenance {
  if (!merged) return "unknown";
  if (/출처별 .* 상이/.test(merged)) return "mixed";
  const matching = items.filter((item) => usableValue(valueSelector(item)) === merged);
  const provenances = matching.map(provenanceSelector).filter((value): value is MacroValueProvenance => Boolean(value));
  if (preferOfficial && provenances.includes("official")) return "official";
  const distinct = Array.from(new Set(provenances));
  return distinct.length === 1 ? distinct[0] : distinct.length > 1 ? "mixed" : "unknown";
}

function mergeSameEvent(items: MacroEventItem[]) {
  if (items.length === 1) return items[0];

  const preferred = items
    .map((item, index) => ({ item, score: sourceScore(item, index) }))
    .sort((a, b) => b.score - a.score)[0].item;
  const family = semanticMacroEventFamily(preferred.label);
  const actualValue = mergedValue(items, preferred, (item) => item.actualValue ?? item.actual, "출처별 발표값 상이", true);
  // Statistical agencies publish actuals, not market consensus. Row-level official
  // provenance must therefore never turn one public forecast into an official winner.
  const consensusValue = mergedValue(items, preferred, (item) => item.consensusValue ?? item.forecast, "출처별 전망 상이", false);
  const previousValue = mergedValue(items, preferred, (item) => item.previousValue ?? item.previous, "출처별 이전값 상이", true);
  const actualProvenance = mergedProvenance(
    items,
    actualValue,
    (item) => item.actualValue ?? item.actual,
    (item) => item.actualProvenance,
    true
  );
  const matchingActualItems = items.filter((item) => usableValue(item.actualValue ?? item.actual) === actualValue);
  const actualSourceItem = matchingActualItems.find((item) => item.actualProvenance === "official") ?? matchingActualItems[0];
  const consensusProvenance = mergedProvenance(
    items,
    consensusValue,
    (item) => item.consensusValue ?? item.forecast,
    (item) => item.consensusProvenance,
    false
  );
  const matchingConsensusItems = items.filter((item) => usableValue(item.consensusValue ?? item.forecast) === consensusValue);
  const consensusSourceItem = matchingConsensusItems[0];
  const previousProvenance = mergedProvenance(
    items,
    previousValue,
    (item) => item.previousValue ?? item.previous,
    (item) => item.previousProvenance,
    true
  );
  const label = canonicalLabel(family, preferred.label);

  return {
    ...preferred,
    id: `${family}-${Date.parse(preferred.releaseAt)}`,
    label,
    title: label,
    importance: items.reduce<MacroEventItem["importance"]>(
      (max, item) => (item.importance > max ? item.importance : max),
      preferred.importance
    ),
    actual: actualValue,
    actualValue,
    actualProvenance,
    actualProvider: actualSourceItem?.actualProvider,
    actualSourceUrl: actualSourceItem?.actualSourceUrl,
    actualReportingPeriod: actualSourceItem?.actualReportingPeriod,
    actualObservedAt: actualSourceItem?.actualObservedAt,
    forecast: consensusValue,
    consensusValue,
    consensusProvenance,
    consensusProvider: consensusSourceItem?.consensusProvider,
    consensusSourceUrl: consensusSourceItem?.consensusSourceUrl ?? consensusSourceItem?.sourceUrl,
    previous: previousValue,
    previousValue,
    previousProvenance
  } satisfies MacroEventItem;
}

export function dedupeMacroCalendarItems(items: MacroEventItem[]) {
  const groups: Array<{
    family: string;
    releaseTime: number;
    items: MacroEventItem[];
  }> = [];

  for (const item of items) {
    const releaseTime = Date.parse(item.releaseAt);
    if (!Number.isFinite(releaseTime)) {
      groups.push({ family: `${semanticMacroEventFamily(item.label)}-${groups.length}`, releaseTime: Number.NaN, items: [item] });
      continue;
    }

    const family = semanticMacroEventFamily(item.label);
    const existing = groups.find(
      (group) => group.family === family && Number.isFinite(group.releaseTime) && Math.abs(group.releaseTime - releaseTime) <= SAME_EVENT_WINDOW_MS
    );
    if (existing) {
      existing.items.push(item);
    } else {
      groups.push({ family, releaseTime, items: [item] });
    }
  }

  return groups.map((group) => mergeSameEvent(group.items));
}
