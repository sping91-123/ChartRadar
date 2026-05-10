// Chart Radar 구독 플랜과 출시용 결제 정책을 한곳에서 관리한다.
export type BillingPlanId = "free" | "pro_monthly" | "pro_yearly";

export interface BillingPlan {
  id: BillingPlanId;
  name: string;
  badge: string;
  priceLabel: string;
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
    monthlyValue: 0,
    description: "앱을 처음 켜는 사용자가 BTC, ETH와 일부 알트 흐름을 바로 확인하는 체험 플랜입니다.",
    highlights: ["BTC / ETH 기본 레이더", "알트 TOP 일부 확인", "뉴스 브리핑 미리보기"],
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
    monthlyValue: 19900,
    appStoreProductId: "chart_radar_pro_monthly",
    description: "매일 코인과 해외주식 레이더를 여러 번 확인하는 사용자를 위한 핵심 구독입니다.",
    highlights: ["코인 전체 레이더", "해외주식 레이더", "AI 브리핑 우선 처리", "관심종목과 알림 확장"],
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
    monthlyValue: 16584,
    appStoreProductId: "chart_radar_pro_yearly",
    description: "처음 베타부터 오래 쓸 사용자를 위한 연간 구독입니다. 월간 대비 약 두 달을 아끼는 구조입니다.",
    highlights: ["Pro 전체 기능", "연간 구독자 우선 피드백", "신규 시장 추가 베타 우선 적용"],
    limits: {
      radarScans: "공정 사용 범위 내 넉넉하게",
      aiBriefings: "일 40회",
      watchlist: "100개",
      alerts: "관심종목 변화 알림",
      markets: "코인 + 해외주식 + 확장 베타"
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

export const launchPaymentNotes = [
  "웹 결제는 토스페이먼츠 결제 링크나 결제위젯으로 연결합니다.",
  "iOS 앱 안에서 디지털 구독을 직접 판매할 때는 App Store 구독 상품으로 연결하는 것이 가장 안전합니다.",
  "5월 베타 출시에서는 기능을 과하게 잠그기보다 Pro의 편의성, AI 사용량, 알림, 저장 기능을 중심으로 차이를 만듭니다."
];
