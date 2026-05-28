"use client";
// 자동 매크로 캘린더를 상단 전광판과 뉴스 화면에 표시하는 패널입니다.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarClock, ChevronDown, ChevronRight, ExternalLink, Radio } from "lucide-react";
import { type MacroEventItem, type MacroEventSource } from "@/data/macroEvents";
import { getMacroCalendarFallbackPayload, type MacroCalendarPayload } from "@/lib/macroCalendar";
import { StatusPill } from "@/components/ui/DesignPrimitives";

const RECENT_RELEASE_WINDOW_MS = 24 * 60 * 60 * 1000;
const PREVIOUS_RELEASE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const EMPTY_ACTUAL_VALUES = new Set([
  "",
  "발표 전",
  "결과 확인 중",
  "결과 확인중",
  "공식 발표 확인 중",
  "공식값 확인 중",
  "공식 발표 확인 필요",
  "공식 문서 확인 필요",
  "공식 자료 확인 필요",
  "확인 예정",
  "예상 확인 필요",
  "이전 확인 필요",
  "미정",
  "-"
]);
const fallbackCalendar = getMacroCalendarFallbackPayload();

function hasActualValue(item: MacroEventItem) {
  if (item.isDocumentEvent || item.eventType === "document_release" || item.eventType === "meeting_event" || item.eventType === "speech_event") return false;
  if (item.isNumericEvent === false) return false;
  const actual = item.actualValue ?? item.actual;
  return Boolean(actual && !EMPTY_ACTUAL_VALUES.has(actual.trim()));
}

function hasReleaseTimePassed(item: MacroEventItem) {
  return new Date(item.releaseAt).getTime() <= Date.now();
}

function isRecentlyReleased(item: MacroEventItem) {
  const diff = Date.now() - new Date(item.releaseAt).getTime();
  return diff >= 0 && diff <= RECENT_RELEASE_WINDOW_MS;
}

function isPreviousReleaseVisible(item: MacroEventItem) {
  const diff = Date.now() - new Date(item.releaseAt).getTime();
  return diff >= 0 && diff <= PREVIOUS_RELEASE_WINDOW_MS;
}

function minutesSinceRelease(item: MacroEventItem) {
  const diff = Date.now() - new Date(item.releaseAt).getTime();
  if (!Number.isFinite(diff) || diff < 0) return 0;
  return Math.floor(diff / 60000);
}

function isWithinNextDay(item: MacroEventItem) {
  const diff = new Date(item.releaseAt).getTime() - Date.now();
  return diff > 0 && diff <= RECENT_RELEASE_WINDOW_MS;
}

function compactLeadLabel(item: MacroEventItem) {
  if (isRecentlyReleased(item) || isWithinNextDay(item)) return "오늘 체크";
  return "다음 발표";
}

function macroValueText(value?: string) {
  if (!value) return "미정";
  return value
    .replace(/\bCore\b/g, "근원")
    .replace(/\bMoM\b/g, "전월비")
    .replace(/\bYoY\b/g, "전년비")
    .replace(/\bPrevious\b/gi, "이전")
    .replace(/\bForecast\b/gi, "예상")
    .replace(/\bActual\b/gi, "실제");
}

function displayMacroValue(candidates: Array<string | undefined>, missingLabel: string) {
  for (const candidate of candidates) {
    const text = macroValueText(candidate).trim();
    if (text && !EMPTY_ACTUAL_VALUES.has(text)) return text;
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
  if (item.isDocumentEvent || item.eventType === "document_release" || item.eventType === "meeting_event" || item.eventType === "speech_event") {
    return item.statusLabel ?? (hasReleaseTimePassed(item) ? "공식 자료 확인 필요" : "예정");
  }
  if (hasActualValue(item)) return macroValueText(item.actualValue ?? item.actual);
  if (hasReleaseTimePassed(item)) return item.statusLabel ?? (minutesSinceRelease(item) >= 30 ? "발표값 수집 지연" : "발표값 확인 중");
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

function stateLabel(item: MacroEventItem) {
  if (item.statusLabel) return item.statusLabel;
  if (isRecentlyReleased(item)) return hasActualValue(item) ? "결과 공개" : minutesSinceRelease(item) >= 30 ? "공식 발표 확인 필요" : "결과 확인 중";
  if (item.state === "released") return "발표 완료";
  if (item.state === "watch") return "관찰";
  return getTimeLabel(item.releaseAt);
}

function stateClass(item: MacroEventItem) {
  if (item.status === "actual_available" || item.status === "released" || item.status === "document_released" || item.status === "meeting_completed" || item.state === "released") {
    return "border-signal-success/25 bg-signal-success/10 text-signal-success";
  }
  if (item.status === "released_pending_actual" || item.status === "checking" || item.status === "official_check_needed" || item.status === "delayed" || item.status === "stale" || item.state === "watch") {
    return "border-signal-warning/25 bg-signal-warning/10 text-signal-warning";
  }
  if (isRecentlyReleased(item)) return "border-signal-success/25 bg-signal-success/10 text-signal-success";
  return "border-accent-blue/25 bg-accent-blue/10 text-accent-blue";
}

function compactStateClass(item: MacroEventItem) {
  if (item.status === "actual_available" || item.status === "released" || item.status === "document_released" || item.status === "meeting_completed") return "text-signal-success";
  if (item.status === "released_pending_actual" || item.status === "checking" || item.status === "official_check_needed" || item.status === "delayed" || item.status === "stale") return "text-signal-warning";
  if (isRecentlyReleased(item) || item.state === "released") return "text-signal-success";
  if (item.state === "watch") return "text-signal-warning";
  return "text-accent-blue";
}

function isHighImpactMacro(item: MacroEventItem) {
  const lower = item.label.toLowerCase();
  return (
    item.importance === 3 ||
    lower.includes("cpi") ||
    lower.includes("fomc") ||
    lower.includes("fed") ||
    lower.includes("rate") ||
    lower.includes("rates") ||
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

function importanceLabel(item: MacroEventItem) {
  if (isHighImpactMacro(item)) return "중요 일정";
  if (item.importance === 2) return "시장 영향 가능";
  return "참고 일정";
}

function importanceClass(item: MacroEventItem) {
  if (isHighImpactMacro(item)) return "border-signal-warning/35 bg-signal-warning/15 text-signal-warning";
  if (item.importance === 2) return "border-accent-blue/25 bg-accent-blue/10 text-accent-blue";
  return "border-white/10 bg-white/5 text-slate-400";
}

function sourceClass(source: MacroEventSource) {
  if (source === "Fed") return "border-violet-300/25 bg-violet-300/10 text-violet-200";
  if (source === "BEA") return "border-emerald-300/25 bg-emerald-300/10 text-emerald-200";
  if (source === "Census") return "border-amber-300/25 bg-amber-300/10 text-amber-200";
  if (source === "NAR") return "border-cyan-300/25 bg-cyan-300/10 text-cyan-200";
  if (source === "DOL") return "border-rose-300/25 bg-rose-300/10 text-rose-200";
  return "border-sky-300/25 bg-sky-300/10 text-sky-200";
}

function sourceLabel(source: MacroEventSource) {
  if (source === "BLS") return "BLS 공식 통계";
  if (source === "BEA") return "BEA";
  if (source === "Fed") return "Federal Reserve";
  if (source === "Census") return "Census";
  if (source === "DOL") return "DOL";
  if (source === "NAR") return "미 부동산협회";
  if (source === "ForexFactory") return "공개 캘린더";
  return "공식 출처";
}

function macroLabel(label: string) {
  const lower = label.toLowerCase();
  if (lower.includes("core cpi")) return "근원 소비자물가지수(CPI)";
  if (lower.includes("cpi")) return "소비자물가지수(CPI)";
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
  if (lower.includes("manufacturing pmi")) return "제조업 PMI";
  if (lower.includes("consumer sentiment")) return "소비자심리지수";
  return label;
}

function getUpcomingItems(items: MacroEventItem[]) {
  const now = Date.now();
  return items
    .filter((item) => new Date(item.releaseAt).getTime() >= now || (item.state === "watch" && !hasReleaseTimePassed(item)))
    .sort((a, b) => new Date(a.releaseAt).getTime() - new Date(b.releaseAt).getTime());
}

function getRecentReleasedItems(items: MacroEventItem[]) {
  return items
    .filter((item) => isRecentlyReleased(item))
    .sort((a, b) => new Date(b.releaseAt).getTime() - new Date(a.releaseAt).getTime());
}

function getPreviousReleasedItems(items: MacroEventItem[]) {
  return items
    .filter((item) => isPreviousReleaseVisible(item))
    .sort((a, b) => new Date(b.releaseAt).getTime() - new Date(a.releaseAt).getTime());
}

function getCompactItem(items: MacroEventItem[]) {
  return getRecentReleasedItems(items)[0] ?? getUpcomingItems(items)[0] ?? items[0];
}

function ValuePill({ label, value, tone = "default" }: { label: string; value?: string; tone?: "default" | "pending" }) {
  return (
    <span className={`rounded px-1.5 py-1 ${tone === "pending" ? "bg-signal-warning/10 text-signal-warning" : "bg-white/5 text-slate-300"}`}>
      {label} {value ?? "미정"}
    </span>
  );
}

function newsStatusTone(item: MacroEventItem): "long" | "watch" | "risk" | "info" {
  if (item.status === "actual_available" || item.status === "released" || item.status === "document_released" || item.status === "meeting_completed" || hasActualValue(item)) return "long";
  if (item.status === "released_pending_actual") return "watch";
  if (item.status === "official_check_needed" || item.status === "delayed" || item.status === "stale") return "risk";
  if (hasReleaseTimePassed(item)) return minutesSinceRelease(item) >= 30 ? "risk" : "watch";
  return "info";
}

function MacroNewsValue({ label, value, pending = false }: { label: string; value?: string; pending?: boolean }) {
  return (
    <span className={`inline-flex min-w-0 max-w-full flex-wrap items-center gap-1 rounded-ui-sm border px-2 py-1 text-[11px] font-semibold ${
      pending ? "border-amber-400/24 bg-amber-400/10 text-ui-risk" : "border-ui-line bg-ui-panel text-ui-muted"
    }`}>
      <span className="shrink-0 text-ui-subtle">{label}</span>
      <span className="min-w-0 break-words">{value ?? "미정"}</span>
    </span>
  );
}

function MacroNewsItem({ item, sectionLabel, subdued = false }: { item: MacroEventItem; sectionLabel: string; subdued?: boolean }) {
  const primaryValueLabel = item.isDocumentEvent || item.eventType === "document_release" || item.eventType === "meeting_event" || item.eventType === "speech_event" ? "상태" : "실제";
  const sourceUrl = item.officialUrl ?? item.sourceUrl;
  const pendingActual = !hasActualValue(item) && hasReleaseTimePassed(item) && !item.isDocumentEvent;
  const consensusDisplay = displayConsensusValue(item);
  const previousDisplay = displayPreviousValue(item);

  return (
    <article className={`border-y border-ui-line py-3 ${subdued ? "opacity-95" : ""}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusPill tone={sectionLabel === "직전 발표" ? "watch" : "info"} className="min-h-6 px-2 text-[10px]">
          {sectionLabel}
        </StatusPill>
        <StatusPill tone={newsStatusTone(item)} className="min-h-6 px-2 text-[10px]">
          {stateLabel(item)}
        </StatusPill>
        <StatusPill tone={isHighImpactMacro(item) ? "risk" : "info"} className="min-h-6 px-2 text-[10px]">
          {importanceLabel(item)}
        </StatusPill>
      </div>

      <h4 className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-ui-text [word-break:keep-all]">{macroLabel(item.label)}</h4>
      <p className="mt-1 text-[11px] font-semibold leading-4 text-ui-muted">한국시간 {item.dateKst}</p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <MacroNewsValue label={primaryValueLabel} value={displayActual(item)} pending={pendingActual} />
        <MacroNewsValue label="예상" value={consensusDisplay} pending={consensusDisplay === "예상 확인 필요"} />
        <MacroNewsValue label="이전" value={previousDisplay} pending={previousDisplay === "이전 확인 필요"} />
      </div>

      <p className="mt-2 min-w-0 whitespace-normal text-xs leading-relaxed text-ui-muted [overflow-wrap:anywhere] [word-break:keep-all]">{item.marketImpact}</p>
      {sourceUrl ? (
        <a href={sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex max-w-full items-center gap-1 text-[11px] font-semibold text-ui-brand hover:underline">
          <span className="truncate">{item.officialUrl ? "공식 확인" : "출처 확인"}</span>
          <ExternalLink size={11} className="shrink-0" aria-hidden />
        </a>
      ) : null}
    </article>
  );
}

function MacroItemCard({ item, compact = false }: { item: MacroEventItem; compact?: boolean }) {
  const highImpact = isHighImpactMacro(item);
  const primaryValueLabel = item.isDocumentEvent || item.eventType === "document_release" || item.eventType === "meeting_event" || item.eventType === "speech_event" ? "상태" : "실제";
  return (
    <article
      className={`rounded-md border px-3 py-2.5 ${
        highImpact
          ? "border-signal-warning/25 bg-signal-warning/10"
          : compact
            ? "border-white/10 bg-black/25"
            : "border-white/10 bg-black/20"
      }`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-black ${stateClass(item)}`}>{stateLabel(item)}</span>
        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-black ${importanceClass(item)}`}>{importanceLabel(item)}</span>
        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-black ${sourceClass(item.source)}`}>{sourceLabel(item.source)}</span>
      </div>
      <p className="mt-2 text-xs font-black text-white">{macroLabel(item.label)}</p>
      <p className="mt-1 text-[11px] font-bold text-slate-400">한국시간 {item.dateKst}</p>
      <div className="mt-2 grid grid-cols-3 gap-1 text-[10px] font-bold">
        <ValuePill label={primaryValueLabel} value={displayActual(item)} tone={!hasActualValue(item) && hasReleaseTimePassed(item) ? "pending" : "default"} />
        <ValuePill label="예상" value={displayConsensusValue(item)} tone={displayConsensusValue(item) === "예상 확인 필요" ? "pending" : "default"} />
        <ValuePill label="이전" value={displayPreviousValue(item)} tone={displayPreviousValue(item) === "이전 확인 필요" ? "pending" : "default"} />
      </div>
      <p className="mt-2 text-[11px] leading-5 text-slate-500 [word-break:keep-all]">{item.marketImpact}</p>
      {compact ? (
        <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[11px] font-black text-accent-blue hover:text-cyan-200">
          출처 확인
          <ExternalLink size={11} aria-hidden />
        </a>
      ) : null}
    </article>
  );
}

export function MacroTicker({ compact = false, market = "crypto" }: { compact?: boolean; market?: "crypto" | "stocks" } = {}) {
  const pathname = usePathname();
  const [calendar, setCalendar] = useState<MacroCalendarPayload>(fallbackCalendar);
  const upcomingItems = getUpcomingItems(calendar.items);
  const releasedItems = getRecentReleasedItems(calendar.items).slice(0, 4);
  const previousReleasedItems = getPreviousReleasedItems(calendar.items);
  const nearestUpcoming = upcomingItems[0];
  const laterUpcomingItems = upcomingItems.slice(1, 7);
  const latestRelease = releasedItems[0];
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
        // 네트워크가 잠시 막혀도 현재 캘린더를 유지하고 다시 시도합니다.
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
      <section className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          {previousRelease ? (
            <MacroNewsItem item={previousRelease} sectionLabel="직전 발표" />
          ) : (
            <div className="border-y border-ui-line py-3 text-xs leading-5 text-ui-muted [word-break:keep-all]">
              직전 발표는 공식 캘린더에서 확인되는 즉시 이 영역에 유지됩니다.
            </div>
          )}
          {nearestUpcoming ? (
            <MacroNewsItem item={nearestUpcoming} sectionLabel="다음 일정" />
          ) : (
            <div className="border-y border-ui-line py-3 text-xs leading-5 text-ui-muted [word-break:keep-all]">
              다가오는 주요 USD 일정을 확인하는 중입니다.
            </div>
          )}
        </div>

        {visibleLaterItems.length ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ui-subtle">이후 주요 일정</p>
              <span className="text-[11px] font-semibold text-ui-muted">가까운 일정 {visibleLaterItems.length}개</span>
            </div>
            <div className="grid gap-2 lg:grid-cols-2">
              {visibleLaterItems.map((item, index) => (
                <div key={`${item.label}-${item.releaseAt}`} className={index >= 2 ? "hidden md:block" : ""}>
                  <MacroNewsItem item={item} sectionLabel="이후 일정" subdued />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex items-start gap-2 border-t border-ui-line pt-3 text-[11px] leading-5 text-ui-muted">
          <CalendarClock size={13} className="mt-0.5 shrink-0 text-ui-brand" aria-hidden />
          <span className="[word-break:keep-all]">{calendar.sourceNote}</span>
        </div>
      </section>
    );
  }

  if (compact) {
    const item = getCompactItem(calendar.items);
    const isCryptoCompact = market === "crypto";
    if (!item) {
      return (
        <div className="border-y border-white/10 py-3 text-xs font-bold leading-5 text-slate-500 [word-break:keep-all]">
          자동 캘린더에서 이번 주 주요 일정을 확인하는 중입니다.
        </div>
      );
    }

    const isTodayCheck = isRecentlyReleased(item) || isWithinNextDay(item);
    const primaryValueLabel =
      item.isDocumentEvent || item.eventType === "document_release" || item.eventType === "meeting_event" || item.eventType === "speech_event" ? "상태" : "실제";

    return (
      <Link
        href={market === "stocks" ? "/news?market=global" : "/news?market=crypto"}
        className="group flex min-h-10 items-center gap-2 border-y border-white/10 bg-transparent px-1 py-2 transition hover:bg-white/[0.025]"
      >
        <div
          className={`inline-flex shrink-0 items-center gap-1.5 px-2 py-1 text-[11px] font-black ${
            isCryptoCompact ? "rounded-none border-b" : "rounded-none border-b"
          } ${
            isTodayCheck
              ? "border-signal-warning/25 bg-signal-warning/10 text-signal-warning"
              : "border-accent-blue/20 bg-accent-blue/10 text-accent-blue"
          }`}
        >
          <Radio size={12} aria-hidden />
          {isTodayCheck ? "오늘 체크" : "매크로"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-black text-white">
            {compactLeadLabel(item)} · <span className={compactStateClass(item)}>{stateLabel(item)}</span> · {macroLabel(item.label)}
          </p>
          <p className="mt-0.5 truncate text-[11px] font-bold text-slate-500">
            한국시간 {item.dateKst} · {primaryValueLabel} {displayActual(item)} · 예상 {displayConsensusValue(item)} · 이전 {displayPreviousValue(item)}
          </p>
        </div>
        <ChevronRight size={14} className="shrink-0 text-slate-600 transition group-hover:text-accent-blue" aria-hidden />
      </Link>
    );
  }

  return (
    <section className="overflow-hidden border-y border-accent-blue/20">
      <div className="flex items-center gap-3 border-b border-white/10 py-2">
        <div className="radar-mark grid h-8 w-8 shrink-0 place-items-center border border-accent-blue/30 text-accent-blue">
          <Radio size={15} aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black text-white">매크로 레이더</p>
          <p className="truncate text-[11px] font-bold text-slate-500">
            공식 발표 전후 자동 확인
          </p>
        </div>
        <div className="ml-auto hidden items-center gap-2 sm:flex">
          <div className="inline-flex items-center gap-1 rounded border border-signal-warning/25 bg-signal-warning/10 px-2 py-1 text-[11px] font-black text-signal-warning">
            중요 일정
          </div>
          <div className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-black text-slate-400">
            참고 일정
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-3 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-black text-white">최근 발표 결과</p>
            <span className="text-[11px] font-bold text-slate-500">{releasedItems.length}개 확인</span>
          </div>
          {latestRelease ? (
            <MacroItemCard item={latestRelease} />
          ) : (
            <p className="border-y border-white/10 py-3 text-[11px] leading-5 text-slate-500">
              최근 24시간 안에 표시할 발표 결과가 없습니다. 다음 발표 일정과 예상치를 먼저 확인하세요.
            </p>
          )}
          {releasedItems.length > 1 ? (
            <details className="border-y border-white/10 py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-black text-slate-300">
                최근 발표 더 보기
                <ChevronDown size={14} aria-hidden />
              </summary>
              <div className="mt-3 space-y-2">
                {releasedItems.slice(1).map((item) => (
                  <MacroItemCard key={`${item.label}-${item.releaseAt}`} item={item} compact />
                ))}
              </div>
            </details>
          ) : null}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-black text-white">다가오는 일정</p>
            <span className="text-[11px] font-bold text-slate-500">{upcomingItems.length}개 대기</span>
          </div>
          {nearestUpcoming ? (
            <MacroItemCard item={nearestUpcoming} />
          ) : (
            <p className="border-y border-white/10 py-3 text-[11px] leading-5 text-slate-500">
              자동 캘린더에서 다가오는 주요 USD 일정을 확인하는 중입니다.
            </p>
          )}
          {laterUpcomingItems.length > 0 ? (
            <details className="border-y border-white/10 py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-black text-slate-300">
                이후 일정 {laterUpcomingItems.length}개 보기
                <ChevronDown size={14} aria-hidden />
              </summary>
              <div className="mt-3 space-y-2">
                {laterUpcomingItems.map((item) => (
                  <MacroItemCard key={`${item.label}-${item.releaseAt}`} item={item} compact />
                ))}
              </div>
            </details>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-white/10 px-3 py-2 text-[11px] leading-5 text-slate-500">
        <CalendarClock size={13} className="shrink-0 text-accent-blue" aria-hidden />
        <span className="[word-break:keep-all]">{calendar.sourceNote}</span>
      </div>
    </section>
  );
}
