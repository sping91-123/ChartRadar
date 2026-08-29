import type { MarketCondition } from "@/lib/marketAnalysis";

export const perpetualAnalysisPerspectives = [
  {
    id: "combined",
    label: "통합 판단",
    shortLabel: "통합",
    description: "여러 시간대 구조·포지션·큰 체결을 합쳐 지금 볼 조건을 정리합니다."
  },
  {
    id: "ict",
    label: "ICT 구조",
    shortLabel: "ICT",
    description: "MSS·MSB·CHoCH 흐름을 보고, Pro에서는 OB·FVG·OTE의 정확한 가격까지 확인합니다."
  },
  {
    id: "technical",
    label: "기술지표",
    shortLabel: "기술",
    description: "RSI·MACD·추세·변동성은 통합 판단을 보조하는 참고값입니다."
  }
] as const;

export type PerpetualAnalysisPerspective = (typeof perpetualAnalysisPerspectives)[number]["id"];

export type PerpetualPublicTechnicalEvidence = Pick<
  MarketCondition,
  | "regime"
  | "rsi14"
  | "rsiState"
  | "macdState"
  | "emaStack"
  | "emaSlope"
  | "adx14"
  | "dmiState"
  | "supertrendDirection"
  | "atrPercent"
  | "volatilityState"
  | "volumeRatio"
  | "volumeState"
  | "bollingerPosition"
> & {
  timeframe: "15m";
  role: "cross_check";
  observedAt: string;
  closedPrice: number;
};

export function buildPublicTechnicalEvidence(
  condition: MarketCondition,
  observedAt: string,
  closedPrice: number
): PerpetualPublicTechnicalEvidence {
  return {
    timeframe: "15m",
    role: "cross_check",
    observedAt,
    closedPrice,
    regime: condition.regime,
    rsi14: condition.rsi14,
    rsiState: condition.rsiState,
    macdState: condition.macdState,
    emaStack: condition.emaStack,
    emaSlope: condition.emaSlope,
    adx14: condition.adx14,
    dmiState: condition.dmiState,
    supertrendDirection: condition.supertrendDirection,
    atrPercent: condition.atrPercent,
    volatilityState: condition.volatilityState,
    volumeRatio: condition.volumeRatio,
    volumeState: condition.volumeState,
    bollingerPosition: condition.bollingerPosition
  };
}

export function hasCompletePerpetualTechnicalDetails(
  pro: { technicalDetailVersion?: 1 } | null | undefined
) {
  return pro?.technicalDetailVersion === 1;
}
