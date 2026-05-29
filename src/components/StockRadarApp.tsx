"use client";
// 글로벌 시장 주요 종목을 차트와 기술지표 레이더로 보여주는 화면.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { CandlestickSeries, createChart, type IChartApi, type ISeriesApi, type Time } from "lightweight-charts";
import { Activity, AlertTriangle, BarChart3, Bookmark, BookmarkCheck, Clock3, Compass, Gauge, Loader2, RefreshCw, Search, Shield, Sparkles, Target } from "lucide-react";
import { BeginnerActionGuide, type BeginnerGuideStep, type BeginnerGuideTone } from "@/components/BeginnerActionGuide";
import { RadarInsightPanel } from "@/components/RadarInsightPanel";
import { TechnicalRadarPanel } from "@/components/TechnicalRadarPanel";
import { analyzeTimeframe, chartTimeframes, type Candle, type ChartTimeframe, type DirectionState, type TimeframeAnalysis } from "@/lib/marketAnalysis";
import { analyzeTechnicalRadar, type TechnicalRadarReport } from "@/lib/technicalRadar";
import type { StockSymbolInfo } from "@/lib/stockMarket";
import {
  fallbackUniverse,
  featuredSymbols,
  globalWatchlistMaxItems,
  globalWatchlistStorageKey,
  groupLabels,
  groupOrder,
  radarModes,
  type GlobalRadarMode,
  type LoadState
} from "@/components/global/stockRadarConfig";
import {
  directionClass,
  directionLabel,
  directionTone,
  formatAgeByTimeframe,
  formatIndexAge,
  formatKstChartTime,
  formatPercent,
  formatPrice,
  formatZonePrice,
  getGlobalSessionState,
  groupChecklist,
  groupPlaybook,
  symbolName,
  toneBadgeClass
} from "@/components/global/stockRadarDisplay";
import { getUsageGate, recordUsageEvent } from "@/lib/usageMeter";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";
import { hasMarketEntitlement } from "@/lib/billing";
import { getWatchlistLimit } from "@/lib/watchlist";
import { withSupabaseAuth } from "@/lib/authFetch";
import { getChartThemeOptions, observeChartThemeChange } from "@/lib/chartTheme";
import { technicalRadarReportToRadarInsight, visibleRadarInsightForPlan } from "@/lib/radarInsight";

function readGlobalWatchlist() {
  if (typeof window === "undefined") return ["SPY", "QQQ", "NVDA"];

  try {
    const raw = window.localStorage.getItem(globalWatchlistStorageKey);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (!Array.isArray(parsed)) return ["SPY", "QQQ", "NVDA"];
    const symbols = parsed.filter((item): item is string => typeof item === "string").slice(0, globalWatchlistMaxItems);
    return symbols.length ? symbols : ["SPY", "QQQ", "NVDA"];
  } catch {
    return ["SPY", "QQQ", "NVDA"];
  }
}

function writeGlobalWatchlist(symbols: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(globalWatchlistStorageKey, JSON.stringify(symbols.slice(0, globalWatchlistMaxItems)));
}

function GlobalAssetChecklist({ selectedInfo }: { selectedInfo: StockSymbolInfo | null }) {
  const checklist = groupChecklist(selectedInfo?.group);
  const items = [
    { icon: Compass, title: "동반 체크", body: checklist.compare },
    { icon: Shield, title: "위험 체크", body: checklist.risk },
    { icon: Target, title: "판단 순서", body: checklist.action }
  ];

  return (
    <div className="mt-3 grid divide-y divide-white/10 md:grid-cols-3 md:divide-x md:divide-y-0">
      {items.map(({ icon: Icon, title, body }) => (
        <article key={title} className="px-3 py-3">
          <div className="flex items-center gap-2">
            <Icon className="text-cyan-300" size={15} aria-hidden />
            <p className="text-xs font-black text-white">{title}</p>
          </div>
          <p className="mt-2 text-[11px] font-bold leading-5 text-slate-400 [word-break:keep-all]">{body}</p>
        </article>
      ))}
    </div>
  );
}

function GlobalPlaybook({
  report,
  latest,
  changePercent,
  selectedInfo,
  sessionState
}: {
  report: TechnicalRadarReport | null;
  latest: Candle | null;
  changePercent: number | null;
  selectedInfo: StockSymbolInfo | null;
  sessionState: ReturnType<typeof getGlobalSessionState> | null;
}) {
  const supportDistance = report?.supportResistance.supportDistancePercent ?? null;
  const resistanceDistance = report?.supportResistance.resistanceDistancePercent ?? null;
  const tone = directionTone(report);
  const riskScore = report ? Math.min(100, Math.max(0, report.fearGreed.score + Math.max(0, report.bearishCount - report.bullishCount) * 6)) : null;
  const focus =
    tone === "bullish"
      ? "상승 추세 유지 여부"
      : tone === "bearish"
        ? "하락 압력 방어 여부"
        : "방향 확정 전 기준선 반응";
  const basis =
    resistanceDistance !== null && resistanceDistance <= 1.2
      ? "저항선이 가깝습니다. 돌파 후 안착하지 못하면 단기 되돌림을 먼저 의심하세요."
      : supportDistance !== null && supportDistance <= 1.2
        ? "지지선이 가깝습니다. 지지 반응과 거래량 회복이 같이 나오는지 보세요."
        : "지지와 저항 사이 중간 구간입니다. 추격보다 다음 기준선까지의 여유를 먼저 확인하세요.";

  return (
    <div className="mt-5 grid gap-3 lg:grid-cols-4">
      <article className="border-t border-white/10 py-4 first:border-t-0">
        <Clock3 size={20} aria-hidden />
        <p className="mt-3 text-xs font-black opacity-80">미국장 구간</p>
        <h3 className="mt-2 text-base font-black text-white">{sessionState?.title ?? "미국장 시간 확인 중"}</h3>
        <p className="mt-2 text-xs leading-5 text-slate-300">{sessionState?.detail ?? "현재 한국 시간 기준 미국장 구간을 확인하고 있습니다."}</p>
      </article>

      <article className="border-t border-white/10 py-4 first:border-t-0">
        <Compass size={20} aria-hidden />
        <p className="mt-3 text-xs font-black opacity-80">먼저 볼 것</p>
        <h3 className="mt-2 text-base font-black text-white">{focus}</h3>
        <p className="mt-2 text-xs leading-5 text-slate-300">
          {selectedInfo?.symbol ?? "선택 자산"} {latest ? formatPrice(latest.close) : "가격 확인 중"} · {formatPercent(changePercent)}
        </p>
      </article>

      <article className="border-t border-white/10 py-4 first:border-t-0">
        <Target className="text-cyan-300" size={20} aria-hidden />
        <p className="mt-3 text-xs font-black text-slate-400">기준선</p>
        <h3 className="mt-2 text-base font-black text-white">기준선 행동</h3>
        <p className="mt-2 text-xs leading-5 text-slate-300">{basis}</p>
      </article>

      <article className="border-t border-white/10 py-4 first:border-t-0">
        <Shield className="text-cyan-300" size={20} aria-hidden />
        <p className="mt-3 text-xs font-black text-slate-400">위험 메모</p>
        <h3 className="mt-2 text-base font-black text-white">위험도 {riskScore === null ? "확인 중" : `${Math.round(riskScore)}%`}</h3>
        <p className="mt-2 text-xs leading-5 text-slate-300">{groupPlaybook(selectedInfo?.group)}</p>
      </article>
    </div>
  );
}

function beginnerToneFromTechnical(tone: DirectionState): BeginnerGuideTone {
  if (tone === "bullish") return "success";
  if (tone === "bearish") return "danger";
  if (tone === "neutral") return "warning";
  return "neutral";
}

function buildGlobalBeginnerSteps(
  report: TechnicalRadarReport | null,
  selectedInfo: StockSymbolInfo | null,
  sessionState: ReturnType<typeof getGlobalSessionState> | null
): BeginnerGuideStep[] {
  const tone = directionTone(report);
  const checklist = groupChecklist(selectedInfo?.group);
  const selectedLabel = selectedInfo ? `${selectedInfo.symbol} ${selectedInfo.name}` : "선택 자산";
  const supportDistance = report?.supportResistance.supportDistancePercent ?? null;
  const resistanceDistance = report?.supportResistance.resistanceDistancePercent ?? null;
  const distanceMemo =
    resistanceDistance !== null && resistanceDistance <= 1.2
      ? "저항선이 가까우면 돌파 후 안착 여부를 먼저 봅니다."
      : supportDistance !== null && supportDistance <= 1.2
        ? "지지선이 가까우면 반등과 거래량 회복이 같이 나오는지 확인합니다."
        : "지지와 저항 사이 중간 구간이면 기준선까지 기다리는 편이 더 명확합니다.";

  return [
    {
      label: "1. 시장 시간",
      title: sessionState?.title ?? "미국장 시간 확인",
      body: sessionState?.detail ?? "현재 한국 시간 기준 미국장 구간을 확인하고 있습니다.",
      tone: "info"
    },
    {
      label: "2. 방향 압축",
      title: tone === "bullish" ? "상승 우위 유지 확인" : tone === "bearish" ? "하락 압력 방어 확인" : "방향 확정 대기",
      body: report?.summary ?? `${selectedLabel} 캔들이 충분히 쌓이면 추세, 모멘텀, 변동성을 요약합니다.`,
      tone: beginnerToneFromTechnical(tone)
    },
    {
      label: "3. 실행 전 차단",
      title: "지수, 섹터, 종목 순서",
      body: `${checklist.action} ${distanceMemo}`,
      tone: "warning"
    }
  ];
}

function GlobalBeginnerGuide({
  report,
  selectedInfo,
  sessionState
}: {
  report: TechnicalRadarReport | null;
  selectedInfo: StockSymbolInfo | null;
  sessionState: ReturnType<typeof getGlobalSessionState> | null;
}) {
  return (
    <div className="mt-5">
      <BeginnerActionGuide
        eyebrow="글로벌 초보자용"
        title="글로벌은 이 순서로 좁혀가면 됩니다"
        summary="해외 종목은 단독 차트보다 시장 시간, 지수 방향, 섹터 흐름을 같이 봐야 판단이 단순해집니다. 아래 3단계를 먼저 보고 세부 지표로 내려가세요."
        steps={buildGlobalBeginnerSteps(report, selectedInfo, sessionState)}
        checklist={[
          "지수와 선택 종목 방향이 같은지 확인",
          "가까운 지지·저항까지 남은 폭 확인",
          "지표 발표나 개장 직후 급변 구간인지 확인"
        ]}
        help="글로벌 레이더는 미국장 시간대, 기술지표 방향, 선택 자산의 그룹 특성을 합쳐 확인 순서를 정리합니다. 종목만 강하고 지수나 섹터가 약하면 판단 신뢰도가 낮아집니다."
      />
    </div>
  );
}

function StockSnapshot({
  report,
  latest,
  changePercent
}: {
  report: TechnicalRadarReport | null;
  latest: Candle | null;
  changePercent: number | null;
}) {
  const tone = directionTone(report);
  const support = report?.supportResistance.support ?? null;
  const resistance = report?.supportResistance.resistance ?? null;

  return (
    <div className="grid gap-3 lg:grid-cols-4">
      <div className="border-y border-white/10 py-4 lg:col-span-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] opacity-80">세부 근거 요약</p>
            <h3 className="mt-2 text-2xl font-black text-white">기술지표 근거 분포</h3>
          </div>
          <Gauge size={24} aria-hidden />
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-200">
          상단 판단에 사용된 상승, 하락, 횡보 근거 수와 가까운 가격 기준선을 분리해 확인합니다.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="border-t border-white/10 px-2 py-2 first:border-t-0 sm:border-l sm:border-t-0 sm:first:border-l-0">
            <p className="text-lg font-black text-emerald-300">{report?.bullishCount ?? "-"}</p>
            <p className="text-[11px] font-bold text-slate-300">상승 근거</p>
          </div>
          <div className="border-t border-white/10 px-2 py-2 first:border-t-0 sm:border-l sm:border-t-0 sm:first:border-l-0">
            <p className="text-lg font-black text-rose-300">{report?.bearishCount ?? "-"}</p>
            <p className="text-[11px] font-bold text-slate-300">하락 근거</p>
          </div>
          <div className="border-t border-white/10 px-2 py-2 first:border-t-0 sm:border-l sm:border-t-0 sm:first:border-l-0">
            <p className="text-lg font-black text-slate-200">{report?.neutralCount ?? "-"}</p>
            <p className="text-[11px] font-bold text-slate-300">횡보 근거</p>
          </div>
        </div>
      </div>

      <div className="border-y border-white/10 py-4">
        <Activity className="text-cyan-300" size={20} aria-hidden />
        <p className="mt-3 text-xs font-bold text-slate-400">현재가와 변동</p>
        <p className="mt-1 text-2xl font-black text-white">{latest ? formatPrice(latest.close) : "미확인"}</p>
        <p className={`mt-1 text-sm font-black ${changePercent !== null && changePercent >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
          {formatPercent(changePercent)}
        </p>
      </div>

      <div className="border-y border-white/10 py-4">
        <Shield className="text-cyan-300" size={20} aria-hidden />
        <p className="mt-3 text-xs font-bold text-slate-400">가까운 기준선</p>
        <p className="mt-1 text-sm font-black text-emerald-200">지지 {formatPrice(support)}</p>
        <p className="mt-1 text-sm font-black text-rose-200">저항 {formatPrice(resistance)}</p>
      </div>

      {report && report.fearGreed.score >= 75 ? (
        <div className="border-y border-amber-300/25 py-4 lg:col-span-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 shrink-0 text-amber-300" size={18} aria-hidden />
            <p className="text-sm leading-6 text-amber-100">
              캔들 기반 심리 참고값이 높은 편입니다. 추세가 강해도 과열 구간에서는 추격보다 눌림, 지지선, 거래량 확인이 더 중요합니다.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ictDirectionLabel(direction: "bullish" | "bearish") {
  return direction === "bullish" ? "상승" : "하락";
}

function premiumDiscountLabel(value: TimeframeAnalysis["premiumDiscount"]) {
  if (value === "premium") return "프리미엄";
  if (value === "discount") return "디스카운트";
  if (value === "equilibrium") return "균형가";
  return "미확인";
}

function oteZoneLabel(value: TimeframeAnalysis["oteZone"]) {
  if (value === "long") return "롱 OTE";
  if (value === "short") return "숏 OTE";
  return "OTE 밖";
}

function pocPositionLabel(value: TimeframeAnalysis["volumeProfile"]) {
  if (!value) return "POC 미확인";
  if (value.position === "above") return "POC 위";
  if (value.position === "below") return "POC 아래";
  return "POC 근처";
}

function IctStatusCard({
  title,
  value,
  detail,
  tone = "neutral"
}: {
  title: string;
  value: string;
  detail: string;
  tone?: DirectionState;
}) {
  return (
    <article className="border-t border-white/10 py-3 first:border-t-0">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] opacity-75">{title}</p>
      <h4 className="mt-2 text-base font-black text-white">{value}</h4>
      <p className="mt-2 text-xs leading-5 text-slate-300">{detail}</p>
    </article>
  );
}

function GlobalIctPanel({ analysis, timeframe, candlesLength }: { analysis: TimeframeAnalysis; timeframe: ChartTimeframe; candlesLength: number }) {
  const scoreTone: DirectionState = analysis.score >= 1.2 ? "bullish" : analysis.score <= -1.2 ? "bearish" : "neutral";
  const scoreLabel = analysis.score >= 1.2 ? "상승 구조 우세" : analysis.score <= -1.2 ? "하락 구조 우세" : "구조 관찰";
  const latestOb = analysis.latestOb;
  const latestFvg = analysis.latestFvg;
  const latestSweep = analysis.latestSweep;
  const latestCisd = analysis.latestCisd;
  const latestDisplacement = analysis.latestDisplacement;

  return (
    <section className="border-y border-surface-line py-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-accent-blue">ICT Radar</p>
          <h3 className="mt-1 text-xl font-black text-white">{timeframe} 구조 판독</h3>
        </div>
        <span className={`inline-flex min-h-8 items-center text-xs font-black ${directionClass(scoreTone).replace(/bg-[^ ]+/g, "").replace(/border-[^ ]+/g, "")}`}>
          {scoreLabel} · {analysis.score > 0 ? "+" : ""}
          {analysis.score.toFixed(2)}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <IctStatusCard
          title="MSB"
          value={directionLabel(analysis.msb)}
          detail={
            analysis.latestMsbEvent
              ? `${formatPrice(analysis.latestMsbEvent.level)} 기준 · ${formatIndexAge(analysis.latestMsbEvent.index, candlesLength, timeframe)}`
              : "현재 구조 방향을 기준으로 표시합니다."
          }
          tone={analysis.msb}
        />
        <IctStatusCard
          title="CHoCH"
          value={directionLabel(analysis.choch)}
          detail={
            analysis.latestChochEvent
              ? `${formatPrice(analysis.latestChochEvent.level)} 기준 · ${formatIndexAge(analysis.latestChochEvent.index, candlesLength, timeframe)}`
              : "최근 단기 구조 전환을 기준으로 표시합니다."
          }
          tone={analysis.choch}
        />
        <IctStatusCard
          title="OB"
          value={latestOb ? `${ictDirectionLabel(latestOb.direction)} OB ${analysis.inOb ? "내부" : "외부"}` : "최근 OB 미확인"}
          detail={latestOb ? `${formatZonePrice(latestOb.bottom, latestOb.top)} · ${formatAgeByTimeframe(latestOb.age, timeframe)}` : "유효한 오더블록이 아직 선명하지 않습니다."}
          tone={latestOb?.direction ?? "neutral"}
        />
        <IctStatusCard
          title="FVG"
          value={latestFvg ? `${ictDirectionLabel(latestFvg.direction)} ${latestFvg.state === "ifvg" ? "iFVG" : "FVG"} ${analysis.inFvg ? "내부" : "외부"}` : "최근 FVG 미확인"}
          detail={latestFvg ? `${formatZonePrice(latestFvg.bottom, latestFvg.top)} · ${formatAgeByTimeframe(latestFvg.age, timeframe)}` : "강한 가격 불균형 구간이 아직 선명하지 않습니다."}
          tone={latestFvg?.direction ?? "neutral"}
        />
        <IctStatusCard
          title="Sweep"
          value={latestSweep ? `${latestSweep.direction === "bullish" ? "저점 스윕" : "고점 스윕"}` : "스윕 미확인"}
          detail={latestSweep ? `${formatPrice(latestSweep.level)} · ${formatAgeByTimeframe(latestSweep.age, timeframe)}` : "최근 유동성 스윕이 뚜렷하지 않습니다."}
          tone={latestSweep?.direction ?? "neutral"}
        />
        <IctStatusCard
          title="CISD"
          value={latestCisd ? `${ictDirectionLabel(latestCisd.direction)} CISD` : "CISD 미확인"}
          detail={latestCisd ? `${formatPrice(latestCisd.level)} · ${formatAgeByTimeframe(latestCisd.age, timeframe)}` : "OB 반응 이후 상태 변화가 아직 확인되지 않았습니다."}
          tone={latestCisd?.direction ?? "neutral"}
        />
        <IctStatusCard
          title="PD / OTE"
          value={`${premiumDiscountLabel(analysis.premiumDiscount)} · ${oteZoneLabel(analysis.oteZone)}`}
          detail={
            analysis.oteLevels
              ? `롱 ${formatZonePrice(analysis.oteLevels.longLow, analysis.oteLevels.longHigh)} · 숏 ${formatZonePrice(analysis.oteLevels.shortLow, analysis.oteLevels.shortHigh)}`
              : "최근 딜링레인지 기준을 확인 중입니다."
          }
          tone={analysis.oteZone === "long" ? "bullish" : analysis.oteZone === "short" ? "bearish" : "neutral"}
        />
        <IctStatusCard
          title="POC / EMA"
          value={`${pocPositionLabel(analysis.volumeProfile)} · EMA200 ${analysis.ema200Side === "above" ? "위" : analysis.ema200Side === "below" ? "아래" : "미확인"}`}
          detail={`POC ${analysis.volumeProfile ? formatPrice(analysis.volumeProfile.poc) : "미확인"} · EMA200 ${formatPrice(analysis.ema200Value)}`}
          tone={analysis.ema200Side === "above" ? "bullish" : analysis.ema200Side === "below" ? "bearish" : "neutral"}
        />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <IctStatusCard
          title="Displacement"
          value={latestDisplacement ? `${ictDirectionLabel(latestDisplacement.direction)} 변위` : "변위 미확인"}
          detail={latestDisplacement ? `강도 ${latestDisplacement.strength}점 · ${formatAgeByTimeframe(latestDisplacement.age, timeframe)}` : "강한 몸통 변위 캔들이 최근 구간에 뚜렷하지 않습니다."}
          tone={latestDisplacement?.direction ?? "neutral"}
        />
        <IctStatusCard
          title="Buy-side"
          value={analysis.buySideLiquidity ? formatPrice(analysis.buySideLiquidity.level) : "미확인"}
          detail={analysis.buySideLiquidity ? `${formatAgeByTimeframe(analysis.buySideLiquidity.age, timeframe)} · 거리 ${analysis.buySideLiquidity.distancePercent.toFixed(2)}%` : "가까운 매수 유동성 풀을 찾지 못했습니다."}
          tone="neutral"
        />
        <IctStatusCard
          title="Sell-side"
          value={analysis.sellSideLiquidity ? formatPrice(analysis.sellSideLiquidity.level) : "미확인"}
          detail={analysis.sellSideLiquidity ? `${formatAgeByTimeframe(analysis.sellSideLiquidity.age, timeframe)} · 거리 ${analysis.sellSideLiquidity.distancePercent.toFixed(2)}%` : "가까운 매도 유동성 풀을 찾지 못했습니다."}
          tone="neutral"
        />
      </div>
    </section>
  );
}

function GlobalRadarControlDock({
  timeframe,
  onTimeframeChange,
  radarMode,
  onRadarModeChange,
  showMobileDock
}: {
  timeframe: ChartTimeframe;
  onTimeframeChange: (value: ChartTimeframe) => void;
  radarMode: GlobalRadarMode;
  onRadarModeChange: (value: GlobalRadarMode) => void;
  showMobileDock: boolean;
}) {
  const renderContent = () => (
    <>
      <div className="grid grid-cols-5 gap-1.5">
        {chartTimeframes.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onTimeframeChange(item)}
            className={`min-h-10 border-b-2 px-2 text-xs font-black transition ${
              timeframe === item
                ? "border-accent-blue text-accent-blue"
                : "border-transparent bg-transparent text-slate-300 hover:text-white"
            }`}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {radarModes.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => onRadarModeChange(item.value)}
            className={`min-h-9 border-b-2 px-2 text-xs font-black transition ${
              radarMode === item.value
                ? "border-white text-white"
                : "border-transparent bg-transparent text-slate-300 hover:text-white"
            }`}
            title={item.caption}
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  );

  return (
    <>
      <div
        className={`fixed inset-x-2 bottom-[calc(0.5rem+env(safe-area-inset-bottom))] z-40 mx-auto border-t border-surface-line bg-slate-950 p-2 shadow-none sm:hidden ${showMobileDock ? "block" : "hidden"}`}
        aria-label="글로벌 자산레이더 모바일 조작 패널"
      >
        {renderContent()}
      </div>
      <div
        className="sticky top-3 z-20 mx-auto hidden max-w-5xl border-y border-surface-line bg-slate-950 py-2 sm:block"
        aria-label="글로벌 자산레이더 조작 패널"
      >
        {renderContent()}
      </div>
    </>
  );
}

export function StockRadarApp() {
  const { profile } = useSupabaseAuth();
  const pathname = usePathname();
  const isPaid = hasMarketEntitlement(profile?.plan, "stocks");
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartApiRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [symbol, setSymbol] = useState("QQQ");
  const [timeframe, setTimeframe] = useState<ChartTimeframe>("1d");
  const [radarMode, setRadarMode] = useState<GlobalRadarMode>("combined");
  const [universe, setUniverse] = useState<StockSymbolInfo[]>(fallbackUniverse);
  const [selectedGroup, setSelectedGroup] = useState<StockSymbolInfo["group"] | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [state, setState] = useState<LoadState>({ status: "idle" });
  const [sessionState, setSessionState] = useState<ReturnType<typeof getGlobalSessionState> | null>(null);
  const [savedSymbols, setSavedSymbols] = useState<string[]>([]);
  const watchlistLimit = getWatchlistLimit(profile?.plan ?? "free");
  const showMobileDock = pathname === "/global/assets";

  const selectedInfo = useMemo(() => universe.find((item) => item.symbol === symbol) ?? null, [symbol, universe]);
  const featuredItems = useMemo(
    () => featuredSymbols.map((featuredSymbol) => universe.find((item) => item.symbol === featuredSymbol)).filter(Boolean) as StockSymbolInfo[],
    [universe]
  );
  const visibleUniverse = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return universe
      .filter((item) => selectedGroup === "all" || item.group === selectedGroup)
      .filter((item) => !query || item.symbol.toLowerCase().includes(query) || item.name.toLowerCase().includes(query))
      .slice(0, 48);
  }, [searchQuery, selectedGroup, universe]);
  const savedItems = useMemo(
    () => savedSymbols.map((savedSymbol) => universe.find((item) => item.symbol === savedSymbol)).filter(Boolean) as StockSymbolInfo[],
    [savedSymbols, universe]
  );
  const visibleSavedItems = useMemo(() => savedItems.slice(0, watchlistLimit), [savedItems, watchlistLimit]);
  const isSavedSymbol = savedSymbols.includes(symbol);
  const canSaveSelectedSymbol = isSavedSymbol || savedSymbols.length < watchlistLimit;

  const toggleSavedSymbol = useCallback((targetSymbol: string) => {
    setSavedSymbols((current) => {
      const normalized = targetSymbol.toUpperCase();
      if (!current.includes(normalized) && current.length >= watchlistLimit) return current;
      const next = current.includes(normalized)
        ? current.filter((item) => item !== normalized)
        : [normalized, ...current].slice(0, globalWatchlistMaxItems);
      writeGlobalWatchlist(next);
      return next;
    });
  }, [watchlistLimit]);

  const load = useCallback(async () => {
    const usageGate = getUsageGate("stockRadar", isPaid);
    if (!usageGate.allowed) {
      setState({ status: "error", message: usageGate.message });
      return;
    }

    setState({ status: "loading" });
    try {
      const response = await fetch(
        `/api/stocks/candles?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`,
        await withSupabaseAuth({ cache: "no-store" })
      );
      const data = (await response.json().catch(() => ({}))) as {
        candles?: Candle[];
        dataSource?: string;
        cachedAt?: number;
        universe?: StockSymbolInfo[];
        error?: string;
      };

      if (Array.isArray(data.universe) && data.universe.length) setUniverse(data.universe);
      if (!response.ok) throw new Error("글로벌 시장 흐름을 잠시 확인하지 못했습니다. 잠시 뒤 다시 확인해 주세요.");
      if (!Array.isArray(data.candles) || data.candles.length === 0) {
        throw new Error("이 자산의 최근 가격 흐름을 잠시 확인하지 못했습니다. 다른 자산을 먼저 확인해 주세요.");
      }

      setState({
        status: "ready",
        candles: data.candles,
        dataSource: data.dataSource ?? "글로벌 시장 데이터",
        cachedAt: data.cachedAt ?? Date.now()
      });
      recordUsageEvent("stockRadar");
    } catch (error) {
      const message = error instanceof Error ? error.message : "글로벌 시장 흐름을 잠시 확인하지 못했습니다.";
      setState({ status: "error", message });
    }
  }, [isPaid, symbol, timeframe]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setSessionState(getGlobalSessionState());
    const timer = window.setInterval(() => setSessionState(getGlobalSessionState()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setSavedSymbols(readGlobalWatchlist());
  }, []);

  useEffect(() => {
    if (!chartRef.current) return;
    const chartThemeOptions = getChartThemeOptions();

    const chart = createChart(chartRef.current, {
      height: 360,
      ...chartThemeOptions,
      localization: {
        timeFormatter: (time: Time) => formatKstChartTime(time, timeframe)
      },
      timeScale: {
        ...chartThemeOptions.timeScale,
        timeVisible: timeframe !== "1d",
        tickMarkFormatter: (time: Time) => formatKstChartTime(time, timeframe)
      }
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444"
    });

    chartApiRef.current = chart;
    candleSeriesRef.current = series;
    const stopObservingTheme = observeChartThemeChange(() => {
      const nextThemeOptions = getChartThemeOptions();
      chart.applyOptions({
        ...nextThemeOptions,
        timeScale: {
          ...nextThemeOptions.timeScale,
          timeVisible: timeframe !== "1d",
          tickMarkFormatter: (time: Time) => formatKstChartTime(time, timeframe)
        }
      });
    });

    const resizeObserver = new ResizeObserver(() => {
      if (!chartRef.current) return;
      chart.applyOptions({ width: chartRef.current.clientWidth });
    });
    resizeObserver.observe(chartRef.current);

    return () => {
      stopObservingTheme();
      resizeObserver.disconnect();
      chart.remove();
      chartApiRef.current = null;
      candleSeriesRef.current = null;
    };
  }, [timeframe]);

  useEffect(() => {
    if (state.status !== "ready" || !candleSeriesRef.current || !chartApiRef.current) return;
    candleSeriesRef.current.setData(
      state.candles.map((candle) => ({
        time: candle.time as Time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close
      }))
    );
    chartApiRef.current.timeScale().fitContent();
  }, [state]);

  const latest = state.status === "ready" ? state.candles[state.candles.length - 1] : null;
  const previous = state.status === "ready" ? state.candles[state.candles.length - 2] : null;
  const changePercent = latest && previous ? ((latest.close - previous.close) / previous.close) * 100 : null;
  const technicalReport = useMemo(() => (state.status === "ready" ? analyzeTechnicalRadar(state.candles) : null), [state]);
  const radarInsight = useMemo(
    () =>
      technicalReport
        ? technicalRadarReportToRadarInsight(technicalReport, {
            market: "global",
            symbol,
            timeframe,
            sessionNote: sessionState?.detail ?? undefined,
            groupNote: groupPlaybook(selectedInfo?.group)
          })
        : null,
    [selectedInfo?.group, sessionState?.detail, symbol, technicalReport, timeframe]
  );
  const visibleRadarInsight = useMemo(
    () => (radarInsight ? visibleRadarInsightForPlan(radarInsight, isPaid) : null),
    [isPaid, radarInsight]
  );
  const ictAnalysis = useMemo(
    () => (state.status === "ready" ? analyzeTimeframe(timeframe, state.candles, { zigLen: 5, useCloseForMsb: true }) : null),
    [state, timeframe]
  );

  return (
    <section
      id="asset-radar"
      className="scroll-mt-24 border-y border-surface-line py-5 pb-40 sm:py-6 sm:pb-36"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center text-accent-blue">
            <BarChart3 size={21} aria-hidden />
          </div>
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-accent-blue">자산레이더</p>
            <h2 className="mt-1 text-xl font-black text-white">선택 자산 상세 판단</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              글로벌 전체 판단 이후 개별 종목을 확인하는 심화 영역입니다.
              상단 대시보드의 시장 모드, 매크로 압력, 섹터 로테이션과 함께 해석하세요.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => load()}
          className="inline-flex min-h-10 items-center justify-center gap-2 border-b border-accent-blue/40 bg-transparent px-1 text-xs font-black text-accent-blue transition hover:border-accent-blue hover:text-cyan-200"
        >
          <RefreshCw size={14} aria-hidden />
          새로고침
        </button>
      </div>

      <div className="mt-5 border-y border-accent-blue/20 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.18em] text-accent-blue">
              <Sparkles size={13} aria-hidden />
              상세 확인할 글로벌 자산
            </p>
            <h3 className="mt-2 break-words text-2xl font-black text-white">
              {symbol}{" "}
              <span className="ml-2 text-base font-bold text-slate-400">{selectedInfo?.name ?? symbol}</span>
            </h3>
            <p className="mt-1 text-xs font-bold text-slate-500">
              {selectedInfo ? groupLabels[selectedInfo.group] : "관심 시장"} · {timeframe} · {radarModes.find((item) => item.value === radarMode)?.label ?? "종합"} 분석
            </p>
          </div>
          <label className="relative block lg:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} aria-hidden />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="종목 검색"
              className="h-11 w-full rounded-md border border-surface-line bg-surface-cardSoft pl-9 pr-3 text-sm font-bold text-white outline-none transition placeholder:text-slate-600 focus:border-accent-blue/70"
            />
          </label>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {featuredItems.map((item) => (
            <button
              key={item.symbol}
              type="button"
              onClick={() => {
                setSymbol(item.symbol);
                setSearchQuery("");
              }}
              className={`min-h-11 shrink-0 border-b-2 px-1 text-left transition ${
                symbol === item.symbol
                  ? "border-accent-blue text-accent-blue"
                  : "border-transparent bg-transparent text-slate-200 hover:text-white"
              }`}
            >
              <span className="block text-sm font-black">{item.symbol}</span>
              <span className={`block text-[10px] font-bold ${symbol === item.symbol ? "text-accent-blue/80" : "text-slate-500"}`}>
                {groupLabels[item.group]}
              </span>
            </button>
          ))}
        </div>

        <GlobalAssetChecklist selectedInfo={selectedInfo} />

        <div className="mt-4 border-y border-white/10 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black text-white">관심 글로벌 종목</p>
              <p className="mt-1 text-[11px] font-bold text-slate-500">
                매일 보는 ETF와 종목을 저장하면 이곳에 고정됩니다. 미국장 30초 체크 이후 개별 판단을 이어가세요.
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggleSavedSymbol(symbol)}
              disabled={!canSaveSelectedSymbol}
              className={`inline-flex min-h-9 items-center justify-center gap-1.5 border-b px-0 text-xs font-black transition disabled:cursor-not-allowed disabled:border-slate-500/30 disabled:text-slate-500 ${
                isSavedSymbol
                  ? "border-emerald-300/35 text-emerald-200"
                  : "border-accent-blue/30 text-accent-blue hover:text-cyan-100"
              }`}
            >
              {isSavedSymbol ? <BookmarkCheck size={13} aria-hidden /> : <Bookmark size={13} aria-hidden />}
              {isSavedSymbol ? "저장됨" : canSaveSelectedSymbol ? "관심 추가" : "한도 도달"}
            </button>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {visibleSavedItems.map((item) => (
              <button
                key={item.symbol}
                type="button"
                onClick={() => {
                  setSymbol(item.symbol);
                  setSearchQuery("");
                }}
                className={`min-h-10 shrink-0 border-b-2 px-1 text-left transition ${
                  symbol === item.symbol
                    ? "border-emerald-300 text-emerald-200"
                    : "border-transparent bg-transparent text-slate-200 hover:text-white"
                }`}
              >
                <span className="block text-xs font-black">{item.symbol}</span>
                <span className={`block max-w-[110px] truncate text-[10px] font-bold ${symbol === item.symbol ? "text-emerald-200/80" : "text-slate-500"}`}>
                  {item.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {(["all", ...groupOrder] as Array<StockSymbolInfo["group"] | "all">).map((group) => (
            <button
              key={group}
              type="button"
              onClick={() => setSelectedGroup(group)}
              className={`min-h-8 border-b-2 px-0 text-[11px] font-black transition ${
                selectedGroup === group
                  ? "border-white text-white"
                  : "border-transparent bg-transparent text-slate-300 hover:text-white"
              }`}
            >
              {group === "all" ? "전체" : groupLabels[group]}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {visibleUniverse.map((item) => (
            <button
              key={item.symbol}
              type="button"
              onClick={() => setSymbol(item.symbol)}
              className={`min-h-12 border-b-2 px-0 text-left transition ${
                symbol === item.symbol
                  ? "border-accent-blue text-accent-blue"
                  : "border-transparent bg-transparent text-slate-200 hover:text-white"
              }`}
            >
              <span className="block text-sm font-black">{item.symbol}</span>
              <span className={`block truncate text-[11px] font-bold ${symbol === item.symbol ? "text-accent-blue/80" : "text-slate-500"}`}>
                {item.name}
              </span>
            </button>
          ))}
        </div>
        {visibleUniverse.length === 0 ? (
          <p className="mt-3 border-y border-white/10 py-3 text-xs font-bold text-slate-500">
            검색 결과가 없습니다. 종목명이나 심볼을 조금 짧게 입력해 보세요.
          </p>
        ) : null}
      </div>

      {state.status === "ready" && radarMode !== "ict" && visibleRadarInsight ? (
        <div className="mt-5">
          <RadarInsightPanel insight={visibleRadarInsight} isPro={isPaid} />
          <div className="mt-5">
            <StockSnapshot report={technicalReport} latest={latest} changePercent={changePercent} />
          </div>
        </div>
      ) : null}

      <div className="mt-5 border-y border-surface-line py-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">선택 종목</p>
            <h3 className="mt-1 text-2xl font-black text-white">
              {symbol} <span className="text-base text-slate-500">{symbolName(symbol, universe)}</span>
            </h3>
          </div>
          {latest ? (
            <div className="text-left sm:text-right">
              <p className="text-xl font-black text-white">{formatPrice(latest.close)}</p>
              <p className={`text-xs font-bold ${changePercent !== null && changePercent >= 0 ? "text-signal-success" : "text-signal-danger"}`}>
                {changePercent === null ? "변동률 미확인" : `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}%`}
              </p>
            </div>
          ) : null}
        </div>

        <div className="relative min-h-[320px] overflow-hidden border-y border-white/10 bg-transparent sm:min-h-[360px]">
          <div ref={chartRef} className="h-[320px] w-full sm:h-[360px]" />
          {state.status === "loading" ? (
            <div className="absolute inset-0 grid place-items-center bg-slate-950/70 text-sm text-slate-300">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="animate-spin" size={16} aria-hidden />
                차트 데이터를 불러오는 중입니다.
              </span>
            </div>
          ) : null}
          {state.status === "error" ? (
            <div className="absolute inset-0 grid place-items-center bg-slate-950/80 p-4 text-center text-sm text-signal-danger">
              <div className="max-w-sm rounded-md border border-signal-danger/30 bg-signal-danger/10 p-4">
                <p className="font-black">차트 데이터를 불러오지 못했습니다.</p>
                <p className="mt-2 text-xs leading-5 text-signal-danger/90">{state.message || "잠시 후 다시 확인해 주세요."}</p>
              </div>
            </div>
          ) : null}
          {state.status === "idle" ? (
            <div className="absolute inset-0 grid place-items-center bg-slate-950/70 text-sm text-slate-400">
              차트 데이터를 준비하고 있습니다.
            </div>
          ) : null}
        </div>
      </div>

      {state.status === "ready" ? (
        <>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            현재 화면은 {state.dataSource} 가격 흐름을 한국 시간 기준으로 정리합니다.
          </p>
          {radarMode !== "technical" && ictAnalysis ? (
            <div className="mt-5">
              <GlobalIctPanel analysis={ictAnalysis} timeframe={timeframe} candlesLength={state.candles.length} />
            </div>
          ) : null}
          {radarMode !== "ict" ? (
            <div className="mt-5">
              <TechnicalRadarPanel
                candles={state.candles}
                timeframe={timeframe}
                assetLabel={selectedInfo?.name ? `${selectedInfo.name}(${symbol})` : symbol}
                intro="이동평균, MACD, RSI, 일목균형표, Supertrend, 거래량, 변동성 지표로 글로벌 자산의 방향과 과열도를 확인합니다."
              />
            </div>
          ) : null}
        </>
      ) : null}
      <GlobalRadarControlDock
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
        radarMode={radarMode}
        onRadarModeChange={setRadarMode}
        showMobileDock={showMobileDock}
      />
    </section>
  );
}
