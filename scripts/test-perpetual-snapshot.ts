import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildLargeTradeFlowReport } from "../src/lib/largeTradeFlow";
import { buildLiquidationPressureReport } from "../src/lib/liquidationPressure";
import { isHomePriorityMacro } from "../src/lib/homeMacroPriority";
import { analyzeTimeframe, type Candle } from "../src/lib/marketAnalysis";
import { parseClosedBinanceKlines } from "../src/lib/marketTime";
import { comparePerpetualShadowDecision } from "../src/lib/perpetualShadowComparison";
import {
  isPerpetualRevenueCoreScannerEnabled,
  isPerpetualRevenueCoreCanaryWindowActive,
  isPerpetualRevenueCoreUserEnabled,
  perpetualRevenueCoreCanaryUserIds
} from "../src/lib/server/perpetualRevenueCore";
import {
  buildStalePerpetualDecisionFallback,
  canReuseRequestedPerpetualSnapshot,
  choosePersistedSnapshotWinner
} from "../src/lib/perpetualSnapshotContinuity";
import {
  buildPerpetualDecisionSnapshot,
  isMonitorConditionMet,
  serializeBasicPerpetualSnapshot,
  serializeStoredPerpetualSnapshot,
  type BuildPerpetualDecisionInput,
  type PerpetualDecisionSnapshot,
  type PerpetualTimeframeObservation,
  type SourceStatus
} from "../src/lib/perpetualDecisionSnapshot";

const generatedAt = "2026-07-19T12:00:00.000Z";
const ready: SourceStatus = { status: "ready", observedAt: "2026-07-19T11:59:00.000Z", detail: "fixture" };

const canaryUserId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const canaryIds = perpetualRevenueCoreCanaryUserIds(`${canaryUserId.toUpperCase()}, ${canaryUserId}`);
assert.deepEqual(Array.from(canaryIds), [canaryUserId]);
assert.equal(perpetualRevenueCoreCanaryUserIds(`invalid,${canaryUserId}`).size, 0);
assert.equal(perpetualRevenueCoreCanaryUserIds(`${canaryUserId},bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb,cccccccc-cccc-4ccc-8ccc-cccccccccccc`).size, 0);
assert.equal(isPerpetualRevenueCoreCanaryWindowActive("2026-07-19T13:00:00.000Z", Date.parse(generatedAt)), true);
assert.equal(isPerpetualRevenueCoreCanaryWindowActive("2026-07-20T13:00:00.001Z", Date.parse(generatedAt)), false);
const previousCanaryExpiry = process.env.PERPETUAL_REVENUE_CORE_CANARY_EXPIRES_AT;
process.env.PERPETUAL_REVENUE_CORE_CANARY_EXPIRES_AT = "2026-07-19T13:00:00.000Z";
const canaryNow = Date.parse(generatedAt);
const originalDateNow = Date.now;
Date.now = () => canaryNow;
assert.equal(isPerpetualRevenueCoreUserEnabled(canaryUserId, "shadow", canaryIds), true);
assert.equal(isPerpetualRevenueCoreUserEnabled("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "shadow", canaryIds), false);
assert.equal(isPerpetualRevenueCoreUserEnabled(null, "shadow", canaryIds), false);
assert.equal(isPerpetualRevenueCoreUserEnabled(null, "on", canaryIds), true);
assert.equal(isPerpetualRevenueCoreScannerEnabled("shadow", canaryIds), true);
assert.equal(isPerpetualRevenueCoreScannerEnabled("shadow", new Set()), false);
Date.now = originalDateNow;
if (previousCanaryExpiry === undefined) delete process.env.PERPETUAL_REVENUE_CORE_CANARY_EXPIRES_AT;
else process.env.PERPETUAL_REVENUE_CORE_CANARY_EXPIRES_AT = previousCanaryExpiry;

const macroNow = Date.parse(generatedAt);
const macro = (releaseAt: number, importance: 1 | 2 | 3 = 3, label = "미국 CPI") => ({
  releaseAt: new Date(releaseAt).toISOString(),
  importance,
  label
});
assert.equal(isHomePriorityMacro(macro(macroNow + 24 * 60 * 60 * 1000), macroNow), true);
assert.equal(isHomePriorityMacro(macro(macroNow + 24 * 60 * 60 * 1000 + 1), macroNow), false);
assert.equal(isHomePriorityMacro(macro(macroNow - 2 * 60 * 60 * 1000), macroNow), true);
assert.equal(isHomePriorityMacro(macro(macroNow - 2 * 60 * 60 * 1000 - 1), macroNow), false);
assert.equal(isHomePriorityMacro(macro(macroNow + 60_000, 2, "소비자심리지수"), macroNow), false);
assert.equal(comparePerpetualShadowDecision({ quality: "ready", state: "upside_watch", legacyDirection: "up" }), "agreement");
assert.equal(comparePerpetualShadowDecision({ quality: "ready", state: "downside_watch", legacyDirection: "up" }), "mismatch");
assert.equal(comparePerpetualShadowDecision({ quality: "partial", state: "upside_watch", legacyDirection: "up" }), "insufficient");
assert.equal(comparePerpetualShadowDecision({ quality: "ready", state: "risk", legacyDirection: "sideways" }), "insufficient");

function candles(timeframeSeconds: number, slope: number): Candle[] {
  return Array.from({ length: 320 }, (_, index) => {
    const base = 60_000 + index * slope;
    return {
      time: 1_750_000_000 + index * timeframeSeconds,
      open: base,
      high: base + 35,
      low: base - 25,
      close: base + slope * 0.7,
      volume: 100 + index
    };
  });
}

function observation(timeframe: "15m" | "1h" | "4h", seconds: number, slope = 2): PerpetualTimeframeObservation {
  const rows = candles(seconds, slope);
  const latest = rows.at(-1)!;
  return {
    timeframe,
    analysis: analyzeTimeframe(timeframe, rows),
    observedAt: "2026-07-19T11:59:00.000Z",
    closedPrice: latest.close,
    rangeHigh: latest.high,
    rangeLow: latest.low
  };
}

const pressure = buildLiquidationPressureReport({
  symbol: "BTCUSDT",
  period: "1h",
  markPrice: 60_650,
  fundingRate: 0.0001,
  openInterestValue: 10_000_000,
  openInterestChangePercent: 1.5,
  globalLongShort: { longPercent: 48, shortPercent: 52, ratio: 0.92 },
  topAccountLongShort: { longPercent: 47, shortPercent: 53, ratio: 0.89 },
  topPositionLongShort: { longPercent: 49, shortPercent: 51, ratio: 0.96 },
  takerFlow: { buyVolume: 55, sellVolume: 45, buyPercent: 55, sellPercent: 45 },
  updatedAt: new Date("2026-07-19T11:59:00.000Z").getTime()
});

const flow = buildLargeTradeFlowReport(
  "BTCUSDT",
  Array.from({ length: 80 }, (_, index) => ({
    p: String(60_000 + index),
    q: "12",
    T: new Date("2026-07-19T11:59:00.000Z").getTime() + index,
    m: false
  })),
  new Date("2026-07-19T11:59:30.000Z").getTime()
);

function input(overrides: Partial<BuildPerpetualDecisionInput> = {}): BuildPerpetualDecisionInput {
  const frames = [observation("15m", 15 * 60), observation("1h", 60 * 60), observation("4h", 4 * 60 * 60)] as const;
  return {
    id: "11111111-1111-4111-8111-111111111111",
    fingerprint: "fixture-fingerprint",
    asset: "btc",
    price: 60_650,
    chartCandles: candles(15 * 60, 2),
    generatedAt,
    sourceStatus: { candles: ready, pressure: ready, flow: ready },
    timeframes: [...frames],
    pressure,
    flow,
    previousSnapshot: null,
    ...overrides
  };
}

const first = buildPerpetualDecisionSnapshot(input());
const second = buildPerpetualDecisionSnapshot(input());
assert.deepEqual(first, second, "fixed input must produce a deterministic snapshot");
assert.equal(first.asset, "btc");
assert.equal(first.symbol, "BTCUSDT");
assert.equal(first.exchange, "binance");
assert.equal(first.chart.candles.length, 96);
assert.equal(first.quality, "ready");
assert.ok(first.summary.primaryCondition.id.includes("perpetual-v1.0.0"));
assert.ok(new Date(first.summary.primaryCondition.expiresAt).getTime() > new Date(generatedAt).getTime());

const ethSnapshot = buildPerpetualDecisionSnapshot(input({
  id: "11111111-1111-4111-8111-111111111112",
  fingerprint: "eth-fixture-fingerprint",
  asset: "eth",
  price: 3_210.123
}));
assert.equal(ethSnapshot.symbol, "ETHUSDT");
assert.match(ethSnapshot.summary.primaryCondition.id, /:eth:/);
assert.ok(ethSnapshot.pro);
for (const condition of [ethSnapshot.summary.primaryCondition, ...ethSnapshot.pro.confirmationConditions, ...ethSnapshot.pro.invalidationConditions]) {
  if (condition.threshold === null) continue;
  assert.equal(Number((condition.threshold * 100).toFixed(8)), Math.round(condition.threshold * 100), "ETH thresholds must respect the 0.01 tick contract");
}

const basic = serializeBasicPerpetualSnapshot(first);
assert.equal(Object.prototype.hasOwnProperty.call(basic, "pro"), false, "Basic payload must omit the pro key entirely");
const stored = serializeStoredPerpetualSnapshot(first);
assert.equal(Object.prototype.hasOwnProperty.call(stored, "pro"), false, "stored public payload must omit the pro key");
assert.equal(stored.chart.candles.length, 0, "raw candles must not be stored in snapshot payloads");

const canonicalConflictRow = {
  id: "22222222-2222-4222-8222-222222222222",
  fingerprint: "canonical-conflict-winner",
  asset: first.asset,
  symbol: first.symbol,
  exchange: first.exchange,
  engine_version: first.engineVersion,
  generated_at: first.generatedAt,
  expires_at: first.expiresAt,
  quality: first.quality,
  source_status: first.sourceStatus,
  public_payload: stored,
  pro_payload: first.pro ?? null
};
assert.equal(
  choosePersistedSnapshotWinner([], [canonicalConflictRow]).id,
  canonicalConflictRow.id,
  "a duplicate minute bucket must return the database winner instead of the losing generated UUID"
);

const staleFallback = buildStalePerpetualDecisionFallback(first);
assert.equal(staleFallback.quality, "stale");
assert.equal(staleFallback.summary.state, "risk", "stale fallback must not preserve a directional state");
assert.equal(staleFallback.summary.primaryCondition.kind, "decision_state_change");
assert.equal(Object.prototype.hasOwnProperty.call(staleFallback, "pro"), false, "stale fallback must not expose actionable Pro conditions");

const delayedAlertSnapshot = { ...first, expiresAt: "2026-07-19T12:01:00.000Z" };
const delayedOpenAt = new Date("2026-07-19T14:00:00.000Z");
assert.equal(
  canReuseRequestedPerpetualSnapshot({ snapshot: delayedAlertSnapshot, asset: "btc", asOf: delayedOpenAt }),
  false,
  "an expired Home snapshot must refresh"
);
assert.equal(
  canReuseRequestedPerpetualSnapshot({ snapshot: delayedAlertSnapshot, asset: "btc", asOf: delayedOpenAt, allowExpired: true }),
  true,
  "a delayed alert must retain the exact evaluated snapshot for Journal continuity"
);
assert.equal(
  canReuseRequestedPerpetualSnapshot({ snapshot: delayedAlertSnapshot, asset: "eth", asOf: delayedOpenAt, allowExpired: true }),
  false,
  "alert preservation must not bypass the asset boundary"
);

const partial = buildPerpetualDecisionSnapshot(input({
  sourceStatus: {
    candles: ready,
    pressure: { status: "partial", observedAt: ready.observedAt, detail: "missing OI" },
    flow: ready
  }
}));
assert.equal(partial.quality, "partial");
assert.equal(partial.summary.state, "risk", "partial data must not force a directional watch state");
assert.equal(partial.summary.primaryCondition.kind, "decision_state_change");
assert.deepEqual(partial.pro?.confirmationConditions, [], "partial data must not expose confirmation thresholds");
assert.deepEqual(partial.pro?.invalidationConditions, [], "partial data must not expose invalidation thresholds");

assert.ok(first.pro);
const priceConditions = [
  first.summary.primaryCondition,
  ...first.pro.confirmationConditions,
  ...first.pro.invalidationConditions
].filter((condition) => condition.kind === "price_cross_above" || condition.kind === "price_cross_below");
assert.deepEqual(new Set(priceConditions.map((condition) => condition.timeframe)), new Set(["15m", "1h", "4h"]));
for (const condition of priceConditions) {
  assert.match(condition.label, /확정 종가/);
  const threshold = condition.threshold ?? first.price;
  const metPrice = condition.kind === "price_cross_above" ? threshold + 1 : threshold - 1;
  const notMetPrice = condition.kind === "price_cross_above" ? threshold - 1 : threshold + 1;
  const markOnlyCrossed: PerpetualDecisionSnapshot = {
    ...first,
    price: metPrice,
    pro: {
      ...first.pro,
      multiTimeframeEvidence: first.pro.multiTimeframeEvidence.map((evidence) => (
        evidence.timeframe === condition.timeframe ? { ...evidence, closedPrice: notMetPrice } : evidence
      ))
    }
  };
  assert.equal(isMonitorConditionMet(condition, markOnlyCrossed), false, `${condition.timeframe} intrabar mark touch must not trigger`);
  const closedCandleCrossed: PerpetualDecisionSnapshot = {
    ...markOnlyCrossed,
    pro: {
      ...markOnlyCrossed.pro!,
      multiTimeframeEvidence: markOnlyCrossed.pro!.multiTimeframeEvidence.map((evidence) => (
        evidence.timeframe === condition.timeframe ? { ...evidence, closedPrice: metPrice } : evidence
      ))
    }
  };
  assert.equal(isMonitorConditionMet(condition, closedCandleCrossed), true, `${condition.timeframe} closed candle must trigger`);
}

const asOf = new Date("2026-07-19T12:00:00.000Z").getTime();
const rows = [
  [asOf - 30 * 60 * 1000, "1", "2", "0.5", "1.5", "10", asOf - 15 * 60 * 1000 - 1, "0", 1, "0", "0", "0"],
  [asOf - 15 * 60 * 1000, "1.5", "2.5", "1", "2", "10", asOf + 1, "0", 1, "0", "0", "0"]
];
const parsed = parseClosedBinanceKlines(rows, asOf);
assert.equal(parsed.candles.length, 1);
assert.equal(parsed.droppedIncomplete, 1, "the still-open Binance kline must be excluded");

const source = readFileSync(join(process.cwd(), "src/lib/server/perpetualDecisionSource.ts"), "utf8");
assert.match(source, /fapi\.binance\.com/);
assert.doesNotMatch(source, /data-api\.binance\.vision|api\/v3\/klines/, "canonical source must not fall back to Binance spot");
assert.match(source, /endTime: String\(asOfMs\)/, "historical alert snapshots must hydrate candles at their generated time");
assert.match(source, /asOf = new Date\(snapshot\.generatedAt\)/);
assert.match(source, /persistenceWarning\(error\);\s*\/\/[^]*?rememberSnapshot\(snapshot\);\s*return snapshot;/, "snapshot reads must retain an in-memory fallback when storage is unavailable");
assert.match(
  source,
  /globalThis[^]*__chartRadarPerpetualDecisionMemoryStore/,
  "the local persistence fallback must survive Next.js route compilation and hot reload boundaries"
);
const pressureSource = readFileSync(join(process.cwd(), "src/lib/server/liquidationPressureSource.ts"), "utf8");
assert.doesNotMatch(
  pressureSource,
  /data-api\.binance\.vision|api\/v3\/klines/,
  "the required pressure source must not silently substitute Binance spot prices"
);

console.log("Perpetual decision snapshot matrix passed.");
