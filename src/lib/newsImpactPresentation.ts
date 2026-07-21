import type { NewsImpactClassification } from "@/lib/newsImpact";

export function newsImpactClassificationLabel(classification: NewsImpactClassification) {
  if (classification === "pending") return "반응 확인 중";
  if (classification === "supports_existing_state") return "기존 판단 강화";
  if (classification === "conflicts_with_existing_state") return "기존 판단과 충돌";
  if (classification === "decision_state_changed") return "판단 상태 변화";
  if (classification === "risk_increase") return "리스크 증가";
  if (classification === "insufficient_data") return "데이터 부족";
  return "뚜렷한 반응 없음";
}

export function newsImpactTone(classification: NewsImpactClassification) {
  if (classification === "risk_increase" || classification === "conflicts_with_existing_state") return "risk" as const;
  if (classification === "supports_existing_state") return "long" as const;
  return "watch" as const;
}

export function formatNewsImpactTime(value: string | null) {
  if (!value) return "확인 완료";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "시각 확인 필요";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}
