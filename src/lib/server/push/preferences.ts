// 푸시 토큰별 시장과 규칙 선호 필터를 분리한다.
import type { RadarAlertRuleId } from "@/lib/radarAlerts";
import type { SetupAlertMarket } from "@/lib/setupAlertPresets";
import type { PushTokenRow } from "@/lib/server/push/types";

export function tokenWants(token: PushTokenRow, market: SetupAlertMarket, ruleId: RadarAlertRuleId) {
  const markets = token.markets ?? [];
  const ruleIds = token.rule_ids ?? [];
  const marketOk = markets.length === 0 || markets.includes(market);
  const ruleOk = ruleIds.length === 0 || ruleIds.includes(ruleId);
  return marketOk && ruleOk;
}
