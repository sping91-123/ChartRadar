// 푸시 크론 dry-run과 관리자 진단 응답 샘플을 구성한다.
import type { tokenPreferenceDecision } from "@/lib/server/push/preferences";
import { eventQualityThreshold } from "@/lib/server/push/eligibility";
import type {
  PushAlertEvent,
  PushEventDiagnostic,
  PushEventDiagnosticSample,
  PushPreferenceSkippedSample,
  PushScanDiagnostics,
  PushTokenRow
} from "@/lib/server/push/types";

function eventTimeframe(event: PushAlertEvent) {
  return event.data.timeframe;
}

export function emptyDiagnostics(overrides: Partial<PushScanDiagnostics> = {}): PushScanDiagnostics {
  return {
    tokenCount: 0,
    userCount: 0,
    profileCount: 0,
    subscriptionCount: 0,
    presetCount: 0,
    cryptoPresetCount: 0,
    stockPresetCount: 0,
    cryptoSetupCount: 0,
    stockPresetSetupCount: 0,
    stockMomentumSetupCount: 0,
    optionalEventCount: 0,
    genericEventCount: 0,
    candidateEventCount: 0,
    qualityPassedEventCount: 0,
    deliveryEligibleEventCount: 0,
    finalSendAttemptCount: 0,
    eligibleEventCount: 0,
    entitlementBlockedEventCount: 0,
    preferenceSkippedTokenCount: 0,
    duplicateSkippedTokenCount: 0,
    cooldownSkippedCount: 0,
    symbolCooldownSkippedCount: 0,
    marketScoutLimitSkippedCount: 0,
    globalBatchSkippedCount: 0,
    globalMomentumLimitSkippedCount: 0,
    globalAssetLimitSkippedCount: 0,
    sendTargetTokenCount: 0,
    skippedLowScoreCount: 0,
    lookupErrorCount: 0,
    scannerErrorCount: 0,
    skippedLowScoreSamples: [],
    preferenceSkippedSamples: [],
    duplicateSkippedSamples: [],
    topCandidateSamples: [],
    ...overrides
  };
}

export function eventDiagnosticSample(
  event: PushAlertEvent,
  skippedReason: PushEventDiagnostic["skippedReason"],
  wouldSend?: boolean
): PushEventDiagnosticSample {
  return {
    symbol: event.symbol ?? null,
    market: event.market,
    timeframe: eventTimeframe(event) ?? null,
    score: event.score ?? null,
    quality: event.quality ?? null,
    alertKind: event.alertKind,
    skippedReason,
    threshold: eventQualityThreshold(event),
    ...(wouldSend === undefined ? {} : { wouldSend })
  };
}

export function pushSample<T>(samples: T[], sample: T, limit = 8) {
  if (samples.length < limit) samples.push(sample);
}

export function eventDiagnostic(
  event: PushAlertEvent,
  skippedReason: PushEventDiagnostic["skippedReason"],
  targetTokenCount = 0
): PushEventDiagnostic {
  return {
    signalType: event.data.type ?? event.ruleId,
    ruleId: event.ruleId,
    market: event.market,
    symbol: event.symbol,
    timeframe: eventTimeframe(event),
    score: event.score,
    quality: event.quality,
    alertKind: event.alertKind,
    alertTitle: event.title,
    alertBody: event.body,
    title: event.title,
    reason: event.body,
    eventKey: event.eventKey,
    wouldSend: skippedReason === null || skippedReason === "dry_run",
    skippedReason,
    targetTokenCount,
    system: event.system === true,
    isWatchlist: event.isWatchlist === true,
    isMarketScout: event.isMarketScout === true,
    isWatchedSymbol: event.isWatchedSymbol === true,
    evidenceLabels: event.evidenceLabels ?? [],
    marketScoutRank: event.marketScoutRank,
    threshold: eventQualityThreshold(event)
  };
}

export function pushPreferenceSkippedSample(
  samples: PushPreferenceSkippedSample[],
  event: PushAlertEvent,
  tokens: PushTokenRow[],
  firstDecision: ReturnType<typeof tokenPreferenceDecision> | undefined
) {
  pushSample(samples, {
    market: event.market,
    alertKind: event.alertKind,
    ruleId: event.ruleId,
    reason: "token_preferences",
    skippedBy: firstDecision?.skippedBy ?? undefined,
    marketAllowed: firstDecision?.marketOk,
    ruleAllowed: firstDecision?.ruleOk,
    tokenMarkets: Array.from(new Set(tokens.flatMap((token) => token.markets ?? []))).slice(0, 8)
  });
}
