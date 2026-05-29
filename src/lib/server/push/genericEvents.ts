import type { ScoutSetup } from "@/lib/setupScout";
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
  const rawCryptoMarketScoutEvents = topPushSetups(cryptoSetups, 8).map((setup, index) =>
    setupToEvent(setup, "radar-grade", "crypto", "radar-grade", index + 1)
  );
  const limitedCryptoMarketScoutEvents = limitCryptoMarketScoutEvents(rawCryptoMarketScoutEvents);
  const rawStockMarketScoutEvents = topPushSetups(stockMomentumSetups, 6).map((setup, index) =>
    setupToEvent(setup, "stock-momentum", "stocks", "stock-momentum", index + 1)
  );
  const limitedStockMarketScoutEvents = limitGlobalMarketScoutEvents(rawStockMarketScoutEvents);
  const events = [
    ...limitedCryptoMarketScoutEvents.events,
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
