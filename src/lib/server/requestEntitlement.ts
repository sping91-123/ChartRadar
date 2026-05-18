// API 요청의 로그인 사용자와 Pro 권한을 서버에서 판별합니다.
import {
  hasAnyPaidEntitlement,
  hasMarketEntitlementFromPlans,
  resolveCombinedBillingEntitlementPlan,
  type BillingEntitlementPlan,
  type BillingPageScope
} from "@/lib/billing";
import {
  fetchSupabaseActiveSubscriptions,
  fetchSupabaseProfile,
  fetchSupabaseUser,
  isSupabaseConfigured,
  type SupabaseProfile,
  type SupabaseSubscription,
  type SupabaseUser
} from "@/lib/supabase";

interface EntitlementCacheEntry {
  user: SupabaseUser;
  profile: SupabaseProfile | null;
  subscriptions: SupabaseSubscription[];
  expiresAt: number;
}

export interface RequestEntitlement {
  userId: string | null;
  plan: BillingEntitlementPlan;
  isPaid: boolean;
  isAuthenticated: boolean;
}

const entitlementCache = new Map<string, EntitlementCacheEntry>();
const entitlementCacheTtlMs = 2 * 60 * 1000;
const knownPlans = new Set<NonNullable<BillingEntitlementPlan>>([
  "free",
  "member",
  "premium",
  "admin",
  "crypto_monthly",
  "crypto_yearly",
  "stocks_monthly",
  "stocks_yearly",
  "bundle_monthly",
  "bundle_yearly"
]);

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

function normalizePlan(plan: unknown): BillingEntitlementPlan {
  return typeof plan === "string" && knownPlans.has(plan as NonNullable<BillingEntitlementPlan>)
    ? (plan as BillingEntitlementPlan)
    : null;
}

function planFromUser(user: SupabaseUser) {
  return normalizePlan(user.app_metadata?.plan) ?? (user.app_metadata?.role === "admin" ? "admin" : null);
}

function isLegacyAlwaysPaidPlan(plan: BillingEntitlementPlan) {
  return plan === "member" || plan === "premium";
}

async function loadEntitlementFromToken(token: string) {
  const now = Date.now();
  const cached = entitlementCache.get(token);
  if (cached && cached.expiresAt > now) return cached;

  const user = await fetchSupabaseUser(token);
  const [profile, subscriptions] = await Promise.all([
    fetchSupabaseProfile(token).catch(() => null),
    fetchSupabaseActiveSubscriptions(token, user.id).catch(() => [])
  ]);
  const entry = { user, profile, subscriptions, expiresAt: now + entitlementCacheTtlMs };
  entitlementCache.set(token, entry);
  return entry;
}

export async function getRequestEntitlement(request: Request, scope: BillingPageScope = "all"): Promise<RequestEntitlement> {
  const token = bearerToken(request);
  if (!token || !isSupabaseConfigured()) {
    return { userId: null, plan: "free", isPaid: false, isAuthenticated: false };
  }

  try {
    const { user, profile, subscriptions } = await loadEntitlementFromToken(token);
    const accountPlan = planFromUser(user) ?? normalizePlan(profile?.plan);
    const subscriptionPlans = subscriptions.map((subscription) => normalizePlan(subscription.plan)).filter(Boolean);
    const entitlementPlans = [...subscriptionPlans, accountPlan];
    const plan =
      accountPlan === "admin"
        ? "admin"
        : resolveCombinedBillingEntitlementPlan(entitlementPlans, scope) ?? (isLegacyAlwaysPaidPlan(accountPlan) ? accountPlan : "free");
    const isPaid = scope === "all" ? hasAnyPaidEntitlement(plan) : hasMarketEntitlementFromPlans(entitlementPlans, scope);

    return {
      userId: user.id,
      plan,
      isPaid,
      isAuthenticated: true
    };
  } catch {
    return { userId: null, plan: "free", isPaid: false, isAuthenticated: false };
  }
}

export function entitlementRateKey(baseKey: string, entitlement: RequestEntitlement) {
  return entitlement.userId ? `${baseKey}:user:${entitlement.userId}` : `${baseKey}:anon`;
}
