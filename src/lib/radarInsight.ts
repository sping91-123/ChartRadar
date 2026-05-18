// 기존 레이더 분석 결과를 판단, 조건, 리스크 중심의 공통 표시 모델로 감싼다.
import type { MarketAnalysis } from "@/lib/marketAnalysis";
import { evaluateRadarDecision } from "@/lib/radarDecisionEngine";
import type { TechnicalRadarReport } from "@/lib/technicalRadar";

export type RadarInsightMarket = "crypto" | "global";
export type RadarFinalView = "long_bias" | "short_bias" | "watch" | "high_risk";
export type RadarFinalViewLabel = "롱 우위" | "숏 우위" | "관망 우위" | "고위험";
export type RadarStrengthLabel = "약함" | "보통" | "강함";

export interface RadarInsight {
  finalView: RadarFinalView;
  finalViewLabel: RadarFinalViewLabel;
  strength: number;
  strengthLabel: RadarStrengthLabel;
  summary: string;
  keyReasons: string[];
  longConditions: string[];
  shortConditions: string[];
  invalidationConditions: string[];
  risks: string[];
  nextAction: string;
  updatedAt: string;
  market: RadarInsightMarket;
  symbol: string;
  timeframe?: string;
}

const lockedActionText = "Pro에서 상세 판단 보조 항목으로 확인합니다.";

interface TechnicalInsightOptions {
  market: RadarInsightMarket;
  symbol: string;
  timeframe?: string;
  updatedAt?: string;
  sessionNote?: string;
  groupNote?: string;
}

const finalViewLabels: Record<RadarFinalView, RadarFinalViewLabel> = {
  long_bias: "롱 우위",
  short_bias: "숏 우위",
  watch: "관망 우위",
  high_risk: "고위험"
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function radarStrengthLabel(strength: number): RadarStrengthLabel {
  if (strength >= 70) return "강함";
  if (strength >= 45) return "보통";
  return "약함";
}

export function visibleRadarInsightForPlan(insight: RadarInsight, isPro: boolean): RadarInsight {
  if (isPro) return insight;

  return {
    ...insight,
    keyReasons: insight.keyReasons.slice(0, 1),
    longConditions: [],
    shortConditions: [],
    invalidationConditions: [],
    risks: insight.risks.slice(0, 1),
    nextAction: lockedActionText,
    updatedAt: ""
  };
}

function compact(values: Array<string | null | undefined>, fallback: string) {
  const normalized = values.map((value) => sanitizeDecisionCopy(value)).filter(Boolean);
  const unique = Array.from(new Set(normalized));
  return unique.length ? unique : [fallback];
}

function sanitizeDecisionCopy(value: string | null | undefined) {
  return (value ?? "")
    .replace(/매수/g, "상방")
    .replace(/매도/g, "하방")
    .replace(/진입하세요/g, "확인하세요")
    .replace(/진입/g, "판단")
    .replace(/목표가/g, "다음 기준")
    .trim();
}

function marketFinalView(analysis: MarketAnalysis) {
  const riskCount = analysis.riskFlags.length + analysis.warnings.length;
  if (riskCount >= 3 || (analysis.readiness === "low" && riskCount >= 1)) return "high_risk" as const;
  if (analysis.bias === "long") return "long_bias" as const;
  if (analysis.bias === "short") return "short_bias" as const;
  return "watch" as const;
}

function marketStrength(analysis: MarketAnalysis, finalView: RadarFinalView) {
  const decision = evaluateRadarDecision(analysis);
  if (finalView === "high_risk") {
    const riskCount = analysis.riskFlags.length + analysis.warnings.length;
    return clamp(50 + riskCount * 12 + (analysis.readiness === "low" ? 12 : 0));
  }
  return clamp(decision.score);
}

export function marketAnalysisToRadarInsight(analysis: MarketAnalysis): RadarInsight {
  const finalView = marketFinalView(analysis);
  const strength = marketStrength(analysis, finalView);
  const proPlan = analysis.proPlan;
  const longConditions = compact(
    [
      analysis.longScenario.summary,
      proPlan?.side === "long" ? proPlan.entryLabel : null,
      analysis.checkpoints.find((item) => /롱|상승|지지|discount|OTE/i.test(item))
    ],
    "롱 추적은 상위 구조와 지지 반응이 함께 유지되는지 확인하는 흐름입니다."
  );
  const shortConditions = compact(
    [
      analysis.shortScenario.summary,
      proPlan?.side === "short" ? proPlan.entryLabel : null,
      analysis.checkpoints.find((item) => /숏|하락|저항|premium|OTE/i.test(item))
    ],
    "숏 추적은 상위 구조와 저항 반응이 함께 유지되는지 확인하는 흐름입니다."
  );
  const invalidationConditions = compact(
    [
      proPlan ? `${proPlan.invalidation.toLocaleString("ko-KR")} 기준 이탈 시 기존 추적 조건 재확인` : null,
      ...analysis.longScenario.blockers.slice(0, 1),
      ...analysis.shortScenario.blockers.slice(0, 1)
    ],
    "무효화 기준은 상위 구조가 반대로 정렬되거나 핵심 지지·저항 반응이 사라지는지로 확인합니다."
  );
  const risks = compact(
    [...analysis.riskFlags, ...analysis.warnings, ...(proPlan?.cautions ?? [])],
    "뚜렷한 리스크 플래그는 적지만 손절 기준과 수량 확인은 필요합니다."
  );

  return {
    finalView,
    finalViewLabel: finalViewLabels[finalView],
    strength,
    strengthLabel: radarStrengthLabel(strength),
    summary: sanitizeDecisionCopy(analysis.summaryLine) || sanitizeDecisionCopy(analysis.verdict),
    keyReasons: compact(
      [analysis.opportunityFlags[0], analysis.currentLocationLabel, analysis.reasons[0]?.text],
      "아직 한쪽으로 충분히 모인 핵심 근거가 제한적입니다."
    ),
    longConditions,
    shortConditions,
    invalidationConditions,
    risks,
    nextAction: sanitizeDecisionCopy(analysis.actionGuide) || "다음 캔들에서 구조와 리스크를 다시 확인하세요.",
    updatedAt: analysis.updatedAt,
    market: "crypto",
    symbol: analysis.symbol,
    timeframe: analysis.activeTimeframe
  };
}

function technicalFinalView(report: TechnicalRadarReport) {
  const riskScore = report.fearGreed.score + Math.max(0, report.bearishCount - report.bullishCount) * 6;
  if (riskScore >= 82) return "high_risk" as const;
  if (report.bullishCount >= report.bearishCount + 3) return "long_bias" as const;
  if (report.bearishCount >= report.bullishCount + 3) return "short_bias" as const;
  return "watch" as const;
}

function technicalStrength(report: TechnicalRadarReport, finalView: RadarFinalView) {
  if (finalView === "high_risk") return clamp(report.fearGreed.score + Math.max(0, report.bearishCount - report.bullishCount) * 6);
  const total = Math.max(1, report.bullishCount + report.bearishCount + report.neutralCount);
  const directionalGap = Math.abs(report.bullishCount - report.bearishCount);
  return clamp(35 + (directionalGap / total) * 65);
}

export function technicalRadarReportToRadarInsight(report: TechnicalRadarReport, options: TechnicalInsightOptions): RadarInsight {
  const finalView = technicalFinalView(report);
  const strength = technicalStrength(report, finalView);
  const resistanceMemo =
    report.supportResistance.resistanceDistancePercent !== null
      ? `저항선까지 ${Math.abs(report.supportResistance.resistanceDistancePercent).toFixed(2)}% 거리 확인`
      : null;
  const supportMemo =
    report.supportResistance.supportDistancePercent !== null
      ? `지지선까지 ${Math.abs(report.supportResistance.supportDistancePercent).toFixed(2)}% 거리 확인`
      : null;
  const topBullish = [...report.trendIndicators, ...report.momentumIndicators, ...report.volumeIndicators].find((item) => item.tone === "bullish");
  const topBearish = [...report.trendIndicators, ...report.momentumIndicators, ...report.volumeIndicators].find((item) => item.tone === "bearish");

  return {
    finalView,
    finalViewLabel: finalViewLabels[finalView],
    strength,
    strengthLabel: radarStrengthLabel(strength),
    summary: sanitizeDecisionCopy(report.summary),
    keyReasons: compact(
      [report.trendLabel, report.momentumLabel, topBullish?.description ?? topBearish?.description, options.sessionNote],
      "기술지표 방향이 아직 한쪽으로 충분히 모이지 않았습니다."
    ),
    longConditions: compact(
      [topBullish?.description, supportMemo, options.groupNote],
      "롱 추적은 지수와 선택 자산이 같은 방향으로 회복되는지 확인하는 흐름입니다."
    ),
    shortConditions: compact(
      [topBearish?.description, resistanceMemo, options.groupNote],
      "숏 추적은 지수와 선택 자산의 하락 압력이 동시에 유지되는지 확인하는 흐름입니다."
    ),
    invalidationConditions: compact(
      [supportMemo, resistanceMemo, "지수, 섹터, 선택 자산의 방향이 서로 엇갈리면 기존 판단을 낮춰 봅니다."],
      "가까운 지지·저항 기준이 사라지면 기존 추적 조건을 다시 확인합니다."
    ),
    risks: compact(
      [report.fearGreed.description, report.candlestickPatterns[0]?.description, options.sessionNote],
      "지표 과열, 거래량 둔화, 장 초반 급변 가능성을 함께 확인해야 합니다."
    ),
    nextAction: "지수, 섹터, 선택 자산 순서로 같은 방향 근거가 유지되는지 확인하세요.",
    updatedAt: options.updatedAt ?? new Date().toISOString(),
    market: options.market,
    symbol: options.symbol,
    timeframe: options.timeframe
  };
}

// TODO: ScoutSetup, WatchlistPanel, RadarAlertCenter 공통화는 다음 적용 단계에서 별도 어댑터로 추가한다.
