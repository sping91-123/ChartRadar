import type { RadarAlertRuleId } from "@/lib/radarAlerts";
import type { SetupAlertMarket } from "@/lib/setupAlertPresets";
import type { ScoutSetup } from "@/lib/setupScout";
import { eventBucket } from "@/lib/server/push/duplicateGuard";
import { asArray, compactPushSymbol as compactSymbol, isCryptoMajorPushSymbol as isCryptoMajor } from "@/lib/server/push/eligibility";
import { setupTargetPath, stockIndexSymbols, stockSetupAlertKind } from "@/lib/server/push/targets";
import type { PushAlertEvent } from "@/lib/server/push/types";

const volatilitySymbols = new Set(["^VIX", "VIXY"]);
const semiconductorSymbols = new Set(["SMH", "SOXX", "NVDA", "AMD"]);
const riskOffAssetSymbols = new Set(["UUP", "GLD", "TLT"]);
const maxCryptoAltMarketScoutEventsPerScan = 1;
const maxCryptoMajorMarketScoutEventsPerScan = 2;
const maxGlobalMomentumEventsPerScan = 1;
const maxGlobalAssetEventsPerScan = 1;

export function sideLabel(side: "long" | "short", market: SetupAlertMarket) {
  if (market === "stocks") return side === "long" ? "상승 우세" : "하락 우세";
  return side === "long" ? "상방 우세" : "하방 우세";
}

export function stockSignalLabel(symbol: string) {
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
    return side === "long" ? "변동성 리스크 확대" : "변동성 완화";
  }
  if (semiconductorSymbols.has(symbol)) return "반도체 주도력 변화";
  if (riskOffAssetSymbols.has(symbol)) return "방어 자산 변화";
  return "글로벌 레이더 후보";
}

export function stockQuality(score: number): ScoutSetup["plan"]["quality"] {
  if (score >= 78) return "A";
  if (score >= 62) return "B";
  return "C";
}

function stockDirectionScore(setup: ScoutSetup) {
  return setup.plan.side === "long" ? setup.score : -setup.score;
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

function setupMarketScoutTitle(setup: ScoutSetup, market: SetupAlertMarket) {
  if (market === "stocks") return "글로벌 레이더 후보";
  return isCryptoMajor(setup.symbol) ? `${compactSymbol(setup.symbol)} 레이더 후보` : "알트 레이더 후보";
}

function setupMarketScoutBody(setup: ScoutSetup, market: SetupAlertMarket) {
  const symbol = compactSymbol(setup.symbol);
  if (market === "stocks") {
    return `${stockSignalLabel(setup.symbol)}가 글로벌 후보에 잡혔습니다. 앱에서 점수와 근거를 확인해 주세요.`;
  }
  if (isCryptoMajor(setup.symbol)) {
    return `${symbol}가 레이더 후보에 잡혔습니다. 점수와 조건을 확인해 주세요.`;
  }
  return `${symbol}가 시장 스캔 후보에 잡혔습니다. 앱에서 근거를 확인해 주세요.`;
}

export function setupToEvent(
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
    title: setupMarketScoutTitle(setup, market),
    body: setupMarketScoutBody(setup, market),
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

export function matchedSetupToEvent(
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

export function topPushSetups(setups: ScoutSetup[] | null | undefined, limit: number) {
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

export function buildRiskOffEvent(setups: ScoutSetup[]): PushAlertEvent | null {
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

export function buildSemiconductorLeadershipEvent(setups: ScoutSetup[]): PushAlertEvent | null {
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

export function limitCryptoMarketScoutEvents(events: PushAlertEvent[]) {
  const limited: PushAlertEvent[] = [];
  let altCount = 0;
  let majorCount = 0;
  let skipped = 0;

  for (const event of events) {
    if (!isCryptoAltMarketScoutEvent(event)) {
      if (event.symbol && isCryptoMajor(event.symbol) && majorCount >= maxCryptoMajorMarketScoutEventsPerScan) {
        skipped += 1;
        continue;
      }
      if (event.symbol && isCryptoMajor(event.symbol)) majorCount += 1;
      limited.push(event);
      continue;
    }

    if (altCount >= maxCryptoAltMarketScoutEventsPerScan) {
      skipped += 1;
      continue;
    }
    altCount += 1;
    limited.push(event);
  }

  return { events: limited, skipped };
}

function isCryptoAltMarketScoutEvent(event: Pick<PushAlertEvent, "market" | "alertKind" | "symbol">) {
  return event.market === "crypto" && event.alertKind === "market_scout" && Boolean(event.symbol) && !isCryptoMajor(event.symbol ?? "");
}

function compactSymbolList(symbols: string[]) {
  const uniqueSymbols = Array.from(new Set(symbols));
  const visibleSymbols = uniqueSymbols.slice(0, 3).join("·");
  return uniqueSymbols.length > 3 ? `${visibleSymbols} 등` : visibleSymbols;
}

function bestQuality(events: PushAlertEvent[]) {
  if (events.some((event) => event.quality === "A")) return "A";
  if (events.some((event) => event.quality === "B")) return "B";
  if (events.some((event) => event.quality === "C")) return "C";
  return undefined;
}

function mergeEvidenceLabels(events: PushAlertEvent[]) {
  return Array.from(new Set(events.flatMap((event) => event.evidenceLabels ?? [])));
}

function bestMarketScoutRank(events: PushAlertEvent[]) {
  const ranks = events.map((event) => event.marketScoutRank).filter((rank): rank is number => typeof rank === "number" && Number.isFinite(rank));
  return ranks.length > 0 ? Math.min(...ranks) : undefined;
}

function buildGlobalMomentumBatch(events: PushAlertEvent[]): PushAlertEvent | null {
  if (events.length === 0) return null;
  const [first] = events;
  const symbols = events.map((event) => event.symbol).filter((symbol): symbol is string => Boolean(symbol));
  const side = first.data.side === "short" ? "short" : "long";
  const symbolLabel = compactSymbolList(symbols);
  const score = Math.max(...events.map((event) => event.score ?? 0));
  return {
    ...first,
    alertKind: "global_momentum",
    eventKey: `stock-momentum:stocks:global_momentum:${side}:${eventBucket(15)}`,
    title: "글로벌 레이더 후보",
    body: `${symbolLabel} 주요 자산이 ${side === "short" ? "약한" : "강한"} 흐름으로 감지됐습니다. 앱에서 확인해 주세요.`,
    data: {
      ...first.data,
      symbol: symbols[0] ?? first.symbol ?? "",
      symbols: symbols.join(","),
      targetPath: "/global",
      signal: "global_momentum_batch"
    },
    score,
    quality: bestQuality(events),
    symbol: symbols[0] ?? first.symbol,
    evidenceLabels: mergeEvidenceLabels(events),
    marketScoutRank: bestMarketScoutRank(events)
  };
}

function buildGlobalAssetBatch(events: PushAlertEvent[]): PushAlertEvent | null {
  if (events.length === 0) return null;
  const [first] = events;
  const symbols = events.map((event) => event.symbol).filter((symbol): symbol is string => Boolean(symbol));
  const volatilityEvents = events.filter((event) => event.symbol && volatilitySymbols.has(event.symbol));
  const selectedEvents = volatilityEvents.length > 0 ? volatilityEvents : events;
  const selectedSymbols = selectedEvents.map((event) => event.symbol).filter((symbol): symbol is string => Boolean(symbol));
  const symbolLabel = compactSymbolList(selectedSymbols.length > 0 ? selectedSymbols : symbols);
  const score = Math.max(...selectedEvents.map((event) => event.score ?? 0));
  const isVolatilityBatch = volatilityEvents.length > 0;
  return {
    ...selectedEvents[0],
    alertKind: "global_asset",
    eventKey: `stock-momentum:stocks:global_asset:${selectedSymbols.join("-") || "assets"}:${eventBucket(15)}`,
    title: isVolatilityBatch ? "글로벌 리스크 후보" : "글로벌 자산 후보",
    body: isVolatilityBatch
      ? `${symbolLabel} 관련 자산이 강한 움직임으로 감지됐습니다. 변동성 리스크를 확인해 주세요.`
      : `${symbolLabel} 글로벌 자산 흐름이 감지됐습니다. 앱에서 확인해 주세요.`,
    data: {
      ...selectedEvents[0].data,
      symbol: selectedSymbols[0] ?? selectedEvents[0].symbol ?? "",
      symbols: selectedSymbols.join(","),
      targetPath: "/global/assets",
      signal: isVolatilityBatch ? "global_risk_batch" : "global_asset_batch"
    },
    score,
    quality: bestQuality(selectedEvents),
    symbol: selectedSymbols[0] ?? selectedEvents[0].symbol,
    evidenceLabels: mergeEvidenceLabels(selectedEvents),
    marketScoutRank: bestMarketScoutRank(selectedEvents)
  };
}

export function limitGlobalMarketScoutEvents(events: PushAlertEvent[]) {
  const momentumEvents = events.filter((event) => event.alertKind === "global_momentum");
  const assetEvents = events.filter((event) => event.alertKind === "global_asset");
  const otherEvents = events.filter((event) => event.alertKind !== "global_momentum" && event.alertKind !== "global_asset");
  const batchedMomentum = buildGlobalMomentumBatch(momentumEvents);
  const batchedAsset = buildGlobalAssetBatch(assetEvents);
  const limited = [batchedMomentum, batchedAsset, ...otherEvents].filter((event): event is PushAlertEvent => event !== null);
  const globalMomentumLimitSkippedCount = Math.max(0, momentumEvents.length - maxGlobalMomentumEventsPerScan);
  const globalAssetLimitSkippedCount = Math.max(0, assetEvents.length - maxGlobalAssetEventsPerScan);
  return {
    events: limited,
    globalBatchSkippedCount: globalMomentumLimitSkippedCount + globalAssetLimitSkippedCount,
    globalMomentumLimitSkippedCount,
    globalAssetLimitSkippedCount
  };
}
