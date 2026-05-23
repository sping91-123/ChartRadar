// 서버 크론에서 알림 조건을 스캔하고 Android FCM 푸시를 발송한다.
import { hasMarketEntitlement, resolveCombinedBillingEntitlementPlan, type BillingEntitlementPlan } from "@/lib/billing";
import { getLiquidCryptoSymbols } from "@/lib/cryptoUniverse";
import { chartTimeframes, type Candle, type ChartTimeframe, type TradingMode } from "@/lib/marketAnalysis";
import { radarAlertRules, type RadarAlertRuleId } from "@/lib/radarAlerts";
import { findSetupAlertMatches, type SetupAlertMarket, type SetupAlertPreset } from "@/lib/setupAlertPresets";
import { scanAllSetups, type ScoutSetup } from "@/lib/setupScout";
import { sendFcmMessage } from "@/lib/server/firebaseMessaging";
import { supabaseAdminRest } from "@/lib/server/supabaseAdmin";
import { fetchStockCandles } from "@/lib/stockMarket";
import { analyzeTechnicalRadar } from "@/lib/technicalRadar";

interface PushTokenRow {
  id: string;
  user_id: string;
  token: string;
  markets: string[] | null;
  rule_ids: string[] | null;
}

interface PushProfileRow {
  id: string;
  plan?: BillingEntitlementPlan;
  membership_tier?: BillingEntitlementPlan;
}

interface PushSubscriptionRow {
  user_id: string;
  plan?: BillingEntitlementPlan;
  tier?: BillingEntitlementPlan;
}

interface PushAlertPresetRow {
  user_id: string;
  market: SetupAlertMarket;
  preset_id: string;
  symbol: string;
  mode: TradingMode | null;
  timeframe: string;
  side: "long" | "short";
  quality: "A" | "B" | "C";
  score: number;
  headline: string;
  saved_at: string;
}

interface PushAlertEvent {
  market: SetupAlertMarket;
  ruleId: RadarAlertRuleId;
  eventKey: string;
  title: string;
  body: string;
  data: Record<string, string>;
  score?: number;
  quality?: ScoutSetup["plan"]["quality"];
  symbol?: string;
  system?: boolean;
}

interface ScanContext {
  origin: string;
  dryRun?: boolean;
  diagnosticsLimit?: number;
}

interface OptionalEventSourceResult {
  label: string;
  event: PushAlertEvent | null;
  warning: string | null;
}

interface PushEventDiagnostic {
  signalType: string;
  ruleId: RadarAlertRuleId;
  market: SetupAlertMarket;
  symbol?: string;
  score?: number;
  quality?: ScoutSetup["plan"]["quality"];
  title: string;
  reason: string;
  eventKey: string;
  wouldSend: boolean;
  skippedReason: "low_score" | "entitlement" | "token_preferences" | "duplicate" | "dry_run" | null;
  targetTokenCount: number;
  system: boolean;
}

interface PushScanDiagnostics {
  tokenCount: number;
  userCount: number;
  profileCount: number;
  subscriptionCount: number;
  presetCount: number;
  cryptoPresetCount: number;
  stockPresetCount: number;
  cryptoSetupCount: number;
  stockPresetSetupCount: number;
  stockMomentumSetupCount: number;
  optionalEventCount: number;
  genericEventCount: number;
  eligibleEventCount: number;
  entitlementBlockedEventCount: number;
  preferenceSkippedTokenCount: number;
  duplicateSkippedTokenCount: number;
  sendTargetTokenCount: number;
  skippedLowScoreCount: number;
}

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
    eligibleEventCount: 0,
    entitlementBlockedEventCount: 0,
    preferenceSkippedTokenCount: 0,
    duplicateSkippedTokenCount: 0,
    sendTargetTokenCount: 0,
    skippedLowScoreCount: 0,
    ...overrides
  };
}

const cryptoModes: TradingMode[] = ["scalp", "swing"];
const cryptoMajorSymbols = new Set(["BTCUSDT.P", "ETHUSDT.P", "BTCUSDT", "ETHUSDT", "BTC", "ETH"]);
const minimumSetupPushScore = 75;
const cryptoMajorPushScoreThreshold = 80;
const cryptoAltPushScoreThreshold = 82;
const genericSetupPushScoreThreshold = 80;
const stockMomentumSymbols = ["QQQ", "SPY", "NQ=F", "ES=F", "^VIX", "VIXY", "SMH", "SOXX", "NVDA", "AMD", "UUP", "GLD", "TLT"];
const stockIndexSymbols = new Set(["QQQ", "SPY", "NQ=F", "ES=F"]);
const volatilitySymbols = new Set(["^VIX", "VIXY"]);
const semiconductorSymbols = new Set(["SMH", "SOXX", "NVDA", "AMD"]);
const riskOffAssetSymbols = new Set(["UUP", "GLD", "TLT"]);

function eventBucket(minutes: number) {
  return Math.floor(Date.now() / (minutes * 60 * 1000));
}

function compactSymbol(symbol: string) {
  return symbol.replace("USDT.P", "").replace("USDT", "");
}

function isCryptoMajor(symbol: string) {
  return cryptoMajorSymbols.has(symbol) || cryptoMajorSymbols.has(compactSymbol(symbol));
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

function profilePlan(row: PushProfileRow | undefined): BillingEntitlementPlan {
  return row?.plan ?? row?.membership_tier ?? null;
}

function subscriptionPlan(row: PushSubscriptionRow): BillingEntitlementPlan {
  return row.plan ?? row.tier ?? null;
}

function userPlan(
  profiles: Map<string, PushProfileRow>,
  subscriptions: Map<string, PushSubscriptionRow[]>,
  userId: string
): BillingEntitlementPlan {
  const plans = [...(subscriptions.get(userId) ?? []).map(subscriptionPlan), profilePlan(profiles.get(userId))];
  return resolveCombinedBillingEntitlementPlan(plans, "all") ?? "free";
}

function ruleAllowed(event: PushAlertEvent, plan: BillingEntitlementPlan) {
  if (event.system) return true;
  const ruleId = event.ruleId;
  const rule = radarAlertRules.find((item) => item.id === ruleId);
  if (!rule) return false;
  if (rule.tier === "free") return true;
  if (rule.category === "stocks") return hasMarketEntitlement(plan, "stocks");
  if (rule.category === "crypto") return hasMarketEntitlement(plan, "crypto");
  return hasMarketEntitlement(plan, "crypto") || hasMarketEntitlement(plan, "stocks");
}

function tokenWants(token: PushTokenRow, market: SetupAlertMarket, ruleId: RadarAlertRuleId) {
  const markets = token.markets ?? [];
  const ruleIds = token.rule_ids ?? [];
  const marketOk = markets.length === 0 || markets.includes(market);
  const ruleOk = ruleIds.length === 0 || ruleIds.includes(ruleId);
  return marketOk && ruleOk;
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

function setupToEvent(setup: ScoutSetup, ruleId: RadarAlertRuleId, market: SetupAlertMarket, prefix: string): PushAlertEvent {
  const side = setup.plan.side;
  const isGlobalMomentum = market === "stocks" && ruleId === "stock-momentum";
  return {
    market,
    ruleId,
    eventKey: `${prefix}:${market}:${setup.symbol}:${setup.timeframe}:${side}:${eventBucket(15)}`,
    title: isGlobalMomentum
      ? stockSignalTitle(setup.symbol, side)
      : market === "stocks"
        ? "Chart Radar 글로벌 감지"
        : isCryptoMajor(setup.symbol)
          ? "Chart Radar 강한 레이더 후보 감지"
          : "Chart Radar 알트 구조 변화 감지",
    body: isGlobalMomentum
      ? stockSignalBody(setup)
      : market === "stocks"
        ? `${stockSignalLabel(setup.symbol)} ${setup.timeframe} 구조 변화가 감지됐습니다. 앱에서 상세 흐름을 확인해 주세요.`
        : `${compactSymbol(setup.symbol)} ${setup.timeframe} 강한 구조 변화가 감지됐습니다. 앱에서 상세 흐름을 확인해 주세요.`,
    data: {
      type: ruleId,
      market,
      target: market === "stocks" ? "/alerts?market=global" : "/alerts?market=crypto",
      symbol: setup.symbol,
      timeframe: setup.timeframe,
      side,
      signal: isGlobalMomentum ? stockSignalTitle(setup.symbol, side).replace("Chart Radar ", "") : ruleId
    },
    score: setup.score,
    quality: setup.plan.quality,
    symbol: setup.symbol,
    system: true
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
    eventKey: `${prefix}:${market}:${setup.symbol}:${setup.timeframe}:${setup.side}:${eventBucket(15)}`,
    title: market === "stocks" ? "Chart Radar 글로벌 감시 조건" : "Chart Radar 관심 조건 감지",
    body:
      market === "stocks"
        ? `${stockSignalLabel(setup.symbol)} ${setup.timeframe} ${sideLabel(setup.side, market)} ${Math.round(setup.score)}점으로 저장한 글로벌 조건과 다시 맞았습니다.`
        : `${compactSymbol(setup.symbol)} ${setup.timeframe} 저장한 조건과 다시 맞았습니다. 앱에서 상세 흐름을 확인해 주세요.`,
    data: {
      type: ruleId,
      market,
      target: market === "stocks" ? "/alerts?market=global" : "/alerts?market=crypto",
      symbol: setup.symbol,
      timeframe: setup.timeframe,
      side: setup.side
    },
    score: setup.score,
    quality: setup.quality,
    symbol: setup.symbol
  };
}

function setupSignalPassesPushQuality(score: number, quality: ScoutSetup["plan"]["quality"] | undefined, market: SetupAlertMarket, symbol?: string) {
  if (score < minimumSetupPushScore) return false;
  if (quality === "A") return true;
  if (market === "crypto") {
    return score >= (symbol && !isCryptoMajor(symbol) ? cryptoAltPushScoreThreshold : cryptoMajorPushScoreThreshold);
  }
  return score >= genericSetupPushScoreThreshold;
}

function isSetupPushEvent(event: PushAlertEvent) {
  return event.score !== undefined && (event.ruleId === "radar-grade" || event.ruleId === "watchlist-surge" || event.ruleId === "stock-momentum");
}

function passesSetupPushQuality(event: PushAlertEvent) {
  if (!isSetupPushEvent(event)) return true;
  return setupSignalPassesPushQuality(event.score ?? 0, event.quality, event.market, event.symbol);
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

function topPushSetups(setups: ScoutSetup[], limit: number) {
  const picked: ScoutSetup[] = [];
  const usedSymbols = new Set<string>();
  const ranked = [...setups].sort((a, b) => {
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

async function scanLiquidationEvent(origin: string): Promise<PushAlertEvent | null> {
  const response = await fetch(`${origin}/api/liquidation-pressure?symbol=BTCUSDT&period=15m`, { cache: "no-store" });
  if (!response.ok) throw new Error(`liquidation-pressure ${response.status}`);
  const payload = (await response.json()) as {
    report?: {
      grade?: string;
      symbol?: string;
      dominantSide?: string;
      upsideShortPressure?: number;
      downsideLongPressure?: number;
      summary?: string;
    };
    grade?: string;
    symbol?: string;
    dominantSide?: string;
    upsideShortPressure?: number;
    downsideLongPressure?: number;
    summary?: string;
  };
  const report = payload.report ?? payload;
  if (report.grade !== "heated" && report.grade !== "extreme") return null;

  const pressure = Math.max(report.upsideShortPressure ?? 0, report.downsideLongPressure ?? 0);
  return {
    market: "crypto",
    ruleId: "liquidation-pressure",
    eventKey: `liquidation-pressure:crypto:${report.symbol ?? "BTCUSDT"}:${report.grade}:${eventBucket(30)}`,
    title: "Chart Radar 청산 압력 급등 감지",
    body: `BTC 청산 압력이 ${report.grade === "extreme" ? "매우 높음" : "높음"} 구간입니다. 리스크를 확인해 주세요.`,
    data: {
      type: "liquidation-pressure",
      market: "crypto",
      target: "/crypto",
      pressure: String(pressure)
    },
    system: true
  };
}

async function scanNewsEvent(origin: string, market: SetupAlertMarket): Promise<PushAlertEvent | null> {
  const response = await fetch(`${origin}/api/radar-news?market=${market}`, { cache: "no-store" });
  if (!response.ok) return null;
  const payload = (await response.json()) as { briefing?: { headline?: string; keyIssues?: Array<{ title?: string }> } };
  const headline = payload.briefing?.headline;
  const firstIssue = payload.briefing?.keyIssues?.[0]?.title;
  if (!headline && !firstIssue) return null;

  return {
    market,
    ruleId: "macro-news",
    eventKey: `macro-news:${market}:${firstIssue ?? headline}:${eventBucket(180)}`,
    title: market === "stocks" ? "Chart Radar 시장 이벤트 리마인더" : "Chart Radar 코인 뉴스",
    body: firstIssue ?? headline ?? "주요 뉴스 브리핑이 갱신되었습니다.",
    data: {
      type: "macro-news",
      market,
      target: market === "stocks" ? "/news?market=global" : "/news?market=crypto"
    },
    system: true
  };
}

async function scanMacroCalendarEvent(origin: string): Promise<PushAlertEvent | null> {
  const response = await fetch(`${origin}/api/macro-calendar`, { cache: "no-store" });
  if (!response.ok) return null;
  const payload = (await response.json()) as {
    items?: Array<{
      label?: string;
      releaseAt?: string;
      dateKst?: string;
      importance?: number;
      state?: string;
    }>;
  };
  const now = Date.now();
  const upcoming = (payload.items ?? [])
    .filter((item) => {
      const releaseTime = Date.parse(item.releaseAt ?? "");
      return item.importance === 3 && releaseTime > now && releaseTime - now <= 24 * 60 * 60 * 1000;
    })
    .sort((a, b) => Date.parse(a.releaseAt ?? "") - Date.parse(b.releaseAt ?? ""));
  const nextEvent = upcoming[0];
  if (!nextEvent?.label || !nextEvent.releaseAt) return null;

  return {
    market: "stocks",
    ruleId: "macro-news",
    eventKey: `macro-event-reminder:stocks:${nextEvent.label}:${nextEvent.releaseAt}:${eventBucket(360)}`,
    title: "Chart Radar 시장 이벤트 리마인더",
    body: `${nextEvent.dateKst ?? "곧"} ${nextEvent.label} 예정입니다. 발표 전후 변동성 확대 가능성을 확인하세요.`,
    data: {
      type: "macro-news",
      market: "stocks",
      signal: "시장 이벤트 리마인더",
      target: "/news?market=global",
      eventLabel: nextEvent.label,
      releaseAt: nextEvent.releaseAt
    },
    system: true
  };
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
    eventKey: `risk-off:stocks:${weakIndex.symbol}:${companion.symbol}:${eventBucket(30)}`,
    title: "Chart Radar 리스크오프 조합",
    body: `${stockSignalLabel(weakIndex.symbol)} 약세와 ${stockSignalLabel(companion.symbol)} 강세가 함께 감지됐습니다. 변동성·달러·금 흐름을 확인하세요.`,
    data: {
      type: "stock-momentum",
      market: "stocks",
      signal: "리스크오프 조합",
      target: "/alerts?market=global",
      symbol: weakIndex.symbol,
      companion: companion.symbol,
      timeframe: weakIndex.timeframe,
      side: "short"
    },
    score,
    quality: stockQuality(score),
    symbol: weakIndex.symbol,
    system: true
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
    eventKey: `semiconductor-leadership:stocks:${semiconductor.symbol}:${index.symbol}:${strengthened ? "strong" : "weak"}:${eventBucket(30)}`,
    title: `Chart Radar 반도체 주도력 ${strengthened ? "강화" : "약화"}`,
    body: `${stockSignalLabel(semiconductor.symbol)} 흐름이 ${stockSignalLabel(index.symbol)}보다 ${strengthened ? "강하게" : "약하게"} 감지됐습니다. 지수와 섹터 흐름 차이를 확인하세요.`,
    data: {
      type: "stock-momentum",
      market: "stocks",
      signal: strengthened ? "반도체 주도력 강화" : "반도체 주도력 약화",
      target: "/alerts?market=global",
      symbol: semiconductor.symbol,
      companion: index.symbol,
      timeframe: semiconductor.timeframe,
      side: semiconductor.plan.side
    },
    score,
    quality: stockQuality(score),
    symbol: semiconductor.symbol,
    system: true
  };
}

async function scanOptionalEventSource(label: string, scan: () => Promise<PushAlertEvent | null>): Promise<OptionalEventSourceResult> {
  try {
    return {
      label,
      event: await scan(),
      warning: null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[push-cron] optional event source failed: ${label}`, error);
    return {
      label,
      event: null,
      warning: `${label}: ${message.slice(0, 180)}`
    };
  }
}

async function alreadySent(userId: string, eventKey: string) {
  const rows = await supabaseAdminRest<Array<{ id: string }>>(
    `push_alert_events?select=id&user_id=eq.${encodeURIComponent(userId)}&event_key=eq.${encodeURIComponent(eventKey)}&limit=1`
  );
  return rows.length > 0;
}

async function recordSentEvent(userId: string, event: PushAlertEvent, sentCount: number) {
  await supabaseAdminRest("push_alert_events", {
    method: "POST",
    body: {
      user_id: userId,
      market: event.market,
      rule_id: event.ruleId,
      event_key: event.eventKey,
      title: event.title,
      body: event.body,
      payload: {
        ...event.data,
        sentCount
      }
    }
  });
}

async function sendEventToUser(userId: string, tokens: PushTokenRow[], event: PushAlertEvent) {
  const targetTokens = tokens.filter((token) => tokenWants(token, event.market, event.ruleId));
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
    score: event.score,
    quality: event.quality,
    title: event.title,
    reason: event.body,
    eventKey: event.eventKey,
    wouldSend: skippedReason === null || skippedReason === "dry_run",
    skippedReason,
    targetTokenCount,
    system: event.system === true
  };
}

export async function runPushAlertScan(context: ScanContext) {
  const dryRun = context.dryRun === true;
  const diagnosticsLimit = Math.max(0, Math.min(context.diagnosticsLimit ?? 40, 100));
  const eventDiagnostics: PushEventDiagnostic[] = [];
  const pushDiagnostic = (diagnostic: PushEventDiagnostic) => {
    if (eventDiagnostics.length < diagnosticsLimit) eventDiagnostics.push(diagnostic);
  };

  const tokens = await supabaseAdminRest<PushTokenRow[]>(
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
      warnings: [],
      diagnostics: emptyDiagnostics(),
      eventDiagnostics
    };
  }

  const userIds = Array.from(new Set(tokens.map((token) => token.user_id)));
  const profiles = await supabaseAdminRest<PushProfileRow[]>(`profiles?select=*&id=in.(${userIds.join(",")})`);
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const now = encodeURIComponent(new Date().toISOString());
  const subscriptionRows = await supabaseAdminRest<PushSubscriptionRow[]>(
    `subscriptions?select=*&user_id=in.(${userIds.join(",")})&status=in.(active,trialing)&current_period_end=gt.${now}&order=current_period_end.desc&limit=1000`
  );
  const subscriptionsByUser = new Map<string, PushSubscriptionRow[]>();
  for (const subscription of subscriptionRows) {
    const rows = subscriptionsByUser.get(subscription.user_id) ?? [];
    rows.push(subscription);
    subscriptionsByUser.set(subscription.user_id, rows);
  }
  const presetRows = await supabaseAdminRest<PushAlertPresetRow[]>(
    `push_alert_presets?select=user_id,market,preset_id,symbol,mode,timeframe,side,quality,score,headline,saved_at&enabled=eq.true&user_id=in.(${userIds.join(",")})&limit=1000`
  );

  const cryptoSetups = await scanCryptoSetups();
  const stockPresetSetups = await scanStockSetups(
    presetRows.filter((preset) => preset.market === "stocks").map((preset) => ({ symbol: preset.symbol, timeframe: preset.timeframe }))
  );
  const stockMomentumSetups = await scanStockSetups(stockMomentumSymbols.map((symbol) => ({ symbol, timeframe: "1d" })));
  const optionalEventSources = await Promise.all([
    scanOptionalEventSource("liquidation-pressure", () => scanLiquidationEvent(context.origin)),
    scanOptionalEventSource("radar-news-crypto", () => scanNewsEvent(context.origin, "crypto")),
    scanOptionalEventSource("radar-news-stocks", () => scanNewsEvent(context.origin, "stocks")),
    scanOptionalEventSource("macro-calendar-stocks", () => scanMacroCalendarEvent(context.origin))
  ]);
  const warnings = optionalEventSources
    .map((source) => source.warning)
    .filter((warning): warning is string => Boolean(warning));
  const globalCompositeEvents = [buildRiskOffEvent(stockMomentumSetups), buildSemiconductorLeadershipEvent(stockMomentumSetups)];
  const genericEvents = [
    ...topPushSetups(cryptoSetups, 8).map((setup) => setupToEvent(setup, "radar-grade", "crypto", "radar-grade")),
    ...topPushSetups(stockMomentumSetups, 6).map((setup) => setupToEvent(setup, "stock-momentum", "stocks", "stock-momentum")),
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

  for (const userId of userIds) {
    const userTokens = tokens.filter((token) => token.user_id === userId);
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

    const allUserEvents = [...genericEvents, ...cryptoPresetMatches, ...stockPresetMatches];
    const qualityCheckedEvents = allUserEvents.filter((event) => {
      const allowed = passesSetupPushQuality(event);
      if (!allowed) skippedLowScoreCount += 1;
      if (!allowed) pushDiagnostic(eventDiagnostic(event, "low_score"));
      return allowed;
    });
    const userEvents = qualityCheckedEvents.filter((event) => {
      const allowed = ruleAllowed(event, plan);
      if (!allowed) pushDiagnostic(eventDiagnostic(event, "entitlement"));
      return allowed;
    });
    entitlementBlockedEventCount += qualityCheckedEvents.length - userEvents.length;
    events += userEvents.length;

    for (const event of userEvents) {
      if (dryRun) {
        const targetTokens = userTokens.filter((token) => tokenWants(token, event.market, event.ruleId));
        preferenceSkippedTokenCount += Math.max(0, userTokens.length - targetTokens.length);
        if (targetTokens.length === 0) {
          pushDiagnostic(eventDiagnostic(event, "token_preferences"));
          continue;
        }
        if (await alreadySent(userId, event.eventKey)) {
          skipped += targetTokens.length;
          duplicateSkippedTokenCount += targetTokens.length;
          sendTargetTokenCount += targetTokens.length;
          pushDiagnostic(eventDiagnostic(event, "duplicate", targetTokens.length));
          continue;
        }
        sendTargetTokenCount += targetTokens.length;
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
      eligibleEventCount: events,
      entitlementBlockedEventCount,
      preferenceSkippedTokenCount,
      duplicateSkippedTokenCount,
      sendTargetTokenCount,
      skippedLowScoreCount
    }),
    eventDiagnostics
  };
}
