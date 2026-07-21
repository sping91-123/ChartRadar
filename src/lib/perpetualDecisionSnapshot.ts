import type { Candle, DirectionState, MarketRegime, TimeframeAnalysis } from "@/lib/marketAnalysis";
import type { LargeTradeFlowReport, LargeTradeSide } from "@/lib/largeTradeFlow";
import type { LiquidationPressureReport, LiquidationPressureSide } from "@/lib/liquidationPressure";

export const perpetualDecisionEngineVersion = "perpetual-v1.1.0";
// Monitor IDs remain stable across the additive evidence-contract upgrade so existing alerts keep working.
export const perpetualMonitorConditionVersion = "perpetual-v1.0.0";

export type PerpetualAsset = "btc" | "eth";
export type PerpetualSymbol = "BTCUSDT" | "ETHUSDT";
export type SnapshotQuality = "ready" | "partial" | "stale" | "unavailable";
export type SourceQuality = SnapshotQuality;
export type DecisionState = "neutral" | "upside_watch" | "downside_watch" | "risk";
export type MonitorConditionKind =
  | "price_cross_above"
  | "price_cross_below"
  | "pressure_state_change"
  | "decision_state_change";
export type MonitorConditionRole = "primary" | "confirmation" | "invalidation";

export interface SourceStatus {
  status: SourceQuality;
  observedAt: string | null;
  detail: string;
}

export interface MonitorCondition {
  id: string;
  kind: MonitorConditionKind;
  role: MonitorConditionRole;
  timeframe: "15m" | "1h" | "4h";
  label: string;
  threshold: number | null;
  baselineState?: DecisionState;
  targetState?: DecisionState;
  baselinePressure?: LiquidationPressureSide;
  targetPressure?: LiquidationPressureSide;
  expiresAt: string;
}

export interface PerpetualTimedLevel {
  direction: "bullish" | "bearish";
  level: number;
  occurredAt: string | null;
  ageBars: number | null;
}

export interface PerpetualPriceZone {
  direction: "bullish" | "bearish";
  top: number;
  bottom: number;
  occurredAt: string | null;
  ageBars: number | null;
  isInside: boolean;
  state?: "fvg" | "ifvg";
}

export interface PerpetualEvidenceDetails {
  events: {
    msb: PerpetualTimedLevel | null;
    choch: PerpetualTimedLevel | null;
    sweep: PerpetualTimedLevel | null;
    cisd: PerpetualTimedLevel | null;
  };
  zones: {
    orderBlock: PerpetualPriceZone | null;
    fvg: PerpetualPriceZone | null;
  };
  location: {
    premiumDiscount: TimeframeAnalysis["premiumDiscount"];
    dealingRange: TimeframeAnalysis["dealingRange"];
    poc: TimeframeAnalysis["volumeProfile"];
    oteZone: TimeframeAnalysis["oteZone"];
    oteLevels: TimeframeAnalysis["oteLevels"];
  };
  indicators: Pick<
    TimeframeAnalysis["condition"],
    "rsi14" | "rsiState" | "macdState" | "atrPercent" | "volatilityState" | "volumeRatio" | "volumeState" | "bollingerPosition"
  >;
}

export interface PerpetualDecisionEvidence {
  timeframe: "15m" | "1h" | "4h";
  label: string;
  structure: DirectionState;
  transition: DirectionState;
  score: number;
  regime: MarketRegime;
  observedAt: string;
  closedPrice: number;
  details?: PerpetualEvidenceDetails;
}

export interface SnapshotChange {
  from: DecisionState;
  to: DecisionState;
  changedAt: string;
}

export interface PerpetualDecisionSnapshot {
  id: string;
  fingerprint: string;
  engineVersion: string;
  asset: PerpetualAsset;
  symbol: PerpetualSymbol;
  exchange: "binance";
  primaryTimeframe: "15m";
  contextTimeframes: ["1h", "4h"];
  generatedAt: string;
  expiresAt: string;
  quality: SnapshotQuality;
  price: number;
  chart: {
    timeframe: "15m";
    candles: Candle[];
  };
  sourceStatus: {
    candles: SourceStatus;
    pressure: SourceStatus;
    flow: SourceStatus;
  };
  publicEvidence?: {
    timeframe: "15m";
    structure: DirectionState;
    transition: DirectionState;
    pressure: Pick<LiquidationPressureReport, "dominantSide" | "grade" | "summary"> | null;
    flow: Pick<LargeTradeFlowReport, "dominantSide" | "grade" | "summary"> | null;
    previousChange?: SnapshotChange | null;
  };
  summary: {
    state: DecisionState;
    headline: string;
    topRisk: string;
    reasons: [string, string];
    primaryCondition: MonitorCondition;
  };
  pro?: {
    detailVersion?: 1;
    confirmationConditions: MonitorCondition[];
    invalidationConditions: MonitorCondition[];
    multiTimeframeEvidence: PerpetualDecisionEvidence[];
    pressure: {
      dominantSide: LiquidationPressureSide;
      grade: LiquidationPressureReport["grade"];
      upsideShortPressure: number;
      downsideLongPressure: number;
      summary: string;
      details?: {
        observedAt: string;
        markPrice: number;
        indexPrice: number | null;
        fundingRatePercent: number | null;
        nextFundingTime: string | null;
        openInterestValue: number | null;
        openInterestChangePercent: number | null;
        globalLongShort: LiquidationPressureReport["globalLongShort"];
        topAccountLongShort: LiquidationPressureReport["topAccountLongShort"];
        topPositionLongShort: LiquidationPressureReport["topPositionLongShort"];
        takerFlow: LiquidationPressureReport["takerFlow"];
        bands: LiquidationPressureReport["bands"];
        warning: string;
      };
    } | null;
    flow: {
      dominantSide: LargeTradeSide;
      grade: LargeTradeFlowReport["grade"];
      imbalancePercent: number;
      largeTradeCount: number;
      totalLargeNotionalUsd: number;
      summary: string;
      details?: {
        observedAt: string;
        thresholdUsd: number;
        windowMinutes: number | null;
        tradeCount: number;
        buyNotionalUsd: number;
        sellNotionalUsd: number;
        buyCount: number;
        sellCount: number;
        anomalyLevel: LargeTradeFlowReport["anomalyLevel"];
        anomalyScore: number;
        trigger: string;
        topTrades: LargeTradeFlowReport["topTrades"];
      };
    } | null;
    previousChange: SnapshotChange | null;
  };
}

export interface PerpetualTimeframeObservation {
  timeframe: "15m" | "1h" | "4h";
  analysis: TimeframeAnalysis;
  observedAt: string;
  closedPrice: number;
  rangeHigh: number;
  rangeLow: number;
  candleTimes?: number[];
}

export interface BuildPerpetualDecisionInput {
  id: string;
  fingerprint: string;
  asset: PerpetualAsset;
  price: number;
  chartCandles: Candle[];
  generatedAt: string;
  sourceStatus: PerpetualDecisionSnapshot["sourceStatus"];
  timeframes: [PerpetualTimeframeObservation, PerpetualTimeframeObservation, PerpetualTimeframeObservation];
  pressure: LiquidationPressureReport | null;
  flow: LargeTradeFlowReport | null;
  previousSnapshot?: Pick<PerpetualDecisionSnapshot, "summary" | "generatedAt"> | null;
}

const timeframeLabels: Record<PerpetualTimeframeObservation["timeframe"], string> = {
  "15m": "15분",
  "1h": "1시간",
  "4h": "4시간"
};

const tickSizes: Record<PerpetualAsset, number> = {
  btc: 0.1,
  eth: 0.01
};

function addHours(iso: string, hours: number) {
  return new Date(new Date(iso).getTime() + hours * 60 * 60 * 1000).toISOString();
}

function directionValue(direction: DirectionState) {
  if (direction === "bullish") return 1;
  if (direction === "bearish") return -1;
  return 0;
}

function structureValue(observation: PerpetualTimeframeObservation, weight: number) {
  return (directionValue(observation.analysis.msb) + directionValue(observation.analysis.choch) * 0.55) * weight;
}

function structureLabel(direction: DirectionState) {
  if (direction === "bullish") return "오르는 흐름";
  if (direction === "bearish") return "내리는 흐름";
  return "방향이 뚜렷하지 않음";
}

function occurredAt(candleTimes: number[] | undefined, index: number) {
  const raw = candleTimes?.[index];
  if (!Number.isFinite(raw)) return null;
  const milliseconds = Number(raw) > 10_000_000_000 ? Number(raw) : Number(raw) * 1000;
  const parsed = new Date(milliseconds);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function ageBars(candleTimes: number[] | undefined, index: number, fallback?: number) {
  if (Number.isFinite(fallback)) return Math.max(0, Number(fallback));
  if (!candleTimes?.length || !Number.isInteger(index) || index < 0 || index >= candleTimes.length) return null;
  return Math.max(0, candleTimes.length - 1 - index);
}

function timedLevel(
  event: { direction: "bullish" | "bearish"; level: number; index: number; age?: number } | null,
  candleTimes?: number[]
): PerpetualTimedLevel | null {
  if (!event || !Number.isFinite(event.level)) return null;
  return {
    direction: event.direction,
    level: event.level,
    occurredAt: occurredAt(candleTimes, event.index),
    ageBars: ageBars(candleTimes, event.index, event.age)
  };
}

function priceZone(
  zone: {
    direction: "bullish" | "bearish";
    top: number;
    bottom: number;
    originIndex: number;
    age: number;
    isInside: boolean;
    state?: "fvg" | "ifvg";
  } | null,
  candleTimes?: number[]
): PerpetualPriceZone | null {
  if (!zone || !Number.isFinite(zone.top) || !Number.isFinite(zone.bottom)) return null;
  return {
    direction: zone.direction,
    top: zone.top,
    bottom: zone.bottom,
    occurredAt: occurredAt(candleTimes, zone.originIndex),
    ageBars: ageBars(candleTimes, zone.originIndex, zone.age),
    isInside: zone.isInside,
    ...(zone.state ? { state: zone.state } : {})
  };
}

function evidenceDetails(observation: PerpetualTimeframeObservation): PerpetualEvidenceDetails {
  const { analysis, candleTimes } = observation;
  return {
    events: {
      msb: timedLevel(analysis.latestMsbEvent, candleTimes),
      choch: timedLevel(analysis.latestChochEvent, candleTimes),
      sweep: timedLevel(analysis.latestSweep, candleTimes),
      cisd: timedLevel(analysis.latestCisd, candleTimes)
    },
    zones: {
      orderBlock: priceZone(analysis.latestOb, candleTimes),
      fvg: priceZone(analysis.latestFvg, candleTimes)
    },
    location: {
      premiumDiscount: analysis.premiumDiscount,
      dealingRange: analysis.dealingRange,
      poc: analysis.volumeProfile,
      oteZone: analysis.oteZone,
      oteLevels: analysis.oteLevels
    },
    indicators: {
      rsi14: analysis.condition.rsi14,
      rsiState: analysis.condition.rsiState,
      macdState: analysis.condition.macdState,
      atrPercent: analysis.condition.atrPercent,
      volatilityState: analysis.condition.volatilityState,
      volumeRatio: analysis.condition.volumeRatio,
      volumeState: analysis.condition.volumeState,
      bollingerPosition: analysis.condition.bollingerPosition
    }
  };
}

function conditionId(
  asset: PerpetualAsset,
  timeframe: MonitorCondition["timeframe"],
  role: MonitorConditionRole,
  kind: MonitorConditionKind,
  threshold: number | null
) {
  const normalizedThreshold = threshold === null ? "state" : Math.round(threshold / tickSizes[asset]);
  return [perpetualMonitorConditionVersion, asset, timeframe, role, kind, normalizedThreshold].join(":");
}

function priceCondition({
  asset,
  generatedAt,
  timeframe,
  role,
  direction,
  threshold
}: {
  asset: PerpetualAsset;
  generatedAt: string;
  timeframe: MonitorCondition["timeframe"];
  role: MonitorConditionRole;
  direction: "above" | "below";
  threshold: number;
}): MonitorCondition {
  const kind = direction === "above" ? "price_cross_above" : "price_cross_below";
  const hours = timeframe === "15m" ? 24 : timeframe === "1h" ? 72 : 14 * 24;
  const normalized = Number(threshold.toFixed(asset === "btc" ? 1 : 2));
  return {
    id: conditionId(asset, timeframe, role, kind, normalized),
    kind,
    role,
    timeframe,
    label: `${normalized.toLocaleString("ko-KR")} ${direction === "above" ? "위" : "아래"}에서 ${timeframeLabels[timeframe]} 봉이 끝나는지 확인`,
    threshold: normalized,
    expiresAt: addHours(generatedAt, hours)
  };
}

function stateChangeCondition(
  asset: PerpetualAsset,
  generatedAt: string,
  baselineState: DecisionState,
  label = "빠진 데이터가 다시 들어오고 방향 신호가 한쪽으로 모이는지 확인"
): MonitorCondition {
  return {
    id: conditionId(asset, "15m", "primary", "decision_state_change", null),
    kind: "decision_state_change",
    role: "primary",
    timeframe: "15m",
    label,
    threshold: null,
    baselineState,
    expiresAt: addHours(generatedAt, 24)
  };
}

function flowValue(flow: LargeTradeFlowReport | null, status: SourceStatus) {
  if (!flow || status.status === "unavailable") return 0;
  const strength = flow.grade === "extreme" ? 1.7 : flow.grade === "heated" ? 1.4 : flow.grade === "normal" ? 1 : 0.45;
  if (flow.dominantSide === "buy") return strength;
  if (flow.dominantSide === "sell") return -strength;
  return 0;
}

function pressureValue(pressure: LiquidationPressureReport | null, status: SourceStatus) {
  if (!pressure || status.status === "unavailable") return 0;
  const strength = pressure.grade === "extreme" ? 1.1 : pressure.grade === "heated" ? 0.8 : 0.45;
  if (pressure.dominantSide === "upsideShorts") return strength;
  if (pressure.dominantSide === "downsideLongs") return -strength;
  return 0;
}

function publicPressureSummary(pressure: LiquidationPressureReport) {
  if (pressure.dominantSide === "upsideShorts") {
    return "가격 하락에 건 숏 포지션이 더 몰려 있어 가격이 오르면 강제 청산이 움직임을 키울 수 있어요.";
  }
  if (pressure.dominantSide === "downsideLongs") {
    return "가격 상승에 건 롱 포지션이 더 몰려 있어 가격이 내리면 강제 청산이 움직임을 키울 수 있어요.";
  }
  return "롱과 숏의 쏠림이 비슷해 강제 청산이 한쪽 방향을 강하게 밀고 있지는 않아요.";
}

function publicFlowSummary(flow: LargeTradeFlowReport) {
  if (flow.dominantSide === "buy") return "최근 큰 금액 체결은 매수가 더 많아 위쪽 움직임을 확인하는 근거가 됩니다.";
  if (flow.dominantSide === "sell") return "최근 큰 금액 체결은 매도가 더 많아 아래쪽 움직임을 확인하는 근거가 됩니다.";
  return "최근 큰 금액 매수와 매도가 비슷해 체결만으로는 방향을 정하기 어렵습니다.";
}

export function resolveSnapshotQuality(statuses: PerpetualDecisionSnapshot["sourceStatus"]): SnapshotQuality {
  const values = Object.values(statuses).map((status) => status.status);
  if (values.every((status) => status === "unavailable")) return "unavailable";
  if (values.some((status) => status === "unavailable" || status === "partial")) return "partial";
  if (values.some((status) => status === "stale")) return "stale";
  return "ready";
}

function nextThreshold(
  asset: PerpetualAsset,
  price: number,
  observation: PerpetualTimeframeObservation,
  direction: "above" | "below"
) {
  const candidates = direction === "above"
    ? [
        observation.analysis.buySideLiquidity?.level,
        observation.analysis.condition.donchianHigh,
        observation.analysis.latestMsbEvent?.level,
        observation.analysis.latestChochEvent?.level,
        observation.rangeHigh
      ]
    : [
        observation.analysis.sellSideLiquidity?.level,
        observation.analysis.condition.donchianLow,
        observation.analysis.latestMsbEvent?.level,
        observation.analysis.latestChochEvent?.level,
        observation.rangeLow
      ];
  const valid = candidates
    .filter((value): value is number => Number.isFinite(value))
    .filter((value) => (direction === "above" ? value > price : value < price))
    .sort((left, right) => (direction === "above" ? left - right : right - left));
  const fallback = direction === "above" ? price * 1.002 : price * 0.998;
  const value = valid[0] ?? fallback;
  const tick = tickSizes[asset];
  return Math.round(value / tick) * tick;
}

function qualityHeadline(quality: SnapshotQuality) {
  if (quality === "unavailable") return "필수 선물 데이터를 확인하지 못했습니다.";
  if (quality === "partial") return "일부 근거가 부족해 방향 판단을 보류합니다.";
  if (quality === "stale") return "데이터 시차가 커져 최신 상태를 다시 확인해야 합니다.";
  return null;
}

export function buildPerpetualDecisionSnapshot(input: BuildPerpetualDecisionInput): PerpetualDecisionSnapshot {
  const byTimeframe = new Map(input.timeframes.map((observation) => [observation.timeframe, observation]));
  const primary = byTimeframe.get("15m") ?? input.timeframes[0];
  const hourly = byTimeframe.get("1h") ?? input.timeframes[1];
  const fourHourly = byTimeframe.get("4h") ?? input.timeframes[2];
  const quality = resolveSnapshotQuality(input.sourceStatus);
  const structureScore = structureValue(primary, 1.7) + structureValue(hourly, 1.2) + structureValue(fourHourly, 1.35);
  const currentFlowValue = flowValue(input.flow, input.sourceStatus.flow);
  const currentPressureValue = pressureValue(input.pressure, input.sourceStatus.pressure);
  const totalScore = structureScore + currentFlowValue + currentPressureValue;
  const primarySide = directionValue(primary.analysis.msb) || directionValue(primary.analysis.choch);
  const higherSide = directionValue(hourly.analysis.msb) + directionValue(fourHourly.analysis.msb);
  const flowSide = Math.sign(currentFlowValue);
  const flowConflict = primarySide !== 0 && flowSide !== 0 && primarySide !== flowSide && Math.abs(input.flow?.imbalancePercent ?? 0) >= 20;
  const timeframeConflict = primarySide !== 0 && higherSide !== 0 && primarySide !== Math.sign(higherSide);

  let state: DecisionState;
  if (quality !== "ready" || flowConflict || (timeframeConflict && input.pressure?.grade === "extreme")) state = "risk";
  else if (totalScore >= 3.2) state = "upside_watch";
  else if (totalScore <= -3.2) state = "downside_watch";
  else state = "neutral";

  const safeHeadline = qualityHeadline(quality);
  const headline =
    safeHeadline ??
    (state === "upside_watch"
      ? "오르는 힘이 조금 더 강하지만 아직 확정된 흐름은 아닙니다."
      : state === "downside_watch"
        ? "내리는 힘이 조금 더 강하지만 아직 확정된 흐름은 아닙니다."
        : state === "risk"
          ? "가격 흐름과 큰 체결이 서로 달라 지금은 기다리는 구간입니다."
          : "한쪽 힘이 뚜렷하지 않아 다음 움직임을 기다리는 구간입니다.");

  const topRisk =
    quality !== "ready"
      ? "일부 데이터가 늦거나 비어 있어 현재 결론을 그대로 믿기 어렵습니다."
      : flowConflict
        ? "15분 가격 흐름과 큰 금액 체결이 반대라 첫 움직임이 되돌려질 수 있습니다."
        : timeframeConflict
          ? "15분 흐름과 1시간·4시간 흐름이 반대라 짧게 크게 흔들릴 수 있습니다."
          : input.pressure?.grade === "extreme"
            ? "한쪽 포지션이 많이 몰려 있어 급격한 반대 움직임이 나올 수 있습니다."
            : primary.analysis.condition.volatilityState === "expanded"
              ? "평소보다 움직임이 커 작은 변동에도 현재 해석이 자주 바뀔 수 있습니다."
              : "확인 가격에 닿기 전에 따라가면 되돌림에 흔들릴 수 있습니다.";

  const reasons: [string, string] = [
    `15분은 ${structureLabel(primary.analysis.msb)}, 1시간은 ${structureLabel(hourly.analysis.msb)}, 4시간은 ${structureLabel(fourHourly.analysis.msb)}입니다.`,
    input.flow && input.pressure
      ? `${publicFlowSummary(input.flow)} ${publicPressureSummary(input.pressure)}`
      : "몰린 포지션이나 큰 금액 체결 데이터가 부족해 차트 흐름만으로 단정하지 않습니다."
  ];

  const primaryDirection: "above" | "below" =
    state === "downside_watch" || (state === "neutral" && totalScore < 0) ? "below" : "above";
  const primaryCondition = state === "risk"
    ? stateChangeCondition(
        input.asset,
        input.generatedAt,
        state,
        quality === "ready"
          ? "15분 가격 흐름과 큰 금액 체결이 같은 방향으로 모이는지 확인"
          : "빠진 데이터가 다시 들어오고 방향 신호가 한쪽으로 모이는지 확인"
      )
    : priceCondition({
        asset: input.asset,
        generatedAt: input.generatedAt,
        timeframe: "15m",
        role: "primary",
        direction: primaryDirection,
        threshold: nextThreshold(input.asset, input.price, primary, primaryDirection)
      });

  const scenarioDirection: "above" | "below" = totalScore < 0 ? "below" : "above";
  const inverseDirection: "above" | "below" = scenarioDirection === "above" ? "below" : "above";
  const confirmationConditions = [
    priceCondition({
      asset: input.asset,
      generatedAt: input.generatedAt,
      timeframe: "1h",
      role: "confirmation",
      direction: scenarioDirection,
      threshold: nextThreshold(input.asset, input.price, hourly, scenarioDirection)
    })
  ];
  const invalidationConditions = [
    priceCondition({
      asset: input.asset,
      generatedAt: input.generatedAt,
      timeframe: "15m",
      role: "invalidation",
      direction: inverseDirection,
      threshold: nextThreshold(input.asset, input.price, primary, inverseDirection)
    }),
    priceCondition({
      asset: input.asset,
      generatedAt: input.generatedAt,
      timeframe: "4h",
      role: "invalidation",
      direction: inverseDirection,
      threshold: nextThreshold(input.asset, input.price, fourHourly, inverseDirection)
    })
  ];

  const previousChange = input.previousSnapshot && input.previousSnapshot.summary.state !== state
    ? {
        from: input.previousSnapshot.summary.state,
        to: state,
        changedAt: input.generatedAt
      }
    : null;

  return {
    id: input.id,
    fingerprint: input.fingerprint,
    engineVersion: perpetualDecisionEngineVersion,
    asset: input.asset,
    symbol: input.asset === "btc" ? "BTCUSDT" : "ETHUSDT",
    exchange: "binance",
    primaryTimeframe: "15m",
    contextTimeframes: ["1h", "4h"],
    generatedAt: input.generatedAt,
    expiresAt: addHours(input.generatedAt, 1 / 60),
    quality,
    price: input.price,
    chart: {
      timeframe: "15m",
      candles: input.chartCandles.slice(-96)
    },
    sourceStatus: input.sourceStatus,
    publicEvidence: {
      timeframe: "15m",
      structure: primary.analysis.msb,
      transition: primary.analysis.choch,
      pressure: input.pressure
        ? {
            dominantSide: input.pressure.dominantSide,
            grade: input.pressure.grade,
            summary: publicPressureSummary(input.pressure)
          }
        : null,
      flow: input.flow
        ? {
            dominantSide: input.flow.dominantSide,
            grade: input.flow.grade,
            summary: publicFlowSummary(input.flow)
          }
        : null,
      previousChange
    },
    summary: {
      state,
      headline,
      topRisk,
      reasons,
      primaryCondition
    },
    pro: {
      detailVersion: 1,
      confirmationConditions: quality === "ready" ? confirmationConditions : [],
      invalidationConditions: quality === "ready" ? invalidationConditions : [],
      multiTimeframeEvidence: input.timeframes.map((observation) => ({
        timeframe: observation.timeframe,
        label: timeframeLabels[observation.timeframe],
        structure: observation.analysis.msb,
        transition: observation.analysis.choch,
        score: observation.analysis.score,
        regime: observation.analysis.condition.regime,
        observedAt: observation.observedAt,
        closedPrice: observation.closedPrice,
        details: evidenceDetails(observation)
      })),
      pressure: input.pressure
        ? {
            dominantSide: input.pressure.dominantSide,
            grade: input.pressure.grade,
            upsideShortPressure: input.pressure.upsideShortPressure,
            downsideLongPressure: input.pressure.downsideLongPressure,
            summary: input.pressure.summary,
            details: {
              observedAt: new Date(input.pressure.updatedAt).toISOString(),
              markPrice: input.pressure.markPrice,
              indexPrice: input.pressure.indexPrice,
              fundingRatePercent: input.pressure.fundingRatePercent,
              nextFundingTime: input.pressure.nextFundingTime ? new Date(input.pressure.nextFundingTime).toISOString() : null,
              openInterestValue: input.pressure.openInterestValue,
              openInterestChangePercent: input.pressure.openInterestChangePercent,
              globalLongShort: input.pressure.globalLongShort,
              topAccountLongShort: input.pressure.topAccountLongShort,
              topPositionLongShort: input.pressure.topPositionLongShort,
              takerFlow: input.pressure.takerFlow,
              bands: input.pressure.bands,
              warning: input.pressure.warning
            }
          }
        : null,
      flow: input.flow
        ? {
            dominantSide: input.flow.dominantSide,
            grade: input.flow.grade,
            imbalancePercent: input.flow.imbalancePercent,
            largeTradeCount: input.flow.largeTradeCount,
            totalLargeNotionalUsd: input.flow.totalLargeNotionalUsd,
            summary: input.flow.summary,
            details: {
              observedAt: new Date(input.flow.updatedAt).toISOString(),
              thresholdUsd: input.flow.thresholdUsd,
              windowMinutes: input.flow.windowMinutes,
              tradeCount: input.flow.tradeCount,
              buyNotionalUsd: input.flow.buyNotionalUsd,
              sellNotionalUsd: input.flow.sellNotionalUsd,
              buyCount: input.flow.buyCount,
              sellCount: input.flow.sellCount,
              anomalyLevel: input.flow.anomalyLevel,
              anomalyScore: input.flow.anomalyScore,
              trigger: input.flow.trigger,
              topTrades: input.flow.topTrades.slice(0, 8)
            }
          }
        : null,
      previousChange
    }
  };
}

export function serializeBasicPerpetualSnapshot(snapshot: PerpetualDecisionSnapshot): PerpetualDecisionSnapshot {
  const { pro: _pro, ...basic } = snapshot;
  return basic;
}

export function serializeStoredPerpetualSnapshot(snapshot: PerpetualDecisionSnapshot): PerpetualDecisionSnapshot {
  const basic = serializeBasicPerpetualSnapshot(snapshot);
  return {
    ...basic,
    chart: {
      timeframe: basic.chart.timeframe,
      candles: []
    }
  };
}

export function findSnapshotCondition(snapshot: PerpetualDecisionSnapshot, conditionId: string, includePro: boolean) {
  if (snapshot.summary.primaryCondition.id === conditionId) return snapshot.summary.primaryCondition;
  if (!includePro || !snapshot.pro) return null;
  return [...snapshot.pro.confirmationConditions, ...snapshot.pro.invalidationConditions].find((condition) => condition.id === conditionId) ?? null;
}

export function isMonitorConditionMet(condition: MonitorCondition, snapshot: PerpetualDecisionSnapshot) {
  const closedPrice = snapshot.pro?.multiTimeframeEvidence.find(
    (evidence) => evidence.timeframe === condition.timeframe
  )?.closedPrice;
  if (condition.kind === "price_cross_above") {
    return condition.threshold !== null && typeof closedPrice === "number" && Number.isFinite(closedPrice) && closedPrice >= condition.threshold;
  }
  if (condition.kind === "price_cross_below") {
    return condition.threshold !== null && typeof closedPrice === "number" && Number.isFinite(closedPrice) && closedPrice <= condition.threshold;
  }
  if (condition.kind === "decision_state_change") {
    if (condition.targetState) return snapshot.summary.state === condition.targetState;
    return Boolean(condition.baselineState && snapshot.summary.state !== condition.baselineState);
  }
  const pressure = snapshot.pro?.pressure?.dominantSide;
  if (!pressure) return false;
  if (condition.targetPressure) return pressure === condition.targetPressure;
  return Boolean(condition.baselinePressure && pressure !== condition.baselinePressure);
}
