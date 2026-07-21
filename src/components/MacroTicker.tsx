"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarClock, ChevronDown, ChevronRight, ExternalLink, Minus, Radio, TrendingDown, TrendingUp } from "lucide-react";
import { type MacroEventItem } from "@/data/macroEvents";
import { isHighImpactMacroEvent, isHomePriorityMacro } from "@/lib/homeMacroPriority";
import { getMacroCalendarFallbackPayload, type MacroCalendarPayload } from "@/lib/macroCalendar";
import { StatusPill } from "@/components/ui/DesignPrimitives";

const RECENT_RELEASE_WINDOW_MS = 24 * 60 * 60 * 1000;
const COMPACT_UPCOMING_WINDOW_MS = 24 * 60 * 60 * 1000;
const PREVIOUS_RELEASE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const fallbackCalendar = getMacroCalendarFallbackPayload();

const emptyValuePatterns = [
  /^$/,
  /^-$/,
  /미정/,
  /예정/,
  /확인/,
  /수집 지연/,
  /pending/i,
  /delayed/i,
  /check/i
];

function eventTime(item: MacroEventItem) {
  return new Date(item.releaseAt).getTime();
}

function isDocumentEvent(item: MacroEventItem) {
  return item.isDocumentEvent || item.eventType === "document_release" || item.eventType === "meeting_event" || item.eventType === "speech_event";
}

function hasReleaseTimePassed(item: MacroEventItem) {
  return eventTime(item) <= Date.now();
}

function kstDateKey(input: number | string) {
  const date = typeof input === "number" ? new Date(input) : new Date(input);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function isSameKstDate(input: string) {
  return kstDateKey(input) === kstDateKey(Date.now());
}

function isRecentlyReleased(item: MacroEventItem) {
  const diff = Date.now() - eventTime(item);
  return diff >= 0 && diff <= RECENT_RELEASE_WINDOW_MS;
}

function isPreviousReleaseVisible(item: MacroEventItem) {
  const diff = Date.now() - eventTime(item);
  return diff >= 0 && diff <= PREVIOUS_RELEASE_WINDOW_MS;
}

function isEmptyValue(value?: string) {
  const text = value?.trim() ?? "";
  return emptyValuePatterns.some((pattern) => pattern.test(text));
}

function hasActualValue(item: MacroEventItem) {
  if (isDocumentEvent(item) || item.isNumericEvent === false) return false;
  return !isEmptyValue(item.actualValue ?? item.actual);
}

function macroValueText(value?: string) {
  if (isEmptyValue(value)) return "미정";
  return normalizeCompactCountUnits(value ?? "")
    .replace(/\bCore\b/g, "근원")
    .replace(/\bMoM\b/g, "전월비")
    .replace(/\bYoY\b/g, "전년비")
    .replace(/\bPrevious\b/gi, "이전")
    .replace(/\bForecast\b/gi, "예측")
    .replace(/\bActual\b/gi, "결과");
}

function normalizeCompactCountUnits(value: string) {
  return value.replace(/\b(0?\.\d+)M\b/gi, (_match, amount: string) => {
    const millions = Number(amount);
    if (!Number.isFinite(millions) || millions <= 0 || millions >= 1) return `${amount}M`;
    return `${Math.round(millions * 1000)}K`;
  });
}

function primaryMacroValueText(value?: string) {
  return macroValueText(value).split(";")[0]?.trim() || "미정";
}

function displayMacroValue(candidates: Array<string | undefined>, missingLabel: string) {
  for (const candidate of candidates) {
    if (!isEmptyValue(candidate)) return macroValueText(candidate);
  }
  return missingLabel;
}

function displayReleasedComparisonValue(candidates: Array<string | undefined>, fallbackLabel: string) {
  for (const candidate of candidates) {
    const text = candidate?.trim();
    if (text && !/^확인|수집 지연|pending|delayed|check/i.test(text)) return macroValueText(text);
  }
  return fallbackLabel;
}

function displayConsensusValue(item: MacroEventItem) {
  return displayMacroValue([item.consensusValue, item.forecast], "예측 확인 필요");
}

function displayPreviousValue(item: MacroEventItem) {
  return displayMacroValue([item.previousValue, item.previous], "이전 확인 필요");
}

function displayActual(item: MacroEventItem) {
  if (isDocumentEvent(item)) return hasReleaseTimePassed(item) ? "공식 공개" : "예정";
  if (hasActualValue(item)) return primaryMacroValueText(item.actualValue ?? item.actual);
  if (hasReleaseTimePassed(item)) return "확인 중";
  return "";
}

function displayItemConsensusValue(item: MacroEventItem) {
  return hasReleaseTimePassed(item)
    ? displayReleasedComparisonValue([item.consensusValue, item.forecast], "예측 확인 중")
    : displayConsensusValue(item);
}

function displayItemPreviousValue(item: MacroEventItem) {
  return hasReleaseTimePassed(item)
    ? displayReleasedComparisonValue([item.previousValue, item.previous], "이전 없음")
    : displayPreviousValue(item);
}

function getTimeLabel(releaseAt: string) {
  const diff = new Date(releaseAt).getTime() - Date.now();
  const minute = Math.round(diff / 60000);
  if (minute > 60 * 24) return `D-${Math.ceil(minute / (60 * 24))}`;
  if (minute > 60) return `${Math.ceil(minute / 60)}시간 후`;
  if (minute > 0) return `${minute}분 후`;
  if (minute > -RECENT_RELEASE_WINDOW_MS / 60000) return "최근 발표";
  return "지난 일정";
}

function compactEventKind(item: MacroEventItem) {
  if (hasReleaseTimePassed(item)) return isRecentlyReleased(item) ? "최근 발표" : "지난 일정";
  if (isSameKstDate(item.releaseAt)) return "오늘 예정";
  return "다음 일정";
}

function compactStatusLabel(item: MacroEventItem) {
  if (!hasReleaseTimePassed(item)) return getTimeLabel(item.releaseAt);
  if (isDocumentEvent(item)) return "공식 공개";
  if (hasActualValue(item) || item.status === "actual_available" || item.status === "released") return "발표 완료";
  if (item.status === "released_pending_actual" || item.status === "checking") return "확인 중";
  return "발표 후 확인";
}

function compactStateClass(item: MacroEventItem) {
  if (!hasReleaseTimePassed(item)) return "text-accent-blue";
  if (hasActualValue(item) || item.status === "actual_available" || item.status === "released") return "text-signal-success";
  return "text-signal-warning";
}

function isHighImpactMacro(item: MacroEventItem) {
  return isHighImpactMacroEvent(item);
}

function impactLabel(item: MacroEventItem) {
  if (isHighImpactMacro(item)) return "영향도 높음";
  if (item.importance === 2) return "영향도 중간";
  return "영향도 낮음";
}

function isVisibleCompactImpact(item: MacroEventItem) {
  return isHighImpactMacro(item) || item.importance === 2;
}

function numericMacroValue(value?: string) {
  if (isEmptyValue(value)) return null;
  const match = value?.replace(/,/g, "").match(/(-?\d+(?:\.\d+)?)\s*([KMBT])?/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  const suffix = match[2]?.toUpperCase();
  const multiplier = suffix === "K" ? 1_000 : suffix === "M" ? 1_000_000 : suffix === "B" ? 1_000_000_000 : suffix === "T" ? 1_000_000_000_000 : 1;
  return Number.isFinite(parsed) ? parsed * multiplier : null;
}

function macroSurprise(actual: number, expected: number) {
  const diff = actual - expected;
  if (Math.abs(diff) < 1e-9) return "same";
  return diff > 0 ? "higher" : "lower";
}

function cryptoImpactRead(item: MacroEventItem): "호재" | "악재" | "중립" | null {
  if (!hasReleaseTimePassed(item) || isDocumentEvent(item)) return null;

  const actual = numericMacroValue(item.actualValue ?? item.actual);
  const expected = numericMacroValue(item.consensusValue ?? item.forecast);
  if (actual === null || expected === null) return null;

  const lower = item.label.toLowerCase();
  const surprise = macroSurprise(actual, expected);
  if (surprise === "same") return "중립";

  if (
    lower.includes("cpi") ||
    lower.includes("ppi") ||
    lower.includes("pce") ||
    lower.includes("inflation") ||
    lower.includes("average hourly earnings") ||
    lower.includes("wage")
  ) {
    return surprise === "lower" ? "호재" : "악재";
  }

  if (lower.includes("jobless") || lower.includes("claims") || lower.includes("unemployment rate")) {
    return surprise === "higher" ? "호재" : "악재";
  }

  if (
    lower.includes("non-farm") ||
    lower.includes("nonfarm") ||
    lower.includes("payroll") ||
    lower.includes("employment change") ||
    lower.includes("jolts")
  ) {
    return surprise === "lower" ? "호재" : "악재";
  }

  if (
    lower.includes("retail") ||
    lower.includes("gdp") ||
    lower.includes("pmi") ||
    lower.includes("ism") ||
    lower.includes("durable") ||
    lower.includes("home sales") ||
    lower.includes("consumer confidence") ||
    lower.includes("consumer sentiment")
  ) {
    return surprise === "lower" ? "호재" : "악재";
  }

  return null;
}

function macroLabel(label: string) {
  const lower = label.toLowerCase();
  if (lower.includes("core cpi")) return "근원 CPI";
  if (lower.includes("cpi")) return "소비자물가 CPI";
  if (lower.includes("core ppi")) return "근원 생산자물가지수(PPI)";
  if (lower.includes("ppi")) return "생산자물가지수(PPI)";
  if (lower.includes("retail sales")) return lower.includes("core") ? "근원 소매판매" : "소매판매";
  if (lower.includes("jobless") || lower.includes("unemployment claims")) return "신규 실업수당 청구";
  if (lower.includes("non-farm") || lower.includes("nonfarm")) return "비농업 고용";
  if (lower.includes("unemployment rate")) return "실업률";
  if (lower.includes("fomc") && lower.includes("minutes")) return "FOMC 의사록";
  if (lower.includes("fomc")) return "FOMC";
  if (lower.includes("fed")) return "연준 이벤트";
  if (lower.includes("gdp")) return lower.includes("estimate") ? "GDP 수정치" : "GDP";
  if (lower.includes("personal income and outlays")) return "PCE·개인소득";
  if (lower.includes("pce")) return "PCE 물가";
  if (lower.includes("existing home sales")) return /\bmom\b|\bm\/m\b|month\s*over\s*month|전월비/i.test(label) ? "기존주택판매 전월비" : "기존주택판매";
  if (lower.includes("new home sales")) return /\bmom\b|\bm\/m\b|month\s*over\s*month|전월비/i.test(label) ? "신규주택판매 전월비" : "신규주택판매";
  if (lower.includes("durable goods")) return "내구재 주문";
  if (lower.includes("manufacturing pmi")) return "제조업 PMI";
  if (lower.includes("consumer sentiment")) return "소비자심리";
  return label;
}

function macroSourceNote(note: string) {
  if (note.includes("BLS 공식 통계")) return note;
  return `${note} BLS 공식 통계, Fed, DOL 등 공개 자료를 함께 확인합니다.`;
}

type PriceMacroFamily = "core-cpi" | "cpi" | "core-ppi" | "ppi";
type PriceMacroPeriod = "mom" | "yoy";
type HomeSalesFamily = "new-home-sales" | "existing-home-sales";

function priceMacroFamily(label: string): PriceMacroFamily | null {
  const lower = label.toLowerCase();
  const isCore = /\bcore\b/.test(lower);
  if (/\bcpi\b/.test(lower)) return isCore ? "core-cpi" : "cpi";
  if (/\bppi\b/.test(lower)) return isCore ? "core-ppi" : "ppi";
  return null;
}

function priceMacroPeriod(label: string): PriceMacroPeriod | null {
  const lower = label.toLowerCase();
  if (/\bm\/m\b|\bmom\b|전월비/.test(lower)) return "mom";
  if (/\by\/y\b|\byoy\b|전년비/.test(lower)) return "yoy";
  return null;
}

function priceMacroPeriodLabel(period: PriceMacroPeriod) {
  return period === "mom" ? "전월비" : "전년비";
}

function priceMacroFamilyLabel(family: PriceMacroFamily) {
  if (family === "core-cpi") return "Core CPI";
  if (family === "cpi") return "CPI";
  if (family === "core-ppi") return "Core PPI";
  return "PPI";
}

function priceMacroFamilyKey(item: MacroEventItem) {
  const family = priceMacroFamily(item.label);
  return family ? `${family}|${item.releaseAt}` : null;
}

function homeSalesFamily(label: string): HomeSalesFamily | null {
  const lower = label.toLowerCase();
  if (lower.includes("new home sales")) return "new-home-sales";
  if (lower.includes("existing home sales")) return "existing-home-sales";
  return null;
}

function isHomeSalesRateItem(label: string) {
  return /\bmom\b|\bm\/m\b|month\s*over\s*month|전월비|change/i.test(label);
}

function homeSalesFamilyKey(item: MacroEventItem) {
  const family = homeSalesFamily(item.label);
  return family ? `${family}|${item.releaseAt}` : null;
}

function priceMacroGroupKey(item: MacroEventItem) {
  const family = priceMacroFamily(item.label);
  const period = priceMacroPeriod(item.label);
  return family && period ? `${family}|${item.releaseAt}` : null;
}

function priceMacroPeriodSort(item: MacroEventItem) {
  const period = priceMacroPeriod(item.label);
  if (period === "mom") return 0;
  if (period === "yoy") return 1;
  return 2;
}

function hasBothPriceMacroPeriods(items: MacroEventItem[]) {
  const periods = new Set(items.map((item) => priceMacroPeriod(item.label)).filter(Boolean));
  return periods.has("mom") && periods.has("yoy");
}

function joinPriceMacroValues(items: MacroEventItem[], valueOf: (item: MacroEventItem) => string | undefined) {
  const shouldShowPeriodLabels = hasBothPriceMacroPeriods(items);
  const seenPeriods = new Set<PriceMacroPeriod>();
  const parts = items
    .map((item) => {
      const value = valueOf(item);
      if (isEmptyValue(value)) return null;
      const period = priceMacroPeriod(item.label);
      if (period) {
        if (seenPeriods.has(period)) return null;
        seenPeriods.add(period);
      }
      const valueText = macroValueText(value);
      return shouldShowPeriodLabels && period ? `${priceMacroPeriodLabel(period)} ${valueText}` : valueText;
    })
    .filter((value): value is string => Boolean(value));

  return parts.length ? parts.join(" / ") : undefined;
}

function mergePriceMacroGroup(items: MacroEventItem[]) {
  const orderedItems = [...items].sort((a, b) => priceMacroPeriodSort(a) - priceMacroPeriodSort(b) || a.label.localeCompare(b.label));
  const primaryItem = orderedItems[0];
  const family = priceMacroFamily(primaryItem.label);
  if (!family) return primaryItem;

  const actualValue = joinPriceMacroValues(orderedItems, (item) => item.actualValue ?? item.actual);
  const consensusValue = joinPriceMacroValues(orderedItems, (item) => item.consensusValue ?? item.forecast);
  const previousValue = joinPriceMacroValues(orderedItems, (item) => item.previousValue ?? item.previous);
  const label = priceMacroFamilyLabel(family);

  return {
    ...primaryItem,
    id: `${family}-${primaryItem.releaseAt}`,
    label,
    title: label,
    importance: orderedItems.reduce<MacroEventItem["importance"]>((max, item) => (item.importance > max ? item.importance : max), primaryItem.importance),
    actual: actualValue ?? primaryItem.actual,
    actualValue,
    forecast: consensusValue ?? primaryItem.forecast,
    consensusValue,
    previous: previousValue ?? primaryItem.previous,
    previousValue
  };
}

function getDisplayCalendarItems(items: MacroEventItem[]) {
  const homeSalesLevelKeys = new Set(
    items
      .filter((item) => homeSalesFamily(item.label) && !isHomeSalesRateItem(item.label))
      .map(homeSalesFamilyKey)
      .filter((key): key is string => Boolean(key))
  );
  const groupedFamilyKeys = new Set(
    items
      .filter((item) => priceMacroPeriod(item.label))
      .map(priceMacroFamilyKey)
      .filter((key): key is string => Boolean(key))
  );
  const groupedItems = new Map<string, MacroEventItem[]>();
  const standaloneItems: MacroEventItem[] = [];
  const standalonePriceKeys = new Set<string>();

  for (const item of items) {
    const homeSalesKey = homeSalesFamilyKey(item);
    if (homeSalesKey && isHomeSalesRateItem(item.label) && homeSalesLevelKeys.has(homeSalesKey)) continue;

    const groupKey = priceMacroGroupKey(item);
    if (groupKey) {
      groupedItems.set(groupKey, [...(groupedItems.get(groupKey) ?? []), item]);
      continue;
    }

    const familyKey = priceMacroFamilyKey(item);
    if (familyKey && groupedFamilyKeys.has(familyKey)) continue;
    if (familyKey) {
      if (standalonePriceKeys.has(familyKey)) continue;
      standalonePriceKeys.add(familyKey);
    }
    standaloneItems.push(item);
  }

  return [...Array.from(groupedItems.values()).map(mergePriceMacroGroup), ...standaloneItems];
}

function getUpcomingItems(items: MacroEventItem[]) {
  const now = Date.now();
  return items.filter((item) => eventTime(item) > now).sort((a, b) => eventTime(a) - eventTime(b));
}

function getUpcomingWithinCompactWindowItems(items: MacroEventItem[]) {
  const now = Date.now();
  return items
    .filter((item) => {
      const diff = eventTime(item) - now;
      return diff > 0 && diff <= COMPACT_UPCOMING_WINDOW_MS;
    })
    .sort((a, b) => eventTime(a) - eventTime(b));
}

function getRecentReleasedItems(items: MacroEventItem[]) {
  return items.filter((item) => isRecentlyReleased(item)).sort((a, b) => eventTime(b) - eventTime(a));
}

function getPreviousReleasedItems(items: MacroEventItem[]) {
  return items.filter((item) => isPreviousReleaseVisible(item)).sort((a, b) => eventTime(b) - eventTime(a));
}

function getCompactItem(items: MacroEventItem[]) {
  const visibleItems = items.filter(isVisibleCompactImpact);
  const recentReleased = getRecentReleasedItems(visibleItems)[0];
  const upcomingWithin24Hours = getUpcomingWithinCompactWindowItems(visibleItems)[0];
  const previousReleased = getPreviousReleasedItems(visibleItems)[0];
  const nearestUpcoming = getUpcomingItems(visibleItems)[0];
  return recentReleased ?? upcomingWithin24Hours ?? nearestUpcoming ?? previousReleased ?? visibleItems[0];
}

function getHomePriorityItem(items: MacroEventItem[], now = Date.now()) {
  return items
    .filter((item) => isHomePriorityMacro(item, now))
    .sort((left, right) => Math.abs(eventTime(left) - now) - Math.abs(eventTime(right) - now))[0];
}

function MacroNewsValue({ label, value, pending = false, blankWhenMissing = false }: { label: string; value?: string; pending?: boolean; blankWhenMissing?: boolean }) {
  return (
    <span className={`inline-flex min-w-0 max-w-full flex-wrap items-center gap-1 px-0 py-0.5 text-[11px] font-semibold ${
      pending ? "text-ui-risk" : "text-ui-muted"
    }`}>
      <span className="shrink-0 text-ui-subtle">{label}</span>
      <span className="min-w-0 break-words">{value || (blankWhenMissing ? "" : "미정")}</span>
    </span>
  );
}

function MacroNewsItem({ item, sectionLabel, subdued = false, released = false }: { item: MacroEventItem; sectionLabel: string; subdued?: boolean; released?: boolean }) {
  const sourceUrl = item.officialUrl ?? item.sourceUrl;
  const pendingActual = !hasActualValue(item) && hasReleaseTimePassed(item) && !isDocumentEvent(item);
  const showSectionLabel = Boolean(sectionLabel && !(released && sectionLabel === "발표"));
  const impactRead = released ? cryptoImpactRead(item) : null;
  const ImpactIcon = impactRead === "호재" ? TrendingUp : impactRead === "악재" ? TrendingDown : impactRead === "중립" ? Minus : null;
  const impactReadTone = impactRead === "호재" ? "long" : impactRead === "악재" ? "risk" : "watch";

  return (
    <article className={`py-2 first:pt-0 ${subdued ? "opacity-95" : ""}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        {showSectionLabel ? <StatusPill tone="info" className="min-h-5 px-1.5 text-[10px]">{sectionLabel}</StatusPill> : null}
        <StatusPill tone={hasReleaseTimePassed(item) ? "watch" : "info"} className="min-h-5 px-1.5 text-[10px]">{compactStatusLabel(item)}</StatusPill>
        <StatusPill tone={isHighImpactMacro(item) ? "risk" : "info"} className="min-h-5 px-1.5 text-[10px]">{impactLabel(item)}</StatusPill>
        {impactRead && ImpactIcon ? (
          <StatusPill tone={impactReadTone} icon={ImpactIcon} className="min-h-5 px-1.5 text-[10px]">
            {impactRead}
          </StatusPill>
        ) : null}
      </div>
      <h4 className="mt-1.5 line-clamp-2 text-sm font-semibold leading-5 text-ui-text [word-break:keep-all]">{macroLabel(item.label)}</h4>
      <p className="mt-0.5 text-[11px] font-semibold leading-4 text-ui-muted">한국시간 {item.dateKst}</p>
      <div className="mt-1.5 grid grid-cols-3 gap-x-2 gap-y-1 text-left min-[420px]:flex min-[420px]:flex-wrap min-[420px]:gap-x-3">
        <MacroNewsValue label={isDocumentEvent(item) ? "상태" : "실제"} value={displayActual(item)} pending={pendingActual} blankWhenMissing />
        <MacroNewsValue label="예측" value={displayItemConsensusValue(item)} pending={displayItemConsensusValue(item).startsWith("예측 확인")} />
        <MacroNewsValue label="이전" value={displayItemPreviousValue(item)} pending={displayItemPreviousValue(item) === "이전 확인 필요"} />
      </div>
      <p className="mt-1.5 min-w-0 whitespace-normal text-xs leading-relaxed text-ui-muted [overflow-wrap:anywhere] [word-break:keep-all]">{item.marketImpact}</p>
      {sourceUrl ? (
        <a href={sourceUrl} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex max-w-full items-center gap-1 text-[11px] font-semibold text-ui-brand hover:underline">
          <span className="truncate">{item.officialUrl ? "공식 출처" : "출처"}</span>
          <ExternalLink size={11} className="shrink-0" aria-hidden />
        </a>
      ) : null}
    </article>
  );
}

export function MacroTicker({
  compact = false,
  market = "crypto",
  homePriorityAware = false
}: {
  compact?: boolean;
  market?: "crypto" | "stocks";
  homePriorityAware?: boolean;
} = {}) {
  const pathname = usePathname();
  const [calendar, setCalendar] = useState<MacroCalendarPayload>(fallbackCalendar);
  const [hasLoadedCalendar, setHasLoadedCalendar] = useState(false);
  const [calendarLoadFailed, setCalendarLoadFailed] = useState(false);
  const [calendarRetryKey, setCalendarRetryKey] = useState(0);
  const [isPastExpanded, setIsPastExpanded] = useState(false);
  const [isUpcomingExpanded, setIsUpcomingExpanded] = useState(false);
  const calendarItems = compact && !hasLoadedCalendar ? [] : calendar.items;
  const displayItems = getDisplayCalendarItems(calendarItems);
  const upcomingItems = getUpcomingItems(displayItems);
  const releasedItems = getRecentReleasedItems(displayItems);
  const previousReleasedItems = getPreviousReleasedItems(displayItems);
  const fullReleasedItems = previousReleasedItems.length ? previousReleasedItems : releasedItems;
  const visibleReleasedItems = fullReleasedItems.slice(0, isPastExpanded ? 4 : 1);
  const nearestUpcoming = upcomingItems[0];
  const featuredUpcomingItems = upcomingItems.slice(0, isUpcomingExpanded ? 8 : 2);
  const laterUpcomingItems = upcomingItems.slice(1, 7);
  const isNewsMacroReport = compact && pathname === "/news";
  const homePriorityItem = homePriorityAware ? getHomePriorityItem(displayItems) : undefined;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const scheduleNextLoad = (delayMs: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(loadCalendar, delayMs);
    };

    const loadCalendar = async () => {
      if (!cancelled) setCalendarLoadFailed(false);
      try {
        const response = await fetch(`/api/macro-calendar?market=${market}&ts=${Date.now()}`, { cache: "no-store" });
        if (response.ok) {
          const payload = (await response.json()) as MacroCalendarPayload;
          if (!cancelled) {
            setCalendar(payload);
            setHasLoadedCalendar(true);
            setCalendarLoadFailed(false);
            scheduleNextLoad(Math.max(30_000, Math.min(payload.nextRefreshMs ?? 600_000, 10 * 60_000)));
            return;
          }
        }
      } catch {
        // Keep the current calendar visible and retry soon.
      }

      if (!cancelled) {
        setCalendarLoadFailed(true);
        scheduleNextLoad(3 * 60_000);
      }
    };

    const handleFocusRefresh = () => {
      if (document.visibilityState === "visible") void loadCalendar();
    };

    loadCalendar();
    window.addEventListener("focus", handleFocusRefresh);
    document.addEventListener("visibilitychange", handleFocusRefresh);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleFocusRefresh);
      document.removeEventListener("visibilitychange", handleFocusRefresh);
      if (timer) clearTimeout(timer);
    };
  }, [calendarRetryKey, market]);

  if (isNewsMacroReport) {
    const previousRelease = previousReleasedItems[0];
    const visibleLaterItems = laterUpcomingItems.slice(0, 4);

    return (
      <section className="space-y-2">
        <div className="grid gap-2 md:grid-cols-2">
          {previousRelease ? (
            <MacroNewsItem item={previousRelease} sectionLabel="직전 발표" />
          ) : !hasLoadedCalendar ? (
            <div className="py-2 text-xs leading-5 text-ui-muted [word-break:keep-all]">
              직전 발표를 확인하는 중입니다.
            </div>
          ) : (
            <div className="py-2 text-xs leading-5 text-ui-muted [word-break:keep-all]">
              직전 발표는 공식 캘린더에서 확인되는 즉시 이 영역에 표시됩니다.
            </div>
          )}
          {nearestUpcoming ? (
            <MacroNewsItem item={nearestUpcoming} sectionLabel="다음 일정" />
          ) : (
            <div className="py-2 text-xs leading-5 text-ui-muted [word-break:keep-all]">
              다가오는 주요 USD 일정을 확인하는 중입니다.
            </div>
          )}
        </div>

        {visibleLaterItems.length ? (
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ui-subtle">이후 주요 일정</p>
              <span className="text-[11px] font-semibold text-ui-muted">가까운 일정 {visibleLaterItems.length}개</span>
            </div>
            <div className="grid gap-1.5 lg:grid-cols-2">
              {visibleLaterItems.map((item, index) => (
                <div key={`${item.label}-${item.releaseAt}`} className={index >= 2 ? "hidden md:block" : ""}>
                  <MacroNewsItem item={item} sectionLabel="이후 일정" subdued />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex items-start gap-2 pt-1 text-[11px] leading-5 text-ui-muted">
          <CalendarClock size={13} className="mt-0.5 shrink-0 text-ui-brand" aria-hidden />
          <span className="[word-break:keep-all]">{macroSourceNote(calendar.sourceNote)}</span>
        </div>
      </section>
    );
  }

  if (compact) {
    const item = homePriorityItem ?? getCompactItem(displayItems);
    if (!item) {
      return (
        <section className="space-y-1.5" aria-labelledby={homePriorityAware ? "home-macro-title" : undefined}>
          {homePriorityAware ? (
            <div className="flex items-center justify-between gap-2 px-1">
              <h2 id="home-macro-title" className="inline-flex items-center gap-1.5 text-xs font-black text-ui-text"><CalendarClock size={14} className="text-ui-brand" aria-hidden /> 오늘 거래 전 확인</h2>
              <span className="text-[10px] font-semibold text-ui-subtle">공식 경제 일정</span>
            </div>
          ) : null}
          <div className="flex min-h-12 items-center justify-between gap-3 rounded-ui-lg bg-ui-panel px-3 py-2 text-xs font-bold leading-5 text-slate-500 [word-break:keep-all]">
            <span>{calendarLoadFailed ? "공식 일정을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." : "자동 캘린더에서 이번 주 주요 일정을 확인하는 중입니다."}</span>
            {calendarLoadFailed ? <button type="button" onClick={() => setCalendarRetryKey((value) => value + 1)} className="shrink-0 font-black text-ui-brand underline">다시 시도</button> : null}
          </div>
        </section>
      );
    }

    const isReleased = hasReleaseTimePassed(item);
    const eventKind = compactEventKind(item);
    const primaryValueLabel = isDocumentEvent(item) ? "상태" : "실제";
    const primaryValue = displayActual(item);
    const impactRead = cryptoImpactRead(item);
    const ImpactIcon = impactRead === "호재" ? TrendingUp : impactRead === "악재" ? TrendingDown : impactRead === "중립" ? Minus : null;
    const impactToneClass = impactRead === "호재" ? "text-emerald-400" : impactRead === "악재" ? "text-rose-400" : "text-slate-400";
    const href = market === "stocks" ? "/schedule?market=global" : "/schedule?market=crypto";

    return (
      <section className="space-y-1.5" aria-labelledby={homePriorityAware ? "home-macro-title" : undefined}>
        {homePriorityAware ? (
          <div className="flex items-center justify-between gap-2 px-1">
            <h2 id="home-macro-title" className="inline-flex items-center gap-1.5 text-xs font-black text-ui-text">
              <CalendarClock size={14} className="text-ui-brand" aria-hidden /> 오늘 거래 전 확인
            </h2>
            <span className="text-[10px] font-semibold text-ui-subtle">공식 경제 일정</span>
          </div>
        ) : null}
        <Link href={href} className="group flex min-h-10 items-start gap-1.5 rounded-ui-lg bg-ui-panel px-2.5 py-2 transition hover:bg-ui-elevated">
          <div className={`flex w-10 shrink-0 flex-col items-center justify-start gap-0.5 text-center text-[10px] font-black leading-3 ${isReleased ? "text-signal-warning" : "text-accent-blue"}`}>
            <span>{eventKind}</span>
            {impactRead && ImpactIcon ? (
              <span className={`inline-flex flex-col items-center justify-center gap-0.5 ${impactToneClass}`} aria-label={impactRead}>
                <ImpactIcon size={14} aria-hidden />
                <span className="text-[10px] font-black leading-none">{impactRead}</span>
              </span>
            ) : (
              <Radio size={12} aria-hidden />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-4 text-[10.5px] font-black leading-4 text-white [word-break:keep-all]">
              {macroLabel(item.label)} · <span className={compactStateClass(item)}>{compactStatusLabel(item)}</span> · {impactLabel(item)}
            </p>
            <p className="text-[10.5px] font-bold leading-[15px] text-slate-500 [word-break:keep-all]">
              <span>한국시간 {item.dateKst}</span>
            </p>
            <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-bold leading-[15px] text-slate-500 [overflow-wrap:anywhere] [word-break:keep-all]">
              <span>{primaryValueLabel} {primaryValue}</span>
              <span>예측 {displayConsensusValue(item)}</span>
              <span>이전 {displayPreviousValue(item)}</span>
            </p>
          </div>
          <ChevronRight size={14} className="shrink-0 text-slate-600 transition group-hover:text-accent-blue" aria-hidden />
        </Link>
      </section>
    );
  }

  return (
    <section className="overflow-hidden">
      <div className="grid gap-2">
        <div className="rounded-ui border border-amber-400/20 bg-amber-400/[0.05] p-2">
          <button
            type="button"
            onClick={() => setIsPastExpanded((value) => !value)}
            className="flex w-full items-center justify-between gap-2 px-1 pb-1 text-left"
            aria-expanded={isPastExpanded}
          >
            <span className="min-w-0">
              <span className="block text-xs font-black text-white">지난 일정</span>
              <span className="mt-0.5 block truncate text-[11px] font-bold text-slate-500">
                {!hasLoadedCalendar ? "공식 발표 확인 중" : fullReleasedItems.length ? (isPastExpanded ? `최근 발표 ${visibleReleasedItems.length}개` : "가장 최근 발표 1개") : "확인된 지난 일정 없음"}
              </span>
            </span>
            {isPastExpanded ? (
              <ChevronDown size={16} className="shrink-0 text-slate-500" aria-hidden />
            ) : (
              <ChevronRight size={16} className="shrink-0 text-slate-500" aria-hidden />
            )}
          </button>
          {visibleReleasedItems.length ? (
            <div className="mt-2">
              {visibleReleasedItems.map((item) => (
                <MacroNewsItem key={`${item.label}-${item.releaseAt}`} item={item} sectionLabel="발표" subdued released />
              ))}
            </div>
          ) : !hasLoadedCalendar ? (
            <p className="py-3 text-xs leading-5 text-ui-muted [word-break:keep-all]">공식 캘린더에서 지난 발표 내역을 확인하는 중입니다.</p>
          ) : (
            <p className="py-3 text-xs leading-5 text-ui-muted [word-break:keep-all]">공식 캘린더에서 확인되는 발표 내역이 이 영역에 표시됩니다.</p>
          )}
        </div>
        <div className="rounded-ui border border-accent-blue/25 bg-accent-blue/[0.04] p-2">
          <button
            type="button"
            onClick={() => setIsUpcomingExpanded((value) => !value)}
            className="flex w-full items-center justify-between gap-2 px-1 pb-1 text-left"
            aria-expanded={isUpcomingExpanded}
          >
            <span className="min-w-0">
              <span className="block text-xs font-black text-white">다가오는 일정</span>
              <span className="mt-0.5 block truncate text-[11px] font-bold text-slate-500">
                {!hasLoadedCalendar ? "공식 일정 확인 중" : upcomingItems.length ? (isUpcomingExpanded ? `예정 ${featuredUpcomingItems.length}개` : "가까운 일정 2개") : "확인 중"}
              </span>
            </span>
            {isUpcomingExpanded ? (
              <ChevronDown size={16} className="shrink-0 text-slate-500" aria-hidden />
            ) : (
              <ChevronRight size={16} className="shrink-0 text-slate-500" aria-hidden />
            )}
          </button>
          {featuredUpcomingItems.length ? (
            featuredUpcomingItems.map((item) => (
              <MacroNewsItem key={`${item.label}-${item.releaseAt}`} item={item} sectionLabel="예정" />
            ))
          ) : (
            <p className="py-3 text-xs leading-5 text-ui-muted [word-break:keep-all]">다가오는 주요 USD 일정을 확인하는 중입니다.</p>
          )}
        </div>
      </div>
    </section>
  );
}
