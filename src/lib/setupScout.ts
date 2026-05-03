import {
  analyzeTimeframe,
  fetchBinanceCandles,
  summarizeMarket,
  type Candle,
  type ChartTimeframe,
  type MarketAnalysis,
  type TimeframeAnalysis,
  type TradePlanCandidate
} from "./marketAnalysis";

export const scoutSymbols = ["BTCUSDT.P", "ETHUSDT.P", "SOLUSDT.P", "XRPUSDT.P", "DOGEUSDT.P"] as const;
export type ScoutSymbol = (typeof scoutSymbols)[number];

// 스윙/데이트레이딩 핵심 TF만 기본 스캔 — 5m/1d는 노이즈/속도 균형상 제외
export const scoutTimeframes: ChartTimeframe[] = ["15m", "1h", "4h"];
export const scoutHigherTimeframes: ChartTimeframe[] = ["4h", "1d"];

export interface ScoutSetup {
  symbol: ScoutSymbol;
  timeframe: ChartTimeframe;
  analysis: MarketAnalysis;
  plan: TradePlanCandidate;
  /** 0~100 정수. PRO 플랜 confidence 기반 + 정합성 + 근접도 가산 */
  score: number;
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
  "5m": 0.3,
  "15m": 0.5,
  "1h": 1.0,
  "4h": 2.0,
  "1d": 4.0
};

interface ScannerOptions {
  /** 스캔할 종목. 기본 전체 5개 */
  symbols?: readonly ScoutSymbol[];
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
  symbol: ScoutSymbol,
  activeTimeframe: ChartTimeframe,
  higherTimeframes: ChartTimeframe[],
  limit: number
): Promise<ScoutSetup | null> {
  const targetTimeframes = Array.from(new Set<ChartTimeframe>([activeTimeframe, ...higherTimeframes]));

  // 모든 TF 캔들을 동시에 가져옴
  const candleResults = await Promise.all(
    targetTimeframes.map((tf) => fetchBinanceCandles(symbol, tf, limit))
  );
  const candleByTf = new Map<ChartTimeframe, Candle[]>();
  targetTimeframes.forEach((tf, idx) => candleByTf.set(tf, candleResults[idx]));

  const activeCandles = candleByTf.get(activeTimeframe);
  if (!activeCandles || activeCandles.length === 0) return null;

  const oteAnchorCandles = candleByTf.get("4h") ?? candleByTf.get("1d") ?? activeCandles;

  const analyses: TimeframeAnalysis[] = targetTimeframes.map((tf) =>
    analyzeTimeframe(tf, candleByTf.get(tf)!, { oteAnchorCandles })
  );

  const lastCandle = activeCandles[activeCandles.length - 1];
  const market = summarizeMarket(symbol, activeTimeframe, analyses, lastCandle.close);
  if (!market.proPlan) return null;

  const proximityInfo = analyzeProximity(market.proPlan, lastCandle.close, activeTimeframe);

  // Hard filter: 진입 영역까지 너무 멀거나, 이미 영역을 지나친 셋업은 제외.
  // (롱: 가격이 영역 아래로 내려간 경우 = 구조 이미 깨졌을 가능성)
  if (proximityInfo.proximity === "missed") return null;
  if (Math.abs(proximityInfo.distancePercent) > proximityHardLimit[activeTimeframe]) return null;

  const score = computeScoutScore(market, analyses, proximityInfo);
  const headline = buildHeadline(symbol, activeTimeframe, market);

  return {
    symbol,
    timeframe: activeTimeframe,
    analysis: market,
    plan: market.proPlan,
    score,
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
 * - 근접도 가산                          : +0~15 (검토 영역 내부 = 가장 큼)
 *
 * 최종 0~100 클램프.
 */
function computeScoutScore(
  market: MarketAnalysis,
  analyses: TimeframeAnalysis[],
  proximityInfo: ProximityInfo
): number {
  const plan = market.proPlan!;
  const direction = plan.side === "long" ? "bullish" : "bearish";

  let score = plan.confidence;

  // 상위 TF 정합성 가산
  const higherAligned = analyses
    .filter((a) => a.timeframe === "4h" || a.timeframe === "1d")
    .filter((a) => a.msb === direction).length;
  score += higherAligned * 3;

  // readiness 보정
  if (market.readiness === "high") score += 4;
  else if (market.readiness === "low") score -= 4;

  // 위험 신호 패널티
  score -= Math.min(market.riskFlags.length * 2, 10);

  // 활성 TF OTE 영역 가산
  const active = analyses.find((a) => a.timeframe === market.activeTimeframe);
  if (active?.oteZone === plan.side) score += 4;

  // 근접도 — 현재가가 검토 영역 내부인 후보를 가장 높게 평가
  if (proximityInfo.proximity === "ready") score += 15;
  else if (proximityInfo.proximity === "near") score += 8;
  else if (proximityInfo.proximity === "wait") score -= 4;

  return Math.round(Math.max(0, Math.min(100, score)));
}

/** 사용자가 1초 내 이해할 수 있는 한 줄. 30~50자. */
function buildHeadline(symbol: ScoutSymbol, tf: ChartTimeframe, market: MarketAnalysis): string {
  const sym = symbol.replace("USDT.P", "");
  const sideLabel = market.proPlan!.side === "long" ? "롱" : "숏";
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
  const symbols = options.symbols ?? scoutSymbols;
  const timeframes = options.timeframes ?? scoutTimeframes;
  const higherTimeframes = options.higherTimeframes ?? scoutHigherTimeframes;
  const limit = options.limit ?? 320;

  const tasks: Promise<ScoutSetup | null>[] = [];
  for (const symbol of symbols) {
    for (const tf of timeframes) {
      tasks.push(
        scanCombo(symbol, tf, higherTimeframes, limit).catch((error) => {
          console.warn(`[setupScout] ${symbol} ${tf} 스캔 실패`, error);
          return null;
        })
      );
    }
  }

  const settled = await Promise.all(tasks);
  return settled
    .filter((item): item is ScoutSetup => item !== null)
    .sort((a, b) => b.score - a.score);
}

/** TOP N개만 추출 (기본 3) */
export function topSetups(setups: ScoutSetup[], n = 3): ScoutSetup[] {
  return setups.slice(0, n);
}

/** 무료 티어 일일 제한용. localStorage 저장 키. */
export const scoutCacheKey = "positionguard.setupScout.v1";
export const scoutCacheTtlMs = 5 * 60 * 1000; // 5분

interface ScoutCacheEntry {
  setups: ScoutSetup[];
  cachedAt: number;
}

export function readScoutCache(): ScoutCacheEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(scoutCacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ScoutCacheEntry;
    if (Date.now() - parsed.cachedAt > scoutCacheTtlMs) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeScoutCache(setups: ScoutSetup[]) {
  if (typeof window === "undefined") return;
  try {
    const entry: ScoutCacheEntry = { setups, cachedAt: Date.now() };
    window.localStorage.setItem(scoutCacheKey, JSON.stringify(entry));
  } catch {
    // 용량 초과 등은 무시
  }
}
