// 푸시 스캐너의 사용자 권한 판정 helper를 분리한다.
import { hasMarketEntitlement, type BillingEntitlementPlan } from "@/lib/billing";
import { resolveEffectiveEntitlement } from "@/lib/effectiveEntitlement";
import { radarAlertRules } from "@/lib/radarAlerts";
import { asArray } from "@/lib/server/push/eligibility";
import type { PushAlertEvent, PushSubscriptionRow } from "@/lib/server/push/types";

export function userPlan(
  subscriptions: Map<string, PushSubscriptionRow[]>,
  userId: string
): BillingEntitlementPlan {
  return resolveEffectiveEntitlement({
    isAuthenticated: true,
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
