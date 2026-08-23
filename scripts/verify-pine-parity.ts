import {
  analyzeTimeframe,
  fetchBinanceCandles,
  type Candle,
  type ChartTimeframe,
  type DirectionState,
  type TimeframeAnalysis
} from "../src/lib/marketAnalysis";

type Direction = "bullish" | "bearish" | "none";

interface PivotPoint {
  price: number;
  index: number;
  confirmedIndex: number;
}

interface BoxZone {
  direction: Exclude<Direction, "none">;
  top: number;
  bottom: number;
  originIndex: number;
}

interface FvgRecord {
  direction: Exclude<Direction, "none">;
  top: number;
  bottom: number;
  isIfvg: boolean;
  originIndex: number;
}

interface PineReferenceState {
  msb: Exclude<DirectionState, "neutral" | "unknown">;
  choch: Exclude<DirectionState, "neutral" | "unknown">;
  h0: number | null;
  h1: number | null;
  l0: number | null;
  l1: number | null;
  hiCount: number;
  loCount: number;
  latestObDirection: Direction;
  inOb: boolean;
  latestFvgDirection: Direction;
  fvgState: "fvg" | "ifvg" | "none";
  inFvg: boolean;
  cisd: Direction;
}

interface ComparisonCase {
  symbol: string;
  timeframe: ChartTimeframe;
  index: number;
  time: number;
  reference: PineReferenceState;
  web: Pick<TimeframeAnalysis, "msb" | "choch" | "inOb" | "inFvg"> & {
    h0: number | null;
    h1: number | null;
    l0: number | null;
    l1: number | null;
    hiCount: number;
    loCount: number;
    latestObDirection: Direction;
    latestFvgDirection: Direction;
    fvgState: "fvg" | "ifvg" | "none";
    cisd: Direction;
  };
}

const symbols = ["BTCUSDT.P", "ETHUSDT.P", "SOLUSDT.P", "XRPUSDT.P", "DOGEUSDT.P", "BNBUSDT.P"];
const timeframes: ChartTimeframe[] = ["5m", "15m", "1h", "4h", "1d"];
const sampleLimitByTimeframe: Record<ChartTimeframe, number> = {
  "5m": 180,
  "15m": 180,
  "1h": 180,
  "4h": 160,
  "1d": 120
};
const stepByTimeframe: Record<ChartTimeframe, number> = {
  "5m": 12,
  "15m": 8,
  "1h": 4,
  "4h": 2,
  "1d": 1
};

function highestClose(candles: Candle[], start: number, end: number) {
  let result = candles[start].close;
  for (let index = start + 1; index <= end; index += 1) {
    result = Math.max(result, candles[index].close);
  }
  return result;
}

function lowestClose(candles: Candle[], start: number, end: number) {
  let result = candles[start].close;
  for (let index = start + 1; index <= end; index += 1) {
    result = Math.min(result, candles[index].close);
  }
  return result;
}

function fromEnd<T>(items: T[], offset: number) {
  const index = items.length - 1 - offset;
  return index >= 0 ? items[index] : null;
}

function sma(values: number[], length: number) {
  const result: Array<number | null> = Array(values.length).fill(null);
  let sum = 0;
  for (let index = 0; index < values.length; index += 1) {
    sum += values[index];
    if (index >= length) sum -= values[index - length];
    if (index >= length - 1) result[index] = sum / length;
  }
  return result;
}

function atr(candles: Candle[], length: number) {
  const trueRanges = candles.map((candle, index) => {
    if (index === 0) return candle.high - candle.low;
    const previousClose = candles[index - 1].close;
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose)
    );
  });

  const result: Array<number | null> = Array(candles.length).fill(null);
  let seed = 0;
  for (let index = 0; index < trueRanges.length; index += 1) {
    if (index < length) {
      seed += trueRanges[index];
      if (index === length - 1) result[index] = seed / length;
      continue;
    }

    const previous = result[index - 1];
    result[index] = previous === null ? null : (previous * (length - 1) + trueRanges[index]) / length;
  }
  return result;
}

function findInstantBullishOb(candles: Candle[], fromIndex: number, toIndex: number) {
  const safeFrom = Math.max(0, Math.max(fromIndex, toIndex - 200));
  const safeTo = Math.max(safeFrom, toIndex);
  let lowestPrice = candles[safeTo].low;
  let lowestIndex = safeTo;

  for (let index = safeTo; index >= safeFrom; index -= 1) {
    if (candles[index].low < lowestPrice) {
      lowestPrice = candles[index].low;
      lowestIndex = index;
    }
  }

  let originIndex = lowestIndex;
  const searchTo = Math.min(lowestIndex + 10, safeTo);
  for (let index = lowestIndex; index <= searchTo; index += 1) {
    if (candles[index].open > candles[index].close) {
      originIndex = index;
      break;
    }
  }
  return originIndex;
}

function findInstantBearishOb(candles: Candle[], fromIndex: number, toIndex: number) {
  const safeFrom = Math.max(0, Math.max(fromIndex, toIndex - 200));
  const safeTo = Math.max(safeFrom, toIndex);
  let highestPrice = candles[safeTo].high;
  let highestIndex = safeTo;

  for (let index = safeTo; index >= safeFrom; index -= 1) {
    if (candles[index].high > highestPrice) {
      highestPrice = candles[index].high;
      highestIndex = index;
    }
  }

  let originIndex = highestIndex;
  const searchTo = Math.min(highestIndex + 10, safeTo);
  for (let index = highestIndex; index <= searchTo; index += 1) {
    if (candles[index].open < candles[index].close) {
      originIndex = index;
      break;
    }
  }
  return originIndex;
}

function isValidOb(candles: Candle[], originIndex: number, currentIndex: number, smaVolume: Array<number | null>, atr14: Array<number | null>) {
  const since = currentIndex - originIndex;
  if (since <= 0) return false;

  const volumeAverage = smaVolume[originIndex];
  const atrAtOrigin = atr14[originIndex];
  const candle = candles[originIndex];
  const volumeSpike = volumeAverage !== null && candle.volume > volumeAverage * 1.5;
  const largeCandle = atrAtOrigin !== null && Math.abs(candle.close - candle.open) > atrAtOrigin;

  return volumeSpike || largeCandle;
}

function pineReference(candles: Candle[], timeframe: ChartTimeframe, options = { ifvgEnabled: false }): PineReferenceState {
  const zigLen = 5;
  const hiPoints: PivotPoint[] = [];
  const loPoints: PivotPoint[] = [];
  const buObBoxes: BoxZone[] = [];
  const beObBoxes: BoxZone[] = [];
  const fvgRecords: FvgRecord[] = [];
  const smaVolume = sma(candles.map((candle) => candle.volume), 20);
  const atr14 = atr(candles, 14);

  let trend: 1 | -1 = 1;
  let trendUpBar: number | null = null;
  let trendDownBar: number | null = null;
  let market: 1 | -1 = 1;
  let chochDir: 1 | -1 = 1;
  let cisd: Direction = "none";

  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index];
    const previousCandle = candles[index - 2];
    const middleCandle = candles[index - 1];

    if (index >= 2 && previousCandle && middleCandle) {
      const bullFvg = candle.low > previousCandle.high && middleCandle.close > previousCandle.high;
      const bearFvg = candle.high < previousCandle.low && middleCandle.close < previousCandle.low;

      if (bullFvg) {
        fvgRecords.unshift({
          direction: "bullish",
          top: candle.low,
          bottom: previousCandle.high,
          isIfvg: false,
          originIndex: index
        });
      } else if (bearFvg) {
        fvgRecords.unshift({
          direction: "bearish",
          top: previousCandle.low,
          bottom: candle.high,
          isIfvg: false,
          originIndex: index
        });
      }

      while (fvgRecords.length > 40) fvgRecords.pop();
    }

    const windowStart = Math.max(0, index - zigLen + 1);
    const toUp = candle.close >= highestClose(candles, windowStart, index);
    const toDown = candle.close <= lowestClose(candles, windowStart, index);
    const nextTrend: 1 | -1 = trend === 1 && toDown ? -1 : trend === -1 && toUp ? 1 : trend;

    if (nextTrend !== trend) {
      if (nextTrend === 1) {
        const downLen = trendDownBar === null ? zigLen : Math.min(index - trendDownBar + 1, 500);
        let lowValue = candle.low;
        let lowIndex = index;
        for (let offset = 0; offset < downLen && index - offset >= 0; offset += 1) {
          if (candles[index - offset].low < lowValue) {
            lowValue = candles[index - offset].low;
            lowIndex = index - offset;
          }
        }
        loPoints.push({ price: lowValue, index: lowIndex, confirmedIndex: index });
        if (loPoints.length > 50) loPoints.shift();
        trendUpBar = index;
      }

      if (nextTrend === -1) {
        const upLen = trendUpBar === null ? zigLen : Math.min(index - trendUpBar + 1, 500);
        let highValue = candle.high;
        let highIndex = index;
        for (let offset = 0; offset < upLen && index - offset >= 0; offset += 1) {
          if (candles[index - offset].high > highValue) {
            highValue = candles[index - offset].high;
            highIndex = index - offset;
          }
        }
        hiPoints.push({ price: highValue, index: highIndex, confirmedIndex: index });
        if (hiPoints.length > 50) hiPoints.shift();
        trendDownBar = index;
      }

      trend = nextTrend;
    }

    const h0 = fromEnd(hiPoints, 0);
    const h1 = fromEnd(hiPoints, 1);
    const l0 = fromEnd(loPoints, 0);
    const l1 = fromEnd(loPoints, 1);
    const previousMarket = market;
    const previousChoch = chochDir;
    const bullBreak = market === -1 && h0 && candle.close > h0.price;
    const bearBreak = market === 1 && l0 && candle.close < l0.price;

    if (bullBreak) market = 1;
    else if (bearBreak) market = -1;

    const marketChanged = market !== previousMarket;

    if (marketChanged) {
      chochDir = market;
    } else {
      const instantBearChoch = chochDir === 1 && l0 && candle.low < l0.price;
      const instantBullChoch = chochDir === -1 && h0 && candle.high > h0.price;
      if (instantBearChoch) chochDir = -1;
      else if (instantBullChoch) chochDir = 1;
    }

    if (marketChanged && h0 && h1 && l0 && l1) {
      if (market === 1 && h1) {
        const originIndex = findInstantBullishOb(candles, h1.index, index);
        if (isValidOb(candles, originIndex, index, smaVolume, atr14)) {
          buObBoxes.push({
            direction: "bullish",
            top: candles[originIndex].high,
            bottom: candles[originIndex].low,
            originIndex
          });
          if (buObBoxes.length > 30) buObBoxes.shift();
        }
      }

      if (market === -1 && l1) {
        const originIndex = findInstantBearishOb(candles, l1.index, index);
        if (isValidOb(candles, originIndex, index, smaVolume, atr14)) {
          beObBoxes.push({
            direction: "bearish",
            top: candles[originIndex].high,
            bottom: candles[originIndex].low,
            originIndex
          });
          if (beObBoxes.length > 30) beObBoxes.shift();
        }
      }
    }

    for (let boxIndex = buObBoxes.length - 1; boxIndex >= 0; boxIndex -= 1) {
      if (candle.close < buObBoxes[boxIndex].bottom) buObBoxes.splice(boxIndex, 1);
    }

    for (let boxIndex = beObBoxes.length - 1; boxIndex >= 0; boxIndex -= 1) {
      if (candle.close > beObBoxes[boxIndex].top) beObBoxes.splice(boxIndex, 1);
    }

    const chochOnly = chochDir !== previousChoch && !marketChanged;
    const inBullOb = buObBoxes.some((box) => candle.close <= box.top && candle.close >= box.bottom);
    const inBearOb = beObBoxes.some((box) => candle.close <= box.top && candle.close >= box.bottom);
    if (chochOnly && chochDir === 1 && inBullOb) cisd = "bullish";
    if (chochOnly && chochDir === -1 && inBearOb) cisd = "bearish";

    for (let fvgIndex = fvgRecords.length - 1; fvgIndex >= 0; fvgIndex -= 1) {
      const record = fvgRecords[fvgIndex];
      if (!record.isIfvg) {
        const fullyBroken =
          record.direction === "bullish" ? candle.low < record.bottom : candle.high > record.top;

        if (fullyBroken) {
          if (options.ifvgEnabled) {
            record.direction = record.direction === "bullish" ? "bearish" : "bullish";
            record.isIfvg = true;
          } else {
            fvgRecords.splice(fvgIndex, 1);
          }
        }
      } else {
        const ifvgDone =
          record.direction === "bullish" ? candle.high > record.top : candle.low < record.bottom;
        if (ifvgDone) fvgRecords.splice(fvgIndex, 1);
      }
    }
  }

  const latestClose = candles[candles.length - 1].close;
  const latestBullOb = buObBoxes.at(-1);
  const latestBearOb = beObBoxes.at(-1);
  const latestOb =
    latestBullOb && latestBearOb
      ? latestBullOb.originIndex >= latestBearOb.originIndex
        ? latestBullOb
        : latestBearOb
      : latestBullOb ?? latestBearOb ?? null;
  const insideFvg = fvgRecords.find((record) => latestClose <= record.top && latestClose >= record.bottom) ?? null;

  return {
    msb: market === 1 ? "bullish" : "bearish",
    choch: chochDir === 1 ? "bullish" : "bearish",
    h0: fromEnd(hiPoints, 0)?.price ?? null,
    h1: fromEnd(hiPoints, 1)?.price ?? null,
    l0: fromEnd(loPoints, 0)?.price ?? null,
    l1: fromEnd(loPoints, 1)?.price ?? null,
    hiCount: hiPoints.length,
    loCount: loPoints.length,
    latestObDirection: latestOb?.direction ?? "none",
    inOb: latestOb ? latestClose <= latestOb.top && latestClose >= latestOb.bottom : false,
    latestFvgDirection: insideFvg?.direction ?? "none",
    fvgState: insideFvg ? (insideFvg.isIfvg ? "ifvg" : "fvg") : "none",
    inFvg: Boolean(insideFvg),
    cisd
  };
}

function normalizeDirection(value: DirectionState): Exclude<DirectionState, "neutral" | "unknown"> {
  return value === "bearish" ? "bearish" : "bullish";
}

function webState(analysis: TimeframeAnalysis): ComparisonCase["web"] {
  return {
    msb: analysis.msb,
    choch: analysis.choch,
    h0: analysis.debug.h0,
    h1: analysis.debug.h1,
    l0: analysis.debug.l0,
    l1: analysis.debug.l1,
    hiCount: analysis.debug.hiCount,
    loCount: analysis.debug.loCount,
    latestObDirection: analysis.latestOb?.direction ?? "none",
    inOb: analysis.inOb,
    latestFvgDirection: analysis.inFvg ? analysis.latestFvg?.direction ?? "none" : "none",
    fvgState: analysis.inFvg ? analysis.latestFvg?.state ?? "none" : "none",
    inFvg: analysis.inFvg,
    cisd: analysis.latestCisd?.direction ?? "none"
  };
}

function closeEnough(a: number | null, b: number | null) {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  const denom = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) / denom < 0.000001;
}

function pct(numerator: number, denominator: number) {
  return denominator ? Number(((numerator / denominator) * 100).toFixed(1)) : 0;
}

function mismatchSample(cases: ComparisonCase[], predicate: (item: ComparisonCase) => boolean) {
  return cases
    .filter(predicate)
    .slice(0, 10)
    .map((item) => ({
      symbol: item.symbol,
      tf: item.timeframe,
      time: new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).format(new Date(item.time * 1000)),
      reference: item.reference,
      web: item.web
    }));
}

function summarize(cases: ComparisonCase[]) {
  const total = cases.length;
  const msbMatches = cases.filter((item) => item.reference.msb === normalizeDirection(item.web.msb)).length;
  const chochMatches = cases.filter((item) => item.reference.choch === normalizeDirection(item.web.choch)).length;
  const inObMatches = cases.filter((item) => item.reference.inOb === item.web.inOb).length;
  const obDirectionMatches = cases.filter((item) => item.reference.latestObDirection === item.web.latestObDirection).length;
  const inFvgMatches = cases.filter((item) => item.reference.inFvg === item.web.inFvg).length;
  const fvgDirectionMatches = cases.filter((item) => item.reference.latestFvgDirection === item.web.latestFvgDirection).length;
  const fvgStateMatches = cases.filter((item) => item.reference.fvgState === item.web.fvgState).length;
  const pivotMatches = cases.filter(
    (item) =>
      closeEnough(item.reference.h0, item.web.h0) &&
      closeEnough(item.reference.h1, item.web.h1) &&
      closeEnough(item.reference.l0, item.web.l0) &&
      closeEnough(item.reference.l1, item.web.l1)
  ).length;

  return {
    total,
    msb: pct(msbMatches, total),
    choch: pct(chochMatches, total),
    pivots: pct(pivotMatches, total),
    inOb: pct(inObMatches, total),
    obDirection: pct(obDirectionMatches, total),
    inFvg: pct(inFvgMatches, total),
    fvgDirection: pct(fvgDirectionMatches, total),
    fvgState: pct(fvgStateMatches, total)
  };
}

async function main() {
  const cases: ComparisonCase[] = [];

  for (const symbol of symbols) {
    console.log(`[parity] fetching ${symbol}`);
    for (const timeframe of timeframes) {
      const candles = await fetchBinanceCandles(symbol, timeframe, 900);
      const start = Math.max(260, candles.length - sampleLimitByTimeframe[timeframe]);
      const step = stepByTimeframe[timeframe];

      for (let index = start; index < candles.length; index += step) {
        const slice = candles.slice(0, index + 1);
        const reference = pineReference(slice, timeframe);
        const analysis = analyzeTimeframe(timeframe, slice, { useCloseForMsb: true });
        cases.push({
          symbol,
          timeframe,
          index,
          time: candles[index].time,
          reference,
          web: webState(analysis)
        });
      }
    }
  }

  const byTimeframe = Object.fromEntries(
    timeframes.map((timeframe) => [
      timeframe,
      summarize(cases.filter((item) => item.timeframe === timeframe))
    ])
  );

  const bySymbol = Object.fromEntries(
    symbols.map((symbol) => [
      symbol,
      summarize(cases.filter((item) => item.symbol === symbol))
    ])
  );

  const report = {
    generatedAt: new Date().toISOString(),
    referenceContract: "Coters-v2.42 legacy structure only",
    deterministicContracts: {
      confirmedCommonRangeOte: "npm.cmd run test:perpetual-ote",
      pineSnapshotSchema: "npm.cmd run test:pine-parity"
    },
    notes: [
      "This live comparison still follows Coters_v2.42 structure defaults: useCloseForMSB=true, useVolFilter=true, ifvg_enabled=false.",
      "It must not be presented as v2.48 OTE parity; the v2.48 confirmed common-range contract is covered by the deterministic fixture command above.",
      "This validates structural parity, not trade profitability.",
      "FVG/OB mismatches are expected if the web engine only considers the latest zone while Pine keeps arrays of active boxes."
    ],
    overall: summarize(cases),
    byTimeframe,
    bySymbol,
    samples: {
      msbMismatch: mismatchSample(cases, (item) => item.reference.msb !== normalizeDirection(item.web.msb)),
      chochMismatch: mismatchSample(cases, (item) => item.reference.choch !== normalizeDirection(item.web.choch)),
      obDirectionMismatch: mismatchSample(cases, (item) => item.reference.latestObDirection !== item.web.latestObDirection),
      obMismatch: mismatchSample(cases, (item) => item.reference.inOb !== item.web.inOb),
      fvgMismatch: mismatchSample(cases, (item) => item.reference.inFvg !== item.web.inFvg)
    }
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
