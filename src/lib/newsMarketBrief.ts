import type { PerpetualAsset, PerpetualDecisionSnapshot } from "./perpetualDecisionSnapshot";
import type { GlobalReactionObservation, NewsMarketBrief, NewsMarketBriefMetric } from "./newsImpact";
import {
  decisionStateLabel,
  flowDirectionLabel,
  pressureDirectionLabel
} from "./perpetualDecisionCopy";

function percentChange(before: number | null, after: number | null) {
  if (before === null || after === null || !Number.isFinite(before) || !Number.isFinite(after) || before === 0) return null;
  return ((after - before) / before) * 100;
}

function percentMetric(key: string, label: string, value: number | null): NewsMarketBriefMetric {
  if (value === null) return { key, label, value: "비교 자료 부족", tone: "neutral" };
  const rounded = Math.abs(value) < 0.005 ? 0 : value;
  return {
    key,
    label,
    value: `${rounded >= 0 ? "+" : ""}${rounded.toFixed(2)}%`,
    tone: rounded > 0 ? "positive" : rounded < 0 ? "negative" : "neutral"
  };
}

export function resolveNewsMarketBriefQuality(input: {
  quality: NewsMarketBrief["quality"];
  generatedAt: string;
  expiresAt?: string | null;
  nowMs: number;
  maxAgeMs?: number;
}): NewsMarketBrief["quality"] {
  if (input.quality !== "ready") return input.quality;
  const generatedMs = Date.parse(input.generatedAt);
  const expiresMs = input.expiresAt ? Date.parse(input.expiresAt) : null;
  const maxAgeMs = input.maxAgeMs ?? 10 * 60_000;
  if (!Number.isFinite(generatedMs) || (expiresMs !== null && !Number.isFinite(expiresMs))) return "stale";
  return (expiresMs !== null && expiresMs <= input.nowMs) || input.nowMs - generatedMs > maxAgeMs ? "stale" : "ready";
}

export function buildCryptoNewsMarketBrief(
  asset: PerpetualAsset,
  current: PerpetualDecisionSnapshot,
  before1h: PerpetualDecisionSnapshot | null,
  before24h: PerpetualDecisionSnapshot | null
): NewsMarketBrief {
  const assetLabel = asset.toUpperCase();
  const flow = current.publicEvidence?.flow;
  const pressure = current.publicEvidence?.pressure;
  const price = Math.round(current.price).toLocaleString("ko-KR");
  return {
    market: "crypto",
    asset,
    generatedAt: current.generatedAt,
    quality: current.quality,
    stateLabel: decisionStateLabel(current.summary.state),
    headline: `${assetLabel}는 지금 ${decisionStateLabel(current.summary.state)} 상태입니다.`,
    topRisk: pressure ? pressureDirectionLabel(pressure.dominantSide) : current.summary.topRisk,
    nextCondition: current.summary.primaryCondition.label,
    snapshotId: current.id,
    ctaHref: `/crypto/perpetual?asset=${asset}&timeframe=15m&snapshot=${encodeURIComponent(current.id)}&source=news`,
    metrics: [
      { key: "price", label: "현재 가격", value: `${price} USDT`, tone: "neutral" },
      percentMetric("change_1h", "1시간", percentChange(before1h?.price ?? null, current.price)),
      percentMetric("change_24h", "24시간", percentChange(before24h?.price ?? null, current.price)),
      {
        key: "large_flow",
        label: "큰 금액 체결",
        value: flow ? flowDirectionLabel(flow.dominantSide) : "자료 확인 중",
        tone: flow?.dominantSide === "buy" ? "positive" : flow?.dominantSide === "sell" ? "negative" : "neutral"
      }
    ]
  };
}

function globalModeLabel(mode: GlobalReactionObservation["marketMode"]) {
  if (mode === "Risk-On") return "위험자산 선호";
  if (mode === "Risk-Off") return "위험 회피";
  return "방향 혼조";
}

function globalGroupMetric(key: string, label: string, value: number): NewsMarketBriefMetric {
  const meaningful = Math.abs(value) >= 1.5;
  const normalized = Math.abs(value) < 0.005 ? 0 : value;
  return {
    key,
    label,
    value: `${normalized >= 0 ? "+" : ""}${normalized.toFixed(2)}σ · ${
      meaningful ? `평소보다 뚜렷한 ${normalized > 0 ? "강세" : "약세"}` : "평균 범위"
    }`,
    tone: !meaningful ? "neutral" : value > 0 ? "positive" : "negative"
  };
}

export function buildGlobalNewsMarketBrief(
  current: GlobalReactionObservation,
  before1h: GlobalReactionObservation | null,
  before24h: GlobalReactionObservation | null
): NewsMarketBrief {
  const currentLabel = globalModeLabel(current.marketMode);
  const modeHistory = [
    before1h ? `1시간 전 ${globalModeLabel(before1h.marketMode).replace("방향 ", "")}` : null,
    before24h ? `24시간 전 ${globalModeLabel(before24h.marketMode).replace("방향 ", "")}` : null
  ].filter(Boolean).join(" · ");
  return {
    market: "global",
    asset: null,
    generatedAt: current.observedAt,
    quality: current.quality,
    stateLabel: currentLabel,
    headline: `글로벌 시장은 지금 ${currentLabel} 상태입니다.`,
    topRisk: current.marketMode === "Risk-Off"
      ? "지수선물 약세와 달러·변동성 부담이 함께 커지는지 확인하세요."
      : "지수선물, 달러·변동성, 섹터 흐름이 서로 엇갈리는지 확인하세요.",
    nextCondition: "지수선물·달러/변동성·섹터 중 두 그룹이 같은 방향으로 강해지는지 확인",
    ctaHref: "/global?source=news",
    metrics: [
      globalGroupMetric("futures", "지수선물", current.signalGroups.futures),
      globalGroupMetric("risk", "달러·변동성", current.signalGroups.risk),
      globalGroupMetric("sectors", "섹터 흐름", current.signalGroups.sectors),
      { key: "history", label: "이전 상태", value: modeHistory || "비교 자료 부족", tone: "neutral" }
    ]
  };
}
