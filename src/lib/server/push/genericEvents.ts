import type { ScoutSetup } from "@/lib/setupScout";
import { passesSetupPushQuality } from "@/lib/server/push/eligibility";
import {
  buildRiskOffEvent,
  buildSemiconductorLeadershipEvent,
  limitCryptoMarketScoutEvents,
  limitGlobalMarketScoutEvents,
  setupToEvent,
  topPushSetups
} from "@/lib/server/push/eventBuilders";
import type { OptionalEventSourceResult, PushAlertEvent } from "@/lib/server/push/types";

export interface GenericPushEvents {
  events: PushAlertEvent[];
  marketScoutLimitSkippedCount: number;
  globalBatchSkippedCount: number;
  globalMomentumLimitSkippedCount: number;
  globalAssetLimitSkippedCount: number;
}

export function buildGenericPushEvents(
  cryptoSetups: ScoutSetup[],
  stockMomentumSetups: ScoutSetup[],
  optionalEventSources: OptionalEventSourceResult[]
): GenericPushEvents {
  const globalCompositeEvents = [buildRiskOffEvent(stockMomentumSetups), buildSemiconductorLeadershipEvent(stockMomentumSetups)];
  // Qualify every timeframe before symbol deduplication or delivery quotas.
  // Otherwise a higher-scoring, ineligible 5m/evidence-poor setup hides a
  // valid candidate, and a crowded alt leaderboard can exclude BTC/ETH.
  const qualifiedCryptoSetups = cryptoSetups.filter((setup) =>
    passesSetupPushQuality(setupToEvent(setup, "radar-grade", "crypto", "radar-grade"))
  );
  const rawCryptoMarketScoutEvents = topPushSetups(qualifiedCryptoSetups, qualifiedCryptoSetups.length).map((setup, index) =>
    setupToEvent(setup, "radar-grade", "crypto", "radar-grade", index + 1)
  );
  const limitedCryptoMarketScoutEvents = limitCryptoMarketScoutEvents(rawCryptoMarketScoutEvents);
  // Preserve bounded rejected samples for the existing quality-skip diagnostics.
  // They never consume qualified delivery slots and the scanner rejects them.
  const rejectedCryptoMarketScoutEvents = topPushSetups(cryptoSetups, 8)
    .map((setup) => setupToEvent(setup, "radar-grade", "crypto", "radar-grade"))
    .filter((event) => !passesSetupPushQuality(event));
  const rawStockMarketScoutEvents = topPushSetups(stockMomentumSetups, 6).map((setup, index) =>
    setupToEvent(setup, "stock-momentum", "stocks", "stock-momentum", index + 1)
  );
  const limitedStockMarketScoutEvents = limitGlobalMarketScoutEvents(rawStockMarketScoutEvents);
  const events = [
    ...limitedCryptoMarketScoutEvents.events,
    ...rejectedCryptoMarketScoutEvents,
    ...limitedStockMarketScoutEvents.events,
    ...globalCompositeEvents,
    ...optionalEventSources.map((source) => source.event)
  ].filter((event): event is PushAlertEvent => event !== null);

  return {
    events,
    marketScoutLimitSkippedCount: limitedCryptoMarketScoutEvents.skipped,
    globalBatchSkippedCount: limitedStockMarketScoutEvents.globalBatchSkippedCount,
    globalMomentumLimitSkippedCount: limitedStockMarketScoutEvents.globalMomentumLimitSkippedCount,
    globalAssetLimitSkippedCount: limitedStockMarketScoutEvents.globalAssetLimitSkippedCount
  };
}
