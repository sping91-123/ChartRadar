import assert from "node:assert/strict";
import {
  classifyTradeDuration,
  evaluateTradeQuality,
  tradeQualityTimeframeForHoldingSeconds,
  type TradeQualityCandle,
  type TradeQualityPosition
} from "../src/lib/tradeQuality";

const minute = 60_000;
const entryBoundary = Date.UTC(2026, 6, 1, 0, 0, 0);

function candleSeries(options: { postDirection?: "up" | "down"; boundaryWick?: boolean } = {}) {
  const candles: TradeQualityCandle[] = [];
  for (let offset = -240; offset <= 30; offset += 1) {
    const openTimeMs = entryBoundary + offset * minute;
    const baseline = 100 + (offset + 240) * 0.02;
    let close = baseline + 0.015;
    let high = close + 0.04;
    let low = baseline - 0.04;
    if (offset >= 11) {
      const postMove = (offset - 10) * 0.2;
      close = options.postDirection === "down" ? baseline - postMove : baseline + postMove;
      high = Math.max(baseline, close) + 0.04;
      low = Math.min(baseline, close) - 0.04;
    }
    if (options.boundaryWick && (offset === 0 || offset === 10)) {
      high += 50;
      low -= 50;
    }
    candles.push({
      openTimeMs,
      open: baseline,
      high,
      low,
      close,
      volume: 10 + Math.abs(offset)
    });
  }
  return candles;
}

function position(overrides: Partial<TradeQualityPosition> = {}): TradeQualityPosition {
  return {
    id: "position-1",
    connectionId: "connection-1",
    provider: "okx",
    symbol: "BTC/USDT:USDT",
    positionSide: "long",
    openedAt: new Date(entryBoundary + 30_000).toISOString(),
    closedAt: new Date(entryBoundary + 10 * minute + 30_000).toISOString(),
    quantityBase: "1",
    averageEntryPrice: "104.8",
    averageExitPrice: "105.2",
    realizedPnl: "0.4",
    feeTotal: "-0.05",
    fundingTotal: "0",
    netPnl: "0.35",
    exitReason: "trade",
    fillCount: 2,
    ...overrides
  };
}

const coverage = {
  ratio: 1,
  expectedBars: 271,
  observedBars: 271,
  maxGapBars: 0
};

const base = evaluateTradeQuality({ position: position(), candles: candleSeries({ postDirection: "up" }), coverage });
assert.equal(base.status, "ready");
assert.equal(base.primaryTimeframe, "1m");
assert.notEqual(base.entryScore, null);
assert.notEqual(base.exitScore, null);

const changedAfterEntry = candleSeries({ postDirection: "down" }).map((candle) =>
  candle.openTimeMs >= entryBoundary + minute && candle.openTimeMs < entryBoundary + 10 * minute
    ? { ...candle, high: candle.high + 8, close: candle.close + 4 }
    : candle
);
const afterEntryAssessment = evaluateTradeQuality({
  position: position(),
  candles: changedAfterEntry,
  coverage
});
assert.equal(
  afterEntryAssessment.entryScore,
  base.entryScore,
  "candles after entry must not change entry location score"
);

const postDown = evaluateTradeQuality({
  position: position(),
  candles: candleSeries({ postDirection: "down" }),
  coverage
});
assert.equal(postDown.exitScore, base.exitScore, "post-exit candles must not change exit score");
assert.notEqual(postDown.postExitConfirmation, base.postExitConfirmation, "post-exit confirmation should remain separate");

const withBoundaryWick = evaluateTradeQuality({
  position: position(),
  candles: candleSeries({ postDirection: "up", boundaryWick: true }),
  coverage
});
assert.equal(withBoundaryWick.mfeAtr, base.mfeAtr, "entry and exit boundary candle wicks must be excluded from MFE");
assert.equal(withBoundaryWick.maeAtr, base.maeAtr, "entry and exit boundary candle wicks must be excluded from MAE");

const intrabar = evaluateTradeQuality({
  position: position({
    closedAt: new Date(entryBoundary + 50_000).toISOString(),
    averageExitPrice: "104.9"
  }),
  candles: candleSeries(),
  coverage
});
assert.equal(intrabar.status, "ready");
assert.equal(intrabar.exitScore, null);
assert.ok(intrabar.warnings.includes("intrabar_order_unknown"));

const lowCoverage = evaluateTradeQuality({
  position: position(),
  candles: candleSeries(),
  coverage: { ratio: 0.5, expectedBars: 200, observedBars: 100, maxGapBars: 20 }
});
assert.equal(lowCoverage.status, "insufficient_data");
assert.equal(lowCoverage.entryScore, null);

const brokenSupportLong = evaluateTradeQuality({
  position: position({
    averageEntryPrice: "50",
    averageExitPrice: "51",
    realizedPnl: "1",
    netPnl: "0.95"
  }),
  candles: candleSeries(),
  coverage
});
assert.ok(brokenSupportLong.entryReasons.includes("entry_beyond_invalidated_range"));
assert.ok(!brokenSupportLong.entryReasons.includes("support_proximity"));
assert.notEqual(brokenSupportLong.entryGrade, "a", "a long far below the prior range must not receive an A");

const brokenResistanceShort = evaluateTradeQuality({
  position: position({
    positionSide: "short",
    averageEntryPrice: "160",
    averageExitPrice: "159",
    realizedPnl: "1",
    netPnl: "0.95"
  }),
  candles: candleSeries(),
  coverage
});
assert.ok(brokenResistanceShort.entryReasons.includes("entry_beyond_invalidated_range"));
assert.ok(!brokenResistanceShort.entryReasons.includes("resistance_proximity"));
assert.notEqual(brokenResistanceShort.entryGrade, "a", "a short far above the prior range must not receive an A");

const lossWithoutPlan = evaluateTradeQuality({
  position: position({
    averageExitPrice: "104",
    realizedPnl: "-0.8",
    netPnl: "-0.85"
  }),
  candles: candleSeries(),
  coverage
});
assert.equal(lossWithoutPlan.exitScore, null, "loss exits require the user's stop plan before grading");
assert.equal(lossWithoutPlan.exitGrade, null);
assert.ok(lossWithoutPlan.exitReasons.includes("loss_exit_requires_plan_context"));

const limitedContext = evaluateTradeQuality({
  position: position(),
  candles: candleSeries().filter((candle) => candle.openTimeMs >= entryBoundary - 90 * minute),
  coverage: { ratio: 1, expectedBars: 121, observedBars: 121, maxGapBars: 0 }
});
assert.notEqual(limitedContext.confidence, "high");
assert.ok(limitedContext.warnings.includes("higher_timeframe_history_insufficient"));

const largeGap = evaluateTradeQuality({
  position: position(),
  candles: candleSeries(),
  coverage: { ratio: 0.96, expectedBars: 271, observedBars: 260, maxGapBars: 5 }
});
assert.equal(largeGap.status, "insufficient_data");
assert.ok(largeGap.warnings.includes("market_candle_large_gap"));

const incompletePostExit = evaluateTradeQuality({
  position: position(),
  candles: candleSeries().filter((candle) => candle.openTimeMs <= entryBoundary + 13 * minute),
  coverage
});
assert.equal(incompletePostExit.postExitConfirmation, "unavailable");

assert.equal(classifyTradeDuration(15 * 60 - 1), "ultra_short");
assert.equal(classifyTradeDuration(15 * 60), "short");
assert.equal(classifyTradeDuration(4 * 60 * 60), "intraday");
assert.equal(classifyTradeDuration(24 * 60 * 60), "swing");
assert.equal(classifyTradeDuration(7 * 24 * 60 * 60), "position");
assert.equal(tradeQualityTimeframeForHoldingSeconds(14 * 60), "1m");
assert.equal(tradeQualityTimeframeForHoldingSeconds(60 * 60), "5m");
assert.equal(tradeQualityTimeframeForHoldingSeconds(8 * 60 * 60), "15m");
assert.equal(tradeQualityTimeframeForHoldingSeconds(2 * 24 * 60 * 60), "1h");
assert.equal(tradeQualityTimeframeForHoldingSeconds(10 * 24 * 60 * 60), "4h");

console.log("Trade quality look-ahead, counterexample, loss-exit, duration, and coverage fixtures passed.");
