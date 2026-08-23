import assert from "node:assert/strict";
import {
  calculatePineParityScore,
  parsePineSnapshot,
  pineChartBasisComparable,
  pineDirectionBasisComparable,
  pineDirectionComparisonForTimeframe,
  pineDirectionSampleForTimeframe,
  pineEmaComparison,
  pineOteComparison,
  pineSymbolBasisComparable
} from "../src/lib/pineParity";

const appSymbol = "BTCUSDT.P";

const v248 = parsePineSnapshot(JSON.stringify({
  schemaVersion: "2.0",
  symbol: "BINANCE:BTCUSDT.P",
  barConfirmed: true,
  chartTf: "15",
  confirmedRequested: true,
  msb: { "15m": "bullish", "4h": "bearish" },
  choch: { "15m": "unknown", "4h": "bearish" },
  mtfReliable: { "15m": false, "4h": true },
  biasTf: "240",
  emaLength: 100,
  emaSide: "above",
  ema200SideDeprecated: true,
  ema200Side: "above",
  oteZone: "both",
  ote: {
    tf: "60",
    tfReliable: true,
    closedOnly: true,
    mode: "Confirmed Swing Pair",
    zone: "both",
    longValid: true,
    shortValid: true,
    longLow: 100,
    longHigh: 200,
    shortLow: 100,
    shortHigh: 200
  }
}));
assert.ok(v248);
assert.equal(v248.oteZone, "both", "v2.48 both-zone payloads must remain distinguishable");
assert.deepEqual(
  pineDirectionSampleForTimeframe(v248.msb, "15m", v248.mtfReliable),
  { direction: "unknown", comparable: false, reason: "unreliable" },
  "an explicitly unreliable lower-timeframe sample must not enter the parity score"
);
assert.deepEqual(
  pineDirectionSampleForTimeframe(v248.msb, "4h", v248.mtfReliable),
  { direction: "bearish", comparable: true, reason: "ok" }
);
assert.equal(pineDirectionBasisComparable(v248, "4h", "confirmed", appSymbol), true, "a confirmed higher-TF request can be compared in confirmed app mode");
assert.equal(pineDirectionBasisComparable({ ...v248, confirmedRequested: false }, "4h", "confirmed", appSymbol), false, "a developing higher-TF request must be excluded");
assert.equal(pineDirectionBasisComparable(v248, "4h", "aggressive", appSymbol), false, "closed Pine structure must not be scored against an in-progress app bar");
assert.equal(pineDirectionBasisComparable({ ...v248, barConfirmed: false }, "15m", "confirmed", appSymbol), false);
assert.equal(pineChartBasisComparable(v248, "15m", "confirmed", appSymbol), true);
assert.equal(pineChartBasisComparable(v248, "4h", "confirmed", appSymbol), false, "chart-local rows cannot cross timeframes");
assert.equal(pineSymbolBasisComparable(v248, appSymbol), true);
assert.equal(pineSymbolBasisComparable({ ...v248, symbol: "BINANCE:ETHUSDT.P" }, appSymbol), false);
assert.equal(pineSymbolBasisComparable({ ...v248, symbol: "BYBIT:BTCUSDT.P" }, appSymbol), false);
assert.equal(pineSymbolBasisComparable({ ...v248, symbol: "BINANCE:BTCUSDT" }, appSymbol), false, "spot and perpetual contracts must not be mixed");
assert.equal(pineSymbolBasisComparable({ market: 1 }, appSymbol), true, "symbol-less legacy payloads retain their previous behavior");
const v248Ema = pineEmaComparison(v248, "4h", "confirmed", appSymbol);
assert.equal(v248Ema.side, "above");
assert.equal(v248Ema.length, 100);
assert.equal(v248Ema.label, "Pine EMA100");
assert.equal(v248Ema.comparable, false, "a deprecated EMA100 alias must not be scored against the app EMA200");
const v248Ote = pineOteComparison(v248, "15m", "confirmed", appSymbol);
assert.equal(v248Ote.zone, "both");
assert.equal(v248Ote.comparable, false, "confirmed common-range OTE must not be scored against rolling-20 OTE");

const alignedEma = parsePineSnapshot(JSON.stringify({
  barConfirmed: true,
  chartTf: "240",
  biasTf: "240",
  biasTfReliable: true,
  emaLength: 200,
  emaSmooth: "없음",
  emaSide: "below"
}));
assert.ok(alignedEma);
assert.equal(pineEmaComparison(alignedEma, "4h", "confirmed", appSymbol).comparable, true);
assert.equal(pineEmaComparison(alignedEma, "15m", "confirmed", appSymbol).comparable, false, "EMA source and chart timeframes must match the app row");
assert.equal(pineEmaComparison(alignedEma, "4h", "aggressive", appSymbol).comparable, false, "a closed Pine bar must not be scored against an in-progress app bar");

const crossTimeframeEma = parsePineSnapshot(JSON.stringify({
  barConfirmed: true,
  chartTf: "15",
  biasTf: "240",
  biasTfReliable: true,
  emaLength: 200,
  emaSmooth: "없음",
  emaSide: "below"
}));
assert.ok(crossTimeframeEma);
assert.equal(
  pineEmaComparison(crossTimeframeEma, "4h", "confirmed", appSymbol).comparable,
  false,
  "15-minute close versus 4-hour EMA is not the app's 4-hour close versus EMA comparison"
);
assert.equal(
  pineEmaComparison({ ...alignedEma, emaSmooth: undefined }, "4h", "confirmed", appSymbol).comparable,
  false,
  "v2.48 does not export smoothing, so its explicit EMA row remains informational"
);
assert.equal(pineEmaComparison({ ...alignedEma, biasTfReliable: false }, "4h", "confirmed", appSymbol).comparable, false);

const legacy = parsePineSnapshot('{"market":1,"ema200Side":"above","oteZone":"long"}');
assert.ok(legacy);
assert.equal(pineEmaComparison(legacy, "15m", "confirmed", appSymbol).comparable, true, "legacy EMA200-only payloads remain supported");
assert.equal(pineOteComparison(legacy, "15m", "confirmed", appSymbol).comparable, true, "legacy top-level OTE payloads retain their prior comparison behavior");
assert.equal(pineOteComparison(legacy, "15m", "aggressive", appSymbol).comparable, false, "legacy OTE has no in-progress-bar basis contract");

const rolling = parsePineSnapshot(JSON.stringify({
  barConfirmed: true,
  chartTf: "15",
  oteZone: "short",
  ote: {
    tf: "240",
    tfReliable: true,
    requestMode: "confirmed_htf",
    closedOnly: true,
    rangeLength: 20,
    mode: "Rolling Range (Legacy)",
    zone: "short"
  }
}));
assert.ok(rolling);
assert.equal(
  pineOteComparison(rolling, "15m", "confirmed", appSymbol).comparable,
  false,
  "the app and Pine v2.48 use different short-zone touch rules, so nested rolling OTE stays informational"
);
assert.equal(pineOteComparison(rolling, "4h", "confirmed", appSymbol).comparable, false, "the Pine touch-probe chart timeframe must match the active app row");
assert.equal(pineOteComparison({ ...rolling, ote: { ...rolling.ote, tf: "60" } }, "15m", "confirmed", appSymbol).comparable, false, "the app OTE anchor is 4 hours");
assert.equal(pineOteComparison({ ...rolling, ote: { ...rolling.ote, rangeLength: undefined } }, "15m", "confirmed", appSymbol).comparable, false, "v2.48 does not export its rolling length, so the basis cannot be proven");
assert.equal(pineOteComparison({ ...rolling, ote: { ...rolling.ote, mode: "Future Mode" } }, "15m", "confirmed", appSymbol).comparable, false);
assert.equal(pineOteComparison(rolling, "15m", "aggressive", appSymbol).comparable, false);

assert.deepEqual(
  pineDirectionComparisonForTimeframe(undefined, 1, "5m", undefined, "15"),
  { direction: "unknown", comparable: false, reason: "basis-mismatch" },
  "legacy scalar structure must not be substituted across chart timeframes"
);
assert.deepEqual(
  pineDirectionComparisonForTimeframe({ "15m": "bullish" }, 1, "5m", undefined, "15"),
  { direction: "unknown", comparable: false, reason: "missing" },
  "an explicit map missing its active key must not fall back to the chart scalar"
);
assert.deepEqual(
  pineDirectionSampleForTimeframe({ "4h": "unknown" }, "4h", { "4h": true }),
  { direction: "unknown", comparable: false, reason: "missing" },
  "unknown structure is not a comparable direction"
);

assert.equal(parsePineSnapshot("[]"), null, "arrays are not valid Pine snapshot objects");
assert.equal(parsePineSnapshot("null"), null, "null is not a valid Pine snapshot object");
assert.equal(parsePineSnapshot("market=1, ema200Side=below")?.market, 1, "legacy key-value input remains supported");

assert.equal(
  calculatePineParityScore([
    { comparable: true, matched: true, importance: "core" },
    { comparable: false, matched: false, importance: "major" }
  ]),
  100,
  "missing or unreliable rows must not lower the comparable parity score"
);
assert.equal(
  calculatePineParityScore([{ comparable: false, matched: false, importance: "core" }]),
  null,
  "an all-skipped payload has no parity score"
);

console.log("Pine snapshot schema and parity normalization matrix passed.");
