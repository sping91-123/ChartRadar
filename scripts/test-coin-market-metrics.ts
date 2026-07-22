import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  calculateKimchiPremium,
  canReuseCachedUsdKrw,
  canServeCoinMarketMetricsCache,
  classifyExchangeRateDevFreshness,
  finitePositiveNumber,
  isAcceptableFxObservation,
  isRecentObservation,
  isRecentReferenceDate,
  marketObservationsAreActionable,
  observationsAreAligned,
  resolveCoinMarketMetrics,
  type CoinMarketMetricObservations,
  type FxMetricObservation
} from "../src/lib/coinMarketMetrics";

assert.equal(finitePositiveNumber(null), null, "null must not silently become zero");
assert.equal(finitePositiveNumber(""), null, "an empty response must not silently become zero");
assert.equal(finitePositiveNumber(true), null, "booleans are not numeric market data");
assert.equal(finitePositiveNumber("1482.34"), 1482.34);
assert.equal(finitePositiveNumber(-1), null);

const premium = calculateKimchiPremium({
  upbitBtcKrw: 96_750_000,
  binanceBtcUsdt: 66_074.43,
  usdtUsd: 0.99915,
  usdKrw: 1_482.341175
});
const expectedPremium = (96_750_000 / (66_074.43 * 0.99915 * 1_482.341175) - 1) * 100;
assert.ok(premium !== null);
assert.ok(Math.abs(premium - expectedPremium) < 0.000001, "kimchi premium must include the observed USDT/USD rate");
assert.equal(
  calculateKimchiPremium({ upbitBtcKrw: 96_750_000, binanceBtcUsdt: 66_000, usdtUsd: null, usdKrw: 1_480 }),
  null,
  "USDT/USD must fail closed instead of silently assuming one dollar"
);

const now = Date.parse("2026-07-22T05:30:00.000Z");
assert.equal(isRecentObservation("2026-07-22T05:29:00.000Z", now, 2 * 60_000), true);
assert.equal(isRecentObservation("2026-07-22T05:27:59.999Z", now, 2 * 60_000), false);
assert.equal(isRecentObservation("2026-07-22T05:32:00.000Z", now, 2 * 60_000), false);
assert.equal(observationsAreAligned("2026-07-22T05:29:00.000Z", "2026-07-22T05:30:30.000Z", 2 * 60_000), true);
assert.equal(observationsAreAligned("2026-07-22T05:27:00.000Z", "2026-07-22T05:30:30.000Z", 2 * 60_000), false);
assert.equal(isRecentReferenceDate("2026-07-21", now), true);
assert.equal(isRecentReferenceDate("2026-07-17", now), false);
assert.equal(isRecentReferenceDate("2026-02-30", Date.parse("2026-03-01T05:30:00.000Z")), false, "invalid calendar dates must be rejected");
assert.equal(isRecentReferenceDate("2026-07-23", now), false, "future reference dates must be rejected");

assert.equal(classifyExchangeRateDevFreshness("live"), "live");
assert.equal(classifyExchangeRateDevFreshness("ecb_daily"), "daily");
assert.equal(classifyExchangeRateDevFreshness("fred_daily"), "daily");
assert.equal(classifyExchangeRateDevFreshness(undefined), null);
assert.equal(classifyExchangeRateDevFreshness("unexpected"), null, "unknown FX provenance must fail closed");

const hourlyFx: FxMetricObservation = {
  value: 1_482.341175,
  source: "exchangerate-fun",
  observedAt: "2026-07-22T05:00:00.000Z",
  referenceDate: null,
  freshness: "hourly"
};
assert.equal(isAcceptableFxObservation(hourlyFx, now), true);
assert.equal(isAcceptableFxObservation(hourlyFx, Date.parse("2026-07-22T06:31:00.000Z")), false, "hourly data is not current after 90 minutes");
assert.equal(isAcceptableFxObservation({ ...hourlyFx, source: "exchangerate-dev", freshness: "live" }, now), false, "live data is not current after ten minutes");
assert.equal(
  isAcceptableFxObservation({ value: 1_478.4, source: "frankfurter", observedAt: null, referenceDate: "2026-07-21", freshness: "daily" }, now),
  true
);

const alignedMarketTimes = [
  "2026-07-22T05:29:50.000Z",
  "2026-07-22T05:29:40.000Z",
  "2026-07-22T05:29:30.000Z"
];
assert.equal(marketObservationsAreActionable(alignedMarketTimes, now), true);
assert.equal(marketObservationsAreActionable([alignedMarketTimes[0], "2026-07-22T05:27:00.000Z", alignedMarketTimes[2]], now), false);
assert.equal(marketObservationsAreActionable([alignedMarketTimes[0], "bad-time", alignedMarketTimes[2]], now), false);
assert.equal(marketObservationsAreActionable([alignedMarketTimes[0], "2026-07-22T05:32:00.000Z", alignedMarketTimes[2]], now), false);

const readyObservations: CoinMarketMetricObservations = {
  fx: hourlyFx,
  upbitBtc: { value: 96_750_000, observedAt: alignedMarketTimes[0] },
  binanceBtcUsdt: { value: 66_074.43, observedAt: alignedMarketTimes[1] },
  coinbaseUsdtUsd: { value: 0.99915, observedAt: alignedMarketTimes[2] }
};
const freshPayload = resolveCoinMarketMetrics({ observations: readyObservations, cachedPayload: null, nowMs: now });
assert.ok(freshPayload.kimchiPremiumPercent !== null);
assert.ok(Math.abs(freshPayload.kimchiPremiumPercent - expectedPremium) < 0.000001);
assert.equal(freshPayload.kimchiSource, "upbit-binance-spot-coinbase-usdt-usd");
assert.equal(freshPayload.kimchiUsdtUsdRate, 0.99915);
assert.equal(freshPayload.kimchiUsdtUsdObservedAt, alignedMarketTimes[2]);
assert.equal(freshPayload.kimchiFxRate, hourlyFx.value);
assert.equal(freshPayload.kimchiFxSource, "exchangerate-fun");
assert.equal(freshPayload.kimchiFxFreshness, "hourly");
assert.equal(freshPayload.kimchiFxCadence, "hourly");
assert.equal(freshPayload.kimchiObservedAt, alignedMarketTimes[2]);
assert.equal(freshPayload.kimchiStale, false);
assert.equal(freshPayload.stale, false);

assert.equal(canServeCoinMarketMetricsCache(freshPayload, now + 59_999, 60_000), true);
assert.equal(canServeCoinMarketMetricsCache(freshPayload, now + 60_000, 60_000), false);
assert.equal(canServeCoinMarketMetricsCache(freshPayload, now - 1, 60_000), false, "future cache timestamps must not be served");
assert.equal(canReuseCachedUsdKrw(freshPayload, now + 2 * 60 * 60_000), true);
assert.equal(canReuseCachedUsdKrw(freshPayload, now + 3 * 60 * 60_000), false);

const partialFallback = resolveCoinMarketMetrics({
  observations: { fx: hourlyFx, upbitBtc: null, binanceBtcUsdt: null, coinbaseUsdtUsd: null },
  cachedPayload: freshPayload,
  nowMs: now + 5 * 60_000
});
assert.equal(partialFallback.kimchiPremiumPercent, freshPayload.kimchiPremiumPercent);
assert.equal(partialFallback.kimchiCalculatedAt, freshPayload.kimchiCalculatedAt, "fallback age must keep the original calculation time");
assert.equal(partialFallback.kimchiFxRate, freshPayload.kimchiFxRate);
assert.equal(partialFallback.kimchiFxSource, freshPayload.kimchiFxSource);
assert.equal(partialFallback.kimchiFxFreshness, "stale", "a cached premium must never keep a live/hourly freshness label");
assert.equal(partialFallback.kimchiFxCadence, "hourly");
assert.equal(partialFallback.kimchiUsdtUsdRate, freshPayload.kimchiUsdtUsdRate);
assert.equal(partialFallback.kimchiStale, true);
assert.equal(partialFallback.stale, true);

const expiredFallback = resolveCoinMarketMetrics({
  observations: { fx: null, upbitBtc: null, binanceBtcUsdt: null, coinbaseUsdtUsd: null },
  cachedPayload: partialFallback,
  nowMs: now + 16 * 60_000
});
assert.equal(expiredFallback.kimchiPremiumPercent, null, "repeated failures must not extend a stale premium indefinitely");

const laterNow = now + 2 * 60 * 60_000;
const staleFxWithFreshMarkets = resolveCoinMarketMetrics({
  observations: {
    fx: null,
    upbitBtc: { value: 96_700_000, observedAt: new Date(laterNow - 10_000).toISOString() },
    binanceBtcUsdt: { value: 66_000, observedAt: new Date(laterNow - 20_000).toISOString() },
    coinbaseUsdtUsd: { value: 0.9992, observedAt: new Date(laterNow - 30_000).toISOString() }
  },
  cachedPayload: freshPayload,
  nowMs: laterNow
});
assert.ok(staleFxWithFreshMarkets.kimchiPremiumPercent !== null);
assert.equal(staleFxWithFreshMarkets.usdKrwFreshness, "stale");
assert.equal(staleFxWithFreshMarkets.kimchiFxFreshness, "stale");
assert.equal(staleFxWithFreshMarkets.kimchiFxRate, freshPayload.usdKrw);
assert.equal(staleFxWithFreshMarkets.kimchiStale, true);

const frankfurterPayload = resolveCoinMarketMetrics({
  observations: {
    ...readyObservations,
    fx: { value: 1_478.4, source: "frankfurter", observedAt: null, referenceDate: "2026-07-21", freshness: "daily" }
  },
  cachedPayload: null,
  nowMs: now
});
assert.equal(frankfurterPayload.usdKrwObservedAt, null, "date-only providers must not fabricate a midnight timestamp");
assert.equal(frankfurterPayload.usdKrwReferenceDate, "2026-07-21");
assert.equal(frankfurterPayload.kimchiFxReferenceDate, "2026-07-21");

const unavailablePayload = resolveCoinMarketMetrics({
  observations: { fx: null, upbitBtc: null, binanceBtcUsdt: null, coinbaseUsdtUsd: null },
  cachedPayload: null,
  nowMs: now
});
assert.equal(unavailablePayload.usdKrw, null);
assert.equal(unavailablePayload.usdKrwFreshness, "unavailable");
assert.equal(unavailablePayload.kimchiPremiumPercent, null);
assert.ok(unavailablePayload.warnings.includes("Coinbase USDT/USD 확인 제한"));

const routeSource = readFileSync(join(process.cwd(), "src/app/api/coin-market-metrics/route.ts"), "utf8");
assert.doesNotMatch(routeSource, /fapi\.binance\.com|fapi\/v1/, "kimchi premium must never substitute a futures price");
assert.match(routeSource, /data-api\.binance\.vision\/api\/v3\/ticker\/24hr/, "Binance spot must be the canonical offshore price");
assert.match(routeSource, /KRW-BTC/, "Upbit KRW-BTC spot must be the domestic price");
assert.match(routeSource, /trade_timestamp/, "Upbit source time must be retained");
assert.match(routeSource, /closeTime/, "Binance source time must be retained");
assert.match(routeSource, /api\.exchange\.coinbase\.com\/products\/USDT-USD\/ticker/, "USDT/USD must be observed instead of assumed");
assert.match(routeSource, /ticker\.price/, "Coinbase conversion value and its trade timestamp must describe the same observation");
assert.match(routeSource, /ticker\.bid/);
assert.match(routeSource, /ticker\.ask/);
assert.match(routeSource, /ticker\.time/);
assert.match(routeSource, /api\.exchangerate\.fun/, "the hourly no-key FX source must replace a daily-only primary rate");
assert.doesNotMatch(routeSource, /payload\.date\}T00/, "a date-only FX source must not be serialized as a fake time");
assert.match(routeSource, /resolveCoinMarketMetrics/, "provider failures must pass through the tested deterministic resolver");

const panelSource = readFileSync(join(process.cwd(), "src/components/coin/CoinMarketEnvironmentPanel.tsx"), "utf8");
assert.match(panelSource, /CRYPTOCAP:BTC\.D/, "the displayed dominance must use the user-confirmed TradingView BTC.D definition");
assert.match(panelSource, /FX_IDC:USDKRW/, "the displayed FX rate must use the TradingView USDKRW ticker");
assert.match(panelSource, /60_000/, "market metrics must refresh without requiring a manual reload");
assert.match(panelSource, /formatKrw\(metrics\?\.kimchiFxRate\)/, "the UI must show the frozen FX input beside a cached premium");
assert.match(panelSource, /metrics\?\.kimchiFxFreshness/, "cached kimchi metadata must use its frozen freshness state");
assert.match(panelSource, /Coinbase 체결가/, "the UI must disclose the USDT/USD conversion source and price type");
assert.doesNotMatch(panelSource, /자금이 더 몰리는/, "dominance copy must not claim unproved capital-flow causality");

const widgetSource = readFileSync(join(process.cwd(), "src/components/coin/TradingViewSingleTicker.tsx"), "utf8");
assert.match(widgetSource, /style\.height = "89px"/);
assert.match(widgetSource, /min-h-\[89px\]/, "the TradingView attribution must not be clipped");
assert.match(widgetSource, /role="group"/, "the custom widget needs an accessible group label");
assert.match(widgetSource, /script\[\$\{SCRIPT_MARKER\}\].*remove/, "a failed widget script must be removable for retry");
assert.match(widgetSource, /다시 불러오기/, "a transient widget failure needs an in-session retry");

console.log("Coin market metrics accuracy and fallback matrix passed.");
