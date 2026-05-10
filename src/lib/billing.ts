// Chart Radar 구독 플랜과 출시용 결제 정책을 한곳에서 관리한다.
export type BillingPlanId = "free" | "pro_monthly" | "pro_yearly";

export interface BillingPlan {
  id: BillingPlanId;
  name: string;
  badge: string;
  priceLabel: string;
  billingAmount: number;
  monthlyValue: number;
  appStoreProductId?: string;
  description: string;
  highlights: string[];
  limits: {
    radarScans: string;
    aiBriefings: string;
    watchlist: string;
    alerts: string;
    markets: string;
  };
}

export const billingPlans: BillingPlan[] = [
  {
    id: "free",
    name: "Free Radar",
    badge: "체험",
    priceLabel: "무료",
    billingAmount: 0,
    monthlyValue: 0,
    description: "Chart Radar의 핵심 흐름을 먼저 확인하는 무료 체험 플랜입니다.",
    highlights: ["BTC / ETH 기본 레이더", "알트 일부 감지", "뉴스 브리핑 미리보기"],
    limits: {
      radarScans: "일 10회",
      aiBriefings: "일 2회",
      watchlist: "5개",
      alerts: "앱 내 알림만",
      markets: "코인 중심"
    }
  },
  {
    id: "pro_monthly",
    name: "Chart Radar Pro",
    badge: "추천",
    priceLabel: "월 19,900원",
    billingAmount: 19900,
    monthlyValue: 19900,
    appStoreProductId: "chart_radar_pro_monthly",
    description: "하루에도 여러 번 시장을 확인하는 사용자를 위한 핵심 구독입니다.",
    highlights: ["코인 전체 레이더", "해외주식 레이더", "AI 브리핑 넉넉하게", "관심종목과 알림 확장"],
    limits: {
      radarScans: "공정 사용 범위 내 넉넉하게",
      aiBriefings: "일 30회",
      watchlist: "50개",
      alerts: "관심종목 변화 알림",
      markets: "코인 + 해외주식"
    }
  },
  {
    id: "pro_yearly",
    name: "Chart Radar Pro Yearly",
    badge: "절약",
    priceLabel: "연 199,000원",
    billingAmount: 199000,
    monthlyValue: 16584,
    appStoreProductId: "chart_radar_pro_yearly",
    description: "매일 쓰겠다고 판단한 사용자를 위한 연간 구독입니다. 월간 대비 약 두 달을 아끼는 구조입니다.",
    highlights: ["Pro 전체 기능", "연간 구독자 우선 피드백", "신규 시장 추가 기능 우선 적용"],
    limits: {
      radarScans: "공정 사용 범위 내 넉넉하게",
      aiBriefings: "일 40회",
      watchlist: "100개",
      alerts: "관심종목 변화 알림",
      markets: "코인 + 해외주식 + 확장 시장"
    }
  }
];

export const paidBillingPlans = billingPlans.filter((plan) => plan.id !== "free");

export function findBillingPlan(planId: string | null | undefined) {
  return billingPlans.find((plan) => plan.id === planId) ?? null;
}

export function formatKrw(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

export function isPaidPlan(planId: string | null | undefined) {
  const plan = findBillingPlan(planId);
  return Boolean(plan && plan.id !== "free");
}

export const subscriptionTrustNotes = [
  "구독은 언제든 해지할 수 있고, 다음 결제일부터 갱신이 중단됩니다.",
  "웹 결제와 앱스토어 결제는 각각의 결제 정책에 따라 처리됩니다.",
  "Chart Radar는 매수·매도 신호가 아니라 시장 구조와 위험 요소를 빠르게 정리하는 분석 도구입니다."
];
