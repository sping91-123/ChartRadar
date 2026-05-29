import { compactPushSymbol as compactSymbol, isCryptoMajorPushSymbol as isCryptoMajor } from "@/lib/server/push/eligibility";
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

  if (event.market === "crypto" && event.symbol && !isCryptoMajor(event.symbol)) {
    const symbol = compactSymbol(event.symbol);
    const body = isWatchedSymbol
      ? `${symbol}가 알트 시장 후보에 잡혔습니다. 저장 여부와 근거를 확인해 주세요.`
      : `${symbol}가 시장 스캔 후보에 잡혔습니다. 앱에서 근거를 확인해 주세요.`;
    return {
      ...event,
      body,
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
