// Chart Radar 구독 플랜과 출시용 결제 정책을 한곳에서 관리합니다.
export type BillingMarketScope = "trial" | "crypto" | "stocks" | "bundle";
export type BillingPageScope = "all" | "crypto" | "stocks";

export type BillingPlanId =
  | "free"
  | "crypto_monthly"
  | "crypto_yearly"
  | "stocks_monthly"
  | "stocks_yearly"
  | "bundle_monthly"
  | "bundle_yearly";

export type LegacyAccountPlan = "member" | "premium" | "admin";
export type BillingEntitlementPlan = BillingPlanId | LegacyAccountPlan | null | undefined;

export interface BillingPlan {
  id: BillingPlanId;
  marketScope: BillingMarketScope;
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
    marketScope: "trial",
    name: "Free Radar",
    badge: "체험",
    priceLabel: "무료",
    billingAmount: 0,
    monthlyValue: 0,
    description: "Chart Radar의 핵심 화면과 분석 흐름을 먼저 확인하는 무료 체험 플랜입니다.",
    highlights: ["BTC / ETH 기본 레이더", "주요 알트코인 일부 감시", "AI 브리핑 미리보기"],
    limits: {
      radarScans: "일 10회",
      aiBriefings: "일 2회",
      watchlist: "5개",
      alerts: "화면 알림만",
      markets: "코인 중심"
    }
  },
  {
    id: "crypto_monthly",
    marketScope: "crypto",
    name: "Coin Pro",
    badge: "코인",
    priceLabel: "월 14,900원",
    billingAmount: 14900,
    monthlyValue: 14900,
    appStoreProductId: "chart_radar_crypto_monthly",
    description: "코인 전용 레이더, ICT 판독, 기술지표, 뉴스 브리핑과 알림을 여는 플랜입니다.",
    highlights: ["바이낸스 주요 코인 감시", "BTC / ETH와 알트코인 분리 레이더", "코인 뉴스와 매크로 영향 브리핑"],
    limits: {
      radarScans: "코인 범위 내 넉넉하게",
      aiBriefings: "일 30회",
      watchlist: "코인 50개",
      alerts: "코인 조건별 알림",
      markets: "코인"
    }
  },
  {
    id: "crypto_yearly",
    marketScope: "crypto",
    name: "Coin Pro 연간",
    badge: "코인 연간",
    priceLabel: "연 149,000원",
    billingAmount: 149000,
    monthlyValue: 12417,
    appStoreProductId: "chart_radar_crypto_yearly",
    description: "코인 레이더를 매일 쓰는 사용자에게 맞춘 연간 플랜입니다.",
    highlights: ["Coin Pro 전체 기능", "월 환산 12,417원", "신규 코인 레이더 기능 우선 적용"],
    limits: {
      radarScans: "코인 범위 내 넉넉하게",
      aiBriefings: "일 40회",
      watchlist: "코인 100개",
      alerts: "코인 조건별 알림",
      markets: "코인"
    }
  },
  {
    id: "stocks_monthly",
    marketScope: "stocks",
    name: "Global Pro",
    badge: "글로벌",
    priceLabel: "월 14,900원",
    billingAmount: 14900,
    monthlyValue: 14900,
    appStoreProductId: "chart_radar_global_monthly",
    description: "미국주식, ETF, 지수, 자산군 흐름과 매크로 이슈를 장전·장중·마감 기준으로 감시하는 글로벌 전용 플랜입니다.",
    highlights: ["미국 주요 종목, ETF, 자산군 ETF 감시", "미국장 시간대별 관심 지점 체크", "매크로, 실적, 섹터 뉴스 브리핑"],
    limits: {
      radarScans: "글로벌 범위 내 넉넉하게",
      aiBriefings: "일 30회",
      watchlist: "글로벌 종목 50개",
      alerts: "글로벌 조건별 알림",
      markets: "글로벌"
    }
  },
  {
    id: "stocks_yearly",
    marketScope: "stocks",
    name: "Global Pro 연간",
    badge: "글로벌 연간",
    priceLabel: "연 149,000원",
    billingAmount: 149000,
    monthlyValue: 12417,
    appStoreProductId: "chart_radar_global_yearly",
    description: "글로벌 레이더를 꾸준히 쓰는 사용자에게 맞춘 연간 플랜입니다.",
    highlights: ["Global Pro 전체 기능", "월 환산 12,417원", "매크로, 섹터, 미국장 시간대별 레이더 우선 적용"],
    limits: {
      radarScans: "글로벌 범위 내 넉넉하게",
      aiBriefings: "일 40회",
      watchlist: "글로벌 종목 100개",
      alerts: "글로벌 조건별 알림",
      markets: "글로벌"
    }
  },
  {
    id: "bundle_monthly",
    marketScope: "bundle",
    name: "All Market Pro",
    badge: "추천",
    priceLabel: "월 24,900원",
    billingAmount: 24900,
    monthlyValue: 24900,
    appStoreProductId: "chart_radar_bundle_monthly",
    description: "코인과 글로벌 시장을 모두 보는 사용자를 위한 번들 플랜입니다. 따로 결제하는 것보다 할인됩니다.",
    highlights: ["코인 + 글로벌 전체 레이더", "시장별 뉴스와 알림 분리", "두 시장을 오가며 쓰는 사용자에게 최적"],
    limits: {
      radarScans: "두 시장 모두 넉넉하게",
      aiBriefings: "일 60회",
      watchlist: "코인 100개 + 글로벌 100개",
      alerts: "시장별 조건 알림",
      markets: "코인 + 글로벌"
    }
  },
  {
    id: "bundle_yearly",
    marketScope: "bundle",
    name: "All Market Pro 연간",
    badge: "최대 할인",
    priceLabel: "연 249,000원",
    billingAmount: 249000,
    monthlyValue: 20750,
    appStoreProductId: "chart_radar_bundle_yearly",
    description: "코인과 글로벌 시장을 모두 장기적으로 쓰는 사용자를 위한 연간 번들입니다.",
    highlights: ["All Market Pro 전체 기능", "월 환산 20,750원", "향후 확장 시장 기능 우선 적용"],
    limits: {
      radarScans: "두 시장 모두 넉넉하게",
      aiBriefings: "일 80회",
      watchlist: "코인 150개 + 글로벌 150개",
      alerts: "시장별 조건 알림",
      markets: "코인 + 글로벌 + 확장 시장"
    }
  }
];

export const paidBillingPlans = billingPlans.filter((plan) => plan.id !== "free");
export const paidBillingPlanIds = paidBillingPlans.map((plan) => plan.id);

export function findBillingPlan(planId: string | null | undefined) {
  return billingPlans.find((plan) => plan.id === planId) ?? null;
}

export function getBillingPlansByScope(scope: BillingMarketScope) {
  return billingPlans.filter((plan) => plan.marketScope === scope);
}

export function getMarketScopeForPlan(planId: BillingPlanId): BillingMarketScope {
  return findBillingPlan(planId)?.marketScope ?? "trial";
}

export function getBillingPlansForPage(scope: BillingPageScope) {
  if (scope === "crypto") {
    return billingPlans.filter((plan) => plan.marketScope === "trial" || plan.marketScope === "crypto" || plan.marketScope === "bundle");
  }

  if (scope === "stocks") {
    return billingPlans.filter((plan) => plan.marketScope === "trial" || plan.marketScope === "stocks" || plan.marketScope === "bundle");
  }

  return billingPlans;
}

export function formatKrw(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

export function isPaidPlan(planId: string | null | undefined) {
  const plan = findBillingPlan(planId);
  return Boolean(plan && plan.id !== "free");
}

export function hasAnyPaidEntitlement(planId: BillingEntitlementPlan) {
  if (!planId || planId === "free") return false;
  if (planId === "member" || planId === "premium" || planId === "admin") return true;
  return isPaidPlan(planId);
}

export function hasMarketEntitlement(planId: BillingEntitlementPlan, scope: Exclude<BillingPageScope, "all">) {
  if (!hasAnyPaidEntitlement(planId)) return false;
  if (planId === "admin" || planId === "premium" || planId === "member") return true;

  const plan = findBillingPlan(planId);
  if (!plan) return false;
  if (plan.marketScope === "bundle") return true;
  return plan.marketScope === scope;
}

export function getEntitlementLabel(planId: BillingEntitlementPlan) {
  if (!planId || planId === "free") return "Free";
  if (planId === "admin") return "Admin";
  if (planId === "premium" || planId === "member") return "Legacy Pro";
  return findBillingPlan(planId)?.name ?? "Pro";
}

export function isYearlyBillingPlan(planId: BillingPlanId) {
  return planId.endsWith("_yearly");
}

export function parsePlanIdFromOrderId(orderId: string | null | undefined): BillingPlanId | null {
  if (!orderId?.startsWith("cr_")) return null;
  const body = orderId.slice(3);
  const matched = billingPlans
    .map((plan) => plan.id)
    .filter((planId) => body.startsWith(`${planId}_`))
    .sort((a, b) => b.length - a.length)[0];

  return matched ?? null;
}

export const subscriptionTrustNotes = [
  "코인과 글로벌 시장은 별도 상품으로 운영하고, 두 시장을 모두 쓰는 사용자는 All Market 플랜으로 할인받을 수 있습니다.",
  "앱스토어 출시 전에는 각 상품을 App Store 구독 상품 ID와 연결합니다.",
  "Chart Radar는 매수·매도 신호가 아니라 시장 구조와 위험 요소를 빠르게 정리하는 분석 도구입니다."
];
