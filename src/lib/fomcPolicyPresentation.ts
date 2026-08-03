import { isFomcPolicyDocumentLabel, type FomcPolicyAssessment } from "./fomcPolicyAssessment";

export function isFomcPolicyLabel(label: string) {
  return isFomcPolicyDocumentLabel(label);
}

export function fomcStanceTone(assessment: FomcPolicyAssessment): "risk" | "long" | "watch" | "info" {
  if (assessment.stance === "hawkish" || assessment.stance === "slightly_hawkish") return "risk";
  if (assessment.stance === "dovish" || assessment.stance === "slightly_dovish") return "long";
  if (assessment.stance === "mixed") return "watch";
  return "info";
}

export function fomcStanceTextClass(assessment: FomcPolicyAssessment) {
  const tone = fomcStanceTone(assessment);
  if (tone === "risk") return "text-ui-risk";
  if (tone === "long") return "text-ui-long";
  if (tone === "watch") return "text-ui-watch";
  return "text-ui-brand";
}

export function fomcConfidenceLabel(assessment: FomcPolicyAssessment) {
  if (assessment.confidence === "high") return "높음";
  if (assessment.confidence === "medium") return "중간";
  return "낮음";
}

export function fomcDecisionShortLabel(assessment: FomcPolicyAssessment) {
  if (assessment.decision === "hike") return "금리 인상";
  if (assessment.decision === "cut") return "금리 인하";
  return "금리 동결";
}

export function fomcRatePathShortLabel(assessment: FomcPolicyAssessment) {
  if (assessment.ratePathBias === "hike_risk") return "인상 위험";
  if (assessment.ratePathBias === "higher_for_longer") return "고금리 유지";
  if (assessment.ratePathBias === "easing") return "인하 무게";
  return "방향 균형";
}

export function fomcCompactFields(assessment: FomcPolicyAssessment) {
  return [
    ["결정", fomcDecisionShortLabel(assessment)],
    ["기조", assessment.stanceLabel],
    ["금리경로", fomcRatePathShortLabel(assessment)]
  ] as const;
}
