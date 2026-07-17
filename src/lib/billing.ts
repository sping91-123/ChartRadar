// 구독 플랜과 시장별 Pro 권한을 한곳에서 관리한다.
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
  displayName: string;
  badge: string;
  priceLabel: string;
  billingAmount: number;
  monthlyValue: number;
  billingPeriodMonths: number;
  periodLabel: string;
  renewalText: string;
  storeProducts?: {
    android: { productId: string; basePlanId: string };
    ios: { productId: string };
    revenueCatPackageId: string;
  };
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
    displayName: "Basic Radar",
    badge: "무료",
    priceLabel: "무료",
    billingAmount: 0,
    monthlyValue: 0,
    billingPeriodMonths: 0,
    periodLabel: "무료",
    renewalText: "무료 플랜은 결제와 자동 갱신이 없습니다.",
    description: "Basic에서는 방향 요약만 제공합니다. 상세 조건, 무효화 기준, 세부 리스크는 Pro에서 확인할 수 있습니다.",
    highlights: ["방향 요약 확인", "일부 리스크 점검", "판단 보조용 기본 알림"],
    limits: {
      radarScans: "일부 제공",
      aiBriefings: "제한 제공",
      watchlist: "시장별 1개",
      alerts: "시장별 1개",
      markets: "코인과 글로벌 기본 확인"
    }
  },
  {
    id: "crypto_monthly",
    marketScope: "crypto",
    name: "Coin Pro",
    displayName: "Chart Radar Coin Pro 월간 구독",
    badge: "코인",
    priceLabel: "출시가 29,000원 / 월",
    billingAmount: 29000,
    monthlyValue: 29000,
    billingPeriodMonths: 1,
    periodLabel: "월간 구독",
    renewalText: "매월 자동 갱신됩니다. 해지는 Google Play 구독 관리에서 언제든 가능합니다.",
    storeProducts: {
      android: { productId: "chart_radar_crypto_monthly", basePlanId: "monthly" },
      ios: { productId: "chart_radar_crypto_monthly" },
      revenueCatPackageId: "crypto_monthly"
    },
    description: "BTC/ETH 판단, 알트 기회와 위험 필터, 코인 상세 조건과 무효화 기준을 함께 확인합니다.",
    highlights: ["BTC/ETH·알트 추적 조건과 리스크 확인", "코인 상세 판단", "무효화 기준과 세부 리스크"],
    limits: {
      radarScans: "코인 레이더 200회",
      aiBriefings: "코인 브리핑 30회",
      watchlist: "코인 50개",
      alerts: "코인 조건 20개",
      markets: "코인"
    }
  },
  {
    id: "crypto_yearly",
    marketScope: "crypto",
    name: "Coin Pro 연간",
    displayName: "Chart Radar Coin Pro 연간 구독",
    badge: "코인 연간",
    priceLabel: "출시가 290,000원 / 연",
    billingAmount: 290000,
    monthlyValue: 24167,
    billingPeriodMonths: 12,
    periodLabel: "연간 구독",
    renewalText: "매년 자동 갱신됩니다. 해지는 Google Play 구독 관리에서 언제든 가능합니다.",
    storeProducts: {
      android: { productId: "chart_radar_crypto_yearly", basePlanId: "year-1" },
      ios: { productId: "chart_radar_crypto_yearly" },
      revenueCatPackageId: "crypto_yearly"
    },
    description: "코인 시장을 꾸준히 추적하는 사용자를 위한 연간 플랜입니다. 월 10개월치 기준으로 2개월을 할인합니다.",
    highlights: ["Coin Pro 전체 기능", "월 환산 약 24,167원", "BTC/ETH·알트 리스크 반복 점검"],
    limits: {
      radarScans: "코인 레이더 200회",
      aiBriefings: "코인 브리핑 40회",
      watchlist: "코인 100개",
      alerts: "코인 조건 30개",
      markets: "코인"
    }
  },
  {
    id: "stocks_monthly",
    marketScope: "stocks",
    name: "Global Pro",
    displayName: "Global Pro 월간 구독",
    badge: "글로벌",
    priceLabel: "출시가 19,000원 / 월",
    billingAmount: 19000,
    monthlyValue: 19000,
    billingPeriodMonths: 1,
    periodLabel: "월간 구독",
    renewalText: "매월 자동 갱신됩니다. 해지는 Google Play 구독 관리에서 언제든 가능합니다.",
    storeProducts: {
      android: { productId: "chart_radar_global_monthly", basePlanId: "monthly" },
      ios: { productId: "chart_radar_global_monthly" },
      revenueCatPackageId: "stocks_monthly"
    },
    description: "미국장 30초 체크, 지수선물, 매크로 압력, 이벤트 리스크, 섹터 로테이션과 대장주 레이더를 정리합니다.",
    highlights: ["지수선물·매크로·섹터 리스크 확인", "미국장 상세 판단", "이벤트 리스크와 대장주 레이더"],
    limits: {
      radarScans: "글로벌 레이더 100회",
      aiBriefings: "글로벌 브리핑 30회",
      watchlist: "글로벌 자산 50개",
      alerts: "글로벌 조건 20개",
      markets: "글로벌 자산군"
    }
  },
  {
    id: "stocks_yearly",
    marketScope: "stocks",
    name: "Global Pro 연간",
    displayName: "Global Pro 연간 구독",
    badge: "글로벌 연간",
    priceLabel: "출시가 190,000원 / 연",
    billingAmount: 190000,
    monthlyValue: 15833,
    billingPeriodMonths: 12,
    periodLabel: "연간 구독",
    renewalText: "매년 자동 갱신됩니다. 해지는 Google Play 구독 관리에서 언제든 가능합니다.",
    storeProducts: {
      android: { productId: "chart_radar_global_yearly", basePlanId: "yearly-1" },
      ios: { productId: "chart_radar_global_yearly" },
      revenueCatPackageId: "stocks_yearly"
    },
    description: "미국장과 매크로 흐름을 꾸준히 점검하는 사용자를 위한 연간 플랜입니다. 출시가 기준으로 월간보다 낮은 월 환산가를 제공합니다.",
    highlights: ["Global Pro 전체 기능", "월 환산 약 15,833원", "미국장 30초 체크 반복 확인"],
    limits: {
      radarScans: "글로벌 레이더 100회",
      aiBriefings: "글로벌 브리핑 40회",
      watchlist: "글로벌 자산 100개",
      alerts: "글로벌 조건 30개",
      markets: "글로벌"
    }
  },
  {
    id: "bundle_monthly",
    marketScope: "bundle",
    name: "All Market Pro",
    displayName: "All Market Pro 월간 구독",
    badge: "전체 시장",
    priceLabel: "출시가 39,000원 / 월",
    billingAmount: 39000,
    monthlyValue: 39000,
    billingPeriodMonths: 1,
    periodLabel: "월간 구독",
    renewalText: "매월 자동 갱신됩니다. 해지는 Google Play 구독 관리에서 언제든 가능합니다.",
    storeProducts: {
      android: { productId: "chart_radar_bundle_monthly", basePlanId: "monthly" },
      ios: { productId: "chart_radar_bundle_monthly" },
      revenueCatPackageId: "bundle_monthly"
    },
    description: "Coin Pro와 Global Pro를 통합해 코인과 글로벌 전체 시장 판단을 한 번에 확인합니다.",
    highlights: ["코인과 미국장을 함께 보는 통합 플랜", "Coin Pro + Global Pro 통합", "두 시장을 함께 보는 사용자용"],
    limits: {
      radarScans: "코인 200회, 알트 300개, 글로벌 100회",
      aiBriefings: "총 60회",
      watchlist: "코인 100개, 글로벌 100개",
      alerts: "시장별 조건 30개",
      markets: "코인과 글로벌"
    }
  },
  // Legacy internal id: bundle_yearly now represents the user-facing All Market Pro 6-month subscription.
  {
    id: "bundle_yearly",
    marketScope: "bundle",
    name: "All Market Pro 6개월",
    displayName: "All Market Pro 6개월 구독",
    badge: "전체 시장 6개월",
    priceLabel: "출시가 199,000원 / 6개월",
    billingAmount: 199000,
    monthlyValue: 33167,
    billingPeriodMonths: 6,
    periodLabel: "6개월 구독",
    renewalText: "6개월마다 자동 갱신됩니다. 해지는 Google Play 구독 관리에서 언제든 가능합니다.",
    storeProducts: {
      android: { productId: "chart_radar_bundle_6month", basePlanId: "month-6" },
      ios: { productId: "chart_radar_bundle_6month" },
      revenueCatPackageId: "bundle_6month"
    },
    description: "코인과 글로벌 전체 시장 판단을 6개월 단위로 함께 쓰는 자동 갱신 통합 구독입니다.",
    highlights: ["All Market Pro 전체 기능", "월 환산 약 33,167원", "코인과 글로벌 전체 시장 판단"],
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

export interface NormalizedStoreProductId {
  originalProductId: string;
  subscriptionId: string;
  basePlanId: string | null;
}

export interface StoreEntitlementMarkets {
  crypto: boolean;
  stocks: boolean;
  bundle: boolean;
}

const appStoreProductIdToPlanId = new Map(
  paidBillingPlans.flatMap((plan) => plan.storeProducts
    ? [
        [plan.storeProducts.android.productId, plan.id] as const,
        [plan.storeProducts.ios.productId, plan.id] as const
      ]
    : [])
);

const billingPlanPriorityByScope: Record<BillingPageScope, BillingPlanId[]> = {
  all: ["bundle_yearly", "bundle_monthly", "crypto_yearly", "stocks_yearly", "crypto_monthly", "stocks_monthly"],
  crypto: ["bundle_yearly", "bundle_monthly", "crypto_yearly", "crypto_monthly"],
  stocks: ["bundle_yearly", "bundle_monthly", "stocks_yearly", "stocks_monthly"]
};

export function findBillingPlan(planId: string | null | undefined) {
  return billingPlans.find((plan) => plan.id === planId) ?? null;
}

export function findBillingPlanByAppStoreProductId(productId: string | null | undefined) {
  const planId = resolvePlanIdFromStoreProductId(productId);
  return planId ? findBillingPlan(planId) : null;
}

export function getBillingPlansByScope(scope: BillingMarketScope) {
  return billingPlans.filter((plan) => plan.marketScope === scope);
}

export function getMarketScopeForPlan(planId: BillingPlanId): BillingMarketScope {
  return findBillingPlan(planId)?.marketScope ?? "trial";
}

export function getBillingPeriodMonths(planId: BillingPlanId) {
  return findBillingPlan(planId)?.billingPeriodMonths ?? 1;
}

export function getStoreProductIdentifier(plan: BillingPlan, platform: "android" | "ios" = "android") {
  if (!plan.storeProducts) return null;
  if (platform === "ios") return plan.storeProducts.ios.productId;
  return `${plan.storeProducts.android.productId}:${plan.storeProducts.android.basePlanId}`;
}

export function normalizeStoreProductId(productId: string | null | undefined): NormalizedStoreProductId | null {
  const originalProductId = productId?.trim();
  if (!originalProductId) return null;

  const separatorIndex = originalProductId.indexOf(":");
  if (separatorIndex === -1) {
    return {
      originalProductId,
      subscriptionId: originalProductId,
      basePlanId: null
    };
  }

  const subscriptionId = originalProductId.slice(0, separatorIndex).trim();
  const basePlanId = originalProductId.slice(separatorIndex + 1).trim();
  if (!subscriptionId) return null;

  return {
    originalProductId,
    subscriptionId,
    basePlanId: basePlanId || null
  };
}

export function resolvePlanIdFromStoreProductId(productId: string | null | undefined): BillingPlanId | null {
  const normalizedProductId = normalizeStoreProductId(productId);
  if (!normalizedProductId) return null;

  const exactPlanId = appStoreProductIdToPlanId.get(normalizedProductId.originalProductId);
  if (exactPlanId) return exactPlanId;

  const subscriptionPlanId = appStoreProductIdToPlanId.get(normalizedProductId.subscriptionId);
  if (!subscriptionPlanId) return null;

  const plan = findBillingPlan(subscriptionPlanId);
  if (!normalizedProductId.basePlanId || !plan?.storeProducts) return subscriptionPlanId;
  return normalizedProductId.basePlanId === plan.storeProducts.android.basePlanId ? subscriptionPlanId : null;
}

export function resolveStoreEntitlementMarkets(activeEntitlements: Record<string, unknown> | null | undefined): StoreEntitlementMarkets {
  const entitlementIds = new Set(Object.keys(activeEntitlements ?? {}));
  const bundle = entitlementIds.has("all_market_pro") || entitlementIds.has("bundle_pro");

  return {
    crypto: bundle || entitlementIds.has("coin_pro") || entitlementIds.has("crypto_pro"),
    stocks: bundle || entitlementIds.has("global_pro"),
    bundle
  };
}

export function resolveEntitlementsFromStoreCustomer(customerInfo: {
  entitlements?: { active?: Record<string, unknown> };
} | null | undefined) {
  return resolveStoreEntitlementMarkets(customerInfo?.entitlements?.active);
}

export function hasStoreEntitlementForPlan(activeEntitlements: Record<string, unknown> | null | undefined, plan: BillingPlan) {
  const markets = resolveStoreEntitlementMarkets(activeEntitlements);
  if (plan.marketScope === "bundle") return markets.bundle;
  if (plan.marketScope === "crypto") return markets.crypto;
  if (plan.marketScope === "stocks") return markets.stocks;
  return false;
}

export function hasMarketEntitlementFromPlans(
  planIds: BillingEntitlementPlan[],
  scope: Exclude<BillingPageScope, "all">
) {
  return planIds.some((planId) => hasMarketEntitlement(planId, scope));
}

export function resolveCombinedBillingEntitlementPlan(
  planIds: BillingEntitlementPlan[],
  scope: BillingPageScope = "all"
): BillingEntitlementPlan {
  const normalizedPlanIds = planIds.filter((planId): planId is NonNullable<BillingEntitlementPlan> => Boolean(planId));
  if (normalizedPlanIds.includes("admin")) return "admin";

  const paidPlanIds = normalizedPlanIds.filter((planId): planId is BillingPlanId => {
    const plan = findBillingPlan(planId);
    return Boolean(plan && plan.id !== "free");
  });
  const priorityPlan = billingPlanPriorityByScope[scope].find((planId) => paidPlanIds.includes(planId));

  if (scope !== "all") {
    return priorityPlan ?? normalizedPlanIds.find((planId) => planId === "member" || planId === "premium") ?? null;
  }

  if (priorityPlan && getMarketScopeForPlan(priorityPlan) === "bundle") return priorityPlan;

  const hasCrypto = hasMarketEntitlementFromPlans(paidPlanIds, "crypto");
  const hasStocks = hasMarketEntitlementFromPlans(paidPlanIds, "stocks");
  if (hasCrypto && hasStocks) {
    return "bundle_monthly";
  }

  return priorityPlan ?? normalizedPlanIds.find((planId) => planId === "member" || planId === "premium") ?? null;
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
  return getBillingPeriodMonths(planId) === 12;
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
  "Coin Pro와 Global Pro는 각각 독립된 시장 판단 도구이고, All Market Pro는 두 시장을 함께 보는 통합 플랜입니다.",
  "웹과 앱에서 같은 계정으로 Pro 기능을 이어서 사용할 수 있도록 설계했습니다.",
  "Chart Radar는 투자 권유가 아니라 시장 구조, 뉴스, 매크로, 알림을 한 화면에서 정리하는 판단 보조 도구입니다."
];
