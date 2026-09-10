import { parseClosedBinanceKlines } from "@/lib/marketTime";
import { detectRapidPriceMove, rapidMoveEventKey, rapidMoveNextCheck, type RapidMoveSnapshot, type RapidMoveSymbol } from "@/lib/rapidPriceMove";
import type { PushAlertEvent } from "@/lib/server/push/types";

export function rapidMoveToEvent(snapshot: RapidMoveSnapshot): PushAlertEvent {
  const eventKey = rapidMoveEventKey(snapshot);
  const change = `${snapshot.changePercent > 0 ? "+" : ""}${snapshot.changePercent.toFixed(2)}%`;
  return {
    market: "crypto", ruleId: "rapid-price-move", alertKind: "rapid_move", eventKey,
    symbol: snapshot.symbol, system: true,
    title: `${snapshot.symbol.replace("USDT", "")} ${snapshot.windowMinutes}분 ${change} · ${snapshot.direction === "up" ? "급등" : "급락"}`,
    body: rapidMoveNextCheck(snapshot),
    data: {
      type: "rapid_price_move", destination: "rapid_price_move", market: "crypto", symbol: snapshot.symbol,
      event_key: eventKey, alert_kind: "rapid_move", timeframe: "1m", direction: snapshot.direction,
      change_percent: String(snapshot.changePercent), window_minutes: String(snapshot.windowMinutes),
      observed_at: snapshot.observedAt, end_price: String(snapshot.endPrice)
    },
    auditEvidence: { version: 1, capturedAt: snapshot.detectedAt, source: "rapid_move_candles", snapshot: { ...snapshot } }
  };
}

export async function scanRapidMoveEvent(symbol: RapidMoveSymbol): Promise<PushAlertEvent | null> {
  const response = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=1m&limit=62`, {
    cache: "no-store", signal: AbortSignal.timeout(5500), headers: { Accept: "application/json" }
  });
  if (!response.ok) throw new Error(`${symbol} futures candles HTTP ${response.status}`);
  const now = Date.now();
  const { candles } = parseClosedBinanceKlines(await response.json(), now);
  const snapshot = detectRapidPriceMove(symbol, candles, now);
  return snapshot ? rapidMoveToEvent(snapshot) : null;
}
