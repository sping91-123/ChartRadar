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

export type CoinHomeDecisionState = "관망" | "조건 대기" | "상방 추적 가능" | "하방 압력 우세" | "변동성 경계";
export type CoinHomeDirection = "상방 우세" | "하방 압력" | "관망" | "변동성 주의";
export type CoinHomeLeadership = "BTC 우세" | "알트 순환" | "혼조" | "위험 회피";

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
  if (weakTrend) return "BTC 하락 추세 지속";
  if (derivatives >= 20) return "펀딩비/롱숏 쏠림";
  if (overheat) return "과열 확인";
  if (kimchiRisk >= 7) return "김프/환율 영향";
  return "확인 조건 대기";
}

function nextConditionFor(state: CoinHomeDecisionState, leadership: CoinHomeLeadership, topRisk: string) {
  if (state === "하방 압력 우세") return "숏 관점은 반등 실패와 1시간 하락 추세 유지 여부를 확인합니다.";
  if (state === "변동성 경계") return `${topRisk}가 완화되는지보다, 롱/숏 기준선이 흔들리지 않는지 먼저 확인합니다.`;
  if (leadership === "알트 순환") return "BTC가 무너지지 않는 상태에서 알트 거래대금이 유지되는지 확인합니다.";
  if (leadership === "BTC 우세") return "BTC 추세 유지와 알트 참여 확산 여부를 함께 확인합니다.";
  if (state === "상방 추적 가능") return "롱 관점은 눌림 후 상방 추세 유지와 거래대금 동반 여부를 확인합니다.";
  return "BTC 추세와 주요 이벤트 전후 변동성을 먼저 확인합니다.";
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
  if (weakTrend && participationRatio < 0.45) return "위험 회피";
  if (constructiveTrend && participationRatio >= 0.55 && strongAltCount >= 2 && volumeBackedCount >= 2) return "알트 순환";
  if (constructiveTrend && btcChange > 0 && participationRatio < 0.5) return "BTC 우세";
  if (btcChange > 1.5 && participationRatio < 0.45) return "BTC 우세";
  if (participationRatio >= 0.65 && (dominance === null || dominance === undefined || dominance < 58)) return "알트 순환";
  return "혼조";
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
  const readinessScore = Math.round(clamp(50 + marketStrength - riskPenalty, 0, 100));
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
    derivatives >= 24 || overheat ? "변동성 주의" : weakTrend ? "하방 압력" : constructiveTrend ? "상방 우세" : "관망";

  const state: CoinHomeDecisionState = weakTrend
    ? "하방 압력 우세"
    : derivatives >= 24 || overheat || readinessScore < 30
      ? "변동성 경계"
      : readinessScore >= 70 && topRisk === "확인 조건 대기"
        ? "상방 추적 가능"
        : readinessScore >= 50
          ? "조건 대기"
          : "관망";

  const reason =
    leadership === "알트 순환"
      ? "BTC가 무너지지 않는 가운데 알트 참여가 확산되는지 보는 구간입니다."
      : leadership === "BTC 우세"
        ? "BTC가 시장 흐름을 이끌고 알트 참여는 제한적인 구간입니다."
        : leadership === "위험 회피"
          ? "BTC 약세와 리스크 지표가 먼저 보이는 구간입니다."
          : "BTC와 알트 흐름이 엇갈려 확인 조건이 필요한 구간입니다.";

  return {
    state,
    readinessScore,
    direction,
    leadership,
    topRisk,
    nextCondition: nextConditionFor(state, leadership, topRisk),
    reason,
    scoreLabel: "방향 추적 준비도",
    scoreDetail: "롱/숏 어느 쪽 조건이 더 선명한지 보는 0~100점입니다. 0점은 방향 근거보다 변동성이나 추세 이탈 확인이 우선이라는 뜻입니다."
  };
}
