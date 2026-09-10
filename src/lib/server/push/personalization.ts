import type { PushAlertEvent, PushAlertPresetRow } from "@/lib/server/push/types";

export function personalizeEventForUser(event: PushAlertEvent, userPresets: PushAlertPresetRow[]): PushAlertEvent {
  const watchedSymbols = new Set(userPresets.map((preset) => preset.symbol));
  const isWatchedSymbol = event.symbol ? watchedSymbols.has(event.symbol) : event.isWatchlist === true;
  if (!event.isMarketScout) {
    return {
      ...event,
      isWatchedSymbol,
      data: {
        ...event.data,
        is_watched_symbol: String(isWatchedSymbol)
      }
    };
  }

  return {
    ...event,
    isWatchedSymbol,
    data: {
      ...event.data,
      is_watched_symbol: String(isWatchedSymbol)
    }
  };
}
