import { hasMarketEntitlement, type BillingEntitlementPlan } from "./billing";

/**
 * Coin Radar's single product contract. UI copy, usage meters, API limits,
 * and response serializers must read their Basic/Pro boundary from here.
 */
export interface CoinCapabilityPolicy {
  tier: "basic" | "coin_pro";
  preciseHigherTimeframeEvidence: boolean;
  detailedScoutEvidence: boolean;
  altAnalysisDailyLimit: number | null;
  cryptoAiDailyLimit: number;
  sharedMonitorLimit: number;
  altWatchlistLimit: number;
  homeInterestLimit: number;
  radarScanDailyLimit: number;
  watchlistScanDailyLimit: number;
  watchlistScanSymbolLimit: number;
  scoutResultLimits: Record<"all" | "major" | "alts", Record<"guard" | "radar", number>>;
}

const basicPolicy: CoinCapabilityPolicy = {
  tier: "basic",
  preciseHigherTimeframeEvidence: false,
  detailedScoutEvidence: false,
  altAnalysisDailyLimit: 3,
  cryptoAiDailyLimit: 1,
  sharedMonitorLimit: 1,
  altWatchlistLimit: 1,
  homeInterestLimit: 1,
  radarScanDailyLimit: 2,
  watchlistScanDailyLimit: 1,
  watchlistScanSymbolLimit: 1,
  scoutResultLimits: {
    all: { guard: 3, radar: 6 },
    major: { guard: 3, radar: 6 },
    alts: { guard: 3, radar: 3 }
  }
};

const coinProPolicy: CoinCapabilityPolicy = {
  tier: "coin_pro",
  preciseHigherTimeframeEvidence: true,
  detailedScoutEvidence: true,
  // null means that the product does not advertise a daily cap. API-level
  // abuse protection remains independent from this customer-facing quota.
  altAnalysisDailyLimit: null,
  cryptoAiDailyLimit: 24,
  sharedMonitorLimit: 20,
  altWatchlistLimit: 50,
  homeInterestLimit: 5,
  radarScanDailyLimit: 200,
  watchlistScanDailyLimit: 100,
  watchlistScanSymbolLimit: 50,
  scoutResultLimits: {
    all: { guard: 6, radar: 12 },
    major: { guard: 6, radar: 12 },
    alts: { guard: 3, radar: 5 }
  }
};

const legacyWatchlistLimits: Partial<Record<NonNullable<BillingEntitlementPlan>, number>> = {
  member: 1,
  crypto_yearly: 100,
  bundle_monthly: 100,
  bundle_yearly: 150,
  premium: 100,
  admin: 150
};

export function getCoinCapabilityPolicy(plan: BillingEntitlementPlan): CoinCapabilityPolicy {
  if (!hasMarketEntitlement(plan, "crypto")) return { ...basicPolicy };

  return {
    ...coinProPolicy,
    // Existing annual and bundle users keep their larger historical limits.
    altWatchlistLimit: legacyWatchlistLimits[plan ?? "free"] ?? coinProPolicy.altWatchlistLimit
  };
}

export function getCoinScoutResultLimit(
  policy: CoinCapabilityPolicy,
  scope: "all" | "major" | "alts",
  riskProfile: "guard" | "radar"
) {
  return policy.scoutResultLimits[scope][riskProfile];
}

export function cryptoAlertConditionLimit(plan: BillingEntitlementPlan) {
  return getCoinCapabilityPolicy(plan).sharedMonitorLimit;
}

export const basicCoinCapabilityPolicy = Object.freeze({ ...basicPolicy });
export const coinProCapabilityPolicy = Object.freeze({ ...coinProPolicy });
