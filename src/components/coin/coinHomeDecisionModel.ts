import type { CoinMarketMetricsPayload } from "@/lib/coinMarketMetrics";
import type { LargeTradeFlowReport } from "@/lib/largeTradeFlow";
import type { LiquidationPressureReport } from "@/lib/liquidationPressure";
import type { OptionsMarketReport } from "@/lib/optionsMarket";
import type { StablecoinLiquidityReport } from "@/lib/stablecoinLiquidity";
import type { TechnicalRadarReport } from "@/lib/technicalRadar";

export interface CoinHomeBoardItem {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  quoteVolume: number;
}

export type CoinHomeDecisionState = "관망하기" | "조금 더 지켜보기" | "상승 가능성 높음" | "하락 위험 큼" | "크게 흔들림";
export type CoinHomeDirection = "상승 쪽" | "하락 쪽" | "관망하기" | "흔들림 주의";
export type CoinHomeLeadership = "BTC 중심" | "알트도 강함" | "섞임" | "위험 줄이기";

export interface CoinHomeDecisionSummary {
  state: CoinHomeDecisionState;
  readinessScore: number;
  direction: CoinHomeDirection;
  leadership: CoinHomeLeadership;
  topRisk: string;
  nextCondition: string;
  reason: string;
  scoreLabel: string;
  scoreDetail: string;
}

interface BuildCoinHomeDecisionInput {
  board: CoinHomeBoardItem[];
  technical: TechnicalRadarReport | null;
  technical4h?: TechnicalRadarReport | null;
  marketMetrics: CoinMarketMetricsPayload | null;
  btcFunding: LiquidationPressureReport | null;
  stablecoinLiquidity?: StablecoinLiquidityReport | null;
  largeTradeFlow?: LargeTradeFlowReport | null;
  optionsMarket?: OptionsMarketReport | null;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function roundedScore(value: number) {
  return Math.round(clamp(value, 0, 100) / 5) * 5;
}

function compactSymbol(symbol: string) {
  return symbol.replace("USDT.P", "").replace("USDT", "");
}

function findBoardItem(board: CoinHomeBoardItem[], symbol: string) {
  return board.find((item) => compactSymbol(item.symbol) === symbol) ?? null;
}

function trendBias(report: TechnicalRadarReport | null) {
  if (!report) return 0;
  if (report.trendLabel.includes("강한 상승")) return 18;
  if (report.trendLabel.includes("상승")) return 12;
  if (report.trendLabel.includes("강한 하락")) return -22;
  if (report.trendLabel.includes("하락")) return -14;
  return 0;
}

function trendIsWeak(report: TechnicalRadarReport | null, btcChange: number) {
  return Boolean(report?.trendLabel.includes("하락")) || btcChange <= -2.5;
}

function trendIsConstructive(report: TechnicalRadarReport | null, btcChange: number) {
  return Boolean(report?.trendLabel.includes("상승")) || btcChange >= 2.5;
}

function stableTrendState({
  technical,
  technical4h,
  btcChange
}: {
  technical: TechnicalRadarReport | null;
  technical4h: TechnicalRadarReport | null | undefined;
  btcChange: number;
}) {
  const shortWeak = trendIsWeak(technical, btcChange);
  const shortConstructive = trendIsConstructive(technical, btcChange);
  const higherWeak = trendIsWeak(technical4h ?? null, btcChange <= -1.2 ? btcChange : 0);
  const higherConstructive = trendIsConstructive(technical4h ?? null, btcChange >= 1.2 ? btcChange : 0);

  return {
    shortWeak,
    shortConstructive,
    higherWeak,
    higherConstructive,
    weakTrend: (shortWeak && !higherConstructive) || (higherWeak && btcChange <= 0),
    constructiveTrend: (shortConstructive && !higherWeak) || (higherConstructive && btcChange >= 0)
  };
}

function altStats(board: CoinHomeBoardItem[]) {
  const alts = board.filter((item) => compactSymbol(item.symbol) !== "BTC");
  const positive = alts.filter((item) => item.changePercent > 0);
  const strong = alts.filter((item) => item.changePercent >= 2.5);
  const active = alts.filter((item) => item.changePercent > 0 && item.quoteVolume > 0);
  const participationRatio = alts.length ? positive.length / alts.length : 0;
  const medianVolume = active.length
    ? [...active].sort((a, b) => a.quoteVolume - b.quoteVolume)[Math.floor(active.length / 2)]?.quoteVolume ?? 0
    : 0;
  const volumeBacked = active.filter((item) => item.quoteVolume >= medianVolume && item.changePercent >= 1.5).length;

  return {
    total: alts.length,
    positiveCount: positive.length,
    strongCount: strong.length,
    participationRatio,
    volumeBackedCount: volumeBacked
  };
}

function derivativeRisk(report: LiquidationPressureReport | null) {
  if (!report) return 0;
  const gradeRisk = report.grade === "extreme" ? 24 : report.grade === "heated" ? 14 : report.grade === "normal" ? 2 : 0;
  const longShortRatio = report.globalLongShort.ratio;
  const ratioRisk = longShortRatio && Number.isFinite(longShortRatio) ? Math.min(Math.max(Math.abs(longShortRatio - 1) - 0.2, 0) * 18, 10) : 0;
  const fundingRisk = report.fundingRatePercent && Number.isFinite(report.fundingRatePercent) ? Math.min(Math.max(Math.abs(report.fundingRatePercent) - 0.01, 0) * 500, 10) : 0;
  return gradeRisk + ratioRisk + fundingRisk;
}

function kimchiFxRisk(metrics: CoinMarketMetricsPayload | null) {
  const kimchi = metrics?.kimchiPremiumPercent;
  const usdKrw = metrics?.usdKrw;
  const kimchiRisk =
    kimchi && Number.isFinite(kimchi)
      ? kimchi > 1.5
        ? Math.min((kimchi - 1.5) * 3, 10)
        : kimchi < -3
          ? Math.min(Math.abs(kimchi + 3) * 1.5, 5)
          : 0
      : 0;
  const fxRisk = usdKrw && Number.isFinite(usdKrw) ? (usdKrw >= 1500 ? 5 : usdKrw >= 1450 ? 3 : 0) : 0;
  return kimchiRisk + fxRisk;
}

function liquidityBias(report: StablecoinLiquidityReport | null | undefined) {
  if (!report) return 0;
  const scoreBias = (report.flowScore - 50) * 0.32;
  const gradeBias = report.grade === "strong" ? 7 : report.grade === "building" ? 3 : report.grade === "drying" ? -8 : 0;
  return scoreBias + gradeBias;
}

function liquidityRisk(report: StablecoinLiquidityReport | null | undefined) {
  if (!report) return 0;
  const scoreRisk = report.flowScore < 35 ? 9 : report.flowScore < 42 ? 5 : 0;
  const weeklyRisk = report.change7dPercent !== null && report.change7dPercent <= -1 ? 7 : report.change7dPercent !== null && report.change7dPercent <= -0.5 ? 3 : 0;
  const monthlyRisk = report.change30dPercent !== null && report.change30dPercent <= -2 ? 6 : 0;
  const gradeRisk = report.grade === "drying" ? 7 : 0;
  return scoreRisk + weeklyRisk + monthlyRisk + gradeRisk;
}

function largeTradeBias(report: LargeTradeFlowReport | null | undefined) {
  if (!report || report.dominantSide === "balanced") return 0;
  const gradeWeight = report.grade === "extreme" ? 12 : report.grade === "heated" ? 8 : report.grade === "normal" ? 4 : 1;
  const imbalanceWeight = Math.min(Math.abs(report.imbalancePercent), 70) / 70;
  const anomalyPenalty = report.anomalyLevel === "high" ? 5 : report.anomalyLevel === "watch" ? 2 : 0;
  const directionalBias = gradeWeight * imbalanceWeight;
  return report.dominantSide === "buy" ? directionalBias - anomalyPenalty : -directionalBias - anomalyPenalty;
}

function largeTradeRisk(report: LargeTradeFlowReport | null | undefined) {
  if (!report) return 0;
  const sellRisk =
    report.dominantSide === "sell"
      ? report.grade === "extreme"
        ? 16
        : report.grade === "heated"
          ? 11
          : report.grade === "normal"
            ? 5
            : 0
      : 0;
  const anomalyRisk = report.anomalyLevel === "high" ? 8 : report.anomalyLevel === "watch" ? 4 : 0;
  return sellRisk + anomalyRisk;
}

function optionsBias(report: OptionsMarketReport | null | undefined) {
  if (!report || report.dominantSide === "balanced") return 0;
  const gradeWeight = report.grade === "extreme" ? 8 : report.grade === "heated" ? 5 : report.grade === "normal" ? 2 : 0;
  const biasWeight = Math.min(Math.abs(report.biasPercent), 60) / 60;
  return report.dominantSide === "call" ? gradeWeight * biasWeight : -gradeWeight * biasWeight;
}

function optionsRisk(report: OptionsMarketReport | null | undefined) {
  if (!report) return 0;
  const volatilityRisk =
    report.expectedMovePercent !== null && report.expectedMovePercent >= 14
      ? 10
      : report.expectedMovePercent !== null && report.expectedMovePercent >= 9
        ? 5
        : 0;
  const putRisk =
    report.dominantSide === "put"
      ? report.grade === "extreme"
        ? 12
        : report.grade === "heated"
          ? 8
          : report.grade === "normal"
            ? 4
            : 0
      : 0;
  return volatilityRisk + putRisk;
}

function riskLabel({
  weakTrend,
  constructiveTrend,
  btcChange,
  overheat,
  derivatives,
  kimchiRisk,
  liquidity,
  largeTrade,
  options
}: {
  weakTrend: boolean;
  constructiveTrend: boolean;
  btcChange: number;
  overheat: boolean;
  derivatives: number;
  kimchiRisk: number;
  liquidity: number;
  largeTrade: number;
  options: number;
}) {
  if (weakTrend && (constructiveTrend || btcChange <= -2.5)) return "BTC 상승 추세 이탈";
  if (weakTrend) return "BTC 약세 계속";
  if (derivatives >= 20) return "선물 쏠림 큼";
  if (largeTrade >= 12) return "큰 매도 체결";
  if (options >= 12) return "옵션 변동성 큼";
  if (liquidity >= 12) return "스테이블코인 유출";
  if (overheat) return "가격 과열";
  if (kimchiRisk >= 7) return "김치 프리미엄/환율 부담";
  return "큰 경고 없음";
}

function nextConditionFor(state: CoinHomeDecisionState, leadership: CoinHomeLeadership, topRisk: string) {
  if (state === "하락 위험 큼") return "반등이 오래 버티는지 봅니다.";
  if (state === "크게 흔들림") {
    if (topRisk === "선물 쏠림 큼") return "선물 포지션 쏠림이 줄어드는지 봅니다.";
    if (topRisk === "큰 매도 체결") return "큰 매도가 멈추는지 봅니다.";
    if (topRisk === "옵션 변동성 큼") return "옵션 예상 변동 폭이 줄어드는지 봅니다.";
    if (topRisk === "스테이블코인 유출") return "시장에 새 돈이 다시 들어오는지 봅니다.";
    if (topRisk === "가격 과열") return "급등 과열이 식는지 봅니다.";
    if (topRisk === "김치 프리미엄/환율 부담") return "김치 프리미엄과 환율 부담이 낮아지는지 봅니다.";
    if (topRisk === "BTC 약세 계속" || topRisk === "BTC 상승 추세 이탈") return "BTC가 다시 버티는지 봅니다.";
    return "가격 흔들림이 잦아드는지 봅니다.";
  }
  if (leadership === "알트도 강함") return "BTC가 버티고 알트 거래대금이 계속 붙는지 봅니다.";
  if (leadership === "BTC 중심") return "BTC 상승이 이어지고 알트가 따라오는지 봅니다.";
  if (state === "상승 가능성 높음") return "잠깐 밀린 뒤 다시 오르는지 봅니다.";
  return "BTC 흐름과 큰 뉴스 전후 움직임을 봅니다.";
}

function leadershipFor({
  constructiveTrend,
  weakTrend,
  btcChange,
  participationRatio,
  strongAltCount,
  volumeBackedCount,
  dominance
}: {
  constructiveTrend: boolean;
  weakTrend: boolean;
  btcChange: number;
  participationRatio: number;
  strongAltCount: number;
  volumeBackedCount: number;
  dominance: number | null | undefined;
}): CoinHomeLeadership {
  if (weakTrend && participationRatio < 0.45) return "위험 줄이기";
  if (constructiveTrend && participationRatio >= 0.55 && strongAltCount >= 2 && volumeBackedCount >= 2) return "알트도 강함";
  if (constructiveTrend && btcChange > 0 && participationRatio < 0.5) return "BTC 중심";
  if (btcChange > 1.5 && participationRatio < 0.45) return "BTC 중심";
  if (participationRatio >= 0.65 && (dominance === null || dominance === undefined || dominance < 58)) return "알트도 강함";
  return "섞임";
}

export function buildCoinHomeDecision(input: BuildCoinHomeDecisionInput): CoinHomeDecisionSummary {
  const btc = findBoardItem(input.board, "BTC");
  const btcChange = btc?.changePercent ?? 0;
  const stats = altStats(input.board);
  const fearGreed = input.technical?.fearGreed.score ?? 50;
  const dominance = input.marketMetrics?.btcDominancePercent;
  const trendState = stableTrendState({ technical: input.technical, technical4h: input.technical4h, btcChange });
  const { constructiveTrend, weakTrend } = trendState;
  const derivatives = derivativeRisk(input.btcFunding);
  const kimchiRisk = kimchiFxRisk(input.marketMetrics);
  const liquidity = liquidityRisk(input.stablecoinLiquidity);
  const liquidityStrength = liquidityBias(input.stablecoinLiquidity);
  const largeTrade = largeTradeRisk(input.largeTradeFlow);
  const largeTradeStrength = largeTradeBias(input.largeTradeFlow);
  const options = optionsRisk(input.optionsMarket);
  const optionsStrength = optionsBias(input.optionsMarket);
  const overheat = fearGreed >= 80 || btcChange >= 5 || (stats.strongCount >= 4 && stats.participationRatio >= 0.7);

  const altParticipationBonus =
    stats.participationRatio >= 0.65 ? 12 : stats.participationRatio >= 0.5 ? 7 : stats.participationRatio >= 0.35 ? 2 : -5;
  const trendStrength = trendBias(input.technical) * 0.65 + trendBias(input.technical4h ?? null) * 0.35;
  const weakTrendPenalty = weakTrend ? (trendState.higherWeak ? 16 : 8) : 0;
  const riskPenalty =
    derivatives +
    kimchiRisk +
    liquidity +
    largeTrade +
    options +
    (overheat ? 10 : 0) +
    weakTrendPenalty +
    (trendState.shortWeak && trendState.higherWeak ? 8 : 0);
  const marketStrength = (fearGreed - 50) * 0.2 + trendStrength + altParticipationBonus + liquidityStrength + largeTradeStrength + optionsStrength;
  const readinessScore = roundedScore(50 + marketStrength - riskPenalty);
  const topRisk = riskLabel({ weakTrend, constructiveTrend, btcChange, overheat, derivatives, kimchiRisk, liquidity, largeTrade, options });

  const leadership = leadershipFor({
    constructiveTrend,
    weakTrend,
    btcChange,
    participationRatio: stats.participationRatio,
    strongAltCount: stats.strongCount,
    volumeBackedCount: stats.volumeBackedCount,
    dominance
  });

  const direction: CoinHomeDirection =
    derivatives >= 24 || overheat ? "흔들림 주의" : weakTrend ? "하락 쪽" : constructiveTrend ? "상승 쪽" : "관망하기";

  const broadAltParticipation = stats.participationRatio >= 0.6 && stats.volumeBackedCount >= 2;
  const strongUpsideSetup =
    readinessScore >= 80 &&
    constructiveTrend &&
    !trendState.higherWeak &&
    broadAltParticipation &&
    derivatives < 14 &&
    liquidity < 8 &&
    largeTrade < 8 &&
    options < 8 &&
    !overheat &&
    topRisk === "큰 경고 없음";
  const clearDownsideSetup = weakTrend && (btcChange <= -2 || (trendState.higherWeak && (readinessScore <= 35 || stats.participationRatio < 0.45)));
  const unstableSetup = derivatives >= 28 || readinessScore <= 10 || (overheat && readinessScore < 55);

  const state: CoinHomeDecisionState = clearDownsideSetup
    ? "하락 위험 큼"
    : unstableSetup
      ? "크게 흔들림"
      : strongUpsideSetup
        ? "상승 가능성 높음"
        : readinessScore >= 45
          ? "조금 더 지켜보기"
          : "관망하기";

  const reason =
    leadership === "알트도 강함"
      ? "BTC가 버티는 동안 알트도 같이 움직이는 구간입니다."
      : leadership === "BTC 중심"
        ? "BTC가 시장을 이끌고 알트는 아직 덜 따라오는 구간입니다."
        : leadership === "위험 줄이기"
          ? "BTC가 약해 먼저 조심해야 하는 구간입니다."
          : "BTC와 알트 흐름이 섞여 있어 한쪽으로 단정하기 어렵습니다.";

  return {
    state,
    readinessScore,
    direction,
    leadership,
    topRisk,
    nextCondition: nextConditionFor(state, leadership, topRisk),
    reason,
    scoreLabel: "상승 가능성 점수",
    scoreDetail: "높을수록 시장이 상승 쪽으로 움직일 가능성이 좋아 보입니다. 낮으면 관망하거나 하락 위험을 먼저 봅니다."
  };
}
