import assert from "node:assert/strict";
import { buildHierarchicalPerpetualDecision } from "../src/lib/hierarchicalPerpetualDecision";
import {
  analyzeQualifiedMss,
  analyzeStableQualifiedMss,
  perpetualStructureTimeframes,
  unavailableQualifiedMss,
  type PerpetualStructureTimeframe,
  type QualifiedMssState
} from "../src/lib/qualifiedMss";
import type { Candle } from "../src/lib/marketAnalysis";

const timeframeSeconds: Record<PerpetualStructureTimeframe, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3_600,
  "4h": 14_400,
  "1d": 86_400
};

function baseWave(timeframe: PerpetualStructureTimeframe, length = 80): Candle[] {
  const step = timeframeSeconds[timeframe];
  return Array.from({ length }, (_, barNumber) => {
    const base = 100 + Math.sin(barNumber / 3) * 4;
    return {
      time: 1_750_000_000 + barNumber * step,
      open: base - 0.2,
      high: base + 1,
      low: base - 1,
      close: base + 0.2,
      volume: 100
    };
  });
}

function append(candles: Candle[], timeframe: PerpetualStructureTimeframe, values: Omit<Candle, "time">) {
  candles.push({
    ...values,
    time: candles.at(-1)!.time + timeframeSeconds[timeframe]
  });
}

function firstMss(timeframe: PerpetualStructureTimeframe, direction: 1 | -1) {
  const candles = baseWave(timeframe);
  append(candles, timeframe, direction === 1
    ? { open: 100, high: 115, low: 99, close: 114, volume: 200 }
    : { open: 100, high: 101, low: 85, close: 86, volume: 200 });
  return candles;
}

for (const timeframe of perpetualStructureTimeframes) {
  const bullish = analyzeQualifiedMss(timeframe, firstMss(timeframe, 1));
  const bearish = analyzeQualifiedMss(timeframe, firstMss(timeframe, -1));
  assert.equal(bullish.trend, "bullish", `${timeframe} must confirm the first bullish displacement MSS`);
  assert.equal(bearish.trend, "bearish", `${timeframe} must confirm the first bearish displacement MSS`);
  assert.equal(bullish.latestMss?.qualityMode, "Displacement");
  assert.ok((bullish.latestMss?.quality.bodyAtrRatio ?? 0) >= 0.8);
  assert.ok((bullish.latestMss?.quality.breakAtrRatio ?? 0) >= 0.1);
  assert.ok((bullish.latestMss?.quality.closeLocation ?? 0) >= 0.7);
  assert.equal(bullish.closedOnly, true);
  assert.equal(bullish.historyMode, "bounded-replay");
  assert.equal(bullish.sourceIndicatorVersion, "Coters-v2.49");
}

const weakBody = baseWave("15m");
append(weakBody, "15m", { open: 105, high: 105.4, low: 104.8, close: 105.2, volume: 100 });
assert.equal(analyzeQualifiedMss("15m", weakBody).trend, "unknown", "a weak close break must not become MSS");

const wickOnly = baseWave("15m");
append(wickOnly, "15m", { open: 102, high: 115, low: 99, close: 103, volume: 100 });
assert.equal(analyzeQualifiedMss("15m", wickOnly).trend, "unknown", "a wick-only break must not become MSS");

const ambiguous = baseWave("15m");
append(ambiguous, "15m", { open: 100, high: 115, low: 85, close: 114, volume: 200 });
assert.equal(analyzeQualifiedMss("15m", ambiguous).trend, "unknown", "a bar crossing both pivots must fail closed");

const transition = firstMss("15m", 1);
append(transition, "15m", { open: 94.3, high: 95, low: 93.5, close: 94.1, volume: 100 });
const warning = analyzeQualifiedMss("15m", transition);
assert.equal(warning.trend, "bullish", "CHoCH is an early warning and must not flip the confirmed trend");
assert.equal(warning.activeChoch?.direction, "bearish");
append(transition, "15m", { open: 100, high: 101, low: 84, close: 85, volume: 200 });
const flipped = analyzeQualifiedMss("15m", transition);
assert.equal(flipped.trend, "bearish", "a qualified opposite MSS must flip the trend");
assert.equal(flipped.activeChoch, null, "MSS commit clears the earlier warning");

const continuation = firstMss("15m", 1);
for (const [open, high, low, close] of [
  [112, 113, 108, 109],
  [108, 110, 104, 105],
  [105, 108, 102, 103],
  [103, 107, 101, 106],
  [106, 112, 105, 111],
  [111, 118, 110, 117]
] as const) {
  append(continuation, "15m", { open, high, low, close, volume: 100 });
}
const continued = analyzeQualifiedMss("15m", continuation);
assert.equal(continued.trend, "bullish");
assert.equal(continued.activeMsb?.direction, "bullish", "MSB must represent continuation after MSS establishes trend");
assert.equal(continued.activeChoch, null);

const deterministicA = analyzeQualifiedMss("15m", continuation);
const deterministicB = analyzeQualifiedMss("15m", continuation.map((candle) => ({ ...candle })));
assert.deepEqual(deterministicA, deterministicB, "bounded replay must be deterministic");
assert.doesNotMatch(JSON.stringify(deterministicA), /"index"\s*:/, "serialized MSS state must not expose replay indexes");

const tooShort = analyzeQualifiedMss("15m", baseWave("15m").slice(0, 30));
assert.equal(tooShort.integrity, "insufficient");
assert.equal(tooShort.trend, "unknown");
const duplicate = firstMss("15m", 1);
duplicate[20] = { ...duplicate[20], time: duplicate[19].time };
assert.equal(analyzeQualifiedMss("15m", duplicate).integrity, "invalid", "duplicate timestamps must fail closed");
const gap = firstMss("15m", 1);
gap[20] = { ...gap[20], time: gap[19].time + 1_800 };
assert.equal(analyzeQualifiedMss("15m", gap).integrity, "invalid", "gapped native candles must fail closed");

const stableHistory = baseWave("15m", 1_500);
append(stableHistory, "15m", { open: 100, high: 115, low: 99, close: 114, volume: 200 });
const stabilized = analyzeStableQualifiedMss("15m", stableHistory);
assert.equal(stabilized.integrity, "ready");
assert.equal(stabilized.trend, "bullish");
assert.deepEqual(stabilized.stability.checkedWindows, [1_501, 960, 640, 320]);
assert.equal(stabilized.stability.directionStable, true);
assert.equal(stabilized.stability.exactPineStateParity, false);

function seededRandomCandles(seedValue: number, length: number): Candle[] {
  let seed = seedValue >>> 0;
  const random = () => {
    seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
    return seed / 2 ** 32;
  };
  let price = 100;
  return Array.from({ length }, (_, index) => {
    const open = price;
    const close = Math.max(5, open + (random() - 0.5) * 5);
    const high = Math.max(open, close) + random() * 2;
    const low = Math.max(0.1, Math.min(open, close) - random() * 2);
    price = close;
    return { time: 1_749_600_000 + index * 900, open, high, low, close, volume: 100 };
  });
}

const boundarySensitive = seededRandomCandles(793, 700);
assert.equal(analyzeQualifiedMss("15m", boundarySensitive).trend, "bearish");
assert.equal(analyzeQualifiedMss("15m", boundarySensitive.slice(-320)).trend, "bullish");
const boundaryGuarded = analyzeStableQualifiedMss("15m", boundarySensitive);
assert.equal(boundaryGuarded.integrity, "unstable", "rolling-window direction reversals must fail closed");
assert.equal(boundaryGuarded.known, false);
assert.equal(boundaryGuarded.trend, "unknown");

function hierarchyState(timeframe: PerpetualStructureTimeframe, direction: "bullish" | "bearish"): QualifiedMssState {
  const source = analyzeQualifiedMss(timeframe, firstMss(timeframe, direction === "bullish" ? 1 : -1));
  return { ...source, trendStrength: 1 };
}

function hierarchyFrames(overrides: Partial<Record<PerpetualStructureTimeframe, "bullish" | "bearish" | "unavailable">> = {}) {
  return perpetualStructureTimeframes.map((timeframe) => {
    const direction = overrides[timeframe] ?? "bullish";
    return direction === "unavailable" ? unavailableQualifiedMss(timeframe) : hierarchyState(timeframe, direction);
  });
}

const aligned = buildHierarchicalPerpetualDecision(hierarchyFrames());
assert.equal(aligned.finalDirection, "bullish");
assert.equal(aligned.reaction, "confirming");
assert.equal(aligned.normalizedScore, 1);
const duplicatedInput = buildHierarchicalPerpetualDecision([...hierarchyFrames(), hierarchyState("1m", "bullish")]);
assert.deepEqual(duplicatedInput.coverage, { known: 6, total: 6 }, "duplicate timeframe rows must not inflate coverage");

const shortRejecting = buildHierarchicalPerpetualDecision(hierarchyFrames({ "5m": "bearish", "1m": "bearish" }));
assert.equal(shortRejecting.finalDirection, "bullish", "lower timeframes must not flip aligned higher structures");
assert.equal(shortRejecting.reaction, "rejecting");

const macroConflict = buildHierarchicalPerpetualDecision(hierarchyFrames({ "4h": "bearish" }));
assert.equal(macroConflict.finalDirection, "unknown", "lower frames cannot decide direction while 1d and 4h conflict");
assert.equal(macroConflict.conflict, "macro");

const countertrend = buildHierarchicalPerpetualDecision(hierarchyFrames({ "1h": "bearish", "15m": "bearish" }));
assert.equal(countertrend.finalDirection, "unknown");
assert.equal(countertrend.conflict, "macro_current");

const missingReaction = buildHierarchicalPerpetualDecision(hierarchyFrames({ "1m": "unavailable", "5m": "unavailable" }));
assert.equal(missingReaction.finalDirection, "bullish", "missing reaction data must not erase aligned macro and current structure");
assert.equal(missingReaction.reaction, "unavailable");

console.log("Qualified MSS and six-timeframe hierarchy contract passed.");
