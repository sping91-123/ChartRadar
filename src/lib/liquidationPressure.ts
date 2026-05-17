// Binance 공개 파생상품 데이터를 청산 압력 보조값으로 변환하는 계산 모듈.
export type LiquidationPressureSide = "upsideShorts" | "downsideLongs" | "balanced";
export type LiquidationPressureGrade = "calm" | "normal" | "heated" | "extreme";

export interface LongShortSnapshot {
  longPercent: number | null;
  shortPercent: number | null;
  ratio: number | null;
}

export interface TakerFlowSnapshot {
  buyVolume: number | null;
  sellVolume: number | null;
  buyPercent: number | null;
  sellPercent: number | null;
}

export interface LiquidationBand {
  leverage: number;
  longLiquidationPrice: number;
  shortLiquidationPrice: number;
  distancePercent: number;
}

export interface LiquidationPressureReport {
  symbol: string;
  period: string;
  markPrice: number;
  indexPrice: number | null;
  fundingRatePercent: number | null;
  nextFundingTime: number | null;
  openInterestValue: number | null;
  openInterestChangePercent: number | null;
  globalLongShort: LongShortSnapshot;
  topAccountLongShort: LongShortSnapshot;
  topPositionLongShort: LongShortSnapshot;
  takerFlow: TakerFlowSnapshot;
  upsideShortPressure: number;
  downsideLongPressure: number;
  dominantSide: LiquidationPressureSide;
  grade: LiquidationPressureGrade;
  summary: string;
  warning: string;
  bands: LiquidationBand[];
  updatedAt: number;
}

export interface BuildLiquidationPressureInput {
  symbol: string;
  period: string;
  markPrice: number;
  indexPrice?: number | null;
  fundingRate?: number | null;
  nextFundingTime?: number | null;
  openInterestValue?: number | null;
  openInterestChangePercent?: number | null;
  globalLongShort?: LongShortSnapshot;
  topAccountLongShort?: LongShortSnapshot;
  topPositionLongShort?: LongShortSnapshot;
  takerFlow?: TakerFlowSnapshot;
  updatedAt?: number;
}

const fallbackLongShort: LongShortSnapshot = {
  longPercent: null,
  shortPercent: null,
  ratio: null
};

const fallbackTakerFlow: TakerFlowSnapshot = {
  buyVolume: null,
  sellVolume: null,
  buyPercent: null,
  sellPercent: null
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function safeNumber(value: number | null | undefined) {
  return Number.isFinite(value) ? Number(value) : null;
}

function crowdingScore(percent: number | null, weight: number) {
  if (percent === null) return 0;
  return Math.max(0, percent - 50) * weight;
}

function oiHeat(openInterestChangePercent: number | null, period: string) {
  if (openInterestChangePercent === null) return 0;
  const periodWeight = period === "5m" || period === "15m" ? 2.2 : period === "30m" || period === "1h" ? 2.8 : 3.4;
  return Math.min(Math.max(0, openInterestChangePercent), 8) * periodWeight;
}

function fundingHeat(fundingRatePercent: number | null, side: "long" | "short") {
  if (fundingRatePercent === null) return 0;
  const fundingBps = fundingRatePercent * 100;
  if (side === "long") return Math.max(0, fundingBps) * 2.2;
  return Math.max(0, -fundingBps) * 2.2;
}

function takerHeat(flow: TakerFlowSnapshot, side: "long" | "short") {
  if (side === "long") return Math.max(0, (flow.buyPercent ?? 50) - 50) * 0.65;
  return Math.max(0, (flow.sellPercent ?? 50) - 50) * 0.65;
}

function pressureGrade(maxPressure: number): LiquidationPressureGrade {
  if (maxPressure >= 75) return "extreme";
  if (maxPressure >= 55) return "heated";
  if (maxPressure >= 35) return "normal";
  return "calm";
}

function dominantSide(upsideShortPressure: number, downsideLongPressure: number): LiquidationPressureSide {
  if (upsideShortPressure > downsideLongPressure + 8) return "upsideShorts";
  if (downsideLongPressure > upsideShortPressure + 8) return "downsideLongs";
  return "balanced";
}

function buildBands(markPrice: number): LiquidationBand[] {
  return [50, 25, 10].map((leverage) => {
    const distancePercent = (100 / leverage) * 0.92;
    const distance = distancePercent / 100;

    return {
      leverage,
      longLiquidationPrice: markPrice * (1 - distance),
      shortLiquidationPrice: markPrice * (1 + distance),
      distancePercent
    };
  });
}

function summaryFor(side: LiquidationPressureSide, grade: LiquidationPressureGrade) {
  const gradeText =
    grade === "extreme" ? "매우 높습니다" : grade === "heated" ? "높아지고 있습니다" : grade === "normal" ? "보통 수준입니다" : "차분합니다";

  if (side === "upsideShorts") {
    return `숏 포지션 쏠림이 강해 위쪽 숏 청산 압력이 ${gradeText}. 저항 돌파나 숏 스퀴즈가 나오면 위쪽 변동성이 커질 수 있습니다.`;
  }

  if (side === "downsideLongs") {
    return `롱 포지션 쏠림이 강해 아래쪽 롱 청산 압력이 ${gradeText}. 지지 이탈이나 롱 스퀴즈가 나오면 아래쪽 변동성이 커질 수 있습니다.`;
  }

  return "롱과 숏 청산 압력이 비슷해 한쪽으로 크게 기울지 않았습니다. 방향보다 변동성 확대 여부를 먼저 확인하는 구간입니다.";
}

export function buildLiquidationPressureReport(input: BuildLiquidationPressureInput): LiquidationPressureReport {
  const markPrice = Math.max(0, input.markPrice);
  const globalLongShort = input.globalLongShort ?? fallbackLongShort;
  const topAccountLongShort = input.topAccountLongShort ?? fallbackLongShort;
  const topPositionLongShort = input.topPositionLongShort ?? fallbackLongShort;
  const takerFlow = input.takerFlow ?? fallbackTakerFlow;
  const fundingRatePercent = safeNumber(input.fundingRate) === null ? null : Number(input.fundingRate) * 100;
  const openInterestChangePercent = safeNumber(input.openInterestChangePercent);

  const downsideLongPressure = clamp(
    18 +
      crowdingScore(globalLongShort.longPercent, 1.1) +
      crowdingScore(topAccountLongShort.longPercent, 0.75) +
      crowdingScore(topPositionLongShort.longPercent, 0.9) +
      fundingHeat(fundingRatePercent, "long") +
      takerHeat(takerFlow, "long") +
      oiHeat(openInterestChangePercent, input.period)
  );

  const upsideShortPressure = clamp(
    18 +
      crowdingScore(globalLongShort.shortPercent, 1.1) +
      crowdingScore(topAccountLongShort.shortPercent, 0.75) +
      crowdingScore(topPositionLongShort.shortPercent, 0.9) +
      fundingHeat(fundingRatePercent, "short") +
      takerHeat(takerFlow, "short") +
      oiHeat(openInterestChangePercent, input.period)
  );

  const side = dominantSide(upsideShortPressure, downsideLongPressure);
  const grade = pressureGrade(Math.max(upsideShortPressure, downsideLongPressure));

  return {
    symbol: input.symbol,
    period: input.period,
    markPrice,
    indexPrice: safeNumber(input.indexPrice),
    fundingRatePercent,
    nextFundingTime: input.nextFundingTime ?? null,
    openInterestValue: safeNumber(input.openInterestValue),
    openInterestChangePercent,
    globalLongShort,
    topAccountLongShort,
    topPositionLongShort,
    takerFlow,
    upsideShortPressure: Math.round(upsideShortPressure),
    downsideLongPressure: Math.round(downsideLongPressure),
    dominantSide: side,
    grade,
    summary: summaryFor(side, grade),
    warning: "Binance 공개 데이터로 레버리지 쏠림과 변동성 압력을 추정합니다. 실제 청산맵처럼 단정하기보다 가격 반응과 함께 확인하세요.",
    bands: buildBands(markPrice),
    updatedAt: input.updatedAt ?? Date.now()
  };
}
