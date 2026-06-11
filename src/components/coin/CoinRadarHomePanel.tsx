"use client";
// Coin Radar 홈에서 대표 코인과 BTC 기준 시장 체력을 빠르게 요약합니다.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, RefreshCw, TrendingUp, X } from "lucide-react";
import { ActionButton, PanelCard, StatusPill } from "@/components/ui/DesignPrimitives";
import type { CoinMarketMetricsPayload } from "@/lib/coinMarketMetrics";
import type { Candle } from "@/lib/marketAnalysis";
import type { LargeTradeFlowReport } from "@/lib/largeTradeFlow";
import type { LiquidationPressureReport } from "@/lib/liquidationPressure";
import type { OptionsMarketReport } from "@/lib/optionsMarket";
import type { StablecoinLiquidityReport } from "@/lib/stablecoinLiquidity";
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
  stablecoinLiquidity: StablecoinLiquidityReport | null;
  largeTradeFlow: LargeTradeFlowReport | null;
  optionsMarket: OptionsMarketReport | null;
  analysisUpdatedAt: number;
}

type CoinHomeState =
  | { status: "loading" }
  | { status: "ready"; data: CoinHomeData }
  | { status: "error"; message: string };

const tileSymbols = ["BTC", "ETH", "XRP", "SOL", "DOGE", "BNB"] as const;
const HOME_FETCH_TIMEOUT_MS = 9000;

type RepresentativeSymbol = (typeof tileSymbols)[number];
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

function toneFromFearGreed(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "info" as const;
  if (value < 50) return "short" as const;
  if (value > 50) return "long" as const;
  return "info" as const;
}

function toneFromPremium(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "info" as const;
  if (Math.abs(value) < 0.5) return "watch" as const;
  return value > 0 ? "risk" as const : "info" as const;
}

function toneFromLiquidity(report: StablecoinLiquidityReport | null | undefined) {
  if (!report) return "info" as const;
  if (report.grade === "strong") return "long" as const;
  if (report.grade === "building") return "info" as const;
  if (report.grade === "drying") return "risk" as const;
  return "watch" as const;
}

function largeTradeTone(report: LargeTradeFlowReport | null | undefined, decision?: CoinHomeDecisionSummary | null) {
  if (!report) return "info" as const;
  if (report.anomalyLevel === "high") return "risk" as const;
  if (report.dominantSide === "buy") {
    return decision?.state === "하락 위험 큼" || decision?.state === "크게 흔들림" ? "watch" as const : "long" as const;
  }
  if (report.dominantSide === "sell") return "short" as const;
  return "watch" as const;
}

function largeTradeGaugeValue(report: LargeTradeFlowReport | null | undefined) {
  if (!report) return null;
  if (report.largeTradeCount <= 0 || report.totalLargeNotionalUsd <= 0) return null;
  return clamp(50 + report.imbalancePercent * 0.45, 0, 100);
}

function largeTradeDisplay(report: LargeTradeFlowReport | null | undefined) {
  if (!report) return "미확인";
  if (report.largeTradeCount <= 0 || report.totalLargeNotionalUsd <= 0) return "특이 신호 없음";
  if (report.dominantSide === "buy") return "큰 매수 체결";
  if (report.dominantSide === "sell") return "큰 매도 체결";
  return "균형";
}

function optionsTone(report: OptionsMarketReport | null | undefined) {
  if (!report) return "info" as const;
  if (report.expectedMovePercent !== null && report.expectedMovePercent >= 9) return "risk" as const;
  return "watch" as const;
}

function optionsGaugeValue(report: OptionsMarketReport | null | undefined) {
  if (!report?.expectedMovePercent || !Number.isFinite(report.expectedMovePercent)) return null;
  return clamp(report.expectedMovePercent * 5, 0, 100);
}

function optionsDisplay(report: OptionsMarketReport | null | undefined) {
  if (!report?.expectedMovePercent || !Number.isFinite(report.expectedMovePercent)) return "미확인";
  return `±${report.expectedMovePercent.toFixed(report.expectedMovePercent >= 10 ? 0 : 1)}%`;
}

const visualToneClass: Record<VisualTone, { text: string; bar: string }> = {
  long: { text: "text-ui-long", bar: "bg-ui-long" },
  short: { text: "text-ui-short", bar: "bg-ui-short" },
  watch: { text: "text-ui-watch", bar: "bg-ui-watch" },
  risk: { text: "text-ui-risk", bar: "bg-ui-risk" },
  info: { text: "text-ui-brand", bar: "bg-ui-brand" }
};

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
  if (changePercent >= 2.5) return { label: "위쪽 확인", tone: "long" as const, icon: ArrowUpRight };
  if (changePercent <= -2.5) return { label: "아래쪽 확인", tone: "short" as const, icon: ArrowDownRight };
  return { label: "변화 작음", tone: "watch" as const, icon: TrendingUp };
}

function scoreFor(changePercent: number, marketScore: number | null) {
  const marketBias = marketScore === null ? 0 : (marketScore - 50) * 0.18;
  return Math.round(clamp(50 + changePercent * 4.5 + marketBias, 8, 92));
}

function tileToneClass(changePercent: number) {
  if (changePercent >= 2.5) return "border-emerald-400/25 bg-emerald-500/10";
  if (changePercent >= 0) return "border-emerald-500/15 bg-emerald-500/5";
  if (changePercent <= -2.5) return "border-red-400/25 bg-red-500/10";
  return "border-red-500/15 bg-red-500/5";
}

function tileAccentClass(changePercent: number) {
  if (changePercent >= 0) return "text-emerald-200";
  return "text-red-200";
}

function scoreToneClass(score: number) {
  if (score >= 80) return "bg-emerald-300/20 text-emerald-100";
  if (score >= 70) return "bg-emerald-500/15 text-emerald-100";
  if (score >= 60) return "bg-emerald-800/35 text-emerald-100";
  if (score >= 50) return "bg-slate-600/35 text-slate-100";
  if (score >= 40) return "bg-red-900/35 text-red-100";
  if (score >= 30) return "bg-red-700/25 text-red-100";
  return "bg-red-500/20 text-red-100";
}

function riskFor(changePercent: number) {
  if (changePercent >= 6) return "추격 리스크 큼";
  if (changePercent <= -6) return "확인 전 보류";
  if (changePercent >= 2.5) return "확인 대기";
  if (changePercent <= -2.5) return "하방 우세";
  return "관망";
}

function checkFor(changePercent: number) {
  if (changePercent >= 2.5) return "후보 거래대금 유지";
  if (changePercent <= -2.5) return "보류 후 저점권 확인";
  return "BTC 방향과 뉴스 충돌 확인";
}

function directSignalText(text: string | undefined) {
  return (text ?? "미확인")
    .replace(/리스크 우선/g, "위험 먼저 확인")
    .replace(/선물 포지션 쏠림/g, "롱/숏 포지션 쏠림")
    .replace(/선물 쏠림 큼/g, "롱/숏 쏠림 강함")
    .replace(/하락 위험/g, "하방 우세")
    .replace(/큰 경고 없음/g, "큰 위험 신호 없음")
    .replace(/추적 조건/g, "재확인 기준");
}

function conclusionText(decision: CoinHomeDecisionSummary | undefined) {
  if (!decision) return "시장 데이터를 확인하는 중입니다.";
  if (decision.state === "하락 위험 큼") return "위험 확인 구간입니다. 하방 우세가 약해질 때까지 대기합니다.";
  if (decision.state === "크게 흔들림") {
    return "추격 리스크가 큰 구간입니다. 롱/숏 위험이 낮아진 뒤 다시 봅니다.";
  }
  if (decision.state === "추적 우세") {
    return "후보 신호가 보입니다. 확인 조건과 무효화 기준을 같이 봅니다.";
  }
  if (decision.state === "확인 필요") {
    return "확인 대기 구간입니다. BTC와 알트 방향 정렬을 기다립니다.";
  }
  return "관망 구간입니다. 후보 신호는 알림으로만 추적합니다.";
}

function invalidationText(decision: CoinHomeDecisionSummary | undefined) {
  if (!decision) return "시장 데이터 확인 필요";
  if (decision.state === "하락 위험 큼") return "BTC 약세 지속 시 보류";
  if (decision.state === "크게 흔들림") return "롱/숏 쏠림 강하면 관망";
  if (decision.state === "추적 우세") return "BTC 이탈 또는 알트 거래대금 약화";
  if (decision.topRisk !== "큰 경고 없음") return `${directSignalText(decision.topRisk)} 확대 시 보류`;
  return "새 위험 신호 발생 시 보류";
}

function volatilityWatchText(report: OptionsMarketReport | null | undefined) {
  if (!report) return "롱/숏 위험 대기";
  if (report.expectedMovePercent !== null && report.expectedMovePercent >= 14) return "변동성 위험 증가";
  if (report.expectedMovePercent !== null && report.expectedMovePercent >= 9) return "롱/숏 위험 확대";
  return "변동성 기준 확인";
}

function readinessDisplay(decision: CoinHomeDecisionSummary | undefined) {
  if (!decision) return { label: "오늘 확인 기준", value: "판단 대기", detail: "시장 데이터 확인 중" };
  const score = `${decision.readinessScore}/100`;
  if (decision.state === "하락 위험 큼" || decision.readinessScore <= 20) {
    return { label: "오늘 확인 기준", value: `추적 준비도 ${score}`, detail: "하방 우세 완화 전 보류" };
  }
  if (decision.state === "크게 흔들림") {
    return { label: "오늘 확인 기준", value: `추적 준비도 ${score}`, detail: "추격 리스크 큼" };
  }
  if (decision.state === "관망하기" || decision.readinessScore < 45) {
    return { label: "오늘 확인 기준", value: `추적 준비도 ${score}`, detail: "후보 신호는 알림으로 추적" };
  }
  if (decision.state === "확인 필요") {
    return { label: "오늘 확인 기준", value: `추적 준비도 ${score}`, detail: "확인가 도달 전 대기" };
  }
  return { label: "오늘 확인 기준", value: `추적 준비도 ${score}`, detail: "후보 신호와 무효화 기준 확인" };
}

function marketModeDisplay(decision: CoinHomeDecisionSummary | undefined) {
  if (!decision) return { label: "시장 판단", value: "판단 대기", detail: "시장 데이터 확인 중" };
  if (decision.leadership === "리스크 우선" || decision.state === "하락 위험 큼") {
    return { label: "시장 판단", value: "하방 우세", detail: "BTC 4H 약세 완화 전 보류" };
  }
  if (decision.state === "크게 흔들림") {
    return { label: "시장 판단", value: "롱/숏 위험", detail: "포지션 부담 완화 전 관망" };
  }
  if (decision.leadership === "섞임") {
    return { label: "시장 판단", value: "확인 대기", detail: directSignalText(decision.reason) };
  }
  return {
    label: "시장 판단",
    value: decision.leadership === "알트도 강함" ? "후보 신호 확대" : directSignalText(decision.leadership),
    detail: directSignalText(decision.reason)
  };
}

function focusSectionTitle(decision: CoinHomeDecisionSummary | undefined) {
  if (!decision) return "확인 기준";
  if (decision.state === "하락 위험 큼") return "보류 기준";
  if (decision.state === "크게 흔들림") return "롱/숏 위험 기준";
  if (decision.state === "관망하기" || decision.state === "확인 필요") return "확인 대기 기준";
  return "후보 신호 기준";
}

function recheckConditionText(decision: CoinHomeDecisionSummary | undefined) {
  if (!decision) return "시장 데이터 확인 필요";
  if (decision.state === "하락 위험 큼") return "하방 우세 완화 전 보류";
  if (decision.state === "크게 흔들림") return "롱/숏 위험 완화 전 관망";
  if (decision.state === "관망하기") return "후보 신호는 알림으로 추적";
  if (decision.state === "추적 우세") return "후보 거래대금 유지";
  return directSignalText(decision.nextCondition);
}

function confirmationMetricText(decision: CoinHomeDecisionSummary | undefined) {
  if (!decision) return "시장 데이터 확인 필요";
  if (decision.state === "하락 위험 큼") return "무효화 기준 먼저 확인";
  if (decision.state === "크게 흔들림") return "롱/숏 쏠림과 변동성 위험";
  if (decision.state === "추적 우세") return "후보 거래대금 유지";
  return "BTC 흐름 · 큰 뉴스 반응";
}

function decisionDisplayLabel(decision: CoinHomeDecisionSummary | undefined) {
  if (!decision) return "판단 대기";
  if (decision.state === "하락 위험 큼") return "위험 확인";
  if (decision.state === "크게 흔들림") return "추격 리스크";
  if (decision.state === "추적 우세") return "후보 신호";
  if (decision.state === "확인 필요") return "확인 대기";
  return "관망";
}

function radarInterpretation(decision: CoinHomeDecisionSummary | undefined) {
  if (!decision) return "시장 데이터 확인 중";
  if (decision.state === "하락 위험 큼") return "지금은 위험 회피 우선";
  if (decision.state === "크게 흔들림") return "롱/숏 위험 높음 · 관망";
  if (decision.state === "추적 우세") return "후보 신호와 무효화 기준 확인";
  if (decision.state === "확인 필요") return "확인가 도달 전 대기";
  return "후보 신호는 알림으로 추적";
}

function decisionTone(decision: CoinHomeDecisionSummary | undefined): "long" | "short" | "watch" | "risk" | "info" {
  if (!decision) return "info";
  if (decision.state === "추적 우세") return "long";
  if (decision.state === "하락 위험 큼") return "short";
  if (decision.state === "크게 흔들림") return "risk";
  return "watch";
}

function primaryActionFor(decision: CoinHomeDecisionSummary | undefined) {
  if (!decision) {
    return { label: "알림 조건 저장", detail: "판단 전 알림으로 대기", href: "/crypto/alert" };
  }
  if (decision.state === "하락 위험 큼" || decision.state === "크게 흔들림" || decision.leadership === "리스크 우선") {
    return { label: "포지션 위험 먼저 보기", detail: "관망 기준 확인", href: "/crypto/perpetual" };
  }
  if (decision.state === "추적 우세") {
    return { label: "후보 신호 보기", detail: "오늘 조건 확인", href: "/crypto/spot" };
  }
  if (decision.state === "확인 필요" && decision.topRisk === "큰 경고 없음") {
    return { label: "뉴스 영향 보기", detail: "뉴스 충돌 확인", href: "/crypto/news" };
  }
  return { label: "알림 조건 저장", detail: "조건은 알림으로 대기", href: "/crypto/alert" };
}

function todayTasksFor(decision: CoinHomeDecisionSummary | undefined) {
  if (!decision) return ["시장 판단 대기", "후보 신호는 알림으로 추적", "뉴스 충돌 확인"];
  if (decision.state === "하락 위험 큼" || decision.state === "크게 흔들림" || decision.leadership === "리스크 우선") {
    return ["포지션 위험 먼저 판단", "현물은 확인가까지 대기", "무효화 알림 저장"];
  }
  if (decision.state === "추적 우세") {
    return ["후보 신호 먼저 확인", "무효화 기준 확인", "뉴스 충돌 확인"];
  }
  if (decision.state === "확인 필요") {
    return ["BTC·알트 방향 정렬 대기", "후보 신호는 확인가까지 대기", "뉴스 충돌 확인"];
  }
  return ["BTC 방향 정렬 대기", "후보 신호는 알림으로 추적", "뉴스 영향만 확인"];
}

const quickActions = [
  { label: "후보 신호", detail: "오늘 조건 보기", href: "/crypto/spot" },
  { label: "포지션 위험", detail: "관망 기준 보기", href: "/crypto/perpetual" },
  { label: "뉴스 영향", detail: "뉴스 충돌 확인", href: "/crypto/news" },
  { label: "알림 걸기", detail: "무효화 기준 저장", href: "/crypto/alert" }
];

function largeTradeDetail(
  report: LargeTradeFlowReport | null | undefined,
  decision: CoinHomeDecisionSummary | undefined,
  technical: TechnicalRadarReport | null | undefined,
  technical4h: TechnicalRadarReport | null | undefined
) {
  if (!report) return undefined;
  if (report.largeTradeCount <= 0 || report.totalLargeNotionalUsd <= 0) return "최근 큰 유입/이탈 신호는 제한적입니다.";
  const weakBtc = technical?.trendLabel.includes("하락") || technical4h?.trendLabel.includes("하락") || decision?.state === "하락 위험 큼";
  if (report.dominantSide === "buy" && weakBtc) return "큰 유입은 있으나 BTC 약세 완화 전 보류입니다.";
  if (report.dominantSide === "buy") return "큰 유입 유지 여부를 봅니다.";
  if (report.dominantSide === "sell") return "큰 이탈 확대 시 보류입니다.";
  return report.summary;
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
  centerValue = 0,
  centerLabel,
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
  centerValue?: number;
  centerLabel?: string;
  showBar?: boolean;
}) {
  const hasValue = value !== null && value !== undefined && Number.isFinite(value);
  const percent = hasValue ? clamp(((value - min) / (max - min)) * 100) : 0;
  const centerPercent = clamp(((centerValue - min) / (max - min)) * 100);
  const toneClass = visualToneClass[tone];

  return (
    <article className="min-w-0 rounded-ui-sm bg-ui-inset/30 p-3">
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
        <div className="relative mt-1.5 flex justify-between gap-3 text-[10px] font-semibold text-ui-subtle">
          <span>{leftLabel}</span>
          {showCenter && centerLabel ? (
            <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${centerPercent}%` }}>
              {centerLabel}
            </span>
          ) : null}
          <span>{rightLabel}</span>
        </div>
      ) : null}
    </article>
  );
}

function TrendBreadthVisual({
  report,
  label = "BTC 트렌드",
  mergeWithPrevious = false
}: {
  report: TechnicalRadarReport | null | undefined;
  label?: string;
  mergeWithPrevious?: boolean;
}) {
  const bullish = report?.bullishCount ?? 0;
  const bearish = report?.bearishCount ?? 0;
  const neutral = report?.neutralCount ?? 0;
  const total = bullish + bearish + neutral;
  const bullishWidth = total ? (bullish / total) * 100 : 0;
  const neutralWidth = total ? (neutral / total) * 100 : 0;
  const bearishWidth = total ? (bearish / total) * 100 : 0;

  return (
    <article className="min-w-0 rounded-ui-sm bg-ui-inset/30 p-3">
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
    <article className="min-w-0 rounded-ui-sm bg-ui-inset/30 p-3">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">선물 포지션</p>
        </div>
        <p className="shrink-0 text-right text-base font-semibold leading-5 text-ui-text">{formatRatio(ratio)}</p>
      </div>
      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-ui-line">
        <span className="h-full bg-ui-long" style={{ width: `${longWidth}%` }} aria-hidden />
        <span className="h-full bg-ui-short" style={{ width: `${shortWidth}%` }} aria-hidden />
      </div>
      <div className="mt-2 flex justify-between gap-3 text-[10px] font-semibold">
        <span className="text-ui-long">롱 포지션 {formatPlainPercent(longPercent, 1)}</span>
        <span className="text-ui-short">숏 포지션 {formatPlainPercent(shortPercent, 1)}</span>
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
  return "롱/숏 쏠림 낮음";
}

function FundingRateRow({ symbol, report }: { symbol: RepresentativeSymbol; report: LiquidationPressureReport | null | undefined }) {
  return (
    <article className="rounded-ui-sm bg-ui-inset/30 p-3">
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

function CoinStatusTile({
  symbol,
  item,
  score,
  onClick
}: {
  symbol: RepresentativeSymbol;
  item: MarketBoardItem | null;
  score: number;
  onClick: () => void;
}) {
  const changePercent = item?.changePercent ?? 0;
  const direction = directionFor(changePercent);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-14 w-full items-center gap-3 rounded-ui-sm border px-3 py-2 text-left transition hover:bg-ui-inset/55 active:scale-[0.99] ${tileToneClass(
        changePercent
      )}`}
      aria-label={`${symbol} 상세 보기`}
    >
      <span className="w-12 shrink-0 text-sm font-semibold tracking-tight text-ui-text">{symbol}</span>
      <span className={`w-16 shrink-0 text-right text-sm font-semibold ${tileAccentClass(changePercent)}`}>
        {formatPercent(item?.changePercent)}
      </span>
      <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold leading-none ${scoreToneClass(score)}`}>
        {score}점
      </span>
      <span className="min-w-0 flex-1 text-right">
        <span className={`block truncate text-xs font-semibold ${direction.tone === "long" ? "text-ui-long" : direction.tone === "short" ? "text-ui-short" : "text-ui-watch"}`}>
          {direction.label}
        </span>
        <span className="mt-0.5 block truncate text-[10px] font-semibold text-ui-subtle">
          {item ? `$${formatPrice(item.price)}` : "가격 확인 중"}
        </span>
      </span>
    </button>
  );
}

function findReading(report: TechnicalRadarReport | null, label: string): IndicatorReading | null {
  if (!report) return null;
  return [...report.momentumIndicators, ...report.trendIndicators, ...report.volatilityIndicators].find((item) => item.label === label) ?? null;
}

async function jsonOrNull<T>(input: RequestInfo | URL, timeoutMs = HOME_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, { cache: "no-store", signal: controller.signal });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function withTimeoutFallback<T>(promise: Promise<T>, fallback: T, timeoutMs = HOME_FETCH_TIMEOUT_MS + 1500) {
  let timeoutId: number | null = null;
  const timeout = new Promise<T>((resolve) => {
    timeoutId = window.setTimeout(() => resolve(fallback), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId !== null) window.clearTimeout(timeoutId);
  });
}

export function CoinRadarHomePanel() {
  const [state, setState] = useState<CoinHomeState>({ status: "loading" });
  const [selectedSymbol, setSelectedSymbol] = useState<RepresentativeSymbol | null>(null);

  async function load() {
    setState({ status: "loading" });

    try {
      type HomePayloads = [
        { items?: MarketBoardItem[]; cachedAt?: number; cached?: boolean; stale?: boolean } | null,
        { candles?: Candle[] } | null,
        { candles?: Candle[] } | null,
        CoinMarketMetricsPayload | null,
        { report?: StablecoinLiquidityReport } | null,
        { report?: LargeTradeFlowReport } | null,
        { report?: OptionsMarketReport } | null,
        { report?: LiquidationPressureReport; cachedAt?: number; cached?: boolean; stale?: boolean } | null,
        { report?: LiquidationPressureReport; cachedAt?: number; cached?: boolean; stale?: boolean } | null,
        { report?: LiquidationPressureReport; cachedAt?: number; cached?: boolean; stale?: boolean } | null,
        { report?: LiquidationPressureReport; cachedAt?: number; cached?: boolean; stale?: boolean } | null,
        { report?: LiquidationPressureReport; cachedAt?: number; cached?: boolean; stale?: boolean } | null,
        { report?: LiquidationPressureReport; cachedAt?: number; cached?: boolean; stale?: boolean } | null
      ];
      const emptyPayloads: HomePayloads = [null, null, null, null, null, null, null, null, null, null, null, null, null];
      const [
        boardPayload,
        candlesPayload,
        candles4hPayload,
        marketMetricsPayload,
        stablecoinLiquidityPayload,
        largeTradeFlowPayload,
        optionsMarketPayload,
        btcFundingPayload,
        ethFundingPayload,
        xrpFundingPayload,
        solFundingPayload,
        dogeFundingPayload,
        bnbFundingPayload
      ] = await withTimeoutFallback<HomePayloads>(Promise.all([
        jsonOrNull<{ items?: MarketBoardItem[]; cachedAt?: number; cached?: boolean; stale?: boolean }>("/api/market-board"),
        jsonOrNull<{ candles?: Candle[] }>("/api/crypto-candles?symbol=BTCUSDT&timeframe=1h&limit=180"),
        jsonOrNull<{ candles?: Candle[] }>("/api/crypto-candles?symbol=BTCUSDT&timeframe=4h&limit=180"),
        jsonOrNull<CoinMarketMetricsPayload>("/api/coin-market-metrics"),
        jsonOrNull<{ report?: StablecoinLiquidityReport }>("/api/stablecoin-liquidity"),
        jsonOrNull<{ report?: LargeTradeFlowReport }>("/api/large-trade-flow?symbol=BTCUSDT"),
        jsonOrNull<{ report?: OptionsMarketReport }>("/api/options-market?currency=BTC"),
        jsonOrNull<{ report?: LiquidationPressureReport; cachedAt?: number; cached?: boolean; stale?: boolean }>("/api/liquidation-pressure?symbol=BTCUSDT&period=1h"),
        jsonOrNull<{ report?: LiquidationPressureReport; cachedAt?: number; cached?: boolean; stale?: boolean }>("/api/liquidation-pressure?symbol=ETHUSDT&period=1h"),
        jsonOrNull<{ report?: LiquidationPressureReport; cachedAt?: number; cached?: boolean; stale?: boolean }>("/api/liquidation-pressure?symbol=XRPUSDT&period=1h"),
        jsonOrNull<{ report?: LiquidationPressureReport; cachedAt?: number; cached?: boolean; stale?: boolean }>("/api/liquidation-pressure?symbol=SOLUSDT&period=1h"),
        jsonOrNull<{ report?: LiquidationPressureReport; cachedAt?: number; cached?: boolean; stale?: boolean }>("/api/liquidation-pressure?symbol=DOGEUSDT&period=1h"),
        jsonOrNull<{ report?: LiquidationPressureReport; cachedAt?: number; cached?: boolean; stale?: boolean }>("/api/liquidation-pressure?symbol=BNBUSDT&period=1h")
      ]), emptyPayloads);

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
          stablecoinLiquidity: stablecoinLiquidityPayload?.report ?? null,
          largeTradeFlow: largeTradeFlowPayload?.report ?? null,
          optionsMarket: optionsMarketPayload?.report ?? null,
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
    const btc = boardItem(state.data.board, "BTC");
    const rsi = findReading(report, "RSI 14");
    const stochastic = findReading(report, "Stochastic");
    const btcFunding = state.data.funding.BTC ?? null;
    const marketMetrics = state.data.marketMetrics;
    const stablecoinLiquidity = state.data.stablecoinLiquidity;
    const largeTradeFlow = state.data.largeTradeFlow;
    const optionsMarket = state.data.optionsMarket;
    const decision = buildCoinHomeDecision({
      board: state.data.board,
      technical: report,
      technical4h: report4h,
      marketMetrics,
      btcFunding,
      stablecoinLiquidity,
      largeTradeFlow,
      optionsMarket
    });

    return { report, report4h, fearGreed, btc, rsi, stochastic, btcFunding, marketMetrics, stablecoinLiquidity, largeTradeFlow, optionsMarket, decision };
  }, [state]);

  if (state.status === "loading") {
    return (
      <div className="flex max-w-full flex-col gap-3 overflow-x-hidden" aria-busy="true">
        <section className="rounded-ui-lg bg-ui-panel px-4 pb-5 pt-4">
          <div className="h-3 w-20 rounded-full bg-ui-brand/25" />
          <div className="mt-4 h-8 w-44 rounded-ui-sm bg-ui-elevated" />
          <div className="mt-4 h-5 w-56 max-w-full rounded-ui-sm bg-ui-elevated" />
          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="h-16 rounded-ui-sm bg-ui-elevated" />
            <div className="h-16 rounded-ui-sm bg-ui-elevated" />
          </div>
          <div className="mt-4 h-12 rounded-ui-sm bg-ui-brand/25" />
        </section>
        <section className="rounded-ui-lg bg-ui-panel px-4 py-4">
          <p className="text-sm font-semibold text-ui-muted">코인 시장을 분석하고 있습니다.</p>
          <div className="mt-4 space-y-3">
            <div className="h-5 rounded-ui-sm bg-ui-elevated" />
            <div className="h-5 rounded-ui-sm bg-ui-elevated" />
            <div className="h-5 rounded-ui-sm bg-ui-elevated" />
          </div>
        </section>
      </div>
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

  const decision = summary?.decision;
  const readiness = readinessDisplay(decision);
  const marketMode = marketModeDisplay(decision);
  const focusTitle = focusSectionTitle(decision);
  const recheckCondition = recheckConditionText(decision);
  const confirmationMetric = confirmationMetricText(decision);
  const primaryAction = primaryActionFor(decision);
  const todayTasks = todayTasksFor(decision);

  return (
    <div className="flex max-w-full flex-col gap-3 overflow-x-hidden">
      <section className="rounded-ui-lg bg-ui-panel px-4 pb-5 pt-4">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-3">
          <div className="min-w-0">
            <p className="text-ui-label font-semibold uppercase tracking-[0.12em] text-ui-brand">COIN RADAR</p>
            <h2 className="mt-1 text-[1.7rem] font-semibold leading-9 tracking-tight text-ui-text">오늘의 레이더</h2>
          </div>
          <ActionButton tone="ghost" className="min-h-9 shrink-0 px-3 text-xs" onClick={() => void load()}>
            <RefreshCw size={12} aria-hidden />
            새로고침
          </ActionButton>
          <div className="col-span-2 min-w-0">
            <StatusPill tone={decisionTone(decision)}>
              {decisionDisplayLabel(decision)}
            </StatusPill>
            <p className="mt-3 text-xl font-semibold leading-8 text-ui-text [word-break:keep-all]">{radarInterpretation(decision)}</p>
            <p className="mt-2 text-sm leading-6 text-ui-muted [word-break:keep-all]">{primaryAction.detail}</p>
          </div>
          <div className="col-span-2 grid min-w-0 grid-cols-2 gap-2">
            <div className="min-w-0 rounded-ui-sm bg-ui-elevated px-3 py-3">
              <p className="truncate text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">{readiness.label}</p>
              <p className="mt-1 truncate text-base font-semibold text-ui-text">{readiness.value}</p>
            </div>
            <div className="min-w-0 rounded-ui-sm bg-ui-elevated px-3 py-3">
              <p className="truncate text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">{marketMode.label}</p>
              <p className="mt-1 truncate text-base font-semibold text-ui-text">{marketMode.value}</p>
            </div>
          </div>
          <div className="col-span-2">
            <ActionButton tone="primary" href={primaryAction.href} className="min-h-12 w-full justify-between px-4 text-[15px]">
              <span>{primaryAction.label}</span>
              <ArrowUpRight size={15} aria-hidden />
            </ActionButton>
          </div>
        </div>
      </section>

      <section className="rounded-ui-lg bg-ui-panel px-4 py-4">
        <p className="text-ui-label font-semibold uppercase tracking-[0.12em] text-ui-subtle">오늘 판단 순서</p>
        <ol className="mt-4 divide-y divide-ui-line">
          {todayTasks.slice(0, 3).map((task, index) => (
            <li key={task} className="flex min-w-0 items-center gap-3 py-3.5">
              <span className="shrink-0 text-sm font-semibold text-ui-brand">
                {index + 1}
              </span>
              <span className="min-w-0 text-[15px] font-medium leading-6 text-ui-text [word-break:keep-all]">{task}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-ui-lg bg-ui-panel px-4 py-2" aria-label="빠른 실행">
        {quickActions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="block min-w-0 border-t border-ui-line py-3.5 text-left transition first:border-t-0 hover:text-ui-brand active:scale-[0.99]"
          >
            <span className="flex min-w-0 items-center justify-between gap-3 text-[15px] font-semibold leading-6 text-ui-text">
              <span className="min-w-0 [word-break:keep-all]">{action.label}</span>
              <ArrowUpRight size={14} aria-hidden className="shrink-0 text-ui-subtle" />
            </span>
            <span className="mt-1 block text-sm font-medium leading-5 text-ui-muted [word-break:keep-all]">{action.detail}</span>
          </Link>
        ))}
      </section>

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
                <div className="mt-4 divide-y divide-ui-line/60 rounded-ui-md bg-ui-inset/25">
                  <FundingRateRow symbol={selectedSymbol} report={state.data.funding[selectedSymbol] ?? null} />
                </div>
                <div className="mt-4 space-y-3 text-sm leading-6 text-ui-muted">
                  <div>
                    <p className="font-semibold text-ui-text">관찰 보류 기준</p>
                    <p className="mt-1">
                      {riskFor(item?.changePercent ?? 0)}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-ui-text">다음 판단</p>
                    <p className="mt-1">
                      {checkFor(item?.changePercent ?? 0)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      ) : null}

      <section className="py-4">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-base font-semibold text-ui-text">왜 이 결론인지 보기</p>
            </div>
            <span className="shrink-0 text-sm font-semibold text-ui-muted group-open:hidden">펼치기</span>
            <span className="hidden shrink-0 text-sm font-semibold text-ui-muted group-open:inline">판단 근거 접기</span>
          </summary>

          <div className="mt-4 space-y-5 border-t border-ui-line pt-4">
            <section className="space-y-3">
              <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">판단 압축 근거</p>
              <div className="divide-y divide-ui-line sm:grid sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                <article className="min-w-0 py-3 sm:px-3">
                  <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">{readiness.label}</p>
                  <p className="mt-1 text-base font-semibold text-ui-text">{readiness.value}</p>
                  <p className="mt-1 text-sm leading-6 text-ui-muted [word-break:keep-all]">{readiness.detail}</p>
                </article>
                <article className="min-w-0 py-3 sm:px-3">
                  <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">{marketMode.label}</p>
                  <p className="mt-1 text-base font-semibold text-ui-text">{marketMode.value}</p>
                  <p className="mt-1 text-sm leading-6 text-ui-muted [word-break:keep-all]">{marketMode.detail}</p>
                </article>
                <article className="min-w-0 py-3 sm:px-3">
                  <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">다시 볼 기준</p>
                  <p className="mt-1 text-sm font-semibold leading-5 text-ui-text [word-break:keep-all]">{recheckCondition}</p>
                  <p className="mt-1 text-sm leading-6 text-ui-muted [word-break:keep-all]">{conclusionText(summary?.decision)}</p>
                </article>
              </div>
            </section>

            <section className="border-t border-ui-line pt-4">
              <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">{focusTitle}</p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <article className="min-w-0">
                  <p className="text-sm font-semibold text-ui-muted">BTC 흐름</p>
                  <p className="mt-1 text-base font-semibold text-ui-text">{summary?.report?.trendLabel ?? "미확인"}</p>
                  <p className="mt-1 text-sm leading-6 text-ui-muted [word-break:keep-all]">4H {summary?.report4h?.trendLabel ?? "미확인"}까지 같이 봅니다.</p>
                </article>
                <article className="min-w-0">
                  <p className="text-sm font-semibold text-ui-muted">다음 지표</p>
                  <p className="mt-1 text-base font-semibold leading-6 text-ui-text [word-break:keep-all]">{confirmationMetric}</p>
                </article>
                <article className="min-w-0">
                  <p className="text-sm font-semibold text-ui-muted">주의 포인트</p>
                  <p className="mt-1 text-base font-semibold text-ui-text">{directSignalText(summary?.decision.topRisk)}</p>
                  <p className="mt-1 text-sm leading-6 text-ui-muted [word-break:keep-all]">부담이 낮아질 때까지 관찰만 유지합니다.</p>
                </article>
              </div>
            </section>

            <section className="border-t border-ui-line pt-4">
              <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">무효화 기준과 롱·숏 위험</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <article className="min-w-0">
                  <p className="text-sm font-semibold text-ui-muted">무효화 기준</p>
                  <p className="mt-1 text-base font-semibold leading-6 text-ui-text [word-break:keep-all]">{invalidationText(summary?.decision)}</p>
                </article>
                <article className="min-w-0">
                  <p className="text-sm font-semibold text-ui-muted">롱/숏 위험</p>
                  <p className="mt-1 text-base font-semibold text-ui-text">{optionsDisplay(summary?.optionsMarket)}</p>
                  <p className="mt-1 text-sm leading-6 text-ui-muted [word-break:keep-all]">{volatilityWatchText(summary?.optionsMarket)}</p>
                </article>
              </div>
            </section>

            <section className="space-y-2">
              <div className="flex items-end justify-between gap-3">
                <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">대표 코인별 확인 근거</p>
                <p className="text-right text-[11px] font-semibold leading-4 text-ui-subtle">코인별 상세 확인</p>
              </div>
              <div className="mx-auto grid w-full max-w-2xl gap-2">
                {tileSymbols.map((symbol) => {
                  const item = boardItem(state.data.board, symbol);
                  const score = scoreFor(item?.changePercent ?? 0, summary?.fearGreed?.score ?? null);
                  return <CoinStatusTile key={symbol} symbol={symbol} item={item} score={score} onClick={() => setSelectedSymbol(symbol)} />;
                })}
              </div>
            </section>

            <section className="border-t border-ui-line pt-4">
              <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">결론에 반영한 BTC 지표</p>
              <div className="mt-1 grid gap-3 md:grid-cols-2">
                <MarketStrengthGauge
                  label="공포탐욕"
                  value={summary?.fearGreed?.score}
                  display={summary?.fearGreed ? `${summary.fearGreed.score} · ${summary.fearGreed.label}` : "미확인"}
                  tone={toneFromFearGreed(summary?.fearGreed?.score)}
                  leftLabel="공포"
                  rightLabel="탐욕"
                />
                <MarketStrengthGauge
                  label="스테이블코인 유동성"
                  value={summary?.stablecoinLiquidity?.flowScore}
                  display={summary?.stablecoinLiquidity ? `${summary.stablecoinLiquidity.flowScore}점` : "미확인"}
                  detail={summary?.stablecoinLiquidity?.summary}
                  tone={toneFromLiquidity(summary?.stablecoinLiquidity)}
                />
                <MarketStrengthGauge
                  label="큰 매수/매도 체결"
                  value={largeTradeGaugeValue(summary?.largeTradeFlow)}
                  display={largeTradeDisplay(summary?.largeTradeFlow)}
                  detail={largeTradeDetail(summary?.largeTradeFlow, decision, summary?.report, summary?.report4h)}
                  tone={largeTradeTone(summary?.largeTradeFlow, decision)}
                  leftLabel="매도"
                  rightLabel="매수"
                />
                <MarketStrengthGauge
                  label="옵션 예상 변동"
                  value={optionsGaugeValue(summary?.optionsMarket)}
                  display={optionsDisplay(summary?.optionsMarket)}
                  detail={volatilityWatchText(summary?.optionsMarket)}
                  tone={optionsTone(summary?.optionsMarket)}
                  leftLabel="낮음"
                  rightLabel="높음"
                />
                <MarketStrengthGauge
                  label="BTC RSI"
                  value={parseReadingNumber(summary?.rsi?.value)}
                  display={summary?.rsi?.value ?? "미확인"}
                  tone={summary?.rsi?.tone === "warning" ? "risk" : toneFromPercent(parseReadingNumber(summary?.rsi?.value))}
                  leftLabel="낮음"
                  rightLabel="과열"
                />
                <MarketStrengthGauge
                  label="BTC 스토캐스틱"
                  value={parseReadingNumber(summary?.stochastic?.value)}
                  display={summary?.stochastic?.value ?? "미확인"}
                  tone={summary?.stochastic?.tone === "warning" ? "risk" : toneFromPercent(parseReadingNumber(summary?.stochastic?.value))}
                  leftLabel="하락 과열"
                  rightLabel="상승 과열"
                />
                <TrendBreadthVisual report={summary?.report} label="BTC 1H 트렌드" />
                <TrendBreadthVisual report={summary?.report4h} label="BTC 4H 트렌드" mergeWithPrevious />
                <MarketStrengthGauge
                  label="BTC 도미넌스 (비트코인 시장 점유율)"
                  value={summary?.marketMetrics?.btcDominancePercent}
                  display={formatPlainPercent(summary?.marketMetrics?.btcDominancePercent)}
                  tone="info"
                  leftLabel="0%"
                  rightLabel="100%"
                  showCenter
                  centerValue={50}
                  centerLabel="50%"
                />
                <LongShortVisual report={summary?.btcFunding} />
                <MarketStrengthGauge
                  label="김치 프리미엄"
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
            </section>
          </div>
        </details>
      </section>

    </div>
  );
}
