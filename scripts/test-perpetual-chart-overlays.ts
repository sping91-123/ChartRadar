import assert from "node:assert/strict";
import {
  buildPerpetualChartOverlayModel,
  buildPerpetualSignalLegendItems,
  compactPerpetualCandleLimit,
  resolvePerpetualChartMarkers
} from "../src/lib/perpetualDecisionChartOverlays";
import type { PerpetualDecisionSnapshot } from "../src/lib/perpetualDecisionSnapshot";

const candleStart = 1_780_000_000;
const candles = Array.from({ length: 96 }, (_, index) => ({
  time: candleStart + index * 900,
  open: 100 + index,
  high: 102 + index,
  low: 99 + index,
  close: 101 + index,
  volume: 1_000 + index
}));
const collisionTime = candles[90].time;
const collisionIso = new Date(collisionTime * 1000).toISOString();
const expiresAt = "2026-08-05T00:00:00.000Z";

const primaryCondition = {
  id: "primary",
  kind: "price_cross_above",
  role: "primary",
  timeframe: "15m",
  label: "1차 확인",
  threshold: 180,
  expiresAt
} as const;

const basicSnapshot = {
  id: "basic",
  symbol: "BTCUSDT",
  chart: { timeframe: "15m", candles },
  summary: { primaryCondition },
  publicEvidence: {
    timeframe: "15m",
    events: {
      msb: { direction: "bullish", level: 175, occurredAt: collisionIso, ageBars: 5 },
      choch: { direction: "bullish", level: 176, occurredAt: collisionIso, ageBars: 5 }
    }
  }
} as unknown as PerpetualDecisionSnapshot;

const basicModel = buildPerpetualChartOverlayModel(basicSnapshot);
assert.equal(basicModel.lines.length, 1, "Basic receives only its public primary condition line");
assert.equal(basicModel.legendItems.filter((item) => item.group === "zone").length, 0, "Basic never gains Pro zones through the view model");
assert.equal(basicModel.lines[0].lineWidth, 2);
assert.equal(basicModel.lines[0].axisLabelVisible, true);

const basicOneHourModel = buildPerpetualChartOverlayModel(basicSnapshot, "1h");
assert.equal(basicOneHourModel.lines.length, 0, "Basic context charts do not inherit the 15-minute condition line");
assert.equal(basicOneHourModel.markers.length, 0, "Basic context charts do not gain Pro signal details");

const basicMarkers = resolvePerpetualChartMarkers(basicModel.markers, candles.slice(-48).map((candle) => candle.time));
assert.equal(basicMarkers.length, 2, "same-candle MSB and CHoCH must both remain visible");
assert.notEqual(basicMarkers[0].position, basicMarkers[1].position, "same-side marker collisions move CHoCH to the opposite side");
assert.equal(buildPerpetualSignalLegendItems(basicMarkers).length, 2);
const legacySignalLegend = buildPerpetualSignalLegendItems(basicMarkers, undefined, true);
assert.match(legacySignalLegend.find((item) => item.id === "signal-msb")?.label ?? "", /MSB\(구조 흐름\)/);
assert.match(legacySignalLegend.find((item) => item.id === "signal-choch")?.label ?? "", /CHoCH\(전환 신호\)/);

const mssOnlyModel = buildPerpetualChartOverlayModel({
  ...basicSnapshot,
  publicEvidence: {
    timeframe: "15m",
    events: {
      mss: { direction: "bullish", level: 174, occurredAt: collisionIso, ageBars: 5 },
      msb: null,
      choch: null
    }
  }
} as unknown as PerpetualDecisionSnapshot);
const mssMarker = resolvePerpetualChartMarkers(mssOnlyModel.markers, candles.map((candle) => candle.time))[0];
assert.equal(mssMarker?.kind, "mss", "qualified MSS must have its own chart marker");
assert.equal(mssMarker?.shape, "square");
assert.match(buildPerpetualSignalLegendItems([mssMarker])[0]?.label ?? "", /MSS\(구조 확정\)/);

const oneOldSignalModel = buildPerpetualChartOverlayModel({
  ...basicSnapshot,
  publicEvidence: {
    timeframe: "15m",
    events: {
      msb: { direction: "bullish", level: 175, occurredAt: new Date(candles[20].time * 1000).toISOString(), ageBars: 75 },
      choch: { direction: "bullish", level: 176, occurredAt: collisionIso, ageBars: 5 }
    }
  }
} as unknown as PerpetualDecisionSnapshot);
const allSignals = resolvePerpetualChartMarkers(oneOldSignalModel.markers, candles.map((candle) => candle.time));
const visibleSignals = resolvePerpetualChartMarkers(oneOldSignalModel.markers, candles.slice(-48).map((candle) => candle.time));
const allSignalLegend = buildPerpetualSignalLegendItems(allSignals, new Set(visibleSignals.map((marker) => marker.id)));
assert.equal(allSignalLegend.length, 2, "signals outside the current 48-candle plot remain available in the external legend");
assert.equal(allSignalLegend.find((item) => item.id === "signal-msb")?.outsideVisibleRange, true);
assert.match(allSignalLegend.find((item) => item.id === "signal-msb")?.value ?? "", /\d{2}\. \d{2}\./, "signal legends include their KST occurrence time");

const details = {
  events: {
    msb: { direction: "bullish", level: 175, occurredAt: collisionIso, ageBars: 5 },
    choch: { direction: "bullish", level: 176, occurredAt: collisionIso, ageBars: 5 },
    sweep: null,
    cisd: null
  },
  zones: {
    orderBlock: { direction: "bullish", top: 90, bottom: 110, occurredAt: collisionIso, ageBars: 5, isInside: false },
    fvg: { direction: "bearish", top: 140, bottom: 130, occurredAt: collisionIso, ageBars: 5, isInside: true, state: "fvg" }
  },
  location: {
    premiumDiscount: null,
    dealingRange: null,
    poc: { poc: 125 },
    oteZone: null,
    oteLevels: null
  },
  indicators: {
    rsi14: null,
    rsiState: "neutral",
    macdState: "neutral",
    atrPercent: null,
    volatilityState: "normal",
    volumeRatio: null,
    volumeState: "normal",
    bollingerPosition: "middle"
  }
};

const proSnapshot = {
  ...basicSnapshot,
  id: "pro",
  pro: {
    confirmationConditions: [{ ...primaryCondition, id: "confirmation", role: "confirmation", threshold: 190 }],
    invalidationConditions: [
      { ...primaryCondition, id: "invalidation", role: "invalidation", threshold: 160 },
      { ...primaryCondition, id: "invalid-null", role: "invalidation", threshold: null }
    ],
    multiTimeframeEvidence: [{ timeframe: "15m", details }]
  }
} as unknown as PerpetualDecisionSnapshot;

const proModel = buildPerpetualChartOverlayModel(proSnapshot);
assert.equal(proModel.legendItems.filter((item) => item.group === "condition").length, 3, "null conditions are omitted");
assert.equal(proModel.legendItems.filter((item) => item.group === "zone").length, 3, "OB, FVG, and POC each use one readable legend item");
assert.equal(proModel.lines.length, 8, "three conditions, four range edges, and POC are drawn");
assert.equal(proModel.lines.filter((line) => line.axisLabelVisible).length, 1, "only the primary line keeps an axis label");
assert.equal(proModel.legendItems.find((item) => item.id === "order-block")?.value, "90–110", "reversed range input is normalized");
assert.deepEqual(
  proModel.lines.find((line) => line.id === "condition-primary"),
  {
    id: "condition-primary",
    group: "condition",
    label: "판단 기준",
    detailLabel: "다음 판단 기준",
    price: 180,
    color: "#fbbf24",
    lineWidth: 2,
    lineStyle: "solid",
    axisLabelVisible: true
  },
  "primary line keeps the sole axis label and the strongest stroke"
);
assert.equal(proModel.lines.find((line) => line.id === "condition-confirmation")?.lineStyle, "dashed");
assert.equal(proModel.lines.find((line) => line.id === "condition-confirmation")?.color, "#60a5fa");
assert.equal(proModel.lines.find((line) => line.id === "condition-invalidation")?.detailLabel, "해석 재확인");
assert.equal(proModel.lines.find((line) => line.id === "condition-invalidation")?.color, "#fb7185");
assert.equal(proModel.lines.find((line) => line.id === "order-block-top")?.detailLabel, "큰 주문 구간 위");
assert.equal(proModel.lines.find((line) => line.id === "fvg-bottom")?.detailLabel, "빠른 이동 구간 아래");
assert.equal(proModel.lines.find((line) => line.id === "poc")?.lineStyle, "dotted");
assert.equal(proModel.lines.find((line) => line.id === "poc")?.detailLabel, "거래 집중 가격");

const oneHourDetails = {
  ...details,
  events: {
    ...details.events,
    msb: { direction: "bearish", level: 150, occurredAt: collisionIso, ageBars: 2 },
    choch: null
  }
};
const contextSnapshot = {
  ...proSnapshot,
  pro: {
    confirmationConditions: [
      { ...primaryCondition, id: "confirmation-15m", role: "confirmation", threshold: 190 },
      { ...primaryCondition, id: "confirmation-1h", role: "confirmation", timeframe: "1h", threshold: 200 }
    ],
    invalidationConditions: [],
    multiTimeframeEvidence: [
      { timeframe: "15m", details },
      { timeframe: "1h", details: oneHourDetails }
    ]
  }
} as unknown as PerpetualDecisionSnapshot;
const oneHourModel = buildPerpetualChartOverlayModel(contextSnapshot, "1h");
assert.equal(oneHourModel.legendItems.filter((item) => item.group === "condition").length, 1, "context charts use only same-timeframe conditions");
assert.equal(oneHourModel.legendItems.filter((item) => item.group === "zone").length, 3, "Pro context charts use same-timeframe zones");
assert.equal(oneHourModel.markers.length, 1, "Pro context charts use same-timeframe structure signals");
assert.equal(oneHourModel.markers[0]?.level, 150);

assert.equal(compactPerpetualCandleLimit(360), 48);
assert.equal(compactPerpetualCandleLimit(767), 48);
assert.equal(compactPerpetualCandleLimit(768), 96);
assert.equal(compactPerpetualCandleLimit(1440), 96);

console.log("Perpetual chart overlay contract passed.");
