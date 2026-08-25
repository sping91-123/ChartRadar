import type { Candle } from "@/lib/marketAnalysis";

export const perpetualStructureTimeframes = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;

export type PerpetualStructureTimeframe = (typeof perpetualStructureTimeframes)[number];
export type QualifiedStructureDirection = "bullish" | "bearish" | "unknown";
export type QualifiedMssIntegrity = "ready" | "insufficient" | "invalid" | "unstable" | "unavailable";

export interface QualifiedStructureEvent {
  direction: Exclude<QualifiedStructureDirection, "unknown">;
  level: number;
  occurredAt: string;
  ageBars: number;
  pivotId: string;
}

export interface QualifiedMssEvent extends QualifiedStructureEvent {
  sourceAt: string;
  confirmedAt: string;
  qualityMode: "Displacement";
  quality: {
    bodyAtrRatio: number;
    breakAtrRatio: number;
    closeLocation: number;
  };
}

export interface QualifiedMssState {
  contractVersion: "qualified-mss-v1";
  sourceIndicatorVersion: "Coters-v2.49";
  timeframe: PerpetualStructureTimeframe;
  historyMode: "bounded-replay";
  closedOnly: true;
  historyStart: string | null;
  lastClosedAt: string | null;
  barCount: number;
  warmupComplete: boolean;
  integrity: QualifiedMssIntegrity;
  stability: {
    checkedWindows: number[];
    directionStable: boolean;
    exactPineStateParity: false;
  };
  trend: QualifiedStructureDirection;
  known: boolean;
  trendStrength: number;
  latestMss: QualifiedMssEvent | null;
  activeMsb: QualifiedStructureEvent | null;
  activeChoch: QualifiedStructureEvent | null;
  eventCursor: string | null;
}

const timeframeSeconds: Record<PerpetualStructureTimeframe, number> = {
  "1m": 60,
  "5m": 5 * 60,
  "15m": 15 * 60,
  "1h": 60 * 60,
  "4h": 4 * 60 * 60,
  "1d": 24 * 60 * 60
};

const defaultOptions = {
  zigLength: 5,
  atrLength: 14,
  bodyAtrMinimum: 0.8,
  breakAtrMinimum: 0.1,
  closeLocationMinimum: 0.7,
  minimumReplayBars: 60,
  structureDecayBars: 3
} as const;

type InternalPivot = {
  price: number;
  barNumber: number;
  id: string;
};

type InternalEvent = QualifiedStructureEvent & { barNumber: number };
type InternalMssEvent = QualifiedMssEvent & { barNumber: number };

function isoFromSeconds(value: number) {
  return new Date(value * 1000).toISOString();
}

function pivotId(timeframe: PerpetualStructureTimeframe, candle: Candle, price: number) {
  return `${timeframe}:${candle.time}:${Number(price.toPrecision(12))}`;
}

function eventFromPivot(
  direction: "bullish" | "bearish",
  pivot: InternalPivot,
  candle: Candle,
  barNumber: number
): InternalEvent {
  return {
    direction,
    level: pivot.price,
    occurredAt: isoFromSeconds(candle.time),
    ageBars: 0,
    pivotId: pivot.id,
    barNumber
  };
}

function trueRange(candle: Candle, previousClose: number | null) {
  if (previousClose === null) return candle.high - candle.low;
  return Math.max(
    candle.high - candle.low,
    Math.abs(candle.high - previousClose),
    Math.abs(candle.low - previousClose)
  );
}

function wilderAtr(candles: Candle[], length: number) {
  const result: Array<number | null> = Array.from({ length: candles.length }, () => null);
  let runningSum = 0;
  let previousAtr: number | null = null;
  for (let barNumber = 0; barNumber < candles.length; barNumber += 1) {
    const range = trueRange(candles[barNumber], barNumber > 0 ? candles[barNumber - 1].close : null);
    if (barNumber < length) runningSum += range;
    if (barNumber === length - 1) {
      previousAtr = runningSum / length;
      result[barNumber] = previousAtr;
    } else if (barNumber >= length && previousAtr !== null) {
      previousAtr = (previousAtr * (length - 1) + range) / length;
      result[barNumber] = previousAtr;
    }
  }
  return result;
}

function baseState(
  timeframe: PerpetualStructureTimeframe,
  candles: Candle[],
  integrity: QualifiedMssIntegrity
): QualifiedMssState {
  const seconds = timeframeSeconds[timeframe];
  const first = candles[0];
  const last = candles.at(-1);
  return {
    contractVersion: "qualified-mss-v1",
    sourceIndicatorVersion: "Coters-v2.49",
    timeframe,
    historyMode: "bounded-replay",
    closedOnly: true,
    historyStart: first ? isoFromSeconds(first.time) : null,
    lastClosedAt: last ? isoFromSeconds(last.time + seconds) : null,
    barCount: candles.length,
    warmupComplete: candles.length >= defaultOptions.minimumReplayBars,
    integrity,
    stability: {
      checkedWindows: candles.length ? [candles.length] : [],
      directionStable: integrity === "ready",
      exactPineStateParity: false
    },
    trend: "unknown",
    known: false,
    trendStrength: 0,
    latestMss: null,
    activeMsb: null,
    activeChoch: null,
    eventCursor: null
  };
}

function candleSequenceIntegrity(candles: Candle[], timeframe: PerpetualStructureTimeframe) {
  if (candles.length < defaultOptions.minimumReplayBars) return "insufficient" as const;
  const expectedStep = timeframeSeconds[timeframe];
  for (let barNumber = 0; barNumber < candles.length; barNumber += 1) {
    const candle = candles[barNumber];
    const finite = Object.values(candle).every((value) => Number.isFinite(value));
    const validOhlc = candle.high >= Math.max(candle.open, candle.close) && candle.low <= Math.min(candle.open, candle.close);
    const validTime = Number.isInteger(candle.time) && (barNumber === 0 || candle.time - candles[barNumber - 1].time === expectedStep);
    if (!finite || !validOhlc || !validTime || candle.volume < 0) return "invalid" as const;
  }
  return "ready" as const;
}

export function unavailableQualifiedMss(timeframe: PerpetualStructureTimeframe): QualifiedMssState {
  return baseState(timeframe, [], "unavailable");
}

/**
 * Replays Coters v2.49's default confirmed-structure contract over the supplied
 * native-timeframe closed candles. The result is intentionally labelled as a
 * bounded replay: it never invents a trend that was established before the
 * available history window.
 */
export function analyzeQualifiedMss(
  timeframe: PerpetualStructureTimeframe,
  candles: Candle[]
): QualifiedMssState {
  const integrity = candleSequenceIntegrity(candles, timeframe);
  const empty = baseState(timeframe, candles, integrity);
  if (integrity !== "ready") return empty;

  const atr = wilderAtr(candles, defaultOptions.atrLength);
  const highPivots: InternalPivot[] = [];
  const lowPivots: InternalPivot[] = [];
  let zigTrend: 1 | -1 = 1;
  let trendUpBar: number | null = null;
  let trendDownBar: number | null = null;
  let market: 1 | -1 | 0 = 0;
  let latestMss: InternalMssEvent | null = null;
  let activeMsb: InternalEvent | null = null;
  let activeChoch: InternalEvent | null = null;
  let eventCursor: string | null = null;

  let lastBullMsbPivot: string | null = null;
  let lastBearMsbPivot: string | null = null;
  let lastBullChochPivot: string | null = null;
  let lastBearChochPivot: string | null = null;
  let lastBullRawMssPivot: string | null = null;
  let lastBearRawMssPivot: string | null = null;
  let lastBullMssPivot: string | null = null;
  let lastBearMssPivot: string | null = null;

  for (let barNumber = 0; barNumber < candles.length; barNumber += 1) {
    const candle = candles[barNumber];
    const windowStart = Math.max(0, barNumber - defaultOptions.zigLength + 1);
    let highestClose = Number.NEGATIVE_INFINITY;
    let lowestClose = Number.POSITIVE_INFINITY;
    for (let scan = windowStart; scan <= barNumber; scan += 1) {
      highestClose = Math.max(highestClose, candles[scan].close);
      lowestClose = Math.min(lowestClose, candles[scan].close);
    }
    const toUp = candle.close >= highestClose;
    const toDown = candle.close <= lowestClose;
    const nextZigTrend: 1 | -1 = zigTrend === 1 && toDown ? -1 : zigTrend === -1 && toUp ? 1 : zigTrend;

    if (nextZigTrend !== zigTrend) {
      if (nextZigTrend === 1) {
        const downLength = trendDownBar === null
          ? Math.min(defaultOptions.zigLength, barNumber + 1)
          : Math.min(barNumber - trendDownBar + 1, 500);
        let lowBar = barNumber;
        for (let offset = 0; offset < Math.max(1, Math.min(downLength, barNumber + 1)); offset += 1) {
          const candidateBar = barNumber - offset;
          if (candles[candidateBar].low < candles[lowBar].low) lowBar = candidateBar;
        }
        lowPivots.push({
          price: candles[lowBar].low,
          barNumber: lowBar,
          id: pivotId(timeframe, candles[lowBar], candles[lowBar].low)
        });
        if (lowPivots.length > 50) lowPivots.shift();
        trendUpBar = barNumber;
      } else {
        const upLength = trendUpBar === null
          ? Math.min(defaultOptions.zigLength, barNumber + 1)
          : Math.min(barNumber - trendUpBar + 1, 500);
        let highBar = barNumber;
        for (let offset = 0; offset < Math.max(1, Math.min(upLength, barNumber + 1)); offset += 1) {
          const candidateBar = barNumber - offset;
          if (candles[candidateBar].high > candles[highBar].high) highBar = candidateBar;
        }
        highPivots.push({
          price: candles[highBar].high,
          barNumber: highBar,
          id: pivotId(timeframe, candles[highBar], candles[highBar].high)
        });
        if (highPivots.length > 50) highPivots.shift();
        trendDownBar = barNumber;
      }
      zigTrend = nextZigTrend;
    }

    const highPivot = highPivots.at(-1) ?? null;
    const lowPivot = lowPivots.at(-1) ?? null;
    const trendEstablished = latestMss !== null;
    const bullMsbRaw = trendEstablished && market === 1 && highPivot !== null && highPivot.barNumber < barNumber && candle.close > highPivot.price;
    const bearMsbRaw = trendEstablished && market === -1 && lowPivot !== null && lowPivot.barNumber < barNumber && candle.close < lowPivot.price;
    const bullChochRaw = trendEstablished && market === -1 && highPivot !== null && highPivot.barNumber < barNumber && candle.close > highPivot.price;
    const bearChochRaw = trendEstablished && market === 1 && lowPivot !== null && lowPivot.barNumber < barNumber && candle.close < lowPivot.price;
    const bullMssRaw = (!trendEstablished || market === -1) && highPivot !== null && highPivot.barNumber < barNumber && candle.close > highPivot.price;
    const bearMssRaw = (!trendEstablished || market === 1) && lowPivot !== null && lowPivot.barNumber < barNumber && candle.close < lowPivot.price;
    const ambiguous = highPivot !== null && lowPivot !== null && highPivot.barNumber < barNumber && lowPivot.barNumber < barNumber && candle.high > highPivot.price && candle.low < lowPivot.price;
    if (ambiguous) continue;

    if (bullMsbRaw) {
      activeChoch = null;
      lastBearChochPivot = null;
      lastBearRawMssPivot = null;
      lastBearMssPivot = null;
      if (highPivot && highPivot.id !== lastBullMsbPivot) {
        activeMsb = eventFromPivot("bullish", highPivot, candle, barNumber);
        lastBullMsbPivot = highPivot.id;
        eventCursor = `msb:${activeMsb.direction}:${activeMsb.pivotId}:${activeMsb.occurredAt}`;
      }
    } else if (bearMsbRaw) {
      activeChoch = null;
      lastBullChochPivot = null;
      lastBullRawMssPivot = null;
      lastBullMssPivot = null;
      if (lowPivot && lowPivot.id !== lastBearMsbPivot) {
        activeMsb = eventFromPivot("bearish", lowPivot, candle, barNumber);
        lastBearMsbPivot = lowPivot.id;
        eventCursor = `msb:${activeMsb.direction}:${activeMsb.pivotId}:${activeMsb.occurredAt}`;
      }
    }

    if (bullChochRaw && highPivot && highPivot.id !== lastBullChochPivot) {
      activeChoch = eventFromPivot("bullish", highPivot, candle, barNumber);
      lastBullChochPivot = highPivot.id;
      eventCursor = `choch:${activeChoch.direction}:${activeChoch.pivotId}:${activeChoch.occurredAt}`;
    } else if (bearChochRaw && lowPivot && lowPivot.id !== lastBearChochPivot) {
      activeChoch = eventFromPivot("bearish", lowPivot, candle, barNumber);
      lastBearChochPivot = lowPivot.id;
      eventCursor = `choch:${activeChoch.direction}:${activeChoch.pivotId}:${activeChoch.occurredAt}`;
    }

    const bullRawMssEvent = bullMssRaw && highPivot !== null && highPivot.id !== lastBullRawMssPivot;
    const bearRawMssEvent = bearMssRaw && lowPivot !== null && lowPivot.id !== lastBearRawMssPivot;
    if (bullRawMssEvent && highPivot) lastBullRawMssPivot = highPivot.id;
    else if (bearRawMssEvent && lowPivot) lastBearRawMssPivot = lowPivot.id;

    const currentAtr = atr[barNumber];
    const body = Math.abs(candle.close - candle.open);
    const range = Math.max(candle.high - candle.low, Number.EPSILON);
    const bullCloseLocation = (candle.close - candle.low) / range;
    const bearCloseLocation = (candle.high - candle.close) / range;
    const bullBreakRatio = currentAtr && highPivot ? (candle.close - highPivot.price) / currentAtr : 0;
    const bearBreakRatio = currentAtr && lowPivot ? (lowPivot.price - candle.close) / currentAtr : 0;
    const bodyAtrRatio = currentAtr ? body / currentAtr : 0;
    const bullDisplacement = bullMssRaw && currentAtr !== null && currentAtr > 0 && candle.close > candle.open &&
      bodyAtrRatio >= defaultOptions.bodyAtrMinimum && bullBreakRatio >= defaultOptions.breakAtrMinimum &&
      bullCloseLocation >= defaultOptions.closeLocationMinimum;
    const bearDisplacement = bearMssRaw && currentAtr !== null && currentAtr > 0 && candle.close < candle.open &&
      bodyAtrRatio >= defaultOptions.bodyAtrMinimum && bearBreakRatio >= defaultOptions.breakAtrMinimum &&
      bearCloseLocation >= defaultOptions.closeLocationMinimum;
    const bullCandidate = bullDisplacement && highPivot !== null && highPivot.id !== lastBullMssPivot;
    const bearCandidate = bearDisplacement && lowPivot !== null && lowPivot.id !== lastBearMssPivot;

    if (bullCandidate && highPivot) {
      lastBullMssPivot = highPivot.id;
      const occurredAt = isoFromSeconds(candle.time);
      const confirmedAt = isoFromSeconds(candle.time + timeframeSeconds[timeframe]);
      latestMss = {
        ...eventFromPivot("bullish", highPivot, candle, barNumber),
        sourceAt: occurredAt,
        confirmedAt,
        qualityMode: "Displacement",
        quality: {
          bodyAtrRatio: Number(bodyAtrRatio.toFixed(4)),
          breakAtrRatio: Number(bullBreakRatio.toFixed(4)),
          closeLocation: Number(bullCloseLocation.toFixed(4))
        }
      };
      market = 1;
      activeMsb = null;
      activeChoch = null;
      lastBullMsbPivot = highPivot.id;
      lastBearMsbPivot = null;
      lastBearChochPivot = null;
      lastBearRawMssPivot = null;
      lastBearMssPivot = null;
      eventCursor = `mss:${latestMss.direction}:${latestMss.pivotId}:${latestMss.confirmedAt}`;
    } else if (bearCandidate && lowPivot) {
      lastBearMssPivot = lowPivot.id;
      const occurredAt = isoFromSeconds(candle.time);
      const confirmedAt = isoFromSeconds(candle.time + timeframeSeconds[timeframe]);
      latestMss = {
        ...eventFromPivot("bearish", lowPivot, candle, barNumber),
        sourceAt: occurredAt,
        confirmedAt,
        qualityMode: "Displacement",
        quality: {
          bodyAtrRatio: Number(bodyAtrRatio.toFixed(4)),
          breakAtrRatio: Number(bearBreakRatio.toFixed(4)),
          closeLocation: Number(bearCloseLocation.toFixed(4))
        }
      };
      market = -1;
      activeMsb = null;
      activeChoch = null;
      lastBearMsbPivot = lowPivot.id;
      lastBullMsbPivot = null;
      lastBullChochPivot = null;
      lastBullRawMssPivot = null;
      lastBullMssPivot = null;
      eventCursor = `mss:${latestMss.direction}:${latestMss.pivotId}:${latestMss.confirmedAt}`;
    }
  }

  const lastBar = candles.length - 1;
  const withAge = <T extends InternalEvent | InternalMssEvent>(event: T | null) => event
    ? { ...event, ageBars: Math.max(0, lastBar - event.barNumber) }
    : null;
  const agedMss = withAge(latestMss);
  const agedMsb = withAge(activeMsb);
  const agedChoch = withAge(activeChoch);
  const stripBarNumber = <T extends InternalEvent | InternalMssEvent>(event: T | null): Omit<T, "barNumber"> | null => {
    if (!event) return null;
    const { barNumber: _barNumber, ...publicEvent } = event;
    return publicEvent;
  };
  const mssAge = agedMss?.ageBars ?? 0;
  const trendStrength = agedMss
    ? Math.min(1, Math.max(0.25, mssAge / defaultOptions.structureDecayBars))
    : 0;

  return {
    ...empty,
    trend: market === 1 ? "bullish" : market === -1 ? "bearish" : "unknown",
    known: market !== 0 && agedMss !== null,
    trendStrength: Number(trendStrength.toFixed(4)),
    latestMss: stripBarNumber(agedMss) as QualifiedMssEvent | null,
    activeMsb: stripBarNumber(agedMsb) as QualifiedStructureEvent | null,
    activeChoch: stripBarNumber(agedChoch) as QualifiedStructureEvent | null,
    eventCursor
  };
}

const stabilityWindows = [960, 640, 320] as const;

/**
 * Uses the longest supplied history as the canonical bounded replay, then
 * fails closed when shorter replay boundaries do not converge on the same
 * confirmed direction. This reduces rolling-window flips, but still does not
 * claim exact parity with Pine's persistent state across its full history.
 */
export function analyzeStableQualifiedMss(
  timeframe: PerpetualStructureTimeframe,
  candles: Candle[]
): QualifiedMssState {
  const canonical = analyzeQualifiedMss(timeframe, candles);
  if (canonical.integrity !== "ready") return canonical;

  const windows = [
    candles.length,
    ...stabilityWindows.filter((window) => window < candles.length)
  ];
  const comparisons = windows.slice(1).map((window) => analyzeQualifiedMss(timeframe, candles.slice(-window)));
  const directionStable = canonical.known && comparisons.length === stabilityWindows.length && comparisons.every((candidate) => (
    candidate.integrity === "ready" &&
    candidate.known &&
    candidate.trend === canonical.trend
  ));
  if (!directionStable) {
    return {
      ...canonical,
      integrity: "unstable",
      stability: {
        checkedWindows: windows,
        directionStable: false,
        exactPineStateParity: false
      },
      trend: "unknown",
      known: false,
      trendStrength: 0,
      latestMss: null,
      activeMsb: null,
      activeChoch: null,
      eventCursor: null
    };
  }

  return {
    ...canonical,
    stability: {
      checkedWindows: windows,
      directionStable: true,
      exactPineStateParity: false
    }
  };
}
