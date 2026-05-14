// API 요청의 로그인 사용자와 Pro 권한을 서버에서 판별합니다.
import {
  hasAnyPaidEntitlement,
  hasMarketEntitlement,
  type BillingEntitlementPlan,
  type BillingPageScope
} from "@/lib/billing";
import { fetchSupabaseProfile, fetchSupabaseUser, isSupabaseConfigured, type SupabaseProfile, type SupabaseUser } from "@/lib/supabase";

interface EntitlementCacheEntry {
  user: SupabaseUser;
  profile: SupabaseProfile | null;
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

async function loadEntitlementFromToken(token: string) {
  const now = Date.now();
  const cached = entitlementCache.get(token);
  if (cached && cached.expiresAt > now) return cached;

  const [user, profile] = await Promise.all([fetchSupabaseUser(token), fetchSupabaseProfile(token).catch(() => null)]);
  const entry = { user, profile, expiresAt: now + entitlementCacheTtlMs };
  entitlementCache.set(token, entry);
  return entry;
}

export async function getRequestEntitlement(request: Request, scope: BillingPageScope = "all"): Promise<RequestEntitlement> {
  const token = bearerToken(request);
  if (!token || !isSupabaseConfigured()) {
    return { userId: null, plan: "free", isPaid: false, isAuthenticated: false };
  }

  try {
    const { user, profile } = await loadEntitlementFromToken(token);
    const plan = planFromUser(user) ?? normalizePlan(profile?.plan) ?? "free";
    const isPaid = scope === "all" ? hasAnyPaidEntitlement(plan) : hasMarketEntitlement(plan, scope);

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
