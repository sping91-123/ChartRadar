// 서버 크론에서 알림 조건을 스캔하고 Android FCM 푸시를 발송한다.
import { hasMarketEntitlement, type BillingEntitlementPlan } from "@/lib/billing";
import { getLiquidCryptoSymbols } from "@/lib/cryptoUniverse";
import { chartTimeframes, type Candle, type ChartTimeframe, type TradingMode } from "@/lib/marketAnalysis";
import { radarAlertRules, type RadarAlertRuleId } from "@/lib/radarAlerts";
import { findSetupAlertMatches, type SetupAlertMarket, type SetupAlertPreset } from "@/lib/setupAlertPresets";
import { scanAllSetups, topSetups, type ScoutSetup } from "@/lib/setupScout";
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
  plan: BillingEntitlementPlan;
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
}

interface ScanContext {
  origin: string;
}

interface OptionalEventSourceResult {
  label: string;
  event: PushAlertEvent | null;
  warning: string | null;
}

const cryptoModes: TradingMode[] = ["scalp", "swing"];
const stockMomentumSymbols = ["QQQ", "SPY", "SMH", "NVDA", "TSLA", "AAPL", "MSFT"];

function eventBucket(minutes: number) {
  return Math.floor(Date.now() / (minutes * 60 * 1000));
}

function compactSymbol(symbol: string) {
  return symbol.replace("USDT.P", "").replace("USDT", "");
}

function sideLabel(side: "long" | "short", market: SetupAlertMarket) {
  if (market === "stocks") return side === "long" ? "상승 우세" : "하락 우세";
  return side === "long" ? "롱 우세" : "숏 우세";
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

function profilePlan(profiles: Map<string, PushProfileRow>, userId: string): BillingEntitlementPlan {
  return profiles.get(userId)?.plan ?? "free";
}

function ruleAllowed(ruleId: RadarAlertRuleId, plan: BillingEntitlementPlan) {
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
  return {
    market,
    ruleId,
    eventKey: `${prefix}:${market}:${setup.symbol}:${setup.timeframe}:${side}:${eventBucket(15)}`,
    title: market === "stocks" ? "Chart Radar 글로벌 감지" : "Chart Radar 레이더 감지",
    body: `${compactSymbol(setup.symbol)} ${setup.timeframe} ${sideLabel(side, market)} ${Math.round(setup.score)}점이 다시 감지됐습니다.`,
    data: {
      type: ruleId,
      market,
      target: market === "stocks" ? "/alerts?market=global" : "/alerts?market=crypto",
      symbol: setup.symbol,
      timeframe: setup.timeframe,
      side
    }
  };
}

function matchedSetupToEvent(
  setup: { symbol: string; timeframe: string; side: "long" | "short"; score: number },
  ruleId: RadarAlertRuleId,
  market: SetupAlertMarket,
  prefix: string
): PushAlertEvent {
  return {
    market,
    ruleId,
    eventKey: `${prefix}:${market}:${setup.symbol}:${setup.timeframe}:${setup.side}:${eventBucket(15)}`,
    title: market === "stocks" ? "Chart Radar 글로벌 감시 조건" : "Chart Radar 관심 조건 감지",
    body: `${compactSymbol(setup.symbol)} ${setup.timeframe} ${sideLabel(setup.side, market)} ${Math.round(setup.score)}점 조건이 다시 맞았습니다.`,
    data: {
      type: ruleId,
      market,
      target: market === "stocks" ? "/alerts?market=global" : "/alerts?market=crypto",
      symbol: setup.symbol,
      timeframe: setup.timeframe,
      side: setup.side
    }
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
  const symbols = await getLiquidCryptoSymbols({ includeMajor: true, limit: 32 });
  const settled = await Promise.allSettled(
    cryptoModes.map(async (mode) => {
      const all = await scanAllSetups({ mode, riskProfile: "radar", symbols });
      return topSetups(all, 12);
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
  if (!response.ok) return null;
  const report = (await response.json()) as {
    grade?: string;
    symbol?: string;
    dominantSide?: string;
    upsideShortPressure?: number;
    downsideLongPressure?: number;
    summary?: string;
  };
  if (report.grade !== "heated" && report.grade !== "extreme") return null;

  const pressure = Math.max(report.upsideShortPressure ?? 0, report.downsideLongPressure ?? 0);
  return {
    market: "crypto",
    ruleId: "liquidation-pressure",
    eventKey: `liquidation-pressure:crypto:${report.symbol ?? "BTCUSDT"}:${report.grade}:${eventBucket(30)}`,
    title: "Chart Radar 청산 압력",
    body: `BTC 청산 압력이 ${report.grade === "extreme" ? "매우 높음" : "높음"} 구간입니다. 변동성 확대를 확인하세요.`,
    data: {
      type: "liquidation-pressure",
      market: "crypto",
      target: "/crypto",
      pressure: String(pressure)
    }
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
    title: market === "stocks" ? "Chart Radar 글로벌 뉴스" : "Chart Radar 코인 뉴스",
    body: firstIssue ?? headline ?? "주요 뉴스 브리핑이 갱신되었습니다.",
    data: {
      type: "macro-news",
      market,
      target: market === "stocks" ? "/news?market=global" : "/news?market=crypto"
    }
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
  if (targetTokens.length === 0) return { sent: 0, skipped: 0, failed: 0 };
  if (await alreadySent(userId, event.eventKey)) return { sent: 0, skipped: targetTokens.length, failed: 0 };

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
  return { sent, skipped: 0, failed };
}

export async function runPushAlertScan(context: ScanContext) {
  const tokens = await supabaseAdminRest<PushTokenRow[]>(
    "push_tokens?select=id,user_id,token,markets,rule_ids&enabled=eq.true&platform=eq.android&provider=eq.fcm&limit=500"
  );
  if (tokens.length === 0) return { users: 0, events: 0, sent: 0, skipped: 0, failed: 0 };

  const userIds = Array.from(new Set(tokens.map((token) => token.user_id)));
  const profiles = await supabaseAdminRest<PushProfileRow[]>(`profiles?select=id,plan&id=in.(${userIds.join(",")})`);
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
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
    scanOptionalEventSource("radar-news-stocks", () => scanNewsEvent(context.origin, "stocks"))
  ]);
  const warnings = optionalEventSources
    .map((source) => source.warning)
    .filter((warning): warning is string => Boolean(warning));
  const genericEvents = [
    ...topSetups(cryptoSetups, 3)
      .filter((setup) => setup.score >= 80 || setup.plan.quality === "A")
      .map((setup) => setupToEvent(setup, "radar-grade", "crypto", "radar-grade")),
    ...topSetups(stockMomentumSetups, 2)
      .filter((setup) => setup.score >= 78)
      .map((setup) => setupToEvent(setup, "stock-momentum", "stocks", "stock-momentum")),
    ...optionalEventSources.map((source) => source.event)
  ].filter((event): event is PushAlertEvent => event !== null);

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  let events = 0;

  for (const userId of userIds) {
    const userTokens = tokens.filter((token) => token.user_id === userId);
    const plan = profilePlan(profileMap, userId);
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

    const userEvents = [...genericEvents, ...cryptoPresetMatches, ...stockPresetMatches].filter((event) => ruleAllowed(event.ruleId, plan));
    events += userEvents.length;

    for (const event of userEvents) {
      const result = await sendEventToUser(userId, userTokens, event);
      sent += result.sent;
      skipped += result.skipped;
      failed += result.failed;
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
    warnings
  };
}
