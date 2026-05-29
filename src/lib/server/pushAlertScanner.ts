// 서버 크론에서 알림 조건을 스캔하고 Android FCM 푸시를 발송한다.
import { getLiquidCryptoSymbols } from "@/lib/cryptoUniverse";
import { chartTimeframes, type Candle, type ChartTimeframe, type TradingMode } from "@/lib/marketAnalysis";
import { findSetupAlertMatches, type SetupAlertPreset } from "@/lib/setupAlertPresets";
import { scanAllSetups, type ScoutSetup } from "@/lib/setupScout";
import { sendFcmMessage } from "@/lib/server/firebaseMessaging";
import { alreadySent, duplicateBucket, recentSentEvents, recordSentEvent, type RecentPushAlertEventRow } from "@/lib/server/push/duplicateGuard";
import { emptyDiagnostics, eventDiagnostic, eventDiagnosticSample, pushPreferenceSkippedSample, pushSample } from "@/lib/server/push/diagnostics";
import {
  buildRiskOffEvent,
  buildSemiconductorLeadershipEvent,
  limitCryptoMarketScoutEvents,
  limitGlobalMarketScoutEvents,
  matchedSetupToEvent,
  setupToEvent,
  sideLabel,
  stockQuality,
  stockSignalLabel,
  topPushSetups
} from "@/lib/server/push/eventBuilders";
import {
  asArray,
  compactPushSymbol as compactSymbol,
  isCryptoMajorPushSymbol as isCryptoMajor,
  passesSetupPushQuality
} from "@/lib/server/push/eligibility";
import { ruleAllowed, userPlan } from "@/lib/server/push/entitlements";
import { tokenPreferenceDecision, tokenWants } from "@/lib/server/push/preferences";
import { scanLiquidationEvent } from "@/lib/server/push/scanners/liquidationScanner";
import { scanMacroCalendarEvent, scanNewsEvent } from "@/lib/server/push/scanners/macroScanner";
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
import { fetchStockCandles } from "@/lib/stockMarket";
import { analyzeTechnicalRadar } from "@/lib/technicalRadar";

const cryptoModes: TradingMode[] = ["scalp", "swing"];
const stockMomentumSymbols = ["QQQ", "SPY", "NQ=F", "ES=F", "^VIX", "VIXY", "SMH", "SOXX", "NVDA", "AMD", "UUP", "GLD", "TLT"];
const maxRecentEventLookbackHours = 6;
const cryptoAltMarketScoutCooldownMinutes = 360;
const setupSymbolCooldownMinutes = 120;
const cryptoAltMarketScoutGlobalCooldownMinutes = 60;

interface CooldownDecision {
  blocked: boolean;
  reason: "symbol_cooldown" | "market_scout_limit" | null;
  minutes: number;
}

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 180);
}

function asChartTimeframe(value: string): ChartTimeframe {
  return chartTimeframes.includes(value as ChartTimeframe) ? (value as ChartTimeframe) : "1d";
}

function stockModeFromTimeframe(timeframe: ChartTimeframe): TradingMode {
  return timeframe === "5m" || timeframe === "15m" ? "scalp" : "swing";
}

function presetFromRow(row: PushAlertPresetRow): SetupAlertPreset {
  return {
    id: row.preset_id,
    market: row.market,
    symbol: row.symbol,
    mode: row.mode ?? undefined,
    timeframe: row.timeframe,
    side: row.side,
    quality: row.quality,
    score: Number(row.score),
    headline: row.headline,
    savedAt: Date.parse(row.saved_at) || Date.now()
  };
}

async function buildStockSetup(symbol: string, timeframe: ChartTimeframe): Promise<ScoutSetup | null> {
  const candles = await fetchStockCandles(symbol, timeframe);
  if (candles.length < 60) return null;

  const report = analyzeTechnicalRadar(candles);
  if (!report.price) return null;

  const edge = report.bullishCount - report.bearishCount;
  if (Math.abs(edge) < 2) return null;

  const side: ScoutSetup["plan"]["side"] = edge > 0 ? "long" : "short";
  const score = Math.min(95, Math.max(50, 55 + Math.abs(edge) * 8));
  const mode = stockModeFromTimeframe(timeframe);
  const support = report.supportResistance.support;
  const resistance = report.supportResistance.resistance;

  return {
    symbol,
    mode,
    timeframe,
    analysis: {} as ScoutSetup["analysis"],
    plan: {
      mode,
      side,
      quality: stockQuality(score),
      title: side === "long" ? "글로벌 기술 레이더 상승 우세" : "글로벌 기술 레이더 하락 우세",
      entryLabel: "현재 기술지표 재감지",
      entryLow: report.price,
      entryHigh: report.price,
      invalidation: side === "long" ? support ?? report.price * 0.98 : resistance ?? report.price * 1.02,
      target1: side === "long" ? resistance ?? report.price * 1.03 : support ?? report.price * 0.97,
      target2: side === "long" ? report.price * 1.06 : report.price * 0.94,
      rr1: 1,
      rr2: 2,
      confidence: score,
      reason: report.summary,
      cautions: []
    },
    score,
    status: "active",
    headline: `${symbol} ${timeframe} ${sideLabel(side, "stocks")} 재감지`,
    distancePercent: 0,
    insideZone: true,
    proximity: "ready",
    currentPrice: report.price,
    scannedAt: new Date().toISOString()
  };
}

async function scanCryptoSetups() {
  const symbolGroups = await Promise.all([
    getLiquidCryptoSymbols({ includeMajor: true, limit: 40 }),
    getLiquidCryptoSymbols({ excludeMajor: true, limit: 36 })
  ]);
  const symbols = Array.from(new Set(["BTCUSDT.P", "ETHUSDT.P", ...symbolGroups.flat()]));
  const settled = await Promise.allSettled(
    cryptoModes.map(async (mode) => {
      const all = await scanAllSetups({ mode, riskProfile: "radar", symbols });
      return topPushSetups(all, 16);
    })
  );
  return settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}

async function scanStockSetups(symbolsAndTimeframes: Array<{ symbol: string; timeframe: string }>) {
  const unique = Array.from(new Set(symbolsAndTimeframes.map((item) => `${item.symbol}:${item.timeframe}`)));
  const settled = await Promise.allSettled(
    unique.map(async (key) => {
      const [symbol, rawTimeframe] = key.split(":");
      return buildStockSetup(symbol ?? "QQQ", asChartTimeframe(rawTimeframe ?? "1d"));
    })
  );
  return settled.flatMap((result) => (result.status === "fulfilled" && result.value ? [result.value] : []));
}

async function sendEventToUser(userId: string, tokens: PushTokenRow[], event: PushAlertEvent) {
  const targetTokens = tokens.filter((token) => tokenWants(token, event));
  const preferenceSkipped = Math.max(0, tokens.length - targetTokens.length);
  if (targetTokens.length === 0) {
    return { sent: 0, skipped: 0, failed: 0, preferenceSkipped, duplicateSkipped: 0, targetTokens: 0 };
  }
  if (await alreadySent(userId, event.eventKey)) {
    return {
      sent: 0,
      skipped: targetTokens.length,
      failed: 0,
      preferenceSkipped,
      duplicateSkipped: targetTokens.length,
      targetTokens: targetTokens.length
    };
  }

  const results = await Promise.allSettled(
    targetTokens.map((token) =>
      sendFcmMessage({
        token: token.token,
        title: event.title,
        body: event.body,
        data: event.data
      })
    )
  );
  const sent = results.filter((result) => result.status === "fulfilled").length;
  const failed = results.length - sent;
  if (sent > 0) await recordSentEvent(userId, event, sent);
  return { sent, skipped: 0, failed, preferenceSkipped, duplicateSkipped: 0, targetTokens: targetTokens.length };
}

function personalizeEventForUser(event: PushAlertEvent, userPresets: PushAlertPresetRow[]): PushAlertEvent {
  const watchedSymbols = new Set(userPresets.map((preset) => preset.symbol));
  const isWatchedSymbol = event.symbol ? watchedSymbols.has(event.symbol) : event.isWatchlist === true;
  if (!event.isMarketScout) {
    return {
      ...event,
      isWatchedSymbol,
      data: {
        ...event.data,
        is_watched_symbol: String(isWatchedSymbol)
      }
    };
  }

  if (event.market === "crypto" && event.symbol && !isCryptoMajor(event.symbol)) {
    const symbol = compactSymbol(event.symbol);
    const body = isWatchedSymbol
      ? `${symbol}가 알트 시장 후보에 잡혔습니다. 저장 여부와 근거를 확인해 주세요.`
      : `${symbol}가 시장 스캔 후보에 잡혔습니다. 앱에서 근거를 확인해 주세요.`;
    return {
      ...event,
      body,
      isWatchedSymbol,
      data: {
        ...event.data,
        is_watched_symbol: String(isWatchedSymbol)
      }
    };
  }

  return {
    ...event,
    isWatchedSymbol,
    data: {
      ...event.data,
      is_watched_symbol: String(isWatchedSymbol)
    }
  };
}

function recentPayloadValue(row: RecentPushAlertEventRow, key: string) {
  const value = row.payload?.[key];
  return typeof value === "string" ? value : undefined;
}

function recentAlertKind(row: RecentPushAlertEventRow) {
  return recentPayloadValue(row, "alert_kind") ?? recentPayloadValue(row, "alertKind") ?? row.rule_id;
}

function recentSymbol(row: RecentPushAlertEventRow) {
  return recentPayloadValue(row, "symbol");
}

function recentEventAgeMinutes(row: RecentPushAlertEventRow) {
  const createdAt = new Date(row.created_at).getTime();
  if (!Number.isFinite(createdAt)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (Date.now() - createdAt) / 60000);
}

function isCryptoAltMarketScoutEvent(event: Pick<PushAlertEvent, "market" | "alertKind" | "symbol">) {
  return event.market === "crypto" && event.alertKind === "market_scout" && Boolean(event.symbol) && !isCryptoMajor(event.symbol ?? "");
}

function recentRowMatchesEventSymbol(row: RecentPushAlertEventRow, event: PushAlertEvent) {
  if (row.market !== event.market) return false;
  if (recentAlertKind(row) !== event.alertKind) return false;
  if (!event.symbol) return false;
  return recentSymbol(row) === event.symbol;
}

function recentRowIsCryptoAltMarketScout(row: RecentPushAlertEventRow) {
  const symbol = recentSymbol(row);
  return row.market === "crypto" && recentAlertKind(row) === "market_scout" && Boolean(symbol) && !isCryptoMajor(symbol ?? "");
}

function cooldownMinutesForEvent(event: PushAlertEvent) {
  if (event.ruleId === "liquidation-pressure") return 0;
  if (isCryptoAltMarketScoutEvent(event)) return cryptoAltMarketScoutCooldownMinutes;
  if (event.score !== undefined) return setupSymbolCooldownMinutes;
  return 0;
}

function cooldownDecisionForEvent(recentRows: RecentPushAlertEventRow[], event: PushAlertEvent): CooldownDecision {
  const symbolCooldownMinutes = cooldownMinutesForEvent(event);
  if (symbolCooldownMinutes > 0) {
    const hasRecentSymbolEvent = recentRows.some((row) => recentRowMatchesEventSymbol(row, event) && recentEventAgeMinutes(row) < symbolCooldownMinutes);
    if (hasRecentSymbolEvent) {
      return { blocked: true, reason: "symbol_cooldown", minutes: symbolCooldownMinutes };
    }
  }

  if (isCryptoAltMarketScoutEvent(event)) {
    const hasRecentAltMarketScout = recentRows.some(
      (row) => recentRowIsCryptoAltMarketScout(row) && recentEventAgeMinutes(row) < cryptoAltMarketScoutGlobalCooldownMinutes
    );
    if (hasRecentAltMarketScout) {
      return { blocked: true, reason: "market_scout_limit", minutes: cryptoAltMarketScoutGlobalCooldownMinutes };
    }
  }

  return { blocked: false, reason: null, minutes: 0 };
}

function eventToRecentRow(event: PushAlertEvent): RecentPushAlertEventRow {
  return {
    event_key: event.eventKey,
    market: event.market,
    rule_id: event.ruleId,
    payload: event.data,
    created_at: new Date().toISOString()
  };
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

  const cryptoSetups = await scanRows("crypto-setups", scanCryptoSetups);
  const stockPresetSetups = await scanRows("stock-preset-setups", () =>
    scanStockSetups(presetRows.filter((preset) => preset.market === "stocks").map((preset) => ({ symbol: preset.symbol, timeframe: preset.timeframe })))
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
  const globalCompositeEvents = [buildRiskOffEvent(stockMomentumSetups), buildSemiconductorLeadershipEvent(stockMomentumSetups)];
  const rawCryptoMarketScoutEvents = topPushSetups(cryptoSetups, 8).map((setup, index) =>
    setupToEvent(setup, "radar-grade", "crypto", "radar-grade", index + 1)
  );
  const limitedCryptoMarketScoutEvents = limitCryptoMarketScoutEvents(rawCryptoMarketScoutEvents);
  const cryptoMarketScoutEvents = limitedCryptoMarketScoutEvents.events;
  const rawStockMarketScoutEvents = topPushSetups(stockMomentumSetups, 6).map((setup, index) =>
    setupToEvent(setup, "stock-momentum", "stocks", "stock-momentum", index + 1)
  );
  const limitedStockMarketScoutEvents = limitGlobalMarketScoutEvents(rawStockMarketScoutEvents);
  const stockMarketScoutEvents = limitedStockMarketScoutEvents.events;
  const genericEvents = [
    ...cryptoMarketScoutEvents,
    ...stockMarketScoutEvents,
    ...globalCompositeEvents,
    ...optionalEventSources.map((source) => source.event)
  ].filter((event): event is PushAlertEvent => event !== null);

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  let events = 0;
  let entitlementBlockedEventCount = 0;
  let preferenceSkippedTokenCount = 0;
  let duplicateSkippedTokenCount = 0;
  let cooldownSkippedCount = 0;
  let symbolCooldownSkippedCount = 0;
  let marketScoutLimitSkippedCount = limitedCryptoMarketScoutEvents.skipped;
  let globalBatchSkippedCount = limitedStockMarketScoutEvents.globalBatchSkippedCount;
  let globalMomentumLimitSkippedCount = limitedStockMarketScoutEvents.globalMomentumLimitSkippedCount;
  let globalAssetLimitSkippedCount = limitedStockMarketScoutEvents.globalAssetLimitSkippedCount;
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
      const userPresets = presetRows.filter((preset) => preset.user_id === userId);
      const cryptoPresetMatches = findSetupAlertMatches(
        userPresets.filter((preset) => preset.market === "crypto").map(presetFromRow),
        cryptoSetups,
        "crypto"
      ).map((match) => matchedSetupToEvent(match.setup, "watchlist-surge", "crypto", "preset"));
      const stockPresetMatches = findSetupAlertMatches(
        userPresets.filter((preset) => preset.market === "stocks").map(presetFromRow),
        stockPresetSetups,
        "stocks"
      ).map((match) => matchedSetupToEvent(match.setup, "stock-momentum", "stocks", "preset"));

      const userGenericEvents = genericEvents.map((event) => personalizeEventForUser(event, userPresets));
      const allUserEvents = [...userGenericEvents, ...cryptoPresetMatches, ...stockPresetMatches];
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
      cryptoPresetCount: presetRows.filter((preset) => preset.market === "crypto").length,
      stockPresetCount: presetRows.filter((preset) => preset.market === "stocks").length,
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
