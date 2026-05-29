import type { BeginnerGuideStep, BeginnerGuideTone } from "@/components/BeginnerActionGuide";
import type { RadarInsightSummaryMetric } from "@/components/RadarInsightPanel";
import { conditionLabel, formatIndicatorValue, stateLabel } from "@/components/crypto/displayHelpers";
import type { MarketAnalysis, TimeframeAnalysis } from "@/lib/marketAnalysis";
import type { RadarDecision } from "@/lib/radarDecisionEngine";
import type { RadarInsight } from "@/lib/radarInsight";

function beginnerToneFromDecision(decision: RadarDecision | null): BeginnerGuideTone {
  if (!decision) return "neutral";
  if (decision.action === "enter") return "success";
  if (decision.action === "avoid") return "danger";
  return "warning";
}

export function buildCoinBeginnerSteps(analysis: MarketAnalysis, decision: RadarDecision | null): BeginnerGuideStep[] {
  const firstBlocker = decision?.blockers[0] ?? analysis.riskFlags[0] ?? analysis.warnings[0];
  const firstConfirmation = decision?.confirmations[0] ?? analysis.opportunityFlags[0] ?? analysis.currentLocationLabel;
  const actionTitle =
    decision?.action === "enter"
      ? "손절과 수량 고정"
      : decision?.action === "avoid"
        ? "새 구조 대기"
        : "반응 확인";
  const blockerBody =
    firstBlocker ??
    firstConfirmation ??
    "방향, 현재 위치, 거래량이 같은 쪽으로 맞는지 한 번 더 확인하세요.";

  return [
    {
      label: "1. 지금 판단",
      title: decision?.title ?? analysis.verdict,
      body: decision?.summary ?? analysis.summaryLine,
      tone: beginnerToneFromDecision(decision)
    },
    {
      label: "2. 먼저 할 일",
      title: actionTitle,
      body: decision?.nextStep ?? analysis.actionGuide,
      tone: decision?.action === "avoid" ? "danger" : "info"
    },
    {
      label: "3. 막히는 조건",
      title: firstBlocker ? "이 조건이면 보수적으로" : "근거가 유지되는지 확인",
      body: blockerBody,
      tone: firstBlocker ? "warning" : "neutral"
    }
  ];
}

export function buildCoinBasicBeginnerSteps(analysis: MarketAnalysis): BeginnerGuideStep[] {
  return [
    {
      label: "1. 최종 판단",
      title: analysis.verdict,
      body: "Basic에서는 방향 요약만 제공합니다. 상세 조건, 무효화 기준, 세부 리스크는 Pro에서 확인할 수 있습니다.",
      tone: "info"
    },
    {
      label: "2. 리스크 확인",
      title: analysis.riskFlags[0] ?? "리스크 먼저 확인",
      body: "이 정보는 투자 권유가 아니라 판단 보조용입니다. 세부 리스크는 Pro에서 전체 맥락으로 확인합니다.",
      tone: analysis.riskFlags.length > 0 ? "warning" : "neutral"
    },
    {
      label: "3. 다음 기준",
      title: "추적 조건은 잠금",
      body: "실제 판단에 필요한 추적 조건, 무효화 기준, 다음 확인 기준은 Pro 판단 보조 영역에서 확인합니다.",
      tone: "neutral"
    }
  ];
}

export function buildMajorScreenGuideSteps(isPro: boolean): BeginnerGuideStep[] {
  return [
    {
      label: "1. 상단 판단",
      title: "Radar Insight를 먼저 봅니다",
      body: isPro
        ? "최종 판단, 판단 강도, 추적 조건, 무효화 기준은 상단 판단 카드에서 먼저 확인합니다."
        : "Basic에서는 방향 요약만 제공합니다. 공개된 핵심 근거와 일반 리스크만 먼저 확인합니다.",
      tone: "info"
    },
    {
      label: "2. 근거 상세",
      title: "아래 영역은 보조 근거입니다",
      body: "ICT 구조, 기술지표, 차트 표시는 상단 판단을 뒷받침하는 확인 자료로만 봅니다.",
      tone: "neutral"
    },
    {
      label: "3. 실행 전 점검",
      title: isPro ? "리스크 기준을 다시 점검" : "세부 조건은 Pro 영역",
      body: isPro
        ? "구체 판단은 추적 조건, 무효화 기준, 리스크 점검을 모두 맞춘 뒤 검토합니다."
        : "추적 조건, 무효화 기준, 구체 레벨, 다음 확인 기준은 Pro에서 판단 보조 항목으로 확인합니다.",
      tone: isPro ? "warning" : "neutral"
    }
  ];
}

function compactSummaryText(value: string | undefined, maxLength = 46) {
  if (!value) return "확인 필요";
  return value.length > maxLength ? `${value.slice(0, maxLength).trim()}…` : value;
}

export function buildMajorSummaryMetrics(
  analysis: MarketAnalysis,
  activeAnalysis: TimeframeAnalysis | undefined,
  insight: RadarInsight
): RadarInsightSummaryMetric[] {
  const volatilityExpanded = activeAnalysis?.condition.volatilityState === "expanded";
  return [
    {
      label: "구조",
      value: activeAnalysis ? `MSB ${stateLabel(activeAnalysis.msb)} · CHoCH ${stateLabel(activeAnalysis.choch)}` : "구조 확인 중",
      detail: "현재 타임프레임 구조",
      tone: insight.finalView === "long_bias" ? "long" : insight.finalView === "short_bias" ? "short" : "watch"
    },
    {
      label: "변동성",
      value: activeAnalysis
        ? `${formatIndicatorValue(activeAnalysis.condition.atrPercent, 2, "%")} · ${conditionLabel(activeAnalysis.condition.volatilityState)}`
        : "변동성 확인 중",
      detail: "ATR 기준 압력",
      tone: volatilityExpanded ? "risk" : "info"
    },
    {
      label: "리스크",
      value: compactSummaryText(insight.risks[0] ?? analysis.riskFlags[0] ?? analysis.warnings[0]),
      detail: "추격 전 확인",
      tone: insight.finalView === "high_risk" ? "risk" : insight.finalView === "watch" ? "watch" : "info"
    }
  ];
}
