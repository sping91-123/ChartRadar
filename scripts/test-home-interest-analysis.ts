import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { serializeHomeInterestAnalysis } from "../src/lib/server/homeInterestAnalysis";
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
    { timeframe: "5m", label: "5분", msb: "bullish", choch: "bullish", score: 1, regime: "trendUp" },
    { timeframe: "15m", label: "15분", msb: "bullish", choch: "neutral", score: 1.5, regime: "trendUp" },
    { timeframe: "1h", label: "1시간", msb: "unknown", choch: "unknown", score: 0, regime: "range" },
    { timeframe: "4h", label: "4시간", msb: "bearish", choch: "bearish", score: -1, regime: "trendDown" },
    { timeframe: "1d", label: "1일", msb: "bullish", choch: "bullish", score: 2, regime: "trendUp" }
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
  updatedAt: "2026-08-04T00:00:00.000Z"
} as unknown as CryptoHomeSnapshot;

const basic = serializeHomeInterestAnalysis(source, false);
assert.equal(basic.access, "basic");
assert.equal(basic.pro, undefined, "Basic response must omit the Pro object entirely");
assert.equal(basic.chart.candles.length, 64, "Home only needs a compact 15-minute window");
assert.deepEqual(Object.keys(basic.chart.candlesByTimeframe), ["15m", "1h", "4h"], "Home chart exposes only decision-engine timeframes");
assert.equal(basic.chart.candlesByTimeframe["1h"].length, 64, "Home bounds each context chart window");
assert.equal(basic.chart.candlesByTimeframe["4h"].length, 64, "Home bounds the four-hour chart window");
assert.deepEqual(basic.timeframes.map((item) => item.timeframe), ["15m", "1h", "4h"]);
assert.match(basic.summary.headline, /오르는 근거/);
assert.match(basic.summary.topRisk, /엇갈려/, "mixed timeframes must disclose the conflict before direction");

const pro = serializeHomeInterestAnalysis(source, true);
assert.equal(pro.access, "coin_pro");
assert.equal(pro.pro?.timeframes.length, 3);
assert.deepEqual(pro.pro?.pressure?.evidence, [{ label: "펀딩", value: "0.01%" }]);

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

const binanceBtc: CryptoHomeSnapshot["selection"] = { ...source.selection, base: "BTC", symbol: "BTC/USDT:USDT", marketId: "BTCUSDT" };
const okxBtc: CryptoHomeSnapshot["selection"] = { ...binanceBtc, exchangeId: "okx", exchangeLabel: "OKX", marketId: "BTC-USDT-SWAP" };
assert.equal(canonicalAssetForHomeCoin(binanceBtc), "btc");
assert.equal(canonicalAssetForHomeCoin(okxBtc), null, "another exchange's BTC must not silently use the Binance canonical analysis");
assert.equal(homeInterestDetailTarget(source.selection).exact, true, "supported Binance alts may link to their exact radar focus");
assert.equal(homeInterestDetailTarget(okxBtc).exact, false, "unsupported exchange detail links must not claim an exact match");

const routeSource = readFileSync("src/app/api/crypto/home-interest-summary/route.ts", "utf8");
assert.match(routeSource, /getRequestEntitlement\(request, "crypto"\)/, "the Home summary route must use server-effective Coin entitlement");
assert.match(routeSource, /requireEstablishedStructure: true/, "the Home summary must not inherit the legacy bullish structure default");
assert.match(routeSource, /Cache-Control", "private, no-store, max-age=0"/, "personalized analysis must not be publicly cached");
assert.match(routeSource, /Vary", "Authorization"/, "authenticated and anonymous summaries must not share a cache entry");

const homeFlowSource = readFileSync("src/components/coin/HomePerpetualDecisionFlow.tsx", "utf8");
const settingsSource = readFileSync("src/components/coin/HomeInterestCoinSettingsDialog.tsx", "utf8");
const interestSummarySource = readFileSync("src/components/coin/HomeInterestAnalysisSummary.tsx", "utf8");
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
assert.equal(existsSync("src/components/coin/HomeInterestCoinPrices.tsx"), false, "the duplicate polling price-card component is removed");

console.log("Home interest analysis contract passed.");
