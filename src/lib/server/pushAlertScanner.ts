// 서버 크론에서 알림 조건을 스캔하고 Android FCM 푸시를 발송한다.
import { getLiquidCryptoSymbols } from "@/lib/cryptoUniverse";
import { chartTimeframes, type Candle, type ChartTimeframe, type TradingMode } from "@/lib/marketAnalysis";
import type { RadarAlertRuleId } from "@/lib/radarAlerts";
import { findSetupAlertMatches, type SetupAlertMarket, type SetupAlertPreset } from "@/lib/setupAlertPresets";
import { scanAllSetups, type ScoutSetup } from "@/lib/setupScout";
import { sendFcmMessage } from "@/lib/server/firebaseMessaging";
import { alreadySent, duplicateBucket, eventBucket, recordSentEvent } from "@/lib/server/push/duplicateGuard";
import {
  asArray,
  compactPushSymbol as compactSymbol,
  eventQualityThreshold,
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
  PushScanDiagnostics,
  PushSubscriptionRow,
  PushTokenRow,
  ScanContext
} from "@/lib/server/push/types";
import { supabaseAdminRest } from "@/lib/server/supabaseAdmin";
import { fetchStockCandles } from "@/lib/stockMarket";
import { analyzeTechnicalRadar } from "@/lib/technicalRadar";

function emptyDiagnostics(overrides: Partial<PushScanDiagnostics> = {}): PushScanDiagnostics {
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

const cryptoModes: TradingMode[] = ["scalp", "swing"];
const stockMomentumSymbols = ["QQQ", "SPY", "NQ=F", "ES=F", "^VIX", "VIXY", "SMH", "SOXX", "NVDA", "AMD", "UUP", "GLD", "TLT"];
const stockIndexSymbols = new Set(["QQQ", "SPY", "NQ=F", "ES=F"]);
const volatilitySymbols = new Set(["^VIX", "VIXY"]);
const semiconductorSymbols = new Set(["SMH", "SOXX", "NVDA", "AMD"]);
const riskOffAssetSymbols = new Set(["UUP", "GLD", "TLT"]);

function cryptoSetupTargetPath(symbol?: string) {
  return symbol && !isCryptoMajor(symbol) ? "/alts" : "/crypto";
}

function stockSetupTargetPath(symbol?: string) {
  return symbol && !stockIndexSymbols.has(symbol) ? "/global/assets" : "/global";
}

function setupTargetPath(market: SetupAlertMarket, symbol?: string) {
  return market === "crypto" ? cryptoSetupTargetPath(symbol) : stockSetupTargetPath(symbol);
}

function stockSetupAlertKind(symbol: string): PushAlertEvent["alertKind"] {
  return stockIndexSymbols.has(symbol) ? "global_momentum" : "global_asset";
}

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 180);
}

function sideLabel(side: "long" | "short", market: SetupAlertMarket) {
  if (market === "stocks") return side === "long" ? "상승 우세" : "하락 우세";
  return side === "long" ? "롱 우세" : "숏 우세";
}

function stockSignalLabel(symbol: string) {
  if (symbol === "QQQ") return "나스닥 ETF";
  if (symbol === "SPY") return "S&P500 ETF";
  if (symbol === "NQ=F") return "나스닥 선물";
  if (symbol === "ES=F") return "S&P500 선물";
  if (symbol === "^VIX" || symbol === "VIXY") return "VIX 변동성";
  if (symbol === "SMH" || symbol === "SOXX") return "반도체 ETF";
  if (symbol === "NVDA") return "NVDA";
  if (symbol === "AMD") return "AMD";
  if (symbol === "UUP") return "달러";
  if (symbol === "GLD") return "금";
  if (symbol === "TLT") return "장기채";
  return compactSymbol(symbol);
}

function stockSignalTitle(symbol: string, side: "long" | "short") {
  if (volatilitySymbols.has(symbol)) {
    return side === "long" ? "Chart Radar 변동성 리스크 증가" : "Chart Radar 변동성 완화";
  }
  if (semiconductorSymbols.has(symbol)) return "Chart Radar 반도체 주도력 변화";
  if (riskOffAssetSymbols.has(symbol)) return "Chart Radar 방어 자산 변화";
  return "Chart Radar 글로벌 모멘텀 전환";
}

function stockSignalBody(setup: ScoutSetup) {
  const symbol = setup.symbol;
  const label = stockSignalLabel(symbol);
  const side = setup.plan.side;
  const score = Math.round(setup.score);

  if (volatilitySymbols.has(symbol)) {
    const direction = side === "long" ? "상승" : "완화";
    return `${label} ${setup.timeframe} 흐름이 ${direction} 쪽으로 바뀌었습니다. 지수와 리스크 흐름을 함께 확인하세요.`;
  }
  if (semiconductorSymbols.has(symbol)) {
    return `${label} ${setup.timeframe} ${sideLabel(side, "stocks")} ${score}점입니다. QQQ/SPY와 반도체 주도력 차이를 확인하세요.`;
  }
  if (riskOffAssetSymbols.has(symbol)) {
    return `${label} ${setup.timeframe} ${sideLabel(side, "stocks")} ${score}점입니다. 지수·변동성 흐름과 함께 확인하세요.`;
  }
  return `${label} ${setup.timeframe} ${sideLabel(side, "stocks")} ${score}점입니다. QQQ/SPY/NQ/ES 흐름 전환을 확인하세요.`;
}

function stockDirectionScore(setup: ScoutSetup) {
  return setup.plan.side === "long" ? setup.score : -setup.score;
}

function asChartTimeframe(value: string): ChartTimeframe {
  return chartTimeframes.includes(value as ChartTimeframe) ? (value as ChartTimeframe) : "1d";
}

function stockModeFromTimeframe(timeframe: ChartTimeframe): TradingMode {
  return timeframe === "5m" || timeframe === "15m" ? "scalp" : "swing";
}

function stockQuality(score: number): ScoutSetup["plan"]["quality"] {
  if (score >= 78) return "A";
  if (score >= 62) return "B";
  return "C";
}

function eventTimeframe(event: PushAlertEvent) {
  return event.data.timeframe;
}

function eventDiagnosticSample(event: PushAlertEvent, skippedReason: PushEventDiagnostic["skippedReason"], wouldSend?: boolean): PushEventDiagnosticSample {
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

function pushSample<T>(samples: T[], sample: T, limit = 8) {
  if (samples.length < limit) samples.push(sample);
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

function setupEvidenceLabels(setup: ScoutSetup) {
  const timeframeAnalyses = asArray(setup.analysis?.timeframeAnalyses);
  const active = timeframeAnalyses.find((analysis) => analysis.timeframe === setup.timeframe);
  const direction = setup.plan.side === "long" ? "bullish" : "bearish";
  const labels: string[] = [];
  const hasVolume = active ? active.condition.volumeState === "high" || (active.condition.volumeRatio ?? 0) >= 1.5 : false;
  const hasVolatility = active ? active.condition.volatilityState === "expanded" || Boolean(active.latestDisplacement) : false;
  const hasStructure = Boolean(
    active &&
      (active.msb === direction ||
        active.choch === direction ||
        active.latestCisd?.direction === direction ||
        active.latestSweep?.direction === direction ||
        (active.inOb && active.latestOb?.direction === direction) ||
        (active.inFvg && active.latestFvg?.direction === direction))
  );

  if (hasVolume) labels.push("거래량");
  if (hasVolatility) labels.push("변동성");
  if (hasStructure) labels.push("구조");
  return labels;
}

function setupMarketScoutTitle(setup: ScoutSetup, market: SetupAlertMarket, ruleId: RadarAlertRuleId) {
  if (market === "stocks" && ruleId === "stock-momentum") return stockSignalTitle(setup.symbol, setup.plan.side);
  if (market === "stocks") return "Chart Radar 글로벌 레이더 후보 감지";
  return isCryptoMajor(setup.symbol) ? "Chart Radar 레이더 후보 감지" : "Chart Radar 알트 시장 레이더 후보 감지";
}

function setupMarketScoutBody(setup: ScoutSetup, market: SetupAlertMarket, ruleId: RadarAlertRuleId) {
  if (market === "stocks" && ruleId === "stock-momentum") return stockSignalBody(setup);
  if (market === "stocks") {
    return `${stockSignalLabel(setup.symbol)} ${setup.timeframe} 시장 레이더 후보로 감지되었습니다. 앱에서 점수와 근거를 확인해 주세요.`;
  }
  if (isCryptoMajor(setup.symbol)) {
    return `${compactSymbol(setup.symbol)} ${setup.timeframe} 레이더 후보로 감지되었습니다. 앱에서 점수와 근거를 확인해 주세요.`;
  }
  return `${compactSymbol(setup.symbol)}가 알트 시장 레이더 후보에 잡혔습니다. 앱에서 거래량·변동성·구조 근거를 확인해 주세요.`;
}

function setupToEvent(
  setup: ScoutSetup,
  ruleId: RadarAlertRuleId,
  market: SetupAlertMarket,
  prefix: string,
  marketScoutRank?: number
): PushAlertEvent {
  const side = setup.plan.side;
  const isGlobalMomentum = market === "stocks" && ruleId === "stock-momentum";
  const evidenceLabels = setupEvidenceLabels(setup);
  const alertKind = market === "stocks" ? stockSetupAlertKind(setup.symbol) : "market_scout";
  return {
    market,
    ruleId,
    alertKind,
    eventKey: `${prefix}:${market}:${setup.symbol}:${setup.timeframe}:${side}:${eventBucket(15)}`,
    title: setupMarketScoutTitle(setup, market, ruleId),
    body: setupMarketScoutBody(setup, market, ruleId),
    data: {
      type: ruleId,
      market,
      alert_kind: alertKind,
      alertKind,
      target: market === "stocks" ? "/alerts?market=global" : "/alerts?market=crypto",
      targetPath: setupTargetPath(market, setup.symbol),
      symbol: setup.symbol,
      timeframe: setup.timeframe,
      side,
      signal: isGlobalMomentum ? stockSignalTitle(setup.symbol, side).replace("Chart Radar ", "") : ruleId,
      is_market_scout: "true",
      is_watchlist: "false",
      evidence: evidenceLabels.join(","),
      ...(marketScoutRank !== undefined ? { market_scout_rank: String(marketScoutRank) } : {})
    },
    score: setup.score,
    quality: setup.plan.quality,
    symbol: setup.symbol,
    system: true,
    isWatchlist: false,
    isMarketScout: true,
    evidenceLabels,
    marketScoutRank
  };
}

function matchedSetupToEvent(
  setup: { symbol: string; timeframe: string; side: "long" | "short"; score: number; quality?: ScoutSetup["plan"]["quality"] },
  ruleId: RadarAlertRuleId,
  market: SetupAlertMarket,
  prefix: string
): PushAlertEvent {
  return {
    market,
    ruleId,
    alertKind: "watchlist",
    eventKey: `${prefix}:${market}:${setup.symbol}:${setup.timeframe}:${setup.side}:${eventBucket(15)}`,
    title: market === "stocks" ? "Chart Radar 글로벌 조건 재감지" : "Chart Radar 관심코인 조건 재감지",
    body:
      market === "stocks"
        ? `${stockSignalLabel(setup.symbol)} ${setup.timeframe} 저장한 조건에 가까운 흐름이 다시 감지되었습니다. 앱에서 근거를 확인해 주세요.`
        : `${compactSymbol(setup.symbol)} ${setup.timeframe} 저장한 조건에 가까운 흐름이 다시 감지되었습니다. 앱에서 근거를 확인해 주세요.`,
    data: {
      type: ruleId,
      market,
      alert_kind: "watchlist",
      alertKind: "watchlist",
      target: market === "stocks" ? "/alerts?market=global" : "/alerts?market=crypto",
      targetPath: setupTargetPath(market, setup.symbol),
      symbol: setup.symbol,
      timeframe: setup.timeframe,
      side: setup.side,
      is_market_scout: "false",
      is_watchlist: "true"
    },
    score: setup.score,
    quality: setup.quality,
    symbol: setup.symbol,
    isWatchlist: true,
    isMarketScout: false
  };
}

function setupStatusRank(setup: ScoutSetup) {
  if (setup.status === "entry") return 3;
  if (setup.status === "active") return 2;
  return 1;
}

function setupQualityRank(setup: ScoutSetup) {
  if (setup.plan.quality === "A") return 3;
  if (setup.plan.quality === "B") return 2;
  return 1;
}

function topPushSetups(setups: ScoutSetup[] | null | undefined, limit: number) {
  const picked: ScoutSetup[] = [];
  const usedSymbols = new Set<string>();
  const ranked = [...asArray(setups)].sort((a, b) => {
    const scoreDiff = b.score - a.score;
    if (scoreDiff !== 0) return scoreDiff;
    const qualityDiff = setupQualityRank(b) - setupQualityRank(a);
    if (qualityDiff !== 0) return qualityDiff;
    return setupStatusRank(b) - setupStatusRank(a);
  });

  for (const setup of ranked) {
    if (usedSymbols.has(setup.symbol)) continue;
    picked.push(setup);
    usedSymbols.add(setup.symbol);
    if (picked.length >= limit) break;
  }

  return picked;
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

function buildRiskOffEvent(setups: ScoutSetup[]): PushAlertEvent | null {
  const weakIndex = setups
    .filter((setup) => stockIndexSymbols.has(setup.symbol) && setup.plan.side === "short" && setup.score >= 75)
    .sort((a, b) => b.score - a.score)[0];
  const strongVolatility = setups
    .filter((setup) => volatilitySymbols.has(setup.symbol) && setup.plan.side === "long" && setup.score >= 75)
    .sort((a, b) => b.score - a.score)[0];
  const strongDefense = setups
    .filter((setup) => riskOffAssetSymbols.has(setup.symbol) && setup.plan.side === "long" && setup.score >= 75)
    .sort((a, b) => b.score - a.score)[0];
  const companion = strongVolatility ?? strongDefense;
  if (!weakIndex || !companion) return null;
  const score = Math.min(weakIndex.score, companion.score);

  return {
    market: "stocks",
    ruleId: "stock-momentum",
    alertKind: "risk_off",
    eventKey: `risk-off:stocks:${weakIndex.symbol}:${companion.symbol}:${eventBucket(30)}`,
    title: "Chart Radar 리스크오프 조합",
    body: `${stockSignalLabel(weakIndex.symbol)} 약세와 ${stockSignalLabel(companion.symbol)} 강세가 함께 감지됐습니다. 변동성·달러·금 흐름을 확인하세요.`,
    data: {
      type: "stock-momentum",
      market: "global",
      alert_kind: "risk_off",
      alertKind: "risk_off",
      signal: "리스크오프 조합",
      target: "/alerts?market=global",
      targetPath: "/global",
      symbol: weakIndex.symbol,
      companion: companion.symbol,
      timeframe: weakIndex.timeframe,
      side: "short"
    },
    score,
    quality: stockQuality(score),
    symbol: weakIndex.symbol,
    system: true,
    isMarketScout: true
  };
}

function buildSemiconductorLeadershipEvent(setups: ScoutSetup[]): PushAlertEvent | null {
  const semiconductor = setups
    .filter((setup) => semiconductorSymbols.has(setup.symbol) && setup.score >= 75)
    .sort((a, b) => Math.abs(stockDirectionScore(b)) - Math.abs(stockDirectionScore(a)))[0];
  const index = setups
    .filter((setup) => stockIndexSymbols.has(setup.symbol) && setup.score >= 75)
    .sort((a, b) => Math.abs(stockDirectionScore(b)) - Math.abs(stockDirectionScore(a)))[0];
  if (!semiconductor || !index) return null;

  const delta = stockDirectionScore(semiconductor) - stockDirectionScore(index);
  if (Math.abs(delta) < 24) return null;
  const strengthened = delta > 0;
  const score = Math.min(semiconductor.score, index.score);

  return {
    market: "stocks",
    ruleId: "stock-momentum",
    alertKind: "semiconductor_leadership",
    eventKey: `semiconductor-leadership:stocks:${semiconductor.symbol}:${index.symbol}:${strengthened ? "strong" : "weak"}:${eventBucket(30)}`,
    title: `Chart Radar 반도체 주도력 ${strengthened ? "강화" : "약화"}`,
    body: `${stockSignalLabel(semiconductor.symbol)} 흐름이 ${stockSignalLabel(index.symbol)}보다 ${strengthened ? "강하게" : "약하게"} 감지됐습니다. 지수와 섹터 흐름 차이를 확인하세요.`,
    data: {
      type: "stock-momentum",
      market: "global",
      alert_kind: "semiconductor_leadership",
      alertKind: "semiconductor_leadership",
      signal: strengthened ? "반도체 주도력 강화" : "반도체 주도력 약화",
      target: "/alerts?market=global",
      targetPath: "/global/assets",
      symbol: semiconductor.symbol,
      companion: index.symbol,
      timeframe: semiconductor.timeframe,
      side: semiconductor.plan.side
    },
    score,
    quality: stockQuality(score),
    symbol: semiconductor.symbol,
    system: true,
    isMarketScout: true
  };
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

function eventDiagnostic(
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
      ? `${symbol}가 알트 시장 레이더 후보에 잡혔습니다. 저장 여부와 별개로 시장 전체 스캔 기준을 통과했습니다. 앱에서 거래량·변동성·구조 근거를 확인해 주세요.`
      : `관심코인은 아니지만, ${symbol}가 알트 시장 스캔에서 강한 후보로 감지되었습니다. 앱에서 거래량·변동성·구조 근거를 확인해 주세요.`;
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
  const cryptoMarketScoutEvents = topPushSetups(cryptoSetups, 8).map((setup, index) =>
    setupToEvent(setup, "radar-grade", "crypto", "radar-grade", index + 1)
  );
  const stockMarketScoutEvents = topPushSetups(stockMomentumSetups, 6).map((setup, index) =>
    setupToEvent(setup, "stock-momentum", "stocks", "stock-momentum", index + 1)
  );
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
        if (dryRun) {
          const preferenceDecisions = userTokens.map((token) => tokenPreferenceDecision(token, event));
          const targetTokens = userTokens.filter((_, index) => preferenceDecisions[index]?.allowed === true);
          preferenceSkippedTokenCount += Math.max(0, userTokens.length - targetTokens.length);
          if (targetTokens.length === 0) {
            const firstDecision = preferenceDecisions[0];
            pushDiagnostic(eventDiagnostic(event, "token_preferences"));
            pushSample(preferenceSkippedSamples, {
              market: event.market,
              alertKind: event.alertKind,
              ruleId: event.ruleId,
              reason: "token_preferences",
              skippedBy: firstDecision?.skippedBy ?? undefined,
              marketAllowed: firstDecision?.marketOk,
              ruleAllowed: firstDecision?.ruleOk
            });
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
          continue;
        }

        const result = await sendEventToUser(userId, userTokens, event);
        sent += result.sent;
        skipped += result.skipped;
        failed += result.failed;
        preferenceSkippedTokenCount += result.preferenceSkipped;
        duplicateSkippedTokenCount += result.duplicateSkipped;
        sendTargetTokenCount += result.targetTokens;
        finalSendAttemptCount += result.sent + result.failed;
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
