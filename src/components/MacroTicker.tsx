"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarClock, ChevronRight, ExternalLink, Radio } from "lucide-react";
import { type MacroEventItem } from "@/data/macroEvents";
import { getMacroCalendarFallbackPayload, type MacroCalendarPayload } from "@/lib/macroCalendar";
import { StatusPill } from "@/components/ui/DesignPrimitives";

const RECENT_RELEASE_WINDOW_MS = 24 * 60 * 60 * 1000;
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

function isWithinNextDay(item: MacroEventItem) {
  const diff = eventTime(item) - Date.now();
  return diff > 0 && diff <= RECENT_RELEASE_WINDOW_MS;
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
  return (value ?? "")
    .replace(/\bCore\b/g, "근원")
    .replace(/\bMoM\b/g, "전월비")
    .replace(/\bYoY\b/g, "전년비")
    .replace(/\bPrevious\b/gi, "이전")
    .replace(/\bForecast\b/gi, "예상")
    .replace(/\bActual\b/gi, "결과");
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

function displayConsensusValue(item: MacroEventItem) {
  return displayMacroValue([item.consensusValue, item.forecast], "예상 확인 필요");
}

function displayPreviousValue(item: MacroEventItem) {
  return displayMacroValue([item.previousValue, item.previous], "이전 확인 필요");
}

function displayActual(item: MacroEventItem) {
  if (isDocumentEvent(item)) return hasReleaseTimePassed(item) ? "공식 공개" : "예정";
  if (hasActualValue(item)) return primaryMacroValueText(item.actualValue ?? item.actual);
  if (hasReleaseTimePassed(item)) return "확인 중";
  return "발표 전";
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
  if (hasReleaseTimePassed(item)) return "최근 발표";
  if (isWithinNextDay(item)) return "오늘 예정";
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

function impactLabel(item: MacroEventItem) {
  if (isHighImpactMacro(item)) return "영향도 높음";
  if (item.importance === 2) return "영향도 중간";
  return "영향도 낮음";
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
  if (lower.includes("existing home sales")) return "기존주택판매";
  if (lower.includes("new home sales")) return "신규주택판매";
  if (lower.includes("durable goods")) return "내구재 주문";
  if (lower.includes("manufacturing pmi")) return "제조업 PMI";
  if (lower.includes("consumer sentiment")) return "소비자심리";
  return label;
}

function getUpcomingItems(items: MacroEventItem[]) {
  const now = Date.now();
  return items.filter((item) => eventTime(item) > now).sort((a, b) => eventTime(a) - eventTime(b));
}

function getRecentReleasedItems(items: MacroEventItem[]) {
  return items.filter((item) => isRecentlyReleased(item)).sort((a, b) => eventTime(b) - eventTime(a));
}

function getPreviousReleasedItems(items: MacroEventItem[]) {
  return items.filter((item) => isPreviousReleaseVisible(item)).sort((a, b) => eventTime(b) - eventTime(a));
}

function getCompactItem(items: MacroEventItem[]) {
  const nearestUpcoming = getUpcomingItems(items)[0];
  if (nearestUpcoming && isWithinNextDay(nearestUpcoming)) return nearestUpcoming;
  return getRecentReleasedItems(items)[0] ?? nearestUpcoming ?? items[0];
}

function MacroNewsValue({ label, value, pending = false }: { label: string; value?: string; pending?: boolean }) {
  return (
    <span className={`inline-flex min-w-0 max-w-full flex-wrap items-center gap-1 px-0 py-0.5 text-[11px] font-semibold ${
      pending ? "text-ui-risk" : "text-ui-muted"
    }`}>
      <span className="shrink-0 text-ui-subtle">{label}</span>
      <span className="min-w-0 break-words">{value ?? "미정"}</span>
    </span>
  );
}

function MacroNewsItem({ item, sectionLabel, subdued = false }: { item: MacroEventItem; sectionLabel: string; subdued?: boolean }) {
  const sourceUrl = item.officialUrl ?? item.sourceUrl;
  const pendingActual = !hasActualValue(item) && hasReleaseTimePassed(item) && !isDocumentEvent(item);

  return (
    <article className={`py-2 first:pt-0 ${subdued ? "opacity-95" : ""}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusPill tone="info" className="min-h-5 px-0 text-[10px]">{sectionLabel}</StatusPill>
        <StatusPill tone={hasReleaseTimePassed(item) ? "watch" : "info"} className="min-h-5 px-0 text-[10px]">{compactStatusLabel(item)}</StatusPill>
        <StatusPill tone={isHighImpactMacro(item) ? "risk" : "info"} className="min-h-5 px-0 text-[10px]">{impactLabel(item)}</StatusPill>
      </div>
      <h4 className="mt-1.5 line-clamp-2 text-sm font-semibold leading-5 text-ui-text [word-break:keep-all]">{macroLabel(item.label)}</h4>
      <p className="mt-0.5 text-[11px] font-semibold leading-4 text-ui-muted">한국시간 {item.dateKst}</p>
      <div className="mt-1.5 grid grid-cols-3 gap-x-2 gap-y-1 text-left min-[420px]:flex min-[420px]:flex-wrap min-[420px]:gap-x-3">
        <MacroNewsValue label={hasReleaseTimePassed(item) ? (isDocumentEvent(item) ? "상태" : "결과") : "예상"} value={hasReleaseTimePassed(item) ? displayActual(item) : displayConsensusValue(item)} pending={pendingActual} />
        <MacroNewsValue label="예상" value={displayConsensusValue(item)} pending={displayConsensusValue(item) === "예상 확인 필요"} />
        <MacroNewsValue label="이전" value={displayPreviousValue(item)} pending={displayPreviousValue(item) === "이전 확인 필요"} />
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

export function MacroTicker({ compact = false, market = "crypto" }: { compact?: boolean; market?: "crypto" | "stocks" } = {}) {
  const pathname = usePathname();
  const [calendar, setCalendar] = useState<MacroCalendarPayload>(fallbackCalendar);
  const upcomingItems = getUpcomingItems(calendar.items);
  const releasedItems = getRecentReleasedItems(calendar.items);
  const previousReleasedItems = getPreviousReleasedItems(calendar.items);
  const fullReleasedItems = previousReleasedItems.length ? previousReleasedItems : releasedItems;
  const nearestUpcoming = upcomingItems[0];
  const laterUpcomingItems = upcomingItems.slice(1, 7);
  const isNewsMacroReport = compact && pathname === "/news";

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const scheduleNextLoad = (delayMs: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(loadCalendar, delayMs);
    };

    const loadCalendar = async () => {
      try {
        const response = await fetch(`/api/macro-calendar?market=${market}&ts=${Date.now()}`, { cache: "no-store" });
        if (response.ok) {
          const payload = (await response.json()) as MacroCalendarPayload;
          if (!cancelled) {
            setCalendar(payload);
            scheduleNextLoad(Math.max(30_000, Math.min(payload.nextRefreshMs ?? 600_000, 10 * 60_000)));
            return;
          }
        }
      } catch {
        // Keep the current calendar visible and retry soon.
      }

      if (!cancelled) scheduleNextLoad(3 * 60_000);
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
  }, [market]);

  if (isNewsMacroReport) {
    const previousRelease = previousReleasedItems[0];
    const visibleLaterItems = laterUpcomingItems.slice(0, 4);

    return (
      <section className="space-y-2">
        <div className="grid gap-2 md:grid-cols-2">
          {previousRelease ? (
            <MacroNewsItem item={previousRelease} sectionLabel="직전 발표" />
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
          <span className="[word-break:keep-all]">{calendar.sourceNote}</span>
        </div>
      </section>
    );
  }

  if (compact) {
    const item = getCompactItem(calendar.items);
    if (!item) {
      return (
        <div className="py-2 text-xs font-bold leading-5 text-slate-500 [word-break:keep-all]">
          자동 캘린더에서 이번 주 주요 일정을 확인하는 중입니다.
        </div>
      );
    }

    const isReleased = hasReleaseTimePassed(item);
    const eventKind = compactEventKind(item);
    const primaryValueLabel = isReleased ? (isDocumentEvent(item) ? "상태" : "결과") : "예상";
    const primaryValue = isReleased ? displayActual(item) : displayConsensusValue(item);
    const href = market === "stocks" ? "/macro-calendar?market=global" : "/macro-calendar?market=crypto";

    return (
      <div className="space-y-1.5">
        <Link href={href} className="group flex min-h-10 items-center gap-2 border-y border-ui-line/70 bg-transparent px-1 py-2 transition hover:bg-white/[0.025]">
          <div className={`inline-flex shrink-0 items-center gap-1.5 py-0.5 text-[11px] font-black ${isReleased ? "text-signal-warning" : "text-accent-blue"}`}>
            <Radio size={12} aria-hidden />
            {eventKind}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-black text-white">
              {macroLabel(item.label)} · <span className={compactStateClass(item)}>{compactStatusLabel(item)}</span>
            </p>
            <p className="mt-0.5 flex min-w-0 flex-wrap gap-x-2 gap-y-0.5 text-[11px] font-bold text-slate-500">
              <span>한국시간 {item.dateKst}</span>
              <span>{impactLabel(item)}</span>
              <span>{primaryValueLabel} {primaryValue}</span>
            </p>
          </div>
          <ChevronRight size={14} className="shrink-0 text-slate-600 transition group-hover:text-accent-blue" aria-hidden />
        </Link>
      </div>
    );
  }

  return (
    <section className="overflow-hidden">
      <div className="flex items-center gap-2 py-2">
        <div className="grid h-8 w-8 shrink-0 place-items-center text-accent-blue">
          <Radio size={15} aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black text-white">매크로 일정</p>
          <p className="truncate text-[11px] font-bold text-slate-500">공식 발표 전후 자동 확인</p>
        </div>
      </div>
      <div className="grid gap-2 p-2 lg:grid-cols-2">
        <div>
          <p className="text-xs font-black text-white">최근/지난 발표</p>
          {fullReleasedItems.length ? (
            fullReleasedItems.map((item) => (
              <MacroNewsItem key={`${item.label}-${item.releaseAt}`} item={item} sectionLabel="발표" />
            ))
          ) : (
            <p className="py-3 text-xs leading-5 text-ui-muted [word-break:keep-all]">공식 캘린더에서 확인되는 발표 내역이 이 영역에 표시됩니다.</p>
          )}
        </div>
        <div>
          <p className="text-xs font-black text-white">다가오는 일정</p>
          {nearestUpcoming ? (
            [nearestUpcoming, ...laterUpcomingItems].map((item) => (
              <MacroNewsItem key={`${item.label}-${item.releaseAt}`} item={item} sectionLabel="예정" />
            ))
          ) : (
            <p className="py-3 text-xs leading-5 text-ui-muted [word-break:keep-all]">다가오는 주요 USD 일정을 확인하는 중입니다.</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 px-2 py-1.5 text-[11px] leading-5 text-slate-500">
        <CalendarClock size={13} className="shrink-0 text-accent-blue" aria-hidden />
        <span className="[word-break:keep-all]">{calendar.sourceNote}</span>
      </div>
    </section>
  );
}
