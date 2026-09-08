// 푸시 스캐너의 사용자 권한 판정 helper를 분리한다.
import { hasMarketEntitlement, type BillingEntitlementPlan } from "@/lib/billing";
import { resolveEffectiveEntitlement } from "@/lib/effectiveEntitlement";
import { radarAlertRules } from "@/lib/radarAlerts";
import type { SupabaseUser } from "@/lib/supabase";
import { asArray } from "@/lib/server/push/eligibility";
import type { PushAlertEvent, PushSubscriptionRow } from "@/lib/server/push/types";
import { supabaseAdminAuth, supabaseAdminRest } from "@/lib/server/supabaseAdmin";

export async function userPlan(
  subscriptions: Map<string, PushSubscriptionRow[]>,
  userId: string
): Promise<BillingEntitlementPlan | null> {
  // Use the same trusted role and deletion boundary as the interactive app.
  // Subscription rows alone omit administrators who have no paid subscription.
  const [user, deletionRequests] = await Promise.all([
    supabaseAdminAuth<SupabaseUser | null>(`admin/users/${encodeURIComponent(userId)}`, {
      allowNotFound: true,
      timeoutMs: 5000
    }),
    supabaseAdminRest<Array<{ user_id: string }>>(
      `account_deletion_requests?select=user_id&user_id=eq.${encodeURIComponent(userId)}&status=in.(pending,processing,failed)&limit=1`,
      { timeoutMs: 5000 }
    )
  ]);
  if (!user || user.id !== userId || deletionRequests.length > 0) return null;
  return resolveEffectiveEntitlement({
    isAuthenticated: true,
    isAdmin: user.app_metadata?.role === "admin",
    subscriptions: subscriptions.get(userId) ?? []
  }).plan;
}

export function ruleAllowed(event: PushAlertEvent, plan: BillingEntitlementPlan) {
  const ruleId = event.ruleId;
  const rules = asArray(radarAlertRules);
  const rule = rules.find((item) => item.id === ruleId);
  if (!rule) return false;
  if (rule.tier === "free") return true;
  if (rule.category === "stocks") return hasMarketEntitlement(plan, "stocks");
  if (rule.category === "crypto") return hasMarketEntitlement(plan, "crypto");
  return hasMarketEntitlement(plan, "crypto") || hasMarketEntitlement(plan, "stocks");
}
