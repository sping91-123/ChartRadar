export type ChartTimeframe = "5m" | "15m" | "1h" | "4h" | "1d";
export type DirectionState = "bullish" | "bearish" | "neutral" | "unknown";
export type BiasSide = "long" | "short" | "neutral";
export type ReasonTone = "bullish" | "bearish" | "neutral";
export type TradingMode = "swing" | "scalp";

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PivotPoint {
  price: number;
  index: number;
  confirmedIndex: number;
}

export interface FvgZone {
  timeframe: ChartTimeframe;
  direction: "bullish" | "bearish";
  state: "fvg" | "ifvg";
  top: number;
  bottom: number;
  age: number;
  isInside: boolean;
  originIndex: number;
}

export interface OrderBlockZone {
  timeframe: ChartTimeframe;
  direction: "bullish" | "bearish";
  top: number;
  bottom: number;
  age: number;
  isInside: boolean;
  originIndex: number;
}

export interface SweepZone {
  timeframe: ChartTimeframe;
  direction: "bullish" | "bearish";
  level: number;
  age: number;
  kind: "wick";
  index: number;
}

export interface CisdSignal {
  timeframe: ChartTimeframe;
  direction: "bullish" | "bearish";
  age: number;
  index: number;
  level: number;
}

export interface StructureEvent {
  timeframe: ChartTimeframe;
  type: "msb" | "choch";
  direction: "bullish" | "bearish";
  index: number;
  level: number;
}

export interface OteLevels {
  midpoint: number;
  longLow: number;
  longHigh: number;
  shortLow: number;
  shortHigh: number;
}

export interface VolumeProfileLevels {
  poc: number;
  vah: number;
  val: number;
  distancePercent: number;
  position: "above" | "below" | "near";
}

export interface DisplacementSignal {
  timeframe: ChartTimeframe;
  direction: "bullish" | "bearish";
  strength: number;
  age: number;
  index: number;
  bodyPercent: number;
}

export interface LiquidityPool {
  timeframe: ChartTimeframe;
  side: "buySide" | "sellSide";
  level: number;
  age: number;
  touches: number;
  distancePercent: number;
}

export interface DealingRange {
  high: number | null;
  low: number | null;
  equilibrium: number | null;
  position: "premium" | "discount" | "equilibrium" | "unknown";
}

export interface StructureDebug {
  h0: number | null;
  h1: number | null;
  l0: number | null;
  l1: number | null;
  hiCount: number;
  loCount: number;
  market: 1 | -1 | 0;
  choch: 1 | -1 | 0;
}

export interface MarketCondition {
  rsi14: number | null;
  rsiState: "overbought" | "neutral" | "oversold" | "unknown";
  macdLine: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  macdState: "rising" | "falling" | "neutral" | "unknown";
  atr14: number | null;
  atrPercent: number | null;
  volatilityState: "expanded" | "normal" | "compressed" | "unknown";
  volumeRatio: number | null;
  volumeState: "high" | "normal" | "low" | "unknown";
  bollingerMiddle: number | null;
  bollingerUpper: number | null;
  bollingerLower: number | null;
  bollingerPosition: "upper" | "middle" | "lower" | "outsideUpper" | "outsideLower" | "unknown";
}

export interface TimeframeAnalysis {
  timeframe: ChartTimeframe;
  msb: DirectionState;
  choch: DirectionState;
  ema200Side: "above" | "below" | "unknown";
  ema200Value: number | null;
  latestMsbEvent: StructureEvent | null;
  latestChochEvent: StructureEvent | null;
  latestFvg: FvgZone | null;
  inFvg: boolean;
  latestOb: OrderBlockZone | null;
  inOb: boolean;
  latestBb: OrderBlockZone | null;
  inBb: boolean;
  latestSweep: SweepZone | null;
  latestCisd: CisdSignal | null;
  latestDisplacement: DisplacementSignal | null;
  buySideLiquidity: LiquidityPool | null;
  sellSideLiquidity: LiquidityPool | null;
  dealingRange: DealingRange;
  volumeProfile: VolumeProfileLevels | null;
  oteZone: "long" | "short" | "none";
  oteLevels: OteLevels | null;
  premiumDiscount: "premium" | "discount" | "equilibrium" | "unknown";
  condition: MarketCondition;
  score: number;
  debug: StructureDebug;
}

export interface AnalysisReason {
  text: string;
  tone: ReasonTone;
}

export interface ScenarioCard {
  title: string;
  summary: string;
  blockers: string[];
}

export interface TradePlanCandidate {
  mode: TradingMode;
  side: Exclude<BiasSide, "neutral">;
  quality: "A" | "B" | "C";
  title: string;
  entryLabel: string;
  entryLow: number;
  entryHigh: number;
  invalidation: number;
  target1: number;
  target2: number;
  rr1: number;
  rr2: number;
  confidence: number;
  reason: string;
  cautions: string[];
}

export interface MarketAnalysis {
  symbol: string;
  activeTimeframe: ChartTimeframe;
  tradingMode: TradingMode;
  price: number;
  bias: BiasSide;
  killzone: "asia" | "london" | "newyork" | "off";
  biasScore: number;
  readiness: "high" | "medium" | "low";
  verdict: string;
  summaryLine: string;
  actionGuide: string;
  currentLocationLabel: string;
  checkpoints: string[];
  longScenario: ScenarioCard;
  shortScenario: ScenarioCard;
  proPlan: TradePlanCandidate | null;
  opportunityFlags: string[];
  riskFlags: string[];
  reasons: AnalysisReason[];
  warnings: string[];
  timeframeAnalyses: TimeframeAnalysis[];
  updatedAt: string;
}

interface StructureState {
  market: 1 | -1;
  chochDir: 1 | -1;
  h0: PivotPoint | null;
  h1: PivotPoint | null;
  l0: PivotPoint | null;
  l1: PivotPoint | null;
  hiPoints: PivotPoint[];
  loPoints: PivotPoint[];
  latestMsbEvent: StructureEvent | null;
  latestChochEvent: StructureEvent | null;
  latestOb: OrderBlockZone | null;
  latestBb: OrderBlockZone | null;
  latestCisd: CisdSignal | null;
}

interface AnalysisContext {
  oteAnchorCandles?: Candle[];
  useCloseForMsb?: boolean;
  zigLen?: number;
}

export const chartTimeframes: ChartTimeframe[] = ["5m", "15m", "1h", "4h", "1d"];

export const tradingModeConfigs: Record<
  TradingMode,
  {
    activeTimeframes: ChartTimeframe[];
    contextTimeframes: ChartTimeframe[];
    targetR1: number;
    targetR2: number;
    scoutLimit: number;
    minimumScoutScore: number;
  }
> = {
  scalp: {
    activeTimeframes: ["5m", "15m"],
    contextTimeframes: ["1h", "4h"],
    targetR1: 0.7,
    targetR2: 1.0,
    scoutLimit: 500,
    minimumScoutScore: 66
  },
  swing: {
    activeTimeframes: ["1h", "4h", "1d"],
    contextTimeframes: ["4h", "1d"],
    targetR1: 2.0,
    targetR2: 2.5,
    scoutLimit: 360,
    minimumScoutScore: 72
  }
};

const intervalMap: Record<ChartTimeframe, string> = {
  "5m": "5m",
  "15m": "15m",
  "1h": "1h",
  "4h": "4h",
  "1d": "1d"
};

export async function fetchBinanceCandles(
  symbol: string,
  timeframe: ChartTimeframe,
  limit = 320
): Promise<Candle[]> {
  const normalizedSymbol = symbol.toUpperCase().replace(".P", "");
  const params = new URLSearchParams({
    symbol: normalizedSymbol,
    interval: intervalMap[timeframe],
    limit: String(limit)
  });

  const response = await fetch(`https://fapi.binance.com/fapi/v1/klines?${params.toString()}`);
  if (!response.ok) {
    throw new Error("캔들 흐름을 잠시 확인하지 못했습니다.");
  }

  const rows = (await response.json()) as Array<
    [
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
    ]
  >;

  return rows.map((row) => ({
    time: Math.floor(row[0] / 1000),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5])
  }));
}

function ema(values: number[], length: number): number | null {
  if (values.length < length) return null;

  const multiplier = 2 / (length + 1);
  let result = values.slice(0, length).reduce((sum, value) => sum + value, 0) / length;

  for (let index = length; index < values.length; index += 1) {
    result = (values[index] - result) * multiplier + result;
  }

  return result;
}

function emaSeries(values: number[], length: number): Array<number | null> {
  const result: Array<number | null> = Array(values.length).fill(null);
  if (values.length < length) return result;

  const multiplier = 2 / (length + 1);
  let current = values.slice(0, length).reduce((sum, value) => sum + value, 0) / length;
  result[length - 1] = current;

  for (let index = length; index < values.length; index += 1) {
    current = (values[index] - current) * multiplier + current;
    result[index] = current;
  }

  return result;
}

function smaSeries(values: number[], length: number): Array<number | null> {
  const result: Array<number | null> = Array(values.length).fill(null);
  let sum = 0;

  for (let index = 0; index < values.length; index += 1) {
    sum += values[index];
    if (index >= length) sum -= values[index - length];
    if (index >= length - 1) result[index] = sum / length;
  }

  return result;
}

function lastNumber(values: Array<number | null | undefined>): number | null {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundMetric(value: number | null, digits = 2) {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function atrSeries(candles: Candle[], length: number): Array<number | null> {
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

function calculateRsi(values: number[], length = 14): number | null {
  if (values.length <= length) return null;

  let avgGain = 0;
  let avgLoss = 0;

  for (let index = 1; index <= length; index += 1) {
    const diff = values[index] - values[index - 1];
    if (diff >= 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }

  avgGain /= length;
  avgLoss /= length;

  for (let index = length + 1; index < values.length; index += 1) {
    const diff = values[index] - values[index - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (length - 1) + gain) / length;
    avgLoss = (avgLoss * (length - 1) + loss) / length;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function calculateMacd(values: number[]) {
  const fast = emaSeries(values, 12);
  const slow = emaSeries(values, 26);
  const compactLine: number[] = [];

  for (let index = 0; index < values.length; index += 1) {
    if (fast[index] !== null && slow[index] !== null) {
      compactLine.push(Number(fast[index]) - Number(slow[index]));
    }
  }

  const signalSeries = emaSeries(compactLine, 9);
  const line = compactLine.length ? compactLine[compactLine.length - 1] : null;
  const signal = lastNumber(signalSeries);
  const previousSignal = signalSeries.length >= 2 ? lastNumber(signalSeries.slice(0, -1)) : null;
  const previousLine = compactLine.length >= 2 ? compactLine[compactLine.length - 2] : null;
  const histogram = line !== null && signal !== null ? line - signal : null;
  const previousHistogram = previousLine !== null && previousSignal !== null ? previousLine - previousSignal : null;

  let state: MarketCondition["macdState"] = "unknown";
  if (histogram !== null && previousHistogram !== null) {
    const delta = histogram - previousHistogram;
    if (Math.abs(delta) < Math.max(Math.abs(histogram) * 0.05, 1e-8)) state = "neutral";
    else state = delta > 0 ? "rising" : "falling";
  }

  return {
    line,
    signal,
    histogram,
    state
  };
}

function calculateBollinger(values: number[], length = 20, multiplier = 2) {
  if (values.length < length) {
    return {
      middle: null,
      upper: null,
      lower: null,
      position: "unknown" as MarketCondition["bollingerPosition"]
    };
  }

  const latest = values[values.length - 1];
  const window = values.slice(-length);
  const middle = Number(average(window));
  const variance = average(window.map((value) => (value - middle) ** 2)) ?? 0;
  const stdev = Math.sqrt(variance);
  const upper = middle + stdev * multiplier;
  const lower = middle - stdev * multiplier;
  const width = upper - lower;

  if (width <= 0) {
    return {
      middle,
      upper,
      lower,
      position: "unknown" as MarketCondition["bollingerPosition"]
    };
  }

  const ratio = (latest - lower) / width;
  let position: MarketCondition["bollingerPosition"] = "middle";
  if (ratio > 1) position = "outsideUpper";
  else if (ratio < 0) position = "outsideLower";
  else if (ratio >= 0.66) position = "upper";
  else if (ratio <= 0.34) position = "lower";

  return { middle, upper, lower, position };
}

function buildMarketCondition(candles: Candle[], closes: number[]): MarketCondition {
  const latest = candles[candles.length - 1];
  const volumes = candles.map((candle) => candle.volume);
  const volumeSma = lastNumber(smaSeries(volumes, 20));
  const atrValues = atrSeries(candles, 14);
  const atr14 = lastNumber(atrValues);
  const recentAtr = atrValues.filter((value): value is number => typeof value === "number").slice(-40);
  const atrBaseline = average(recentAtr);
  const rsi14 = calculateRsi(closes, 14);
  const macd = calculateMacd(closes);
  const bollinger = calculateBollinger(closes, 20, 2);

  const atrPercent = atr14 !== null && latest?.close ? (atr14 / latest.close) * 100 : null;
  const atrRatio = atr14 !== null && atrBaseline ? atr14 / atrBaseline : null;
  const volumeRatio = volumeSma && latest?.volume ? latest.volume / volumeSma : null;

  const rsiState: MarketCondition["rsiState"] =
    rsi14 === null ? "unknown" : rsi14 >= 70 ? "overbought" : rsi14 <= 30 ? "oversold" : "neutral";
  const volatilityState: MarketCondition["volatilityState"] =
    atrRatio === null ? "unknown" : atrRatio >= 1.2 ? "expanded" : atrRatio <= 0.75 ? "compressed" : "normal";
  const volumeState: MarketCondition["volumeState"] =
    volumeRatio === null ? "unknown" : volumeRatio >= 1.5 ? "high" : volumeRatio <= 0.7 ? "low" : "normal";

  return {
    rsi14: roundMetric(rsi14, 1),
    rsiState,
    macdLine: roundMetric(macd.line, 5),
    macdSignal: roundMetric(macd.signal, 5),
    macdHistogram: roundMetric(macd.histogram, 5),
    macdState: macd.state,
    atr14: roundMetric(atr14, 5),
    atrPercent: roundMetric(atrPercent, 2),
    volatilityState,
    volumeRatio: roundMetric(volumeRatio, 2),
    volumeState,
    bollingerMiddle: roundMetric(bollinger.middle, 5),
    bollingerUpper: roundMetric(bollinger.upper, 5),
    bollingerLower: roundMetric(bollinger.lower, 5),
    bollingerPosition: bollinger.position
  };
}

function highestClose(candles: Candle[], start: number, end: number) {
  let value = -Infinity;
  for (let index = start; index <= end; index += 1) {
    value = Math.max(value, candles[index].close);
  }
  return value;
}

function lowestClose(candles: Candle[], start: number, end: number) {
  let value = Infinity;
  for (let index = start; index <= end; index += 1) {
    value = Math.min(value, candles[index].close);
  }
  return value;
}

function pointFromEnd(points: PivotPoint[], offset: number) {
  const index = points.length - 1 - offset;
  return index >= 0 ? points[index] : null;
}

function formatBarsAgo(age: number, timeframe: ChartTimeframe = "15m") {
  if (age <= 0) return "방금";
  const minutesByTimeframe: Record<ChartTimeframe, number> = {
    "5m": 5,
    "15m": 15,
    "1h": 60,
    "4h": 240,
    "1d": 1440
  };
  const minutes = age * minutesByTimeframe[timeframe];
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 1440) {
    const hours = minutes / 60;
    return Number.isInteger(hours) ? `${hours}시간 전` : `${hours.toFixed(1)}시간 전`;
  }
  const days = minutes / 1440;
  return Number.isInteger(days) ? `${days}일 전` : `${days.toFixed(1)}일 전`;
}

function directionKorean(direction: DirectionState) {
  if (direction === "bullish") return "상승";
  if (direction === "bearish") return "하락";
  if (direction === "neutral") return "횡보";
  return "미확인";
}

function formatLevel(value: number) {
  return value.toLocaleString("ko-KR", {
    maximumFractionDigits: value > 100 ? 2 : 5
  });
}

function getCurrentKillzone(): "asia" | "london" | "newyork" | "off" {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

  const parts = formatter.formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  const totalMinutes = hour * 60 + minute;

  if (totalMinutes >= 20 * 60 && totalMinutes < 22 * 60) return "asia";
  if (totalMinutes >= 2 * 60 && totalMinutes < 5 * 60) return "london";
  if (totalMinutes >= 7 * 60 && totalMinutes < 12 * 60) return "newyork";
  return "off";
}

function buildPivotArrays(candles: Candle[], zigLen = 5) {
  const hiPoints: PivotPoint[] = [];
  const loPoints: PivotPoint[] = [];

  let trend: 1 | -1 = 1;
  let trendUpBar: number | null = null;
  let trendDownBar: number | null = null;

  for (let index = zigLen - 1; index < candles.length; index += 1) {
    const windowStart = Math.max(0, index - zigLen + 1);
    const toUp = candles[index].close >= highestClose(candles, windowStart, index);
    const toDown = candles[index].close <= lowestClose(candles, windowStart, index);
    const nextTrend: 1 | -1 =
      trend === 1 && toDown ? -1 : trend === -1 && toUp ? 1 : trend;

    if (nextTrend !== trend) {
      if (nextTrend === 1) {
        const downLen = trendDownBar === null ? zigLen : Math.min(index - trendDownBar + 1, 500);
        let lowValue = candles[index].low;
        let lowIndex = index;

        for (let offset = 0; offset < downLen && index - offset >= 0; offset += 1) {
          const candle = candles[index - offset];
          if (candle.low < lowValue) {
            lowValue = candle.low;
            lowIndex = index - offset;
          }
        }

        loPoints.push({ price: lowValue, index: lowIndex, confirmedIndex: index });
        if (loPoints.length > 50) loPoints.shift();
        trendUpBar = index;
      }

      if (nextTrend === -1) {
        const upLen = trendUpBar === null ? zigLen : Math.min(index - trendUpBar + 1, 500);
        let highValue = candles[index].high;
        let highIndex = index;

        for (let offset = 0; offset < upLen && index - offset >= 0; offset += 1) {
          const candle = candles[index - offset];
          if (candle.high > highValue) {
            highValue = candle.high;
            highIndex = index - offset;
          }
        }

        hiPoints.push({ price: highValue, index: highIndex, confirmedIndex: index });
        if (hiPoints.length > 50) hiPoints.shift();
        trendDownBar = index;
      }

      trend = nextTrend;
    }
  }

  return { hiPoints, loPoints };
}

function findBullishOb(candles: Candle[], fromIndex: number, toIndex: number) {
  let originIndex = toIndex;
  for (let index = toIndex; index >= fromIndex; index -= 1) {
    if (candles[index].open > candles[index].close) {
      originIndex = index;
      break;
    }
  }
  return originIndex;
}

function findBearishOb(candles: Candle[], fromIndex: number, toIndex: number) {
  let originIndex = toIndex;
  for (let index = toIndex; index >= fromIndex; index -= 1) {
    if (candles[index].open < candles[index].close) {
      originIndex = index;
      break;
    }
  }
  return originIndex;
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

function buildBreakerBlock(
  candles: Candle[],
  timeframe: ChartTimeframe,
  market: 1 | -1,
  h1: PivotPoint | null,
  l1: PivotPoint | null
): OrderBlockZone | null {
  if (!h1 || !l1) return null;

  const fromIndex = Math.max(0, Math.min(h1.index, l1.index));
  const toIndex = Math.max(fromIndex, Math.max(h1.index, l1.index));

  let originIndex = toIndex;

  if (market === 1) {
    for (let index = toIndex; index >= fromIndex; index -= 1) {
      if (candles[index].open < candles[index].close) {
        originIndex = index;
        break;
      }
    }
  } else {
    for (let index = toIndex; index >= fromIndex; index -= 1) {
      if (candles[index].open > candles[index].close) {
        originIndex = index;
        break;
      }
    }
  }

  const latestPrice = candles[candles.length - 1]?.close ?? 0;
  return {
    timeframe,
    direction: market === 1 ? "bullish" : "bearish",
    top: candles[originIndex].high,
    bottom: candles[originIndex].low,
    age: candles.length - 1 - originIndex,
    isInside: latestPrice <= candles[originIndex].high && latestPrice >= candles[originIndex].low,
    originIndex
  };
}

function isValidStructureBox(
  candles: Candle[],
  originIndex: number,
  currentIndex: number,
  volumeSma20: Array<number | null>,
  atr14: Array<number | null>
) {
  const since = currentIndex - originIndex;
  if (since <= 0) return false;

  const candle = candles[originIndex];
  const averageVolume = volumeSma20[originIndex];
  const atrValue = atr14[originIndex];
  const volumeSpike = averageVolume !== null && candle.volume > averageVolume * 1.5;
  const largeCandle = atrValue !== null && Math.abs(candle.close - candle.open) > atrValue;

  return volumeSpike || largeCandle;
}

function pruneStructureBoxes(candle: Candle, bullishBoxes: OrderBlockZone[], bearishBoxes: OrderBlockZone[]) {
  for (let index = bullishBoxes.length - 1; index >= 0; index -= 1) {
    if (candle.close < bullishBoxes[index].bottom) bullishBoxes.splice(index, 1);
  }

  for (let index = bearishBoxes.length - 1; index >= 0; index -= 1) {
    if (candle.close > bearishBoxes[index].top) bearishBoxes.splice(index, 1);
  }
}

function getLatestStructureBox(bullishBoxes: OrderBlockZone[], bearishBoxes: OrderBlockZone[]) {
  const bullish = bullishBoxes[bullishBoxes.length - 1];
  const bearish = bearishBoxes[bearishBoxes.length - 1];

  if (bullish && bearish) {
    return bullish.originIndex >= bearish.originIndex ? bullish : bearish;
  }

  return bullish ?? bearish ?? null;
}

function buildStructureState(
  candles: Candle[],
  timeframe: ChartTimeframe,
  zigLen = 5,
  useCloseForMsb = true
): StructureState {
  const { hiPoints, loPoints } = buildPivotArrays(candles, zigLen);
  const volumeSma20 = smaSeries(candles.map((candle) => candle.volume), 20);
  const atr14 = atrSeries(candles, 14);

  let market: 1 | -1 = 1;
  let chochDir: 1 | -1 = 1;
  let latestMsbEvent: StructureEvent | null = null;
  let latestChochEvent: StructureEvent | null = null;
  let latestBb: OrderBlockZone | null = null;
  let latestCisd: CisdSignal | null = null;
  const bullishObBoxes: OrderBlockZone[] = [];
  const bearishObBoxes: OrderBlockZone[] = [];

  for (let index = 0; index < candles.length; index += 1) {
    const validHighs = hiPoints.filter((point) => point.confirmedIndex <= index);
    const validLows = loPoints.filter((point) => point.confirmedIndex <= index);
    const h0 = pointFromEnd(validHighs, 0);
    const h1 = pointFromEnd(validHighs, 1);
    const l0 = pointFromEnd(validLows, 0);
    const l1 = pointFromEnd(validLows, 1);

    const bullBreakSource = useCloseForMsb ? candles[index].close : candles[index].high;
    const bearBreakSource = useCloseForMsb ? candles[index].close : candles[index].low;

    const bullBreak = market === -1 && h0 && bullBreakSource > h0.price;
    const bearBreak = market === 1 && l0 && bearBreakSource < l0.price;

    if (bullBreak) {
      market = 1;
      chochDir = 1;
      latestMsbEvent = {
        timeframe,
        type: "msb",
        direction: "bullish",
        index,
        level: h0.price
      };

      if (h0 && h1 && l0 && l1) {
        const fromIndex = Math.max(0, h1.index);
        const toIndex = index;
        const originIndex = findInstantBullishOb(candles, fromIndex, toIndex);
        if (isValidStructureBox(candles, originIndex, index, volumeSma20, atr14)) {
          bullishObBoxes.push({
            timeframe,
            direction: "bullish",
            top: candles[originIndex].high,
            bottom: candles[originIndex].low,
            age: candles.length - 1 - originIndex,
            isInside: false,
            originIndex
          });
          if (bullishObBoxes.length > 30) bullishObBoxes.shift();
        }
      }

      pruneStructureBoxes(candles[index], bullishObBoxes, bearishObBoxes);
      continue;
    }

    if (bearBreak) {
      market = -1;
      chochDir = -1;
      latestMsbEvent = {
        timeframe,
        type: "msb",
        direction: "bearish",
        index,
        level: l0.price
      };

      if (h0 && h1 && l0 && l1) {
        const fromIndex = Math.max(0, l1.index);
        const toIndex = index;
        const originIndex = findInstantBearishOb(candles, fromIndex, toIndex);
        if (isValidStructureBox(candles, originIndex, index, volumeSma20, atr14)) {
          bearishObBoxes.push({
            timeframe,
            direction: "bearish",
            top: candles[originIndex].high,
            bottom: candles[originIndex].low,
            age: candles.length - 1 - originIndex,
            isInside: false,
            originIndex
          });
          if (bearishObBoxes.length > 30) bearishObBoxes.shift();
        }
      }

      pruneStructureBoxes(candles[index], bullishObBoxes, bearishObBoxes);
      continue;
    }

    const previousChoch: 1 | -1 = chochDir;
    const instantBearChoch = Boolean(chochDir === 1 && l0 && candles[index].low < l0.price);
    const instantBullChoch = Boolean(chochDir === -1 && h0 && candles[index].high > h0.price);

    if (instantBearChoch) {
      chochDir = -1;
      if (l0) {
        latestChochEvent = {
          timeframe,
          type: "choch",
          direction: "bearish",
          index,
          level: l0.price
        };
      }
    } else if (instantBullChoch) {
      chochDir = 1;
      if (h0) {
        latestChochEvent = {
          timeframe,
          type: "choch",
          direction: "bullish",
          index,
          level: h0.price
        };
      }
    }

    pruneStructureBoxes(candles[index], bullishObBoxes, bearishObBoxes);

    if (chochDir !== previousChoch) {
      const isInsideBullishOb = bullishObBoxes.some(
        (box) => candles[index].close <= box.top && candles[index].close >= box.bottom
      );
      const isInsideBearishOb = bearishObBoxes.some(
        (box) => candles[index].close <= box.top && candles[index].close >= box.bottom
      );

      if (chochDir === 1 && isInsideBullishOb) {
        latestCisd = {
          timeframe,
          direction: "bullish",
          age: candles.length - 1 - index,
          index,
          level: bullishObBoxes[bullishObBoxes.length - 1]?.bottom ?? candles[index].low
        };
      }

      if (chochDir === -1 && isInsideBearishOb) {
        latestCisd = {
          timeframe,
          direction: "bearish",
          age: candles.length - 1 - index,
          index,
          level: bearishObBoxes[bearishObBoxes.length - 1]?.top ?? candles[index].high
        };
      }
    }
  }

  const h0 = pointFromEnd(hiPoints, 0);
  const h1 = pointFromEnd(hiPoints, 1);
  const l0 = pointFromEnd(loPoints, 0);
  const l1 = pointFromEnd(loPoints, 1);

  let latestOb = getLatestStructureBox(bullishObBoxes, bearishObBoxes);

  if (latestOb) {
    const latestPrice = candles[candles.length - 1]?.close ?? 0;
    latestOb = {
      ...latestOb,
      isInside: latestPrice <= latestOb.top && latestPrice >= latestOb.bottom
    };
  }

  latestBb = buildBreakerBlock(candles, timeframe, market, h1, l1);

  return {
    market,
    chochDir,
    h0,
    h1,
    l0,
    l1,
    hiPoints,
    loPoints,
    latestMsbEvent,
    latestChochEvent,
    latestOb,
    latestBb,
    latestCisd
  };
}

function detectLatestSweep(
  candles: Candle[],
  timeframe: ChartTimeframe,
  hiPoints: PivotPoint[],
  loPoints: PivotPoint[]
): SweepZone | null {
  const latestIndex = candles.length - 1;
  let best: SweepZone | null = null;

  for (const point of hiPoints.slice(-10)) {
    for (let index = point.confirmedIndex; index < candles.length; index += 1) {
      const candle = candles[index];
      if (candle.high > point.price && candle.close < point.price) {
        const candidate: SweepZone = {
          timeframe,
          direction: "bearish",
          level: point.price,
          age: latestIndex - index,
          kind: "wick",
          index
        };

        if (!best || candidate.age < best.age) {
          best = candidate;
        }
      }
    }
  }

  for (const point of loPoints.slice(-10)) {
    for (let index = point.confirmedIndex; index < candles.length; index += 1) {
      const candle = candles[index];
      if (candle.low < point.price && candle.close > point.price) {
        const candidate: SweepZone = {
          timeframe,
          direction: "bullish",
          level: point.price,
          age: latestIndex - index,
          kind: "wick",
          index
        };

        if (!best || candidate.age < best.age) {
          best = candidate;
        }
      }
    }
  }

  return best;
}

interface FvgRecord {
  direction: "bullish" | "bearish";
  top: number;
  bottom: number;
  isIfvg: boolean;
  originIndex: number;
}

function detectLatestFvg(candles: Candle[], timeframe: ChartTimeframe, ifvgEnabled = false): FvgZone | null {
  const latestPrice = candles[candles.length - 1]?.close;
  if (!latestPrice || candles.length < 5) return null;

  const records: FvgRecord[] = [];

  for (let index = 2; index < candles.length; index += 1) {
    const current = candles[index];
    const middle = candles[index - 1];
    const previous = candles[index - 2];

    const bullish = current.low > previous.high && middle.close > previous.high;
    if (bullish) {
      records.unshift({
        direction: "bullish",
        top: current.low,
        bottom: previous.high,
        isIfvg: false,
        originIndex: index
      });
    }

    const bearish = current.high < previous.low && middle.close < previous.low;
    if (bearish) {
      records.unshift({
        direction: "bearish",
        top: previous.low,
        bottom: current.high,
        isIfvg: false,
        originIndex: index
      });
    }

    while (records.length > 40) records.pop();

    for (let recordIndex = records.length - 1; recordIndex >= 0; recordIndex -= 1) {
      const record = records[recordIndex];

      if (!record.isIfvg) {
        const fullyBroken =
          record.direction === "bullish"
            ? current.low < record.bottom
            : current.high > record.top;

        if (fullyBroken) {
          if (ifvgEnabled) {
            record.direction = record.direction === "bullish" ? "bearish" : "bullish";
            record.isIfvg = true;
          } else {
            records.splice(recordIndex, 1);
          }
        }
      } else {
        const ifvgDone =
          record.direction === "bullish"
            ? current.high > record.top
            : current.low < record.bottom;
        if (ifvgDone) records.splice(recordIndex, 1);
      }
    }
  }

  const insideRecord = records.find((record) => latestPrice <= record.top && latestPrice >= record.bottom);
  const selected = insideRecord ?? records[0];
  if (!selected) return null;

  return {
    timeframe,
    direction: selected.direction,
    state: selected.isIfvg ? "ifvg" : "fvg",
    top: selected.top,
    bottom: selected.bottom,
    age: candles.length - 1 - selected.originIndex,
    isInside: Boolean(insideRecord),
    originIndex: selected.originIndex
  };
}

function calculateVolumeProfile(candles: Candle[], lookback = 180, bins = 96): VolumeProfileLevels | null {
  const source = candles.slice(-lookback);
  const latestPrice = source[source.length - 1]?.close;
  if (source.length < 20 || !latestPrice) return null;

  const highest = Math.max(...source.map((candle) => candle.high));
  const lowest = Math.min(...source.map((candle) => candle.low));
  const range = highest - lowest;
  if (!Number.isFinite(range) || range <= 0) return null;

  const safeBins = Math.max(20, bins);
  const interval = range / safeBins;
  const volumes = Array.from({ length: safeBins }, () => 0);

  for (const candle of source) {
    const start = Math.max(0, Math.floor((candle.low - lowest) / interval));
    const end = Math.min(safeBins - 1, Math.floor((candle.high - lowest) / interval));
    const spread = Math.max(1, end - start + 1);
    const volumePerBin = candle.volume / spread;

    for (let index = start; index <= end; index += 1) {
      volumes[index] += volumePerBin;
    }
  }

  let pocIndex = 0;
  for (let index = 1; index < volumes.length; index += 1) {
    if (volumes[index] > volumes[pocIndex]) pocIndex = index;
  }

  const totalVolume = volumes.reduce((sum, value) => sum + value, 0);
  const targetVolume = totalVolume * 0.7;
  let currentVolume = volumes[pocIndex];
  let upperIndex = pocIndex;
  let lowerIndex = pocIndex;

  while (currentVolume < targetVolume && (upperIndex < safeBins - 1 || lowerIndex > 0)) {
    const upVolume = upperIndex < safeBins - 1 ? volumes[upperIndex + 1] : -1;
    const downVolume = lowerIndex > 0 ? volumes[lowerIndex - 1] : -1;

    if (upVolume >= downVolume && upVolume >= 0) {
      upperIndex += 1;
      currentVolume += upVolume;
    } else if (downVolume > upVolume && downVolume >= 0) {
      lowerIndex -= 1;
      currentVolume += downVolume;
    } else {
      break;
    }
  }

  const poc = lowest + (pocIndex + 0.5) * interval;
  const vah = lowest + (upperIndex + 1) * interval;
  const val = lowest + lowerIndex * interval;
  const distancePercent = ((latestPrice - poc) / latestPrice) * 100;
  const position =
    Math.abs(distancePercent) <= 0.2 ? "near" : latestPrice > poc ? "above" : "below";

  return { poc, vah, val, distancePercent, position };
}

function detectLatestDisplacement(candles: Candle[], timeframe: ChartTimeframe): DisplacementSignal | null {
  if (candles.length < 30) return null;
  const atrValues = atrSeries(candles, 14);
  const volumeAverage = smaSeries(candles.map((candle) => candle.volume), 20);
  const start = Math.max(1, candles.length - 60);

  for (let index = candles.length - 1; index >= start; index -= 1) {
    const candle = candles[index];
    const atrValue = atrValues[index];
    if (!atrValue || atrValue <= 0) continue;

    const body = Math.abs(candle.close - candle.open);
    const range = Math.max(candle.high - candle.low, 1e-10);
    const bodyPercent = (body / range) * 100;
    const volumeRatio = volumeAverage[index] ? candle.volume / Number(volumeAverage[index]) : 1;
    const bodyAtr = body / atrValue;
    const strength = Math.min(100, Math.round(bodyAtr * 35 + bodyPercent * 0.45 + Math.min(2, volumeRatio) * 12));

    if (bodyAtr >= 0.9 && bodyPercent >= 54 && strength >= 62) {
      return {
        timeframe,
        direction: candle.close >= candle.open ? "bullish" : "bearish",
        strength,
        age: candles.length - 1 - index,
        index,
        bodyPercent: roundMetric(bodyPercent, 1) ?? bodyPercent
      };
    }
  }

  return null;
}

function detectLiquidityPools(
  candles: Candle[],
  timeframe: ChartTimeframe,
  hiPoints: PivotPoint[],
  loPoints: PivotPoint[]
): { buySideLiquidity: LiquidityPool | null; sellSideLiquidity: LiquidityPool | null } {
  const latest = candles[candles.length - 1];
  if (!latest) return { buySideLiquidity: null, sellSideLiquidity: null };

  const atrValue = lastNumber(atrSeries(candles, 14));
  const tolerance = Math.max(latest.close * 0.0015, (atrValue ?? latest.close * 0.004) * 0.18);

  const makePool = (points: PivotPoint[], side: "buySide" | "sellSide") => {
    const recent = points.slice(-16);
    const pools: LiquidityPool[] = [];

    for (let index = 0; index < recent.length; index += 1) {
      const base = recent[index];
      const cluster = recent.filter((point) => Math.abs(point.price - base.price) <= tolerance);
      if (cluster.length < 2) continue;

      const level = cluster.reduce((total, point) => total + point.price, 0) / cluster.length;
      const distancePercent = ((level - latest.close) / latest.close) * 100;
      const isRelevant =
        side === "buySide" ? distancePercent >= -0.15 : distancePercent <= 0.15;
      if (!isRelevant) continue;

      const lastTouchIndex = Math.max(...cluster.map((point) => point.confirmedIndex));
      pools.push({
        timeframe,
        side,
        level,
        age: candles.length - 1 - lastTouchIndex,
        touches: cluster.length,
        distancePercent: roundMetric(distancePercent, 2) ?? distancePercent
      });
    }

    const unique = pools.filter(
      (pool, index, array) => array.findIndex((item) => Math.abs(item.level - pool.level) <= tolerance) === index
    );
    return unique.sort((a, b) => Math.abs(a.distancePercent) - Math.abs(b.distancePercent))[0] ?? null;
  };

  return {
    buySideLiquidity: makePool(hiPoints, "buySide"),
    sellSideLiquidity: makePool(loPoints, "sellSide")
  };
}

function detectDealingRange(candles: Candle[], structure: StructureState): DealingRange {
  const latest = candles[candles.length - 1];
  if (!latest) return { high: null, low: null, equilibrium: null, position: "unknown" };

  const swingHigh = structure.h0?.price ?? Math.max(...candles.slice(-80).map((candle) => candle.high));
  const swingLow = structure.l0?.price ?? Math.min(...candles.slice(-80).map((candle) => candle.low));
  const high = Math.max(swingHigh, swingLow);
  const low = Math.min(swingHigh, swingLow);
  const span = high - low;
  if (!Number.isFinite(span) || span <= 0) return { high, low, equilibrium: null, position: "unknown" };

  const equilibrium = low + span * 0.5;
  const premiumLine = low + span * 0.55;
  const discountLine = low + span * 0.45;
  const position =
    latest.close >= premiumLine
      ? ("premium" as const)
      : latest.close <= discountLine
        ? ("discount" as const)
        : ("equilibrium" as const);

  return { high, low, equilibrium, position };
}

function detectOteAndPd(candles: Candle[], anchorCandles?: Candle[]) {
  const latest = candles[candles.length - 1];
  const range = (anchorCandles && anchorCandles.length >= 20 ? anchorCandles : candles).slice(-20);

  if (!latest || range.length < 20) {
    return {
      oteZone: "none" as const,
      premiumDiscount: "unknown" as const,
      oteLevels: null
    };
  }

  const high = Math.max(...range.map((candle) => candle.high));
  const low = Math.min(...range.map((candle) => candle.low));
  const span = high - low;

  if (span <= 0) {
    return {
      oteZone: "none" as const,
      premiumDiscount: "unknown" as const,
      oteLevels: null
    };
  }

  const position = (latest.close - low) / span;
  const premiumDiscount =
    position > 0.55
      ? ("premium" as const)
      : position < 0.45
        ? ("discount" as const)
        : ("equilibrium" as const);

  const longLower = low + span * 0.21;
  const longUpper = low + span * 0.38;
  const shortLower = low + span * 0.62;
  const shortUpper = low + span * 0.79;

  const touchesLongOte = latest.low <= longUpper && latest.high >= longLower;
  const touchesShortOte = latest.high >= shortUpper && latest.low <= shortLower;

  const oteZone = touchesLongOte
    ? ("long" as const)
    : touchesShortOte
      ? ("short" as const)
      : ("none" as const);

  return {
    oteZone,
    premiumDiscount,
    oteLevels: {
      midpoint: low + span * 0.5,
      longLow: longLower,
      longHigh: longUpper,
      shortLow: shortLower,
      shortHigh: shortUpper
    }
  };
}

function appendReason(reasons: AnalysisReason[], text: string, tone: ReasonTone) {
  reasons.push({ text, tone });
}

function buildSummaryLine(
  bias: BiasSide,
  active: TimeframeAnalysis | undefined,
  htf: TimeframeAnalysis[],
  killzone: "asia" | "london" | "newyork" | "off"
) {
  const htfBullish = htf.filter((item) => item.msb === "bullish").length;
  const htfBearish = htf.filter((item) => item.msb === "bearish").length;

  if (!active) {
    return "데이터를 불러오는 중입니다.";
  }

  const killzoneText =
    killzone === "asia" ? "아시아" : killzone === "london" ? "런던" : killzone === "newyork" ? "뉴욕" : "비킬존";

  if (bias === "long") {
    if (active.choch === "bearish") {
      return "큰 방향은 롱 쪽이지만 단기 구조가 먼저 흔들리고 있어서, 추격보다 재정렬 확인이 먼저입니다.";
    }
    if (active.inFvg && active.latestFvg?.state === "ifvg" && active.latestFvg.direction === "bullish") {
      return "최근 하락 FVG가 뒤집혀 상승 iFVG로 작동하는 구간이라면, 지지 반응 확인이 더 중요합니다.";
    }
    if (active.premiumDiscount === "premium") {
      return "롱 우세지만 프리미엄 구간이라 지금 바로 올려잡기보다 눌림 확인이 더 자연스럽습니다.";
    }
    if (active.inOb && active.latestOb?.direction === "bullish") {
      return "현재가가 상승 OB 안에 있어, 롱 관찰 구간으로 보기 좋은 자리입니다.";
    }
    if (active.inFvg && active.latestFvg?.direction === "bullish") {
      return "상승 FVG 내부라면 눌림 이후 반응을 보는 쪽이 더 깔끔합니다.";
    }
    if (htfBullish >= 2) {
      return killzone === "off"
        ? "상위 구조가 롱 쪽으로 정렬돼 있습니다. 다만 지금은 킬존 밖이라 타이밍은 조금 더 가려보는 편이 좋습니다."
        : `상위 구조가 롱 쪽으로 정렬돼 있고 현재 ${killzoneText} 킬존이라 롱 시나리오를 볼 시간대입니다.`;
    }
    return "롱 쪽이 조금 더 우세하지만, 자리와 반응 확인이 아직 더 필요합니다.";
  }

  if (bias === "short") {
    if (active.choch === "bullish") {
      return "큰 방향은 숏 쪽이지만 단기 구조가 먼저 들리고 있어서, 바로 누르기보다 재차 꺾이는지 보는 편이 좋습니다.";
    }
    if (active.inFvg && active.latestFvg?.state === "ifvg" && active.latestFvg.direction === "bearish") {
      return "최근 상승 FVG가 뒤집혀 하락 iFVG로 작동하는 구간이라면, 저항 반응 확인이 더 중요합니다.";
    }
    if (active.premiumDiscount === "discount") {
      return "숏 우세지만 디스카운트 구간이라 아래에서 무리하게 누르기보다 되돌림을 기다리는 편이 낫습니다.";
    }
    if (active.inOb && active.latestOb?.direction === "bearish") {
      return "현재가가 하락 OB 안에 있어, 숏 관찰 구간으로 보기 좋은 자리입니다.";
    }
    if (active.inFvg && active.latestFvg?.direction === "bearish") {
      return "하락 FVG 내부라면 되돌림 이후 저항 반응을 보는 쪽이 더 깔끔합니다.";
    }
    if (htfBearish >= 2) {
      return killzone === "off"
        ? "상위 구조가 숏 쪽으로 정렬돼 있습니다. 다만 지금은 킬존 밖이라 타이밍은 조금 더 가려보는 편이 좋습니다."
        : `상위 구조가 숏 쪽으로 정렬돼 있고 현재 ${killzoneText} 킬존이라 숏 시나리오를 볼 시간대입니다.`;
    }
    return "숏 쪽이 조금 더 우세하지만, 자리와 반응 확인이 아직 더 필요합니다.";
  }

  if (active.msb !== "unknown") {
    return `현재 ${active.timeframe} 구조는 ${directionKorean(active.msb)} 쪽 힌트가 있지만, 상위 구조 정렬은 아직 애매합니다.`;
  }

  return "아직 방향을 단정하기보다 상위 구조와 현재 위치가 맞아떨어지는지 더 보는 편이 좋습니다.";
}

function buildActionGuide(bias: BiasSide, active: TimeframeAnalysis | undefined, readiness: MarketAnalysis["readiness"]) {
  if (!active) return "데이터를 불러오는 중입니다.";

  if (readiness === "high") {
    if (bias === "long") {
      return "롱 우세와 타이밍 조건이 비교적 같이 맞고 있습니다. 다만 추격보다 OB, FVG/iFVG, 눌림 반응 확인 후 들어가는 편이 안전합니다.";
    }
    if (bias === "short") {
      return "숏 우세와 타이밍 조건이 비교적 같이 맞고 있습니다. 다만 아래에서 누르기보다 되돌림과 iFVG 저항 반응을 확인하는 편이 안전합니다.";
    }
  }

  if (readiness === "medium") {
    if (bias === "long") {
      return "롱 쪽 그림은 살아 있지만 아직 한두 가지가 덜 맞습니다. 추격보다 눌림, 재확인, 손절 기준이 먼저입니다.";
    }
    if (bias === "short") {
      return "숏 쪽 그림은 살아 있지만 아직 한두 가지가 덜 맞습니다. 바로 누르기보다 되돌림과 재차 꺾임 확인이 먼저입니다.";
    }
  }

  if (bias === "neutral") {
    return "지금은 방향보다 관찰이 우선입니다. 억지로 롱이나 숏을 정하기보다 구조가 더 또렷해질 때까지 기다리는 편이 낫습니다.";
  }

  return "구조는 보이지만 바로 진입하기엔 아직 성급할 수 있습니다. 자리, 반응, 리스크 기준을 먼저 확인하세요.";
}

function buildCheckpoints(active: TimeframeAnalysis | undefined) {
  if (!active) return ["데이터를 불러오는 중입니다."];

  const checkpoints: string[] = [];

  if (active.latestOb) {
    checkpoints.push(
      `${active.timeframe} ${active.latestOb.direction === "bullish" ? "상승" : "하락"} OB: ${active.latestOb.bottom.toLocaleString("ko-KR", { maximumFractionDigits: 5 })} - ${active.latestOb.top.toLocaleString("ko-KR", { maximumFractionDigits: 5 })} (${formatBarsAgo(active.latestOb.age, active.timeframe)})`
    );
  }

  if (active.latestBb) {
    checkpoints.push(
      `${active.timeframe} ${active.latestBb.direction === "bullish" ? "상승" : "하락"} BB 후보: ${active.latestBb.bottom.toLocaleString("ko-KR", { maximumFractionDigits: 5 })} - ${active.latestBb.top.toLocaleString("ko-KR", { maximumFractionDigits: 5 })} (${formatBarsAgo(active.latestBb.age, active.timeframe)})`
    );
  }

  if (active.latestFvg) {
    checkpoints.push(
      `${active.timeframe} ${active.latestFvg.direction === "bullish" ? "상승" : "하락"} ${active.latestFvg.state === "ifvg" ? "iFVG" : "FVG"}: ${active.latestFvg.bottom.toLocaleString("ko-KR", { maximumFractionDigits: 5 })} - ${active.latestFvg.top.toLocaleString("ko-KR", { maximumFractionDigits: 5 })} (${formatBarsAgo(active.latestFvg.age, active.timeframe)})`
    );
  }

  if (active.latestSweep) {
    checkpoints.push(
      `${active.timeframe} ${active.latestSweep.direction === "bullish" ? "저점 스윕" : "고점 스윕"}: ${active.latestSweep.level.toLocaleString("ko-KR", { maximumFractionDigits: 5 })} (${formatBarsAgo(active.latestSweep.age, active.timeframe)})`
    );
  }

  if (active.latestCisd) {
    checkpoints.push(
      `${active.timeframe} ${active.latestCisd.direction === "bullish" ? "상승" : "하락"} CISD: ${formatBarsAgo(active.latestCisd.age, active.timeframe)}`
    );
  }

  if (active.volumeProfile) {
    checkpoints.push(
      `${active.timeframe} POC: ${formatLevel(active.volumeProfile.poc)} (${active.volumeProfile.position === "near" ? "근처" : active.volumeProfile.position === "above" ? "위" : "아래"})`
    );
  }

  if (active.oteZone !== "none") {
    checkpoints.push(`${active.timeframe} 현재 ${active.oteZone === "long" ? "롱" : "숏"} OTE 구간`);
  }

  if (!checkpoints.length) {
    checkpoints.push("아직 강하게 눈에 띄는 관찰 구간은 없습니다. 추격보다 구조가 더 모일 때까지 기다리는 편이 좋습니다.");
  }

  return checkpoints.slice(0, 6);
}

function buildCurrentLocationLabel(active: TimeframeAnalysis | undefined, bias: BiasSide) {
  if (!active) return "판독 대기";

  if (active.volumeProfile?.position === "near") {
    return "POC 근처 균형 / 휩쏘 주의 구간";
  }

  if (active.inOb && active.latestOb?.direction === "bullish") {
    return "상승 OB 반응 구간";
  }

  if (active.inOb && active.latestOb?.direction === "bearish") {
    return "하락 OB 저항 구간";
  }

  if (active.inBb && active.latestBb?.direction === "bullish") {
    return "상승 BB 후보 구간";
  }

  if (active.inBb && active.latestBb?.direction === "bearish") {
    return "하락 BB 후보 구간";
  }

  if (active.inFvg && active.latestFvg?.state === "ifvg") {
    return `${active.latestFvg.direction === "bullish" ? "상승" : "하락"} iFVG 구간`;
  }

  if (active.inFvg && active.latestFvg?.state === "fvg") {
    return `${active.latestFvg.direction === "bullish" ? "상승" : "하락"} FVG 구간`;
  }

  if (active.oteZone === "long") {
    return "롱 OTE 구간";
  }

  if (active.oteZone === "short") {
    return "숏 OTE 구간";
  }

  if (active.premiumDiscount === "premium" && bias === "long") {
    return "프리미엄 추격 주의 구간";
  }

  if (active.premiumDiscount === "discount" && bias === "short") {
    return "디스카운트 추격 주의 구간";
  }

  if (active.premiumDiscount === "premium") {
    return "프리미엄 구간";
  }

  if (active.premiumDiscount === "discount") {
    return "디스카운트 구간";
  }

  return "중간 구간 / 관찰 우선";
}

function buildScenarioCard(
  side: "long" | "short",
  active: TimeframeAnalysis | undefined,
  analyses: TimeframeAnalysis[],
  killzone: MarketAnalysis["killzone"]
): ScenarioCard {
  const direction: DirectionState = side === "long" ? "bullish" : "bearish";
  const opposite: DirectionState = side === "long" ? "bearish" : "bullish";
  const higher = analyses.filter((item) => item.timeframe === "4h" || item.timeframe === "1d");
  const blockers: string[] = [];

  if (!active) {
    return {
      title: side === "long" ? "롱 시나리오" : "숏 시나리오",
      summary: "데이터를 불러오는 중입니다.",
      blockers: []
    };
  }

  if (higher.some((item) => item.msb === opposite)) {
    blockers.push(`상위 MSB가 ${side === "long" ? "하락" : "상승"} 쪽으로 섞여 있습니다.`);
  }

  if (active.choch === opposite) {
    blockers.push(`현재 ${active.timeframe} CHoCH가 ${side === "long" ? "하락" : "상승"}으로 먼저 꺾였습니다.`);
  }

  if (active.premiumDiscount === "premium" && side === "long") {
    blockers.push("프리미엄 구간이라 롱 추격은 불리합니다.");
  }

  if (active.premiumDiscount === "discount" && side === "short") {
    blockers.push("디스카운트 구간이라 숏 추격은 불리합니다.");
  }

  if (killzone === "off") {
    blockers.push("현재는 주요 킬존 밖이라 타이밍이 둔할 수 있습니다.");
  }

  if (active.latestCisd?.direction === opposite) {
    blockers.push(`${side === "long" ? "하락" : "상승"} CISD가 최근에 감지됐습니다.`);
  }

  if (active.latestSweep?.direction === opposite && active.latestSweep.age <= 8) {
    blockers.push(`최근 ${side === "long" ? "고점 스윕" : "저점 스윕"} 반대 신호가 가까이 있습니다.`);
  }

  let summary = "";
  if (side === "long") {
    if (active.inOb && active.latestOb?.direction === "bullish") {
      summary = "상승 OB 반응을 확인하는 롱 시나리오가 가장 자연스럽습니다.";
    } else if (active.inFvg && active.latestFvg?.direction === "bullish") {
      summary = `${active.latestFvg.state === "ifvg" ? "iFVG" : "FVG"} 지지 반응을 보는 롱 시나리오를 검토할 수 있습니다.`;
    } else if (active.oteZone === "long") {
      summary = "롱 OTE 구간이라 구조가 다시 붙는지 보는 시나리오가 유효합니다.";
    } else {
      summary = "롱 쪽 구조가 살아 있다면 눌림 뒤 재상승을 보는 시나리오가 기본입니다.";
    }
  } else {
    if (active.inOb && active.latestOb?.direction === "bearish") {
      summary = "하락 OB 저항을 확인하는 숏 시나리오가 가장 자연스럽습니다.";
    } else if (active.inFvg && active.latestFvg?.direction === "bearish") {
      summary = `${active.latestFvg.state === "ifvg" ? "iFVG" : "FVG"} 저항 반응을 보는 숏 시나리오를 검토할 수 있습니다.`;
    } else if (active.oteZone === "short") {
      summary = "숏 OTE 구간이라 구조가 다시 눌리는지 보는 시나리오가 유효합니다.";
    } else {
      summary = "숏 쪽 구조가 살아 있다면 되돌림 뒤 재하락을 보는 시나리오가 기본입니다.";
    }
  }

  return {
    title: side === "long" ? "롱 시나리오" : "숏 시나리오",
    summary,
    blockers: blockers.slice(0, 4)
  };
}

interface PlanZone {
  label: string;
  top: number;
  bottom: number;
  kind: "active_ob" | "active_fvg" | "revisit_ob" | "revisit_fvg" | "ote" | "fallback";
}

function zoneMid(zone: { top: number; bottom: number }) {
  return (zone.top + zone.bottom) / 2;
}

function clampZoneAroundPrice(price: number, side: "long" | "short") {
  const width = price * 0.0025;
  return side === "long"
    ? { bottom: price - width, top: price }
    : { bottom: price, top: price + width };
}

function pickPlanZone(side: "long" | "short", active: TimeframeAnalysis, price: number): PlanZone {
  const direction: DirectionState = side === "long" ? "bullish" : "bearish";

  if (active.inOb && active.latestOb?.direction === direction) {
    return {
      label: `${active.timeframe} ${side === "long" ? "상승" : "하락"} OB`,
      top: active.latestOb.top,
      bottom: active.latestOb.bottom,
      kind: "active_ob"
    };
  }

  if (active.inFvg && active.latestFvg?.direction === direction) {
    return {
      label: `${active.timeframe} ${active.latestFvg.state === "ifvg" ? "iFVG" : "FVG"}`,
      top: active.latestFvg.top,
      bottom: active.latestFvg.bottom,
      kind: "active_fvg"
    };
  }

  if (active.oteZone === side && active.oteLevels) {
    return side === "long"
      ? {
          label: `${active.timeframe} 롱 OTE`,
          top: active.oteLevels.longHigh,
          bottom: active.oteLevels.longLow,
          kind: "ote"
        }
      : {
          label: `${active.timeframe} 숏 OTE`,
          top: active.oteLevels.shortHigh,
          bottom: active.oteLevels.shortLow,
          kind: "ote"
        };
  }

  if (active.latestOb?.direction === direction) {
    return {
      label: `${active.timeframe} ${side === "long" ? "상승" : "하락"} OB 재방문`,
      top: active.latestOb.top,
      bottom: active.latestOb.bottom,
      kind: "revisit_ob"
    };
  }

  if (active.latestFvg?.direction === direction) {
    return {
      label: `${active.timeframe} ${active.latestFvg.state === "ifvg" ? "iFVG" : "FVG"} 재방문`,
      top: active.latestFvg.top,
      bottom: active.latestFvg.bottom,
      kind: "revisit_fvg"
    };
  }

  const hasStructureRange = Boolean(active.debug.h0 && active.debug.l0);
  const fallbackBase = hasStructureRange
    ? zoneMid({ top: Number(active.debug.h0), bottom: Number(active.debug.l0) })
    : price;
  const fallback = clampZoneAroundPrice(fallbackBase, side);
  return {
    label: `${active.timeframe} 현재가 근처 관찰`,
    top: fallback.top,
    bottom: fallback.bottom,
    kind: "fallback"
  };
}

function buildTradePlanCandidate(
  bias: BiasSide,
  active: TimeframeAnalysis | undefined,
  analyses: TimeframeAnalysis[],
  price: number,
  readiness: MarketAnalysis["readiness"],
  killzone: MarketAnalysis["killzone"],
  riskFlags: string[],
  tradingMode: TradingMode
): TradePlanCandidate | null {
  if (!active || bias === "neutral" || price <= 0) return null;

  const side = bias;
  const direction: DirectionState = side === "long" ? "bullish" : "bearish";
  const modeConfig = tradingModeConfigs[tradingMode];
  const zone = pickPlanZone(side, active, price);
  if (zone.kind === "fallback") return null;

  const entryLow = Math.min(zone.bottom, zone.top);
  const entryHigh = Math.max(zone.bottom, zone.top);
  const entry = side === "long" ? entryHigh : entryLow;
  const zoneSize = Math.max(entryHigh - entryLow, price * 0.0015);
  const structureLevel =
    side === "long"
      ? Math.min(active.debug.l0 ?? entryLow, entryLow)
      : Math.max(active.debug.h0 ?? entryHigh, entryHigh);
  const atrBuffer = active.condition.atr14 !== null ? active.condition.atr14 * 0.35 : 0;
  const buffer = Math.max(zoneSize * 0.35, price * 0.0018, atrBuffer);
  const invalidation = side === "long" ? structureLevel - buffer : structureLevel + buffer;
  const risk = Math.abs(entry - invalidation);

  if (!Number.isFinite(risk) || risk <= 0) return null;

  const target1 = side === "long" ? entry + risk * modeConfig.targetR1 : entry - risk * modeConfig.targetR1;
  const target2 = side === "long" ? entry + risk * modeConfig.targetR2 : entry - risk * modeConfig.targetR2;
  const alignedHigher = analyses
    .filter((item) => modeConfig.contextTimeframes.includes(item.timeframe))
    .filter((item) => item.msb === direction).length;
  const confirmationCount = [
    active.msb === direction,
    active.choch === direction,
    active.latestSweep?.direction === direction && active.latestSweep.age <= 12,
    active.latestCisd?.direction === direction && active.latestCisd.age <= 12,
    active.inOb && active.latestOb?.direction === direction,
    active.inFvg && active.latestFvg?.direction === direction,
    side === "long" ? active.premiumDiscount === "discount" : active.premiumDiscount === "premium",
    killzone !== "off"
  ].filter(Boolean).length;
  const freshTriggerAge = tradingMode === "scalp" ? 6 : 12;
  const hasFreshTrigger =
    active.latestSweep?.direction === direction && active.latestSweep.age <= freshTriggerAge;
  const hasFreshCisd =
    active.latestCisd?.direction === direction && active.latestCisd.age <= freshTriggerAge;
  const confidence = Math.max(
    35,
    Math.min(
      92,
      38 +
        confirmationCount * 6 +
        alignedHigher * 7 +
        (readiness === "high" ? 10 : readiness === "medium" ? 4 : -4) -
        riskFlags.length * 4 -
        (tradingMode === "scalp" && !hasFreshTrigger && !hasFreshCisd ? 6 : 0)
    )
  );
  const quality: TradePlanCandidate["quality"] = confidence >= 78 ? "A" : confidence >= 62 ? "B" : "C";
  const cautions = [
    ...riskFlags.slice(0, 3),
    "시장가 추격이 아니라 해당 구간 반응 확인 후 판단",
    "현재 구조와 리스크 기준을 함께 확인한 뒤 실행 여부를 판단하세요"
  ];

  return {
    mode: tradingMode,
    side,
    quality,
    title: `${side === "long" ? "롱" : "숏"} 분석 시나리오`,
    entryLabel: zone.label,
    entryLow,
    entryHigh,
    invalidation,
    target1,
    target2,
    rr1: modeConfig.targetR1,
    rr2: modeConfig.targetR2,
    confidence,
    reason: `${zone.label}을 기준으로 리스크 기준과 참고 목표를 계산했습니다.`,
    cautions: Array.from(new Set(cautions)).slice(0, 5)
  };
}

function buildOpportunityFlags(
  bias: BiasSide,
  active: TimeframeAnalysis | undefined,
  analyses: TimeframeAnalysis[],
  killzone: MarketAnalysis["killzone"]
) {
  const flags: string[] = [];
  if (!active || bias === "neutral") return flags;

  const direction: DirectionState = bias === "long" ? "bullish" : "bearish";
  const alignedHigher = analyses
    .filter((item) => item.timeframe === "4h" || item.timeframe === "1d")
    .every((item) => item.msb === direction);

  if (alignedHigher) flags.push("상위 시간대 구조 정렬");
  if (active.inOb && active.latestOb?.direction === direction) flags.push("현재가가 같은 방향 OB 안에 있음");
  if (active.inBb && active.latestBb?.direction === direction) flags.push("현재가가 같은 방향 BB 후보 안에 있음");
  if (active.inFvg && active.latestFvg?.direction === direction) {
    flags.push(active.latestFvg.state === "ifvg" ? "iFVG 반응 구간 안에 있음" : "FVG 반응 구간 안에 있음");
  }
  if ((bias === "long" && active.oteZone === "long") || (bias === "short" && active.oteZone === "short")) {
    flags.push(`${bias === "long" ? "롱" : "숏"} OTE 구간`);
  }
  if ((bias === "long" && active.premiumDiscount === "discount") || (bias === "short" && active.premiumDiscount === "premium")) {
    flags.push(`${bias === "long" ? "디스카운트" : "프리미엄"} 위치`);
  }
  if (active.latestSweep?.direction === direction && active.latestSweep.age <= 8) flags.push("최근 같은 방향 스윕 발생");
  if (active.latestCisd?.direction === direction && active.latestCisd.age <= 8) flags.push("최근 같은 방향 CISD 발생");
  if (active.volumeProfile?.position === "above" && bias === "long") flags.push("현재가가 POC 위에서 유지");
  if (active.volumeProfile?.position === "below" && bias === "short") flags.push("현재가가 POC 아래에서 유지");
  if (killzone !== "off") {
    flags.push(`${killzone === "asia" ? "아시아" : killzone === "london" ? "런던" : "뉴욕"} 킬존 진행 중`);
  }

  return flags.slice(0, 6);
}

function buildRiskFlags(
  bias: BiasSide,
  active: TimeframeAnalysis | undefined,
  analyses: TimeframeAnalysis[],
  killzone: MarketAnalysis["killzone"]
) {
  const flags: string[] = [];
  if (!active) return flags;

  if (bias === "neutral") flags.push("뚜렷한 방향 우세가 아직 약함");

  const opposite: DirectionState = bias === "long" ? "bearish" : "bullish";

  if (bias !== "neutral" && analyses.some((item) => (item.timeframe === "4h" || item.timeframe === "1d") && item.msb === opposite)) {
    flags.push("상위 시간대 구조가 반대 방향");
  }
  if (bias !== "neutral" && active.choch === opposite) flags.push("현재 TF CHoCH가 반대로 먼저 꺾임");
  if (bias === "long" && active.premiumDiscount === "premium") flags.push("롱 기준 프리미엄 추격 구간");
  if (bias === "short" && active.premiumDiscount === "discount") flags.push("숏 기준 디스카운트 추격 구간");
  if (killzone === "off") flags.push("킬존 바깥 시간대");
  if (active.volumeProfile?.position === "near") flags.push("POC 근처 균형 구간");
  if (bias === "long" && active.volumeProfile?.position === "below") flags.push("롱 기준 POC 아래 위치");
  if (bias === "short" && active.volumeProfile?.position === "above") flags.push("숏 기준 POC 위 위치");
  if (bias !== "neutral" && active.latestSweep?.direction === opposite && active.latestSweep.age <= 8) flags.push("최근 반대 방향 스윕 발생");
  if (bias !== "neutral" && active.latestCisd?.direction === opposite && active.latestCisd.age <= 8) flags.push("최근 반대 방향 CISD 발생");
  if (bias === "long" && active.inOb && active.latestOb?.direction === "bearish") flags.push("현재가가 하락 OB 안에 있음");
  if (bias === "short" && active.inOb && active.latestOb?.direction === "bullish") flags.push("현재가가 상승 OB 안에 있음");

  return flags.slice(0, 6);
}

export function analyzeTimeframe(
  timeframe: ChartTimeframe,
  candles: Candle[],
  context?: AnalysisContext
): TimeframeAnalysis {
  const latest = candles[candles.length - 1];
  const closes = candles.map((candle) => candle.close);
  const ema200 = ema(closes, 200);
  const structure = buildStructureState(candles, timeframe, context?.zigLen ?? 5, context?.useCloseForMsb ?? true);
  const latestSweep = detectLatestSweep(candles, timeframe, structure.hiPoints, structure.loPoints);
  const latestFvg = detectLatestFvg(candles, timeframe);
  const latestOb = structure.latestOb;
  const latestBb = structure.latestBb;
  const latestCisd = structure.latestCisd;
  const latestDisplacement = detectLatestDisplacement(candles, timeframe);
  const { buySideLiquidity, sellSideLiquidity } = detectLiquidityPools(candles, timeframe, structure.hiPoints, structure.loPoints);
  const dealingRange = detectDealingRange(candles, structure);
  const volumeProfile = calculateVolumeProfile(candles);
  const { oteZone, premiumDiscount, oteLevels } = detectOteAndPd(candles, context?.oteAnchorCandles);
  const condition = buildMarketCondition(candles, closes);

  const msb: DirectionState = structure.market === 1 ? "bullish" : "bearish";
  const choch: DirectionState = structure.chochDir === 1 ? "bullish" : "bearish";

  let score = 0;
  if (msb === "bullish") score += 1;
  if (msb === "bearish") score -= 1;
  if (choch === "bullish") score += 0.35;
  if (choch === "bearish") score -= 0.35;
  if (ema200 && latest.close > ema200) score += 1;
  if (ema200 && latest.close < ema200) score -= 1;
  if (latestFvg?.isInside && latestFvg.direction === "bullish") score += 0.75;
  if (latestFvg?.isInside && latestFvg.direction === "bearish") score -= 0.75;
  if (latestOb?.isInside && latestOb.direction === "bullish") score += 0.9;
  if (latestOb?.isInside && latestOb.direction === "bearish") score -= 0.9;
  if (latestBb?.isInside && latestBb.direction === "bullish") score += 0.35;
  if (latestBb?.isInside && latestBb.direction === "bearish") score -= 0.35;
  if (latestSweep?.direction === "bullish" && latestSweep.age <= 20) score += 0.6;
  if (latestSweep?.direction === "bearish" && latestSweep.age <= 20) score -= 0.6;
  if (latestCisd?.direction === "bullish" && latestCisd.age <= 12) score += 0.8;
  if (latestCisd?.direction === "bearish" && latestCisd.age <= 12) score -= 0.8;
  if (latestDisplacement?.direction === "bullish" && latestDisplacement.age <= 8) score += 0.45;
  if (latestDisplacement?.direction === "bearish" && latestDisplacement.age <= 8) score -= 0.45;
  if (dealingRange.position === "discount") score += 0.15;
  if (dealingRange.position === "premium") score -= 0.15;
  if (oteZone === "long") score += 0.5;
  if (oteZone === "short") score -= 0.5;

  return {
    timeframe,
    msb,
    choch,
    ema200Side: ema200 ? (latest.close >= ema200 ? "above" : "below") : "unknown",
    ema200Value: ema200,
    latestMsbEvent: structure.latestMsbEvent,
    latestChochEvent: structure.latestChochEvent,
    latestFvg,
    inFvg: Boolean(latestFvg?.isInside),
    latestOb,
    inOb: Boolean(latestOb?.isInside),
    latestBb,
    inBb: Boolean(latestBb?.isInside),
    latestSweep,
    latestCisd,
    latestDisplacement,
    buySideLiquidity,
    sellSideLiquidity,
    dealingRange,
    volumeProfile,
    oteZone,
    oteLevels,
    premiumDiscount,
    condition,
    score: Number(score.toFixed(2)),
    debug: {
      h0: structure.h0?.price ?? null,
      h1: structure.h1?.price ?? null,
      l0: structure.l0?.price ?? null,
      l1: structure.l1?.price ?? null,
      hiCount: structure.hiPoints.length,
      loCount: structure.loPoints.length,
      market: structure.market,
      choch: structure.chochDir
    }
  };
}

export function summarizeMarket(
  symbol: string,
  activeTimeframe: ChartTimeframe,
  analyses: TimeframeAnalysis[],
  price: number,
  tradingMode: TradingMode = "swing"
): MarketAnalysis {
  const killzone = getCurrentKillzone();
  const modeConfig = tradingModeConfigs[tradingMode];
  const weightedTimeframes = new Set<ChartTimeframe>([activeTimeframe, ...modeConfig.contextTimeframes]);
  const weightedScore = analyses.reduce((sum, item) => {
    if (!weightedTimeframes.has(item.timeframe)) return sum;
    const weight =
      modeConfig.contextTimeframes.includes(item.timeframe) ? 1.35 : item.timeframe === activeTimeframe ? 1.25 : 1;
    return sum + item.score * weight;
  }, 0);

  const bias: BiasSide = weightedScore >= 2 ? "long" : weightedScore <= -2 ? "short" : "neutral";
  const biasDirection = bias === "long" ? "bullish" : bias === "short" ? "bearish" : "neutral";
  const reasons: AnalysisReason[] = [];
  const warnings: string[] = [];
  const active = analyses.find((item) => item.timeframe === activeTimeframe);
  const htf = analyses.filter((item) => modeConfig.contextTimeframes.includes(item.timeframe));
  const fastTf = analyses.filter((item) => item.timeframe === "5m" || item.timeframe === "15m");

  for (const item of fastTf) {
    appendReason(
      reasons,
      `${item.timeframe} MSB ${directionKorean(item.msb)}`,
      item.msb === "bullish" ? "bullish" : "bearish"
    );
    appendReason(
      reasons,
      `${item.timeframe} CHoCH ${directionKorean(item.choch)}`,
      item.choch === "bullish" ? "bullish" : "bearish"
    );
  }

  for (const item of htf) {
    appendReason(
      reasons,
      `${item.timeframe} MSB ${directionKorean(item.msb)}`,
      item.msb === "bullish" ? "bullish" : "bearish"
    );
    appendReason(
      reasons,
      `${item.timeframe} CHoCH ${directionKorean(item.choch)}`,
      item.choch === "bullish" ? "bullish" : "bearish"
    );

    if (item.ema200Side !== "unknown") {
      appendReason(
        reasons,
        `${item.timeframe} EMA200 ${item.ema200Side === "above" ? "위" : "아래"}`,
        item.ema200Side === "above" ? "bullish" : "bearish"
      );
    }
  }

  if (active?.inFvg && active.latestFvg) {
    appendReason(
      reasons,
      `${active.timeframe} ${active.latestFvg.direction === "bullish" ? "상승" : "하락"} ${active.latestFvg.state === "ifvg" ? "iFVG" : "FVG"} 내부`,
      active.latestFvg.direction === "bullish" ? "bullish" : "bearish"
    );
  }

  if (active?.inOb && active.latestOb) {
    appendReason(
      reasons,
      `${active.timeframe} ${active.latestOb.direction === "bullish" ? "상승" : "하락"} OB 내부`,
      active.latestOb.direction === "bullish" ? "bullish" : "bearish"
    );
  }

  if (active?.inBb && active.latestBb) {
    appendReason(
      reasons,
      `${active.timeframe} ${active.latestBb.direction === "bullish" ? "상승" : "하락"} BB 후보 내부`,
      active.latestBb.direction === "bullish" ? "bullish" : "bearish"
    );
  }

  if (active?.latestSweep) {
    appendReason(
      reasons,
      `${active.timeframe} ${active.latestSweep.direction === "bullish" ? "저점 스윕" : "고점 스윕"} ${formatBarsAgo(active.latestSweep.age, active.timeframe)}`,
      active.latestSweep.direction === "bullish" ? "bullish" : "bearish"
    );
  }

  if (active?.latestCisd) {
    appendReason(
      reasons,
      `${active.timeframe} ${active.latestCisd.direction === "bullish" ? "상승" : "하락"} CISD ${formatBarsAgo(active.latestCisd.age, active.timeframe)}`,
      active.latestCisd.direction === "bullish" ? "bullish" : "bearish"
    );
  }

  if (active?.latestDisplacement) {
    appendReason(
      reasons,
      `${active.timeframe} ${active.latestDisplacement.direction === "bullish" ? "상승" : "하락"} Displacement ${formatBarsAgo(active.latestDisplacement.age, active.timeframe)} · 강도 ${active.latestDisplacement.strength}점`,
      active.latestDisplacement.direction === "bullish" ? "bullish" : "bearish"
    );
  }

  if (active?.buySideLiquidity) {
    appendReason(
      reasons,
      `${active.timeframe} Buy-side liquidity ${formatLevel(active.buySideLiquidity.level)} · ${formatBarsAgo(active.buySideLiquidity.age, active.timeframe)}`,
      "neutral"
    );
  }

  if (active?.sellSideLiquidity) {
    appendReason(
      reasons,
      `${active.timeframe} Sell-side liquidity ${formatLevel(active.sellSideLiquidity.level)} · ${formatBarsAgo(active.sellSideLiquidity.age, active.timeframe)}`,
      "neutral"
    );
  }

  if (active && active.dealingRange.position !== "unknown") {
    appendReason(
      reasons,
      `${active.timeframe} Dealing range ${
        active?.dealingRange.position === "premium"
          ? "프리미엄"
          : active?.dealingRange.position === "discount"
            ? "디스카운트"
            : "균형가"
      }`,
      "neutral"
    );
  }

  if (active?.volumeProfile) {
    appendReason(
      reasons,
      `${active.timeframe} POC ${formatLevel(active.volumeProfile.poc)} ${
        active.volumeProfile.position === "near"
          ? "근처"
          : active.volumeProfile.position === "above"
            ? "위"
            : "아래"
      }`,
      "neutral"
    );
  }

  if (active && active.oteZone !== "none") {
    appendReason(
      reasons,
      `${active.timeframe} ${active.oteZone === "long" ? "롱" : "숏"} OTE`,
      active.oteZone === "long" ? "bullish" : "bearish"
    );
  }

  if (active?.premiumDiscount === "premium") {
    appendReason(
      reasons,
      `${active.timeframe} 프리미엄 구간`,
      bias === "short" ? "bullish" : "bearish"
    );
  }

  if (active?.premiumDiscount === "discount") {
    appendReason(
      reasons,
      `${active.timeframe} 디스카운트 구간`,
      bias === "long" ? "bullish" : "bearish"
    );
  }

  if (killzone !== "off") {
    appendReason(
      reasons,
      `${killzone === "asia" ? "아시아" : killzone === "london" ? "런던" : "뉴욕"} 킬존`,
      "neutral"
    );
  } else {
    warnings.push("현재는 주요 킬존 밖입니다. 구조가 좋아 보여도 타이밍은 조금 더 조심해서 보는 편이 좋습니다.");
  }

  if (active?.premiumDiscount === "premium" && bias === "long") {
    warnings.push("프리미엄 구간이라 롱 추격은 조심하는 편이 좋습니다.");
  }

  if (active?.premiumDiscount === "discount" && bias === "short") {
    warnings.push("디스카운트 구간이라 숏 추격은 조심하는 편이 좋습니다.");
  }

  if (bias === "neutral") {
    warnings.push("방향이 아직 충분히 정리되지 않았습니다. 지금은 진입보다 관찰이 우선입니다.");
  }

  if (active?.volumeProfile?.position === "near") {
    warnings.push("현재가가 POC 근처입니다. 방향 추종보다 체결 균형 구간의 휩쏘 가능성을 먼저 의심하세요.");
  }

  if (active?.latestCisd?.direction === "bullish" && bias === "short") {
    warnings.push("OB 내부에서 상승 CISD가 보입니다. 숏 확신은 한 번 줄여서 보는 편이 좋습니다.");
  }

  if (active?.latestCisd?.direction === "bearish" && bias === "long") {
    warnings.push("OB 내부에서 하락 CISD가 보입니다. 롱 확신은 한 번 줄여서 보는 편이 좋습니다.");
  }

  let readinessScore = 0;

  if (bias !== "neutral") readinessScore += 1;
  if (active && active.msb === biasDirection) readinessScore += 1;
  if (active && active.choch === biasDirection) readinessScore += 0.5;
  if (biasDirection !== "neutral" && htf.length > 0 && htf.every((item) => item.msb === biasDirection)) readinessScore += 1;
  if (killzone !== "off") readinessScore += 0.5;

  if (active?.latestSweep && active.latestSweep.age <= 8 && active.latestSweep.direction === biasDirection) {
    readinessScore += 0.5;
  }

  if (active?.latestCisd && active.latestCisd.age <= 8 && active.latestCisd.direction === biasDirection) {
    readinessScore += 0.5;
  }

  if (active?.premiumDiscount === "discount" && bias === "long") readinessScore += 0.5;
  if (active?.premiumDiscount === "premium" && bias === "short") readinessScore += 0.5;
  if (active?.premiumDiscount === "premium" && bias === "long") readinessScore -= 0.5;
  if (active?.premiumDiscount === "discount" && bias === "short") readinessScore -= 0.5;

  const hasDirectionalReactionZone = Boolean(
    active &&
      biasDirection !== "neutral" &&
      ((active.inOb && active.latestOb?.direction === biasDirection) ||
        (active.inFvg && active.latestFvg?.direction === biasDirection) ||
        (bias === "long" && active.oteZone === "long") ||
        (bias === "short" && active.oteZone === "short"))
  );

  if (hasDirectionalReactionZone) readinessScore += 0.75;
  else if (bias !== "neutral") readinessScore -= 0.75;

  const readiness: MarketAnalysis["readiness"] =
    readinessScore >= 4 ? "high" : readinessScore >= 2.25 ? "medium" : "low";
  const opportunityFlags = buildOpportunityFlags(bias, active, analyses, killzone);
  const riskFlags = buildRiskFlags(bias, active, analyses, killzone);
  const proPlan = buildTradePlanCandidate(bias, active, analyses, price, readiness, killzone, riskFlags, tradingMode);

  return {
    symbol,
    activeTimeframe,
    tradingMode,
    price,
    bias,
    killzone,
    biasScore: Number(weightedScore.toFixed(2)),
    readiness,
    verdict: bias === "long" ? "롱 시나리오 우세" : bias === "short" ? "숏 시나리오 우세" : "횡보 / 관찰",
    summaryLine: buildSummaryLine(bias, active, htf, killzone),
    actionGuide: buildActionGuide(bias, active, readiness),
    currentLocationLabel: buildCurrentLocationLabel(active, bias),
    checkpoints: buildCheckpoints(active),
    longScenario: buildScenarioCard("long", active, analyses, killzone),
    shortScenario: buildScenarioCard("short", active, analyses, killzone),
    proPlan,
    opportunityFlags,
    riskFlags,
    reasons: reasons.slice(0, 12),
    warnings,
    timeframeAnalyses: analyses,
    updatedAt: new Date().toISOString()
  };
}
