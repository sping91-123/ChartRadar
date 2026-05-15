// 구독 플랜과 시장별 Pro 권한 판단을 한곳에서 관리합니다.
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
    name: "Basic Radar",
    badge: "Basic",
    priceLabel: "무료",
    billingAmount: 0,
    monthlyValue: 0,
    description: "Chart Radar의 핵심 흐름을 먼저 확인하는 기본 플랜입니다. 개별 알트 분석, 반복 감시, 관심목록 확장, 알림 조건은 Pro에서 더 깊어집니다.",
    highlights: ["주요 화면 흐름 확인", "알트 개별 분석 하루 3개", "AI 브리핑 하루 1회"],
    limits: {
      radarScans: "코인 2회, 알트 3개, 글로벌 1회",
      aiBriefings: "시장별 1회",
      watchlist: "시장별 1개",
      alerts: "시장별 1개",
      markets: "코인과 글로벌 핵심 확인"
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
    description: "BTC, ETH, 알트코인, ICT 구조, 기술지표, 코인 뉴스와 알림을 집중적으로 보는 코인 전용 플랜입니다.",
    highlights: ["코인 레이더 하루 200회", "알트 개별 분석 사실상 무제한", "관심코인 50개와 알림 조건 20개"],
    limits: {
      radarScans: "코인 200회, 알트 300개",
      aiBriefings: "코인 30회",
      watchlist: "코인 50개",
      alerts: "코인 조건 20개",
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
    description: "코인 시장을 매일 보는 사용자에게 맞춘 연간 플랜입니다.",
    highlights: ["Coin Pro 전체 기능", "월 환산 12,417원", "신규 코인 레이더 기능 우선 적용"],
    limits: {
      radarScans: "코인 200회, 알트 300개",
      aiBriefings: "코인 40회",
      watchlist: "코인 100개",
      alerts: "코인 조건 30개",
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
    description: "미국주식, 해외선물, ETF, 주요 지수와 매크로 이벤트를 장전, 장중, 마감 기준으로 감시하는 글로벌 전용 플랜입니다.",
    highlights: ["글로벌 레이더 하루 100회", "AI 글로벌 브리핑 하루 30회", "해외선물과 관심자산 50개, 알림 조건 20개"],
    limits: {
      radarScans: "글로벌 100회",
      aiBriefings: "글로벌 30회",
      watchlist: "글로벌 50개",
      alerts: "글로벌 조건 20개",
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
    description: "글로벌 시장과 매크로 흐름을 꾸준히 확인하는 사용자에게 맞춘 연간 플랜입니다.",
    highlights: ["Global Pro 전체 기능", "월 환산 12,417원", "매크로와 섹터 레이더 우선 적용"],
    limits: {
      radarScans: "글로벌 100회",
      aiBriefings: "글로벌 40회",
      watchlist: "글로벌 100개",
      alerts: "글로벌 조건 30개",
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
    description: "코인과 글로벌 시장을 모두 보는 사용자를 위한 번들 플랜입니다. 두 시장을 따로 결제하는 것보다 저렴합니다.",
    highlights: ["코인과 글로벌 전체 레이더", "시장별 뉴스와 알림 분리", "두 시장을 함께 보는 사용자에게 최적"],
    limits: {
      radarScans: "코인 200회, 알트 300개, 글로벌 100회",
      aiBriefings: "총 60회",
      watchlist: "코인 100개, 글로벌 100개",
      alerts: "시장별 조건 30개",
      markets: "코인과 글로벌"
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
    description: "코인과 글로벌 시장을 장기적으로 함께 보는 사용자를 위한 연간 번들입니다.",
    highlights: ["All Market Pro 전체 기능", "월 환산 20,750원", "향후 확장 시장 기능 우선 적용"],
    limits: {
      radarScans: "코인 200회, 알트 300개, 글로벌 100회",
      aiBriefings: "총 80회",
      watchlist: "코인 150개, 글로벌 150개",
      alerts: "시장별 조건 40개",
      markets: "코인, 글로벌, 확장 시장"
    }
  }
];

export const paidBillingPlans = billingPlans.filter((plan) => plan.id !== "free");
export const paidBillingPlanIds = paidBillingPlans.map((plan) => plan.id);

export function findBillingPlan(planId: string | null | undefined) {
  return billingPlans.find((plan) => plan.id === planId) ?? null;
}

export function findBillingPlanByAppStoreProductId(productId: string | null | undefined) {
  if (!productId) return null;
  return paidBillingPlans.find((plan) => plan.appStoreProductId === productId) ?? null;
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

export function hasScopedEntitlement(planId: BillingEntitlementPlan, scope: BillingPageScope) {
  if (scope === "all") return hasAnyPaidEntitlement(planId);
  return hasMarketEntitlement(planId, scope);
}

export function getEntitlementLabel(planId: BillingEntitlementPlan) {
  if (!planId || planId === "free") return "Basic";
  if (planId === "admin") return "All Market Pro";
  if (planId === "premium" || planId === "member") return "Pro";
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
  "코인과 글로벌 시장은 따로 선택할 수 있고, 두 시장을 모두 보면 All Market Pro가 더 합리적입니다.",
  "웹과 앱에서 결제해도 같은 계정으로 Pro 기능을 이용할 수 있습니다.",
  "Chart Radar는 시장 구조와 위험 요소를 빠르게 정리해 오늘의 판단 순서를 잡아주는 레이더입니다."
];
