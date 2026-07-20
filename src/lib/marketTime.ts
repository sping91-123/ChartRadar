import type { Candle, ChartTimeframe } from "@/lib/marketAnalysis";

export const chartTimeframeMs: Record<ChartTimeframe, number> = {
  "5m": 5 * 60 * 1000,
  "15m": 15 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000
};

export type BinanceKlineRow = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string
];

export interface ClosedCandleSet {
  candles: Candle[];
  observedAt: string | null;
  droppedIncomplete: number;
}

export function parseClosedBinanceKlines(rows: unknown, asOfMs: number): ClosedCandleSet {
  if (!Array.isArray(rows)) return { candles: [], observedAt: null, droppedIncomplete: 0 };
  let droppedIncomplete = 0;
  let latestCloseTime = 0;
  const candles = rows
    .map((raw) => {
      const row = Array.isArray(raw) ? raw : [];
      const openTime = Number(row[0]);
      const closeTime = Number(row[6]);
      if (!Number.isFinite(openTime) || !Number.isFinite(closeTime) || closeTime >= asOfMs - 1_000) {
        droppedIncomplete += 1;
        return null;
      }
      const candle: Candle = {
        time: Math.floor(openTime / 1000),
        open: Number(row[1]),
        high: Number(row[2]),
        low: Number(row[3]),
        close: Number(row[4]),
        volume: Number(row[5])
      };
      if (Object.values(candle).some((value) => !Number.isFinite(value))) return null;
      latestCloseTime = Math.max(latestCloseTime, closeTime);
      return candle;
    })
    .filter((candle): candle is Candle => candle !== null);

  return {
    candles,
    observedAt: latestCloseTime > 0 ? new Date(latestCloseTime).toISOString() : null,
    droppedIncomplete
  };
}

export function sourceAgeMs(observedAt: string | null, asOfMs: number) {
  if (!observedAt) return Number.POSITIVE_INFINITY;
  const observed = new Date(observedAt).getTime();
  return Number.isFinite(observed) ? Math.max(0, asOfMs - observed) : Number.POSITIVE_INFINITY;
}
