// 기존 레이더 분석 결과를 판단, 조건, 리스크 중심의 공통 표시 모델로 감싼다.
import type { MarketAnalysis, TimeframeAnalysis, TradePlanCandidate } from "@/lib/marketAnalysis";
import { evaluateRadarDecision } from "@/lib/radarDecisionEngine";
import type { TechnicalRadarReport } from "@/lib/technicalRadar";

export type RadarInsightMarket = "crypto" | "global";
export type RadarFinalView = "long_bias" | "short_bias" | "watch" | "high_risk";
export type RadarFinalViewLabel = "상방 우위" | "하방 우위" | "관망 우위" | "고위험";
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
  long_bias: "상방 우위",
  short_bias: "하방 우위",
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

function basicSummary(finalView: RadarFinalView) {
  if (finalView === "long_bias") return "상방 시나리오가 상대적으로 우위입니다. 다만 추격보다 추가 확인이 필요한 구간입니다.";
  if (finalView === "short_bias") return "하방 시나리오가 상대적으로 우위입니다. 다만 추격보다 추가 확인이 필요한 구간입니다.";
  if (finalView === "high_risk") return "리스크 확대 구간입니다. 신규 판단보다 리스크 점검이 우선입니다.";
  return "관망 우위입니다. 상방/하방 근거가 혼재되어 방향 확정 전 확인이 필요한 구간입니다.";
}

function basicKeyReason(finalView: RadarFinalView) {
  if (finalView === "long_bias") return "상방 근거가 상대적으로 우세하지만 추가 확인이 필요합니다.";
  if (finalView === "short_bias") return "하방 근거가 상대적으로 우세하지만 추가 확인이 필요합니다.";
  if (finalView === "high_risk") return "리스크 조건이 누적되어 방어적 점검이 우선입니다.";
  return "상방/하방 근거가 혼재되어 방향 확정 전 확인이 필요합니다.";
}

function basicRisk(finalView: RadarFinalView) {
  if (finalView === "high_risk") return "신규 판단보다 리스크 점검이 우선입니다.";
  if (finalView === "watch") return "방향 확정 전 성급한 추적은 리스크가 커질 수 있습니다.";
  return "추격 시 리스크 기준이 불리해질 수 있어 추가 확인이 필요합니다.";
}

export function visibleRadarInsightForPlan(insight: RadarInsight, isPro: boolean): RadarInsight {
  if (isPro) return insight;

  return {
    ...insight,
    summary: basicSummary(insight.finalView),
    keyReasons: [basicKeyReason(insight.finalView)],
    longConditions: [],
    shortConditions: [],
    invalidationConditions: [],
    risks: [basicRisk(insight.finalView)],
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
    .replace(/롱/g, "상방")
    .replace(/숏/g, "하방")
    .replace(/매수/g, "상방")
    .replace(/매도/g, "하방")
    .replace(/진입하세요/g, "확인하세요")
    .replace(/진입하기/g, "판단하기")
    .replace(/진입보다/g, "신규 판단보다")
    .replace(/진입/g, "신규 판단")
    .replace(/목표가/g, "다음 기준")
    .replace(/들어가는/g, "따라붙는")
    .replace(/들어가면/g, "따라붙으면")
    .trim();
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => sanitizeDecisionCopy(value)).filter(Boolean)));
}

function activeAnalysis(analysis: MarketAnalysis) {
  return analysis.timeframeAnalyses.find((item) => item.timeframe === analysis.activeTimeframe);
}

function includesAny(value: string, patterns: string[]) {
  return patterns.some((pattern) => value.includes(pattern));
}

function hasMixedDirectionalEvidence(analysis: MarketAnalysis) {
  const bullish = analysis.reasons.filter((item) => item.tone === "bullish").length;
  const bearish = analysis.reasons.filter((item) => item.tone === "bearish").length;
  return bullish > 0 && bearish > 0 && Math.abs(bullish - bearish) <= 2;
}

function hasChaseRisk(analysis: MarketAnalysis) {
  return [...analysis.riskFlags, ...analysis.warnings].some((item) =>
    includesAny(item, ["추격", "프리미엄", "디스카운트", "POC 위", "POC 아래"])
  );
}

function marketWatchFactors(analysis: MarketAnalysis, active: TimeframeAnalysis | undefined) {
  const factors: string[] = [];
  if (analysis.bias === "neutral") factors.push("상방/하방 조건이 모두 미확정");
  if (analysis.readiness === "low") factors.push("데이터 신뢰도 낮음");
  if (hasMixedDirectionalEvidence(analysis)) factors.push("상방/하방 근거 혼재");
  if (hasChaseRisk(analysis)) factors.push("추격 리스크");
  if (active?.volumeProfile?.position === "near") factors.push("POC 균형");
  if (analysis.killzone === "off") factors.push("주요 킬존 밖");
  if (active?.condition.volatilityState === "expanded") factors.push("변동성 확대");
  if (active?.condition.regime === "range" || active?.condition.regime === "compression" || active?.dealingRange.position === "equilibrium") {
    factors.push("주요 지지/저항 사이 박스권");
  }
  if (analysis.bias !== "neutral" && !analysis.proPlan) factors.push("확인 조건 부족");
  return unique(factors);
}

function marketFinalView(analysis: MarketAnalysis) {
  const riskCount = analysis.riskFlags.length + analysis.warnings.length;
  const active = activeAnalysis(analysis);
  const decision = evaluateRadarDecision(analysis);
  const watchFactors = marketWatchFactors(analysis, active);
  if (riskCount >= 4 || (watchFactors.includes("변동성 확대") && riskCount >= 2)) return "high_risk" as const;
  if (decision.action === "avoid" && riskCount >= 2) return "high_risk" as const;
  if (analysis.bias === "neutral") return "watch" as const;
  if (watchFactors.length >= 3 && analysis.readiness !== "high") return "watch" as const;
  if (watchFactors.includes("추격 리스크") && (watchFactors.includes("POC 균형") || watchFactors.includes("주요 킬존 밖"))) return "watch" as const;
  if (analysis.bias === "long") return "long_bias" as const;
  if (analysis.bias === "short") return "short_bias" as const;
  return "watch" as const;
}

function marketStrength(analysis: MarketAnalysis, finalView: RadarFinalView) {
  const decision = evaluateRadarDecision(analysis);
  const riskCount = analysis.riskFlags.length + analysis.warnings.length;
  if (finalView === "high_risk") {
    return clamp(50 + riskCount * 12 + (analysis.readiness === "low" ? 12 : 0));
  }
  if (finalView === "watch") {
    return clamp(Math.min(78, 38 + marketWatchFactors(analysis, activeAnalysis(analysis)).length * 9 + (analysis.readiness === "low" ? 10 : 0)));
  }
  return clamp(decision.score - Math.max(0, riskCount - 1) * 6);
}

function directionCondition(active: TimeframeAnalysis | undefined, side: "long" | "short") {
  if (!active) return side === "long" ? "상방은 직전 고점 돌파와 유지 확인이 필요합니다." : "하방은 주요 지지선 이탈과 되돌림 실패 확인이 필요합니다.";
  const direction = side === "long" ? "bullish" : "bearish";
  if (active.inOb && active.latestOb?.direction === direction) {
    return side === "long" ? "상방은 상승 OB 반응이 유지될 때 강화됩니다." : "하방은 하락 OB 저항이 유지될 때 강화됩니다.";
  }
  if (active.inFvg && active.latestFvg?.direction === direction) {
    return side === "long" ? "상방은 FVG/iFVG 지지 반응이 유지될 때 강화됩니다." : "하방은 FVG/iFVG 저항 반응이 유지될 때 강화됩니다.";
  }
  if (active.oteZone === side) {
    return side === "long" ? "상방은 상방 OTE 구간의 지지 반응 이후 추적 조건이 생깁니다." : "하방은 하방 OTE 구간의 저항 반응 이후 추적 조건이 생깁니다.";
  }
  if (side === "long" && active.volumeProfile?.position === "above") return "상방은 POC 위 유지와 거래량 회복이 함께 필요합니다.";
  if (side === "short" && active.volumeProfile?.position === "below") return "하방은 POC 아래 유지와 되돌림 실패가 함께 필요합니다.";
  return side === "long" ? "상방은 직전 고점 돌파 후 눌림 유지가 필요합니다." : "하방은 주요 지지선 이탈 후 되돌림 실패가 필요합니다.";
}

function marketSummary(analysis: MarketAnalysis, finalView: RadarFinalView, active: TimeframeAnalysis | undefined) {
  const watchFactors = marketWatchFactors(analysis, active);

  if (finalView === "high_risk") {
    const reason = watchFactors[0] ?? "리스크 조건이 누적";
    return `리스크 확대 구간입니다. ${reason} 상태라 신규 판단보다 리스크 점검이 우선입니다.`;
  }

  if (finalView === "watch") {
    const reason = watchFactors[0] ?? "확인 조건이 아직 부족합니다.";
    return `관망 우위입니다. ${reason} 상태이므로 방향 확정보다 반응 확인이 우선입니다.`;
  }

  if (finalView === "long_bias") {
    return "상방 시나리오 강화입니다. 방향 근거가 상대적으로 우위지만 추격보다 추가 확인과 리스크 점검이 먼저입니다.";
  }

  return "하방 시나리오 강화입니다. 방향 근거가 상대적으로 우위지만 추격보다 추가 확인과 리스크 점검이 먼저입니다.";
}

function reasonCopy(value: string | null | undefined, active: TimeframeAnalysis | undefined) {
  const text = sanitizeDecisionCopy(value);
  if (!text) return null;
  if (text.includes("상위 시간대 구조 정렬")) return "상위 시간대 구조가 같은 방향으로 정렬되어 시나리오 근거가 강화됩니다.";
  if (text.includes("OB")) return "OB 반응 구간 안에서 가격이 유지되어 추적 조건을 확인할 수 있습니다.";
  if (text.includes("FVG") || text.includes("iFVG")) return "FVG/iFVG 반응이 남아 있어 돌파 이후 유지 여부가 핵심입니다.";
  if (text.includes("OTE")) return "OTE 구간에 닿아 있어 반응 확인 전까지 추격보다 조건 확인이 우선입니다.";
  if (text.includes("POC")) return active?.volumeProfile?.position === "near"
    ? "POC 부근에서 균형이 형성되어 방향 확정보다 반응 확인이 우선입니다."
    : "POC 기준 위치가 방향 판단의 보조 근거로 작동하고 있습니다.";
  if (text.includes("CISD")) return "CISD 신호는 있으나 이후 구조 유지가 확인되어야 신뢰도가 올라갑니다.";
  if (text.includes("Sweep") || text.includes("스윕")) return "스윕 이후 반응이 이어지는지 확인해야 추적 조건이 강화됩니다.";
  return text;
}

function riskCopy(value: string | null | undefined) {
  const text = sanitizeDecisionCopy(value);
  if (!text) return null;
  if (includesAny(text, ["프리미엄", "디스카운트", "추격"])) return "추격 시 손절 기준이 멀어질 수 있어 반응 확인이 필요합니다.";
  if (text.includes("POC")) return "POC 근처 균형 구간에서는 상하방 흔들림이 커질 수 있습니다.";
  if (text.includes("킬존")) return "주요 킬존 밖에서는 신호가 둔해질 수 있어 확인 조건을 더 엄격하게 봅니다.";
  if (text.includes("상위 시간대")) return "상위 시간대와 현재 시간대가 엇갈려 방향 확정 전 판단 리스크가 높습니다.";
  if (text.includes("CISD") || text.includes("스윕")) return "반대 방향 구조 신호가 가까워 기존 시나리오 강도를 낮춰 봅니다.";
  if (text.includes("변동성")) return "변동성이 커진 구간이므로 손절 기준과 포지션 크기 점검이 우선입니다.";
  return text;
}

function buildMarketKeyReasons(analysis: MarketAnalysis, finalView: RadarFinalView, active: TimeframeAnalysis | undefined) {
  if (finalView === "watch") {
    return compact(
      marketWatchFactors(analysis, active).map((factor) => {
        if (factor === "상방/하방 근거 혼재") return "상방/하방 근거가 혼재되어 방향 확정보다 조건 확인이 우선입니다.";
        if (factor === "POC 균형") return "POC 부근에서 균형이 형성되어 방향 확정보다 반응 확인이 우선입니다.";
        if (factor === "추격 리스크") return "가격 위치상 추격 리스크가 커져 관망 우위로 낮춰 봅니다.";
        if (factor === "변동성 확대") return "변동성이 확대되어 신규 판단보다 리스크 점검이 우선입니다.";
        if (factor === "주요 킬존 밖") return "주요 킬존 밖이라 구조 신호의 타이밍 신뢰도를 낮춰 봅니다.";
        return `${factor} 상태라 확인 전까지 관망 우위입니다.`;
      }),
      "확인 조건이 부족해 방향 확정보다 관망 우위입니다."
    );
  }

  if (finalView === "high_risk") {
    return compact(
      [...analysis.riskFlags, ...analysis.warnings].map(riskCopy),
      "리스크 조건이 누적되어 신규 판단보다 리스크 점검이 우선입니다."
    );
  }

  return compact(
    [analysis.opportunityFlags[0], analysis.opportunityFlags[1], analysis.currentLocationLabel, analysis.reasons[0]?.text].map((item) =>
      reasonCopy(item, active)
    ),
    "아직 한쪽으로 충분히 모인 핵심 근거가 제한적입니다."
  );
}

function conditionCopy(value: string | null | undefined, side: "long" | "short") {
  const text = sanitizeDecisionCopy(value);
  if (!text) return null;
  if (text.includes("OB")) return side === "long" ? "상승 OB 지지 반응이 유지되는지 확인하세요." : "하락 OB 저항 반응이 유지되는지 확인하세요.";
  if (text.includes("FVG") || text.includes("iFVG")) return side === "long" ? "FVG/iFVG 지지 반응 이후 상방 유지가 필요합니다." : "FVG/iFVG 저항 반응 이후 하방 유지가 필요합니다.";
  if (text.includes("OTE")) return side === "long" ? "상방 OTE 구간에서 지지 반응이 확인되어야 합니다." : "하방 OTE 구간에서 저항 반응이 확인되어야 합니다.";
  if (text.includes("프리미엄") || text.includes("디스카운트")) return side === "long" ? "상방은 디스카운트 또는 눌림 확인 이후 추적 조건이 좋아집니다." : "하방은 프리미엄 또는 되돌림 확인 이후 추적 조건이 좋아집니다.";
  return text;
}

function marketNextAction(analysis: MarketAnalysis, finalView: RadarFinalView, active: TimeframeAnalysis | undefined) {
  if (finalView === "high_risk") {
    return "리스크 확대 구간입니다. 신규 판단보다 손절 기준, 포지션 크기, 반대 구조 신호를 먼저 점검하세요.";
  }

  if (finalView === "watch") {
    return `관망 우위입니다. ${directionCondition(active, "long")} ${directionCondition(active, "short")}`;
  }

  if (finalView === "long_bias") {
    return "상방 시나리오는 고점 돌파 후 유지 또는 지지선 재확인 이후 강화됩니다. 무효화 조건과 리스크 점검을 먼저 확인하세요.";
  }

  return "하방 시나리오는 주요 지지선 이탈 또는 되돌림 실패 이후 강화됩니다. 무효화 조건과 리스크 점검을 먼저 확인하세요.";
}

function invalidationLine(proPlan: TradePlanCandidate | null) {
  if (!proPlan) return null;
  const level = proPlan.invalidation.toLocaleString("ko-KR");
  if (proPlan.side === "long") return `${level} 기준선 이탈 시 기존 상방 시나리오 강도를 낮추고 재평가합니다.`;
  if (proPlan.side === "short") return `${level} 기준선 회복 시 기존 하방 시나리오 강도를 낮추고 재평가합니다.`;
  return `${level} 기준선 반대편 안착 시 기존 시나리오 강도를 낮추고 재평가합니다.`;
}

export function marketAnalysisToRadarInsight(analysis: MarketAnalysis): RadarInsight {
  const finalView = marketFinalView(analysis);
  const strength = marketStrength(analysis, finalView);
  const proPlan = analysis.proPlan;
  const active = activeAnalysis(analysis);
  const longConditions = compact(
    [
      directionCondition(active, "long"),
      conditionCopy(analysis.longScenario.summary, "long"),
      proPlan?.side === "long" ? conditionCopy(proPlan.entryLabel, "long") : null,
      conditionCopy(analysis.checkpoints.find((item) => /롱|상승|지지|discount|OTE|OB|FVG/i.test(item)), "long")
    ],
    "상방 추적은 상위 구조와 지지 반응이 함께 유지되는지 확인하는 흐름입니다."
  );
  const shortConditions = compact(
    [
      directionCondition(active, "short"),
      conditionCopy(analysis.shortScenario.summary, "short"),
      proPlan?.side === "short" ? conditionCopy(proPlan.entryLabel, "short") : null,
      conditionCopy(analysis.checkpoints.find((item) => /숏|하락|저항|premium|OTE|OB|FVG/i.test(item)), "short")
    ],
    "하방 추적은 상위 구조와 저항 반응이 함께 유지되는지 확인하는 흐름입니다."
  );
  const invalidationConditions = compact(
    [
      invalidationLine(proPlan),
      ...analysis.longScenario.blockers.slice(0, 1).map(sanitizeDecisionCopy),
      ...analysis.shortScenario.blockers.slice(0, 1).map(sanitizeDecisionCopy),
      active?.latestCisd ? `${active.timeframe} 반대 CISD가 새로 확인되면 기존 시나리오를 재평가합니다.` : null
    ],
    "무효화 기준은 상위 구조가 반대로 정렬되거나 핵심 지지·저항 반응이 사라지는지로 확인합니다."
  );
  const risks = compact(
    [...analysis.riskFlags, ...analysis.warnings, ...(proPlan?.cautions ?? [])].map(riskCopy),
    "뚜렷한 리스크 플래그는 적지만 손절 기준과 수량 확인은 필요합니다."
  );

  return {
    finalView,
    finalViewLabel: finalViewLabels[finalView],
    strength,
    strengthLabel: radarStrengthLabel(strength),
    summary: marketSummary(analysis, finalView, active),
    keyReasons: buildMarketKeyReasons(analysis, finalView, active),
    longConditions,
    shortConditions,
    invalidationConditions,
    risks,
    nextAction: marketNextAction(analysis, finalView, active),
    updatedAt: analysis.updatedAt,
    market: "crypto",
    symbol: analysis.symbol,
    timeframe: analysis.activeTimeframe
  };
}

function technicalFinalView(report: TechnicalRadarReport) {
  const directionalGap = Math.abs(report.bullishCount - report.bearishCount);
  const riskScore = Math.max(report.fearGreed.score, 100 - report.fearGreed.score) + Math.max(0, report.bearishCount - report.bullishCount) * 4;
  if (riskScore >= 88 && directionalGap <= 3) return "high_risk" as const;
  if (directionalGap <= 2 || report.neutralCount >= report.bullishCount + report.bearishCount) return "watch" as const;
  if (report.bullishCount >= report.bearishCount + 3) return "long_bias" as const;
  if (report.bearishCount >= report.bullishCount + 3) return "short_bias" as const;
  return "watch" as const;
}

function technicalStrength(report: TechnicalRadarReport, finalView: RadarFinalView) {
  if (finalView === "high_risk") return clamp(Math.max(report.fearGreed.score, 100 - report.fearGreed.score) + report.neutralCount * 3);
  if (finalView === "watch") return clamp(42 + report.neutralCount * 4 + Math.min(12, Math.abs(report.fearGreed.score - 50) / 2));
  const total = Math.max(1, report.bullishCount + report.bearishCount + report.neutralCount);
  const directionalGap = Math.abs(report.bullishCount - report.bearishCount);
  return clamp(35 + (directionalGap / total) * 65);
}

function technicalReasonCopy(value: string | null | undefined) {
  const text = sanitizeDecisionCopy(value);
  if (!text) return null;
  if (text.includes("거래량")) return "거래량 변화가 방향 판단을 보조하지만, 추격 리스크도 함께 점검해야 합니다.";
  if (text.includes("과열")) return "과열 신호가 있어 방향 추적보다 리스크 점검이 우선입니다.";
  if (text.includes("중립") || text.includes("횡보")) return "지표가 중립권에 있어 지수 방향성과 섹터 분위기 확인이 먼저입니다.";
  if (text.includes("상승")) return "상방 지표가 우세하지만 지수선물과 섹터 확산이 함께 유지되어야 합니다.";
  if (text.includes("하락")) return "하방 지표가 우세해 리스크오프 흐름과 주요 지수선물 약세를 함께 확인해야 합니다.";
  return text;
}

function technicalSummary(report: TechnicalRadarReport, finalView: RadarFinalView) {
  if (finalView === "high_risk") {
    return `글로벌 레이더는 리스크 확대 구간입니다. ${sanitizeDecisionCopy(report.fearGreed.description)} 지수선물, 금리, 달러, VIX를 함께 점검하는 흐름입니다.`;
  }

  if (finalView === "watch") {
    return "글로벌 레이더는 관망 우위입니다. 지수 방향성, 섹터 분위기, 금리, 달러, VIX가 같은 방향으로 정리되는지 확인하기 전까지 추적 조건을 낮춰 봅니다.";
  }

  if (finalView === "long_bias") {
    return `글로벌 레이더는 상방 추적 조건이 우세합니다. ${sanitizeDecisionCopy(report.summary)} 지수선물과 섹터 확산이 유지되는지 확인하는 흐름입니다.`;
  }

  return `글로벌 레이더는 하방 리스크가 확대된 상태입니다. ${sanitizeDecisionCopy(report.summary)} 금리, 달러, VIX와 주요 지수선물 약세가 이어지는지 점검합니다.`;
}

function technicalNextAction(finalView: RadarFinalView) {
  if (finalView === "high_risk") return "리스크 확대 구간입니다. 지수선물, 금리, 달러, VIX를 먼저 확인하고 포지션 크기와 손절 기준을 보수적으로 점검하세요.";
  if (finalView === "watch") return "관망 우위입니다. 상방은 지수선물 돌파와 섹터 확산 이후, 하방은 주요 지수선물 이탈과 VIX 상승 이후 추적 조건을 확인하세요.";
  if (finalView === "long_bias") return "상방 추적은 지수선물 돌파 유지, 섹터 확산, 달러와 금리 부담 완화가 함께 확인될 때 강화됩니다.";
  return "하방 추적은 주요 지수선물 이탈, VIX 상승, 금리와 달러 부담 확대가 함께 확인될 때 강화됩니다.";
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
    summary: technicalSummary(report, finalView),
    keyReasons: compact(
      [report.trendLabel, report.momentumLabel, topBullish?.description ?? topBearish?.description, options.sessionNote].map(technicalReasonCopy),
      "지수 방향성과 섹터 분위기가 아직 한쪽으로 충분히 모이지 않았습니다."
    ),
    longConditions: compact(
      [
        "상방 추적은 지수선물 돌파 유지와 섹터 확산이 함께 필요합니다.",
        topBullish ? technicalReasonCopy(topBullish.description) : null,
        supportMemo,
        options.groupNote
      ],
      "상방 추적은 지수와 선택 자산이 같은 방향으로 회복되는지 확인하는 흐름입니다."
    ),
    shortConditions: compact(
      [
        "하방 추적은 주요 지수선물 이탈, VIX 상승, 리스크오프 흐름이 함께 필요합니다.",
        topBearish ? technicalReasonCopy(topBearish.description) : null,
        resistanceMemo,
        options.groupNote
      ],
      "하방 추적은 지수와 선택 자산의 약세 압력이 동시에 유지되는지 확인하는 흐름입니다."
    ),
    invalidationConditions: compact(
      [supportMemo, resistanceMemo, "지수, 섹터, 금리, 달러, VIX 방향이 서로 엇갈리면 기존 판단을 낮춰 봅니다."],
      "가까운 지지·저항 기준이 사라지면 기존 추적 조건을 다시 확인합니다."
    ),
    risks: compact(
      [report.fearGreed.description, report.candlestickPatterns[0]?.description, options.sessionNote].map(technicalReasonCopy),
      "지표 과열, 거래량 둔화, 장 초반 급변 가능성을 함께 점검해야 합니다."
    ),
    nextAction: technicalNextAction(finalView),
    updatedAt: options.updatedAt ?? new Date().toISOString(),
    market: options.market,
    symbol: options.symbol,
    timeframe: options.timeframe
  };
}

// TODO: ScoutSetup, WatchlistPanel, RadarAlertCenter 공통화는 다음 적용 단계에서 별도 어댑터로 추가한다.
