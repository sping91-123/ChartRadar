// 시장 분석 결과를 방향, 관망, 리스크 판단으로 압축하는 레이더 판단 엔진.
import type { BiasSide, MarketAnalysis } from "@/lib/marketAnalysis";

export type RadarDecisionAction = "enter" | "watch" | "avoid";
export type RadarDecisionConfidence = "high" | "medium" | "low";
export type RadarDecisionTone = "bullish" | "bearish" | "neutral" | "warning" | "danger";

export interface RadarDecision {
  action: RadarDecisionAction;
  side: BiasSide;
  score: number;
  confidence: RadarDecisionConfidence;
  tone: RadarDecisionTone;
  title: string;
  summary: string;
  nextStep: string;
  blockers: string[];
  confirmations: string[];
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function sideLabel(side: BiasSide) {
  if (side === "long") return "롱";
  if (side === "short") return "숏";
  return "중립";
}

function confidenceFromScore(score: number): RadarDecisionConfidence {
  if (score >= 75) return "high";
  if (score >= 55) return "medium";
  return "low";
}

export function evaluateRadarDecision(analysis: MarketAnalysis): RadarDecision {
  const directionalScore = analysis.bias === "neutral" ? 0 : Math.min(32, Math.abs(analysis.biasScore) * 4);
  const readinessScore = analysis.readiness === "high" ? 28 : analysis.readiness === "medium" ? 16 : 4;
  const planScore = analysis.proPlan ? Math.min(18, Math.max(0, analysis.proPlan.confidence - 55) * 0.55) : 0;
  const opportunityScore = Math.min(12, analysis.opportunityFlags.length * 3);
  const riskPenalty = Math.min(34, analysis.riskFlags.length * 7 + analysis.warnings.length * 5);
  const neutralPenalty = analysis.bias === "neutral" ? 22 : 0;
  const score = Math.round(clamp(20 + directionalScore + readinessScore + planScore + opportunityScore - riskPenalty - neutralPenalty));

  const blockers = unique([
    ...(analysis.bias === "neutral" ? ["방향성이 아직 중립입니다."] : []),
    ...(analysis.readiness === "low" ? ["데이터 신뢰도가 낮습니다."] : []),
    ...analysis.riskFlags,
    ...analysis.warnings
  ]).slice(0, 4);
  const confirmations = unique([
    ...analysis.opportunityFlags,
    ...(analysis.proPlan ? [analysis.proPlan.reason] : []),
    analysis.currentLocationLabel
  ]).slice(0, 4);

  const action: RadarDecisionAction =
    score >= 72 && analysis.bias !== "neutral" && analysis.readiness !== "low" && blockers.length <= 1
      ? "enter"
      : score <= 42 || blockers.length >= 3
        ? "avoid"
        : "watch";
  const tone: RadarDecisionTone =
    action === "avoid" ? "danger" : action === "watch" ? "warning" : analysis.bias === "long" ? "bullish" : "bearish";
  const confidence = confidenceFromScore(score);

  if (action === "enter") {
    return {
      action,
      side: analysis.bias,
      score,
      confidence,
      tone,
      title: `${sideLabel(analysis.bias)} 시나리오 강화`,
      summary: `${sideLabel(analysis.bias)} 방향 근거가 우세하지만 무효화 조건 확인이 먼저입니다.`,
      nextStep: "손절 기준, 포지션 크기, 1차 확인 구간을 먼저 점검하세요.",
      blockers,
      confirmations
    };
  }

  if (action === "avoid") {
    return {
      action,
      side: analysis.bias,
      score,
      confidence,
      tone,
      title: "고위험 구간",
      summary: blockers[0] ?? "방향성과 리스크 조건이 서로 맞지 않아 리스크 점검이 우선입니다.",
      nextStep: "새 캔들 확정 뒤 구조가 다시 정렬되는지 확인하세요.",
      blockers,
      confirmations
    };
  }

  return {
    action,
    side: analysis.bias,
    score,
    confidence,
    tone,
    title: analysis.bias === "neutral" ? "관망 우위" : `${sideLabel(analysis.bias)} 추적 대기`,
    summary: confirmations[0] ?? "일부 근거는 있지만 방향 확정 전까지 확인 조건이 부족합니다.",
    nextStep: analysis.checkpoints[0] ?? analysis.actionGuide,
    blockers,
    confirmations
  };
}
