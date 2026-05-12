import {
  analyzeTimeframe,
  fetchBinanceCandles,
  summarizeMarket,
  tradingModeConfigs,
  type Candle,
  type ChartTimeframe,
  type MarketAnalysis,
  type TimeframeAnalysis,
  type TradingMode,
  type TradePlanCandidate
} from "./marketAnalysis";

/** Tier 1 — 메인 스캐너. 무료 포함 전체 이용자. */
export const scoutSymbols = ["BTCUSDT.P", "ETHUSDT.P", "SOLUSDT.P", "XRPUSDT.P", "DOGEUSDT.P"] as const;
export type ScoutSymbol = (typeof scoutSymbols)[number];

/** Tier 2 — 관심 코인 풀. 멤버십 이상에서 선택 가능. */
export const watchlistSymbolPool = [
  "ADAUSDT.P",
  "AVAXUSDT.P",
  "LINKUSDT.P",
  "MATICUSDT.P",
  "DOTUSDT.P",
  "NEARUSDT.P",
  "APTUSDT.P",
  "ARBUSDT.P",
  "OPUSDT.P",
  "SUIUSDT.P",
  "TONUSDT.P",
  "TRXUSDT.P"
] as const;
export type WatchlistSymbol = (typeof watchlistSymbolPool)[number];

// 레이더 후보 스캔은 내부적으로 빠른 TF와 느린 TF를 나누되 UI에서는 타임프레임 기준으로만 보여준다.
export const defaultScoutMode: TradingMode = "scalp";
export type ScoutRiskProfile = "guard" | "radar";
export type ScoutScope = "all" | "major" | "alts";
export const defaultScoutRiskProfile: ScoutRiskProfile = "radar";
export const defaultScoutScope: ScoutScope = "all";

export const scoutTimeframes: Record<TradingMode, ChartTimeframe[]> = {
  scalp: tradingModeConfigs.scalp.activeTimeframes,
  swing: tradingModeConfigs.swing.activeTimeframes
};
export const scoutHigherTimeframes: Record<TradingMode, ChartTimeframe[]> = {
  scalp: tradingModeConfigs.scalp.contextTimeframes,
  swing: tradingModeConfigs.swing.contextTimeframes
};

export interface ScoutSetup {
  symbol: string;
  mode: TradingMode;
  timeframe: ChartTimeframe;
  analysis: MarketAnalysis;
  plan: TradePlanCandidate;
  /** 0~100 정수. PRO 플랜 confidence 기반 + 정합성 + 근접도 가산 */
  score: number;
  status?: "entry" | "active" | "watch";
  watchKind?: "aligned" | "counter";
  watchReason?: string;
  /** 사용자에게 보여줄 짧은 헤드라인 (룰 기반, AI 코멘트는 추후 덧붙임) */
  headline: string;
  /** 진입 영역까지 현재가 거리(%). 음수면 가격이 영역 아래(롱은 진입 후, 숏은 더 멀어짐). */
  distancePercent: number;
  /** 현재가가 진입 영역 안에 있는지 */
  insideZone: boolean;
  /** "영역 내부" / "근접" / "대기" / "이탈" 중 하나 */
  proximity: "ready" | "near" | "wait" | "missed";
  /** 현재가 (진입가 비교용) */
  currentPrice: number;
  scannedAt: string;
}

/**
 * TF별 "이 정도까지 떨어진(올라간) 곳에서 잡으라는 셋업은 비현실적" 임계.
 * 이걸 넘으면 Scout에서 아예 제외.
 *
 * 예: 4h 롱 셋업인데 진입 영역이 현재가보다 8% 아래면, 그 가격까지 가려면
 *     4h 구조가 이미 망가질 가능성이 높음 → 추천하지 않음.
 */
const proximityHardLimit: Record<ChartTimeframe, number> = {
  "5m": 0.8,
  "15m": 1.5,
  "1h": 3.0,
  "4h": 6.0,
  "1d": 12.0
};

/** TF별 "근접" 판정 임계 (이 안이면 대기 가치 있음) */
const proximityNearLimit: Record<ChartTimeframe, number> = {
  "5m": 0.12,
  "15m": 0.15,
  "1h": 1.0,
  "4h": 2.0,
  "1d": 4.0
};

const minimumScoutScore: Record<TradingMode, number> = {
  scalp: tradingModeConfigs.scalp.minimumScoutScore,
  swing: tradingModeConfigs.swing.minimumScoutScore
};

const minimumWatchScore: Record<ScoutRiskProfile, Record<TradingMode, number>> = {
  guard: {
    scalp: 35,
    swing: 55
  },
  radar: {
    scalp: 28,
    swing: 45
  }
};

// 최근 데이터 검증상 숏 후보는 현재 룰에서 무효화 선행 비율이 높다.
// 숏 판독 자체는 차트 판독에 남기되, TOP 스캐너 후보에서는 재보정 전까지 숨긴다.
const shortScoutSetupsEnabled = true;

const criticalRiskFlags = [
  "상위 시간대 구조가 반대 방향",
  "최근 반대 방향 CISD 발생"
] as const;

const radarActiveScore: Record<TradingMode, number> = {
  scalp: 38,
  swing: 42
};

function useConfirmedCandles(candles: Candle[]) {
  return candles.length > 50 ? candles.slice(0, -1) : candles;
}

interface ScannerOptions {
  mode?: TradingMode;
  riskProfile?: ScoutRiskProfile;
  /** 스캔할 종목. 기본 Tier 1 전체 */
  symbols?: readonly string[];
  /** 활성 TF (TOP 3에 후보로 들어갈 TF). 기본 15m, 1h, 4h */
  timeframes?: ChartTimeframe[];
  /** 분석에 함께 사용할 상위 TF. 기본 4h, 1d */
  higherTimeframes?: ChartTimeframe[];
  /** 캔들 개수. 기본 320 */
  limit?: number;
}

/**
 * 한 (symbol, activeTF) 조합을 스캔.
 * 활성 TF + 상위 TF 정합성을 모두 본 다음 PRO 플랜 후보가 있으면 ScoutSetup으로 반환.
 */
async function scanCombo(
  symbol: string,
  activeTimeframe: ChartTimeframe,
  higherTimeframes: ChartTimeframe[],
  limit: number,
  mode: TradingMode,
  riskProfile: ScoutRiskProfile,
  allowWatch = false
): Promise<ScoutSetup | null> {
  const targetTimeframes = Array.from(new Set<ChartTimeframe>([activeTimeframe, ...higherTimeframes]));

  // 모든 TF 캔들을 동시에 가져옴
  const candleResults = await Promise.all(
    targetTimeframes.map((tf) => fetchBinanceCandles(symbol, tf, limit))
  );
  const candleByTf = new Map<ChartTimeframe, Candle[]>();
  targetTimeframes.forEach((tf, idx) => candleByTf.set(tf, candleResults[idx]));

  const analysisCandleByTf = new Map<ChartTimeframe, Candle[]>();
  targetTimeframes.forEach((tf) => {
    const candles = candleByTf.get(tf) ?? [];
    analysisCandleByTf.set(tf, useConfirmedCandles(candles));
  });

  const activeCandles = analysisCandleByTf.get(activeTimeframe);
  if (!activeCandles || activeCandles.length === 0) return null;

  // 스캐너 후보는 실제 진입 판단에 가깝기 때문에 진행 중 봉을 제외한 닫힌 봉 기준으로 통일한다.
  const oteAnchorCandles = analysisCandleByTf.get("4h") ?? analysisCandleByTf.get("1d") ?? activeCandles;

  const analyses: TimeframeAnalysis[] = targetTimeframes.map((tf) =>
    analyzeTimeframe(tf, analysisCandleByTf.get(tf)!, { oteAnchorCandles, useCloseForMsb: true })
  );

  const lastCandle = activeCandles[activeCandles.length - 1];
  const market = summarizeMarket(symbol, activeTimeframe, analyses, lastCandle.close, mode);
  if (!market.proPlan && allowWatch) {
    market.proPlan = buildWatchOnlyPlan(market, analyses, lastCandle.close, mode);
  }
  if (!market.proPlan) return null;

  const proximityInfo = analyzeProximity(market.proPlan, lastCandle.close, activeTimeframe);

  // Hard filter: 진입 영역까지 너무 멀거나, 이미 영역을 지나친 셋업은 제외.
  // (롱: 가격이 영역 아래로 내려간 경우 = 구조 이미 깨졌을 가능성)
  if (proximityInfo.proximity === "missed") return null;
  if (Math.abs(proximityInfo.distancePercent) > proximityHardLimit[activeTimeframe]) return null;

  const blocked = hasBlockingScoutCondition(market, analyses, proximityInfo, mode);
  const score = computeScoutScore(market, analyses, proximityInfo, mode);
  const isEntry = !blocked && score >= minimumScoutScore[mode];
  const isActive = !isEntry && isRadarActiveCandidate(symbol, market, analyses, proximityInfo, mode, score, riskProfile);
  if (!isEntry && !isActive) {
    if (!allowWatch) return null;
    if (score < minimumWatchScore[riskProfile][mode]) return null;
  }
  const headline = buildHeadline(symbol, activeTimeframe, market);
  const watchReason =
    isEntry || isActive ? undefined : buildWatchReason(market, analyses, proximityInfo, mode, score);
  const status: NonNullable<ScoutSetup["status"]> = isEntry ? "entry" : isActive ? "active" : "watch";

  return {
    symbol,
    mode,
    timeframe: activeTimeframe,
    analysis: market,
    plan: market.proPlan,
    score,
    status,
    watchKind: status === "entry" ? undefined : getWatchKind(market, analyses),
    watchReason: riskProfile === "radar" && watchReason ? `공격적 분석 기준: ${watchReason}` : watchReason,
    headline,
    distancePercent: proximityInfo.distancePercent,
    insideZone: proximityInfo.insideZone,
    proximity: proximityInfo.proximity,
    currentPrice: lastCandle.close,
    scannedAt: market.updatedAt
  };
}

interface ProximityInfo {
  /** 진입 영역 가장 가까운 경계까지의 거리(%). 영역 안이면 0. */
  distancePercent: number;
  insideZone: boolean;
  proximity: "ready" | "near" | "wait" | "missed";
}

function hasRiskFlag(market: MarketAnalysis, pattern: string) {
  return market.riskFlags.some((flag) => flag.includes(pattern));
}

function planDirection(plan: TradePlanCandidate) {
  return plan.side === "long" ? "bullish" : "bearish";
}

function hasHardReactionZone(active: TimeframeAnalysis | undefined, plan: TradePlanCandidate) {
  const direction = planDirection(plan);
  return Boolean(
    active &&
      ((active.inOb && active.latestOb?.direction === direction) ||
        (active.inFvg && active.latestFvg?.direction === direction))
  );
}

function hasUsablePlanZone(active: TimeframeAnalysis | undefined, plan: TradePlanCandidate) {
  const direction = planDirection(plan);
  return Boolean(
    active &&
      (hasHardReactionZone(active, plan) ||
        active.oteZone === plan.side ||
        active.latestOb?.direction === direction ||
        active.latestFvg?.direction === direction)
  );
}

interface WatchZoneCandidate {
  bottom: number;
  top: number;
  label: string;
}

function zoneDistanceToPrice(zone: WatchZoneCandidate, price: number) {
  if (price >= zone.bottom && price <= zone.top) return 0;
  return Math.min(Math.abs(price - zone.bottom), Math.abs(price - zone.top));
}

function pickWatchZone(
  active: TimeframeAnalysis,
  side: TradePlanCandidate["side"],
  price: number
): WatchZoneCandidate | null {
  const direction = side === "long" ? "bullish" : "bearish";
  const zones: WatchZoneCandidate[] = [];

  if (active.latestOb?.direction === direction) {
    zones.push({
      bottom: active.latestOb.bottom,
      top: active.latestOb.top,
      label: `${active.timeframe} ${side === "long" ? "상승" : "하락"} OB 관찰 구간`
    });
  }
  if (active.latestFvg?.direction === direction) {
    zones.push({
      bottom: active.latestFvg.bottom,
      top: active.latestFvg.top,
      label: `${active.timeframe} ${active.latestFvg.state === "ifvg" ? "iFVG" : "FVG"} 관찰 구간`
    });
  }
  if (active.latestBb?.direction === direction) {
    zones.push({
      bottom: active.latestBb.bottom,
      top: active.latestBb.top,
      label: `${active.timeframe} ${side === "long" ? "상승" : "하락"} BB 관찰 구간`
    });
  }
  if (active.oteLevels) {
    zones.push(
      side === "long"
        ? { bottom: active.oteLevels.longLow, top: active.oteLevels.longHigh, label: `${active.timeframe} OTE 롱 관찰 구간` }
        : { bottom: active.oteLevels.shortLow, top: active.oteLevels.shortHigh, label: `${active.timeframe} OTE 숏 관찰 구간` }
    );
  }

  const validZones = zones
    .map((zone) => ({ ...zone, bottom: Math.min(zone.bottom, zone.top), top: Math.max(zone.bottom, zone.top) }))
    .filter((zone) => Number.isFinite(zone.bottom) && Number.isFinite(zone.top) && zone.bottom > 0 && zone.top > 0);

  if (validZones.length === 0) return null;
  return validZones.sort((a, b) => zoneDistanceToPrice(a, price) - zoneDistanceToPrice(b, price))[0];
}

function inferWatchSide(market: MarketAnalysis, active: TimeframeAnalysis): TradePlanCandidate["side"] | null {
  if (active.msb === "bullish" && active.choch === "bullish") return "long";
  if (active.msb === "bearish" && active.choch === "bearish") return "short";
  if (market.bias === "long" || market.bias === "short") return market.bias;
  if (active.msb === "bullish") return "long";
  if (active.msb === "bearish") return "short";
  if (active.choch === "bullish") return "long";
  if (active.choch === "bearish") return "short";
  return null;
}

function buildWatchOnlyPlan(
  market: MarketAnalysis,
  analyses: TimeframeAnalysis[],
  price: number,
  mode: TradingMode
): TradePlanCandidate | null {
  const active = analyses.find((a) => a.timeframe === market.activeTimeframe);
  if (!active || price <= 0) return null;

  const side = inferWatchSide(market, active);
  if (!side) return null;

  const fallbackSide = side === "long" ? "short" : "long";
  const candidateSides: TradePlanCandidate["side"][] = [side, fallbackSide];
  const picked = candidateSides
    .map((candidateSide) => ({ side: candidateSide, zone: pickWatchZone(active, candidateSide, price) }))
    .find((candidate): candidate is { side: TradePlanCandidate["side"]; zone: WatchZoneCandidate } => candidate.zone !== null);
  if (!picked) return null;

  const pickedSide = picked.side;
  const zone = picked.zone;

  const entryLow = Math.min(zone.bottom, zone.top);
  const entryHigh = Math.max(zone.bottom, zone.top);
  const entry = pickedSide === "long" ? entryHigh : entryLow;
  const atrPad = active.condition.atrPercent !== null ? (active.condition.atrPercent / 100) * 0.45 : 0;
  const basePad = active.timeframe === "5m" ? 0.0035 : 0.006;
  const pad = Math.min(0.014, Math.max(basePad, atrPad));
  const invalidation = pickedSide === "long" ? entryLow * (1 - pad) : entryHigh * (1 + pad);
  const risk = Math.abs(entry - invalidation);
  if (!Number.isFinite(risk) || risk <= 0) return null;

  const config = tradingModeConfigs[mode];
  const direction = pickedSide === "long" ? "bullish" : "bearish";
  const alignedHigher = analyses
    .filter((item) => config.contextTimeframes.includes(item.timeframe))
    .filter((item) => item.msb === direction).length;
  const confirmationCount = [
    active.msb === direction,
    active.choch === direction,
    active.latestSweep?.direction === direction && active.latestSweep.age <= 12,
    active.latestCisd?.direction === direction && active.latestCisd.age <= 12,
    active.inOb && active.latestOb?.direction === direction,
    active.inFvg && active.latestFvg?.direction === direction,
    pickedSide === "long" ? active.premiumDiscount === "discount" : active.premiumDiscount === "premium"
  ].filter(Boolean).length;
  const confidence = Math.max(42, Math.min(68, 42 + confirmationCount * 4 + alignedHigher * 4 - market.riskFlags.length * 2));

  return {
    mode,
    side: pickedSide,
    quality: confidence >= 62 ? "B" : "C",
    title: `${pickedSide === "long" ? "롱" : "숏"} 관찰 대기`,
    entryLabel: zone.label,
    entryLow,
    entryHigh,
    invalidation,
    target1: pickedSide === "long" ? entry + risk * config.targetR1 : entry - risk * config.targetR1,
    target2: pickedSide === "long" ? entry + risk * config.targetR2 : entry - risk * config.targetR2,
    rr1: config.targetR1,
    rr2: config.targetR2,
    confidence,
    reason: "검토 후보는 아니지만, 구조상 계속 관찰할 만한 반응 구간입니다.",
    cautions: [
      "관찰 대기입니다. 조건이 추가로 맞기 전까지 진입 신호로 보지 마세요.",
      "MSB/CHoCH, 스윕/CISD, POC 위치를 다시 확인하세요.",
      ...market.riskFlags.slice(0, 2)
    ]
  };
}

function getWatchKind(market: MarketAnalysis, analyses: TimeframeAnalysis[]): NonNullable<ScoutSetup["watchKind"]> {
  const plan = market.proPlan;
  const active = analyses.find((a) => a.timeframe === market.activeTimeframe);
  if (!plan || !active) return "aligned";

  const direction = planDirection(plan);
  const biasAligned = market.bias === plan.side;
  const structureAligned = active.msb === direction || active.choch === direction;
  return biasAligned || structureAligned ? "aligned" : "counter";
}

function hasBlockingScoutCondition(
  market: MarketAnalysis,
  analyses: TimeframeAnalysis[],
  proximityInfo: ProximityInfo,
  mode: TradingMode
) {
  const plan = market.proPlan!;
  const active = analyses.find((a) => a.timeframe === market.activeTimeframe);
  const direction = planDirection(plan);
  const opposite = plan.side === "long" ? "bearish" : "bullish";
  const hasHardZone = hasHardReactionZone(active, plan);
  const hasFreshSameDirectionTrigger =
    (active?.latestSweep?.direction === direction && active.latestSweep.age <= 6) ||
    (active?.latestCisd?.direction === direction && active.latestCisd.age <= 6);

  if (!active) return true;
  if (!shortScoutSetupsEnabled && plan.side === "short") return true;
  if (criticalRiskFlags.some((flag) => hasRiskFlag(market, flag))) return true;
  if (!hasUsablePlanZone(active, plan)) return true;
  if (mode === "scalp" && market.killzone === "off") return true;
  if (active.msb !== direction || active.choch !== direction) return true;
  if (active.latestSweep?.direction === opposite && active.latestSweep.age <= 8) return true;
  if (active.latestCisd?.direction === opposite && active.latestCisd.age <= 8) return true;

  // 이미 검토 구간 안에 들어온 후보는 백검증상 손실 선행 비율이 높았다.
  // 화면에서는 "기다릴 후보" 위주로 보여줘야 충동 진입을 덜 만든다.
  if (proximityInfo.proximity === "ready") return true;
  if (mode === "scalp" && proximityInfo.proximity === "wait") return true;
  if (mode === "scalp" && active.volumeProfile?.position === "near") return true;

  if (plan.side === "long" && active?.volumeProfile?.position === "below") return true;
  if (plan.side === "short" && active?.volumeProfile?.position === "above") return true;
  if (plan.side === "long" && active?.premiumDiscount === "premium") return true;
  if (plan.side === "short" && active?.premiumDiscount === "discount") return true;
  if (active?.oteZone !== "none" && active?.oteZone !== plan.side) return true;
  if (mode === "swing" && active.timeframe === "15m" && !hasHardZone) return true;
  if (mode === "swing" && active.timeframe === "4h" && !hasHardZone && active.oteZone !== plan.side) return true;
  if (mode === "scalp" && active.timeframe === "5m" && !hasHardZone && active.oteZone !== plan.side) return true;
  if (mode === "scalp" && !hasHardZone && !hasFreshSameDirectionTrigger) return true;

  return false;
}

function isPocFavorable(active: TimeframeAnalysis, side: TradePlanCandidate["side"]) {
  if (!active.volumeProfile) return false;
  return side === "long" ? active.volumeProfile.position === "above" : active.volumeProfile.position === "below";
}

function isNotPocNear(active: TimeframeAnalysis) {
  return active.volumeProfile?.position !== "near";
}

function isPdFavorable(active: TimeframeAnalysis, side: TradePlanCandidate["side"]) {
  return side === "long" ? active.premiumDiscount === "discount" : active.premiumDiscount === "premium";
}

function isPdFavorableOrEquilibrium(active: TimeframeAnalysis, side: TradePlanCandidate["side"]) {
  return isPdFavorable(active, side) || active.premiumDiscount === "equilibrium";
}

function isHardOrOte(active: TimeframeAnalysis, plan: TradePlanCandidate) {
  return hasHardReactionZone(active, plan) || active.oteZone === plan.side;
}

function hasFreshOppositeTrigger(active: TimeframeAnalysis, direction: "bullish" | "bearish") {
  return (
    (active.latestSweep?.direction && active.latestSweep.direction !== direction && active.latestSweep.age <= 8) ||
    (active.latestCisd?.direction && active.latestCisd.direction !== direction && active.latestCisd.age <= 8)
  );
}

function hasOppositeChochRisk(market: MarketAnalysis) {
  return market.riskFlags.some((flag) => flag.includes("CHoCH") && flag.includes("\uBC18\uB300"));
}

function isRadarActiveCandidate(
  symbol: string,
  market: MarketAnalysis,
  analyses: TimeframeAnalysis[],
  proximityInfo: ProximityInfo,
  mode: TradingMode,
  score: number,
  riskProfile: ScoutRiskProfile
) {
  if (riskProfile !== "radar") return false;
  const plan = market.proPlan!;
  const active = analyses.find((a) => a.timeframe === market.activeTimeframe);
  if (!active) return false;
  const direction = planDirection(plan);
  if (score < radarActiveScore[mode]) return false;
  if (getWatchKind(market, analyses) === "counter") return false;
  if (hasFreshOppositeTrigger(active, direction)) return false;
  if (hasOppositeChochRisk(market)) return false;

  const hardZone = hasHardReactionZone(active, plan);
  const hardOrOte = isHardOrOte(active, plan);
  const symbolRoot = symbol.replace("USDT.P", "");

  if (
    mode === "scalp" &&
    (active.timeframe === "5m" || active.timeframe === "15m") &&
    score >= 40 &&
    hardZone &&
    (proximityInfo.proximity === "near" || proximityInfo.proximity === "wait")
  ) {
    return true;
  }

  if (
    mode === "swing" &&
    plan.side === "long" &&
    (active.timeframe === "1h" || active.timeframe === "4h") &&
    score >= 50 &&
    active.oteZone === plan.side &&
    isNotPocNear(active) &&
    (proximityInfo.proximity === "near" || proximityInfo.proximity === "wait") &&
    !hasRiskFlag(market, "상위 시간대")
  ) {
    return true;
  }

  if (symbolRoot === "BTC" && score >= 42 && hardZone && proximityInfo.proximity === "near") {
    return true;
  }

  if (
    symbolRoot === "ETH" &&
    mode === "swing" &&
    active.timeframe === "1h" &&
    score >= 54 &&
    hardOrOte &&
    isNotPocNear(active) &&
    isPdFavorableOrEquilibrium(active, plan.side)
  ) {
    return true;
  }

  if (
    symbolRoot === "XRP" &&
    plan.side === "long" &&
    score >= 42 &&
    hardZone &&
    (proximityInfo.proximity === "near" || proximityInfo.proximity === "wait") &&
    isPocFavorable(active, plan.side)
  ) {
    return true;
  }

  if (
    symbolRoot === "SOL" &&
    score >= 42 &&
    hardOrOte &&
    proximityInfo.proximity === "wait" &&
    market.riskFlags.length <= 2 &&
    (isPocFavorable(active, plan.side) || isNotPocNear(active))
  ) {
    return true;
  }

  if (
    symbolRoot === "DOGE" &&
    mode === "scalp" &&
    (active.timeframe === "5m" || active.timeframe === "15m") &&
    score >= 42 &&
    hardZone &&
    proximityInfo.proximity === "near"
  ) {
    return true;
  }

  if (
    symbolRoot === "DOGE" &&
    mode === "scalp" &&
    plan.side === "short" &&
    (active.timeframe === "5m" || active.timeframe === "15m") &&
    score >= 42 &&
    hardOrOte &&
    (proximityInfo.proximity === "near" || proximityInfo.proximity === "wait") &&
    isPocFavorable(active, plan.side)
  ) {
    return true;
  }

  if (
    symbolRoot === "BNB" &&
    mode === "scalp" &&
    active.timeframe === "5m" &&
    score >= 38 &&
    hardOrOte &&
    proximityInfo.proximity === "near" &&
    isPdFavorableOrEquilibrium(active, plan.side)
  ) {
    return true;
  }

  return false;
}

function buildWatchReason(
  market: MarketAnalysis,
  analyses: TimeframeAnalysis[],
  proximityInfo: ProximityInfo,
  mode: TradingMode,
  score: number
) {
  const plan = market.proPlan!;
  const active = analyses.find((a) => a.timeframe === market.activeTimeframe);
  if (!active) return "활성 타임프레임 분석 데이터가 부족합니다";
  if (!shortScoutSetupsEnabled && plan.side === "short") return "숏 후보가 비활성화되어 있습니다";
  if (criticalRiskFlags.some((flag) => hasRiskFlag(market, flag))) return "상위 구조 충돌 또는 반대 CISD 위험이 있습니다";
  if (!hasUsablePlanZone(active, plan)) return "OB/FVG/OTE 중 쓸 만한 반응 구간이 아직 없습니다";
  if (mode === "scalp" && market.killzone === "off") return "빠른 타임프레임 기준 킬존 바깥입니다";

  const direction = planDirection(plan);
  const opposite = plan.side === "long" ? "bearish" : "bullish";
  if (active.msb !== direction || active.choch !== direction) return "현재 TF의 MSB/CHoCH 방향이 아직 맞지 않습니다";
  if (active.latestSweep?.direction === opposite && active.latestSweep.age <= 8) return "최근 반대 방향 스윕이 남아 있습니다";
  if (active.latestCisd?.direction === opposite && active.latestCisd.age <= 8) return "최근 반대 방향 CISD가 남아 있습니다";
  if (proximityInfo.proximity === "ready") return "검토 구간 안이라 추격 진입 위험이 있습니다";
  if (mode === "scalp" && proximityInfo.proximity === "wait") return "현재 타임프레임 기준으로는 검토 구간까지 아직 멉니다";
  if (mode === "scalp" && active.volumeProfile?.position === "near") return "POC 근처라 균형 구간 가능성이 큽니다";
  if (plan.side === "long" && active.volumeProfile?.position === "below") return "롱 기준 POC 아래라 매수 우위가 약합니다";
  if (plan.side === "short" && active.volumeProfile?.position === "above") return "숏 기준 POC 위라 매도 우위가 약합니다";
  if (plan.side === "long" && active.premiumDiscount === "premium") return "롱 기준 프리미엄 구간입니다";
  if (plan.side === "short" && active.premiumDiscount === "discount") return "숏 기준 디스카운트 구간입니다";
  if (active.oteZone !== "none" && active.oteZone !== plan.side) return "OTE 방향이 후보 방향과 다릅니다";

  const hasHardZone = hasHardReactionZone(active, plan);
  const hasFreshSameDirectionTrigger =
    (active.latestSweep?.direction === direction && active.latestSweep.age <= 6) ||
    (active.latestCisd?.direction === direction && active.latestCisd.age <= 6);
  if (mode === "scalp" && !hasHardZone && !hasFreshSameDirectionTrigger) {
    return "현재 타임프레임에 필요한 OB/FVG 반응 또는 최근 스윕/CISD 트리거가 부족합니다";
  }

  return `검토 후보 점수 기준에 못 미칩니다 (${score}점)`;
}

function getScoutScoreCap(
  market: MarketAnalysis,
  analyses: TimeframeAnalysis[],
  proximityInfo: ProximityInfo,
  mode: TradingMode
) {
  const plan = market.proPlan!;
  const active = analyses.find((a) => a.timeframe === market.activeTimeframe);
  const hasHardZone = hasHardReactionZone(active, plan);
  const hasOnlyOteZone = Boolean(active && !hasHardZone && active.oteZone === plan.side);
  let cap = 100;

  if (proximityInfo.proximity === "wait") cap = Math.min(cap, 82);
  if (proximityInfo.proximity === "ready") cap = Math.min(cap, 62);
  if (mode === "scalp" && proximityInfo.proximity === "near") cap = Math.min(cap, 86);
  if (mode === "scalp" && market.killzone === "off") cap = Math.min(cap, 44);
  if (mode === "scalp" && active?.volumeProfile?.position === "near") cap = Math.min(cap, 44);
  if (hasOnlyOteZone) cap = Math.min(cap, plan.side === "short" ? 64 : 70);
  if (active?.timeframe === "15m" && !hasHardZone) cap = Math.min(cap, 66);
  if (criticalRiskFlags.some((flag) => hasRiskFlag(market, flag))) cap = Math.min(cap, 58);
  if (hasRiskFlag(market, "최근 반대 방향 스윕")) cap = Math.min(cap, 78);
  if (plan.side === "long" && active?.premiumDiscount === "premium") cap = Math.min(cap, 58);
  if (plan.side === "short" && active?.premiumDiscount === "discount") cap = Math.min(cap, 58);
  if (plan.side === "long" && active?.volumeProfile?.position === "below") cap = Math.min(cap, 62);
  if (plan.side === "short" && active?.volumeProfile?.position === "above") cap = Math.min(cap, 62);
  if (active?.oteZone !== "none" && active?.oteZone !== plan.side) cap = Math.min(cap, 60);

  return cap;
}

/**
 * 현재가와 진입 영역의 관계를 평가.
 *
 * - LONG: 영역 위쪽(현재가 > entryHigh)이면 정상 대기 / 영역 안이면 ready / 영역 아래(현재가 < entryLow)면 missed (추격됨)
 * - SHORT: 영역 아래쪽(현재가 < entryLow)이면 정상 대기 / 영역 안이면 ready / 영역 위(현재가 > entryHigh)면 missed
 */
function analyzeProximity(
  plan: TradePlanCandidate,
  currentPrice: number,
  timeframe: ChartTimeframe
): ProximityInfo {
  const insideZone = currentPrice >= plan.entryLow && currentPrice <= plan.entryHigh;
  if (insideZone) {
    return { distancePercent: 0, insideZone: true, proximity: "ready" };
  }

  if (plan.side === "long") {
    if (currentPrice < plan.entryLow) {
      // 영역 아래 = 추격됨, 구조 깨졌을 가능성
      const distancePercent = -((plan.entryLow - currentPrice) / currentPrice) * 100;
      return { distancePercent, insideZone: false, proximity: "missed" };
    }
    // 영역 위 = 정상 대기 상황 (가격 내려와야 진입)
    const distancePercent = ((currentPrice - plan.entryHigh) / currentPrice) * 100;
    const near = distancePercent <= proximityNearLimit[timeframe];
    return { distancePercent, insideZone: false, proximity: near ? "near" : "wait" };
  }

  // SHORT
  if (currentPrice > plan.entryHigh) {
    const distancePercent = -((currentPrice - plan.entryHigh) / currentPrice) * 100;
    return { distancePercent, insideZone: false, proximity: "missed" };
  }
  const distancePercent = ((plan.entryLow - currentPrice) / currentPrice) * 100;
  const near = distancePercent <= proximityNearLimit[timeframe];
  return { distancePercent, insideZone: false, proximity: near ? "near" : "wait" };
}

/**
 * Scout Score (0~100). 룰 베이스. AI 코멘트는 별도.
 *
 * 구성:
 * - PRO 플랜 confidence (35~92)         : 그대로 베이스
 * - 상위 TF 추세 정합성 가산              : +0~6
 * - readiness 보정                      : ±0~5
 * - riskFlags 패널티                    : -0~10
 * - 활성 TF가 OTE 영역인지 가산           : +0~4
 * - 근접도 보정                          : +0~6
 * - POC 균형/역행 위치 패널티             : -0~10
 *
 * 최종 0~100 클램프.
 */
function computeScoutScore(
  market: MarketAnalysis,
  analyses: TimeframeAnalysis[],
  proximityInfo: ProximityInfo,
  mode: TradingMode
): number {
  const plan = market.proPlan!;
  const direction = plan.side === "long" ? "bullish" : "bearish";
  const modeConfig = tradingModeConfigs[mode];

  let score = plan.confidence;

  const higherAligned = analyses
    .filter((a) => modeConfig.contextTimeframes.includes(a.timeframe))
    .filter((a) => a.msb === direction).length;
  score += higherAligned * 3;

  // readiness 보정
  if (market.readiness === "high") score += 4;
  else if (market.readiness === "low") score -= 4;

  // 위험 신호 패널티. 단순 개수보다 검증상 나쁜 조건을 더 무겁게 반영한다.
  score -= Math.min(market.riskFlags.length * 3, 15);
  if (criticalRiskFlags.some((flag) => hasRiskFlag(market, flag))) score -= 18;
  if (hasRiskFlag(market, "최근 반대 방향 스윕")) score -= 8;
  if (
    hasRiskFlag(market, "POC 아래 위치") ||
    hasRiskFlag(market, "POC 위 위치") ||
    hasRiskFlag(market, "프리미엄 추격") ||
    hasRiskFlag(market, "디스카운트 추격")
  ) {
    score -= 10;
  }

  // 활성 TF OTE 영역 가산
  const active = analyses.find((a) => a.timeframe === market.activeTimeframe);
  const hasHardZone = hasHardReactionZone(active, plan);
  if (hasHardZone) score += 6;
  else if (active?.oteZone === plan.side) score -= 4;
  else score -= 10;

  if (active?.oteZone === plan.side) score += 4;

  // 근접도는 "검토 가치"만 보정한다. 영역 내부를 진입 신호처럼 과대평가하지 않는다.
  if (proximityInfo.proximity === "ready") score -= 10;
  else if (proximityInfo.proximity === "near") score += 4;
  else if (proximityInfo.proximity === "wait") score -= 4;

  if (active?.volumeProfile?.position === "near") score += 2;
  if (plan.side === "long" && active?.volumeProfile?.position === "below") score -= 14;
  if (plan.side === "short" && active?.volumeProfile?.position === "above") score -= 14;
  if (plan.side === "long" && active?.volumeProfile?.position === "above") score += 2;
  if (plan.side === "short" && active?.volumeProfile?.position === "below") score += 2;

  const cap = getScoutScoreCap(market, analyses, proximityInfo, mode);
  return Math.round(Math.max(0, Math.min(cap, score)));
}

/** 사용자가 1초 내 이해할 수 있는 한 줄. 30~50자. */
function buildHeadline(symbol: string, tf: ChartTimeframe, market: MarketAnalysis): string {
  const sym = symbol.replace("USDT.P", "");
  const sideLabel = market.proPlan!.side === "long" ? "롱 우세" : "숏 우세";
  const qualityLabel =
    market.proPlan!.quality === "A" ? "A급" : market.proPlan!.quality === "B" ? "B급" : "C급";
  const zoneLabel = market.proPlan!.entryLabel;
  return `${sym} ${tf} — ${sideLabel} ${qualityLabel} · ${zoneLabel}`;
}

/**
 * 모든 (symbol × activeTF) 조합을 스캔해서 점수 순으로 정렬.
 * 실패한 조합은 무시. 네트워크 오류는 throw.
 */
export async function scanAllSetups(options: ScannerOptions = {}): Promise<ScoutSetup[]> {
  const mode = options.mode ?? defaultScoutMode;
  const riskProfile = options.riskProfile ?? defaultScoutRiskProfile;
  const symbols = options.symbols ?? scoutSymbols;
  const timeframes = options.timeframes ?? scoutTimeframes[mode];
  const higherTimeframes = options.higherTimeframes ?? scoutHigherTimeframes[mode];
  const limit = options.limit ?? tradingModeConfigs[mode].scoutLimit;

  const tasks: Promise<ScoutSetup | null>[] = [];
  for (const symbol of symbols) {
    for (const tf of timeframes) {
      tasks.push(
        scanCombo(symbol, tf, higherTimeframes, limit, mode, riskProfile, true).catch((error) => {
          console.warn(`[setupScout] ${symbol} ${tf} 스캔 실패`, error);
          return null;
        })
      );
    }
  }

  const settled = await Promise.all(tasks);
  return settled
    .filter((item): item is ScoutSetup => item !== null)
    .sort((a, b) => {
      const rank = (setup: ScoutSetup) => (setup.status === "entry" ? 2 : setup.status === "active" ? 1 : 0);
      const statusDelta = rank(b) - rank(a);
      return statusDelta || b.score - a.score;
    });
}

/** TOP N개만 추출 (기본 3) */
export function topSetups(setups: ScoutSetup[], n = 3): ScoutSetup[] {
  const picked: ScoutSetup[] = [];
  const usedSymbols = new Set<string>();

  for (const setup of setups) {
    if (usedSymbols.has(setup.symbol)) continue;
    picked.push(setup);
    usedSymbols.add(setup.symbol);
    if (picked.length >= n) return picked;
  }

  for (const setup of setups) {
    if (picked.includes(setup)) continue;
    picked.push(setup);
    if (picked.length >= n) return picked;
  }

  return picked;
}

/** 무료 티어 일일 제한용. localStorage 저장 키. */
export const scoutCacheKey = "chartRadar.setupScout.v8";
const legacyScoutBaseCacheKeys = ["untitledRisk.setupScout.v8", "positionguard.setupScout.v2"];
export const scoutCacheTtlMs = 5 * 60 * 1000; // 5분

interface ScoutCacheEntry {
  setups: ScoutSetup[];
  cachedAt: number;
}

function scoutCacheKeyForMode(
  mode: TradingMode,
  riskProfile: ScoutRiskProfile,
  scope: ScoutScope = defaultScoutScope
) {
  return `${scoutCacheKey}.${mode}.${riskProfile}.${scope}`;
}

export function readScoutCache(
  mode: TradingMode = defaultScoutMode,
  riskProfile: ScoutRiskProfile = defaultScoutRiskProfile,
  scope: ScoutScope = defaultScoutScope
): ScoutCacheEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const scopedKey = scoutCacheKeyForMode(mode, riskProfile, scope);
    const legacyModeKey = `${scoutCacheKey}.${mode}.${riskProfile}`;
    const legacyKeys = legacyScoutBaseCacheKeys.flatMap((baseKey) => [
      `${baseKey}.${mode}.${riskProfile}.${scope}`,
      `${baseKey}.${mode}.${riskProfile}`,
      baseKey
    ]);
    const raw =
      window.localStorage.getItem(scopedKey) ??
      window.localStorage.getItem(legacyModeKey) ??
      legacyKeys.map((key) => window.localStorage.getItem(key)).find((value): value is string => value !== null);
    if (!raw) return null;
    window.localStorage.setItem(scopedKey, raw);
    window.localStorage.removeItem(legacyModeKey);
    legacyKeys.forEach((key) => window.localStorage.removeItem(key));
    const parsed = JSON.parse(raw) as ScoutCacheEntry;
    if (Date.now() - parsed.cachedAt > scoutCacheTtlMs) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeScoutCache(
  setups: ScoutSetup[],
  mode: TradingMode = defaultScoutMode,
  riskProfile: ScoutRiskProfile = defaultScoutRiskProfile,
  scope: ScoutScope = defaultScoutScope
) {
  if (typeof window === "undefined") return;
  try {
    const entry: ScoutCacheEntry = { setups, cachedAt: Date.now() };
    window.localStorage.setItem(scoutCacheKeyForMode(mode, riskProfile, scope), JSON.stringify(entry));
    legacyScoutBaseCacheKeys.forEach((baseKey) => {
      window.localStorage.removeItem(baseKey);
      window.localStorage.removeItem(`${baseKey}.${mode}.${riskProfile}`);
      window.localStorage.removeItem(`${baseKey}.${mode}.${riskProfile}.${scope}`);
    });
  } catch {
    // 용량 초과 등은 무시
  }
}
