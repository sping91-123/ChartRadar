import { isCryptoMajorPushSymbol as isCryptoMajor } from "@/lib/server/push/eligibility";
import type { PushAlertEvent } from "@/lib/server/push/types";
import type { RecentPushAlertEventRow } from "@/lib/server/push/duplicateGuard";

const cryptoAltMarketScoutCooldownMinutes = 360;
const setupSymbolCooldownMinutes = 120;
const liquidationPressureCooldownMinutes = 180;
const cryptoAltMarketScoutGlobalCooldownMinutes = 60;
const macroReminderDailyLimit = 3;

export interface CooldownDecision {
  blocked: boolean;
  reason: "symbol_cooldown" | "market_scout_limit" | "macro_daily_limit" | null;
  minutes: number;
}

function recentPayloadValue(row: RecentPushAlertEventRow, key: string) {
  const value = row.payload?.[key];
  return typeof value === "string" ? value : undefined;
}

function recentAlertKind(row: RecentPushAlertEventRow) {
  return recentPayloadValue(row, "alert_kind") ?? recentPayloadValue(row, "alertKind") ?? row.rule_id;
}

function recentSymbol(row: RecentPushAlertEventRow) {
  return recentPayloadValue(row, "symbol");
}

function recentEventAgeMinutes(row: RecentPushAlertEventRow) {
  const createdAt = new Date(row.created_at).getTime();
  if (!Number.isFinite(createdAt)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (Date.now() - createdAt) / 60000);
}

function isCryptoAltMarketScoutEvent(event: Pick<PushAlertEvent, "market" | "alertKind" | "symbol">) {
  return event.market === "crypto" && event.alertKind === "market_scout" && Boolean(event.symbol) && !isCryptoMajor(event.symbol ?? "");
}

function recentRowMatchesEventSymbol(row: RecentPushAlertEventRow, event: PushAlertEvent) {
  if (row.market !== event.market) return false;
  if (recentAlertKind(row) !== event.alertKind) return false;
  if (!event.symbol) return false;
  return recentSymbol(row) === event.symbol;
}

function recentRowIsCryptoAltMarketScout(row: RecentPushAlertEventRow) {
  const symbol = recentSymbol(row);
  return row.market === "crypto" && recentAlertKind(row) === "market_scout" && Boolean(symbol) && !isCryptoMajor(symbol ?? "");
}

function cooldownMinutesForEvent(event: PushAlertEvent) {
  if (event.ruleId === "liquidation-pressure") return liquidationPressureCooldownMinutes;
  if (isCryptoAltMarketScoutEvent(event)) return cryptoAltMarketScoutCooldownMinutes;
  if (event.score !== undefined) return setupSymbolCooldownMinutes;
  return 0;
}

export function cooldownDecisionForEvent(recentRows: RecentPushAlertEventRow[], event: PushAlertEvent): CooldownDecision {
  if (event.ruleId === "macro-event-reminder") {
    const recentMacroCount = recentRows.filter((row) => (
      row.rule_id === "macro-event-reminder" && recentEventAgeMinutes(row) < 24 * 60
    )).length;
    if (recentMacroCount >= macroReminderDailyLimit) {
      return { blocked: true, reason: "macro_daily_limit", minutes: 24 * 60 };
    }
  }
  const symbolCooldownMinutes = cooldownMinutesForEvent(event);
  if (symbolCooldownMinutes > 0) {
    const hasRecentSymbolEvent = recentRows.some((row) => recentRowMatchesEventSymbol(row, event) && recentEventAgeMinutes(row) < symbolCooldownMinutes);
    if (hasRecentSymbolEvent) {
      return { blocked: true, reason: "symbol_cooldown", minutes: symbolCooldownMinutes };
    }
  }

  if (isCryptoAltMarketScoutEvent(event)) {
    const hasRecentAltMarketScout = recentRows.some(
      (row) => recentRowIsCryptoAltMarketScout(row) && recentEventAgeMinutes(row) < cryptoAltMarketScoutGlobalCooldownMinutes
    );
    if (hasRecentAltMarketScout) {
      return { blocked: true, reason: "market_scout_limit", minutes: cryptoAltMarketScoutGlobalCooldownMinutes };
    }
  }

  return { blocked: false, reason: null, minutes: 0 };
}

export function eventToRecentRow(event: PushAlertEvent): RecentPushAlertEventRow {
  return {
    event_key: event.eventKey,
    market: event.market,
    rule_id: event.ruleId,
    payload: event.data,
    created_at: new Date().toISOString()
  };
}
