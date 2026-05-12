"use client";
// 한국시간 기준의 주요 매크로 일정을 거래 화면과 뉴스 화면에 보여주는 컴포넌트입니다.
import Link from "next/link";
import { CalendarClock, ChevronDown, ChevronRight, Clock3, ExternalLink, Radio, ShieldAlert, TimerReset } from "lucide-react";
import {
  macroCalendarSourceNote,
  macroCalendarUpdatedAt,
  macroItems,
  type MacroEventImportance,
  type MacroEventItem,
  type MacroEventSource
} from "@/data/macroEvents";

const RECENT_RELEASE_WINDOW_MS = 24 * 60 * 60 * 1000;
const EMPTY_ACTUAL_VALUES = new Set(["발표 전", "회의 전", "미정", "-"]);

function hasActualValue(item: MacroEventItem) {
  if (!item.actual) return false;
  return !EMPTY_ACTUAL_VALUES.has(item.actual.trim());
}

function hasReleaseTimePassed(item: MacroEventItem) {
  return new Date(item.releaseAt).getTime() <= Date.now();
}

function displayActual(item: MacroEventItem) {
  if (hasActualValue(item)) return item.actual;
  if (hasReleaseTimePassed(item)) return "결과 확인 중";
  return "발표 전";
}

function stateLabel(item: MacroEventItem) {
  if (isRecentlyReleased(item)) return hasActualValue(item) ? "결과 확인" : "결과 확인 중";
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
  return "border-sky-300/25 bg-sky-300/10 text-sky-200";
}

function getTimeLabel(releaseAt: string) {
  const diff = new Date(releaseAt).getTime() - Date.now();
  const minute = Math.round(diff / 60000);

  if (minute > 60 * 24) return `D-${getKstDayDiff(releaseAt)}`;
  if (minute > 60) return `${Math.ceil(minute / 60)}시간 후`;
  if (minute > 0) return `${minute}분 후`;
  if (minute > -RECENT_RELEASE_WINDOW_MS / 60000) return "결과 확인 중";
  return "지난 일정";
}

function isRecentlyReleased(item: MacroEventItem) {
  const diff = Date.now() - new Date(item.releaseAt).getTime();
  return diff >= 0 && diff <= RECENT_RELEASE_WINDOW_MS;
}

function getKstDayDiff(releaseAt: string) {
  const dayMs = 24 * 60 * 60 * 1000;
  const nowKey = getKstDateKey(new Date());
  const targetKey = getKstDateKey(new Date(releaseAt));
  return Math.max(1, Math.ceil((targetKey - nowKey) / dayMs));
}

function getKstDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const year = Number(parts.find((part) => part.type === "year")?.value ?? "1970");
  const month = Number(parts.find((part) => part.type === "month")?.value ?? "01");
  const day = Number(parts.find((part) => part.type === "day")?.value ?? "01");
  return Date.UTC(year, month - 1, day);
}

function getUpcomingItems() {
  const now = Date.now();
  return macroItems
    .filter((item) => new Date(item.releaseAt).getTime() >= now || (item.state === "watch" && !hasReleaseTimePassed(item)))
    .sort((a, b) => new Date(a.releaseAt).getTime() - new Date(b.releaseAt).getTime());
}

function getRecentReleasedItems() {
  return macroItems
    .filter((item) => isRecentlyReleased(item))
    .sort((a, b) => new Date(b.releaseAt).getTime() - new Date(a.releaseAt).getTime());
}

function getCompactItem() {
  const recent = getRecentReleasedItems()[0];
  const upcoming = getUpcomingItems()[0];
  return recent ?? upcoming ?? macroItems[0];
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
        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-black ${sourceClass(item.source)}`}>{item.source}</span>
      </div>
      <p className="mt-2 text-xs font-black text-white">{item.label}</p>
      <p className="mt-1 text-[11px] font-bold text-slate-400">한국시간 {item.dateKst}</p>
      <div className="mt-2 grid grid-cols-3 gap-1 text-[10px] font-bold">
        <ValuePill label="실제" value={displayActual(item)} tone={!hasActualValue(item) && hasReleaseTimePassed(item) ? "pending" : "default"} />
        <ValuePill label="예상" value={item.forecast} />
        <ValuePill label="이전" value={item.previous} />
      </div>
      <p className="mt-2 text-[11px] leading-5 text-slate-500 [word-break:keep-all]">{item.marketImpact}</p>
      {compact ? (
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-[11px] font-black text-accent-blue hover:text-cyan-200"
        >
          공식 일정 확인
          <ExternalLink size={11} aria-hidden />
        </a>
      ) : null}
    </article>
  );
}

export function MacroTicker({ compact = false, market = "crypto" }: { compact?: boolean; market?: "crypto" | "stocks" } = {}) {
  const upcomingItems = getUpcomingItems();
  const releasedItems = getRecentReleasedItems().slice(0, 4);
  const nearestUpcoming = upcomingItems[0];
  const laterUpcomingItems = upcomingItems.slice(1, 7);
  const latestRelease = releasedItems[0];

  if (compact) {
    const item = getCompactItem();

    return (
      <Link
        href={market === "stocks" ? "/news?market=global" : "/news?market=crypto"}
        className="group flex min-h-10 items-center gap-2 rounded-md border border-accent-blue/15 bg-surface-card/78 px-2.5 py-2 shadow-[0_10px_34px_rgba(0,0,0,0.18)] transition hover:border-accent-blue/35 hover:bg-surface-card"
      >
        <div className="inline-flex shrink-0 items-center gap-1.5 rounded border border-accent-blue/20 bg-accent-blue/10 px-2 py-1 text-[11px] font-black text-accent-blue">
          <Radio size={12} aria-hidden />
          매크로
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-black text-white">
            {isRecentlyReleased(item) ? "최근 발표" : "다음 발표"} · <span className={compactStateClass(item)}>{stateLabel(item)}</span> · {item.label}
          </p>
          <p className="mt-0.5 truncate text-[11px] font-bold text-slate-500">
            한국시간 {item.dateKst} · 실제 {displayActual(item)} · 예상 {item.forecast ?? "미정"} · 이전 {item.previous ?? "미정"}
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
          <p className="truncate text-[11px] font-bold text-slate-500">{macroCalendarUpdatedAt}. 모든 발표 시간은 한국시간 기준입니다.</p>
        </div>
        <div className="ml-auto hidden items-center gap-1 rounded border border-signal-warning/20 bg-signal-warning/10 px-2 py-1 text-[11px] font-black text-signal-warning sm:flex">
          <ShieldAlert size={12} aria-hidden />
          발표 전후 변동성 주의
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
              최근 24시간 안에 표시할 발표 결과가 없습니다. 다음 발표 일정 위주로 확인해 주세요.
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
                  <MacroItemCard key={item.label} item={item} compact />
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
            <article className="flex items-start gap-3 rounded-md border border-white/10 bg-black/25 px-3 py-2.5">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-white/10 bg-black/30 text-accent-blue">
                <CalendarClock size={16} aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`rounded border px-1.5 py-0.5 text-[10px] font-black ${stateClass(nearestUpcoming)}`}>{stateLabel(nearestUpcoming)}</span>
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-black text-slate-300">{importanceLabel(nearestUpcoming.importance)}</span>
                  <span className={`rounded border px-1.5 py-0.5 text-[10px] font-black ${sourceClass(nearestUpcoming.source)}`}>{nearestUpcoming.source}</span>
                </div>
                <p className="mt-1 text-xs font-black text-white">{nearestUpcoming.label}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-bold text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <Clock3 size={11} aria-hidden />
                    한국시간 {nearestUpcoming.dateKst}
                  </span>
                </div>
                <p className="mt-1 text-[11px] font-medium leading-5 text-slate-500 [word-break:keep-all]">{nearestUpcoming.summary}</p>
                <div className="mt-2 grid grid-cols-3 gap-1 text-[10px] font-bold">
                  <ValuePill label="실제" value={displayActual(nearestUpcoming)} />
                  <ValuePill label="예상" value={nearestUpcoming.forecast} />
                  <ValuePill label="이전" value={nearestUpcoming.previous} />
                </div>
                <p className="mt-1 text-[11px] font-medium leading-5 text-slate-500 [word-break:keep-all]">{nearestUpcoming.marketImpact}</p>
                <a
                  href={nearestUpcoming.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-black text-accent-blue hover:text-cyan-200"
                >
                  공식 일정 확인
                  <ExternalLink size={11} aria-hidden />
                </a>
              </div>
            </article>
          ) : (
            <p className="rounded-md border border-white/10 bg-black/25 p-3 text-[11px] leading-5 text-slate-500">
              현재 등록된 다음 일정이 없습니다. 일정 데이터가 갱신되면 이 영역에 표시됩니다.
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
                  <MacroItemCard key={item.label} item={item} compact />
                ))}
              </div>
            </details>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-white/10 px-3 py-2 text-[11px] leading-5 text-slate-500">
        <TimerReset size={13} className="shrink-0 text-accent-blue" aria-hidden />
        <span className="[word-break:keep-all]">{macroCalendarSourceNote}</span>
        <CalendarClock size={13} className="ml-auto hidden shrink-0 text-slate-600 sm:block" aria-hidden />
      </div>
    </section>
  );
}
