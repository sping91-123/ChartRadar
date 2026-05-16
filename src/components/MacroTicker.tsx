"use client";
// 자동 매크로 캘린더를 상단 전광판과 뉴스 화면에 표시하는 패널입니다.
import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarClock, ChevronDown, ChevronRight, Clock3, ExternalLink, Radio, TimerReset } from "lucide-react";
import { type MacroEventImportance, type MacroEventItem, type MacroEventSource } from "@/data/macroEvents";
import { getMacroCalendarFallbackPayload, type MacroCalendarPayload } from "@/lib/macroCalendar";

const RECENT_RELEASE_WINDOW_MS = 24 * 60 * 60 * 1000;
const EMPTY_ACTUAL_VALUES = new Set(["", "발표 전", "결과 확인 중", "미정", "-"]);
const fallbackCalendar = getMacroCalendarFallbackPayload();

function hasActualValue(item: MacroEventItem) {
  return Boolean(item.actual && !EMPTY_ACTUAL_VALUES.has(item.actual.trim()));
}

function hasReleaseTimePassed(item: MacroEventItem) {
  return new Date(item.releaseAt).getTime() <= Date.now();
}

function isRecentlyReleased(item: MacroEventItem) {
  const diff = Date.now() - new Date(item.releaseAt).getTime();
  return diff >= 0 && diff <= RECENT_RELEASE_WINDOW_MS;
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

function displayActual(item: MacroEventItem) {
  if (hasActualValue(item)) return macroValueText(item.actual);
  if (hasReleaseTimePassed(item)) return "공식값 확인 중";
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
  if (isRecentlyReleased(item)) return hasActualValue(item) ? "결과 반영" : "결과 확인 중";
  if (item.state === "released") return "발표 완료";
  if (item.state === "watch") return "관찰";
  return getTimeLabel(item.releaseAt);
}

function stateClass(item: MacroEventItem) {
  if (isRecentlyReleased(item) || item.state === "released") return "border-signal-success/25 bg-signal-success/10 text-signal-success";
  if (item.state === "watch") return "border-signal-warning/25 bg-signal-warning/10 text-signal-warning";
  return "border-accent-blue/25 bg-accent-blue/10 text-accent-blue";
}

function compactStateClass(item: MacroEventItem) {
  if (isRecentlyReleased(item) || item.state === "released") return "text-signal-success";
  if (item.state === "watch") return "text-signal-warning";
  return "text-accent-blue";
}

function importanceLabel(importance: MacroEventImportance) {
  if (importance === 3) return "중요도 높음";
  if (importance === 2) return "중요도 중간";
  return "참고";
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
  if (source === "BLS") return "미 노동통계국";
  if (source === "BEA") return "미 경제분석국";
  if (source === "Fed") return "연준";
  if (source === "Census") return "미 인구조사국";
  if (source === "DOL") return "미 노동부";
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
  if (lower.includes("fomc")) return "FOMC";
  if (lower.includes("fed")) return "연준 이벤트";
  if (lower.includes("gdp")) return "GDP";
  if (lower.includes("pce")) return "PCE 물가";
  if (lower.includes("existing home sales")) return "기존주택판매";
  if (lower.includes("manufacturing pmi")) return "제조업 PMI";
  if (lower.includes("consumer sentiment")) return "소비자심리지수";
  return label;
}

function getRefreshLabel(nextRefreshMs?: number) {
  const refreshMs = nextRefreshMs ?? 10 * 60 * 1000;
  if (refreshMs <= 60_000) return "1분마다 확인";
  if (refreshMs <= 3 * 60_000) return "3분마다 확인";
  return "10분마다 확인";
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

function MacroItemCard({ item, compact = false }: { item: MacroEventItem; compact?: boolean }) {
  return (
    <article className={`rounded-md border px-3 py-2.5 ${compact ? "border-white/10 bg-black/25" : "border-signal-success/15 bg-signal-success/5"}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-black ${stateClass(item)}`}>{stateLabel(item)}</span>
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-black text-slate-300">{importanceLabel(item.importance)}</span>
        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-black ${sourceClass(item.source)}`}>{sourceLabel(item.source)}</span>
      </div>
      <p className="mt-2 text-xs font-black text-white">{macroLabel(item.label)}</p>
      <p className="mt-1 text-[11px] font-bold text-slate-400">한국시간 {item.dateKst}</p>
      <div className="mt-2 grid grid-cols-3 gap-1 text-[10px] font-bold">
        <ValuePill label="실제" value={displayActual(item)} tone={!hasActualValue(item) && hasReleaseTimePassed(item) ? "pending" : "default"} />
        <ValuePill label="예상" value={macroValueText(item.forecast)} />
        <ValuePill label="이전" value={macroValueText(item.previous)} />
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
  const [calendar, setCalendar] = useState<MacroCalendarPayload>(fallbackCalendar);
  const upcomingItems = getUpcomingItems(calendar.items);
  const releasedItems = getRecentReleasedItems(calendar.items).slice(0, 4);
  const nearestUpcoming = upcomingItems[0];
  const laterUpcomingItems = upcomingItems.slice(1, 7);
  const latestRelease = releasedItems[0];
  const refreshLabel = getRefreshLabel(calendar.nextRefreshMs);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const loadCalendar = async () => {
      try {
        const response = await fetch(`/api/macro-calendar?market=${market}`, { cache: "no-store" });
        if (response.ok) {
          const payload = (await response.json()) as MacroCalendarPayload;
          if (!cancelled) {
            setCalendar(payload);
            timer = setTimeout(loadCalendar, Math.max(60_000, Math.min(payload.nextRefreshMs ?? 600_000, 10 * 60_000)));
            return;
          }
        }
      } catch {
        // 네트워크가 잠시 막혀도 현재 캘린더를 유지하고 다시 시도합니다.
      }

      if (!cancelled) timer = setTimeout(loadCalendar, 3 * 60_000);
    };

    loadCalendar();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [market]);

  if (compact) {
    const item = getCompactItem(calendar.items);
    if (!item) {
      return (
        <div className="rounded-md border border-white/10 bg-black/20 px-3 py-3 text-xs font-bold leading-5 text-slate-500 [word-break:keep-all]">
          자동 캘린더에서 이번 주 주요 일정을 확인하는 중입니다.
        </div>
      );
    }

    const isTodayCheck = isRecentlyReleased(item) || isWithinNextDay(item);

    return (
      <Link
        href={market === "stocks" ? "/news?market=global" : "/news?market=crypto"}
        className="group flex min-h-10 items-center gap-2 rounded-md border border-accent-blue/15 bg-surface-card/78 px-2.5 py-2 shadow-[0_10px_34px_rgba(0,0,0,0.18)] transition hover:border-accent-blue/35 hover:bg-surface-card"
      >
        <div
          className={`inline-flex shrink-0 items-center gap-1.5 rounded border px-2 py-1 text-[11px] font-black ${
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
            한국시간 {item.dateKst} · {refreshLabel} · 실제 {displayActual(item)} · 예상 {macroValueText(item.forecast)} · 이전 {macroValueText(item.previous)}
          </p>
        </div>
        <ChevronRight size={14} className="shrink-0 text-slate-600 transition group-hover:text-accent-blue" aria-hidden />
      </Link>
    );
  }

  return (
    <section className="overflow-hidden rounded-lg border border-accent-blue/20 bg-surface-card shadow-glow">
      <div className="flex items-center gap-3 border-b border-white/10 bg-black/20 px-3 py-2">
        <div className="radar-mark grid h-8 w-8 shrink-0 place-items-center border border-accent-blue/30 text-accent-blue">
          <Radio size={15} aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black text-white">매크로 레이더</p>
          <p className="truncate text-[11px] font-bold text-slate-500">
            {calendar.updatedAtLabel} · {refreshLabel}
          </p>
        </div>
        <div className="ml-auto hidden items-center gap-2 sm:flex">
          <div className="inline-flex items-center gap-1 rounded border border-signal-success/25 bg-signal-success/10 px-2 py-1 text-[11px] font-black text-signal-success">
            <TimerReset size={12} aria-hidden />
            자동 업데이트
          </div>
          <div className="inline-flex items-center gap-1 rounded border border-accent-blue/20 bg-accent-blue/10 px-2 py-1 text-[11px] font-black text-accent-blue">
            <Clock3 size={12} aria-hidden />
            {refreshLabel}
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
            <p className="rounded-md border border-white/10 bg-black/25 p-3 text-[11px] leading-5 text-slate-500">
              최근 24시간 안에 표시할 발표 결과가 없습니다. 다음 발표 일정과 예상치를 먼저 확인하세요.
            </p>
          )}
          {releasedItems.length > 1 ? (
            <details className="rounded-md border border-white/10 bg-black/20 p-3">
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
            <p className="rounded-md border border-white/10 bg-black/25 p-3 text-[11px] leading-5 text-slate-500">
              자동 캘린더에서 다가오는 주요 USD 일정을 확인하는 중입니다.
            </p>
          )}
          {laterUpcomingItems.length > 0 ? (
            <details className="rounded-md border border-white/10 bg-black/20 p-3">
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
