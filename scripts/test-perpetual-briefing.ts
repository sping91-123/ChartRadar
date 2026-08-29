import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyzeTimeframe, type Candle } from "../src/lib/marketAnalysis";
import { buildPerpetualDecisionSnapshot, type PerpetualTimeframeObservation, type SourceStatus } from "../src/lib/perpetualDecisionSnapshot";
import { perpetualStructureTimeframes, type QualifiedMssState } from "../src/lib/qualifiedMss";
import { buildPerpetualBriefingInput, fallbackPerpetualBriefing, isPerpetualBriefingOutputSafe } from "../src/lib/server/perpetualBriefing";

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

function structureFixtures(): QualifiedMssState[] {
  return perpetualStructureTimeframes.map((timeframe) => ({
    contractVersion: "qualified-mss-v1",
    sourceIndicatorVersion: "Coters-v2.49",
    timeframe,
    historyMode: "bounded-replay",
    closedOnly: true,
    historyStart: "2026-06-01T00:00:00.000Z",
    lastClosedAt: generatedAt,
    barCount: 1500,
    warmupComplete: true,
    integrity: "ready",
    stability: {
      checkedWindows: [1500, 960, 640, 320],
      directionStable: true,
      exactPineStateParity: false
    },
    trend: "bullish",
    known: true,
    trendStrength: 1,
    latestMss: {
      direction: "bullish",
      level: 118_200,
      occurredAt: generatedAt,
      ageBars: 3,
      pivotId: `${timeframe}-mss`,
      sourceAt: generatedAt,
      confirmedAt: generatedAt,
      qualityMode: "Displacement",
      quality: { bodyAtrRatio: 0.9, breakAtrRatio: 0.12, closeLocation: 0.75 }
    },
    activeMsb: null,
    activeChoch: null,
    eventCursor: `mss:${timeframe}:bullish`
  }));
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
  structureTimeframes: structureFixtures(),
  pressure: null,
  flow: null,
  previousSnapshot: null
});

assert.equal(snapshot.pro?.detailVersion, 1);
const input = buildPerpetualBriefingInput(snapshot);
assert.equal(input.symbol, "BTCUSDT");
assert.equal(input.hideNumericScores, true, "the beginner AI prompt must not present internal model scores as user evidence");
assert.equal(input.scenario, null, "snapshot-native AI must not invent an entry or target scenario");
assert.match(input.analysisScope ?? "", /저장한 1분·5분·15분·1시간·4시간·1일 확정 구조 종합 분석/);

const { analysisConsensus: _legacyConsensus, ...legacySummary } = snapshot.summary;
const legacySnapshot = {
  ...snapshot,
  payloadSchemaVersion: undefined,
  engineVersion: "perpetual-v2.0.0",
  summary: legacySummary
};
const legacyInput = buildPerpetualBriefingInput(legacySnapshot);
assert.match(legacyInput.analysisScope ?? "", /기존 15분·1시간·4시간 MSB·CHoCH 분석/);
assert.doesNotMatch(legacyInput.analysisScope ?? "", /1분·5분|확정 구조 종합/);
assert.ok(legacyInput.aggregate?.keySignals.every((signal) => !signal.includes("MSS ")), "legacy evidence must not be relabelled as v3 MSS");
assert.ok(input.timeframes.every((item) => !/bullish|bearish|unknown/.test(`${item.msb} ${item.choch}`)), "AI input should receive beginner-facing direction labels");

const fallback = fallbackPerpetualBriefing(snapshot);
assert.match(fallback, /현재/);
assert.match(fallback, /가장 조심할 점/);
assert.doesNotMatch(fallback, /스냅샷|상방 구조|하방 구조|유지 조건|진입가|손절가|익절가/, "fallback copy must remain useful to beginners and avoid trade instructions");
assert.equal(isPerpetualBriefingOutputSafe(snapshot, fallback), true, "the deterministic explanation must satisfy the saved-decision guard");
assert.equal(isPerpetualBriefingOutputSafe(snapshot, "RSI 때문에 현재 판정이 하락으로 바뀌었습니다."), false, "an indicator must not be credited with reversing the saved decision");
assert.equal(isPerpetualBriefingOutputSafe(snapshot, "현재 판단은 하락 우세입니다. 위험을 확인하세요."), false, "an explicit opposite decision must be rejected");
assert.equal(isPerpetualBriefingOutputSafe(snapshot, "현재 판단은 상승 우세입니다. 최종 판단은 하락 우세입니다."), false, "mentioning the saved direction must not excuse a contradictory final decision");
assert.equal(isPerpetualBriefingOutputSafe(snapshot, "현재는 하락 쪽 힘이 더 강합니다."), false, "an opposite operational direction without the word decision must still be rejected");
assert.equal(isPerpetualBriefingOutputSafe(snapshot, "RSI가 상승이라 지금은 롱 쪽 힘이 강합니다."), false, "an indicator must not create a new operational direction claim");
assert.equal(isPerpetualBriefingOutputSafe(snapshot, "현재 판단은 상승 관찰입니다. 다만 MACD 히스토그램 감소는 위험 확인용으로 참고합니다."), true, "a supporting indicator caveat may remain when the saved decision is preserved");
const riskSnapshot = { ...snapshot, summary: { ...snapshot.summary, state: "risk" as const } };
const neutralSnapshot = { ...snapshot, summary: { ...snapshot.summary, state: "neutral" as const } };
const downsideSnapshot = { ...snapshot, summary: { ...snapshot.summary, state: "downside_watch" as const } };
assert.equal(isPerpetualBriefingOutputSafe(riskSnapshot, "현재 판단은 상승 우세입니다."), false, "risk must not be rewritten as a directional decision");
assert.equal(isPerpetualBriefingOutputSafe(neutralSnapshot, "현재 판단은 하락 우세입니다."), false, "neutral must not be rewritten as a directional decision");
assert.equal(isPerpetualBriefingOutputSafe(snapshot, "최종적으로 숏 우세입니다."), false, "natural final-wording variants must not bypass the opposite-direction guard");
assert.equal(isPerpetualBriefingOutputSafe(snapshot, "종합하면 하락 쪽 근거가 더 많습니다."), false, "an opposite evidence-majority claim must be rejected");
assert.equal(isPerpetualBriefingOutputSafe(downsideSnapshot, "전체적으로 롱이 유리합니다."), false, "an opposite favorable-side claim must be rejected");
assert.equal(isPerpetualBriefingOutputSafe(riskSnapshot, "상승 쪽 근거가 더 많습니다."), false, "risk must remain non-directional across natural wording variants");
assert.equal(isPerpetualBriefingOutputSafe(neutralSnapshot, "지금 매도세가 우세합니다."), false, "neutral must remain non-directional across pressure wording variants");
assert.equal(isPerpetualBriefingOutputSafe(downsideSnapshot, "RSI가 높으므로 상승 우세로 봅니다."), false, "an indicator must not create an aligned or opposing operational direction");
assert.equal(isPerpetualBriefingOutputSafe(snapshot, "MACD 신호상 숏이 유리합니다."), false, "indicator shorthand must not bypass the saved-decision guard");
assert.equal(isPerpetualBriefingOutputSafe(neutralSnapshot, "RSI가 과매도라서 지금 매수해야 합니다."), false, "indicator-based direct trade instructions must be rejected");
assert.equal(isPerpetualBriefingOutputSafe(snapshot, "MACD 때문에 숏 진입이 유리합니다."), false, "opposite-position entry advice must be rejected");
assert.equal(isPerpetualBriefingOutputSafe(downsideSnapshot, "보조지표를 따라 롱으로 진입하세요."), false, "direct entry advice must be rejected regardless of the saved direction");
assert.equal(isPerpetualBriefingOutputSafe(riskSnapshot, "지금 매수하세요."), false, "direct trade instructions must be rejected for every decision state");
assert.equal(isPerpetualBriefingOutputSafe(riskSnapshot, "롱 포지션이 더 몰렸지만 방향은 정하지 않습니다."), true, "positioning evidence without a directional verdict must remain explainable");
assert.equal(isPerpetualBriefingOutputSafe(snapshot, "현재 판단은 상승 관찰입니다. 지금은 매수하지 말고 다음 조건을 확인합니다."), true, "a do-not-trade warning must not be mistaken for a trade instruction");
assert.equal(isPerpetualBriefingOutputSafe(downsideSnapshot, "RSI가 높아 매수 압력이 더 강합니다."), false, "indicator pressure synonyms must not create an opposite direction");
assert.equal(isPerpetualBriefingOutputSafe(snapshot, "MACD상 매도 압력이 더 강합니다."), false, "indicator pressure shorthand must not create an opposite direction");
assert.equal(isPerpetualBriefingOutputSafe(riskSnapshot, "지금은 상방이 유리합니다."), false, "risk must reject common upside synonyms");
assert.equal(isPerpetualBriefingOutputSafe(downsideSnapshot, "오르는 쪽 가능성이 더 높습니다."), false, "common rising-language variants must not reverse the saved decision");
assert.equal(isPerpetualBriefingOutputSafe(riskSnapshot, "롱 포지션을 잡으세요."), false, "position-opening imperatives must be rejected");
assert.equal(isPerpetualBriefingOutputSafe(neutralSnapshot, "매수하는 편이 좋습니다."), false, "soft trade recommendations must be rejected");
assert.equal(isPerpetualBriefingOutputSafe(snapshot, "매수를 고려하세요."), false, "consider-trading recommendations must be rejected");
assert.equal(isPerpetualBriefingOutputSafe(downsideSnapshot, "숏 진입을 고려하세요."), false, "aligned trade recommendations are still disallowed");
assert.equal(isPerpetualBriefingOutputSafe(neutralSnapshot, "RSI 과매도이므로 매수를 고려하세요."), false, "indicator-based soft trade recommendations must be rejected");
assert.equal(isPerpetualBriefingOutputSafe(riskSnapshot, "지금은 상승할 가능성이 큽니다."), false, "risk must reject probability-based directional claims");
assert.equal(isPerpetualBriefingOutputSafe(snapshot, "하방 시나리오가 더 유력합니다."), false, "opposite scenario-likelihood wording must be rejected");
assert.equal(isPerpetualBriefingOutputSafe(downsideSnapshot, "상승 쪽에 무게를 둡니다."), false, "opposite weighting language must be rejected");
assert.equal(isPerpetualBriefingOutputSafe(downsideSnapshot, "RSI상 강세 신호입니다."), false, "indicator strength synonyms must not create a new direction");
assert.equal(isPerpetualBriefingOutputSafe(snapshot, "MACD는 약세 신호입니다."), false, "indicator weakness synonyms must not reverse the saved direction");
assert.equal(isPerpetualBriefingOutputSafe(riskSnapshot, "RSI가 과매도라 반등 신호입니다."), false, "risk must not become directional through a rebound claim");
assert.equal(isPerpetualBriefingOutputSafe(snapshot, "MACD 데드크로스로 추가 하락이 예상됩니다."), false, "indicator forecast wording must not reverse the saved direction");
assert.equal(isPerpetualBriefingOutputSafe(riskSnapshot, "롱 포지션을 여세요."), false, "position-opening synonyms must be rejected");
assert.equal(isPerpetualBriefingOutputSafe(neutralSnapshot, "매수 진입도 가능합니다."), false, "trade-availability wording must be rejected");
assert.equal(isPerpetualBriefingOutputSafe(snapshot, "RSI만으로 상승 우세를 말할 수 없습니다."), false, "ambiguous indicator-direction language must fail closed to the deterministic explanation");
assert.equal(isPerpetualBriefingOutputSafe(riskSnapshot, "상방이 유리하다는 뜻은 아닙니다."), false, "ambiguous direction language must fail closed even when it contains a negation");
assert.equal(isPerpetualBriefingOutputSafe(riskSnapshot, "롱 포지션을 잡으라는 뜻이 아닙니다."), false, "ambiguous position language must fail closed even when it contains a negation");
assert.equal(isPerpetualBriefingOutputSafe(neutralSnapshot, "매수해야 한다는 뜻은 아닙니다."), false, "ambiguous trade language must fail closed even when it contains a negation");
assert.equal(isPerpetualBriefingOutputSafe(riskSnapshot, "상승이 확정됐다는 뜻은 아니지만, 현재는 롱이 유리합니다."), false, "a negated preface must not hide a later directional recommendation");
assert.equal(isPerpetualBriefingOutputSafe(snapshot, "하락이 확정됐다는 뜻은 아니지만, 지금은 숏 쪽이 더 낫습니다."), false, "a negated preface must not hide an opposite directional recommendation");
assert.equal(isPerpetualBriefingOutputSafe(neutralSnapshot, "매수를 권한다는 뜻은 아니지만, 롱 진입도 가능합니다."), false, "a negated preface must not hide a later trade recommendation");
assert.equal(isPerpetualBriefingOutputSafe(snapshot, "RSI만으로 방향을 말할 수 없지만, MACD는 약세 신호입니다."), false, "a negated indicator preface must not hide a later technical direction claim");
assert.equal(isPerpetualBriefingOutputSafe(riskSnapshot, "현재 흐름은 강세입니다."), false, "risk must reject bare current-strength conclusions");
assert.equal(isPerpetualBriefingOutputSafe(snapshot, "전체 흐름은 약세입니다."), false, "opposite overall-flow conclusions must be rejected");
assert.equal(isPerpetualBriefingOutputSafe(snapshot, "결론은 하방입니다."), false, "opposite bare conclusions must be rejected");
assert.equal(isPerpetualBriefingOutputSafe(riskSnapshot, "상방 관점입니다."), false, "risk must reject bare directional viewpoints");
assert.equal(isPerpetualBriefingOutputSafe(downsideSnapshot, "상승 쪽으로 봅니다."), false, "directional inference wording must be rejected when it conflicts");
assert.equal(isPerpetualBriefingOutputSafe(riskSnapshot, "오를 확률이 높습니다."), false, "risk must reject rising-probability wording");
assert.equal(isPerpetualBriefingOutputSafe(riskSnapshot, "하락 가능성이 커 보입니다."), false, "risk must reject falling-probability wording");
assert.equal(isPerpetualBriefingOutputSafe(downsideSnapshot, "RSI상 강세로 보입니다."), false, "technical directional inference must be rejected");
assert.equal(isPerpetualBriefingOutputSafe(riskSnapshot, "롱으로 가세요."), false, "colloquial position instructions must be rejected");
assert.equal(isPerpetualBriefingOutputSafe(neutralSnapshot, "매수해도 됩니다."), false, "permission-style trade instructions must be rejected");
assert.equal(isPerpetualBriefingOutputSafe(downsideSnapshot, "숏 진입이 괜찮습니다."), false, "soft entry approval must be rejected even when aligned");
assert.equal(isPerpetualBriefingOutputSafe(snapshot, "1시간 흐름은 하락입니다. 현재 판단은 상승 관찰입니다."), true, "timeframe-scoped structure evidence may disagree while the saved operational decision remains intact");

const routeSource = readFileSync(join(process.cwd(), "src/app/api/crypto/perpetual/briefing/route.ts"), "utf8");
assert.match(routeSource, /PROMPT_VERSION = "perpetual-beginner-v3"/, "the output guard must not reuse earlier unvalidated cached explanations");
assert.match(routeSource, /snapshot\.quality !== "ready"/, "direct paid requests must not generate or cache explanations for incomplete snapshots");
assert.match(routeSource, /isPerpetualBriefingOutputSafe\(snapshot, candidate\)/, "provider output must pass a deterministic saved-decision guard before caching");
assert.match(routeSource, /isPerpetualBriefingOutputSafe\(snapshot, hit\.briefing\)/, "local cache hits must pass the same guard");
assert.match(routeSource, /isPerpetualBriefingOutputSafe\(snapshot, sharedHit\.briefing\)/, "shared cache hits must pass the same guard");
assert.match(routeSource, /isPerpetualBriefingOutputSafe\(snapshot, lockedHit\.briefing\)/, "post-lease cache hits must pass the same guard");
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
assert.match(
  routeSource,
  /getCoinCapabilityPolicy\(entitlement\.plan\)\.cryptoAiDailyLimit/,
  "provider-backed AI must use the canonical Coin capability budget"
);
assert.match(
  routeSource,
  /coin-ai-generation-daily:v1:\$\{kstDateKey\(\)\}/,
  "all new Coin AI generations must consume the shared KST daily account budget"
);
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
assert.match(clientSource, /if \(!available\)/, "a stale fallback with the same snapshot id must clear and block the old explanation");
assert.match(clientSource, /\[available, snapshotId\]/, "quality changes must reset explanation state even when the snapshot id is unchanged");
assert.match(clientSource, /available && state\.status === "ready"/, "a stale quality change must hide the old explanation before effects run");
assert.match(clientSource, /available && state\.status === "error"/, "a stale quality change must hide a previous request error before effects run");
const groqSource = readFileSync(join(process.cwd(), "src/lib/ai/groq.ts"), "utf8");
const geminiSource = readFileSync(join(process.cwd(), "src/lib/ai/gemini.ts"), "utf8");
for (const providerSource of [groqSource, geminiSource]) {
  assert.match(providerSource, /저장된 판정·가장 큰 위험·다음 확인 조건을 권위값으로 유지합니다/);
  assert.match(providerSource, /보조지표로 판정을 새로 만들거나 뒤집었다고 설명하지 않습니다/);
}
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
