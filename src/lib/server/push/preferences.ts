// 푸시 토큰별 시장과 규칙 선호 필터를 분리한다.
import type { PushAlertEvent, PushTokenRow } from "@/lib/server/push/types";

type PushTokenPreferenceSkipReason = "market" | "rule" | "market_and_rule";

const globalMarketAliases = new Set(["stocks", "global"]);

export function marketMatchesPreference(preferredMarket: string, eventMarket: PushAlertEvent["market"]) {
  const preferred = preferredMarket.trim();
  if (!preferred) return false;
  if (preferred === eventMarket) return true;
  return globalMarketAliases.has(preferred) && globalMarketAliases.has(eventMarket);
}

function tokenPreferenceSkipReason(marketOk: boolean, ruleOk: boolean): PushTokenPreferenceSkipReason | null {
  if (!marketOk && !ruleOk) return "market_and_rule";
  if (!marketOk) return "market";
  if (!ruleOk) return "rule";
  return null;
}

export function tokenPreferenceDecision(token: PushTokenRow, event: PushAlertEvent) {
  const markets = token.markets ?? [];
  const ruleIds = token.rule_ids ?? [];
  const marketOk = markets.length === 0 || markets.some((market) => marketMatchesPreference(market, event.market));
  const ruleOk = ruleIds.includes(event.ruleId) || (
    event.ruleId === "macro-event-reminder" && ruleIds.includes("macro-news")
  );
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
