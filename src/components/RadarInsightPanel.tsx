// 공통 레이더 판단 모델을 Free와 Pro 노출 정책에 맞춰 보여주는 패널.
import { ArrowDownRight, ArrowUpRight, Eye, Gauge, Lock, ShieldAlert } from "lucide-react";
import type { RadarFinalView, RadarInsight } from "@/lib/radarInsight";

interface RadarInsightPanelProps {
  insight: RadarInsight;
  isPro: boolean;
  className?: string;
  strengthHelp?: string[];
}

function finalViewClass(finalView: RadarFinalView) {
  if (finalView === "long_bias") return "border-signal-success/30 bg-signal-success/10 text-signal-success";
  if (finalView === "short_bias") return "border-signal-danger/30 bg-signal-danger/10 text-signal-danger";
  if (finalView === "high_risk") return "border-signal-warning/35 bg-signal-warning/10 text-signal-warning";
  return "border-cyan-300/25 bg-cyan-300/10 text-cyan-100";
}

function strengthClass(finalView: RadarFinalView) {
  if (finalView === "long_bias") return "bg-signal-success";
  if (finalView === "short_bias") return "bg-signal-danger";
  if (finalView === "high_risk") return "bg-signal-warning";
  return "bg-cyan-300";
}

function finalViewIcon(finalView: RadarFinalView) {
  if (finalView === "long_bias") return <ArrowUpRight size={18} aria-hidden />;
  if (finalView === "short_bias") return <ArrowDownRight size={18} aria-hidden />;
  if (finalView === "high_risk") return <ShieldAlert size={18} aria-hidden />;
  return <Eye size={18} aria-hidden />;
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function listItems(items: string[], limit: number | null) {
  return limit === null ? items : items.slice(0, limit);
}

function InsightList({
  title,
  items,
  locked,
  previewText,
  showLockedPreviewItems = false
}: {
  title: string;
  items: string[];
  locked?: boolean;
  previewText?: string;
  showLockedPreviewItems?: boolean;
}) {
  const visibleItems = locked && !showLockedPreviewItems ? [] : locked ? items.slice(0, 1) : items;

  return (
    <div className={`rounded-lg border p-3 ${locked ? "border-white/10 bg-black/10 opacity-85" : "border-white/10 bg-black/20"}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-black text-slate-200">{title}</p>
        {locked ? (
          <span className="inline-flex items-center gap-1 rounded border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-[10px] font-black text-cyan-100">
            <Lock size={11} aria-hidden />
            Pro
          </span>
        ) : null}
      </div>
      {visibleItems.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {visibleItems.map((item) => (
            <li key={item} className="text-xs font-bold leading-5 text-slate-300 [word-break:keep-all]">
              {item}
            </li>
          ))}
        </ul>
      ) : locked ? (
        <div className="mt-3 space-y-2" aria-hidden>
          <div className="h-2 w-4/5 rounded bg-white/10" />
          <div className="h-2 w-2/3 rounded bg-white/10" />
        </div>
      ) : (
        <p className="mt-2 text-xs font-bold leading-5 text-slate-500">확인된 항목이 없습니다.</p>
      )}
      {locked ? (
        <p className="mt-2 text-[11px] font-bold leading-5 text-slate-500 [word-break:keep-all]">
          {previewText ?? "상세 조건, 무효화 기준, 세부 리스크는 Pro에서 확인할 수 있습니다."}
        </p>
      ) : null}
    </div>
  );
}

function LockedValue({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/10 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-black text-slate-200">{label}</p>
        <Lock size={14} className="text-cyan-200" aria-hidden />
      </div>
      <p className="mt-2 text-xs font-bold leading-5 text-slate-500">상세 조건, 무효화 기준, 세부 리스크는 Pro에서 확인할 수 있습니다.</p>
    </div>
  );
}

export function RadarInsightPanel({ insight, isPro, className = "", strengthHelp }: RadarInsightPanelProps) {
  const keyReasons = listItems(insight.keyReasons, isPro ? null : 1);
  const risks = listItems(insight.risks, isPro ? null : 1);
  const strengthHelpText = strengthHelp?.join(" ");

  return (
    <section className={`relative overflow-hidden rounded-xl border border-surface-line bg-surface-cardSoft p-4 shadow-[0_18px_56px_rgba(0,0,0,0.22)] ${className}`}>
      <div className={`absolute inset-x-0 top-0 h-1 ${strengthClass(insight.finalView)}`} aria-hidden />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
            Radar Insight · {insight.market === "crypto" ? "Crypto" : "Global"} · {insight.timeframe ?? "통합"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-black ${finalViewClass(insight.finalView)}`}>
              {finalViewIcon(insight.finalView)}
              {insight.finalViewLabel}
            </span>
            <span className="rounded-md border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-black text-slate-300">
              판단 보조
            </span>
            {!isPro ? (
              <span className="rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-black text-cyan-100">
                Basic 방향 요약
              </span>
            ) : (
              <span className="rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-black text-cyan-100">
                Pro 전체 보기
              </span>
            )}
          </div>
          <h3 className="mt-3 text-xl font-black tracking-tight text-white sm:text-2xl">{insight.symbol}</h3>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400 [word-break:keep-all]">{insight.summary}</p>
        </div>

        <div className="w-full shrink-0 rounded-lg border border-white/10 bg-black/20 p-3 lg:w-64">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Gauge size={16} className="text-cyan-200" aria-hidden />
              <p className="text-xs font-black text-slate-200">판단 강도</p>
              {strengthHelpText ? (
                <span
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-300/10 text-[11px] font-black text-cyan-100"
                  title={strengthHelpText}
                  aria-label={`판단 강도 도움말: ${strengthHelpText}`}
                >
                  ?
                </span>
              ) : null}
            </div>
            <p className="text-sm font-black text-white">{insight.strengthLabel}</p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div className={`h-full rounded-full ${strengthClass(insight.finalView)}`} style={{ width: `${Math.max(4, insight.strength)}%` }} />
          </div>
          <p className="mt-2 text-xs font-bold text-slate-400">{insight.strength} / 100</p>
          {strengthHelp?.length ? (
            <ul className="mt-3 space-y-1.5 rounded-md border border-cyan-300/15 bg-cyan-300/5 p-3">
              {strengthHelp.map((item) => (
                <li key={item} className="text-[11px] font-bold leading-5 text-slate-300 [word-break:keep-all]">
                  {item}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <InsightList
          title="핵심 근거"
          items={keyReasons}
          locked={!isPro && insight.keyReasons.length > 1}
          previewText="Basic에서는 방향 요약만 제공합니다. 나머지 근거는 Pro에서 전체 맥락으로 확인합니다."
          showLockedPreviewItems
        />
        <InsightList
          title="리스크"
          items={risks}
          locked={!isPro && insight.risks.length > 1}
          previewText="상세 조건, 무효화 기준, 세부 리스크는 Pro에서 확인할 수 있습니다."
          showLockedPreviewItems
        />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <InsightList title="롱 추적 조건" items={insight.longConditions} locked={!isPro} />
        <InsightList title="숏 추적 조건" items={insight.shortConditions} locked={!isPro} />
        <InsightList title="무효화 기준" items={insight.invalidationConditions} locked={!isPro} />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {isPro ? (
          <div className="rounded-lg border border-white/10 bg-black/20 p-3">
            <p className="text-xs font-black text-slate-200">다음 확인 기준</p>
            <p className="mt-2 text-xs font-bold leading-5 text-slate-300 [word-break:keep-all]">{insight.nextAction}</p>
          </div>
        ) : (
          <LockedValue label="다음 확인 기준" />
        )}
        {isPro ? (
          <div className="rounded-lg border border-white/10 bg-black/20 p-3">
            <p className="text-xs font-black text-slate-200">업데이트 시각</p>
            <p className="mt-2 text-xs font-bold leading-5 text-slate-300">{formatUpdatedAt(insight.updatedAt)}</p>
          </div>
        ) : (
          <LockedValue label="업데이트 시각" />
        )}
      </div>
    </section>
  );
}
