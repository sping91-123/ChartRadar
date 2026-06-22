// 푸시 스캐너의 사용자 권한 판정 helper를 분리한다.
import { hasMarketEntitlement, resolveCombinedBillingEntitlementPlan, type BillingEntitlementPlan } from "@/lib/billing";
import { radarAlertRules } from "@/lib/radarAlerts";
import { asArray } from "@/lib/server/push/eligibility";
import type { PushAlertEvent, PushProfileRow, PushSubscriptionRow } from "@/lib/server/push/types";

export function profilePlan(row: PushProfileRow | undefined): BillingEntitlementPlan {
  return row?.plan ?? row?.membership_tier ?? null;
}

export function subscriptionPlan(row: PushSubscriptionRow): BillingEntitlementPlan {
  return row.plan ?? row.tier ?? null;
}

export function userPlan(
  profiles: Map<string, PushProfileRow>,
  subscriptions: Map<string, PushSubscriptionRow[]>,
  userId: string
): BillingEntitlementPlan {
  const plans = [...(subscriptions.get(userId) ?? []).map(subscriptionPlan), profilePlan(profiles.get(userId))];
  return resolveCombinedBillingEntitlementPlan(plans, "all") ?? "free";
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
