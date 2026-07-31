export const tradeQualityEvaluationVersion = "market_context_v1" as const;

export type TradeQualityTimeframe = "1m" | "5m" | "15m" | "1h" | "4h";
export type TradeDurationClass = "ultra_short" | "short" | "intraday" | "swing" | "position";
export type TradeQualityGrade = "a" | "b" | "c" | "d";
export type TradeSignificance = "meaningful" | "limited" | "noise";
export type TradeQualityConfidence = "high" | "medium" | "low";
export type PostExitConfirmation = "reversal_after_exit" | "continued_after_exit" | "mixed" | "unavailable";

export interface TradeQualityCandle {
  openTimeMs: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradeQualityPosition {
  id: string;
  connectionId: string;
  provider: "okx" | "bybit" | "bitget" | "bingx";
  symbol: string;
  positionSide: "long" | "short";
  openedAt: string;
  closedAt: string;
  quantityBase: string;
  averageEntryPrice: string;
  averageExitPrice: string;
  realizedPnl: string;
  feeTotal: string;
  fundingTotal: string;
  netPnl: string;
  exitReason: "trade" | "liquidation" | "adl" | "delivery";
  fillCount: number;
}

export interface TradeQualityCoverage {
  ratio: number;
  expectedBars: number;
  observedBars: number;
  maxGapBars: number;
}

export interface TradeQualityAssessment {
  status: "ready" | "insufficient_data";
  evaluationVersion: typeof tradeQualityEvaluationVersion;
  confidence: TradeQualityConfidence;
  primaryTimeframe: TradeQualityTimeframe;
  contextTimeframe: Exclude<TradeQualityTimeframe, "1m"> | "1d";
  holdingSeconds: number;
  durationClass: TradeDurationClass;
  entryScore: number | null;
  entryGrade: TradeQualityGrade | null;
  exitScore: number | null;
  exitGrade: TradeQualityGrade | null;
  significance: TradeSignificance | null;
  postExitConfirmation: PostExitConfirmation;
  atrAtEntry: number | null;
  entryRangePosition: number | null;
  entryExtensionAtr: number | null;
  mfePricePct: number | null;
  maePricePct: number | null;
  mfeAtr: number | null;
  maeAtr: number | null;
  captureRatio: number | null;
  givebackRatio: number | null;
  costShare: number | null;
  entryReasons: string[];
  exitReasons: string[];
  significanceReasons: string[];
  warnings: string[];
  coverage: TradeQualityCoverage;
}

const timeframeMs: Record<TradeQualityTimeframe | "1d", number> = {
  "1m": 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "1d": 24 * 60 * 60_000
};

const contextByPrimary: Record<TradeQualityTimeframe, TradeQualityAssessment["contextTimeframe"]> = {
  "1m": "5m",
  "5m": "15m",
  "15m": "1h",
  "1h": "4h",
  "4h": "1d"
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function finiteNumber(value: string | number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function round(value: number | null, digits = 6) {
  if (value === null || !Number.isFinite(value)) return null;
  const power = 10 ** digits;
  return Math.round(value * power) / power;
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function scoreGrade(score: number): TradeQualityGrade {
  if (score >= 80) return "a";
  if (score >= 65) return "b";
  if (score >= 45) return "c";
  return "d";
}

function trueRange(current: TradeQualityCandle, previousClose: number) {
  return Math.max(
    current.high - current.low,
    Math.abs(current.high - previousClose),
    Math.abs(current.low - previousClose)
  );
}

function atr(candles: TradeQualityCandle[], length = 14) {
  if (candles.length < length + 1) return null;
  const slice = candles.slice(-(length + 1));
  const ranges = slice.slice(1).map((candle, index) => trueRange(candle, slice[index].close));
  return ranges.reduce((sum, value) => sum + value, 0) / ranges.length;
}

function ema(values: number[], length: number) {
  if (values.length < length) return null;
  const multiplier = 2 / (length + 1);
  let value = values.slice(0, length).reduce((sum, item) => sum + item, 0) / length;
  for (const item of values.slice(length)) value = item * multiplier + value * (1 - multiplier);
  return value;
}

function validCandles(candles: TradeQualityCandle[]) {
  return Array.from(
    new Map(
      candles
        .filter((candle) =>
          Number.isFinite(candle.openTimeMs) &&
          Number.isFinite(candle.open) &&
          Number.isFinite(candle.high) &&
          Number.isFinite(candle.low) &&
          Number.isFinite(candle.close) &&
          Number.isFinite(candle.volume) &&
          candle.openTimeMs > 0 &&
          candle.open > 0 &&
          candle.high >= Math.max(candle.open, candle.close) &&
          candle.low <= Math.min(candle.open, candle.close)
        )
        .map((candle) => [candle.openTimeMs, candle] as const)
    ).values()
  ).sort((left, right) => left.openTimeMs - right.openTimeMs);
}

function aggregateCandles(
  candles: TradeQualityCandle[],
  primaryMs: number,
  targetMs: number
) {
  const factor = targetMs / primaryMs;
  if (!Number.isInteger(factor) || factor <= 1) return candles;
  const buckets = new Map<number, TradeQualityCandle[]>();
  for (const candle of candles) {
    const bucket = Math.floor(candle.openTimeMs / targetMs) * targetMs;
    const values = buckets.get(bucket) ?? [];
    values.push(candle);
    buckets.set(bucket, values);
  }
  const result: TradeQualityCandle[] = [];
  for (const [bucket, values] of Array.from(buckets.entries())) {
    values.sort((left, right) => left.openTimeMs - right.openTimeMs);
    if (
      values.length !== factor ||
      values[0]?.openTimeMs !== bucket ||
      values.at(-1)!.openTimeMs + primaryMs !== bucket + targetMs
    ) {
      continue;
    }
    result.push({
      openTimeMs: bucket,
      open: values[0].open,
      high: Math.max(...values.map((value) => value.high)),
      low: Math.min(...values.map((value) => value.low)),
      close: values.at(-1)!.close,
      volume: values.reduce((sum, value) => sum + value.volume, 0)
    });
  }
  return result.sort((left, right) => left.openTimeMs - right.openTimeMs);
}

function trendState(candles: TradeQualityCandle[]) {
  const closes = candles.map((candle) => candle.close);
  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  const priorEma20 = ema(closes.slice(0, -5), 20);
  if (ema20 === null || ema50 === null || priorEma20 === null) {
    return { ema20, ema50, direction: "unknown" as const };
  }
  const slope = ema20 - priorEma20;
  if (ema20 > ema50 && slope > 0) return { ema20, ema50, direction: "up" as const };
  if (ema20 < ema50 && slope < 0) return { ema20, ema50, direction: "down" as const };
  return { ema20, ema50, direction: "flat" as const };
}

function emptyAssessment(
  primaryTimeframe: TradeQualityTimeframe,
  holdingSeconds: number,
  durationClass: TradeDurationClass,
  coverage: TradeQualityCoverage,
  warnings: string[]
): TradeQualityAssessment {
  return {
    status: "insufficient_data",
    evaluationVersion: tradeQualityEvaluationVersion,
    confidence: "low",
    primaryTimeframe,
    contextTimeframe: contextByPrimary[primaryTimeframe],
    holdingSeconds,
    durationClass,
    entryScore: null,
    entryGrade: null,
    exitScore: null,
    exitGrade: null,
    significance: null,
    postExitConfirmation: "unavailable",
    atrAtEntry: null,
    entryRangePosition: null,
    entryExtensionAtr: null,
    mfePricePct: null,
    maePricePct: null,
    mfeAtr: null,
    maeAtr: null,
    captureRatio: null,
    givebackRatio: null,
    costShare: null,
    entryReasons: [],
    exitReasons: [],
    significanceReasons: [],
    warnings: unique(warnings),
    coverage
  };
}

export function classifyTradeDuration(holdingSeconds: number): TradeDurationClass {
  if (holdingSeconds < 15 * 60) return "ultra_short";
  if (holdingSeconds < 4 * 60 * 60) return "short";
  if (holdingSeconds < 24 * 60 * 60) return "intraday";
  if (holdingSeconds < 7 * 24 * 60 * 60) return "swing";
  return "position";
}

export function tradeQualityTimeframeForHoldingSeconds(holdingSeconds: number): TradeQualityTimeframe {
  const durationClass = classifyTradeDuration(holdingSeconds);
  if (durationClass === "ultra_short") return "1m";
  if (durationClass === "short") return "5m";
  if (durationClass === "intraday") return "15m";
  if (durationClass === "swing") return "1h";
  return "4h";
}

export function tradeQualityTimeframeMilliseconds(timeframe: TradeQualityTimeframe | "1d") {
  return timeframeMs[timeframe];
}

export function evaluateTradeQuality(input: {
  position: TradeQualityPosition;
  candles: TradeQualityCandle[];
  coverage: TradeQualityCoverage;
}): TradeQualityAssessment {
  const openedAtMs = Date.parse(input.position.openedAt);
  const closedAtMs = Date.parse(input.position.closedAt);
  const holdingSeconds = Math.max(0, Math.floor((closedAtMs - openedAtMs) / 1000));
  const durationClass = classifyTradeDuration(holdingSeconds);
  const primaryTimeframe = tradeQualityTimeframeForHoldingSeconds(holdingSeconds);
  const primaryMs = timeframeMs[primaryTimeframe];
  const contextTimeframe = contextByPrimary[primaryTimeframe];
  const contextMs = timeframeMs[contextTimeframe];
  const candles = validCandles(input.candles);
  const warnings: string[] = [];

  if (
    !Number.isFinite(openedAtMs) ||
    !Number.isFinite(closedAtMs) ||
    closedAtMs <= openedAtMs ||
    input.coverage.ratio < 0.75 ||
    input.coverage.maxGapBars > 3
  ) {
    if (input.coverage.ratio < 0.75) warnings.push("market_coverage_insufficient");
    if (input.coverage.maxGapBars > 3) warnings.push("market_candle_large_gap");
    return emptyAssessment(primaryTimeframe, holdingSeconds, durationClass, input.coverage, warnings);
  }

  const entryPrice = finiteNumber(input.position.averageEntryPrice);
  const exitPrice = finiteNumber(input.position.averageExitPrice);
  const quantity = finiteNumber(input.position.quantityBase);
  if (!entryPrice || !exitPrice || !quantity || entryPrice <= 0 || exitPrice <= 0 || quantity <= 0) {
    return emptyAssessment(primaryTimeframe, holdingSeconds, durationClass, input.coverage, ["position_values_invalid"]);
  }

  const preEntry = candles.filter((candle) => candle.openTimeMs + primaryMs <= openedAtMs);
  const throughExit = candles.filter((candle) => candle.openTimeMs + primaryMs <= closedAtMs);
  const inTrade = candles.filter(
    (candle) => candle.openTimeMs >= openedAtMs && candle.openTimeMs + primaryMs <= closedAtMs
  );
  const postExit = candles.filter((candle) => candle.openTimeMs >= closedAtMs).slice(0, 6);
  const contextCandles = aggregateCandles(candles, primaryMs, contextMs);
  const preEntryContext = contextCandles.filter((candle) => candle.openTimeMs + contextMs <= openedAtMs);
  const entryAtr = atr(preEntry);
  if (preEntry.length < 60 || entryAtr === null || entryAtr <= 0) {
    return emptyAssessment(primaryTimeframe, holdingSeconds, durationClass, input.coverage, [
      "entry_history_insufficient"
    ]);
  }

  const side = input.position.positionSide;
  const direction = side === "long" ? 1 : -1;
  const primaryTrend = trendState(preEntry);
  const contextTrend = trendState(preEntryContext);
  const range = preEntry.slice(-50);
  const rangeHigh = Math.max(...range.map((candle) => candle.high));
  const rangeLow = Math.min(...range.map((candle) => candle.low));
  const rangeSpan = rangeHigh - rangeLow;
  const rawEntryRangePosition = rangeSpan > 0 ? (entryPrice - rangeLow) / rangeSpan : null;
  const entryRangePosition = rawEntryRangePosition === null ? null : clamp(rawEntryRangePosition, 0, 1);
  const supportDistanceAtr = (entryPrice - rangeLow) / entryAtr;
  const resistanceDistanceAtr = (rangeHigh - entryPrice) / entryAtr;
  const trendAligned = side === "long" ? primaryTrend.direction === "up" : primaryTrend.direction === "down";
  const trendCounter = side === "long" ? primaryTrend.direction === "down" : primaryTrend.direction === "up";
  const contextAligned = side === "long" ? contextTrend.direction === "up" : contextTrend.direction === "down";
  const contextCounter = side === "long" ? contextTrend.direction === "down" : contextTrend.direction === "up";
  const breakout = side === "long"
    ? entryPrice >= rangeHigh && entryPrice - rangeHigh <= entryAtr * 0.4
    : entryPrice <= rangeLow && rangeLow - entryPrice <= entryAtr * 0.4;
  const adverseRangeBreak = rawEntryRangePosition !== null && (
    side === "long" ? rawEntryRangePosition < 0 : rawEntryRangePosition > 1
  );
  const favorableLocation = side === "long"
    ? !adverseRangeBreak && (
      (supportDistanceAtr >= 0 && supportDistanceAtr <= 0.5) ||
      (rawEntryRangePosition !== null && rawEntryRangePosition >= 0 && rawEntryRangePosition <= 0.35)
    )
    : !adverseRangeBreak && (
      (resistanceDistanceAtr >= 0 && resistanceDistanceAtr <= 0.5) ||
      (rawEntryRangePosition !== null && rawEntryRangePosition <= 1 && rawEntryRangePosition >= 0.65)
    );
  const unfavorableLocation = side === "long"
    ? rawEntryRangePosition !== null && rawEntryRangePosition >= 0.8 && rawEntryRangePosition <= 1
    : rawEntryRangePosition !== null && rawEntryRangePosition <= 0.2 && rawEntryRangePosition >= 0;
  const entryExtensionAtr = primaryTrend.ema20 === null
    ? null
    : direction * (entryPrice - primaryTrend.ema20) / entryAtr;

  let entryScore = 50;
  const entryReasons: string[] = [];
  if (trendAligned) {
    entryScore += 15;
    entryReasons.push("trend_aligned");
  } else if (trendCounter) {
    entryScore -= 15;
    entryReasons.push("trend_counter");
  } else {
    entryReasons.push("trend_neutral");
  }
  if (contextAligned) {
    entryScore += 8;
    entryReasons.push("higher_timeframe_aligned");
  } else if (contextCounter) {
    entryScore -= 8;
    entryReasons.push("higher_timeframe_counter");
  }
  if (adverseRangeBreak) {
    entryScore -= 25;
    entryReasons.push("entry_beyond_invalidated_range");
  } else if (favorableLocation) {
    entryScore += 14;
    entryReasons.push(side === "long" ? "support_proximity" : "resistance_proximity");
  } else if (unfavorableLocation) {
    entryScore -= 10;
    entryReasons.push("unfavorable_range_location");
  } else {
    entryReasons.push("neutral_range_location");
  }
  if (breakout) {
    entryScore += 12;
    entryReasons.push("controlled_breakout");
  }
  if (entryExtensionAtr !== null && entryExtensionAtr > 1.5) {
    entryScore -= 18;
    entryReasons.push("chasing_extension");
  } else if (entryExtensionAtr !== null && entryExtensionAtr > 1) {
    entryScore -= 8;
    entryReasons.push("entry_extended");
  } else if (entryExtensionAtr !== null && Math.abs(entryExtensionAtr) <= 0.35) {
    entryScore += 4;
    entryReasons.push("ema20_proximity");
  }
  entryScore = Math.round(clamp(entryScore, 0, 100));

  if (inTrade.length === 0) warnings.push("intrabar_order_unknown");
  if (input.position.fillCount > 2) warnings.push("scaled_position_approximation");
  const maximumHigh = Math.max(exitPrice, ...inTrade.map((candle) => candle.high));
  const minimumLow = Math.min(exitPrice, ...inTrade.map((candle) => candle.low));
  const realizedDirectionalMove = direction * (exitPrice - entryPrice);
  const mfePriceMove = Math.max(
    0,
    side === "long" ? maximumHigh - entryPrice : entryPrice - minimumLow,
    realizedDirectionalMove
  );
  const maePriceMove = Math.max(
    0,
    side === "long" ? entryPrice - minimumLow : maximumHigh - entryPrice,
    -realizedDirectionalMove
  );
  const captureRatio = mfePriceMove > 0 && realizedDirectionalMove >= 0
    ? clamp(realizedDirectionalMove / mfePriceMove, 0, 1)
    : null;
  const givebackRatio = mfePriceMove > 0 && realizedDirectionalMove >= 0
    ? clamp((mfePriceMove - realizedDirectionalMove) / mfePriceMove, 0, 2)
    : null;
  const exitHistory = throughExit.slice(-50);
  const exitRangeHigh = exitHistory.length ? Math.max(...exitHistory.map((candle) => candle.high)) : null;
  const exitRangeLow = exitHistory.length ? Math.min(...exitHistory.map((candle) => candle.low)) : null;
  const favorableExitStructure = exitRangeHigh !== null && exitRangeLow !== null
    ? side === "long"
      ? exitRangeHigh - exitPrice <= entryAtr * 0.45
      : exitPrice - exitRangeLow <= entryAtr * 0.45
    : false;
  const structureInvalidationExit = realizedDirectionalMove < 0 && exitRangeHigh !== null && exitRangeLow !== null
    ? side === "long"
      ? exitPrice <= exitRangeLow + entryAtr * 0.25
      : exitPrice >= exitRangeHigh - entryAtr * 0.25
    : false;

  let exitScore: number | null = null;
  const exitReasons: string[] = [];
  const forcedExit = input.position.exitReason !== "trade";
  if (forcedExit) {
    exitReasons.push("forced_exit_not_scored");
  } else if (inTrade.length === 0) {
    exitReasons.push("intrabar_exit_not_scored");
  } else if (realizedDirectionalMove < 0) {
    if (structureInvalidationExit) exitReasons.push("structure_invalidation_exit");
    exitReasons.push("loss_exit_requires_plan_context");
  } else {
    let score = 50;
    if (captureRatio !== null && captureRatio >= 0.7) {
      score += 25;
      exitReasons.push("high_move_capture");
    } else if (captureRatio !== null && captureRatio >= 0.4) {
      score += 10;
      exitReasons.push("moderate_move_capture");
    } else {
      score -= 15;
      exitReasons.push("low_move_capture");
    }
    if (givebackRatio !== null && givebackRatio <= 0.25) {
      score += 10;
      exitReasons.push("limited_giveback");
    } else if (givebackRatio !== null && givebackRatio > 0.6) {
      score -= 15;
      exitReasons.push("large_giveback");
    }
    if (favorableExitStructure) {
      score += 15;
      exitReasons.push(side === "long" ? "resistance_exit" : "support_exit");
    }
    exitScore = Math.round(clamp(score, 0, 100));
  }

  const fee = finiteNumber(input.position.feeTotal) ?? 0;
  const funding = finiteNumber(input.position.fundingTotal) ?? 0;
  const explicitCost = Math.abs(fee) + Math.max(0, -funding);
  const grossMovementQuote = Math.max(Math.abs(realizedDirectionalMove) * quantity, entryPrice * quantity * 0.0001);
  const costShare = grossMovementQuote > 0 ? explicitCost / grossMovementQuote : null;
  const mfeAtr = mfePriceMove / entryAtr;
  const maeAtr = maePriceMove / entryAtr;
  const structuralEvidence = [
    trendAligned,
    contextAligned,
    favorableLocation,
    breakout
  ].filter(Boolean).length;
  let significance: TradeSignificance;
  const significanceReasons: string[] = [];
  if (mfeAtr >= 1 || (structuralEvidence >= 2 && Math.max(mfeAtr, maeAtr) >= 0.5)) {
    significance = "meaningful";
    if (mfeAtr >= 1) significanceReasons.push("meaningful_excursion");
    if (structuralEvidence >= 2) significanceReasons.push("structure_evidence_present");
  } else if (
    (structuralEvidence === 0 && Math.max(mfeAtr, maeAtr) < 0.5) ||
    (Math.max(mfeAtr, maeAtr) < 0.75 && costShare !== null && costShare >= 0.35)
  ) {
    significance = "noise";
    if (structuralEvidence === 0) significanceReasons.push("structure_evidence_weak");
    if (Math.max(mfeAtr, maeAtr) < 0.5) significanceReasons.push("excursion_below_noise_band");
    if (costShare !== null && costShare >= 0.35) significanceReasons.push("cost_share_high");
  } else {
    significance = "limited";
    significanceReasons.push("mixed_trade_significance");
  }
  if (forcedExit) significanceReasons.push("risk_event_review_priority");

  let postExitConfirmation: PostExitConfirmation = "unavailable";
  if (postExit.length >= 6) {
    const postHigh = Math.max(...postExit.map((candle) => candle.high));
    const postLow = Math.min(...postExit.map((candle) => candle.low));
    const favorableAfterExit = side === "long" ? postHigh - exitPrice : exitPrice - postLow;
    const adverseAfterExit = side === "long" ? exitPrice - postLow : postHigh - exitPrice;
    if (adverseAfterExit >= entryAtr * 0.5 && adverseAfterExit > favorableAfterExit * 1.2) {
      postExitConfirmation = "reversal_after_exit";
    } else if (favorableAfterExit >= entryAtr * 0.5 && favorableAfterExit > adverseAfterExit * 1.2) {
      postExitConfirmation = "continued_after_exit";
    } else {
      postExitConfirmation = "mixed";
    }
  }

  let confidence: TradeQualityConfidence = "low";
  if (contextTrend.direction === "unknown") warnings.push("higher_timeframe_history_insufficient");
  if (
    preEntry.length >= 80 &&
    preEntryContext.length >= 55 &&
    contextTrend.direction !== "unknown" &&
    inTrade.length >= 2 &&
    input.position.fillCount <= 2 &&
    input.coverage.ratio >= 0.95 &&
    input.coverage.maxGapBars <= 1
  ) {
    confidence = "high";
  } else if (preEntry.length >= 60 && inTrade.length >= 1 && input.coverage.ratio >= 0.85) {
    confidence = "medium";
  }
  if (input.position.fillCount > 2 && confidence === "high") confidence = "medium";

  return {
    status: "ready",
    evaluationVersion: tradeQualityEvaluationVersion,
    confidence,
    primaryTimeframe,
    contextTimeframe,
    holdingSeconds,
    durationClass,
    entryScore,
    entryGrade: scoreGrade(entryScore),
    exitScore,
    exitGrade: exitScore === null ? null : scoreGrade(exitScore),
    significance,
    postExitConfirmation,
    atrAtEntry: round(entryAtr),
    entryRangePosition: round(entryRangePosition),
    entryExtensionAtr: round(entryExtensionAtr),
    mfePricePct: round((mfePriceMove / entryPrice) * 100),
    maePricePct: round((maePriceMove / entryPrice) * 100),
    mfeAtr: round(mfeAtr),
    maeAtr: round(maeAtr),
    captureRatio: round(captureRatio),
    givebackRatio: round(givebackRatio),
    costShare: round(costShare),
    entryReasons: unique(entryReasons).slice(0, 12),
    exitReasons: unique(exitReasons).slice(0, 12),
    significanceReasons: unique(significanceReasons).slice(0, 12),
    warnings: unique(warnings).slice(0, 12),
    coverage: {
      ratio: round(clamp(input.coverage.ratio, 0, 1)) ?? 0,
      expectedBars: Math.max(0, Math.floor(input.coverage.expectedBars)),
      observedBars: Math.max(0, Math.floor(input.coverage.observedBars)),
      maxGapBars: Math.max(0, Math.floor(input.coverage.maxGapBars))
    }
  };
}
