// 기술지표 레이더의 보조지표 계산과 해석을 담당합니다.
import type { Candle } from "@/lib/marketAnalysis";

export type TechnicalTone = "bullish" | "bearish" | "neutral" | "warning";

export interface IndicatorReading {
  label: string;
  value: string;
  tone: TechnicalTone;
  score: number;
  description: string;
}

export interface CandlestickPattern {
  name: string;
  tone: TechnicalTone;
  confidence: number;
  description: string;
  detectedAt: number | null;
}

export interface FibonacciLevel {
  label: string;
  ratio: number;
  price: number;
}

export interface TechnicalRadarReport {
  price: number;
  trendLabel: string;
  momentumLabel: string;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  fearGreed: {
    score: number;
    label: string;
    description: string;
  };
  supportResistance: {
    support: number | null;
    resistance: number | null;
    supportDistancePercent: number | null;
    resistanceDistancePercent: number | null;
  };
  candlestickPatterns: CandlestickPattern[];
  trendIndicators: IndicatorReading[];
  momentumIndicators: IndicatorReading[];
  volatilityIndicators: IndicatorReading[];
  volumeIndicators: IndicatorReading[];
  fibonacci: {
    low: number | null;
    high: number | null;
    positionPercent: number | null;
    levels: FibonacciLevel[];
  };
  summary: string;
}

const emptyReport: TechnicalRadarReport = {
  price: 0,
  trendLabel: "데이터 부족",
  momentumLabel: "확인 대기",
  bullishCount: 0,
  bearishCount: 0,
  neutralCount: 0,
  fearGreed: {
    score: 50,
    label: "중립",
    description: "캔들 데이터가 부족해 시장 심리 참고값을 계산하지 못했습니다."
  },
  supportResistance: {
    support: null,
    resistance: null,
    supportDistancePercent: null,
    resistanceDistancePercent: null
  },
  candlestickPatterns: [],
  trendIndicators: [],
  momentumIndicators: [],
  volatilityIndicators: [],
  volumeIndicators: [],
  fibonacci: {
    low: null,
    high: null,
    positionPercent: null,
    levels: []
  },
  summary: "캔들 데이터가 충분히 쌓이면 기술지표 레이더가 표시됩니다."
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function last<T>(values: T[]) {
  return values.length ? values[values.length - 1] : null;
}

function average(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function formatNumber(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "미확인";
  return value.toLocaleString("ko-KR", { maximumFractionDigits: digits });
}

function formatPercent(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "미확인";
  return `${value.toFixed(digits)}%`;
}

function closes(candles: Candle[]) {
  return candles.map((candle) => candle.close);
}

function highs(candles: Candle[]) {
  return candles.map((candle) => candle.high);
}

function lows(candles: Candle[]) {
  return candles.map((candle) => candle.low);
}

function volumes(candles: Candle[]) {
  return candles.map((candle) => candle.volume);
}

function typicalPrices(candles: Candle[]) {
  return candles.map((candle) => (candle.high + candle.low + candle.close) / 3);
}

function midpoint(candles: Candle[]) {
  if (!candles.length) return null;
  return (Math.max(...highs(candles)) + Math.min(...lows(candles))) / 2;
}

function sma(values: number[], length: number) {
  if (values.length < length) return null;
  return average(values.slice(-length));
}

function emaSeries(values: number[], length: number) {
  if (!values.length) return [];
  const multiplier = 2 / (length + 1);
  const result: number[] = [];
  let previous = values[0];
  result.push(previous);

  for (let index = 1; index < values.length; index += 1) {
    previous = values[index] * multiplier + previous * (1 - multiplier);
    result.push(previous);
  }

  return result;
}

function wilderSeries(values: number[], length: number) {
  if (values.length < length) return [];
  const result: number[] = [];
  let previous = average(values.slice(0, length)) ?? values[0];
  for (let index = 0; index < values.length; index += 1) {
    if (index < length - 1) {
      result.push(previous);
      continue;
    }
    if (index === length - 1) {
      result.push(previous);
      continue;
    }
    previous = (previous * (length - 1) + values[index]) / length;
    result.push(previous);
  }
  return result;
}

function rsi(values: number[], length = 14) {
  if (values.length <= length) return null;
  const gains: number[] = [];
  const losses: number[] = [];
  for (let index = 1; index < values.length; index += 1) {
    const change = values[index] - values[index - 1];
    gains.push(Math.max(change, 0));
    losses.push(Math.max(-change, 0));
  }
  const avgGain = last(wilderSeries(gains, length));
  const avgLoss = last(wilderSeries(losses, length));
  if (avgGain === null || avgLoss === null) return null;
  if (avgLoss === 0) return 100;
  const relativeStrength = avgGain / avgLoss;
  return 100 - 100 / (1 + relativeStrength);
}

function macd(values: number[]) {
  if (values.length < 35) return { line: null, signal: null, histogram: null };
  const ema12 = emaSeries(values, 12);
  const ema26 = emaSeries(values, 26);
  const lineSeries = values.map((_, index) => ema12[index] - ema26[index]);
  const signalSeries = emaSeries(lineSeries.slice(25), 9);
  const line = last(lineSeries);
  const signal = last(signalSeries);
  return {
    line,
    signal,
    histogram: line !== null && signal !== null ? line - signal : null
  };
}

function stochastic(candles: Candle[], length = 14, smooth = 3) {
  if (candles.length < length + smooth) return { k: null, d: null };
  const kValues: number[] = [];

  for (let index = length - 1; index < candles.length; index += 1) {
    const window = candles.slice(index - length + 1, index + 1);
    const highest = Math.max(...highs(window));
    const lowest = Math.min(...lows(window));
    const range = highest - lowest;
    kValues.push(range === 0 ? 50 : ((candles[index].close - lowest) / range) * 100);
  }

  const recentK = kValues.slice(-smooth);
  return { k: last(recentK), d: average(recentK) };
}

function cci(candles: Candle[], length = 20) {
  if (candles.length < length) return null;
  const typical = typicalPrices(candles).slice(-length);
  const mean = average(typical);
  if (mean === null) return null;
  const deviation = average(typical.map((value) => Math.abs(value - mean)));
  if (!deviation) return 0;
  return ((last(typical) ?? mean) - mean) / (0.015 * deviation);
}

function mfi(candles: Candle[], length = 14) {
  if (candles.length <= length) return null;
  const slice = candles.slice(-(length + 1));
  let positive = 0;
  let negative = 0;

  for (let index = 1; index < slice.length; index += 1) {
    const currentTypical = (slice[index].high + slice[index].low + slice[index].close) / 3;
    const previousTypical = (slice[index - 1].high + slice[index - 1].low + slice[index - 1].close) / 3;
    const flow = currentTypical * slice[index].volume;
    if (currentTypical >= previousTypical) positive += flow;
    else negative += flow;
  }

  if (negative === 0) return 100;
  const ratio = positive / negative;
  return 100 - 100 / (1 + ratio);
}

function williamsR(candles: Candle[], length = 14) {
  if (candles.length < length) return null;
  const slice = candles.slice(-length);
  const highest = Math.max(...highs(slice));
  const lowest = Math.min(...lows(slice));
  const range = highest - lowest;
  if (!range) return -50;
  return ((highest - candles[candles.length - 1].close) / range) * -100;
}

function roc(values: number[], length = 12) {
  if (values.length <= length) return null;
  const current = values[values.length - 1];
  const previous = values[values.length - 1 - length];
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

function momentum(values: number[], length = 10) {
  if (values.length <= length) return null;
  return values[values.length - 1] - values[values.length - 1 - length];
}

function trueRange(candle: Candle, previousClose?: number) {
  if (previousClose === undefined) return candle.high - candle.low;
  return Math.max(candle.high - candle.low, Math.abs(candle.high - previousClose), Math.abs(candle.low - previousClose));
}

function atrSeries(candles: Candle[], length = 14) {
  if (candles.length <= length) return [];
  const ranges = candles.map((candle, index) => trueRange(candle, index > 0 ? candles[index - 1].close : undefined));
  return wilderSeries(ranges, length);
}

function atr(candles: Candle[], length = 14) {
  return last(atrSeries(candles, length));
}

function ultimateOscillator(candles: Candle[]) {
  if (candles.length < 29) return null;

  const calc = (length: number) => {
    const slice = candles.slice(-length);
    let bp = 0;
    let tr = 0;
    for (let index = 0; index < slice.length; index += 1) {
      const originalIndex = candles.length - length + index;
      const previousClose = originalIndex > 0 ? candles[originalIndex - 1].close : slice[index].close;
      bp += slice[index].close - Math.min(slice[index].low, previousClose);
      tr += Math.max(slice[index].high, previousClose) - Math.min(slice[index].low, previousClose);
    }
    return tr === 0 ? 50 : (bp / tr) * 100;
  };

  return (4 * calc(7) + 2 * calc(14) + calc(28)) / 7;
}

function bollinger(values: number[], length = 20, multiplier = 2) {
  if (values.length < length) return { upper: null, middle: null, lower: null, positionPercent: null, widthPercent: null };
  const slice = values.slice(-length);
  const middle = average(slice);
  if (middle === null) return { upper: null, middle: null, lower: null, positionPercent: null, widthPercent: null };
  const variance = average(slice.map((value) => (value - middle) ** 2)) ?? 0;
  const deviation = Math.sqrt(variance);
  const upper = middle + deviation * multiplier;
  const lower = middle - deviation * multiplier;
  const price = last(values) ?? middle;
  const positionPercent = upper === lower ? 50 : ((price - lower) / (upper - lower)) * 100;
  const widthPercent = middle === 0 ? null : ((upper - lower) / middle) * 100;
  return { upper, middle, lower, positionPercent, widthPercent };
}

function keltner(candles: Candle[], length = 20, atrLength = 10, multiplier = 2) {
  const closeValues = closes(candles);
  const middle = last(emaSeries(closeValues, length));
  const atrValue = atr(candles, atrLength);
  if (middle === null || atrValue === null) return { upper: null, middle, lower: null, positionPercent: null };
  const upper = middle + atrValue * multiplier;
  const lower = middle - atrValue * multiplier;
  const price = closeValues[closeValues.length - 1];
  return {
    upper,
    middle,
    lower,
    positionPercent: upper === lower ? 50 : ((price - lower) / (upper - lower)) * 100
  };
}

function donchian(candles: Candle[], length = 20) {
  if (candles.length < length) return { high: null, low: null, positionPercent: null };
  const slice = candles.slice(-length);
  const channelHigh = Math.max(...highs(slice));
  const channelLow = Math.min(...lows(slice));
  const price = candles[candles.length - 1].close;
  return {
    high: channelHigh,
    low: channelLow,
    positionPercent: channelHigh === channelLow ? 50 : ((price - channelLow) / (channelHigh - channelLow)) * 100
  };
}

function obv(candles: Candle[]) {
  if (candles.length < 2) return null;
  let total = 0;
  for (let index = 1; index < candles.length; index += 1) {
    if (candles[index].close > candles[index - 1].close) total += candles[index].volume;
    else if (candles[index].close < candles[index - 1].close) total -= candles[index].volume;
  }
  return total;
}

function vwap(candles: Candle[], length = 80) {
  const slice = candles.slice(-length);
  const volumeSum = sum(slice.map((candle) => candle.volume));
  if (!volumeSum) return null;
  return slice.reduce((total, candle) => total + ((candle.high + candle.low + candle.close) / 3) * candle.volume, 0) / volumeSum;
}

function cmf(candles: Candle[], length = 20) {
  if (candles.length < length) return null;
  const slice = candles.slice(-length);
  const volumeSum = sum(slice.map((candle) => candle.volume));
  if (!volumeSum) return null;
  const flow = slice.reduce((total, candle) => {
    const range = candle.high - candle.low;
    const multiplier = range === 0 ? 0 : ((candle.close - candle.low) - (candle.high - candle.close)) / range;
    return total + multiplier * candle.volume;
  }, 0);
  return flow / volumeSum;
}

function accumulationDistribution(candles: Candle[]) {
  let total = 0;
  for (const candle of candles) {
    const range = candle.high - candle.low;
    const multiplier = range === 0 ? 0 : ((candle.close - candle.low) - (candle.high - candle.close)) / range;
    total += multiplier * candle.volume;
  }
  return total;
}

function chaikinOscillator(candles: Candle[]) {
  if (candles.length < 12) return null;
  const adlSeries = candles.map((_, index) => accumulationDistribution(candles.slice(0, index + 1)));
  const ema3 = emaSeries(adlSeries, 3);
  const ema10 = emaSeries(adlSeries, 10);
  const latest = last(ema3);
  const signal = last(ema10);
  return latest !== null && signal !== null ? latest - signal : null;
}

function adx(candles: Candle[], length = 14) {
  if (candles.length <= length + 1) return null;
  const plusDm: number[] = [];
  const minusDm: number[] = [];
  const ranges: number[] = [];

  for (let index = 1; index < candles.length; index += 1) {
    const upMove = candles[index].high - candles[index - 1].high;
    const downMove = candles[index - 1].low - candles[index].low;
    plusDm.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDm.push(downMove > upMove && downMove > 0 ? downMove : 0);
    ranges.push(trueRange(candles[index], candles[index - 1].close));
  }

  const smoothedTr = last(wilderSeries(ranges, length));
  const smoothedPlus = last(wilderSeries(plusDm, length));
  const smoothedMinus = last(wilderSeries(minusDm, length));
  if (!smoothedTr || smoothedPlus === null || smoothedMinus === null) return null;
  const plusDi = (smoothedPlus / smoothedTr) * 100;
  const minusDi = (smoothedMinus / smoothedTr) * 100;
  const dx = plusDi + minusDi === 0 ? 0 : (Math.abs(plusDi - minusDi) / (plusDi + minusDi)) * 100;
  return { adx: dx, plusDi, minusDi };
}

function ichimoku(candles: Candle[]) {
  if (candles.length < 52) {
    return { tenkan: null, kijun: null, senkouA: null, senkouB: null, score: 50, description: "일목균형표 계산을 위한 캔들이 부족합니다." };
  }
  const tenkan = midpoint(candles.slice(-9));
  const kijun = midpoint(candles.slice(-26));
  const senkouB = midpoint(candles.slice(-52));
  const senkouA = tenkan !== null && kijun !== null ? (tenkan + kijun) / 2 : null;
  const price = candles[candles.length - 1].close;
  const cloudTop = Math.max(senkouA ?? price, senkouB ?? price);
  const cloudBottom = Math.min(senkouA ?? price, senkouB ?? price);
  const score = price > cloudTop && tenkan !== null && kijun !== null && tenkan > kijun ? 78 : price < cloudBottom && tenkan !== null && kijun !== null && tenkan < kijun ? 22 : 50;
  const description =
    score > 60
      ? "가격이 구름대 위에 있고 전환선이 기준선을 상회해 추세 우위가 강합니다."
      : score < 40
        ? "가격이 구름대 아래에 있고 전환선이 기준선을 하회해 하락 우위가 강합니다."
        : "가격이 구름대 내부 또는 경계에 있어 방향 확인이 필요합니다.";
  return { tenkan, kijun, senkouA, senkouB, score, description };
}

function supertrend(candles: Candle[], length = 10, multiplier = 3) {
  const atrValues = atrSeries(candles, length);
  if (candles.length < length + 2 || !atrValues.length) return { direction: "neutral" as const, value: null, score: 50 };
  let trend: "bullish" | "bearish" = candles[length].close >= candles[length - 1].close ? "bullish" : "bearish";
  let finalUpper = 0;
  let finalLower = 0;
  let trendValue = candles[candles.length - 1].close;

  for (let index = length; index < candles.length; index += 1) {
    const atrValue = atrValues[index] ?? atrValues[atrValues.length - 1];
    const hl2 = (candles[index].high + candles[index].low) / 2;
    const basicUpper = hl2 + multiplier * atrValue;
    const basicLower = hl2 - multiplier * atrValue;
    finalUpper = index === length ? basicUpper : basicUpper < finalUpper || candles[index - 1].close > finalUpper ? basicUpper : finalUpper;
    finalLower = index === length ? basicLower : basicLower > finalLower || candles[index - 1].close < finalLower ? basicLower : finalLower;

    if (trend === "bearish" && candles[index].close > finalUpper) trend = "bullish";
    else if (trend === "bullish" && candles[index].close < finalLower) trend = "bearish";
    trendValue = trend === "bullish" ? finalLower : finalUpper;
  }

  return { direction: trend, value: trendValue, score: trend === "bullish" ? 72 : 28 };
}

function parabolicSar(candles: Candle[]) {
  if (candles.length < 20) return { sar: null, direction: "neutral" as const, score: 50 };
  let bullish = candles[1].close >= candles[0].close;
  let acceleration = 0.02;
  let extreme = bullish ? candles[1].high : candles[1].low;
  let sar = bullish ? candles[0].low : candles[0].high;

  for (let index = 2; index < candles.length; index += 1) {
    sar = sar + acceleration * (extreme - sar);
    if (bullish) {
      sar = Math.min(sar, candles[index - 1].low, candles[index - 2].low);
      if (candles[index].low < sar) {
        bullish = false;
        sar = extreme;
        extreme = candles[index].low;
        acceleration = 0.02;
      } else if (candles[index].high > extreme) {
        extreme = candles[index].high;
        acceleration = Math.min(acceleration + 0.02, 0.2);
      }
    } else {
      sar = Math.max(sar, candles[index - 1].high, candles[index - 2].high);
      if (candles[index].high > sar) {
        bullish = true;
        sar = extreme;
        extreme = candles[index].high;
        acceleration = 0.02;
      } else if (candles[index].low < extreme) {
        extreme = candles[index].low;
        acceleration = Math.min(acceleration + 0.02, 0.2);
      }
    }
  }

  return { sar, direction: bullish ? "bullish" as const : "bearish" as const, score: bullish ? 66 : 34 };
}

function aroon(candles: Candle[], length = 25) {
  if (candles.length < length) return { up: null, down: null, score: 50 };
  const slice = candles.slice(-length);
  const highest = Math.max(...highs(slice));
  const lowest = Math.min(...lows(slice));
  const highIndex = slice.findIndex((candle) => candle.high === highest);
  const lowIndex = slice.findIndex((candle) => candle.low === lowest);
  const periodsSinceHigh = slice.length - 1 - highIndex;
  const periodsSinceLow = slice.length - 1 - lowIndex;
  const up = ((length - periodsSinceHigh) / length) * 100;
  const down = ((length - periodsSinceLow) / length) * 100;
  return { up, down, score: up > down ? 62 + (up - down) / 4 : 38 - (down - up) / 4 };
}

function detectPatterns(candles: Candle[]) {
  if (candles.length < 3) return [];
  const latest = candles[candles.length - 1];
  const previous = candles[candles.length - 2];
  const third = candles[candles.length - 3];
  const patterns: CandlestickPattern[] = [];
  const body = Math.abs(latest.close - latest.open);
  const range = latest.high - latest.low || 1;
  const upperWick = latest.high - Math.max(latest.open, latest.close);
  const lowerWick = Math.min(latest.open, latest.close) - latest.low;
  const latestBull = latest.close > latest.open;
  const previousBear = previous.close < previous.open;
  const previousBull = previous.close > previous.open;

  if (body / range <= 0.1) {
    patterns.push({
      name: "Doji",
      tone: "neutral",
      confidence: 58,
      description: "몸통이 작아 매수와 매도 힘이 충돌하고 있습니다.",
      detectedAt: latest.time
    });
  }

  if (latestBull && previousBear && latest.close > previous.open && latest.open <= previous.close) {
    patterns.push({
      name: "Bullish Engulfing",
      tone: "bullish",
      confidence: 72,
      description: "직전 음봉을 양봉이 감싸며 단기 매수 반응이 커졌습니다.",
      detectedAt: latest.time
    });
  }

  if (!latestBull && previousBull && latest.close < previous.open && latest.open >= previous.close) {
    patterns.push({
      name: "Bearish Engulfing",
      tone: "bearish",
      confidence: 72,
      description: "직전 양봉을 음봉이 감싸며 단기 매도 압력이 커졌습니다.",
      detectedAt: latest.time
    });
  }

  if (lowerWick > body * 2 && upperWick < body * 1.2 && latestBull) {
    patterns.push({
      name: "Hammer",
      tone: "bullish",
      confidence: 64,
      description: "아래꼬리가 길어 저가 매수 반응이 확인됩니다.",
      detectedAt: latest.time
    });
  }

  if (upperWick > body * 2 && lowerWick < body * 1.2 && !latestBull) {
    patterns.push({
      name: "Shooting Star",
      tone: "bearish",
      confidence: 64,
      description: "윗꼬리가 길어 고가 매도 반응이 확인됩니다.",
      detectedAt: latest.time
    });
  }

  if (third.close < third.open && body / range > 0.35 && latest.close > (third.open + third.close) / 2 && latestBull) {
    patterns.push({
      name: "Morning Star",
      tone: "bullish",
      confidence: 68,
      description: "하락 후 반등 캔들이 나오며 단기 전환 가능성이 생겼습니다.",
      detectedAt: latest.time
    });
  }

  if (third.close > third.open && body / range > 0.35 && latest.close < (third.open + third.close) / 2 && !latestBull) {
    patterns.push({
      name: "Evening Star",
      tone: "bearish",
      confidence: 68,
      description: "상승 후 매도 캔들이 나오며 단기 조정 가능성이 생겼습니다.",
      detectedAt: latest.time
    });
  }

  return patterns.sort((a, b) => b.confidence - a.confidence).slice(0, 4);
}

function nearestSupportResistance(candles: Candle[], price: number) {
  const slice = candles.slice(-160);
  const pivotLows: number[] = [];
  const pivotHighs: number[] = [];

  for (let index = 2; index < slice.length - 2; index += 1) {
    const current = slice[index];
    if (current.low <= slice[index - 1].low && current.low <= slice[index - 2].low && current.low <= slice[index + 1].low && current.low <= slice[index + 2].low) {
      pivotLows.push(current.low);
    }
    if (current.high >= slice[index - 1].high && current.high >= slice[index - 2].high && current.high >= slice[index + 1].high && current.high >= slice[index + 2].high) {
      pivotHighs.push(current.high);
    }
  }

  const support = pivotLows.filter((value) => value < price).sort((a, b) => b - a)[0] ?? Math.min(...lows(slice));
  const resistance = pivotHighs.filter((value) => value > price).sort((a, b) => a - b)[0] ?? Math.max(...highs(slice));

  return {
    support,
    resistance,
    supportDistancePercent: support ? ((price - support) / price) * 100 : null,
    resistanceDistancePercent: resistance ? ((resistance - price) / price) * 100 : null
  };
}

function fibonacci(candles: Candle[], price: number) {
  const slice = candles.slice(-160);
  if (slice.length < 20) {
    return { low: null, high: null, positionPercent: null, levels: [] };
  }

  const high = Math.max(...highs(slice));
  const low = Math.min(...lows(slice));
  const range = high - low;
  if (!range) return { low, high, positionPercent: 50, levels: [] };

  const ratios = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  return {
    low,
    high,
    positionPercent: clamp(((price - low) / range) * 100),
    levels: ratios.map((ratio) => ({
      label: `${(ratio * 100).toFixed(ratio === 0 || ratio === 1 ? 0 : 1)}%`,
      ratio,
      price: high - range * ratio
    }))
  };
}

function toneFromScore(score: number): TechnicalTone {
  if (score >= 63) return "bullish";
  if (score <= 37) return "bearish";
  if (score >= 55 || score <= 45) return "warning";
  return "neutral";
}

function reading(label: string, value: string, score: number, description: string, tone?: TechnicalTone): IndicatorReading {
  return {
    label,
    value,
    score: clamp(score),
    tone: tone ?? toneFromScore(score),
    description
  };
}

function fearGreedLabel(score: number) {
  if (score >= 80) return "극단적 탐욕";
  if (score >= 65) return "탐욕";
  if (score >= 55) return "약한 탐욕";
  if (score > 45) return "중립";
  if (score > 35) return "약한 공포";
  if (score > 20) return "공포";
  return "극단적 공포";
}

function scoreOverbought(value: number | null, lower: number, upper: number) {
  if (value === null) return 50;
  if (value >= upper) return 58;
  if (value <= lower) return 42;
  return clamp(value);
}

export function analyzeTechnicalRadar(candles: Candle[]): TechnicalRadarReport {
  if (candles.length < 60) return emptyReport;

  const price = candles[candles.length - 1].close;
  const closeValues = closes(candles);
  const volumeValues = volumes(candles);
  const sma5 = sma(closeValues, 5);
  const sma20 = sma(closeValues, 20);
  const sma60 = sma(closeValues, 60);
  const sma120 = sma(closeValues, 120);
  const ema10 = last(emaSeries(closeValues, 10));
  const ema30 = last(emaSeries(closeValues, 30));
  const ema50 = last(emaSeries(closeValues, 50));
  const ema200 = closeValues.length >= 200 ? last(emaSeries(closeValues, 200)) : null;
  const macdValue = macd(closeValues);
  const adxValue = adx(candles);
  const ichimokuValue = ichimoku(candles);
  const supertrendValue = supertrend(candles);
  const sarValue = parabolicSar(candles);
  const aroonValue = aroon(candles);
  const rsi14 = rsi(closeValues);
  const stochasticValue = stochastic(candles);
  const cci20 = cci(candles);
  const mfi14 = mfi(candles);
  const williams = williamsR(candles);
  const roc12 = roc(closeValues);
  const momentum10 = momentum(closeValues);
  const ultimate = ultimateOscillator(candles);
  const atr14 = atr(candles);
  const atrPercent = atr14 ? (atr14 / price) * 100 : null;
  const bands = bollinger(closeValues);
  const keltnerValue = keltner(candles);
  const donchianValue = donchian(candles);
  const obvValue = obv(candles);
  const volumeMa20 = sma(volumeValues, 20);
  const currentVolume = candles[candles.length - 1].volume;
  const volumeRatio = volumeMa20 ? currentVolume / volumeMa20 : null;
  const vwapValue = vwap(candles);
  const cmf20 = cmf(candles);
  const adlValue = accumulationDistribution(candles);
  const chaikinValue = chaikinOscillator(candles);
  const patterns = detectPatterns(candles);
  const supportResistance = nearestSupportResistance(candles, price);
  const fib = fibonacci(candles, price);

  const trendIndicators = [
    reading(
      "이동평균 정렬",
      `MA5 ${formatNumber(sma5)} / MA20 ${formatNumber(sma20)} / MA60 ${formatNumber(sma60)} / MA120 ${formatNumber(sma120)}`,
      sma5 && sma20 && sma60
        ? price > sma5 && sma5 > sma20 && sma20 > sma60
          ? 84
          : price < sma5 && sma5 < sma20 && sma20 < sma60
            ? 16
            : price > sma20
              ? 60
              : 40
        : 50,
      sma5 && sma20 && sma60 && price > sma20 ? "가격이 주요 이동평균 위에 있어 추세 유지 쪽이 유리합니다." : "이동평균 정렬이 약하거나 가격이 평균 아래에 있어 추세 신뢰도가 낮습니다."
    ),
    reading(
      "지수이동평균",
      `EMA10 ${formatNumber(ema10)} / EMA30 ${formatNumber(ema30)} / EMA50 ${formatNumber(ema50)} / EMA200 ${formatNumber(ema200)}`,
      ema10 && ema30 && ema50
        ? ema10 > ema30 && ema30 > ema50 && price > ema10
          ? 80
          : ema10 < ema30 && ema30 < ema50 && price < ema10
            ? 20
            : ema10 > ema30
              ? 60
              : 40
        : 50,
      ema10 && ema30 && ema10 > ema30 ? "단기 EMA가 장기 EMA 위에 있어 단기 추세가 살아 있습니다." : "EMA 기준으로는 추세가 약하거나 하락 쪽 압력이 남아 있습니다."
    ),
    reading(
      "MACD",
      `Line ${formatNumber(macdValue.line)} / Signal ${formatNumber(macdValue.signal)} / Hist ${formatNumber(macdValue.histogram)}`,
      macdValue.histogram !== null ? (macdValue.histogram > 0 ? 72 : 28) : 50,
      macdValue.histogram !== null && macdValue.histogram > 0 ? "MACD 히스토그램이 양수라 상승 모멘텀이 우세합니다." : "MACD 히스토그램이 약해 하락 또는 모멘텀 둔화가 보입니다."
    ),
    reading(
      "ADX / DMI",
      `ADX ${formatNumber(adxValue?.adx)} / +DI ${formatNumber(adxValue?.plusDi)} / -DI ${formatNumber(adxValue?.minusDi)}`,
      adxValue ? (adxValue.plusDi > adxValue.minusDi ? 61 + Math.min(18, adxValue.adx / 2.5) : 39 - Math.min(18, adxValue.adx / 2.5)) : 50,
      adxValue && adxValue.adx >= 25 ? "추세 강도가 의미 있게 올라와 방향성이 유지될 수 있습니다." : "ADX 기준 추세 강도는 아직 강하다고 보기 어렵습니다."
    ),
    reading(
      "일목균형표",
      `전환 ${formatNumber(ichimokuValue.tenkan)} / 기준 ${formatNumber(ichimokuValue.kijun)} / 구름A ${formatNumber(ichimokuValue.senkouA)} / 구름B ${formatNumber(ichimokuValue.senkouB)}`,
      ichimokuValue.score,
      ichimokuValue.description
    ),
    reading(
      "Supertrend",
      `${supertrendValue.direction === "bullish" ? "상승 추세" : supertrendValue.direction === "bearish" ? "하락 추세" : "중립"} / 기준 ${formatNumber(supertrendValue.value)}`,
      supertrendValue.score,
      supertrendValue.direction === "bullish" ? "Supertrend 기준으로 상승 방향이 유지되고 있습니다." : supertrendValue.direction === "bearish" ? "Supertrend 기준으로 하락 방향이 유지되고 있습니다." : "Supertrend 계산을 위한 데이터가 부족합니다."
    ),
    reading(
      "Parabolic SAR",
      `SAR ${formatNumber(sarValue.sar)}`,
      sarValue.score,
      sarValue.direction === "bullish" ? "가격이 SAR 위에 있어 단기 추세 추종 매수가 우위입니다." : sarValue.direction === "bearish" ? "가격이 SAR 아래에 있어 단기 추세 추종 매도가 우위입니다." : "SAR 기준 방향 확인이 어렵습니다."
    ),
    reading(
      "Aroon",
      `Up ${formatNumber(aroonValue.up, 1)} / Down ${formatNumber(aroonValue.down, 1)}`,
      aroonValue.score,
      aroonValue.up !== null && aroonValue.down !== null && aroonValue.up > aroonValue.down ? "최근 고점 갱신 쪽이 더 가까워 상승 추세 지속 가능성이 있습니다." : "최근 저점 갱신 쪽이 더 가까워 하락 압력이 남아 있습니다."
    )
  ];

  const momentumIndicators = [
    reading(
      "RSI 14",
      formatNumber(rsi14, 1),
      scoreOverbought(rsi14, 30, 70),
      rsi14 !== null && rsi14 >= 70 ? "과열권에 가까워 추세는 강하지만 조정 가능성도 같이 봐야 합니다." : rsi14 !== null && rsi14 <= 30 ? "과매도권에 가까워 반등 시도와 추가 하락을 함께 확인해야 합니다." : "RSI는 중립 구간에서 방향성을 확인 중입니다.",
      rsi14 !== null && (rsi14 >= 70 || rsi14 <= 30) ? "warning" : undefined
    ),
    reading(
      "Stochastic",
      `%K ${formatNumber(stochasticValue.k, 1)} / %D ${formatNumber(stochasticValue.d, 1)}`,
      stochasticValue.k === null || stochasticValue.d === null ? 50 : stochasticValue.k > stochasticValue.d ? 64 : 36,
      stochasticValue.k !== null && stochasticValue.k >= 80 ? "단기 과열권입니다. 추격보다 눌림 확인이 중요합니다." : stochasticValue.k !== null && stochasticValue.k <= 20 ? "단기 과매도권입니다. 반등 시도 여부가 중요합니다." : "Stochastic은 중립권에서 단기 방향을 확인 중입니다.",
      stochasticValue.k !== null && (stochasticValue.k >= 80 || stochasticValue.k <= 20) ? "warning" : undefined
    ),
    reading(
      "CCI 20",
      formatNumber(cci20, 1),
      cci20 === null ? 50 : cci20 > 100 ? 72 : cci20 < -100 ? 28 : 50 + cci20 / 8,
      cci20 !== null && cci20 > 100 ? "CCI가 강한 상승 모멘텀을 가리킵니다." : cci20 !== null && cci20 < -100 ? "CCI가 강한 하락 모멘텀을 가리킵니다." : "CCI는 중립권에서 힘을 모으는 중입니다."
    ),
    reading(
      "MFI 14",
      formatNumber(mfi14, 1),
      scoreOverbought(mfi14, 20, 80),
      mfi14 !== null && mfi14 >= 80 ? "자금 흐름이 과열권입니다." : mfi14 !== null && mfi14 <= 20 ? "자금 흐름이 과매도권입니다." : "자금 흐름은 중립권에서 움직이고 있습니다.",
      mfi14 !== null && (mfi14 >= 80 || mfi14 <= 20) ? "warning" : undefined
    ),
    reading(
      "Williams %R",
      formatNumber(williams, 1),
      williams === null ? 50 : williams > -20 ? 60 : williams < -80 ? 40 : 50,
      williams !== null && williams > -20 ? "단기 과열권에 가까워 조정 가능성을 함께 봐야 합니다." : williams !== null && williams < -80 ? "단기 과매도권에 가까워 반등 가능성을 함께 봐야 합니다." : "Williams %R은 중립권에서 움직이고 있습니다.",
      williams !== null && (williams > -20 || williams < -80) ? "warning" : undefined
    ),
    reading(
      "ROC 12",
      formatPercent(roc12, 2),
      roc12 === null ? 50 : roc12 > 0 ? 62 + Math.min(18, roc12) : 38 - Math.min(18, Math.abs(roc12)),
      roc12 !== null && roc12 > 0 ? "가격 변화율이 양수라 상승 속도가 남아 있습니다." : "가격 변화율이 음수라 하락 속도 또는 둔화가 보입니다."
    ),
    reading(
      "Momentum 10",
      formatNumber(momentum10),
      momentum10 === null ? 50 : momentum10 > 0 ? 64 : 36,
      momentum10 !== null && momentum10 > 0 ? "현재가가 10봉 전보다 높아 단기 모멘텀이 우세합니다." : "현재가가 10봉 전보다 낮아 단기 모멘텀이 약합니다."
    ),
    reading(
      "Ultimate Oscillator",
      formatNumber(ultimate, 1),
      ultimate === null ? 50 : ultimate,
      ultimate !== null && ultimate >= 70 ? "복합 모멘텀이 과열권에 가까워 조정 가능성도 열어둬야 합니다." : ultimate !== null && ultimate <= 30 ? "복합 모멘텀이 과매도권에 가까워 반등 가능성도 열어둬야 합니다." : "복합 모멘텀은 중립권에서 움직이고 있습니다.",
      ultimate !== null && (ultimate >= 70 || ultimate <= 30) ? "warning" : undefined
    )
  ];

  const volatilityIndicators = [
    reading(
      "ATR 14",
      `${formatNumber(atr14)} / ${formatPercent(atrPercent)}`,
      atrPercent === null ? 50 : atrPercent >= 3 ? 68 : atrPercent <= 0.7 ? 42 : 52,
      atrPercent !== null && atrPercent >= 3 ? "변동성이 커져 손절과 포지션 크기를 보수적으로 봐야 합니다." : "변동성은 비교적 일반적인 범위입니다.",
      atrPercent !== null && atrPercent >= 3 ? "warning" : undefined
    ),
    reading(
      "Bollinger Bands",
      `상단 ${formatNumber(bands.upper)} / 중단 ${formatNumber(bands.middle)} / 하단 ${formatNumber(bands.lower)} / 폭 ${formatPercent(bands.widthPercent)}`,
      bands.positionPercent === null ? 50 : bands.positionPercent >= 80 ? 62 : bands.positionPercent <= 20 ? 38 : 50,
      bands.positionPercent !== null && bands.positionPercent >= 80 ? "상단 밴드에 가까워 과열 여부를 확인해야 합니다." : bands.positionPercent !== null && bands.positionPercent <= 20 ? "하단 밴드에 가까워 매도 과열 여부를 확인해야 합니다." : "현재가는 볼린저밴드 중간권에 있습니다.",
      bands.positionPercent !== null && (bands.positionPercent >= 80 || bands.positionPercent <= 20) ? "warning" : undefined
    ),
    reading(
      "Keltner Channel",
      `상단 ${formatNumber(keltnerValue.upper)} / 중심 ${formatNumber(keltnerValue.middle)} / 하단 ${formatNumber(keltnerValue.lower)}`,
      keltnerValue.positionPercent === null ? 50 : keltnerValue.positionPercent >= 80 ? 62 : keltnerValue.positionPercent <= 20 ? 38 : 50,
      keltnerValue.positionPercent !== null && keltnerValue.positionPercent >= 80 ? "켈트너 상단권으로 추세는 강하지만 눌림 위험도 있습니다." : keltnerValue.positionPercent !== null && keltnerValue.positionPercent <= 20 ? "켈트너 하단권으로 매도 압력이 커졌습니다." : "켈트너 채널 기준으로는 중간권입니다.",
      keltnerValue.positionPercent !== null && (keltnerValue.positionPercent >= 80 || keltnerValue.positionPercent <= 20) ? "warning" : undefined
    ),
    reading(
      "Donchian Channel",
      `상단 ${formatNumber(donchianValue.high)} / 하단 ${formatNumber(donchianValue.low)} / 위치 ${formatPercent(donchianValue.positionPercent)}`,
      donchianValue.positionPercent === null ? 50 : donchianValue.positionPercent >= 70 ? 68 : donchianValue.positionPercent <= 30 ? 32 : 50,
      donchianValue.positionPercent !== null && donchianValue.positionPercent >= 70 ? "최근 가격 범위 상단에 가까워 돌파 또는 고점 추격 여부를 봐야 합니다." : donchianValue.positionPercent !== null && donchianValue.positionPercent <= 30 ? "최근 가격 범위 하단에 가까워 이탈 또는 저점 반등 여부를 봐야 합니다." : "Donchian 범위 중간권입니다."
    )
  ];

  const volumeIndicators = [
    reading(
      "OBV",
      formatNumber(obvValue, 0),
      obvValue === null ? 50 : obvValue > 0 ? 66 : 34,
      obvValue !== null && obvValue > 0 ? "OBV가 누적 매수 우위를 가리킵니다." : "OBV가 누적 매도 우위 또는 둔화를 가리킵니다."
    ),
    reading(
      "Volume MA",
      `현재 ${formatNumber(currentVolume, 0)} / VMA20 ${formatNumber(volumeMa20, 0)} / ${formatNumber(volumeRatio, 2)}x`,
      volumeRatio === null ? 50 : volumeRatio >= 1.5 ? 68 : volumeRatio <= 0.7 ? 42 : 50,
      volumeRatio !== null && volumeRatio >= 1.5 ? "평균보다 거래량이 높아 움직임의 신뢰도가 높아졌습니다." : "거래량은 평균 수준이거나 다소 약합니다.",
      volumeRatio !== null && volumeRatio >= 1.5 ? "warning" : undefined
    ),
    reading(
      "VWAP",
      formatNumber(vwapValue),
      vwapValue === null ? 50 : price >= vwapValue ? 66 : 34,
      vwapValue !== null && price >= vwapValue ? "현재가가 VWAP 위에 있어 매수 평균 가격보다 강합니다." : "현재가가 VWAP 아래에 있어 매도 압력이 남아 있습니다."
    ),
    reading(
      "CMF 20",
      formatNumber(cmf20, 3),
      cmf20 === null ? 50 : cmf20 > 0.05 ? 66 : cmf20 < -0.05 ? 34 : 50,
      cmf20 !== null && cmf20 > 0.05 ? "Chaikin 자금 흐름이 양수라 매수 유입이 우세합니다." : cmf20 !== null && cmf20 < -0.05 ? "Chaikin 자금 흐름이 음수라 매도 유출이 우세합니다." : "자금 흐름은 균형권입니다."
    ),
    reading(
      "A/D Line",
      formatNumber(adlValue, 0),
      adlValue > 0 ? 62 : 38,
      adlValue > 0 ? "누적 매집 흐름이 더 강하게 계산됩니다." : "누적 분산 흐름이 더 강하게 계산됩니다."
    ),
    reading(
      "Chaikin Oscillator",
      formatNumber(chaikinValue, 0),
      chaikinValue === null ? 50 : chaikinValue > 0 ? 64 : 36,
      chaikinValue !== null && chaikinValue > 0 ? "단기 자금 유입 속도가 장기 흐름보다 강합니다." : "단기 자금 유입 속도가 약하거나 유출 쪽입니다."
    )
  ];

  const allReadings = [...trendIndicators, ...momentumIndicators, ...volatilityIndicators, ...volumeIndicators];
  const bullishCount = allReadings.filter((item) => item.tone === "bullish").length;
  const bearishCount = allReadings.filter((item) => item.tone === "bearish").length;
  const neutralCount = allReadings.length - bullishCount - bearishCount;
  const averageScore = average(allReadings.map((item) => item.score)) ?? 50;
  const greedScore = clamp(
    averageScore +
      (volumeRatio !== null ? clamp((volumeRatio - 1) * 8, -8, 8) : 0) +
      (bands.positionPercent !== null ? clamp((bands.positionPercent - 50) / 8, -8, 8) : 0)
  );
  const fearGreed = {
    score: Math.round(greedScore),
    label: fearGreedLabel(greedScore),
    description:
      greedScore >= 65
        ? "매수 심리가 강한 편입니다. 다만 과열권에서는 추격보다 조정 후 반응 확인이 중요합니다."
        : greedScore <= 35
          ? "위험 회피 심리가 강한 편입니다. 반등보다 지지 이탈 여부를 먼저 확인해야 합니다."
          : "심리는 중립권입니다. 방향성보다 지지와 저항 반응 확인이 우선입니다."
  };

  const trendLabel = averageScore >= 70 ? "강한 상승" : averageScore >= 58 ? "상승 우위" : averageScore <= 30 ? "강한 하락" : averageScore <= 42 ? "하락 우위" : "횡보";
  const momentumLabel =
    bullishCount > bearishCount + 3
      ? "상승 지속 가능성"
      : bearishCount > bullishCount + 3
        ? "하락 지속 가능성"
        : "방향 확인 필요";

  return {
    price,
    trendLabel,
    momentumLabel,
    bullishCount,
    bearishCount,
    neutralCount,
    fearGreed,
    supportResistance,
    candlestickPatterns: patterns,
    trendIndicators,
    momentumIndicators,
    volatilityIndicators,
    volumeIndicators,
    fibonacci: fib,
    summary: `기술지표 기준으로는 ${trendLabel}에 가깝고, 모멘텀은 ${momentumLabel}입니다. 과열, 거래량, 평균 회귀 위험을 빠르게 확인하는 기술지표 판독으로 활용하세요.`
  };
}
