import { findSetupAlertMatches } from "@/lib/setupAlertPresets";
import type { ScoutSetup } from "@/lib/setupScout";
import { matchedSetupToEvent } from "@/lib/server/push/eventBuilders";
import { presetFromRow, presetsForMarket } from "@/lib/server/push/presets";
import type { PushAlertEvent, PushAlertPresetRow } from "@/lib/server/push/types";

export function buildUserPresetEvents(
  userPresets: PushAlertPresetRow[],
  cryptoSetups: ScoutSetup[],
  stockPresetSetups: ScoutSetup[]
): PushAlertEvent[] {
  const cryptoPresetMatches = findSetupAlertMatches(
    presetsForMarket(userPresets, "crypto").map(presetFromRow),
    cryptoSetups,
    "crypto"
  ).map((match) => matchedSetupToEvent(match.setup, "watchlist-surge", "crypto", "preset"));

  const stockPresetMatches = findSetupAlertMatches(
    presetsForMarket(userPresets, "stocks").map(presetFromRow),
    stockPresetSetups,
    "stocks"
  ).map((match) => matchedSetupToEvent(match.setup, "stock-momentum", "stocks", "preset"));

  return [...cryptoPresetMatches, ...stockPresetMatches];
}
