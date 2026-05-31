import type { CoinMarketMetricsPayload } from "@/lib/coinMarketMetrics";
import type { LiquidationPressureReport } from "@/lib/liquidationPressure";
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
  marketMetrics: CoinMarketMetricsPayload | null;
  btcFunding: LiquidationPressureReport | null;
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
  const gradeRisk = report.grade === "extreme" ? 24 : report.grade === "heated" ? 16 : report.grade === "normal" ? 7 : 0;
  const longShortRatio = report.globalLongShort.ratio;
  const ratioRisk = longShortRatio && Number.isFinite(longShortRatio) ? Math.min(Math.abs(longShortRatio - 1) * 12, 12) : 0;
  const fundingRisk = report.fundingRatePercent && Number.isFinite(report.fundingRatePercent) ? Math.min(Math.abs(report.fundingRatePercent) * 650, 12) : 0;
  return gradeRisk + ratioRisk + fundingRisk;
}

function kimchiFxRisk(metrics: CoinMarketMetricsPayload | null) {
  const kimchi = metrics?.kimchiPremiumPercent;
  const kimchiRisk = kimchi && Number.isFinite(kimchi) ? Math.min(Math.abs(kimchi) * 2.5, 12) : 0;
  return kimchiRisk;
}

function riskLabel({
  weakTrend,
  constructiveTrend,
  btcChange,
  overheat,
  derivatives,
  kimchiRisk
}: {
  weakTrend: boolean;
  constructiveTrend: boolean;
  btcChange: number;
  overheat: boolean;
  derivatives: number;
  kimchiRisk: number;
}) {
  if (weakTrend && (constructiveTrend || btcChange <= -2.5)) return "BTC 상승 추세 이탈";
  if (weakTrend) return "BTC 약세 계속";
  if (derivatives >= 20) return "선물 쏠림 큼";
  if (overheat) return "가격 과열";
  if (kimchiRisk >= 7) return "김프/환율 부담";
  return "큰 경고 없음";
}

function nextConditionFor(state: CoinHomeDecisionState, leadership: CoinHomeLeadership, topRisk: string) {
  if (state === "하락 위험 큼") return "반등이 바로 꺾이는지 봅니다.";
  if (state === "크게 흔들림") return topRisk === "큰 경고 없음" ? "가격 흔들림이 잦아드는지 봅니다." : `${topRisk}이 줄어드는지 봅니다.`;
  if (leadership === "알트도 강함") return "BTC가 버티고 알트 거래대금이 계속 붙는지 봅니다.";
  if (leadership === "BTC 중심") return "BTC 상승이 이어지고 알트가 따라오는지 봅니다.";
  if (state === "상승 가능성 높음") return "눌림 뒤 다시 오르는지 봅니다.";
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
  const constructiveTrend = trendIsConstructive(input.technical, btcChange);
  const weakTrend = trendIsWeak(input.technical, btcChange);
  const derivatives = derivativeRisk(input.btcFunding);
  const kimchiRisk = kimchiFxRisk(input.marketMetrics);
  const overheat = fearGreed >= 78 || btcChange >= 5 || stats.strongCount >= 4;

  const altParticipationBonus =
    stats.participationRatio >= 0.65 ? 12 : stats.participationRatio >= 0.5 ? 7 : stats.participationRatio >= 0.35 ? 2 : -5;
  const marketStrength = (fearGreed - 50) * 0.22 + trendBias(input.technical) + altParticipationBonus;
  const riskPenalty = derivatives + kimchiRisk + (overheat ? 10 : 0) + (weakTrend ? 18 : 0);
  const readinessScore = roundedScore(50 + marketStrength - riskPenalty);
  const topRisk = riskLabel({ weakTrend, constructiveTrend, btcChange, overheat, derivatives, kimchiRisk });

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

  const broadAltParticipation = stats.participationRatio >= 0.55 && stats.volumeBackedCount >= 2;
  const strongUpsideSetup =
    readinessScore >= 75 && constructiveTrend && broadAltParticipation && derivatives < 16 && !overheat && topRisk === "큰 경고 없음";
  const clearDownsideSetup = weakTrend && (btcChange <= -1.5 || readinessScore <= 35 || stats.participationRatio < 0.35);
  const unstableSetup = derivatives >= 28 || readinessScore <= 25 || (overheat && readinessScore < 60);

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
