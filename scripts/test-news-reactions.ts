import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PerpetualDecisionSnapshot } from "../src/lib/perpetualDecisionSnapshot";
import {
  classifyCryptoNewsReaction,
  classifyGlobalNewsReaction,
  completedRecentGlobalCandles,
  globalObservationQuality,
  isNewsImpactAlertEligible,
  newsReactionAnchorAt,
  nextNewsImpactCheckAt,
  officialMacroHeadline,
  serializeBasicNewsImpactEvent,
  serializeOfficialNewsImpactEvent,
  type GlobalReactionObservation,
  type NewsImpactEvent
} from "../src/lib/newsImpact";
import { isNewsImpactReadEnabled, isOfficialNewsFeedEnabled, newsImpactRuntimePolicy } from "../src/lib/server/newsImpactMode";
import { publicNewsReactionSummary, repairLegacyMacroPresentation } from "../src/lib/newsImpactPresentationRules";

assert.deepEqual(newsImpactRuntimePolicy("off", true), { mode: "off", collect: false, readOfficialFacts: false, expose: false, mutate: false, push: false });
assert.deepEqual(newsImpactRuntimePolicy("shadow", true), { mode: "shadow", collect: true, readOfficialFacts: true, expose: false, mutate: false, push: false });
assert.deepEqual(newsImpactRuntimePolicy("on", false), { mode: "on", collect: true, readOfficialFacts: true, expose: true, mutate: true, push: false });
assert.deepEqual(newsImpactRuntimePolicy("on", true), { mode: "on", collect: true, readOfficialFacts: true, expose: true, mutate: true, push: true });
assert.equal(isOfficialNewsFeedEnabled("shadow"), true, "shadow keeps the official-facts NEWS feed useful while impact classification stays hidden");
assert.equal(isNewsImpactReadEnabled("shadow"), false, "shadow must not expose unverified reaction overlays, alerts, or linked review context");
assert.equal(isNewsImpactReadEnabled("off"), false);
assert.equal(officialMacroHeadline("core-ppi-mom-1784118600000"), "미국 근원 생산자물가지수(PPI) 발표");
assert.equal(officialMacroHeadline("ppi-mom-1784118600000"), "미국 생산자물가지수(PPI) 발표");
assert.notEqual(
  officialMacroHeadline("core-ppi-mom-1784118600000"),
  officialMacroHeadline("ppi-mom-1784118600000"),
  "stored macro events must remain distinguishable even if an older row used a generic headline"
);

const perpetualSource = readFileSync(join(process.cwd(), "src/lib/server/perpetualDecisionSource.ts"), "utf8");
const newsStoreSource = readFileSync(join(process.cwd(), "src/lib/server/news/newsImpactStore.ts"), "utf8");
const newsListRoute = readFileSync(join(process.cwd(), "src/app/api/news-impact/route.ts"), "utf8");
const newsDetailRoute = readFileSync(join(process.cwd(), "src/app/api/news-impact/[id]/route.ts"), "utf8");
const globalBoardRoute = readFileSync(join(process.cwd(), "src/app/api/stocks/market-board/route.ts"), "utf8");
assert.match(perpetualSource, /snapshot\.generatedAt < beforeAt/, "surprise-event crypto baselines must be strictly earlier than first detection");
assert.match(perpetualSource, /generated_at=lt\.\$\{encodeURIComponent\(beforeAt\)\}/, "stored crypto baselines must reject a same-timestamp snapshot");
assert.match(newsStoreSource, /observed_at=lt\.\$\{encodeURIComponent\(beforeAt\)\}/, "Global baselines must reject a same-timestamp observation");
assert.match(newsListRoute, /const offset = pro \? decodeNewsCursor[^:]+: 0;/, "Basic callers cannot forge pagination cursors past the top three events");
assert.match(newsDetailRoute, /30 \* 24 \* 60 \* 60_000/, "Pro event details enforce the 30-day product contract");
assert.match(globalBoardRoute, /requestedEventId \? 7 : 1/, "a Basic seven-day NEWS fallback remains reachable from the Global CTA");

function snapshot(overrides: {
  id?: string;
  asset?: "btc" | "eth";
  state?: PerpetualDecisionSnapshot["summary"]["state"];
  quality?: PerpetualDecisionSnapshot["quality"];
  price?: number;
  scores?: number[];
  flowSide?: "buy" | "sell" | "balanced";
  flowGrade?: "calm" | "normal" | "heated" | "extreme";
  pressureSide?: "upsideShorts" | "downsideLongs" | "balanced";
  pressureGrade?: "calm" | "normal" | "heated" | "extreme";
  generatedAt?: string;
} = {}): PerpetualDecisionSnapshot {
  const asset = overrides.asset ?? "btc";
  const state = overrides.state ?? "upside_watch";
  const generatedAt = overrides.generatedAt ?? "2026-07-20T12:00:00.000Z";
  const scores = overrides.scores ?? [1, 1, 1];
  return {
    id: overrides.id ?? "10000000-0000-4000-8000-000000000001",
    fingerprint: "fixture",
    engineVersion: "perpetual-v1.0.0",
    asset,
    symbol: asset === "btc" ? "BTCUSDT" : "ETHUSDT",
    exchange: "binance",
    primaryTimeframe: "15m",
    contextTimeframes: ["1h", "4h"],
    generatedAt,
    expiresAt: "2026-07-20T12:01:00.000Z",
    quality: overrides.quality ?? "ready",
    price: overrides.price ?? 60_000,
    chart: { timeframe: "15m", candles: [] },
    sourceStatus: {
      candles: { status: "ready", observedAt: generatedAt, detail: "fixture" },
      pressure: { status: "ready", observedAt: generatedAt, detail: "fixture" },
      flow: { status: "ready", observedAt: generatedAt, detail: "fixture" }
    },
    summary: {
      state,
      headline: "fixture",
      topRisk: "fixture",
      reasons: ["fixture", "fixture"],
      primaryCondition: {
        id: "fixture",
        kind: "decision_state_change",
        role: "primary",
        timeframe: "15m",
        label: "fixture",
        threshold: null,
        baselineState: state,
        expiresAt: "2026-07-21T12:00:00.000Z"
      }
    },
    pro: {
      confirmationConditions: [],
      invalidationConditions: [],
      multiTimeframeEvidence: (["15m", "1h", "4h"] as const).map((timeframe, index) => ({
        timeframe,
        label: timeframe,
        structure: "bullish",
        transition: "bullish",
        score: scores[index] ?? 0,
        regime: "trendUp",
        observedAt: generatedAt,
        closedPrice: overrides.price ?? 60_000
      })),
      pressure: {
        dominantSide: overrides.pressureSide ?? "upsideShorts",
        grade: overrides.pressureGrade ?? "normal",
        upsideShortPressure: 55,
        downsideLongPressure: 45,
        summary: "fixture"
      },
      flow: {
        dominantSide: overrides.flowSide ?? "buy",
        grade: overrides.flowGrade ?? "normal",
        imbalancePercent: 25,
        largeTradeCount: 10,
        totalLargeNotionalUsd: 1_000_000,
        summary: "fixture"
      },
      previousChange: null
    }
  };
}

const before = snapshot({ generatedAt: "2026-07-20T11:45:00.000Z" });
assert.equal(classifyCryptoNewsReaction(null, before).classification, "insufficient_data");
assert.equal(classifyCryptoNewsReaction(before, snapshot({ quality: "partial" })).classification, "insufficient_data");
assert.equal(classifyCryptoNewsReaction(before, snapshot({ asset: "eth" })).classification, "insufficient_data");
assert.equal(
  classifyCryptoNewsReaction(
    snapshot({ generatedAt: "2026-07-20T12:30:00.000Z" }),
    snapshot({ generatedAt: "2026-07-20T12:15:00.000Z" })
  ).classification,
  "insufficient_data",
  "an evaluated snapshot cannot predate its baseline"
);

const risk = classifyCryptoNewsReaction(before, snapshot({ state: "risk", price: 59_500 }));
assert.equal(risk.classification, "risk_increase");
assert.equal(risk.riskEffect, "increased");

const changed = classifyCryptoNewsReaction(before, snapshot({ state: "downside_watch", price: 59_000 }));
assert.equal(changed.classification, "decision_state_changed");

const supported = classifyCryptoNewsReaction(
  snapshot({ scores: [0, 0, 0], flowSide: "balanced", flowGrade: "calm", pressureSide: "balanced", pressureGrade: "calm", generatedAt: "2026-07-20T11:45:00.000Z" }),
  snapshot({ scores: [0.4, 0.3, 0.2], flowSide: "buy", flowGrade: "heated", pressureSide: "upsideShorts", pressureGrade: "heated", price: 60_600 })
);
assert.equal(supported.classification, "supports_existing_state");

const conflicted = classifyCryptoNewsReaction(
  before,
  snapshot({ scores: [0.2, 0.1, 0], flowSide: "sell", flowGrade: "heated", pressureSide: "downsideLongs", pressureGrade: "heated", price: 59_700 })
);
assert.equal(conflicted.classification, "conflicts_with_existing_state");
assert.equal(isNewsImpactAlertEligible({ classification: conflicted.classification, quality: "ready" }), true);
assert.equal(isNewsImpactAlertEligible({ classification: "supports_existing_state", quality: "ready" }), false);
assert.equal(isNewsImpactAlertEligible({ classification: "risk_increase", quality: "stale" }), false);

const global = (mode: GlobalReactionObservation["marketMode"], groups: GlobalReactionObservation["signalGroups"], observedAt = "2026-07-20T12:00:00.000Z"): GlobalReactionObservation => ({
  id: crypto.randomUUID(),
  observedAt,
  quality: "ready",
  marketMode: mode,
  metrics: {},
  signalGroups: groups
});
const globalRisk = classifyGlobalNewsReaction(global("Risk-On", { futures: 0, risk: 0, sectors: 0 }, "2026-07-20T11:45:00.000Z"), global("Risk-Off", { futures: -2, risk: -2, sectors: -2 }));
assert.equal(globalRisk.classification, "risk_increase");
assert.match(globalRisk.reactionSummary, /지수선물 약세 확대/);
assert.match(globalRisk.reactionSummary, /변동성·달러·채권 부담 확대/);
assert.equal(classifyGlobalNewsReaction(global("Risk-On", { futures: 0, risk: 0, sectors: 0 }, "2026-07-20T11:45:00.000Z"), global("Risk-On", { futures: 2, risk: 1.6, sectors: 0 })).classification, "supports_existing_state");
assert.equal(classifyGlobalNewsReaction(global("Risk-On", { futures: 0, risk: 0, sectors: 0 }, "2026-07-20T11:45:00.000Z"), global("Risk-On", { futures: -2, risk: -1.6, sectors: 0 })).classification, "conflicts_with_existing_state");
assert.equal(
  classifyGlobalNewsReaction(
    { ...global("Risk-On", { futures: 0, risk: 0, sectors: 0 }), observedAt: "2026-07-20T12:30:00.000Z" },
    { ...global("Risk-Off", { futures: -2, risk: -2, sectors: -2 }), observedAt: "2026-07-20T12:15:00.000Z" }
  ).classification,
  "insufficient_data",
  "a Global observation cannot predate its baseline"
);

assert.equal(nextNewsImpactCheckAt("2026-07-20T12:00:00.000Z", "detected"), "2026-07-20T12:15:00.000Z");
assert.equal(nextNewsImpactCheckAt("2026-07-20T12:14:59.000Z", "detected"), "2026-07-20T12:29:59.000Z");
assert.equal(nextNewsImpactCheckAt("2026-07-20T12:00:00.000Z", "provisional_15m"), "2026-07-20T13:00:00.000Z");
assert.equal(nextNewsImpactCheckAt("2026-07-20T12:00:00.000Z", "final_60m"), null);
assert.equal(newsReactionAnchorAt({ macroEventId: "macro", version: 1, occurredAt: "2026-07-20T12:00:00.000Z", firstSeenAt: "2026-07-20T12:30:00.000Z", updatedAt: "2026-07-20T12:30:00.000Z" }), "2026-07-20T12:00:00.000Z");
assert.equal(newsReactionAnchorAt({ macroEventId: "macro", version: 2, occurredAt: "2026-07-20T12:00:00.000Z", firstSeenAt: "2026-07-20T12:01:00.000Z", updatedAt: "2026-07-20T15:00:00.000Z" }), "2026-07-20T15:00:00.000Z", "a revised macro release anchors to the revision detection time");
assert.equal(
  newsReactionAnchorAt({
    macroEventId: "macro",
    version: 2,
    occurredAt: "2026-07-20T12:00:00.000Z",
    firstSeenAt: "2026-07-20T12:01:00.000Z",
    updatedAt: "2026-07-20T18:00:00.000Z",
    revisionDetectedAt: "2026-07-20T15:00:00.000Z"
  }),
  "2026-07-20T15:00:00.000Z",
  "duplicate sync updates must not move a revision's reaction window"
);
assert.equal(newsReactionAnchorAt({ version: 1, occurredAt: "2026-07-20T12:00:00.000Z", firstSeenAt: "2026-07-20T12:30:00.000Z", updatedAt: "2026-07-20T12:30:00.000Z" }), "2026-07-20T12:30:00.000Z", "a delayed surprise event anchors to first detection");
assert.equal(newsReactionAnchorAt({ version: 2, occurredAt: "2026-07-20T12:00:00.000Z", firstSeenAt: "2026-07-20T12:30:00.000Z", updatedAt: "2026-07-20T13:00:00.000Z" }), "2026-07-20T13:00:00.000Z", "a non-macro revision anchors to revision detection");

const event = {
  id: "20000000-0000-4000-8000-000000000001",
  semanticKey: "fixture",
  market: "crypto",
  category: "macro",
  targets: ["btc"],
  importance: "high",
  version: 1,
  status: "active",
  occurredAt: "2026-07-20T12:00:00.000Z",
  firstSeenAt: "2026-07-20T12:01:00.000Z",
  updatedAt: "2026-07-20T12:01:00.000Z",
  headline: "fixture",
  factSummary: "fixture",
  primarySource: { id: "source", name: "source", kind: "official", url: "https://example.com", publishedAt: "2026-07-20T12:00:00.000Z" },
  sourceCount: 1,
  reaction: null,
  pro: { sources: [], reactionHistory: [], metrics: [], revisions: [] }
} satisfies NewsImpactEvent;
assert.equal(Object.prototype.hasOwnProperty.call(serializeBasicNewsImpactEvent(event), "pro"), false);
const eventWithPrivateReaction = {
  ...event,
  reaction: {
    eventId: event.id,
    reactionId: "30000000-0000-4000-8000-000000000001",
    eventVersion: 1,
    market: "crypto",
    target: "btc",
    stage: "final_60m",
    classification: "risk_increase",
    riskEffect: "increased",
    quality: "ready",
    eventAt: event.occurredAt,
    evaluatedAt: event.updatedAt,
    headline: event.headline,
    factSummary: event.factSummary,
    reactionSummary: "fixture",
    nextCheckAt: null,
    preSnapshotId: "40000000-0000-4000-8000-000000000001",
    evaluatedSnapshotId: "40000000-0000-4000-8000-000000000002",
    priceChangePercent: 1.25,
    stateBefore: "neutral",
    stateAfter: "risk"
  }
} satisfies NewsImpactEvent;
const basicEvent = serializeBasicNewsImpactEvent(eventWithPrivateReaction);
assert.equal(Object.prototype.hasOwnProperty.call(basicEvent.reaction ?? {}, "preSnapshotId"), false);
assert.equal(Object.prototype.hasOwnProperty.call(basicEvent.reaction ?? {}, "evaluatedSnapshotId"), false);
assert.equal(Object.prototype.hasOwnProperty.call(basicEvent.reaction ?? {}, "priceChangePercent"), false);
assert.equal(Object.prototype.hasOwnProperty.call(basicEvent.reaction ?? {}, "stateBefore"), false);
const officialEvent = serializeOfficialNewsImpactEvent(eventWithPrivateReaction);
assert.equal(officialEvent.reaction, null, "shadow official facts must not expose a provisional or final market-reaction classification");
assert.equal(Object.prototype.hasOwnProperty.call(officialEvent, "pro"), false, "shadow official facts must not expose paid evidence before the impact gate opens");
const futureInternalEvent = { ...eventWithPrivateReaction, internalScore: 99, providerPayload: { secret: true } } as NewsImpactEvent;
const officialAllowlist = serializeOfficialNewsImpactEvent(futureInternalEvent) as NewsImpactEvent & Record<string, unknown>;
assert.equal(Object.prototype.hasOwnProperty.call(officialAllowlist, "internalScore"), false, "official-only serialization must be an allowlist rather than spreading future internal fields");
assert.equal(Object.prototype.hasOwnProperty.call(officialAllowlist, "providerPayload"), false, "provider payloads must never cross the official-only API boundary");
assert.deepEqual(
  repairLegacyMacroPresentation({
    category: "macro",
    macroEventKey: "core-ppi-mom-1784118600000",
    headline: "미국 주요 경제지표 공식 발표",
    factSummary: "미국 공식 기관이 공식 경제지표를 발표했습니다."
  }),
  {
    headline: "미국 근원 생산자물가지수(PPI) 발표",
    factSummary: "미국 근원 생산자물가지수(PPI) 발표 내용이 공식 자료에 반영됐습니다."
  },
  "legacy generic titles must be repaired consistently for NEWS and frozen Journal context"
);
assert.match(newsStoreSource, /revision_detected_at/, "the event ledger must persist an immutable revision detection timestamp");
assert.match(newsStoreSource, /repairLegacyMacroPresentation/, "frozen reaction context must use the same legacy-title repair as the NEWS API");
assert.match(publicNewsReactionSummary({
  eventStatus: "revised",
  stage: "detected",
  reactionSummary: "공식 발표를 확인했습니다. 발표 이후 15분 시장 반응을 확인 중입니다."
}), /수정 시점 이후/, "a pending revision must not read like a brand-new release");

const observationNow = Date.parse("2026-07-20T12:30:00.000Z");
const candle = (iso: string) => ({ time: Date.parse(iso) / 1_000, open: 1, high: 1, low: 1, close: 1, volume: 1 });
assert.deepEqual(
  completedRecentGlobalCandles([
    candle("2026-07-20T12:20:00.000Z"),
    candle("2026-07-20T12:25:00.000Z"),
    candle("2026-07-20T12:30:00.000Z")
  ], observationNow).map((item) => item.time),
  [Date.parse("2026-07-20T12:20:00.000Z") / 1_000, Date.parse("2026-07-20T12:25:00.000Z") / 1_000],
  "the in-progress 5 minute candle must be excluded"
);
assert.equal(completedRecentGlobalCandles([candle("2026-07-20T10:00:00.000Z")], observationNow).length, 0, "closed but stale market data must fail closed");
assert.equal(globalObservationQuality({ availableFutures: 4, availableRisk: 3, availableSectors: 0 }), "ready", "two complete Global proxy groups are sufficient");
assert.equal(globalObservationQuality({ availableFutures: 4, availableRisk: 0, availableSectors: 0 }), "partial", "one proxy group must fail closed as partial");
assert.equal(globalObservationQuality({ availableFutures: 0, availableRisk: 0, availableSectors: 0 }), "unavailable");

console.log("News impact reaction and Basic/Pro serialization matrix passed.");
