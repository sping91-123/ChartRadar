import {
  getMarketScopeForPlan,
  resolveCombinedBillingEntitlementPlan,
  type BillingEntitlementPlan,
  type BillingPageScope,
  type BillingPlanId
} from "./billing";

export type EffectiveEntitlementState =
  | "anonymous"
  | "basic"
  | "active"
  | "unavailable"
  | "deletion_pending";

export interface EntitlementSubscriptionInput {
  status?: string | null;
  plan?: BillingEntitlementPlan;
  market_scope?: "trial" | "crypto" | "stocks" | "bundle" | null;
  current_period_end?: string | null;
  revoked_at?: string | null;
  provider?: string | null;
}

export interface EffectiveEntitlement {
  state: EffectiveEntitlementState;
  isAdmin: boolean;
  marketAccess: { crypto: boolean; stocks: boolean };
  marketExpiresAt: { crypto: string | null; stocks: string | null };
  displayPlan: string;
  plan: BillingEntitlementPlan;
}

const eligibleStatuses = new Set(["trialing", "active", "canceled"]);

function validEnd(value: string | null | undefined, nowMs: number) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > nowMs ? timestamp : null;
}

function scopeFromSubscription(subscription: EntitlementSubscriptionInput) {
  if (
    subscription.market_scope === "crypto" ||
    subscription.market_scope === "stocks" ||
    subscription.market_scope === "bundle"
  ) {
    return subscription.market_scope;
  }

  const plan = subscription.plan;
  if (plan === "member" || plan === "premium") return "bundle" as const;
  if (!plan || plan === "free" || plan === "admin") return null;
  return getMarketScopeForPlan(plan as BillingPlanId);
}

function latestIso(current: string | null, candidateTimestamp: number) {
  if (!current || Date.parse(current) < candidateTimestamp) return new Date(candidateTimestamp).toISOString();
  return current;
}

export function resolveEffectiveEntitlement(params: {
  isAuthenticated: boolean;
  isAdmin?: boolean;
  subscriptions?: EntitlementSubscriptionInput[];
  unavailable?: boolean;
  deletionPending?: boolean;
  now?: Date | number | string;
}): EffectiveEntitlement {
  const nowMs = params.now instanceof Date ? params.now.getTime() : new Date(params.now ?? Date.now()).getTime();
  const emptyAccess = { crypto: false, stocks: false };
  const emptyExpiry = { crypto: null, stocks: null };

  if (!params.isAuthenticated) {
    return {
      state: "anonymous",
      isAdmin: false,
      marketAccess: emptyAccess,
      marketExpiresAt: emptyExpiry,
      displayPlan: "Basic Radar",
      plan: "free"
    };
  }

  if (params.deletionPending) {
    return {
      state: "deletion_pending",
      isAdmin: Boolean(params.isAdmin),
      marketAccess: emptyAccess,
      marketExpiresAt: emptyExpiry,
      displayPlan: "계정 삭제 처리 대기",
      plan: "free"
    };
  }

  if (params.unavailable) {
    return {
      state: "unavailable",
      isAdmin: Boolean(params.isAdmin),
      marketAccess: emptyAccess,
      marketExpiresAt: emptyExpiry,
      displayPlan: "권한 확인 지연",
      plan: "free"
    };
  }

  if (params.isAdmin) {
    return {
      state: "active",
      isAdmin: true,
      marketAccess: { crypto: true, stocks: true },
      marketExpiresAt: emptyExpiry,
      displayPlan: "관리자",
      plan: "admin"
    };
  }

  const activePlans: BillingEntitlementPlan[] = [];
  const access = { crypto: false, stocks: false };
  const expiry: EffectiveEntitlement["marketExpiresAt"] = { crypto: null, stocks: null };
  let hasLegacyBeta = false;

  for (const subscription of params.subscriptions ?? []) {
    if (!eligibleStatuses.has(subscription.status ?? "") || subscription.revoked_at) continue;
    const periodEnd = validEnd(subscription.current_period_end, nowMs);
    const scope = scopeFromSubscription(subscription);
    if (!periodEnd || !scope) continue;

    activePlans.push(subscription.plan);
    hasLegacyBeta ||= subscription.provider === "legacy_beta";
    if (scope === "crypto" || scope === "bundle") {
      access.crypto = true;
      expiry.crypto = latestIso(expiry.crypto, periodEnd);
    }
    if (scope === "stocks" || scope === "bundle") {
      access.stocks = true;
      expiry.stocks = latestIso(expiry.stocks, periodEnd);
    }
  }

  if (!access.crypto && !access.stocks) {
    return {
      state: "basic",
      isAdmin: false,
      marketAccess: access,
      marketExpiresAt: expiry,
      displayPlan: "Basic Radar",
      plan: "free"
    };
  }

  const plan = resolveCombinedBillingEntitlementPlan(activePlans, "all") ??
    (access.crypto && access.stocks ? "premium" : access.crypto ? "crypto_monthly" : "stocks_monthly");
  const displayPlan = hasLegacyBeta
    ? "All Market Pro 베타 혜택"
    : access.crypto && access.stocks
      ? "All Market Pro"
      : access.crypto
        ? "Coin Pro"
        : "Global Pro";

  return {
    state: "active",
    isAdmin: false,
    marketAccess: access,
    marketExpiresAt: expiry,
    displayPlan,
    plan
  };
}

export function hasEffectiveScope(entitlement: EffectiveEntitlement, scope: BillingPageScope) {
  if (entitlement.state !== "active") return false;
  if (scope === "all") return entitlement.marketAccess.crypto || entitlement.marketAccess.stocks;
  return entitlement.marketAccess[scope];
}
