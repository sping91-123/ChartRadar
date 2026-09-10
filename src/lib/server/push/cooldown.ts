import { isCryptoMajorPushSymbol as isCryptoMajor } from "@/lib/server/push/eligibility";
import type { PushAlertEvent } from "@/lib/server/push/types";
import type { RecentPushAlertEventRow } from "@/lib/server/push/duplicateGuard";

const cryptoAltMarketScoutCooldownMinutes = 360;
const setupSymbolCooldownMinutes = 120;
const liquidationPressureCooldownMinutes = 180;
const unchangedPressureCooldownMinutes = 24 * 60;
const materialPressureIncrease = 10;
const cryptoAltMarketScoutGlobalCooldownMinutes = 60;
const macroReminderDailyLimit = 3;

export interface CooldownDecision {
  blocked: boolean;
  reason: "symbol_cooldown" | "market_scout_limit" | "macro_daily_limit" | "unchanged_pressure" | "same_release" | null;
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
    // A release can arrive from multiple sources with different labels or ISO
    // offsets. Compare its instant, including records made before grouping.
    const releaseMinute = Math.floor(Date.parse(event.data.releaseAt ?? "") / 60000);
    const sameRelease = Number.isFinite(releaseMinute) && recentRows.some((row) =>
      row.rule_id === "macro-event-reminder" &&
      Math.floor(Date.parse(recentPayloadValue(row, "releaseAt") ?? "") / 60000) === releaseMinute
    );
    if (sameRelease) return { blocked: true, reason: "same_release", minutes: 24 * 60 };
    const recentMacroCount = recentRows.filter((row) => (
      row.rule_id === "macro-event-reminder" && recentEventAgeMinutes(row) < 24 * 60
    )).length;
    if (recentMacroCount >= macroReminderDailyLimit) {
      return { blocked: true, reason: "macro_daily_limit", minutes: 24 * 60 };
    }
  }
  if (event.ruleId === "liquidation-pressure") {
    const previous = recentRows
      .filter((row) => recentRowMatchesEventSymbol(row, event) && recentEventAgeMinutes(row) < unchangedPressureCooldownMinutes)
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
    if (previous) {
      const previousPressure = Number(recentPayloadValue(previous, "pressure") ?? Number.NaN);
      const pressure = Number(event.data.pressure ?? Number.NaN);
      const previousSide = recentPayloadValue(previous, "pressure_side");
      const sideChanged = Boolean(previousSide && event.data.pressure_side && previousSide !== event.data.pressure_side);
      const becameExtreme = Number.isFinite(previousPressure) && previousPressure < 75 && pressure >= 75;
      const increased = Number.isFinite(previousPressure) && pressure >= previousPressure + materialPressureIncrease;
      if (!sideChanged && !becameExtreme && !increased) {
        return { blocked: true, reason: "unchanged_pressure", minutes: unchangedPressureCooldownMinutes };
      }
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
