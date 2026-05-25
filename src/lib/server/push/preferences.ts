// 푸시 토큰별 시장과 규칙 선호 필터를 분리한다.
import type { PushAlertEvent, PushTokenRow } from "@/lib/server/push/types";

type PushTokenPreferenceSkipReason = "market" | "rule" | "market_and_rule";

function tokenPreferenceSkipReason(marketOk: boolean, ruleOk: boolean): PushTokenPreferenceSkipReason | null {
  if (!marketOk && !ruleOk) return "market_and_rule";
  if (!marketOk) return "market";
  if (!ruleOk) return "rule";
  return null;
}

export function tokenPreferenceDecision(token: PushTokenRow, event: PushAlertEvent) {
  const markets = token.markets ?? [];
  const ruleIds = token.rule_ids ?? [];
  const marketOk = markets.length === 0 || markets.includes(event.market);
  const shouldBypassRulePreference = event.system === true && event.isWatchlist !== true;
  const ruleOk = shouldBypassRulePreference || ruleIds.length === 0 || ruleIds.includes(event.ruleId);
  return {
    allowed: marketOk && ruleOk,
    marketOk,
    ruleOk,
    skippedBy: tokenPreferenceSkipReason(marketOk, ruleOk)
  };
}

export function tokenWants(token: PushTokenRow, event: PushAlertEvent) {
  return tokenPreferenceDecision(token, event).allowed;
}
