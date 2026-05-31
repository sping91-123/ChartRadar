// 공통 레이더 판단 모델을 Free와 Pro 노출 정책에 맞춰 보여주는 패널.
import { ArrowDownRight, ArrowUpRight, Eye, Gauge, Lock, ShieldAlert } from "lucide-react";
import type { RadarFinalView, RadarInsight } from "@/lib/radarInsight";
import { AppSurface, MetricRow, PanelCard, SectionHeader, StatusPill } from "@/components/ui/DesignPrimitives";

type SummaryMetricTone = "long" | "short" | "watch" | "risk" | "locked" | "info";

export interface RadarInsightSummaryMetric {
  label: string;
  value: string;
  detail?: string;
  tone?: SummaryMetricTone;
}

interface RadarInsightPanelProps {
  insight: RadarInsight;
  isPro: boolean;
  className?: string;
  strengthHelp?: string[];
  variant?: "default" | "cryptoSummary";
  priceLabel?: string;
  dataStatusLabel?: string;
  summaryMetrics?: RadarInsightSummaryMetric[];
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
    <div className={`border-y py-3 ${locked ? "border-white/10 opacity-85" : "border-white/10"}`}>
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
    <div className="border-y border-white/10 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-black text-slate-200">{label}</p>
        <Lock size={14} className="text-cyan-200" aria-hidden />
      </div>
      <p className="mt-2 text-xs font-bold leading-5 text-slate-500">상세 조건, 무효화 기준, 세부 리스크는 Pro에서 확인할 수 있습니다.</p>
    </div>
  );
}

function finalViewTone(finalView: RadarFinalView): SummaryMetricTone {
  if (finalView === "long_bias") return "long";
  if (finalView === "short_bias") return "short";
  if (finalView === "high_risk") return "risk";
  return "watch";
}

function compactFinalViewLabel(finalView: RadarFinalView) {
  if (finalView === "long_bias") return "상승 쪽 우세";
  if (finalView === "short_bias") return "하락 쪽 우세";
  if (finalView === "high_risk") return "리스크 확인";
  return "방향 애매함";
}

function riskStateLabel(insight: RadarInsight) {
  if (insight.finalView === "high_risk") return "리스크 높음";
  if (insight.risks.length >= 2) return "리스크 점검";
  if (insight.risks.length === 1) return "리스크 보통";
  return "리스크 낮음";
}

function compactLine(value: string | undefined, maxLength = 92) {
  if (!value) return "-";
  return value.length > maxLength ? `${value.slice(0, maxLength).trim()}…` : value;
}

function defaultNextChecks(insight: RadarInsight, isPro: boolean) {
  if (!isPro) return ["새 포지션 기준 아직 부족", "구체 가격 기준은 Pro에서 확인"];
  if (insight.finalView === "long_bias") return [insight.longConditions[0], insight.invalidationConditions[0]].filter(Boolean);
  if (insight.finalView === "short_bias") return [insight.shortConditions[0], insight.invalidationConditions[0]].filter(Boolean);
  if (insight.finalView === "high_risk") return [insight.risks[0], insight.invalidationConditions[0]].filter(Boolean);
  return [insight.longConditions[0], insight.shortConditions[0]].filter(Boolean);
}

function CompactRadarInsightPanel({
  insight,
  isPro,
  className = "",
  strengthHelp,
  priceLabel,
  dataStatusLabel,
  summaryMetrics = []
}: RadarInsightPanelProps) {
  const statusTone = finalViewTone(insight.finalView);
  const keyReasons = listItems(insight.keyReasons, 3);
  const nextChecks = defaultNextChecks(insight, isPro).slice(0, 2);
  const strengthHelpText = strengthHelp?.join(" ");
  const compactStatusItems: Array<{ label: string; value: string; tone: SummaryMetricTone }> = [
    { label: "현재 판단", value: compactFinalViewLabel(insight.finalView), tone: statusTone },
    { label: "판단 강도", value: `판단 강도 ${insight.strengthLabel}`, tone: "info" },
    { label: "리스크 상태", value: riskStateLabel(insight), tone: insight.finalView === "high_risk" ? "risk" : "watch" }
  ];

  return (
    <section className={`overflow-hidden border-y border-ui-line py-4 ${className}`}>
      <SectionHeader
        eyebrow="오늘 먼저 볼 판단"
        title={insight.symbol}
        description={insight.timeframe ? `${insight.timeframe} 기준` : "종합 기준"}
      />

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {compactStatusItems.map((item) => (
              <div key={item.label} className="min-w-0 border-t border-ui-line py-2 first:border-t-0 sm:inline-flex sm:items-center sm:gap-2 sm:border-t-0 sm:py-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ui-subtle">{item.label}</p>
                <div className="mt-1 sm:mt-0">
                  <StatusPill tone={item.tone} className="whitespace-nowrap">{item.value}</StatusPill>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 hidden max-w-3xl text-sm leading-6 text-ui-muted [word-break:keep-all] sm:block">{compactLine(insight.summary, 128)}</p>
        </div>

        <div className="border-t border-ui-line pt-3 lg:border-t-0 lg:pt-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Gauge size={16} className="text-ui-brand" aria-hidden />
              <p className="text-ui-label font-semibold text-ui-subtle">판단 강도</p>
              {strengthHelpText ? (
                <span
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-ui-lineStrong bg-ui-panel text-[11px] font-semibold text-ui-muted"
                  title={strengthHelpText}
                  aria-label={`판단 강도 도움말: ${strengthHelpText}`}
                >
                  ?
                </span>
              ) : null}
            </div>
            <p className="text-sm font-semibold text-ui-text">{insight.strengthLabel}</p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-ui-panel">
            <div className={`h-full rounded-full ${strengthClass(insight.finalView)}`} style={{ width: `${Math.max(4, insight.strength)}%` }} />
          </div>
          <p className="mt-2 text-xs font-semibold text-ui-muted">{insight.strength} / 100</p>
          <div className="mt-3">
            <MetricRow label="현재가" value={priceLabel ?? "-"} />
            {dataStatusLabel ? <MetricRow label="업데이트" value={dataStatusLabel} /> : null}
          </div>
        </div>
      </div>

      {summaryMetrics.length ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {summaryMetrics.slice(0, 3).map((metric) => (
            <div key={metric.label} className="border-t border-ui-line pt-3">
              <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">{metric.label}</p>
              <p className="mt-2 text-sm font-semibold leading-5 text-ui-text [word-break:keep-all]">{compactLine(metric.value, 44)}</p>
              {metric.detail ? <p className="mt-1 text-xs leading-5 text-ui-muted [word-break:keep-all]">{metric.detail}</p> : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="border-t border-ui-line pt-3">
          <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">확인한 내용</p>
          <ul className="mt-2 divide-y divide-ui-line">
            {keyReasons.map((item) => (
              <li key={item} className="py-2 text-sm font-semibold leading-5 text-ui-text [word-break:keep-all]">
                {compactLine(item, 72)}
              </li>
            ))}
          </ul>
        </div>
        <div className="border-t border-ui-line pt-3">
          <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">다음 확인</p>
          <ul className="mt-2 divide-y divide-ui-line">
            {nextChecks.length ? (
              nextChecks.map((item) => (
                <li key={item} className="py-2 text-sm font-semibold leading-5 text-ui-text [word-break:keep-all]">
                  {compactLine(item, 56)}
                </li>
              ))
            ) : (
              <li className="py-2 text-sm font-semibold leading-5 text-ui-text">확인 필요</li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function RadarInsightPanel({
  insight,
  isPro,
  className = "",
  strengthHelp,
  variant = "default",
  priceLabel,
  dataStatusLabel,
  summaryMetrics
}: RadarInsightPanelProps) {
  if (variant === "cryptoSummary") {
    return (
      <CompactRadarInsightPanel
        insight={insight}
        isPro={isPro}
        className={className}
        strengthHelp={strengthHelp}
        variant={variant}
        priceLabel={priceLabel}
        dataStatusLabel={dataStatusLabel}
        summaryMetrics={summaryMetrics}
      />
    );
  }

  const keyReasons = listItems(insight.keyReasons, isPro ? null : 1);
  const risks = listItems(insight.risks, isPro ? null : 1);
  const strengthHelpText = strengthHelp?.join(" ");

  return (
    <section className={`relative overflow-hidden border-y border-surface-line py-4 ${className}`}>
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

        <div className="w-full shrink-0 border-y border-white/10 py-3 lg:w-64">
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
            <ul className="mt-3 space-y-1.5 border-y border-cyan-300/15 py-3">
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
          title="확인한 내용"
          items={keyReasons}
          locked={!isPro && insight.keyReasons.length > 1}
          previewText="Basic에서는 방향 요약만 제공합니다. 나머지 내용은 Pro에서 전체 맥락으로 확인합니다."
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
          <div className="border-y border-white/10 py-3">
            <p className="text-xs font-black text-slate-200">다음 확인 기준</p>
            <p className="mt-2 text-xs font-bold leading-5 text-slate-300 [word-break:keep-all]">{insight.nextAction}</p>
          </div>
        ) : (
          <LockedValue label="다음 확인 기준" />
        )}
        {isPro ? (
          <div className="border-y border-white/10 py-3">
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
