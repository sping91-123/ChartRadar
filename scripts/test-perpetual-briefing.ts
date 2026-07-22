import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyzeTimeframe, type Candle } from "../src/lib/marketAnalysis";
import { buildPerpetualDecisionSnapshot, type PerpetualTimeframeObservation, type SourceStatus } from "../src/lib/perpetualDecisionSnapshot";
import { buildPerpetualBriefingInput, fallbackPerpetualBriefing } from "../src/lib/server/perpetualBriefing";

const generatedAt = "2026-07-21T01:15:00.000Z";
const ready: SourceStatus = { status: "ready", observedAt: generatedAt, detail: "fixture" };

function candles(seconds: number, slope: number): Candle[] {
  return Array.from({ length: 320 }, (_, index) => {
    const base = 118_000 + index * slope;
    return {
      time: 1_752_000_000 + index * seconds,
      open: base,
      high: base + 60,
      low: base - 45,
      close: base + slope * 0.8,
      volume: 200 + index
    };
  });
}

function observation(timeframe: "15m" | "1h" | "4h", seconds: number, slope: number): PerpetualTimeframeObservation {
  const rows = candles(seconds, slope);
  const latest = rows.at(-1)!;
  return {
    timeframe,
    analysis: analyzeTimeframe(timeframe, rows),
    observedAt: generatedAt,
    closedPrice: latest.close,
    rangeHigh: latest.high,
    rangeLow: latest.low,
    candleTimes: rows.map((row) => row.time)
  };
}

const snapshot = buildPerpetualDecisionSnapshot({
  id: "33333333-3333-4333-8333-333333333333",
  fingerprint: "briefing-fixture",
  asset: "btc",
  price: 118_640,
  chartCandles: candles(15 * 60, 2),
  generatedAt,
  sourceStatus: { candles: ready, pressure: ready, flow: ready },
  timeframes: [
    observation("15m", 15 * 60, 2),
    observation("1h", 60 * 60, 1.5),
    observation("4h", 4 * 60 * 60, 1)
  ],
  pressure: null,
  flow: null,
  previousSnapshot: null
});

assert.equal(snapshot.pro?.detailVersion, 1);
const input = buildPerpetualBriefingInput(snapshot);
assert.equal(input.symbol, "BTCUSDT");
assert.equal(input.hideNumericScores, true, "the beginner AI prompt must not present internal model scores as user evidence");
assert.equal(input.scenario, null, "snapshot-native AI must not invent an entry or target scenario");
assert.match(input.analysisScope ?? "", /저장한 15분·1시간·4시간 분석/);
assert.ok(input.timeframes.every((item) => !/bullish|bearish|unknown/.test(`${item.msb} ${item.choch}`)), "AI input should receive beginner-facing direction labels");

const fallback = fallbackPerpetualBriefing(snapshot);
assert.match(fallback, /현재/);
assert.match(fallback, /가장 조심할 점/);
assert.doesNotMatch(fallback, /스냅샷|상방 구조|하방 구조|유지 조건|진입가|손절가|익절가/, "fallback copy must remain useful to beginners and avoid trade instructions");

const routeSource = readFileSync(join(process.cwd(), "src/app/api/crypto/perpetual/briefing/route.ts"), "utf8");
assert.match(routeSource, /getPerpetualDecisionSnapshotById\(body\.snapshotId\)/, "the route must load the exact stored analysis by ID");
assert.doesNotMatch(routeSource, /resolvePerpetualDecisionSnapshot|body\.(analysis|symbol|price|userId)/, "the route must not refetch current analysis or trust client-supplied market data");
assert.match(routeSource, /isPerpetualRevenueCoreUserEnabled\(entitlement\.userId\)/, "the AI route must obey the same rollout gate as the UI");
assert.match(routeSource, /readJsonBodyLimited/, "the AI route must enforce a streaming body-size limit");
assert.match(routeSource, /Object\.keys\(body\)/, "the AI route must reject client-supplied fields beyond the analysis ID");
assert.match(routeSource, /private, no-store, max-age=0/);
assert.match(routeSource, /Vary", "Authorization/);
assert.match(routeSource, /snapshot\.pro\?\.detailVersion !== 1/);
assert.match(routeSource, /code: "pro_required"/);
assert.match(routeSource, /code: "snapshot_detail_unavailable"/);
assert.match(routeSource, /DAILY_PROVIDER_GENERATION_LIMIT = 24/, "provider-backed AI must have a bounded daily account budget");
assert.match(routeSource, /perpetual-briefing-provider-daily/, "provider generations must use a separate daily limiter");
assert.match(routeSource, /perpetual-briefing-provider-global-daily:v1/, "provider-backed AI must also have a cross-account daily cost ceiling");
assert.match(routeSource, /PERPETUAL_AI_DAILY_PROVIDER_LIMIT/, "the global provider ceiling must be operator configurable");
assert.match(routeSource, /includeClientIp: false/, "the daily provider budget must follow the account rather than the current IP");
assert.match(routeSource, /requireSharedBackend: true/g, "provider generation must fail closed when the cross-instance limiter is unavailable");
assert.match(routeSource, /deterministic_daily_limit/, "the paid UI must fall back to a deterministic explanation when the provider budget is exhausted");
assert.match(routeSource, /const providerDeadline = Date\.now\(\) \+ PROVIDER_TIMEOUT_MS/);
assert.match(routeSource, /withTimeout\(provider\.generateMarketBriefing\(input\), remainingMs\)/, "multiple providers must share one total timeout budget");
assert.match(routeSource, /getSharedPerpetualBriefing\(cacheKey\)/, "same-snapshot explanations must be shared across server instances when Upstash is available");
assert.match(routeSource, /acquireSharedPerpetualBriefingLease\(cacheKey\)/, "same-snapshot provider generation must use a distributed singleflight lease");
assert.match(routeSource, /await setSharedPerpetualBriefing\(cacheKey/, "the shared result must be committed before releasing the generation lease");
assert.match(routeSource, /releaseLease = sharedStored/, "a failed shared-cache write must retain the short lease until TTL expiry");
assert.ok(
  routeSource.indexOf("const hit = cache.get(cacheKey)") < routeSource.indexOf("const sharedHit") &&
    routeSource.indexOf("const sharedHit") < routeSource.indexOf("const lease") &&
    routeSource.indexOf("const lease") < routeSource.indexOf("const dailyGenerationLimit"),
  "cached explanations and the singleflight lease must be resolved before consuming the provider generation budget"
);
const budgetFallbackBlock = routeSource.slice(
  routeSource.indexOf("if (!dailyGenerationLimit.allowed || !globalGenerationLimit.allowed)"),
  routeSource.indexOf("let briefing = fallbackPerpetualBriefing(snapshot)")
);
assert.doesNotMatch(budgetFallbackBlock, /cache\.set|setSharedPerpetualBriefing/, "a user's budget fallback must never contaminate a snapshot-wide cache");
assert.match(routeSource, /if \(providerGenerated\) \{[\s\S]*cache\.set[\s\S]*setSharedPerpetualBriefing/, "only provider-backed explanations may populate the shared snapshot cache");

const rateLimitSource = readFileSync(join(process.cwd(), "src/lib/server/rateLimit.ts"), "utf8");
assert.match(rateLimitSource, /requireSharedBackend\?: boolean/);
assert.match(rateLimitSource, /backend: "unavailable"/, "a missing shared limiter must have an explicit fail-closed result");
assert.match(rateLimitSource, /redis\.call\('INCR', KEYS\[1\]\)/, "shared cost limits must increment inside one Redis script");
assert.match(rateLimitSource, /redis\.call\('PTTL', KEYS\[1\]\)/);
assert.match(rateLimitSource, /redis\.call\('PEXPIRE', KEYS\[1\], ARGV\[1\]\)/, "a missing TTL must be repaired atomically on every request");
assert.doesNotMatch(rateLimitSource, /upstashCommand<[^>]+>\("(?:incr|expire|ttl)"/, "shared windows must not use split INCR/EXPIRE commands");
const activationGateSource = readFileSync(join(process.cwd(), "scripts/check-perpetual-revenue-core-env.mjs"), "utf8");
assert.match(activationGateSource, /shared AI cost guard/);
assert.match(activationGateSource, /PERPETUAL_AI_DAILY_PROVIDER_LIMIT/);
assert.match(activationGateSource, /AI explanation provider/);

const sharedCacheSource = readFileSync(join(process.cwd(), "src/lib/server/perpetualBriefingCache.ts"), "utf8");
assert.match(sharedCacheSource, /SHARED_CACHE_PREFIX = "perpetual-briefing:v1"/);
assert.match(sharedCacheSource, /SHARED_CACHE_TIMEOUT_MS = 1_500/, "a cache outage must not stall the paid AI experience");
assert.match(sharedCacheSource, /body: JSON\.stringify\(command\)/, "shared explanations must use Upstash's body command form instead of placing generated text in the URL");
assert.match(sharedCacheSource, /SHARED_LEASE_PREFIX = "perpetual-briefing-lease:v1"/);
assert.match(sharedCacheSource, /SHARED_LEASE_TTL_MS = 60_000/, "the lease must outlive the complete provider attempt and cache write");
assert.match(sharedCacheSource, /"NX",[\s\S]*"PX",[\s\S]*SHARED_LEASE_TTL_MS/, "the generation lease must be exclusive and self-expiring");
assert.match(sharedCacheSource, /redis\.call\('GET', KEYS\[1\]\) == ARGV\[1\]/, "only the lease owner may release it");
assert.doesNotMatch(sharedCacheSource, /userId|accessToken|Authorization: `Bearer \$\{.*user/, "shared AI cache values must not contain user identity or access tokens");

const clientSource = readFileSync(join(process.cwd(), "src/components/coin/PerpetualSnapshotBriefing.tsx"), "utf8");
assert.match(clientSource, /payload\.snapshotId !== snapshotId/, "a late AI response must not overwrite a newly selected analysis");
assert.match(clientSource, /controllerRef\.current\?\.abort\(\)/, "asset or analysis changes must cancel the old AI request");
assert.match(clientSource, /20_000/, "the client must stop an AI request that never returns");
assert.match(clientSource, /providerSkipped \? "rules" : "ai"/, "the UI must preserve whether the provider was actually used");
assert.match(clientSource, /규칙 기반 자동 설명/, "deterministic fallback must never be mislabeled as AI-generated");
const workbenchSource = readFileSync(join(process.cwd(), "src/components/coin/PerpetualEvidenceWorkbench.tsx"), "utf8");
assert.match(workbenchSource, /key=\{snapshot\.id\}/, "a new analysis must remount the explanation state before paint");
assert.match(workbenchSource, /timeZone: "Asia\/Seoul"/, "structure events must show their actual KST occurrence time");

const missingProviderGate = spawnSync(process.execPath, ["scripts/check-perpetual-revenue-core-env.mjs", "--require-on"], {
  cwd: process.cwd(),
  encoding: "utf8",
  env: {
    ...process.env,
    PERPETUAL_REVENUE_CORE_V1: "on",
    NEXT_PUBLIC_SUPABASE_URL: "https://fixture.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "fixture-service-role",
    PRODUCT_ANALYTICS_HMAC_SECRET: "fixture-hmac",
    CRON_SECRET: "fixture-cron",
    UPSTASH_REDIS_REST_URL: "https://fixture.upstash.io",
    UPSTASH_REDIS_REST_TOKEN: "fixture-upstash-token",
    PERPETUAL_AI_DAILY_PROVIDER_LIMIT: "240",
    FIREBASE_SERVICE_ACCOUNT_JSON: "fixture-service-account",
    GROQ_API_KEY: "",
    GEMINI_API_KEY: "",
    ENABLE_GEMINI_AI_FALLBACK: "false"
  }
});
assert.notEqual(missingProviderGate.status, 0, "paid Perpetual activation must fail when no AI provider is configured");
assert.match(`${missingProviderGate.stdout}\n${missingProviderGate.stderr}`, /FAIL AI explanation provider/);

console.log("Perpetual beginner briefing contract passed.");
