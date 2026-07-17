import type { BillingEntitlementPlan, BillingPageScope } from "@/lib/billing";
import {
  hasEffectiveScope,
  resolveEffectiveEntitlement,
  type EffectiveEntitlement,
  type EffectiveEntitlementState
} from "@/lib/effectiveEntitlement";
import {
  fetchSupabaseAccountDeletionRequest,
  fetchSupabaseActiveSubscriptions,
  fetchSupabaseUser,
  isSupabaseConfigured
} from "@/lib/supabase";

export interface RequestEntitlement {
  userId: string | null;
  plan: BillingEntitlementPlan;
  isPaid: boolean;
  isAuthenticated: boolean;
  state: EffectiveEntitlementState;
  isAdmin: boolean;
  marketAccess: EffectiveEntitlement["marketAccess"];
  marketExpiresAt: EffectiveEntitlement["marketExpiresAt"];
  displayPlan: string;
}

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

function publicResult(userId: string | null, effective: EffectiveEntitlement, scope: BillingPageScope): RequestEntitlement {
  return {
    userId,
    plan: effective.plan,
    isPaid: hasEffectiveScope(effective, scope),
    isAuthenticated: effective.state !== "anonymous",
    state: effective.state,
    isAdmin: effective.isAdmin,
    marketAccess: effective.marketAccess,
    marketExpiresAt: effective.marketExpiresAt,
    displayPlan: effective.displayPlan
  };
}

export async function getRequestEntitlement(
  request: Request,
  scope: BillingPageScope = "all"
): Promise<RequestEntitlement> {
  const token = bearerToken(request);
  if (!token || !isSupabaseConfigured()) {
    return publicResult(null, resolveEffectiveEntitlement({ isAuthenticated: false }), scope);
  }

  let user;
  try {
    user = await fetchSupabaseUser(token);
  } catch {
    return publicResult(null, resolveEffectiveEntitlement({ isAuthenticated: false }), scope);
  }

  const isAdmin = user.app_metadata?.role === "admin";
  try {
    const [subscriptions, deletionRequest] = await Promise.all([
      fetchSupabaseActiveSubscriptions(token, user.id),
      fetchSupabaseAccountDeletionRequest(token, user.id)
    ]);
    const effective = resolveEffectiveEntitlement({
      isAuthenticated: true,
      isAdmin,
      subscriptions,
      deletionPending: Boolean(deletionRequest)
    });
    return publicResult(user.id, effective, scope);
  } catch {
    return publicResult(
      user.id,
      resolveEffectiveEntitlement({ isAuthenticated: true, isAdmin, unavailable: true }),
      scope
    );
  }
}

export function entitlementRateKey(baseKey: string, entitlement: RequestEntitlement) {
  return entitlement.userId ? `${baseKey}:user:${entitlement.userId}` : `${baseKey}:anon`;
}
