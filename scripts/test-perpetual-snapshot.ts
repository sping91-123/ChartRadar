import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildLargeTradeFlowReport } from "../src/lib/largeTradeFlow";
import { buildLiquidationPressureReport } from "../src/lib/liquidationPressure";
import { isHomePriorityMacro } from "../src/lib/homeMacroPriority";
import { analyzeTimeframe, type Candle } from "../src/lib/marketAnalysis";
import { parseClosedBinanceKlines } from "../src/lib/marketTime";
import { comparePerpetualShadowDecision } from "../src/lib/perpetualShadowComparison";
import { decisionJournalContextFromSnapshot } from "../src/lib/journal";
import type { ConfirmedCommonRangeOteV1 } from "../src/lib/confirmedCommonRangeOte";
import { beginnerTerm, legacyStructureTerm, monitorConditionDisplayLabel, monitorConditionHeading, monitorConditionOutcomeCopy, plainConditionBasis, plainDecisionText } from "../src/lib/perpetualDecisionCopy";
import { perpetualStructureTimeframes, type PerpetualStructureTimeframe, type QualifiedMssState } from "../src/lib/qualifiedMss";
import {
  isPerpetualRevenueCoreScannerEnabled,
  isPerpetualRevenueCoreCanaryWindowActive,
  isPerpetualRevenueCoreUserEnabled,
  perpetualRevenueCoreCanaryUserIds
} from "../src/lib/server/perpetualRevenueCore";
import {
  buildStalePerpetualDecisionFallback,
  canReuseRequestedPerpetualSnapshot,
  choosePersistedSnapshotWinner,
  PERPETUAL_SNAPSHOT_REQUEST_TIMEOUT_MS,
  perpetualSnapshotRefreshDelay,
  shouldContinuePerpetualSnapshotRefresh
} from "../src/lib/perpetualSnapshotContinuity";
import {
  buildPerpetualDecisionSnapshot,
  isMonitorConditionMet,
  perpetualDecisionStateConditionVersion,
  serializeBasicPerpetualSnapshot,
  serializeStoredPerpetualSnapshot,
  type BuildPerpetualDecisionInput,
  type MonitorCondition,
  type PerpetualDecisionSnapshot,
  type PerpetualTimeframeObservation,
  type SourceStatus
} from "../src/lib/perpetualDecisionSnapshot";

const generatedAt = "2026-07-19T12:00:00.000Z";
const ready: SourceStatus = { status: "ready", observedAt: "2026-07-19T11:59:00.000Z", detail: "fixture" };
const baseCondition: MonitorCondition = {
  id: "label-fixture",
  kind: "decision_state_change",
  role: "primary",
  timeframe: "15m",
  label: "가격 흐름과 큰 체결이 같은 방향으로 모이는지 확인",
  threshold: null,
  baselineState: "risk",
  expiresAt: "2026-07-20T12:00:00.000Z"
};
assert.equal(monitorConditionHeading(baseCondition), "다음에 확인할 것", "state checks use the same plain-language heading");
const priceCopyCondition: MonitorCondition = {
  ...baseCondition,
  kind: "price_cross_above",
  threshold: 60_000,
  basis: "확정 구조(MSS) 돌파선"
};
assert.equal(monitorConditionHeading(priceCopyCondition), "다음에 확인할 것");
assert.equal(monitorConditionDisplayLabel(priceCopyCondition), "15분봉이 60,000 위에서 끝나는지 확인");
assert.match(monitorConditionOutcomeCopy(priceCopyCondition).met, /60,000 위에서 끝나면 → 오르는 근거/);
assert.match(monitorConditionOutcomeCopy(priceCopyCondition).unmet, /그 전까지 →/);
assert.match(monitorConditionOutcomeCopy(priceCopyCondition).note, /전문 기준 · 새 추세 확인선 \(MSS\).*자동 주문 아님/);
assert.equal(plainConditionBasis("전환 경고(CHoCH) 돌파선"), "반대 방향 전환 주의선 (CHoCH)");
assert.equal(beginnerTerm("ob"), "강한 움직임이 시작된 가격대 (OB)");
assert.equal(beginnerTerm("ote"), "되돌림 반응 후보 구간 (OTE)");
assert.equal(legacyStructureTerm("msb"), "저장 당시 가격 구조 (MSB)", "legacy structure semantics must remain explicit");
assert.equal(plainDecisionText("현재 구조와 다음 판단 기준을 봅니다."), "현재 방향과 다음에 확인할 조건을 봅니다.");

const refreshNow = Date.parse(generatedAt);
assert.equal(perpetualSnapshotRefreshDelay("2026-07-19T12:02:00.000Z", refreshNow), 60_000, "far expiry must retain the one-minute refresh ceiling");
assert.equal(perpetualSnapshotRefreshDelay("2026-07-19T12:00:20.000Z", refreshNow), 20_500, "near expiry must refresh immediately after the validity boundary");
assert.equal(perpetualSnapshotRefreshDelay("2026-07-19T11:59:59.000Z", refreshNow), 15_000, "expired snapshots must use a bounded retry instead of hot polling");
assert.equal(perpetualSnapshotRefreshDelay("invalid", refreshNow), 15_000, "invalid expiry must use the bounded retry delay");
assert.equal(shouldContinuePerpetualSnapshotRefresh("2026-07-19T11:59:59.000Z", true, refreshNow), false, "an expired exact alert snapshot must stop polling");
assert.equal(shouldContinuePerpetualSnapshotRefresh("2026-07-19T12:00:01.000Z", true, refreshNow), true, "a fresh exact alert snapshot may refresh once at expiry");
assert.equal(shouldContinuePerpetualSnapshotRefresh("2026-07-19T11:59:59.000Z", false, refreshNow), true, "current snapshots must continue bounded refresh recovery");
assert.equal(PERPETUAL_SNAPSHOT_REQUEST_TIMEOUT_MS, 12_000, "snapshot requests must have a watchdog shorter than the retry window");

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
  const analysis = analyzeTimeframe(timeframe, rows, { requireEstablishedStructure: true });
  const structure = slope > 0 ? "bullish" : slope < 0 ? "bearish" : "unknown";
  return {
    timeframe,
    analysis: { ...analysis, msb: structure, choch: structure },
    observedAt: "2026-07-19T11:59:00.000Z",
    closedPrice: latest.close,
    rangeHigh: latest.high,
    rangeLow: latest.low,
    candleTimes: rows.map((candle) => candle.time)
  };
}

function qualifiedState(
  timeframe: PerpetualStructureTimeframe,
  direction: "bullish" | "bearish" | "unknown" = "bullish"
): QualifiedMssState {
  const known = direction !== "unknown";
  const eventDirection = known ? direction : "bullish";
  const occurredAt = "2026-07-19T11:45:00.000Z";
  return {
    contractVersion: "qualified-mss-v1",
    sourceIndicatorVersion: "Coters-v2.49",
    timeframe,
    historyMode: "bounded-replay",
    closedOnly: true,
    historyStart: "2026-06-01T00:00:00.000Z",
    lastClosedAt: generatedAt,
    barCount: 1500,
    warmupComplete: true,
    integrity: known ? "ready" : "unstable",
    stability: {
      checkedWindows: [1500, 960, 640, 320],
      directionStable: known,
      exactPineStateParity: false
    },
    trend: direction,
    known,
    trendStrength: known ? 1 : 0,
    latestMss: known ? {
      direction: eventDirection,
      level: eventDirection === "bullish" ? 60_400 : 60_900,
      occurredAt,
      ageBars: 3,
      pivotId: `${timeframe}-mss`,
      sourceAt: occurredAt,
      confirmedAt: "2026-07-19T12:00:00.000Z",
      qualityMode: "Displacement",
      quality: { bodyAtrRatio: 0.9, breakAtrRatio: 0.12, closeLocation: 0.75 }
    } : null,
    activeMsb: null,
    activeChoch: null,
    eventCursor: known ? `mss:${timeframe}:${direction}` : null
  };
}

function qualifiedStructures(direction: "bullish" | "bearish" | "unknown" = "bullish") {
  return perpetualStructureTimeframes.map((timeframe) => qualifiedState(timeframe, direction));
}

const noBreakStructure = analyzeTimeframe("15m", candles(15 * 60, 0), { requireEstablishedStructure: true });
assert.equal(noBreakStructure.msb, "unknown", "structure must not default to bullish before a confirmed break");
assert.equal(noBreakStructure.choch, "unknown", "transition must stay unknown before a market direction is established");
assert.equal(noBreakStructure.debug.market, 0);
assert.equal(noBreakStructure.debug.choch, 0);

function establishedStructureCandles(direction: 1 | -1): Candle[] {
  return Array.from({ length: 100 }, (_, index) => {
    let base = 100 + Math.sin(index / 4) * 5;
    if (index > 85) base += direction * (index - 85) * 1.5;
    return {
      time: 1_750_000_000 + index * 900,
      open: base - 0.2,
      high: base + 0.8,
      low: base - 0.8,
      close: base + 0.2,
      volume: 100 + index
    };
  });
}

const firstBullishBreak = analyzeTimeframe("15m", establishedStructureCandles(1), { requireEstablishedStructure: true });
const firstBearishBreak = analyzeTimeframe("15m", establishedStructureCandles(-1), { requireEstablishedStructure: true });
assert.equal(firstBullishBreak.msb, "bullish", "the first confirmed high break must establish bullish structure from zero");
assert.equal(firstBullishBreak.latestMsbEvent?.direction, "bullish");
assert.equal(firstBearishBreak.msb, "bearish", "the first confirmed low break must establish bearish structure from zero");
assert.equal(firstBearishBreak.latestMsbEvent?.direction, "bearish");

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

const sellFlow = buildLargeTradeFlowReport(
  "BTCUSDT",
  Array.from({ length: 80 }, (_, index) => ({
    p: String(60_000 + index),
    q: "12",
    T: new Date("2026-07-19T11:59:00.000Z").getTime() + index,
    m: true
  })),
  new Date("2026-07-19T11:59:30.000Z").getTime()
);

function input(overrides: Partial<BuildPerpetualDecisionInput> = {}): BuildPerpetualDecisionInput {
  const frames = [observation("15m", 15 * 60), observation("1h", 60 * 60), observation("4h", 4 * 60 * 60)] as const;
  const base: BuildPerpetualDecisionInput = {
    id: "11111111-1111-4111-8111-111111111111",
    fingerprint: "fixture-fingerprint",
    asset: "btc",
    price: 60_650,
    chartCandles: candles(15 * 60, 2),
    generatedAt,
    sourceStatus: { candles: ready, pressure: ready, flow: ready },
    timeframes: [...frames],
    structureTimeframes: qualifiedStructures(),
    pressure,
    flow,
    previousSnapshot: null
  };
  return {
    ...base,
    ...overrides,
    structureTimeframes: overrides.structureTimeframes ?? base.structureTimeframes
  };
}

const first = buildPerpetualDecisionSnapshot(input());
const second = buildPerpetualDecisionSnapshot(input());
assert.deepEqual(first, second, "fixed input must produce a deterministic snapshot");
assert.equal(first.asset, "btc");
assert.equal(first.symbol, "BTCUSDT");
assert.equal(first.exchange, "binance");
assert.equal(first.engineVersion, "perpetual-v3.0.0", "six-timeframe MSS semantics must use a new storage bucket");
assert.equal(first.chart.candles.length, 96);
assert.equal(first.quality, "ready");
assert.ok(first.publicEvidence, "Basic payload must retain useful 15m structure, pressure, and flow evidence");
assert.equal(first.publicEvidence.context?.length, 6, "Basic must see all six qualified structure directions without paid raw metrics");
assert.equal(first.publicEvidence.technical?.timeframe, "15m", "Basic must retain a useful fixed-timeframe technical cross-check");
assert.equal(first.publicEvidence.technical?.role, "cross_check", "technical evidence must not become a second operational verdict");
assert.equal(first.publicEvidence.technical?.observedAt, input().timeframes[0].observedAt, "Basic technical evidence must retain the actual closed-candle observation time");
assert.equal(first.publicEvidence.technical?.closedPrice, input().timeframes[0].closedPrice, "Basic technical evidence must retain the actual closed price instead of the live snapshot price");
assert.equal(first.publicEvidence.technical?.regime, first.pro?.multiTimeframeEvidence.find((item) => item.timeframe === "15m")?.regime);
assert.ok(first.publicEvidence.pressure?.summary.includes("강제 청산"), "Basic pressure copy must explain the practical risk in plain language");
assert.ok(first.publicEvidence.flow?.summary.includes("큰 금액"), "Basic flow copy must explain what the observed trades mean");
assert.equal(first.pro?.detailVersion, 1, "new snapshots must include the snapshot-native detail contract");
assert.equal(first.pro?.technicalDetailVersion, 1, "new snapshots must identify the complete technical detail contract");
assert.ok(first.pro?.multiTimeframeEvidence.every((evidence) => evidence.details), "all paid timeframes must retain their detailed evidence");
assert.equal(
  first.pro?.multiTimeframeEvidence.find((evidence) => evidence.timeframe === "15m")?.details?.indicators.ema200,
  input().timeframes[0].analysis.condition.ema200,
  "Pro evidence must retain the exact full indicator condition calculated for that timeframe"
);
assert.doesNotMatch(first.summary.headline, /상방 구조|하방 구조|유지 조건|스냅샷/, "the main conclusion must be understandable without internal jargon");
assert.ok(first.summary.primaryCondition.id.includes("perpetual-condition-v3.0.0"), "v3 price conditions must not collide with older monitor semantics");
assert.ok(new Date(first.summary.primaryCondition.expiresAt).getTime() > new Date(generatedAt).getTime());
assert.equal(
  isMonitorConditionMet({ ...first.summary.primaryCondition, id: first.summary.primaryCondition.id.replace("perpetual-condition-v3.0.0", "perpetual-v1.0.0") }, first),
  false,
  "an older price monitor must fail closed against a v3 snapshot"
);
const firstV3FromV2 = buildPerpetualDecisionSnapshot(input({
  id: "11111111-1111-4111-8111-111111111116",
  previousSnapshot: {
    engineVersion: "perpetual-v2.0.0",
    generatedAt: "2026-07-19T11:59:00.000Z",
    summary: { ...first.summary, state: "downside_watch" }
  }
}));
assert.equal(firstV3FromV2.publicEvidence?.previousChange, null, "the first v3 snapshot must not report a false change from v2 semantics");

const confirmedCommonRangeFixture: ConfirmedCommonRangeOteV1 = {
  version: "confirmedCommonRangeV1",
  sourceIndicatorVersion: "Coters-v2.48",
  sourceTimeframe: "1h",
  probeTimeframe: "15m",
  closedOnly: true,
  historyMode: "bounded-replay",
  exactPineStateParity: false,
  swingLength: 2,
  maxAgeBars: 24,
  sourceBarCount: 320,
  rangeId: "BTCUSDT|1h|2026-07-19T11:00:00.000Z",
  confirmedAt: "2026-07-19T11:00:00.000Z",
  ageBars: 1,
  rangeLow: 59_123.45,
  rangeHigh: 61_987.65,
  midpoint: 60_555.55,
  activeZone: "none",
  long: { valid: true, low: 59_725, high: 60_212, ideal: 59_968.5, touchedByLatestClosed15m: false },
  short: { valid: true, low: 60_899, high: 61_386, ideal: 61_142.5, touchedByLatestClosed15m: false }
};
const withConfirmedCommonRange = buildPerpetualDecisionSnapshot(input({ confirmedCommonRangeV1: confirmedCommonRangeFixture }));
assert.deepEqual(withConfirmedCommonRange.summary, first.summary, "shadow OTE evidence must not change the public decision");
assert.deepEqual(withConfirmedCommonRange.publicEvidence, first.publicEvidence, "shadow OTE evidence must not enter Basic evidence");
assert.deepEqual(withConfirmedCommonRange.pro?.confirmationConditions, first.pro?.confirmationConditions, "shadow OTE must not change confirmations");
assert.deepEqual(withConfirmedCommonRange.pro?.invalidationConditions, first.pro?.invalidationConditions, "shadow OTE must not change invalidations");
assert.deepEqual(withConfirmedCommonRange.pro?.multiTimeframeEvidence, first.pro?.multiTimeframeEvidence, "legacy OTE and timeframe evidence remain unchanged");
assert.deepEqual(decisionJournalContextFromSnapshot(withConfirmedCommonRange), decisionJournalContextFromSnapshot(first), "journal context must ignore shadow OTE");
assert.equal(withConfirmedCommonRange.engineVersion, first.engineVersion, "additive Pro evidence does not change engine semantics");
assert.deepEqual(withConfirmedCommonRange.pro?.confirmedCommonRangeV1, confirmedCommonRangeFixture);
for (const condition of [first.summary.primaryCondition, ...(first.pro?.confirmationConditions ?? []), ...(first.pro?.invalidationConditions ?? [])]) {
  assert.equal(
    isMonitorConditionMet(condition, withConfirmedCommonRange),
    isMonitorConditionMet(condition, first),
    `shadow OTE must not change monitor evaluation for ${condition.id}`
  );
}
const shadowBasicText = JSON.stringify(serializeBasicPerpetualSnapshot(withConfirmedCommonRange));
assert.doesNotMatch(shadowBasicText, /confirmedCommonRangeV1|59123\.45|61987\.65/, "Basic serialization must not expose shadow OTE fields or prices");

const neutralFrames = [observation("15m", 15 * 60, 0), observation("1h", 60 * 60, 0), observation("4h", 4 * 60 * 60, 0)] as const;
const neutralSnapshot = buildPerpetualDecisionSnapshot(input({
  id: "11111111-1111-4111-8111-111111111115",
  fingerprint: "neutral-no-break-fixture",
  timeframes: [...neutralFrames],
  structureTimeframes: qualifiedStructures("unknown"),
  pressure: null,
  flow: null
}));
assert.equal(neutralSnapshot.summary.state, "neutral", "balanced evidence must remain neutral");
assert.equal(neutralSnapshot.summary.primaryCondition.kind, "decision_state_change", "neutral must wait for aligned evidence instead of defaulting to an upside price");
assert.ok(neutralSnapshot.summary.primaryCondition.id.startsWith(`${perpetualDecisionStateConditionVersion}:`));
assert.equal(neutralSnapshot.pro?.confirmationConditions.length, 0, "neutral must not create directional paid confirmations");
assert.equal(neutralSnapshot.pro?.invalidationConditions.length, 0, "neutral must not create directional paid invalidations");
assert.doesNotMatch(neutralSnapshot.summary.headline, /확정 전/, "the headline must describe current evidence instead of a permanent pre-confirmation state");
const changedFromNeutral = {
  ...neutralSnapshot,
  summary: { ...neutralSnapshot.summary, state: "upside_watch" as const }
};
const riskFromNeutral = {
  ...neutralSnapshot,
  summary: { ...neutralSnapshot.summary, state: "risk" as const }
};
assert.equal(isMonitorConditionMet(neutralSnapshot.summary.primaryCondition, changedFromNeutral), true, "a v3 state condition must trigger after evidence aligns directionally");
assert.equal(isMonitorConditionMet(neutralSnapshot.summary.primaryCondition, riskFromNeutral), false, "neutral-to-risk must not be reported as directional alignment");
assert.equal(
  isMonitorConditionMet({ ...neutralSnapshot.summary.primaryCondition, id: "perpetual-v1.0.0:btc:15m:primary:decision_state_change:state" }, neutralSnapshot),
  false,
  "legacy state baselines must fail closed after a decision-engine semantic change"
);

const readyConflict = buildPerpetualDecisionSnapshot(input({
  id: "11111111-1111-4111-8111-111111111114",
  fingerprint: "ready-conflict-fixture",
  flow: sellFlow
}));
assert.equal(readyConflict.quality, "ready");
assert.equal(readyConflict.summary.state, "risk");
assert.notEqual(readyConflict.summary.primaryCondition.id, neutralSnapshot.summary.primaryCondition.id, "risk and neutral state baselines must not share a monitor ID");
assert.match(
  readyConflict.summary.primaryCondition.label,
  /엇갈린 시간대 구조와 큰 금액 체결/,
  "a ready conflict must describe the conflicting evidence instead of claiming data is missing"
);
const neutralFromRisk = {
  ...readyConflict,
  summary: { ...readyConflict.summary, state: "neutral" as const }
};
const downsideFromRisk = {
  ...readyConflict,
  summary: { ...readyConflict.summary, state: "downside_watch" as const }
};
assert.equal(isMonitorConditionMet(readyConflict.summary.primaryCondition, neutralFromRisk), false, "risk-to-neutral must not be reported as directional alignment");
assert.equal(isMonitorConditionMet(readyConflict.summary.primaryCondition, downsideFromRisk), true, "risk must resolve into a directional watch before the condition is met");

const timed15m = observation("15m", 15 * 60);
timed15m.analysis = {
  ...timed15m.analysis,
  latestMsbEvent: { timeframe: "15m", type: "msb", direction: "bullish", index: 280, level: 60_560 },
  latestChochEvent: { timeframe: "15m", type: "choch", direction: "bearish", index: 250, level: 60_500 }
};
const timedFrames = [timed15m, observation("1h", 60 * 60), observation("4h", 4 * 60 * 60)] as const;
const timedStructures = qualifiedStructures().map((state) => state.timeframe === "15m" ? {
  ...state,
  activeMsb: {
    direction: "bullish" as const,
    level: 60_560,
    occurredAt: new Date(timed15m.candleTimes![280]! * 1_000).toISOString(),
    ageBars: 39,
    pivotId: "15m-msb-timed"
  },
  activeChoch: {
    direction: "bearish" as const,
    level: 60_500,
    occurredAt: new Date(timed15m.candleTimes![250]! * 1_000).toISOString(),
    ageBars: 69,
    pivotId: "15m-choch-timed"
  }
} : state);
const timedSnapshot = buildPerpetualDecisionSnapshot(input({
  id: "11111111-1111-4111-8111-111111111113",
  fingerprint: "timed-evidence-fixture",
  timeframes: [...timedFrames],
  structureTimeframes: timedStructures
}));
assert.equal(timedSnapshot.publicEvidence?.events?.msb?.level, 60_560, "Basic must retain the exact 15m MSB level used by the chart marker");
assert.equal(timedSnapshot.publicEvidence?.events?.choch?.level, 60_500, "Basic must retain the exact 15m CHoCH level used by the chart marker");
const storedTimedEvidence = timedSnapshot.pro?.multiTimeframeEvidence.find((item) => item.timeframe === "15m");
assert.equal(storedTimedEvidence?.details?.events.msb?.occurredAt, timedStructures.find((item) => item.timeframe === "15m")?.activeMsb?.occurredAt);
assert.equal(storedTimedEvidence?.details?.events.choch?.occurredAt, timedStructures.find((item) => item.timeframe === "15m")?.activeChoch?.occurredAt);
assert.equal(storedTimedEvidence?.details?.events.mss?.level, 60_400, "qualified MSS must be retained separately from continuation and warning events");

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
assert.equal(basic.summary.analysisConsensus, undefined, "Basic payload must not expose internal layer strengths or normalized score");
assert.ok(basic.publicEvidence, "Basic serialization must not strip the useful public evidence");
assert.ok(basic.publicEvidence?.technical, "Basic serialization must retain the 15m technical cross-check");
const stored = serializeStoredPerpetualSnapshot(first);
assert.equal(Object.prototype.hasOwnProperty.call(stored, "pro"), false, "stored public payload must omit the pro key");
assert.ok(stored.summary.analysisConsensus, "stored public payload must retain v3 continuity for server-side Pro reconstruction");
assert.equal(stored.chart.candles.length, 0, "raw candles must not be stored in snapshot payloads");
const storedPayloadText = JSON.stringify({ publicPayload: stored, proPayload: first.pro });
assert.doesNotMatch(storedPayloadText, /"originIndex"\s*:/, "stored evidence must convert analyzer indexes into timestamps");
assert.doesNotMatch(storedPayloadText, /"index"\s*:/, "stored evidence must not leak raw analyzer candle indexes");

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
assert.deepEqual(staleFallback.summary.analysisConsensus, first.summary.analysisConsensus, "stale fallback must retain the v3 analysis scope without making it actionable");
assert.ok(
  staleFallback.summary.primaryCondition.id.startsWith(`${perpetualDecisionStateConditionVersion}:`),
  "stale recovery monitors must use the v3 state-condition contract"
);
assert.equal(
  isMonitorConditionMet(staleFallback.summary.primaryCondition, first),
  true,
  "a stale recovery monitor must trigger after a fresh non-risk snapshot returns"
);
assert.ok(staleFallback.pro, "a transient refresh failure must retain paid evidence in read-only mode");
assert.deepEqual(staleFallback.pro.confirmationConditions, [], "stale paid evidence must not retain actionable confirmation conditions");
assert.deepEqual(staleFallback.pro.invalidationConditions, [], "stale paid evidence must not retain actionable invalidation conditions");
const staleBasicFallback = buildStalePerpetualDecisionFallback(basic);
assert.equal(Object.prototype.hasOwnProperty.call(staleBasicFallback, "pro"), false, "a Basic stale fallback must not gain paid evidence");

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
assert.match(partial.summary.primaryCondition.label, /빠진 데이터/, "partial data must explain what needs to recover");
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
  assert.match(condition.label, /(?:위|아래)에서 (?:15분|1시간|4시간)봉이 마감하면/, "monitor copy must explain the closed-candle rule and the next action");
  assert.ok(condition.basis, "price conditions must expose the real structural source of the threshold");
  assert.doesNotMatch(condition.basis ?? "", /MSS (?:고점|저점)|MSB (?:고점|저점)|CHoCH (?:고점|저점)/, "event thresholds must use a direction-neutral basis name");
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

const candleRouteSource = readFileSync(join(process.cwd(), "src/app/api/crypto-candles/route.ts"), "utf8");
assert.match(candleRouteSource, /parseClosedBinanceKlines\(rows, asOfMs\)/, "closed chart requests reuse the confirmed-kline parser");
assert.match(candleRouteSource, /params\.set\("endTime", String\(endTime\)\)/, "historical chart requests forward the snapshot timestamp");
assert.match(candleRouteSource, /candleEndpoints\(params, futuresOnly\)/, "futures-only chart requests control spot fallback");

const chartViewSource = readFileSync(join(process.cwd(), "src/lib/chartTimeframeView.ts"), "utf8");
assert.match(chartViewSource, /closedOnly: "1"/);
assert.match(chartViewSource, /futuresOnly: "1"/);
assert.match(chartViewSource, /endTime: String\(asOfMs\)/);

const source = readFileSync(join(process.cwd(), "src/lib/server/perpetualDecisionSource.ts"), "utf8");
assert.match(source, /fapi\.binance\.com/);
assert.match(source, /perpetualStructureTimeframes\.map\(\(timeframe\) => fetchClosedCandles\(symbol, timeframe, asOfMs, 1_500\)\)/, "snapshot generation must request 1500 closed candles for all six native timeframes");
assert.match(source, /analyzeStableQualifiedMss\(timeframe, row\.candles\)/, "each native timeframe must use the boundary-stabilized v2.49 MSS replay");
assert.match(readFileSync(join(process.cwd(), "src/lib/perpetualDecisionSnapshot.ts"), "utf8"), /event\?\.direction === \(direction === "above" \? "bullish" : "bearish"\)/, "threshold candidates must match the direction of the broken pivot");
assert.match(source, /memory\?\.engineVersion === perpetualDecisionEngineVersion/, "an explicit older snapshot must not become the current v3 baseline");
assert.doesNotMatch(source, /data-api\.binance\.vision|api\/v3\/klines/, "canonical source must not fall back to Binance spot");
assert.match(source, /endTime: String\(asOfMs\)/, "historical alert snapshots must hydrate candles at their generated time");
assert.match(source, /asOf = new Date\(snapshot\.generatedAt\)/);
assert.match(
  source,
  /quality=eq\.ready&engine_version=eq\.\$\{encodeURIComponent\(perpetualDecisionEngineVersion\)\}/,
  "historical ready lookups must not mix an older evidence engine into current news continuity"
);
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
const homeSource = readFileSync(join(process.cwd(), "src/components/coin/HomePerpetualDecisionFlow.tsx"), "utf8");
assert.doesNotMatch(homeSource, />[^<{]*(스냅샷|상방 확인 중|하방 확인 중|다음 확인 조건)[^<{]*</, "Home must not render internal or unexplained decision jargon");
assert.match(homeSource, />근거<\/h2>/, "Home evidence section uses the requested short title");
assert.doesNotMatch(homeSource, /왜 이렇게 보나요|결론에 사용한 네 가지 근거|상세 화면에서 시간대별 신호 가격/, "removed Home helper and promo copy must not return");
assert.match(homeSource, /여러 시간대 확정봉 종합/, "Home must describe the six-timeframe decision scope");
assert.match(homeSource, /monitorConditionOutcomeCopy/, "Home must explain what happens when the next criterion is met or not met");
assert.match(homeSource, /전문 용어 뜻 보기/, "Home must keep technical terms behind progressive disclosure");
assert.doesNotMatch(homeSource, /확정 구조\(MSS\)/, "Home evidence must lead with meaning instead of MSS jargon");
assert.ok(
  homeSource.indexOf("<PerpetualDecisionChart snapshot={displaySnapshot} compact />") < homeSource.indexOf("<HomeEvidenceSummary snapshot={displaySnapshot} />"),
  "the compact chart must appear before the evidence section"
);
const macroSource = readFileSync(join(process.cwd(), "src/components/MacroTicker.tsx"), "utf8");
assert.doesNotMatch(macroSource, /다음 매크로 ·/, "Home macro must not collapse the rich calendar card into a one-line summary");
assert.match(macroSource, /오늘 거래 전 확인/, "Home macro must retain a visible daily-calendar heading");
assert.match(macroSource, /<details[\s\S]*data-testid="home-macro-compact"/, "Home macro values must be hidden behind a native disclosure by default");
assert.match(macroSource, /<summary/, "Home macro disclosure must retain keyboard semantics");
assert.match(macroSource, /전체 일정 <ChevronRight/, "Home macro must link directly to the full schedule");
assert.match(macroSource, /recentReleased \?\? upcomingWithin24Hours \?\? nearestUpcoming \?\? previousReleased/, "an upcoming official event must outrank an old release on the daily Home card");

const compactChartSource = readFileSync(join(process.cwd(), "src/components/coin/PerpetualDecisionChart.tsx"), "utf8");
assert.match(compactChartSource, /buildPerpetualChartOverlayModel/, "Home chart lines and legend must share the tested overlay model");
assert.match(compactChartSource, /PerpetualChartLegend/, "compact Home chart must expose exact values outside the plotting area");
assert.match(compactChartSource, /axisLabelVisible: line\.axisLabelVisible/, "only the primary line keeps its axis label in Home and detail charts");
assert.match(compactChartSource, /compactPerpetualCandleLimit/, "compact candle density must respond at the tested width threshold");
assert.match(compactChartSource, /rightOffsetPixels: 56/, "the latest Home candle must retain readable right-side space");
assert.match(compactChartSource, /height: compact \? 240 : 360/, "the compact chart must use the less cramped 240px height");
assert.match(compactChartSource, /applyOptions\(\{ width, height: compact \? 240 : 360 \}\)/, "responsive resize must preserve the compact chart height");
assert.match(compactChartSource, /data-pull-to-refresh-ignore=""/, "Home and detail chart surfaces must not start pull-to-refresh");
assert.doesNotMatch(compactChartSource, /조건선 \{counts\.conditions\}/, "the cramped overlay counts must be removed");
assert.match(compactChartSource, /showText \? \{ text:/, "marker text must remain optional without removing the marker shape");
assert.match(compactChartSource, /!compact && container\.clientWidth >= 520/, "narrow detail charts must hide marker text that would cover candles");
assert.match(compactChartSource, /markers\.setMarkers\(resolvedMarkers\.map/, "narrow charts must keep marker shapes while their exact meaning stays in the legend");
assert.match(compactChartSource, /showAllOverlays[\s\S]*가격대·흐름 보기/, "Home chart must default to a simple view with an explicit detail toggle");
assert.match(compactChartSource, /line\.id === primaryLineId\)[\s\S]*line\.group === "condition"/, "context charts must fall back to their own first condition line");
assert.match(compactChartSource, /이 시간대에 표시할 판단 가격 없음/, "a context chart without a condition line must explain the empty overlay state");
assert.match(compactChartSource, /showAllOverlays && hasAdvancedOverlays/, "an empty context chart must not claim that advanced overlays are visible");
assert.match(compactChartSource, /title: ""/, "price-line titles stay outside the candles in the readable legend");
assert.match(compactChartSource, /aria-describedby=\{legendItems\.length/, "Home and detail charts must both be connected to their legends");
assert.match(compactChartSource, /allResolvedMarkers[\s\S]*visibleMarkerIds/, "signals outside the responsive plot window remain represented in the external legend");
const compactLegendSource = readFileSync(join(process.cwd(), "src/components/coin/PerpetualChartLegend.tsx"), "utf8");
assert.match(compactLegendSource, /<h3[\s\S]*<ul[\s\S]*<li/, "chart legend groups and entries use heading and list semantics");
assert.match(compactLegendSource, /현재 차트 범위 밖/, "the legend explains when a preserved signal is outside the current candle window");
assert.match(compactLegendSource, /\{timeframeLabel\} 차트 범례/, "the hidden legend title must follow the selected timeframe");
const experienceSource = readFileSync(join(process.cwd(), "src/components/coin/PerpetualDecisionExperience.tsx"), "utf8");
const workbenchSource = readFileSync(join(process.cwd(), "src/components/coin/PerpetualEvidenceWorkbench.tsx"), "utf8");
assert.match(experienceSource, /hasQualifiedMssSemantics\(displaySnapshot\)/, "detail summary copy must branch between v2 and v3 meanings");
assert.match(workbenchSource, /hasQualifiedMssSemantics\(snapshot\)/, "saved v2 evidence must not be relabelled as MSS");
assert.match(workbenchSource, /legacyStructureTerm/, "legacy evidence must use the explicit saved-analysis copy branch");

const journalSource = readFileSync(join(process.cwd(), "src/components/JournalApp.tsx"), "utf8");
for (const reviewSource of ["snapshot", "alert", "news"]) {
  assert.match(
    journalSource,
    new RegExp(`entry\\.source === ["']${reviewSource}["']`),
    `${reviewSource} decisions must remain available in the review loop`
  );
}
assert.match(
  journalSource,
  /entry\.decisionContext\?\.primaryCondition\.label \?\? parsed\.nextCheckpoint/,
  "review cards must prefer the frozen decision condition over reparsed free text"
);
assert.match(journalSource, /저장 당시 선물 판단/, "the saved decision context must remain visible during review");
assert.match(journalSource, /판단 당시 뉴스 맥락/, "the saved official-news context must remain visible during review");

console.log("Perpetual decision snapshot matrix passed.");
