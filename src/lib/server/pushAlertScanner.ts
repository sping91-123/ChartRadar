// 서버 크론에서 알림 조건을 스캔하고 Android FCM 푸시를 발송한다.
import { cooldownDecisionForEvent, eventToRecentRow, type CooldownDecision } from "@/lib/server/push/cooldown";
import { alreadySent, duplicateBucket, recentSentEvents, type RecentPushAlertEventRow } from "@/lib/server/push/duplicateGuard";
import { emptyDiagnostics, eventDiagnostic, eventDiagnosticSample, pushPreferenceSkippedSample, pushSample } from "@/lib/server/push/diagnostics";
import { asArray, passesSetupPushQuality } from "@/lib/server/push/eligibility";
import { ruleAllowed, userPlan } from "@/lib/server/push/entitlements";
import { buildGenericPushEvents } from "@/lib/server/push/genericEvents";
import { personalizeEventForUser } from "@/lib/server/push/personalization";
import { tokenPreferenceDecision } from "@/lib/server/push/preferences";
import { buildUserPresetEvents } from "@/lib/server/push/presetEvents";
import { groupPresetsByUser, presetCountForMarket, presetScanInputsForMarket } from "@/lib/server/push/presets";
import { scanLiquidationEvent } from "@/lib/server/push/scanners/liquidationScanner";
import { scanMacroCalendarEvent, scanNewsEvent } from "@/lib/server/push/scanners/macroScanner";
import { scanCryptoSetups, scanStockSetups, stockMomentumSymbols } from "@/lib/server/push/scanners/setupScanner";
import { sendEventToUser } from "@/lib/server/push/sendPush";
import { scanOptionalEventSource } from "@/lib/server/push/sourceResults";
import type {
  PushAlertEvent,
  PushAlertPresetRow,
  PushDuplicateSkippedSample,
  PushEventDiagnostic,
  PushEventDiagnosticSample,
  PushPreferenceSkippedSample,
  PushProfileRow,
  PushSubscriptionRow,
  PushTokenRow,
  ScanContext
} from "@/lib/server/push/types";
import { supabaseAdminRest } from "@/lib/server/supabaseAdmin";

const maxRecentEventLookbackHours = 6;

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 180);
}

export async function runPushAlertScan(context: ScanContext) {
  const dryRun = context.dryRun === true;
  const diagnosticsLimit = Math.max(0, Math.min(context.diagnosticsLimit ?? 40, 100));
  const eventDiagnostics: PushEventDiagnostic[] = [];
  const warnings: string[] = [];
  let lookupErrorCount = 0;
  let scannerErrorCount = 0;
  const pushDiagnostic = (diagnostic: PushEventDiagnostic) => {
    if (eventDiagnostics.length < diagnosticsLimit) eventDiagnostics.push(diagnostic);
  };
  const readRows = async <T>(label: string, path: string) => {
    try {
      return asArray(await supabaseAdminRest<T[] | null>(path));
    } catch (error) {
      lookupErrorCount += 1;
      const message = safeErrorMessage(error);
      console.warn("[push-cron] lookup failed", { label, message });
      warnings.push(`${label}: ${message}`);
      return [];
    }
  };
  const scanRows = async <T>(label: string, scan: () => Promise<T[]>) => {
    try {
      return asArray(await scan());
    } catch (error) {
      scannerErrorCount += 1;
      const message = safeErrorMessage(error);
      console.warn("[push-cron] scanner source failed", { label, message });
      warnings.push(`${label}: ${message}`);
      return [];
    }
  };

  const tokens = await readRows<PushTokenRow>(
    "push_tokens",
    "push_tokens?select=id,user_id,token,markets,rule_ids&enabled=eq.true&platform=eq.android&provider=eq.fcm&limit=500"
  );
  if (tokens.length === 0) {
    return {
      users: 0,
      events: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      sources: {
        succeeded: [],
        skipped: [],
        failed: []
      },
      warnings,
      diagnostics: emptyDiagnostics({ lookupErrorCount, scannerErrorCount }),
      eventDiagnostics
    };
  }

  const userIds = Array.from(new Set(tokens.map((token) => token.user_id)));
  const profiles = await readRows<PushProfileRow>("profiles", `profiles?select=*&id=in.(${userIds.join(",")})`);
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const now = encodeURIComponent(new Date().toISOString());
  const subscriptionRows = await readRows<PushSubscriptionRow>(
    "subscriptions",
    `subscriptions?select=*&user_id=in.(${userIds.join(",")})&status=in.(active,trialing)&current_period_end=gt.${now}&order=current_period_end.desc&limit=1000`
  );
  const subscriptionsByUser = new Map<string, PushSubscriptionRow[]>();
  for (const subscription of subscriptionRows) {
    const rows = subscriptionsByUser.get(subscription.user_id) ?? [];
    rows.push(subscription);
    subscriptionsByUser.set(subscription.user_id, rows);
  }
  const presetRows = await readRows<PushAlertPresetRow>(
    "push_alert_presets",
    `push_alert_presets?select=user_id,market,preset_id,symbol,mode,timeframe,side,quality,score,headline,saved_at&enabled=eq.true&user_id=in.(${userIds.join(",")})&limit=1000`
  );
  const presetsByUser = groupPresetsByUser(presetRows);

  const cryptoSetups = await scanRows("crypto-setups", scanCryptoSetups);
  const stockPresetSetups = await scanRows("stock-preset-setups", () =>
    scanStockSetups(presetScanInputsForMarket(presetRows, "stocks"))
  );
  const stockMomentumSetups = await scanRows("stock-momentum-setups", () =>
    scanStockSetups(stockMomentumSymbols.map((symbol) => ({ symbol, timeframe: "1d" })))
  );
  const optionalEventSources = await Promise.all([
    scanOptionalEventSource("liquidation-pressure", scanLiquidationEvent),
    scanOptionalEventSource("radar-news-crypto", () => scanNewsEvent(context.origin, "crypto")),
    scanOptionalEventSource("radar-news-stocks", () => scanNewsEvent(context.origin, "stocks")),
    scanOptionalEventSource("macro-calendar-stocks", () => scanMacroCalendarEvent(context.origin))
  ]);
  warnings.push(
    ...optionalEventSources
      .map((source) => source.warning)
      .filter((warning): warning is string => Boolean(warning))
  );
  const genericPushEvents = buildGenericPushEvents(cryptoSetups, stockMomentumSetups, optionalEventSources);
  const genericEvents = genericPushEvents.events;

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  let events = 0;
  let entitlementBlockedEventCount = 0;
  let preferenceSkippedTokenCount = 0;
  let duplicateSkippedTokenCount = 0;
  let cooldownSkippedCount = 0;
  let symbolCooldownSkippedCount = 0;
  let marketScoutLimitSkippedCount = genericPushEvents.marketScoutLimitSkippedCount;
  let globalBatchSkippedCount = genericPushEvents.globalBatchSkippedCount;
  let globalMomentumLimitSkippedCount = genericPushEvents.globalMomentumLimitSkippedCount;
  let globalAssetLimitSkippedCount = genericPushEvents.globalAssetLimitSkippedCount;
  let sendTargetTokenCount = 0;
  let skippedLowScoreCount = 0;
  let candidateEventCount = 0;
  let qualityPassedEventCount = 0;
  let deliveryEligibleEventCount = 0;
  let finalSendAttemptCount = 0;
  const skippedLowScoreSamples: PushEventDiagnosticSample[] = [];
  const preferenceSkippedSamples: PushPreferenceSkippedSample[] = [];
  const duplicateSkippedSamples: PushDuplicateSkippedSample[] = [];
  const topCandidateSampleMap = new Map<string, PushEventDiagnosticSample>();

  for (const userId of userIds) {
    const userTokens = tokens.filter((token) => token.user_id === userId);
    try {
      const recentSinceIso = new Date(Date.now() - maxRecentEventLookbackHours * 60 * 60000).toISOString();
      const recentRows = await recentSentEvents(userId, recentSinceIso);
      const recentRowsForUser = [...recentRows];
      const plan = userPlan(profileMap, subscriptionsByUser, userId);
      const userPresets = presetsByUser.get(userId) ?? [];

      const userGenericEvents = genericEvents.map((event) => personalizeEventForUser(event, userPresets));
      const allUserEvents = [...userGenericEvents, ...buildUserPresetEvents(userPresets, cryptoSetups, stockPresetSetups)];
      candidateEventCount += allUserEvents.length;
      for (const event of allUserEvents) {
        const skippedReason = passesSetupPushQuality(event) ? null : "low_score";
        const key = event.eventKey;
        if (!topCandidateSampleMap.has(key)) topCandidateSampleMap.set(key, eventDiagnosticSample(event, skippedReason, skippedReason === null));
      }
      const qualityCheckedEvents = allUserEvents.filter((event) => {
        const allowed = passesSetupPushQuality(event);
        if (!allowed) skippedLowScoreCount += 1;
        if (!allowed) {
          pushDiagnostic(eventDiagnostic(event, "low_score"));
          pushSample(skippedLowScoreSamples, eventDiagnosticSample(event, "low_score"));
        }
        return allowed;
      });
      qualityPassedEventCount += qualityCheckedEvents.length;
      const userEvents = qualityCheckedEvents.filter((event) => {
        const allowed = ruleAllowed(event, plan);
        if (!allowed) pushDiagnostic(eventDiagnostic(event, "entitlement"));
        return allowed;
      });
      entitlementBlockedEventCount += qualityCheckedEvents.length - userEvents.length;
      events += userEvents.length;
      deliveryEligibleEventCount += userEvents.length;

      for (const event of userEvents) {
        const preferenceDecisions = userTokens.map((token) => tokenPreferenceDecision(token, event));
        const targetTokens = userTokens.filter((_, index) => preferenceDecisions[index]?.allowed === true);
        const cooldownDecision: CooldownDecision =
          targetTokens.length > 0 ? cooldownDecisionForEvent(recentRowsForUser, event) : { blocked: false, reason: null, minutes: 0 };
        if (dryRun) {
          preferenceSkippedTokenCount += Math.max(0, userTokens.length - targetTokens.length);
          if (targetTokens.length === 0) {
            pushDiagnostic(eventDiagnostic(event, "token_preferences"));
            pushPreferenceSkippedSample(preferenceSkippedSamples, event, userTokens, preferenceDecisions[0]);
            continue;
          }
          if (cooldownDecision.blocked) {
            skipped += targetTokens.length;
            cooldownSkippedCount += targetTokens.length;
            if (cooldownDecision.reason === "symbol_cooldown") symbolCooldownSkippedCount += targetTokens.length;
            if (cooldownDecision.reason === "market_scout_limit") marketScoutLimitSkippedCount += targetTokens.length;
            sendTargetTokenCount += targetTokens.length;
            pushDiagnostic(eventDiagnostic(event, cooldownDecision.reason === "market_scout_limit" ? "rate_limit" : "cooldown", targetTokens.length));
            continue;
          }
          if (await alreadySent(userId, event.eventKey)) {
            skipped += targetTokens.length;
            duplicateSkippedTokenCount += targetTokens.length;
            sendTargetTokenCount += targetTokens.length;
            pushDiagnostic(eventDiagnostic(event, "duplicate", targetTokens.length));
            pushSample(duplicateSkippedSamples, {
              eventKey: event.eventKey,
              market: event.market,
              symbol: event.symbol ?? null,
              bucket: duplicateBucket(event.eventKey),
              reason: "duplicate"
            });
            continue;
          }
          sendTargetTokenCount += targetTokens.length;
          finalSendAttemptCount += targetTokens.length;
          pushDiagnostic(eventDiagnostic(event, "dry_run", targetTokens.length));
          recentRowsForUser.unshift(eventToRecentRow(event));
          continue;
        }

        if (targetTokens.length > 0 && cooldownDecision.blocked) {
          skipped += targetTokens.length;
          cooldownSkippedCount += targetTokens.length;
          if (cooldownDecision.reason === "symbol_cooldown") symbolCooldownSkippedCount += targetTokens.length;
          if (cooldownDecision.reason === "market_scout_limit") marketScoutLimitSkippedCount += targetTokens.length;
          sendTargetTokenCount += targetTokens.length;
          pushDiagnostic(eventDiagnostic(event, cooldownDecision.reason === "market_scout_limit" ? "rate_limit" : "cooldown", targetTokens.length));
          continue;
        }

        const result = await sendEventToUser(userId, userTokens, event);
        if (result.targetTokens === 0) pushPreferenceSkippedSample(preferenceSkippedSamples, event, userTokens, preferenceDecisions[0]);
        sent += result.sent;
        skipped += result.skipped;
        failed += result.failed;
        preferenceSkippedTokenCount += result.preferenceSkipped;
        duplicateSkippedTokenCount += result.duplicateSkipped;
        sendTargetTokenCount += result.targetTokens;
        finalSendAttemptCount += result.sent + result.failed;
        if (result.sent > 0) recentRowsForUser.unshift(eventToRecentRow(event));
      }
    } catch (error) {
      scannerErrorCount += 1;
      failed += userTokens.length;
      const message = safeErrorMessage(error);
      console.warn("[push-cron] user scan skipped", { message });
      warnings.push(`user-scan: ${message}`);
    }
  }

  return {
    users: userIds.length,
    events,
    sent,
    skipped,
    failed,
    sources: {
      succeeded: optionalEventSources.filter((source) => !source.warning && source.event).map((source) => source.label),
      skipped: optionalEventSources.filter((source) => !source.warning && !source.event).map((source) => source.label),
      failed: optionalEventSources.filter((source) => source.warning).map((source) => source.label)
    },
    warnings,
    diagnostics: emptyDiagnostics({
      tokenCount: tokens.length,
      userCount: userIds.length,
      profileCount: profiles.length,
      subscriptionCount: subscriptionRows.length,
      presetCount: presetRows.length,
      cryptoPresetCount: presetCountForMarket(presetRows, "crypto"),
      stockPresetCount: presetCountForMarket(presetRows, "stocks"),
      cryptoSetupCount: cryptoSetups.length,
      stockPresetSetupCount: stockPresetSetups.length,
      stockMomentumSetupCount: stockMomentumSetups.length,
      optionalEventCount: optionalEventSources.filter((source) => source.event).length,
      genericEventCount: genericEvents.length,
      candidateEventCount,
      qualityPassedEventCount,
      deliveryEligibleEventCount,
      finalSendAttemptCount,
      eligibleEventCount: events,
      entitlementBlockedEventCount,
      preferenceSkippedTokenCount,
      duplicateSkippedTokenCount,
      cooldownSkippedCount,
      symbolCooldownSkippedCount,
      marketScoutLimitSkippedCount,
      globalBatchSkippedCount,
      globalMomentumLimitSkippedCount,
      globalAssetLimitSkippedCount,
      sendTargetTokenCount,
      skippedLowScoreCount,
      lookupErrorCount,
      scannerErrorCount,
      skippedLowScoreSamples,
      preferenceSkippedSamples,
      duplicateSkippedSamples,
      topCandidateSamples: Array.from(topCandidateSampleMap.values())
        .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
        .slice(0, 8)
    }),
    eventDiagnostics
  };
}
