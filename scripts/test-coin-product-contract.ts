import assert from "node:assert/strict";
import {
  basicCoinCapabilityPolicy,
  coinProCapabilityPolicy,
  cryptoAlertConditionLimit,
  getCoinCapabilityPolicy
} from "../src/lib/coinCapabilities";
import {
  buildCoinProHref,
  buildCoinProPlayStoreUrl,
  returnToFromRouteKey,
  routeKeyFromReturnTo
} from "../src/lib/coinProConversion";
import { serializeScoutSetup, type ScoutSetup } from "../src/lib/setupScout";
import { getWatchlistLimit } from "../src/lib/watchlist";
import { marketBriefingCacheKey } from "../src/lib/ai/marketBriefingCache";
import type { MarketBriefingInput } from "../src/lib/ai/types";

assert.deepEqual(
  {
    alt: basicCoinCapabilityPolicy.altAnalysisDailyLimit,
    ai: basicCoinCapabilityPolicy.cryptoAiDailyLimit,
    monitors: basicCoinCapabilityPolicy.sharedMonitorLimit,
    watchlist: basicCoinCapabilityPolicy.altWatchlistLimit,
    home: basicCoinCapabilityPolicy.homeInterestLimit
  },
  { alt: 3, ai: 1, monitors: 1, watchlist: 1, home: 1 }
);
assert.deepEqual(
  {
    alt: coinProCapabilityPolicy.altAnalysisDailyLimit,
    ai: coinProCapabilityPolicy.cryptoAiDailyLimit,
    monitors: coinProCapabilityPolicy.sharedMonitorLimit,
    watchlist: coinProCapabilityPolicy.altWatchlistLimit,
    home: coinProCapabilityPolicy.homeInterestLimit
  },
  { alt: null, ai: 24, monitors: 20, watchlist: 50, home: 5 }
);

for (const plan of [undefined, null, "free", "stocks_monthly", "stocks_yearly"] as const) {
  assert.equal(getCoinCapabilityPolicy(plan).tier, "basic", `${String(plan)} must not unlock Coin Pro`);
  assert.equal(cryptoAlertConditionLimit(plan), 1);
}
for (const plan of ["crypto_monthly", "crypto_yearly", "bundle_monthly", "bundle_yearly", "member", "premium", "admin"] as const) {
  assert.equal(getCoinCapabilityPolicy(plan).tier, "coin_pro", `${plan} must retain Coin Pro compatibility`);
  assert.equal(cryptoAlertConditionLimit(plan), 20);
}

assert.equal(getWatchlistLimit("free"), 1);
assert.equal(getWatchlistLimit("crypto_monthly"), 50);
assert.equal(getWatchlistLimit("crypto_yearly"), 100, "legacy annual capacity must not shrink");
assert.equal(getWatchlistLimit("bundle_monthly"), 100, "legacy bundle capacity must not shrink");
assert.equal(getWatchlistLimit("bundle_yearly"), 150, "legacy bundle annual capacity must not shrink");
assert.equal(getWatchlistLimit("member"), 1, "legacy member capacity remains compatible");
assert.equal(getWatchlistLimit("stocks_monthly"), 50, "Global Radar's shared helper must not regress");
assert.equal(getWatchlistLimit("stocks_yearly"), 100, "Global Radar's annual helper must not regress");

const rawSetup = {
  symbol: "BTCUSDT.P",
  mode: "scalp",
  timeframe: "15m",
  analysis: {
    readiness: "medium",
    riskFlags: ["higher-timeframe conflict"],
    opportunityFlags: ["confirmation forming"],
    timeframeAnalyses: [{ timeframe: "4h", score: 88 }],
    price: 65_000
  },
  plan: {
    side: "long",
    entryLow: 64_500,
    entryHigh: 64_800,
    invalidation: 63_900,
    target1: 66_000,
    target2: 67_200,
    confidence: 84,
    reason: "private evidence",
    cautions: ["private caution"]
  },
  score: 84,
  status: "watch",
  watchKind: "aligned",
  watchReason: "private watch reason",
  headline: "private precise headline",
  distancePercent: 0.42,
  insideZone: false,
  proximity: "near",
  currentPrice: 65_000,
  scannedAt: "2026-08-01T07:09:00.000Z"
} as unknown as ScoutSetup;

const basicSetup = serializeScoutSetup(rawSetup, false);
assert.equal(basicSetup.access, "basic");
const forbiddenKeys = new Set([
  "analysis",
  "plan",
  "score",
  "watchReason",
  "distancePercent",
  "insideZone",
  "currentPrice",
  "entryLow",
  "entryHigh",
  "invalidation",
  "target1",
  "target2",
  "confidence",
  "reason",
  "cautions",
  "timeframeAnalyses",
  "price"
]);
function assertNoProKeys(value: unknown, path = "root") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assert.equal(forbiddenKeys.has(key), false, `Basic payload leaked ${path}.${key}`);
    assertNoProKeys(child, `${path}.${key}`);
  }
}
assertNoProKeys(basicSetup);
assert.equal(JSON.stringify(basicSetup).includes("65000"), false, "Basic payload must not contain the observed price");
assert.equal(JSON.stringify(basicSetup).includes("private evidence"), false);

const proSetup = serializeScoutSetup(rawSetup, true);
assert.equal(proSetup.access, "pro");
assert.equal(proSetup.currentPrice, 65_000);
assert.equal(proSetup.plan.invalidation, 63_900);
assert.equal(proSetup.analysis.timeframeAnalyses[0]?.timeframe, "4h");

assert.equal(routeKeyFromReturnTo("https://evil.example/crypto/perpetual?asset=eth"), "crypto_home");
assert.equal(routeKeyFromReturnTo("/crypto/perpetual?asset=eth"), "perpetual_eth");
assert.equal(returnToFromRouteKey("perpetual_eth"), "/crypto/perpetual?asset=eth");
const safeHref = buildCoinProHref({
  source: "perpetual-monitor",
  placement: "perpetual_monitor_lock",
  returnTo: "https://evil.example/steal",
  symbol: "btc/usdt?token=secret"
});
assert.equal(safeHref.includes("evil.example"), false);
assert.equal(safeHref.includes("token"), false);
assert.match(safeHref, /^\/pro\?/);
const exactReturnHref = new URL(buildCoinProHref({
  source: "perpetual-monitor",
  placement: "perpetual_monitor_lock",
  routeKey: "perpetual_btc",
  returnTo: "/crypto/perpetual?asset=btc&timeframe=15m&snapshot=snapshot-123"
}), "https://chartradar.kr");
assert.equal(
  exactReturnHref.searchParams.get("returnTo"),
  "/crypto/perpetual?asset=btc&timeframe=15m&snapshot=snapshot-123"
);
assert.equal(new URL(safeHref, "https://chartradar.kr").searchParams.get("returnTo"), "/crypto/home");

const playUrl = new URL(buildCoinProPlayStoreUrl({
  source: "alt-analysis-limit",
  placement: "alt_daily_limit",
  routeKey: "alts",
  funnelSessionId: "60000000-0000-4000-8000-000000000001",
  symbol: "SOLUSDT.P"
}));
assert.equal(playUrl.hostname, "play.google.com");
assert.equal(playUrl.searchParams.get("id"), "com.staronlabs.chartradar");
const referrer = new URLSearchParams(playUrl.searchParams.get("referrer") ?? "");
assert.deepEqual(Object.fromEntries(referrer), {
  campaign: "coin-pro-v2",
  market: "crypto",
  source: "alt-analysis-limit",
  placement: "alt_daily_limit",
  route: "alts",
  funnel: "60000000-0000-4000-8000-000000000001",
  symbol: "SOLUSDT.P"
});

const briefingInput = {
  symbol: "BTCUSDT.P",
  summaryLine: "상방 구조 확인",
  actionGuide: "15분 종가 확인",
  riskFlags: ["4시간 충돌"],
  opportunityFlags: ["거래량 회복"],
  timeframes: [{ timeframe: "15m", summary: "상방" }]
} as unknown as MarketBriefingInput;
assert.notEqual(
  marketBriefingCacheKey(briefingInput),
  marketBriefingCacheKey({ ...briefingInput, riskFlags: ["4시간 정렬"] }),
  "a prompt risk change must invalidate the AI cache"
);
assert.notEqual(
  marketBriefingCacheKey(briefingInput),
  marketBriefingCacheKey({ ...briefingInput, timeframes: [{ timeframe: "15m", summary: "하방" }] } as MarketBriefingInput),
  "a timeframe prompt change must invalidate the AI cache"
);

console.log("Coin capability, Basic serializer, legacy limits, and safe conversion route contract passed.");
