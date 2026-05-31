"use client";
// Coin Radar 홈에서 대표 코인과 BTC 기준 시장 체력을 빠르게 요약합니다.

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, RefreshCw, TrendingUp, X } from "lucide-react";
import { ActionButton, PanelCard, SectionHeader, StatusPill } from "@/components/ui/DesignPrimitives";
import { CoinSignalConflictPanel, type CoinSignalConflictItem } from "@/components/coin/CoinSignalConflictPanel";
import {
  CoinDataFreshnessPanel,
  dataFreshnessTone,
  formatDataAge,
  type CoinDataFreshnessItem
} from "@/components/coin/CoinDataFreshnessPanel";
import { CoinEvidenceGradePanel, type CoinEvidenceGradeItem } from "@/components/coin/CoinEvidenceGradePanel";
import { CoinSignalPressurePanel, type CoinSignalPressureItem } from "@/components/coin/CoinSignalPressurePanel";
import type { CoinMarketMetricsPayload } from "@/lib/coinMarketMetrics";
import type { Candle } from "@/lib/marketAnalysis";
import type { LiquidationPressureReport } from "@/lib/liquidationPressure";
import { analyzeTechnicalRadar, type IndicatorReading, type TechnicalRadarReport } from "@/lib/technicalRadar";
import { buildCoinHomeDecision, type CoinHomeDecisionSummary } from "@/components/coin/coinHomeDecisionModel";

interface MarketBoardItem {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  quoteVolume: number;
}

interface CoinHomeResponseMeta {
  cachedAt: number | null;
  cached: boolean;
  stale: boolean;
}

interface CoinHomeData {
  board: MarketBoardItem[];
  boardMeta: CoinHomeResponseMeta;
  technical: TechnicalRadarReport | null;
  technical4h: TechnicalRadarReport | null;
  funding: Partial<Record<RepresentativeSymbol, LiquidationPressureReport>>;
  fundingMeta: Partial<Record<RepresentativeSymbol, CoinHomeResponseMeta>>;
  marketMetrics: CoinMarketMetricsPayload | null;
  analysisUpdatedAt: number;
}

type CoinHomeState =
  | { status: "loading" }
  | { status: "ready"; data: CoinHomeData }
  | { status: "error"; message: string };

const tileSymbols = ["BTC", "ETH", "XRP", "SOL", "DOGE", "BNB"] as const;

type RepresentativeSymbol = (typeof tileSymbols)[number];
type ConclusionSegment = { text: string; tone?: "up" | "down" };
type DirectionTone = "up" | "down";
type VisualTone = "long" | "short" | "watch" | "risk" | "info";

const tradingViewLogoIds: Record<RepresentativeSymbol, string> = {
  BTC: "XTVCBTC",
  ETH: "XTVCETH",
  XRP: "XTVCXRP",
  SOL: "XTVCSOL",
  DOGE: "XTVCDOGE",
  BNB: "XTVCBNB"
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function compactSymbol(symbol: string) {
  return symbol.replace("USDT.P", "").replace("USDT", "");
}

function formatPrice(price: number) {
  if (!Number.isFinite(price) || price <= 0) return "-";
  const digits = price >= 100 ? 2 : price >= 10 ? 3 : price >= 1 ? 4 : 5;
  return price.toLocaleString("ko-KR", { maximumFractionDigits: digits });
}

function formatPercent(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "미확인";
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function formatPlainPercent(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "미확인";
  return `${value.toFixed(digits)}%`;
}

function formatRatio(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "미확인";
  return value.toFixed(2);
}

function formatKrwRate(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "미확인";
  return `₩${value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}`;
}

function parseReadingNumber(value: string | undefined) {
  const match = value?.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function toneFromPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "info" as const;
  if (value >= 65) return "long" as const;
  if (value <= 35) return "short" as const;
  return "watch" as const;
}

function toneFromPremium(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "info" as const;
  if (Math.abs(value) < 0.5) return "watch" as const;
  return value > 0 ? "risk" as const : "info" as const;
}

const visualToneClass: Record<VisualTone, { text: string; bar: string }> = {
  long: { text: "text-ui-long", bar: "bg-ui-long" },
  short: { text: "text-ui-short", bar: "bg-ui-short" },
  watch: { text: "text-ui-watch", bar: "bg-ui-watch" },
  risk: { text: "text-ui-risk", bar: "bg-ui-risk" },
  info: { text: "text-ui-brand", bar: "bg-ui-brand" }
};

function formatAnalysisUpdatedAt(ms: number) {
  const date = new Date(ms);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours().toString().padStart(2, "0");
  const minute = date.getMinutes().toString().padStart(2, "0");
  return `${month}월 ${day}일 ${hour}:${minute} 갱신`;
}

function symbolLogoUrl(symbol: RepresentativeSymbol) {
  return `https://s3-symbol-logo.tradingview.com/crypto/${tradingViewLogoIds[symbol]}.svg`;
}

function boardItem(board: MarketBoardItem[], symbol: RepresentativeSymbol) {
  return board.find((item) => compactSymbol(item.symbol) === symbol) ?? null;
}

function responseMeta(payload: { cachedAt?: number; cached?: boolean; stale?: boolean } | null | undefined): CoinHomeResponseMeta {
  return {
    cachedAt: typeof payload?.cachedAt === "number" && Number.isFinite(payload.cachedAt) ? payload.cachedAt : null,
    cached: Boolean(payload?.cached),
    stale: Boolean(payload?.stale)
  };
}

function directionFor(changePercent: number) {
  if (changePercent >= 2.5) return { label: "상방 우세", tone: "long" as const, icon: ArrowUpRight };
  if (changePercent <= -2.5) return { label: "하방 압력", tone: "short" as const, icon: ArrowDownRight };
  return { label: "관망", tone: "watch" as const, icon: TrendingUp };
}

function scoreFor(changePercent: number, marketScore: number | null) {
  const marketBias = marketScore === null ? 0 : (marketScore - 50) * 0.18;
  return Math.round(clamp(50 + changePercent * 4.5 + marketBias, 8, 92));
}

function tileToneClass(changePercent: number) {
  if (changePercent >= 3) return "bg-emerald-500 text-white";
  if (changePercent >= 2) return "bg-emerald-600 text-white";
  if (changePercent >= 1) return "bg-emerald-700 text-white";
  if (changePercent >= 0) return "bg-emerald-950 text-emerald-50";
  if (changePercent <= -3) return "bg-red-600 text-white";
  if (changePercent <= -2) return "bg-red-700 text-white";
  if (changePercent <= -1) return "bg-red-800 text-red-50";
  return "bg-red-950 text-red-50";
}

function tileAccentClass(changePercent: number) {
  if (changePercent >= 0) return changePercent >= 3 ? "text-white" : "text-emerald-100";
  return changePercent <= -3 ? "text-white" : "text-red-100";
}

function scoreToneClass(score: number) {
  if (score >= 80) return "bg-emerald-300 text-emerald-950";
  if (score >= 70) return "bg-emerald-500 text-white";
  if (score >= 60) return "bg-emerald-800 text-emerald-50";
  if (score >= 50) return "bg-slate-600 text-slate-50";
  if (score >= 40) return "bg-red-900 text-red-50";
  if (score >= 30) return "bg-red-700 text-white";
  return "bg-red-500 text-white";
}

function riskFor(changePercent: number) {
  if (changePercent >= 6) return "추격 주의";
  if (changePercent <= -6) return "변동성 확대";
  if (changePercent >= 2.5) return "눌림 확인";
  if (changePercent <= -2.5) return "지지 반응 확인";
  return "방향 확인 대기";
}

function checkFor(changePercent: number) {
  if (changePercent >= 2.5) return "상방 추세 유지와 거래대금 동반 여부를 확인합니다.";
  if (changePercent <= -2.5) return "하방 추세가 이어지는지, 반등 실패 여부를 확인합니다.";
  return "BTC 1시간 추세와 주요 이벤트 전후 변동성을 함께 봅니다.";
}

function conclusionSegments(decision: CoinHomeDecisionSummary | undefined): ConclusionSegment[] {
  if (!decision) return [{ text: "시장 데이터를 확인하는 중입니다." }];
  if (decision.state === "하방 압력 우세") {
    return [
      { text: "하방 압력", tone: "down" },
      { text: "이 우세합니다. 숏 관점은 반등 실패와 추세 유지 확인이 먼저입니다." }
    ];
  }
  if (decision.state === "변동성 경계") {
    return [{ text: "변동성이 커져 롱/숏 모두 기준선 확인이 우선입니다." }];
  }
  if (decision.state === "상방 추적 가능") {
    return [
      { text: "상방 조건", tone: "up" },
      { text: "이 우세합니다. 롱 관점은 눌림 후 추세 유지 확인이 먼저입니다." }
    ];
  }
  if (decision.state === "조건 대기") {
    return [{ text: "방향은 열렸지만 BTC 추세와 알트 참여 확인이 더 필요합니다." }];
  }
  return [{ text: "방향 근거가 부족해 관망이 우선입니다." }];
}

function conclusionToneClass(tone?: DirectionTone) {
  if (tone === "up") return "text-emerald-400";
  if (tone === "down") return "text-rose-400";
  return "";
}

function directionalTone(value: string): DirectionTone | null {
  if (/상승|상방|반등|회복|돌파|롱/.test(value)) return "up";
  if (/하락|하방|약세|이탈|실패|숏/.test(value)) return "down";
  return null;
}

function HighlightDirectionalText({ text }: { text: string | undefined }) {
  if (!text) return null;
  const parts = text.split(/(상승|상방|반등|회복|돌파|롱|하락|하방|약세|이탈|실패|숏)/g);
  return (
    <>
      {parts.map((part, index) => {
        const tone = directionalTone(part);
        return (
          <span key={`${part}-${index}`} className={tone ? conclusionToneClass(tone) : undefined}>
            {part}
          </span>
        );
      })}
    </>
  );
}

function MarketStrengthGauge({
  label,
  value,
  display,
  min = 0,
  max = 100,
  detail,
  tone = "info",
  leftLabel,
  rightLabel,
  showCenter = false,
  showBar = true
}: {
  label: string;
  value: number | null | undefined;
  display: string;
  min?: number;
  max?: number;
  detail?: string;
  tone?: VisualTone;
  leftLabel?: string;
  rightLabel?: string;
  showCenter?: boolean;
  showBar?: boolean;
}) {
  const hasValue = value !== null && value !== undefined && Number.isFinite(value);
  const percent = hasValue ? clamp(((value - min) / (max - min)) * 100) : 0;
  const centerPercent = clamp(((0 - min) / (max - min)) * 100);
  const toneClass = visualToneClass[tone];

  return (
    <article className="min-w-0 border-t border-ui-line py-3 first:border-t-0 md:[&:nth-child(-n+2)]:border-t-0">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">{label}</p>
          {detail ? <p className="mt-1 truncate whitespace-nowrap text-xs leading-4 text-ui-muted">{detail}</p> : null}
        </div>
        <p className={`shrink-0 text-right text-base font-semibold leading-5 ${toneClass.text}`}>{display}</p>
      </div>
      {showBar ? (
        <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-ui-line">
          {showCenter ? <span className="absolute top-0 z-10 h-full w-px bg-ui-text/45" style={{ left: `${centerPercent}%` }} aria-hidden /> : null}
          <span className={`block h-full rounded-full ${toneClass.bar}`} style={{ width: `${percent}%` }} aria-hidden />
        </div>
      ) : null}
      {showBar && (leftLabel || rightLabel) ? (
        <div className="mt-1.5 flex justify-between gap-3 text-[10px] font-semibold text-ui-subtle">
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
      ) : null}
    </article>
  );
}

function TrendBreadthVisual({ report, label = "BTC 트렌드" }: { report: TechnicalRadarReport | null | undefined; label?: string }) {
  const bullish = report?.bullishCount ?? 0;
  const bearish = report?.bearishCount ?? 0;
  const neutral = report?.neutralCount ?? 0;
  const total = bullish + bearish + neutral;
  const bullishWidth = total ? (bullish / total) * 100 : 0;
  const neutralWidth = total ? (neutral / total) * 100 : 0;
  const bearishWidth = total ? (bearish / total) * 100 : 0;

  return (
    <article className="min-w-0 border-t border-ui-line py-3 md:[&:nth-child(-n+2)]:border-t-0">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">{label}</p>
        </div>
        <p className="shrink-0 text-right text-sm font-semibold leading-5 text-ui-text">{report?.trendLabel ?? "미확인"}</p>
      </div>
      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-ui-line">
        <span className="h-full bg-ui-long" style={{ width: `${bullishWidth}%` }} aria-hidden />
        <span className="h-full bg-ui-watch" style={{ width: `${neutralWidth}%` }} aria-hidden />
        <span className="h-full bg-ui-short" style={{ width: `${bearishWidth}%` }} aria-hidden />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] font-semibold text-ui-muted">
        <span className="text-ui-long">상승 {bullish}</span>
        <span className="text-center text-ui-watch">중립 {neutral}</span>
        <span className="text-right text-ui-short">하락 {bearish}</span>
      </div>
    </article>
  );
}

function LongShortVisual({ report }: { report: LiquidationPressureReport | null | undefined }) {
  const longPercent = report?.globalLongShort.longPercent ?? null;
  const shortPercent = report?.globalLongShort.shortPercent ?? null;
  const ratio = report?.globalLongShort.ratio ?? null;
  const longWidth = longPercent !== null && Number.isFinite(longPercent) ? clamp(longPercent) : 50;
  const shortWidth = shortPercent !== null && Number.isFinite(shortPercent) ? clamp(shortPercent) : 50;

  return (
    <article className="min-w-0 border-t border-ui-line py-3 md:[&:nth-child(-n+2)]:border-t-0">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">롱숏비율</p>
        </div>
        <p className="shrink-0 text-right text-base font-semibold leading-5 text-ui-text">{formatRatio(ratio)}</p>
      </div>
      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-ui-line">
        <span className="h-full bg-ui-long" style={{ width: `${longWidth}%` }} aria-hidden />
        <span className="h-full bg-ui-short" style={{ width: `${shortWidth}%` }} aria-hidden />
      </div>
      <div className="mt-2 flex justify-between gap-3 text-[10px] font-semibold">
        <span className="text-ui-long">롱 {formatPlainPercent(longPercent, 1)}</span>
        <span className="text-ui-short">숏 {formatPlainPercent(shortPercent, 1)}</span>
      </div>
    </article>
  );
}

function fundingToneClass(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "text-ui-muted";
  if (value > 0.01) return "text-ui-long";
  if (value < -0.01) return "text-ui-short";
  return "text-ui-watch";
}

function fundingSkewDescription(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "펀딩비 확인 중";
  if (value > 0.001) return "롱 포지션 쏠림";
  if (value < -0.001) return "숏 포지션 쏠림";
  return "쏠림 낮음";
}

function FundingRateRow({ symbol, report }: { symbol: RepresentativeSymbol; report: LiquidationPressureReport | null | undefined }) {
  return (
    <article className="border-t border-ui-line py-3 first:border-t-0">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <p className="min-w-0 text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">{symbol} 펀딩비</p>
        <p className={`shrink-0 text-right text-sm font-semibold leading-5 ${fundingToneClass(report?.fundingRatePercent)}`}>
          {formatPercent(report?.fundingRatePercent, 4)}
        </p>
      </div>
      <p className="mt-1 text-xs leading-5 text-ui-muted [word-break:keep-all]">
        {fundingSkewDescription(report?.fundingRatePercent)}
      </p>
    </article>
  );
}

function buildHomeConflictItems({
  decision,
  btc,
  btcFunding,
  kimchiPremium
}: {
  decision: CoinHomeDecisionSummary | undefined;
  btc: MarketBoardItem | null | undefined;
  btcFunding: LiquidationPressureReport | null | undefined;
  kimchiPremium: number | null | undefined;
}): CoinSignalConflictItem[] {
  const btcChange = btc?.changePercent ?? null;
  const funding = btcFunding?.fundingRatePercent ?? null;
  const longShortRatio = btcFunding?.globalLongShort.ratio ?? null;
  const riskIsActive = Boolean(decision?.topRisk && decision.topRisk !== "확인 조건 대기");
  const priceWeakButLongCrowded = (btcChange ?? 0) < 0 && (funding ?? 0) > 0.001;
  const priceStrongButCrowded = (btcChange ?? 0) > 1 && ((funding ?? 0) > 0.01 || (longShortRatio ?? 1) >= 1.35);
  const kimchiSkew = Math.abs(kimchiPremium ?? 0) >= 1.5;

  return [
    {
      label: "방향 vs 리스크",
      title: riskIsActive ? `${decision?.direction ?? "방향 확인"} · ${decision?.topRisk}` : decision?.direction ?? "방향 확인 중",
      detail: riskIsActive
        ? "추적 조건이 있더라도 회피 조건이 먼저 풀리는지 확인합니다."
        : "뚜렷한 충돌은 약하지만, 확인 조건 없이 추격하지 않습니다.",
      tone: riskIsActive ? "risk" : "info"
    },
    {
      label: "가격 vs 파생",
      title: priceWeakButLongCrowded ? "가격 약세인데 롱 쏠림" : priceStrongButCrowded ? "상승 중 파생 쏠림" : fundingSkewDescription(funding),
      detail: `BTC 등락 ${formatPercent(btcChange)} · 펀딩비 ${formatPercent(funding, 4)} · 롱숏비율 ${formatRatio(longShortRatio)}.`,
      tone: priceWeakButLongCrowded || priceStrongButCrowded ? "risk" : "watch"
    },
    {
      label: "시장 주도",
      title: decision?.leadership ?? "주도 흐름 확인 중",
      detail: decision?.reason ?? "BTC와 알트 참여가 같은 방향으로 정렬되는지 확인합니다.",
      tone: decision?.leadership === "알트 순환" || decision?.leadership === "BTC 우세" ? "long" : decision?.leadership === "위험 회피" ? "risk" : "watch"
    },
    {
      label: "국내 vs 글로벌",
      title: kimchiSkew ? `김프 괴리 ${formatPercent(kimchiPremium)}` : `김프 ${formatPercent(kimchiPremium)}`,
      detail: kimchiSkew ? "국내 현물 체감과 글로벌 선물 흐름이 다를 수 있어 같은 신호로 해석하지 않습니다." : "국내 프리미엄 괴리는 제한적입니다.",
      tone: kimchiSkew ? "watch" : "info"
    }
  ];
}

function buildHomeFreshnessItems({
  data,
  report,
  report4h,
  btcFunding,
  marketMetrics
}: {
  data: CoinHomeData;
  report: TechnicalRadarReport | null | undefined;
  report4h: TechnicalRadarReport | null | undefined;
  btcFunding: LiquidationPressureReport | null | undefined;
  marketMetrics: CoinMarketMetricsPayload | null | undefined;
}): CoinDataFreshnessItem[] {
  const boardTimestamp = data.boardMeta.cachedAt ?? data.analysisUpdatedAt;
  const btcFundingMeta = data.fundingMeta.BTC;
  const fundingTimestamp = btcFundingMeta?.cachedAt ?? data.analysisUpdatedAt;
  const metricsTimestamp = marketMetrics?.cachedAt ?? data.analysisUpdatedAt;
  const metricsWarningCount = marketMetrics?.warnings.length ?? 0;

  return [
    {
      label: "대표 시세",
      title: data.board.length > 0 ? `${data.board.length}개 대표 코인` : "확인 중",
      detail: `${formatDataAge(boardTimestamp)} · ${data.boardMeta.cached ? "최근 저장본" : "실시간 응답"} 기준입니다.`,
      tone: dataFreshnessTone({
        timestamp: boardTimestamp,
        cached: data.boardMeta.cached,
        stale: data.boardMeta.stale,
        warningMs: 5 * 60 * 1000,
        staleMs: 15 * 60 * 1000
      })
    },
    {
      label: "BTC 구조",
      title: `1H ${report?.trendLabel ?? "확인 중"} · 4H ${report4h?.trendLabel ?? "확인 중"}`,
      detail: `${formatDataAge(data.analysisUpdatedAt)} · RSI, 추세, 변동성 점수를 같은 시각에 재계산했습니다.`,
      tone: report && report4h ? "long" : "watch"
    },
    {
      label: "파생 쏠림",
      title: btcFunding ? `펀딩 ${formatPercent(btcFunding.fundingRatePercent, 4)} · 롱숏 ${formatRatio(btcFunding.globalLongShort.ratio)}` : "확인 중",
      detail: `${formatDataAge(fundingTimestamp)} · ${btcFundingMeta?.cached ? "최근 저장본" : "실시간 응답"} 기준으로 청산 압력과 롱숏 비율을 봅니다.`,
      tone: dataFreshnessTone({
        timestamp: fundingTimestamp,
        cached: btcFundingMeta?.cached,
        stale: btcFundingMeta?.stale,
        warningMs: 2 * 60 * 1000,
        staleMs: 10 * 60 * 1000
      })
    },
    {
      label: "보조 지표",
      title: `김프 ${formatPercent(marketMetrics?.kimchiPremiumPercent)} · BTC.D ${formatPlainPercent(marketMetrics?.btcDominancePercent)}`,
      detail:
        metricsWarningCount > 0
          ? `${formatDataAge(metricsTimestamp)} · ${metricsWarningCount}개 공개 소스가 제한되어 보조값으로만 봅니다.`
          : `${formatDataAge(metricsTimestamp)} · 도미넌스, 환율, 김프 보조값을 함께 확인했습니다.`,
      tone: dataFreshnessTone({
        timestamp: metricsTimestamp,
        cached: marketMetrics?.cached,
        stale: marketMetrics?.stale,
        warningMs: 5 * 60 * 1000,
        staleMs: 20 * 60 * 1000
      })
    }
  ];
}

function reportPressure(report: TechnicalRadarReport | null | undefined) {
  if (!report) return { percent: 0, tone: "watch" as const };
  const total = report.bullishCount + report.bearishCount + report.neutralCount;
  const dominant = Math.max(report.bullishCount, report.bearishCount, report.neutralCount);
  const percent = total > 0 ? clamp((dominant / total) * 100, 12, 92) : 0;
  const tone = report.bearishCount > report.bullishCount ? ("short" as const) : report.bullishCount > report.bearishCount ? ("long" as const) : ("watch" as const);
  return { percent, tone };
}

function buildHomePressureItems({
  report,
  report4h,
  btc,
  btcFunding,
  marketMetrics
}: {
  report: TechnicalRadarReport | null | undefined;
  report4h: TechnicalRadarReport | null | undefined;
  btc: MarketBoardItem | null | undefined;
  btcFunding: LiquidationPressureReport | null | undefined;
  marketMetrics: CoinMarketMetricsPayload | null | undefined;
}): CoinSignalPressureItem[] {
  const btcChange = btc?.changePercent ?? 0;
  const priceTone = btcChange >= 1 ? "long" : btcChange <= -1 ? "short" : "watch";
  const structure = reportPressure(report);
  const fundingRate = btcFunding?.fundingRatePercent ?? 0;
  const longShortRatio = btcFunding?.globalLongShort.ratio ?? 1;
  const derivativePercent = clamp(20 + Math.abs(fundingRate) * 1200 + Math.abs(longShortRatio - 1) * 35, 10, 95);
  const derivativeTone =
    btcFunding?.grade === "extreme" || btcFunding?.grade === "heated" || Math.abs(fundingRate) >= 0.01 || Math.abs(longShortRatio - 1) >= 0.35
      ? "risk"
      : "watch";
  const kimchiPremium = marketMetrics?.kimchiPremiumPercent ?? 0;
  const dominance = marketMetrics?.btcDominancePercent ?? null;
  const marketPercent = clamp(18 + Math.abs(kimchiPremium) * 18 + (dominance === null ? 0 : Math.abs(dominance - 50) * 1.4), 8, 90);
  const marketTone = Math.abs(kimchiPremium) >= 3 ? "risk" : Math.abs(kimchiPremium) >= 1 ? "watch" : "info";

  return [
    {
      label: "가격 흐름",
      title: btc ? `BTC ${formatPercent(btc.changePercent)}` : "BTC 확인 중",
      detail: "대표 코인의 단기 등락이 전체 판단에 어느 정도 영향을 주는지 봅니다.",
      tone: priceTone,
      percent: clamp(22 + Math.abs(btcChange) * 12, 8, 92)
    },
    {
      label: "구조 신호",
      title: `1H ${report?.trendLabel ?? "확인 중"} · 4H ${report4h?.trendLabel ?? "확인 중"}`,
      detail: "기술 구조는 단기 가격 신호를 검증하는 보조 압력으로 분리합니다.",
      tone: structure.tone,
      percent: structure.percent
    },
    {
      label: "파생 압력",
      title: `펀딩 ${formatPercent(btcFunding?.fundingRatePercent, 4)} · 롱숏 ${formatRatio(btcFunding?.globalLongShort.ratio)}`,
      detail: "펀딩비, 롱숏 비율, 청산 등급이 과열 쪽으로 기울면 방향보다 위험을 먼저 봅니다.",
      tone: derivativeTone,
      percent: derivativePercent
    },
    {
      label: "시장 보조",
      title: `김프 ${formatPercent(kimchiPremium)} · BTC.D ${formatPlainPercent(dominance)}`,
      detail: "국내 프리미엄과 BTC 도미넌스는 같은 방향 신호로 합치지 않고 보조 압력으로 둡니다.",
      tone: marketTone,
      percent: marketPercent
    }
  ];
}

function buildHomeEvidenceGradeItems({
  data,
  report,
  report4h,
  btcFunding,
  marketMetrics
}: {
  data: CoinHomeData;
  report: TechnicalRadarReport | null | undefined;
  report4h: TechnicalRadarReport | null | undefined;
  btcFunding: LiquidationPressureReport | null | undefined;
  marketMetrics: CoinMarketMetricsPayload | null | undefined;
}): CoinEvidenceGradeItem[] {
  const hasCoreStructure = data.board.length > 0 && Boolean(report) && Boolean(report4h);
  const hasDerivatives = Boolean(btcFunding);
  const metricsWarningCount = marketMetrics?.warnings.length ?? 0;
  const metricsGrade = marketMetrics && metricsWarningCount === 0 ? "B" : "검증중";

  return [
    {
      grade: hasCoreStructure ? "S" : "검증중",
      label: "핵심 근거",
      title: hasCoreStructure ? `대표 시세 ${data.board.length}개 · BTC 1H/4H` : "대표 시세와 BTC 구조 확인 중",
      detail: hasCoreStructure
        ? "가격, RSI, 추세, 변동성 데이터를 같은 판단 묶음에서 확인합니다."
        : "핵심 가격 또는 BTC 구조 데이터가 부족하면 방향 판단 강도를 낮춥니다.",
      tone: hasCoreStructure ? "long" : "watch"
    },
    {
      grade: hasDerivatives ? "A" : "검증중",
      label: "확인 근거",
      title: hasDerivatives ? `펀딩 ${formatPercent(btcFunding?.fundingRatePercent, 4)} · 롱숏 ${formatRatio(btcFunding?.globalLongShort.ratio)}` : "파생 쏠림 확인 중",
      detail: "파생 데이터는 핵심 방향을 보강하기보다 과열과 변동성 위험을 따로 확인하는 근거입니다.",
      tone: hasDerivatives ? "watch" : "info"
    },
    {
      grade: metricsGrade,
      label: "보조 근거",
      title: `김프 ${formatPercent(marketMetrics?.kimchiPremiumPercent)} · BTC.D ${formatPlainPercent(marketMetrics?.btcDominancePercent)}`,
      detail:
        metricsWarningCount > 0
          ? "보조 소스 일부가 제한되어 있어 최종 판단보다 참고값으로만 둡니다."
          : "도미넌스, 환율, 국내 프리미엄은 방향 판단과 분리해 보조 근거로 사용합니다.",
      tone: metricsWarningCount > 0 ? "info" : "watch"
    },
    {
      grade: "검증중",
      label: "표본 상태",
      title: "실제 이후 흐름은 누적 관찰 중",
      detail: "충분한 표본이 없는 상태에서 확정 적중률처럼 보이는 표현은 쓰지 않습니다.",
      tone: "info"
    }
  ];
}

function HomeRiskChecklist({
  decision,
  btcFunding,
  kimchiPremium
}: {
  decision: CoinHomeDecisionSummary | undefined;
  btcFunding: LiquidationPressureReport | null | undefined;
  kimchiPremium: number | null | undefined;
}) {
  const fundingText = fundingSkewDescription(btcFunding?.fundingRatePercent);
  const longShortRatio = formatRatio(btcFunding?.globalLongShort.ratio);
  const kimchiText = formatPercent(kimchiPremium);
  const riskTone = decision?.topRisk && decision.topRisk !== "확인 조건 대기" ? "risk" : "watch";
  const fundingTone =
    btcFunding?.grade === "extreme" || btcFunding?.grade === "heated" || Math.abs(btcFunding?.fundingRatePercent ?? 0) >= 0.01 ? "risk" : "watch";
  const kimchiTone = Math.abs(kimchiPremium ?? 0) >= 3 ? "risk" : Math.abs(kimchiPremium ?? 0) >= 1 ? "watch" : "info";

  const checks: Array<{ label: string; title: string; detail: string; tone: "risk" | "watch" | "info" | "long" | "short" }> = [
    {
      label: "1. 피할 조건",
      title: decision?.topRisk ?? "리스크 확인 중",
      detail:
        decision?.topRisk && decision.topRisk !== "확인 조건 대기"
          ? "이 조건이 먼저 풀리는지 확인하기 전에는 추격보다 관찰이 우선입니다."
          : "뚜렷한 회피 신호가 약해도 확인 조건 없이 추격하지 않습니다.",
      tone: riskTone
    },
    {
      label: "2. 추적 조건",
      title: decision?.direction ?? "방향 확인 중",
      detail: decision?.nextCondition ?? "BTC 추세와 알트 참여 확산 여부를 먼저 확인합니다.",
      tone: decision?.direction === "상방 우세" ? "long" : decision?.direction === "하방 압력" ? "short" : "watch"
    },
    {
      label: "3. 파생 쏠림",
      title: fundingText,
      detail: `BTC 롱숏비율 ${longShortRatio} · 펀딩비 ${formatPercent(btcFunding?.fundingRatePercent, 4)}. 쏠림이 커질수록 변동성 확인이 우선입니다.`,
      tone: fundingTone
    },
    {
      label: "4. 국내 프리미엄",
      title: kimchiText,
      detail: "김프가 커지면 해외 시세와 국내 현물 체감 흐름이 어긋날 수 있습니다.",
      tone: kimchiTone
    }
  ];

  return (
    <PanelCard variant="flat" padding="none" className="space-y-4">
      <SectionHeader
        eyebrow="Risk First"
        title="오늘 먼저 걸러볼 조건"
        description="방향보다 회피 조건을 먼저 보고, 그다음 추적 조건과 파생 쏠림을 확인합니다."
      />
      <div className="grid gap-0 border-y border-ui-line md:grid-cols-2">
        {checks.map((check, index) => (
          <article
            key={check.label}
            className={`min-w-0 py-3 md:px-3 ${index > 0 ? "border-t border-ui-line md:border-t-0" : ""} ${
              index % 2 === 1 ? "md:border-l md:border-ui-line" : ""
            } ${index > 1 ? "md:border-t md:border-ui-line" : ""}`}
          >
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">{check.label}</p>
                <p className="mt-1 text-sm font-semibold leading-5 text-ui-text [word-break:keep-all]">
                  <HighlightDirectionalText text={check.title} />
                </p>
              </div>
              <StatusPill tone={check.tone} className="shrink-0">
                {check.tone === "risk" ? "주의" : check.tone === "long" ? "상방" : check.tone === "short" ? "하방" : "확인"}
              </StatusPill>
            </div>
            <p className="mt-2 text-xs leading-5 text-ui-muted [word-break:keep-all]">
              <HighlightDirectionalText text={check.detail} />
            </p>
          </article>
        ))}
      </div>
    </PanelCard>
  );
}

function CoinStatusTile({
  symbol,
  item,
  score,
  primary,
  emphasis,
  onClick
}: {
  symbol: RepresentativeSymbol;
  item: MarketBoardItem | null;
  score: number;
  primary?: boolean;
  emphasis?: boolean;
  onClick: () => void;
}) {
  const changePercent = item?.changePercent ?? 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex h-full min-h-0 w-full flex-col items-center justify-center gap-1 overflow-hidden border border-ui-canvas px-1.5 py-2 text-center transition hover:brightness-110 active:scale-[0.99] ${tileToneClass(
        changePercent
      )}`}
      aria-label={`${symbol} 상세 보기`}
    >
      <span className="pointer-events-none absolute right-1 top-1 text-[9px] font-black leading-none text-white/60 sm:right-1.5 sm:top-1.5">
        클릭상세
      </span>
      <span
        className={`block max-w-full truncate font-black leading-none tracking-tight ${
          primary ? "text-[2.55rem] sm:text-5xl" : emphasis ? "text-[1.7rem] sm:text-3xl" : "text-[1.35rem] sm:text-xl"
        }`}
      >
        {symbol}
      </span>
      <span className={`max-w-full truncate font-semibold leading-none ${primary ? "block text-[1.7rem] sm:text-3xl" : "hidden"}`}>
        {item ? `$${formatPrice(item.price)}` : "-"}
      </span>
      <span
        className={`block max-w-full truncate font-black leading-none ${
          primary ? "text-[1.65rem] sm:text-3xl" : emphasis ? "text-[1.05rem] sm:text-xl" : "text-[0.95rem] sm:text-base"
        } ${tileAccentClass(changePercent)}`}
      >
        {formatPercent(item?.changePercent)}
      </span>
      <span
        className={`inline-flex max-w-full items-center justify-center truncate px-1.5 py-0.5 font-black leading-none ${
          primary ? "text-[1.45rem] sm:text-3xl" : emphasis ? "text-[0.95rem] sm:text-xl" : "text-[0.85rem] sm:text-base"
        } ${scoreToneClass(score)}`}
      >
        {score}점
      </span>
    </button>
  );
}

function toneForMarket(score: number | null) {
  if (score === null) return { label: "확인 대기", tone: "info" as const };
  if (score >= 62) return { label: "추적 가능", tone: "long" as const };
  if (score <= 38) return { label: "리스크 우위", tone: "risk" as const };
  return { label: "관망 우위", tone: "watch" as const };
}

function findReading(report: TechnicalRadarReport | null, label: string): IndicatorReading | null {
  if (!report) return null;
  return [...report.momentumIndicators, ...report.trendIndicators, ...report.volatilityIndicators].find((item) => item.label === label) ?? null;
}

async function jsonOrNull<T>(input: RequestInfo | URL) {
  const response = await fetch(input, { cache: "no-store" });
  if (!response.ok) return null;
  return (await response.json()) as T;
}

export function CoinRadarHomePanel() {
  const [state, setState] = useState<CoinHomeState>({ status: "loading" });
  const [selectedSymbol, setSelectedSymbol] = useState<RepresentativeSymbol | null>(null);

  async function load() {
    setState({ status: "loading" });

    try {
      const [
        boardPayload,
        candlesPayload,
        candles4hPayload,
        marketMetricsPayload,
        btcFundingPayload,
        ethFundingPayload,
        xrpFundingPayload,
        solFundingPayload,
        dogeFundingPayload,
        bnbFundingPayload
      ] = await Promise.all([
        jsonOrNull<{ items?: MarketBoardItem[]; cachedAt?: number; cached?: boolean; stale?: boolean }>("/api/market-board"),
        jsonOrNull<{ candles?: Candle[] }>("/api/crypto-candles?symbol=BTCUSDT&timeframe=1h&limit=180"),
        jsonOrNull<{ candles?: Candle[] }>("/api/crypto-candles?symbol=BTCUSDT&timeframe=4h&limit=180"),
        jsonOrNull<CoinMarketMetricsPayload>("/api/coin-market-metrics"),
        jsonOrNull<{ report?: LiquidationPressureReport; cachedAt?: number; cached?: boolean; stale?: boolean }>("/api/liquidation-pressure?symbol=BTCUSDT&period=1h"),
        jsonOrNull<{ report?: LiquidationPressureReport; cachedAt?: number; cached?: boolean; stale?: boolean }>("/api/liquidation-pressure?symbol=ETHUSDT&period=1h"),
        jsonOrNull<{ report?: LiquidationPressureReport; cachedAt?: number; cached?: boolean; stale?: boolean }>("/api/liquidation-pressure?symbol=XRPUSDT&period=1h"),
        jsonOrNull<{ report?: LiquidationPressureReport; cachedAt?: number; cached?: boolean; stale?: boolean }>("/api/liquidation-pressure?symbol=SOLUSDT&period=1h"),
        jsonOrNull<{ report?: LiquidationPressureReport; cachedAt?: number; cached?: boolean; stale?: boolean }>("/api/liquidation-pressure?symbol=DOGEUSDT&period=1h"),
        jsonOrNull<{ report?: LiquidationPressureReport; cachedAt?: number; cached?: boolean; stale?: boolean }>("/api/liquidation-pressure?symbol=BNBUSDT&period=1h")
      ]);

      const board = boardPayload?.items ?? [];
      const candles = candlesPayload?.candles ?? [];
      const candles4h = candles4hPayload?.candles ?? [];
      const technical = candles.length >= 60 ? analyzeTechnicalRadar(candles) : null;
      const technical4h = candles4h.length >= 60 ? analyzeTechnicalRadar(candles4h) : null;
      const funding: CoinHomeData["funding"] = {
        BTC: btcFundingPayload?.report,
        ETH: ethFundingPayload?.report,
        XRP: xrpFundingPayload?.report,
        SOL: solFundingPayload?.report,
        DOGE: dogeFundingPayload?.report,
        BNB: bnbFundingPayload?.report
      };
      const fundingMeta: CoinHomeData["fundingMeta"] = {
        BTC: responseMeta(btcFundingPayload),
        ETH: responseMeta(ethFundingPayload),
        XRP: responseMeta(xrpFundingPayload),
        SOL: responseMeta(solFundingPayload),
        DOGE: responseMeta(dogeFundingPayload),
        BNB: responseMeta(bnbFundingPayload)
      };

      if (board.length === 0 && !technical) {
        throw new Error("코인 홈 데이터를 확인하지 못했습니다.");
      }

      setState({
        status: "ready",
        data: {
          board,
          boardMeta: responseMeta(boardPayload),
          technical,
          technical4h,
          funding,
          fundingMeta,
          marketMetrics: marketMetricsPayload,
          analysisUpdatedAt: Date.now()
        }
      });
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "코인 홈 데이터를 확인하지 못했습니다." });
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const summary = useMemo(() => {
    if (state.status !== "ready") return null;
    const report = state.data.technical;
    const report4h = state.data.technical4h;
    const fearGreed = report?.fearGreed ?? null;
    const tone = toneForMarket(fearGreed?.score ?? null);
    const btc = boardItem(state.data.board, "BTC");
    const rsi = findReading(report, "RSI 14");
    const stochastic = findReading(report, "Stochastic");
    const btcFunding = state.data.funding.BTC ?? null;
    const marketMetrics = state.data.marketMetrics;
    const decision = buildCoinHomeDecision({
      board: state.data.board,
      technical: report,
      marketMetrics,
      btcFunding
    });

    return { report, report4h, fearGreed, tone, btc, rsi, stochastic, btcFunding, marketMetrics, decision };
  }, [state]);

  if (state.status === "loading") {
    return (
      <PanelCard variant="report" padding="lg" className="flex min-h-56 items-center justify-center text-sm font-semibold text-ui-muted">
        코인 시장을 분석하고 있습니다.
      </PanelCard>
    );
  }

  if (state.status === "error") {
    return (
      <PanelCard variant="report" padding="lg" tone="critical" className="flex min-h-56 flex-col items-center justify-center gap-3 text-center">
        <AlertTriangle size={22} aria-hidden />
        <p className="text-sm font-semibold">{state.message}</p>
        <ActionButton tone="ghost" onClick={() => void load()}>
          <RefreshCw size={14} aria-hidden />
          다시 확인
        </ActionButton>
      </PanelCard>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      <div className="flex items-center justify-between gap-2 px-1 text-[11px] font-semibold text-ui-muted">
        <span className="min-w-0 truncate">{formatAnalysisUpdatedAt(state.data.analysisUpdatedAt)}</span>
        <ActionButton tone="ghost" className="min-h-7 shrink-0 px-0" onClick={() => void load()}>
          <RefreshCw size={12} aria-hidden />
          새로고침
        </ActionButton>
      </div>

      <PanelCard variant="flat" padding="none" className="space-y-4">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-ui-label font-semibold uppercase tracking-[0.12em] text-ui-subtle">오늘의 결론</p>
            <h2 className="text-ui-heading font-semibold tracking-tight text-ui-text">{summary?.decision.state}</h2>
            <p className="mt-1 max-w-3xl text-ui-body text-ui-muted [word-break:keep-all]">
              {conclusionSegments(summary?.decision).map((part, index) => (
                <span key={`${part.text}-${index}`} className={conclusionToneClass(part.tone)}>
                  {part.text}
                </span>
              ))}
            </p>
          </div>
        </div>

        <div className="grid gap-5 border-t border-ui-line pt-4 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start">
          <div className="min-w-0">
            <div>
              <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">{summary?.decision.scoreLabel}</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight text-ui-text sm:text-4xl">{summary?.decision.readinessScore ?? "-"}점</p>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-ui-muted [word-break:keep-all]">{summary?.decision.scoreDetail}</p>
            </div>
          </div>

          <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div>
              <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">가장 큰 리스크</p>
              <p className="mt-1 text-base font-semibold text-ui-text">
                <HighlightDirectionalText text={summary?.decision.topRisk} />
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">다음 확인 조건</p>
              <p className="mt-1 min-w-0 text-sm font-semibold leading-5 text-ui-text [overflow-wrap:anywhere] [word-break:keep-all]">
                <HighlightDirectionalText text={summary?.decision.nextCondition} />
              </p>
            </div>
          </div>
        </div>
      </PanelCard>

      <CoinDataFreshnessPanel
        title="데이터 신선도"
        description="가격, 구조, 파생, 보조 지표의 갱신 상태를 분리해서 같은 시각의 신호인지 먼저 확인합니다."
        items={buildHomeFreshnessItems({
          data: state.data,
          report: summary?.report,
          report4h: summary?.report4h,
          btcFunding: summary?.btcFunding,
          marketMetrics: summary?.marketMetrics
        })}
      />

      <CoinEvidenceGradePanel
        title="코인 근거 등급"
        description="근거를 S/A/B와 검증 상태로 나눠서 강한 신호와 보조 신호를 섞어 보지 않습니다."
        items={buildHomeEvidenceGradeItems({
          data: state.data,
          report: summary?.report,
          report4h: summary?.report4h,
          btcFunding: summary?.btcFunding,
          marketMetrics: summary?.marketMetrics
        })}
      />

      <HomeRiskChecklist decision={summary?.decision} btcFunding={summary?.btcFunding} kimchiPremium={summary?.marketMetrics?.kimchiPremiumPercent} />

      <CoinSignalConflictPanel
        items={buildHomeConflictItems({
          decision: summary?.decision,
          btc: summary?.btc,
          btcFunding: summary?.btcFunding,
          kimchiPremium: summary?.marketMetrics?.kimchiPremiumPercent
        })}
      />

      <CoinSignalPressurePanel
        title="코인 압력 분해"
        description="같은 방향처럼 보이는 신호를 가격, 구조, 파생, 보조 지표로 나눠 봅니다."
        items={buildHomePressureItems({
          report: summary?.report,
          report4h: summary?.report4h,
          btc: summary?.btc,
          btcFunding: summary?.btcFunding,
          marketMetrics: summary?.marketMetrics
        })}
      />

      <PanelCard variant="flat" padding="none" className="space-y-4">
        <SectionHeader eyebrow="Representative Coins" title="대표 코인 상태" />
        <div className="mx-auto w-full max-w-2xl overflow-hidden rounded-ui-sm bg-ui-line p-px">
          <div className="grid h-[clamp(10.5rem,42vw,18rem)] grid-cols-[minmax(0,1fr)_minmax(5.6rem,34%)] items-stretch gap-px">
            {(() => {
              const symbol = tileSymbols[0];
              const item = boardItem(state.data.board, symbol);
              const score = scoreFor(item?.changePercent ?? 0, summary?.fearGreed?.score ?? null);
              return (
                <div className="min-w-0">
                  <CoinStatusTile symbol={symbol} item={item} score={score} primary onClick={() => setSelectedSymbol(symbol)} />
                </div>
              );
            })()}
            <div className="grid min-w-0 grid-rows-2 gap-px self-stretch">
              {tileSymbols.slice(1, 3).map((symbol) => {
                const item = boardItem(state.data.board, symbol);
                const score = scoreFor(item?.changePercent ?? 0, summary?.fearGreed?.score ?? null);
                return <CoinStatusTile key={symbol} symbol={symbol} item={item} score={score} emphasis onClick={() => setSelectedSymbol(symbol)} />;
              })}
            </div>
          </div>
          <div className="mt-px grid h-[clamp(5.5rem,22vw,8rem)] grid-cols-[minmax(0,1fr)_minmax(5.6rem,34%)] gap-px">
            <div className="grid min-w-0 grid-cols-2 gap-px">
              {tileSymbols.slice(3, 5).map((symbol) => {
                const item = boardItem(state.data.board, symbol);
                const score = scoreFor(item?.changePercent ?? 0, summary?.fearGreed?.score ?? null);
                return <CoinStatusTile key={symbol} symbol={symbol} item={item} score={score} onClick={() => setSelectedSymbol(symbol)} />;
              })}
            </div>
            {(() => {
              const symbol = tileSymbols[5];
              const item = boardItem(state.data.board, symbol);
              const score = scoreFor(item?.changePercent ?? 0, summary?.fearGreed?.score ?? null);
              return <CoinStatusTile symbol={symbol} item={item} score={score} onClick={() => setSelectedSymbol(symbol)} />;
            })()}
          </div>
        </div>
      </PanelCard>

      {selectedSymbol ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4" role="dialog" aria-modal="true">
          {(() => {
            const item = boardItem(state.data.board, selectedSymbol);
            const direction = directionFor(item?.changePercent ?? 0);
            const Icon = direction.icon;
            const score = scoreFor(item?.changePercent ?? 0, summary?.fearGreed?.score ?? null);

            return (
              <div className="relative max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto border border-ui-line bg-ui-panel p-4 text-ui-text shadow-none">
                <button
                  type="button"
                  onClick={() => setSelectedSymbol(null)}
                  className="absolute left-2 top-2 grid h-7 w-7 place-items-center text-ui-muted transition hover:text-ui-text"
                  aria-label="상세 카드 닫기"
                >
                  <X size={15} aria-hidden />
                </button>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={symbolLogoUrl(selectedSymbol)}
                  alt={`${selectedSymbol} symbol`}
                  className="absolute right-4 top-3 h-10 w-10 rounded-full bg-white/95 p-1"
                  loading="lazy"
                />
                <div className="pl-7 pr-14">
                  <p className="text-3xl font-semibold tracking-tight">{selectedSymbol}</p>
                  <p className="mt-1 text-sm font-medium text-ui-muted">{item ? `$${formatPrice(item.price)} · ${formatPercent(item.changePercent)}` : "가격 확인 중"}</p>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <StatusPill tone={direction.tone} icon={Icon}>
                    {direction.label}
                  </StatusPill>
                  <div className="text-right">
                    <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">신호 정렬도</p>
                    <p className="text-2xl font-semibold">{score}점</p>
                  </div>
                </div>
                <div className="mt-4 border-y border-ui-line">
                  <FundingRateRow symbol={selectedSymbol} report={state.data.funding[selectedSymbol] ?? null} />
                </div>
                <div className="mt-4 space-y-3 text-sm leading-6 text-ui-muted">
                  <div>
                    <p className="font-semibold text-ui-text">리스크</p>
                    <p className="mt-1">
                      <HighlightDirectionalText text={riskFor(item?.changePercent ?? 0)} />
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-ui-text">확인</p>
                    <p className="mt-1">
                      <HighlightDirectionalText text={checkFor(item?.changePercent ?? 0)} />
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      ) : null}

      <PanelCard variant="flat" padding="none" className="space-y-4">
        <SectionHeader eyebrow="BTC Market Strength" title="BTC 기준 시장 체력" description="선택 코인과 분리해 BTC 기준 과열, 추세, 파생 쏠림을 확인합니다." />
        <div className="grid gap-3 md:grid-cols-2">
          <MarketStrengthGauge
            label="공포탐욕"
            value={summary?.fearGreed?.score}
            display={summary?.fearGreed ? `${summary.fearGreed.score} · ${summary.fearGreed.label}` : "미확인"}
            tone={toneFromPercent(summary?.fearGreed?.score)}
            leftLabel="공포"
            rightLabel="탐욕"
          />
          <MarketStrengthGauge
            label="BTC RSI"
            value={parseReadingNumber(summary?.rsi?.value)}
            display={summary?.rsi?.value ?? "미확인"}
            tone={summary?.rsi?.tone === "warning" ? "risk" : toneFromPercent(parseReadingNumber(summary?.rsi?.value))}
            leftLabel="과매도"
            rightLabel="과열"
          />
          <MarketStrengthGauge
            label="BTC 스토캐스틱"
            value={parseReadingNumber(summary?.stochastic?.value)}
            display={summary?.stochastic?.value ?? "미확인"}
            tone={summary?.stochastic?.tone === "warning" ? "risk" : toneFromPercent(parseReadingNumber(summary?.stochastic?.value))}
            leftLabel="하방 과열"
            rightLabel="상방 과열"
          />
          <TrendBreadthVisual report={summary?.report} label="BTC 1H 트렌드" />
          <TrendBreadthVisual report={summary?.report4h} label="BTC 4H 트렌드" />
          <MarketStrengthGauge
            label="BTC 도미넌스"
            value={summary?.marketMetrics?.btcDominancePercent}
            display={formatPlainPercent(summary?.marketMetrics?.btcDominancePercent)}
            tone="info"
            leftLabel="낮음"
            rightLabel="높음"
          />
          <LongShortVisual report={summary?.btcFunding} />
          <MarketStrengthGauge
            label="김프"
            value={summary?.marketMetrics?.kimchiPremiumPercent}
            display={formatPercent(summary?.marketMetrics?.kimchiPremiumPercent)}
            min={-5}
            max={5}
            tone={toneFromPremium(summary?.marketMetrics?.kimchiPremiumPercent)}
            showBar={false}
          />
          <article className="min-w-0 border-t border-ui-line py-3">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">환율</p>
              </div>
              <p className="shrink-0 text-right text-base font-semibold leading-5 text-ui-text">{formatKrwRate(summary?.marketMetrics?.usdKrw)}</p>
            </div>
          </article>
        </div>
      </PanelCard>

    </div>
  );
}
