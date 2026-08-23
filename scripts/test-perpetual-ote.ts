import assert from "node:assert/strict";
import {
  detectConfirmedCommonRangeOteV1 as detectConfirmedCommonRangeOteRaw,
  selectConfirmedCommonRangePivotType
} from "../src/lib/confirmedCommonRangeOte";
import type { Candle } from "../src/lib/marketAnalysis";

const hour = 60 * 60;
const quarterHour = 15 * 60;
const start = Date.parse("2026-08-01T00:00:00.000Z") / 1_000;

function candle(index: number, high: number, low: number, close: number, open = close): Candle {
  return {
    time: start + index * hour,
    open,
    high,
    low,
    close,
    volume: 1_000 + index
  };
}

const firstRange: Candle[] = [
  candle(0, 140, 120, 130),
  candle(1, 130, 110, 120),
  candle(2, 125, 100, 105),
  candle(3, 145, 108, 130),
  candle(4, 160, 115, 150),
  candle(5, 200, 130, 190),
  candle(6, 180, 125, 170),
  candle(7, 170, 120, 160)
];

function probe(openOffsetSeconds: number, high: number, low: number, close = (high + low) / 2): Candle {
  return {
    time: start + openOffsetSeconds,
    open: close,
    high,
    low,
    close,
    volume: 100
  };
}

type DetectInput = Omit<Parameters<typeof detectConfirmedCommonRangeOteRaw>[0], "asOfMs"> & { asOfMs?: number };

function detectConfirmedCommonRangeOteV1(input: DetectInput) {
  const latestSource = input.sourceCandles.at(-1);
  const sourceClosedAt = latestSource ? (latestSource.time * 1_000) + hour * 1_000 : 0;
  const probeClosedAt = input.latestClosed15m ? (input.latestClosed15m.time * 1_000) + quarterHour * 1_000 : 0;
  return detectConfirmedCommonRangeOteRaw({
    ...input,
    asOfMs: input.asOfMs ?? Math.max(sourceClosedAt, probeClosedAt)
  });
}

const beforeSecondPivotConfirmation = detectConfirmedCommonRangeOteV1({
  symbol: "BTCUSDT",
  sourceCandles: firstRange.slice(0, 7),
  latestClosed15m: probe(7 * hour, 170, 120)
});
assert.equal(beforeSecondPivotConfirmation, null, "a range must wait for both right-side pivot confirmation bars");

const confirmedAtSeconds = start + 8 * hour;
const confirmed = detectConfirmedCommonRangeOteV1({
  symbol: "BTCUSDT",
  sourceCandles: firstRange,
  latestClosed15m: probe(8 * hour, 135, 125)
});
assert.ok(confirmed, "an alternating confirmed pivot pair must publish a range");
assert.equal(confirmed.rangeLow, 100);
assert.equal(confirmed.rangeHigh, 200);
assert.equal(confirmed.confirmedAt, new Date(confirmedAtSeconds * 1_000).toISOString());
assert.equal(confirmed.rangeId, `BTCUSDT|1h|${confirmed.confirmedAt}`);
assert.equal(confirmed.ageBars, 0);
assert.equal(confirmed.historyMode, "bounded-replay");
assert.equal(confirmed.exactPineStateParity, false);
assert.equal(confirmed.long.low, 121);
assert.equal(confirmed.long.high, 138);
assert.equal(confirmed.long.ideal, 129.5);
assert.equal(confirmed.short.low, 162);
assert.equal(confirmed.short.high, 179);
assert.equal(confirmed.short.ideal, 170.5);
assert.equal(confirmed.activeZone, "long");
assert.equal(confirmed.long.touchedByLatestClosed15m, true);
assert.equal(confirmed.short.touchedByLatestClosed15m, false);

const noRetroactiveTouch = detectConfirmedCommonRangeOteV1({
  symbol: "BTCUSDT",
  sourceCandles: firstRange,
  latestClosed15m: probe(confirmedAtSeconds - start - quarterHour, 135, 125)
});
assert.equal(noRetroactiveTouch?.activeZone, "none", "a 15-minute bar opened before range publication must not gain a retroactive touch");

const bothTouched = detectConfirmedCommonRangeOteV1({
  symbol: "BTCUSDT",
  sourceCandles: firstRange,
  latestClosed15m: probe(8 * hour, 170, 130)
});
assert.equal(bothTouched?.activeZone, "both", "one closed 15-minute candle may cross both bands");

const longInvalidatedCandles = [
  ...firstRange,
  candle(8, 160, 95, 99)
];
const longInvalidated = detectConfirmedCommonRangeOteV1({
  symbol: "BTCUSDT",
  sourceCandles: longInvalidatedCandles,
  latestClosed15m: probe(9 * hour, 135, 125)
});
assert.equal(longInvalidated?.long.valid, false, "a closed 1-hour candle below the range must invalidate only the long band");
assert.equal(longInvalidated?.short.valid, true);
assert.equal(longInvalidated?.activeZone, "none", "an invalid side must not report a touch");

const shortInvalidated = detectConfirmedCommonRangeOteV1({
  symbol: "BTCUSDT",
  sourceCandles: [...firstRange, candle(8, 205, 130, 201)],
  latestClosed15m: probe(9 * hour, 170, 165)
});
assert.equal(shortInvalidated?.long.valid, true);
assert.equal(shortInvalidated?.short.valid, false, "a closed 1-hour candle above the range must invalidate only the short band");

const stickyInvalidation = detectConfirmedCommonRangeOteV1({
  symbol: "BTCUSDT",
  sourceCandles: [...longInvalidatedCandles, candle(9, 170, 120, 150)],
  latestClosed15m: probe(10 * hour, 135, 125)
});
assert.equal(stickyInvalidation?.long.valid, false, "returning inside the range must not revive an invalid side");

const exactEndpoints = detectConfirmedCommonRangeOteV1({
  symbol: "BTCUSDT",
  sourceCandles: [...firstRange, candle(8, 160, 100, 100), candle(9, 200, 120, 200)],
  latestClosed15m: probe(10 * hour, 170, 130)
});
assert.equal(exactEndpoints?.long.valid, true, "a close exactly on the low endpoint remains valid");
assert.equal(exactEndpoints?.short.valid, true, "a close exactly on the high endpoint remains valid");

const moreExtremeHighCandles = [
  ...firstRange,
  candle(8, 180, 130, 160),
  candle(9, 220, 140, 210),
  candle(10, 190, 135, 180),
  candle(11, 180, 130, 170)
];
const republished = detectConfirmedCommonRangeOteV1({
  symbol: "BTCUSDT",
  sourceCandles: moreExtremeHighCandles,
  latestClosed15m: probe(12 * hour, 150, 140)
});
assert.equal(republished?.rangeHigh, 220, "a more extreme same-side pivot must republish against the remembered opposite pivot");
assert.equal(republished?.ageBars, 0);
assert.equal(republished?.short.valid, true, "publishing a higher range resets the prior short invalidation when its confirmation closes stay inside");

const republishedLower = detectConfirmedCommonRangeOteV1({
  symbol: "BTCUSDT",
  sourceCandles: [
    ...firstRange,
    candle(8, 160, 95, 99),
    candle(9, 170, 110, 130),
    candle(10, 180, 115, 140)
  ],
  latestClosed15m: probe(11 * hour, 120, 115)
});
assert.equal(republishedLower?.rangeLow, 95, "a more extreme low must republish against the remembered high");
assert.equal(republishedLower?.long.valid, true, "publishing a lower range resets the prior long invalidation when its confirmation closes stay inside");

const invalidOnConfirmation = detectConfirmedCommonRangeOteV1({
  symbol: "BTCUSDT",
  sourceCandles: firstRange.map((item, index) => index === 6 ? candle(6, 180, 90, 95) : item),
  latestClosed15m: probe(8 * hour, 135, 125)
});
assert.equal(invalidOnConfirmation?.long.valid, false, "the confirmation window must immediately invalidate a side that already closed outside the new range");

const filler = Array.from({ length: 24 }, (_, offset) => candle(8 + offset, 170, 120, 150));
const age23 = detectConfirmedCommonRangeOteV1({
  symbol: "BTCUSDT",
  sourceCandles: [...firstRange, ...filler.slice(0, 23)],
  latestClosed15m: probe(31 * hour, 135, 125)
});
assert.equal(age23?.ageBars, 23, "range age 23 remains valid");
assert.equal(
  detectConfirmedCommonRangeOteV1({
    symbol: "BTCUSDT",
    sourceCandles: [...firstRange, ...filler],
    latestClosed15m: probe(32 * hour, 135, 125)
  }),
  null,
  "range age 24 expires"
);

assert.equal(selectConfirmedCommonRangePivotType(true, true, 0), 0, "an outside pivot without history must be ignored");
assert.equal(selectConfirmedCommonRangePivotType(true, true, -1), 1, "an outside pivot after a low must select the high");
assert.equal(selectConfirmedCommonRangePivotType(true, true, 1), -1, "an outside pivot after a high must select the low");

assert.equal(
  detectConfirmedCommonRangeOteRaw({
    symbol: "BTCUSDT",
    sourceCandles: firstRange,
    latestClosed15m: null,
    asOfMs: confirmedAtSeconds * 1_000 - 1
  }),
  null,
  "an input that still contains an open 1-hour candle must be rejected"
);
assert.equal(
  detectConfirmedCommonRangeOteRaw({
    symbol: "BTCUSDT",
    sourceCandles: firstRange,
    latestClosed15m: null,
    asOfMs: (confirmedAtSeconds + hour) * 1_000 + 500
  })?.rangeId,
  confirmed.rangeId,
  "the Binance parser's one-second just-closed safety window must retain the previous canonical source bar"
);
assert.equal(
  detectConfirmedCommonRangeOteRaw({
    symbol: "BTCUSDT",
    sourceCandles: firstRange,
    latestClosed15m: null,
    asOfMs: (confirmedAtSeconds + hour) * 1_000 + 1_000
  }),
  null,
  "a stale source tail must not freeze the Pine 24-bar TTL at an old age"
);
assert.equal(
  detectConfirmedCommonRangeOteV1({
    symbol: "BTCUSDT",
    sourceCandles: firstRange.filter((_, index) => index !== 1),
    latestClosed15m: null
  }),
  null,
  "a gapped series must not be presented as a 1-hour closed-candle replay"
);

console.log("Coters v2.48 confirmed common-range OTE fixture matrix passed.");
