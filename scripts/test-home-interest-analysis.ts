import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { classifyCryptoHomeSnapshotQuality, findExchangeMarket } from "../src/lib/cryptoHomeSnapshotSafety";
import { filterClosedCandlesAt } from "../src/lib/marketTime";
import { serializeHomeInterestAnalysis, serializeLegacyHomeSnapshot } from "../src/lib/server/homeInterestAnalysis";
import { canonicalAssetForHomeCoin, homeInterestDetailTarget } from "../src/lib/homeInterestRouting";
import type { CryptoHomeSnapshot } from "../src/lib/server/cryptoExchangeData";

const candles = Array.from({ length: 80 }, (_, index) => ({
  time: 1_750_000_000 + index * 900,
  open: 100 + index,
  high: 102 + index,
  low: 99 + index,
  close: 101 + index,
  volume: 1_000 + index
}));

const source = {
  selection: {
    exchangeId: "binance",
    exchangeLabel: "Binance",
    symbol: "SOL/USDT:USDT",
    marketId: "SOLUSDT",
    base: "SOL",
    quote: "USDT",
    settle: "USDT",
    active: true
  },
  price: 179,
  changePercent: 2.3,
  chartCandles: candles,
  chartCandlesByTimeframe: {
    "15m": candles,
    "1h": candles.map((candle, index) => ({ ...candle, time: 1_750_000_000 + index * 3_600 })),
    "4h": candles.map((candle, index) => ({ ...candle, time: 1_750_000_000 + index * 14_400 }))
  },
  direction: "up",
  directionLabel: "상승세",
  compositeScore: 67,
  timeframes: [
    { timeframe: "5m", label: "5분", observedAt: "2026-08-03T23:55:00.000Z", msb: "bullish", choch: "bullish", score: 1, regime: "trendUp" },
    { timeframe: "15m", label: "15분", observedAt: "2026-08-03T23:45:00.000Z", msb: "bullish", choch: "neutral", score: 1.5, regime: "trendUp" },
    { timeframe: "1h", label: "1시간", observedAt: "2026-08-03T23:00:00.000Z", msb: "unknown", choch: "unknown", score: 0, regime: "range" },
    { timeframe: "4h", label: "4시간", observedAt: "2026-08-03T20:00:00.000Z", msb: "bearish", choch: "bearish", score: -1, regime: "trendDown" },
    { timeframe: "1d", label: "1일", observedAt: "2026-08-03T00:00:00.000Z", msb: "bullish", choch: "bullish", score: 2, regime: "trendUp" }
  ],
  pressure: {
    longScore: 63,
    shortScore: 37,
    dominant: "long",
    evidence: [
      { label: "펀딩", value: "0.01%", available: true },
      { label: "비공개 값", value: "-", available: false }
    ],
    source: "binance-public"
  },
  generatedAt: "2026-08-04T00:00:00.000Z",
  observedAt: "2026-08-03T23:45:00.000Z",
  expiresAt: "2026-08-04T00:01:00.000Z",
  quality: "ready",
  qualityDetail: "필요한 확정봉과 공개 파생 데이터를 정상 확인했습니다.",
  updatedAt: "2026-08-04T00:00:00.000Z"
} as unknown as CryptoHomeSnapshot;

const basic = serializeHomeInterestAnalysis(source, false);
assert.equal(basic.access, "basic");
assert.equal(basic.pro, undefined, "Basic response must omit the Pro object entirely");
assert.equal(basic.chart.candles.length, 64, "Home only needs a compact 15-minute window");
assert.deepEqual(Object.keys(basic.chart.candlesByTimeframe), ["15m", "1h", "4h"], "Home chart exposes only decision-engine timeframes");
assert.equal(basic.chart.candlesByTimeframe["1h"].length, 64, "Home bounds each context chart window");
assert.equal(basic.chart.candlesByTimeframe["4h"].length, 64, "Home bounds the four-hour chart window");
assert.deepEqual(basic.timeframes.map((item) => item.timeframe), ["5m", "15m", "1h", "4h", "1d"], "Home discloses every timeframe used by the direction score");
assert.match(basic.summary.headline, /기다릴 때/, "conflicting core timeframes must lead with a conservative decision");
assert.match(basic.summary.topRisk, /엇갈려/, "mixed timeframes must disclose the conflict before direction");
assert.match(basic.summary.nextCondition.label, /확정봉/, "the next check must name the candle-close contract");
assert.match(basic.summary.nextCondition.unmet, /판단을 보류|기다/, "the unmet path must explain the safer next action");
assert.equal(basic.generatedAt, source.generatedAt);
assert.equal(basic.observedAt, source.observedAt);
assert.equal(basic.expiresAt, source.expiresAt);
assert.equal(basic.quality, "ready");
assert.equal(basic.updatedAt, basic.generatedAt, "the compatibility alias remains the generation time");
assert.match(basic.pressure.sourceLabel, /Binance 공개/);

const pro = serializeHomeInterestAnalysis(source, true);
assert.equal(pro.access, "coin_pro");
assert.equal(pro.pro?.timeframes.length, 3);
assert.match(pro.pro?.insight.structure ?? "", /15분 상승/);
assert.doesNotMatch(pro.pro?.insight.structure ?? "", /[+-]\d+\.\d+/, "Home Pro insight must be semantic rather than a raw signed score");
assert.deepEqual(pro.pro?.pressure?.evidence, [{ label: "펀딩", value: "0.01%" }]);

const boundaryOpenMs = Date.UTC(2026, 7, 4, 0, 0, 0);
const boundaryCandles = [
  { ...candles[0], time: boundaryOpenMs / 1000 },
  { ...candles[1], time: boundaryOpenMs / 1000 + 900 }
];
const closedAtBoundary = filterClosedCandlesAt(boundaryCandles, "15m", boundaryOpenMs + 900_500);
assert.equal(closedAtBoundary.candles.length, 0, "the one-second close guard excludes a just-closing candle");
const closedAfterGuard = filterClosedCandlesAt(boundaryCandles, "15m", boundaryOpenMs + 901_000);
assert.equal(closedAfterGuard.candles.length, 1, "the candle is admitted once the close guard has elapsed");
assert.equal(closedAfterGuard.droppedIncomplete, 1);
assert.equal(closedAfterGuard.observedAt, new Date(boundaryOpenMs + 900_000).toISOString());

const matchingMarkets = [source.selection];
assert.equal(findExchangeMarket(matchingMarkets, "SOL")?.marketId, "SOLUSDT");
assert.equal(findExchangeMarket(matchingMarkets, "SOLUSDT")?.marketId, "SOLUSDT");
assert.equal(findExchangeMarket(matchingMarkets, "SOLUSDT.P")?.marketId, "SOLUSDT");
assert.equal(findExchangeMarket(matchingMarkets, "SOL/USDT:USDT")?.marketId, "SOLUSDT");
assert.equal(findExchangeMarket(matchingMarkets, "SOLXUSDT"), null, "an unknown saved symbol must not fall back to another market");
assert.equal(findExchangeMarket(matchingMarkets, "SOL.PUSDT"), null, "a misplaced perpetual suffix must not normalize into another symbol");
assert.equal(findExchangeMarket(matchingMarkets, "SOL:USDTUSDT"), null, "a malformed settle suffix must not normalize into another symbol");

const freshnessAsOf = Date.UTC(2026, 7, 4, 0, 0, 0);
const freshObservedAt = {
  "5m": new Date(freshnessAsOf - 5 * 60_000).toISOString(),
  "15m": new Date(freshnessAsOf - 15 * 60_000).toISOString(),
  "1h": new Date(freshnessAsOf - 60 * 60_000).toISOString(),
  "4h": new Date(freshnessAsOf - 4 * 60 * 60_000).toISOString(),
  "1d": new Date(freshnessAsOf - 24 * 60 * 60_000).toISOString()
};
const freshPressureEvidence = [
  { available: true, observedAt: freshnessAsOf },
  { available: true, observedAt: freshnessAsOf - 60 * 60_000 },
  { available: true, observedAt: freshnessAsOf - 30 * 60_000 }
];
assert.equal(classifyCryptoHomeSnapshotQuality({
  asOfMs: freshnessAsOf,
  observedAtByTimeframe: freshObservedAt,
  hasLiveTicker: true,
  pressureSource: "binance-public",
  pressureEvidence: freshPressureEvidence
}).quality, "ready");
assert.equal(classifyCryptoHomeSnapshotQuality({
  asOfMs: freshnessAsOf,
  observedAtByTimeframe: freshObservedAt,
  hasLiveTicker: true,
  pressureSource: "binance-public-proxy",
  pressureEvidence: freshPressureEvidence
}).quality, "partial");
assert.equal(classifyCryptoHomeSnapshotQuality({
  asOfMs: freshnessAsOf,
  observedAtByTimeframe: freshObservedAt,
  hasLiveTicker: true,
  pressureSource: "binance-public",
  pressureEvidence: freshPressureEvidence.map((item) => ({ ...item, available: false }))
}).quality, "partial", "native pressure without usable evidence is not ready");
assert.equal(classifyCryptoHomeSnapshotQuality({
  asOfMs: freshnessAsOf,
  observedAtByTimeframe: freshObservedAt,
  hasLiveTicker: true,
  pressureSource: "binance-public",
  pressureEvidence: [
    { available: true, observedAt: freshnessAsOf },
    { available: true, observedAt: freshnessAsOf - 71 * 60_000 },
    { available: true, observedAt: freshnessAsOf - 30 * 60_000 }
  ]
}).quality, "partial", "one fresh pressure source must not hide another stale source");
assert.equal(classifyCryptoHomeSnapshotQuality({
  asOfMs: freshnessAsOf,
  observedAtByTimeframe: freshObservedAt,
  hasLiveTicker: true,
  pressureSource: "binance-public",
  pressureEvidence: [
    { available: true, observedAt: freshnessAsOf },
    { available: true, observedAt: freshnessAsOf - 120 * 60_000, maxAgeMs: 130 * 60_000 }
  ]
}).quality, "ready", "completed hourly evidence uses its documented slower cadence");
assert.equal(classifyCryptoHomeSnapshotQuality({
  asOfMs: freshnessAsOf,
  observedAtByTimeframe: freshObservedAt,
  hasLiveTicker: true,
  pressureSource: "binance-public",
  pressureEvidence: [
    { available: true, observedAt: freshnessAsOf },
    { available: true, observedAt: freshnessAsOf - 30 * 60_000 },
    { available: true, observedAt: freshnessAsOf - 10 * 60 * 60_000, maxAgeMs: 9 * 60 * 60_000 }
  ]
}).quality, "partial", "fresh hourly evidence must not hide stale funding used by the score");
assert.equal(classifyCryptoHomeSnapshotQuality({
  asOfMs: freshnessAsOf,
  observedAtByTimeframe: { ...freshObservedAt, "15m": new Date(freshnessAsOf - 21 * 60_000).toISOString() },
  hasLiveTicker: true,
  pressureSource: "binance-public",
  pressureEvidence: freshPressureEvidence
}).quality, "stale", "stale closed candles take priority over otherwise-ready sources");

function hasForbiddenKey(value: unknown, forbidden: Set<string>): string | null {
  if (!value || typeof value !== "object") return null;
  for (const [key, child] of Object.entries(value)) {
    if (forbidden.has(key)) return key;
    const nested = hasForbiddenKey(child, forbidden);
    if (nested) return nested;
  }
  return null;
}

const forbidden = new Set([
  "analysis",
  "scoreBreakdown",
  "report",
  "aiInput",
  "proPlan",
  "timeframeAnalyses",
  "longScenario",
  "shortScenario"
]);
assert.equal(hasForbiddenKey(basic, forbidden), null, "Basic projection must not expose raw analysis internals");
assert.equal(hasForbiddenKey(pro, forbidden), null, "Pro projection must remain a bounded Home summary");

const sensitiveSource = {
  ...source,
  analysis: { proPlan: { entryLow: 101, invalidation: 97 }, timeframeAnalyses: [{ price: 109 }] },
  aiInput: { internalEvidence: "private" },
  strategyRadar: [{ entry: 101 }],
  futurePrivateField: { secretAnalysis: true }
} as unknown as CryptoHomeSnapshot;
const legacyBasic = serializeLegacyHomeSnapshot(sensitiveSource, false);
assert.deepEqual(legacyBasic, basic, "the legacy anonymous endpoint must use the current allowlisted Basic projection");
assert.equal(hasForbiddenKey(legacyBasic, forbidden), null);
assert.equal("futurePrivateField" in legacyBasic, false, "new raw fields must not silently become public");
assert.equal(serializeLegacyHomeSnapshot(sensitiveSource, true), sensitiveSource, "verified Coin Pro keeps the legacy detail contract");

const legacyRouteSource = readFileSync("src/app/api/crypto-home-snapshot/route.ts", "utf8");
assert.match(legacyRouteSource, /getRequestEntitlement\(request, "crypto"\)/);
assert.match(legacyRouteSource, /entitlement\.isPaid && !failClosed/);
assert.match(legacyRouteSource, /serializeLegacyHomeSnapshot\(source, canSeeProDetail\)/);
assert.match(legacyRouteSource, /private, no-store/);

const binanceBtc: CryptoHomeSnapshot["selection"] = { ...source.selection, base: "BTC", symbol: "BTC/USDT:USDT", marketId: "BTCUSDT" };
const okxBtc: CryptoHomeSnapshot["selection"] = { ...binanceBtc, exchangeId: "okx", exchangeLabel: "OKX", marketId: "BTC-USDT-SWAP" };
assert.equal(canonicalAssetForHomeCoin(binanceBtc), "btc");
assert.equal(canonicalAssetForHomeCoin(okxBtc), null, "another exchange's BTC must not silently use the Binance canonical analysis");
assert.equal(homeInterestDetailTarget(source.selection).exact, true, "supported Binance alts may link to their exact radar focus");
assert.equal(homeInterestDetailTarget(okxBtc).exact, false, "unsupported exchange detail links must not claim an exact match");
assert.equal(homeInterestDetailTarget(source.selection).continuity, "latest-reanalysis", "exact asset focus must not claim snapshot continuity");
assert.match(homeInterestDetailTarget(okxBtc).notice, /전용 상세 연결을 아직 지원하지 않아/);

const routeSource = readFileSync("src/app/api/crypto/home-interest-summary/route.ts", "utf8");
assert.match(routeSource, /getRequestEntitlement\(request, "crypto"\)/, "the Home summary route must use server-effective Coin entitlement");
assert.match(routeSource, /requireEstablishedStructure: true/, "the Home summary must not inherit the legacy bullish structure default");
assert.match(routeSource, /Cache-Control", "private, no-store, max-age=0"/, "personalized analysis must not be publicly cached");
assert.match(routeSource, /Vary", "Authorization"/, "authenticated and anonymous summaries must not share a cache entry");
assert.match(routeSource, /CryptoExchangeMarketNotFoundError/, "unknown saved symbols receive an explicit route error");
assert.match(routeSource, /status: 404/, "unknown saved symbols must not return another asset as a successful snapshot");

const homeFlowSource = readFileSync("src/components/coin/HomePerpetualDecisionFlow.tsx", "utf8");
const settingsSource = readFileSync("src/components/coin/HomeInterestCoinSettingsDialog.tsx", "utf8");
const interestSummarySource = readFileSync("src/components/coin/HomeInterestAnalysisSummary.tsx", "utf8");
const miniChartSource = readFileSync("src/components/coin/HomeInterestMiniChart.tsx", "utf8");
const exchangeDataSource = readFileSync("src/lib/server/cryptoExchangeData.ts", "utf8");
const pressureSource = readFileSync("src/lib/server/liquidationPressureSource.ts", "utf8");
assert.match(homeFlowSource, /role="tablist"/, "saved Home coins are exposed as a real tab list");
assert.match(homeFlowSource, /aria-selected=\{active\}/, "the active Home coin is announced as the selected tab");
assert.match(homeFlowSource, /aria-controls="home-interest-settings-dialog"/, "the settings gear owns the shared dialog");
assert.doesNotMatch(homeFlowSource, /HomeDailyActions|HomeMarketWatch|HomeNewsImpactStrip/, "duplicate Home tools, tickers, and official-news cards stay removed");
assert.doesNotMatch(homeFlowSource, /\/api\/news-impact|\/api\/crypto\/perpetual\/monitors\?status=active/, "removed Home cards must not keep polling in the background");
assert.match(homeFlowSource, /degradedSources[\s\S]*source\.status !== "ready"/, "normal source rows labelled as analysis-ready stay hidden");
assert.match(settingsSource, /onSave\(normalized\);\s*if \(changed\) recordBasicHomeInterestChange\(\);/, "Basic usage is recorded only after a changed selection is saved");
assert.match(settingsSource, /const latestBasicStatus = basicHomeInterestChangeStatus\(\);/, "Basic quota is re-read at save time so open dialogs cannot bypass or falsely retain the daily limit");
assert.match(settingsSource, /event\.key === "Escape"/, "the settings dialog supports Escape");
assert.match(settingsSource, /const returnFocusTarget = returnFocusRef\?\.current/, "the settings trigger is captured before dialog cleanup");
assert.match(settingsSource, /returnFocusTarget \?\? previousFocusRef\.current/, "dialog close returns focus to its trigger");
assert.match(homeFlowSource, /aria-controls="home-analysis-panel"/, "all analysis tabs control a stable panel that remains in the DOM");
assert.doesNotMatch(interestSummarySource, /Coin Pro 분석|Basic 분석/, "normal access-plan badges are removed from alternate coin summaries");
assert.doesNotMatch(interestSummarySource, /가장 큰 위험|만기 없는 선물/, "alternate summaries use the simplified shared Home copy");
assert.doesNotMatch(interestSummarySource, /score\.toFixed|롱\/숏 압력/, "Home must not render raw Pro score grids");
assert.match(interestSummarySource, /homeInterestRefreshDelay/, "alternate summaries schedule refreshes from snapshot expiry");
assert.match(interestSummarySource, /snapshot\.generatedAt/, "the visible price timestamp uses the snapshot generation time");
assert.match(interestSummarySource, /snapshot\.observedAt/, "the evidence timestamp discloses the closed-candle observation time");
assert.match(interestSummarySource, /homeInterestDetailTarget\(snapshot\.selection\)/, "the detail CTA follows the server-confirmed symbol");
assert.match(interestSummarySource, /HomeInterestRequestError/, "refresh failures preserve response status and retry metadata");
assert.match(interestSummarySource, /response\.headers\.get\("Retry-After"\)/, "rate-limited refreshes respect Retry-After");
assert.match(interestSummarySource, /autoRefreshStoppedRef\.current \|\|[\s\S]*document\.visibilityState !== "visible"/, "terminal client errors stay stopped across visibility changes");
assert.doesNotMatch(interestSummarySource, /refreshKey|setRefreshKey/, "auto, pull, and manual refreshes share one coordinator");
assert.match(interestSummarySource, /5분부터 1일까지의 확정봉/, "the UI discloses the full evidence scope");
assert.match(miniChartSource, /formatPerpetualChartTick/, "alternate charts share the KST tick formatter");
assert.match(miniChartSource, /formatPerpetualChartTime/, "alternate chart crosshairs use KST");
assert.match(exchangeDataSource, /allowSpotFallback: false/, "perpetual Home analysis must not silently use spot candles");
assert.match(exchangeDataSource, /primaryCandles\.at\(-1\)/, "ticker fallback must use the latest confirmed primary candle");
assert.match(exchangeDataSource, /evidenceObservedAt\.fundingRate/, "funding freshness must be checked when it contributes to pressure");
assert.match(pressureSource, /evidenceObservedAt/, "pressure freshness must preserve each evidence family's observation time");
assert.equal(existsSync("src/components/coin/HomeInterestCoinPrices.tsx"), false, "the duplicate polling price-card component is removed");

console.log("Home interest analysis contract passed.");
