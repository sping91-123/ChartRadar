import type { Candle } from "@/lib/marketAnalysis";

export const confirmedCommonRangeOteVersion = "confirmedCommonRangeV1" as const;
export const confirmedCommonRangeOteSourceTimeframe = "1h" as const;
export const confirmedCommonRangeOteSwingLength = 2;
export const confirmedCommonRangeOteMaxAgeBars = 24;
const sourceBarMs = 60 * 60 * 1_000;
const probeBarMs = 15 * 60 * 1_000;
const closedBarSafetyWindowMs = 1_000;

type PivotType = -1 | 1;

interface ConfirmedPivot {
  type: PivotType;
  price: number;
  originIndex: number;
  confirmedIndex: number;
}

interface PublishedRange {
  id: string;
  low: number;
  high: number;
  confirmedAt: string;
  confirmedAtMs: number;
  publishIndex: number;
}

export interface ConfirmedCommonRangeOteBandV1 {
  valid: boolean;
  low: number;
  high: number;
  ideal: number;
  touchedByLatestClosed15m: boolean;
}

export interface ConfirmedCommonRangeOteV1 {
  version: typeof confirmedCommonRangeOteVersion;
  sourceIndicatorVersion: "Coters-v2.48";
  sourceTimeframe: typeof confirmedCommonRangeOteSourceTimeframe;
  probeTimeframe: "15m";
  closedOnly: true;
  historyMode: "bounded-replay";
  exactPineStateParity: false;
  swingLength: number;
  maxAgeBars: number;
  sourceBarCount: number;
  rangeId: string;
  confirmedAt: string;
  ageBars: number;
  rangeLow: number;
  rangeHigh: number;
  midpoint: number;
  activeZone: "long" | "short" | "both" | "none";
  long: ConfirmedCommonRangeOteBandV1;
  short: ConfirmedCommonRangeOteBandV1;
}

export interface DetectConfirmedCommonRangeOteInput {
  symbol: string;
  sourceCandles: readonly Candle[];
  latestClosed15m: Candle | null;
  asOfMs: number;
  swingLength?: number;
  maxAgeBars?: number;
}

function candleOpenTimeMs(candle: Candle) {
  return candle.time > 10_000_000_000 ? candle.time : candle.time * 1_000;
}

function isValidClosedCandle(candle: Candle) {
  return [candle.time, candle.open, candle.high, candle.low, candle.close, candle.volume].every(Number.isFinite)
    && candle.high >= candle.low;
}

function isChronological(candles: readonly Candle[]) {
  return candles.every((candle, index) => index === 0 || candleOpenTimeMs(candle) > candleOpenTimeMs(candles[index - 1]));
}

function hasExpectedSourceSpacing(candles: readonly Candle[]) {
  return candles.every(
    (candle, index) => index === 0 || candleOpenTimeMs(candle) - candleOpenTimeMs(candles[index - 1]) === sourceBarMs
  );
}

function isClosedBy(candle: Candle, durationMs: number, asOfMs: number) {
  return candleOpenTimeMs(candle) + durationMs <= asOfMs;
}

function isLatestClosedBar(candle: Candle, durationMs: number, asOfMs: number) {
  const ageAfterCloseMs = asOfMs - (candleOpenTimeMs(candle) + durationMs);
  return ageAfterCloseMs >= 0 && ageAfterCloseMs < durationMs + closedBarSafetyWindowMs;
}

function confirmedPivotAt(candles: readonly Candle[], confirmedIndex: number, length: number) {
  const originIndex = confirmedIndex - length;
  const windowStart = originIndex - length;
  if (windowStart < 0 || confirmedIndex >= candles.length) {
    return { high: null, low: null } as const;
  }

  const candidate = candles[originIndex];
  let uniqueHigh = true;
  let uniqueLow = true;

  for (let index = windowStart; index <= confirmedIndex; index += 1) {
    if (index === originIndex) continue;
    if (candidate.high <= candles[index].high) uniqueHigh = false;
    if (candidate.low >= candles[index].low) uniqueLow = false;
  }

  return {
    high: uniqueHigh
      ? ({ type: 1, price: candidate.high, originIndex, confirmedIndex } satisfies ConfirmedPivot)
      : null,
    low: uniqueLow
      ? ({ type: -1, price: candidate.low, originIndex, confirmedIndex } satisfies ConfirmedPivot)
      : null
  } as const;
}

export function selectConfirmedCommonRangePivotType(
  hasPivotHigh: boolean,
  hasPivotLow: boolean,
  lastPivotType: PivotType | 0
): PivotType | 0 {
  if (hasPivotHigh && hasPivotLow) {
    if (lastPivotType === -1) return 1;
    if (lastPivotType === 1) return -1;
    return 0;
  }
  if (hasPivotHigh) return 1;
  if (hasPivotLow) return -1;
  return 0;
}

function touchesBand(candle: Candle | null, low: number, high: number, availableAtMs: number) {
  if (!candle || !isValidClosedCandle(candle) || candleOpenTimeMs(candle) < availableAtMs) return false;
  return candle.low <= high && candle.high >= low;
}

export function detectConfirmedCommonRangeOteV1({
  symbol,
  sourceCandles,
  latestClosed15m,
  asOfMs,
  swingLength = confirmedCommonRangeOteSwingLength,
  maxAgeBars = confirmedCommonRangeOteMaxAgeBars
}: DetectConfirmedCommonRangeOteInput): ConfirmedCommonRangeOteV1 | null {
  const latestSourceCandle = sourceCandles.at(-1);
  if (!Number.isInteger(swingLength) || swingLength < 2 || !Number.isInteger(maxAgeBars) || maxAgeBars < 1) return null;
  if (!Number.isFinite(asOfMs)
    || sourceCandles.length < swingLength * 2 + 1
    || !latestSourceCandle
    || !sourceCandles.every(isValidClosedCandle)
    || !isChronological(sourceCandles)
    || !hasExpectedSourceSpacing(sourceCandles)
    || !sourceCandles.every((candle) => isClosedBy(candle, sourceBarMs, asOfMs))
    || !isLatestClosedBar(latestSourceCandle, sourceBarMs, asOfMs)
    || (latestClosed15m !== null
      && (!isValidClosedCandle(latestClosed15m)
        || !isClosedBy(latestClosed15m, probeBarMs, asOfMs)
        || !isLatestClosedBar(latestClosed15m, probeBarMs, asOfMs)))) return null;

  let lastPivot: ConfirmedPivot | null = null;
  let previousPivot: ConfirmedPivot | null = null;
  let publishedRange: PublishedRange | null = null;
  let longBroken = false;
  let shortBroken = false;

  for (let index = 0; index < sourceCandles.length; index += 1) {
    const candle = sourceCandles[index];

    if (publishedRange) {
      if (candle.close < publishedRange.low) longBroken = true;
      if (candle.close > publishedRange.high) shortBroken = true;
    }

    const pivots = confirmedPivotAt(sourceCandles, index, swingLength);
    const candidateType = selectConfirmedCommonRangePivotType(Boolean(pivots.high), Boolean(pivots.low), lastPivot?.type ?? 0);
    const candidate = candidateType === 1 ? pivots.high : candidateType === -1 ? pivots.low : null;
    let publishRange = false;

    if (candidate) {
      if (!lastPivot) {
        lastPivot = candidate;
      } else if (candidate.type === lastPivot.type) {
        const moreExtreme = candidate.type === 1 ? candidate.price > lastPivot.price : candidate.price < lastPivot.price;
        if (moreExtreme) {
          lastPivot = candidate;
          publishRange = previousPivot?.type === (lastPivot.type === 1 ? -1 : 1);
        }
      } else {
        previousPivot = lastPivot;
        lastPivot = candidate;
        publishRange = previousPivot.type === (lastPivot.type === 1 ? -1 : 1);
      }
    }

    if (publishRange && previousPivot && lastPivot) {
      const directionalPairValid =
        (previousPivot.type === -1 && lastPivot.type === 1 && lastPivot.price > previousPivot.price)
        || (previousPivot.type === 1 && lastPivot.type === -1 && lastPivot.price < previousPivot.price);

      if (directionalPairValid) {
        const low = Math.min(previousPivot.price, lastPivot.price);
        const high = Math.max(previousPivot.price, lastPivot.price);
        const confirmationWindow = sourceCandles.slice(index - swingLength, index + 1);
        const confirmationCloseLow = Math.min(...confirmationWindow.map((item) => item.close));
        const confirmationCloseHigh = Math.max(...confirmationWindow.map((item) => item.close));
        const confirmedAtMs = candleOpenTimeMs(candle) + sourceBarMs;
        const confirmedAt = new Date(confirmedAtMs).toISOString();

        publishedRange = {
          id: `${symbol.toUpperCase()}|${confirmedCommonRangeOteSourceTimeframe}|${confirmedAt}`,
          low,
          high,
          confirmedAt,
          confirmedAtMs,
          publishIndex: index
        };
        longBroken = confirmationCloseLow < low;
        shortBroken = confirmationCloseHigh > high;
      }
    }
  }

  if (!publishedRange) return null;
  const ageBars = sourceCandles.length - 1 - publishedRange.publishIndex;
  const span = publishedRange.high - publishedRange.low;
  if (ageBars < 0 || ageBars >= maxAgeBars || !Number.isFinite(span) || span <= 0) return null;

  const longLow = publishedRange.low + span * 0.21;
  const longHigh = publishedRange.low + span * 0.38;
  const shortLow = publishedRange.low + span * 0.62;
  const shortHigh = publishedRange.low + span * 0.79;
  const longValid = !longBroken;
  const shortValid = !shortBroken;
  const touchesLong = longValid && touchesBand(latestClosed15m, longLow, longHigh, publishedRange.confirmedAtMs);
  const touchesShort = shortValid && touchesBand(latestClosed15m, shortLow, shortHigh, publishedRange.confirmedAtMs);

  return {
    version: confirmedCommonRangeOteVersion,
    sourceIndicatorVersion: "Coters-v2.48",
    sourceTimeframe: confirmedCommonRangeOteSourceTimeframe,
    probeTimeframe: "15m",
    closedOnly: true,
    historyMode: "bounded-replay",
    exactPineStateParity: false,
    swingLength,
    maxAgeBars,
    sourceBarCount: sourceCandles.length,
    rangeId: publishedRange.id,
    confirmedAt: publishedRange.confirmedAt,
    ageBars,
    rangeLow: publishedRange.low,
    rangeHigh: publishedRange.high,
    midpoint: publishedRange.low + span * 0.5,
    activeZone: touchesLong && touchesShort ? "both" : touchesLong ? "long" : touchesShort ? "short" : "none",
    long: {
      valid: longValid,
      low: longLow,
      high: longHigh,
      ideal: publishedRange.low + span * 0.295,
      touchedByLatestClosed15m: touchesLong
    },
    short: {
      valid: shortValid,
      low: shortLow,
      high: shortHigh,
      ideal: publishedRange.low + span * 0.705,
      touchedByLatestClosed15m: touchesShort
    }
  };
}
