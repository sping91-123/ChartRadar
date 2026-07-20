import type { Candle, DirectionState, MarketRegime, TimeframeAnalysis } from "@/lib/marketAnalysis";
import type { LargeTradeFlowReport, LargeTradeSide } from "@/lib/largeTradeFlow";
import type { LiquidationPressureReport, LiquidationPressureSide } from "@/lib/liquidationPressure";

export const perpetualDecisionEngineVersion = "perpetual-v1.0.0";

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

export interface PerpetualDecisionEvidence {
  timeframe: "15m" | "1h" | "4h";
  label: string;
  structure: DirectionState;
  transition: DirectionState;
  score: number;
  regime: MarketRegime;
  observedAt: string;
  closedPrice: number;
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
  summary: {
    state: DecisionState;
    headline: string;
    topRisk: string;
    reasons: [string, string];
    primaryCondition: MonitorCondition;
  };
  pro?: {
    confirmationConditions: MonitorCondition[];
    invalidationConditions: MonitorCondition[];
    multiTimeframeEvidence: PerpetualDecisionEvidence[];
    pressure: {
      dominantSide: LiquidationPressureSide;
      grade: LiquidationPressureReport["grade"];
      upsideShortPressure: number;
      downsideLongPressure: number;
      summary: string;
    } | null;
    flow: {
      dominantSide: LargeTradeSide;
      grade: LargeTradeFlowReport["grade"];
      imbalancePercent: number;
      largeTradeCount: number;
      totalLargeNotionalUsd: number;
      summary: string;
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
  if (direction === "bullish") return "상방";
  if (direction === "bearish") return "하방";
  return "혼조";
}

function conditionId(
  asset: PerpetualAsset,
  timeframe: MonitorCondition["timeframe"],
  role: MonitorConditionRole,
  kind: MonitorConditionKind,
  threshold: number | null
) {
  const normalizedThreshold = threshold === null ? "state" : Math.round(threshold / tickSizes[asset]);
  return [perpetualDecisionEngineVersion, asset, timeframe, role, kind, normalizedThreshold].join(":");
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
    label: `${timeframeLabels[timeframe]} 확정 종가 ${normalized.toLocaleString("ko-KR")} ${direction === "above" ? "상향 확인" : "하향 확인"}`,
    threshold: normalized,
    expiresAt: addHours(generatedAt, hours)
  };
}

function stateChangeCondition(
  asset: PerpetualAsset,
  generatedAt: string,
  baselineState: DecisionState
): MonitorCondition {
  return {
    id: conditionId(asset, "15m", "primary", "decision_state_change", null),
    kind: "decision_state_change",
    role: "primary",
    timeframe: "15m",
    label: "데이터와 구조가 정상화되어 위험 상태가 바뀌는지 확인",
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
      ? "상방 구조가 확인 중이지만 유지 조건을 먼저 봅니다."
      : state === "downside_watch"
        ? "하방 구조가 확인 중이지만 이탈 지속 여부를 먼저 봅니다."
        : state === "risk"
          ? "구조와 체결 근거가 엇갈려 판단 강도를 낮춥니다."
          : "단기와 상위 구조가 섞여 있어 범위 확인이 먼저입니다.");

  const topRisk =
    quality !== "ready"
      ? "데이터 품질이 회복되기 전에는 조건 감시를 시작하지 않습니다."
      : flowConflict
        ? "15분 구조와 큰 체결 방향이 반대라 첫 움직임이 되돌려질 수 있습니다."
        : timeframeConflict
          ? "15분과 상위 시간대 구조가 반대라 변동성이 커질 수 있습니다."
          : input.pressure?.grade === "extreme"
            ? "청산 압력이 매우 높아 짧은 시간에 가격 변동이 커질 수 있습니다."
            : primary.analysis.condition.volatilityState === "expanded"
              ? "15분 변동폭이 확대되어 한 번의 가격 확인만으로 판단하기 어렵습니다."
              : "확인 조건 전에 가격을 추격하면 현재 판단이 빠르게 무효화될 수 있습니다.";

  const reasons: [string, string] = [
    `15분 구조는 ${structureLabel(primary.analysis.msb)}, 1시간·4시간 구조는 ${structureLabel(hourly.analysis.msb)}·${structureLabel(fourHourly.analysis.msb)}입니다.`,
    input.flow && input.pressure
      ? `큰 체결은 ${input.flow.dominantSide === "buy" ? "매수" : input.flow.dominantSide === "sell" ? "매도" : "균형"}, 청산 압력은 ${input.pressure.dominantSide === "upsideShorts" ? "위쪽" : input.pressure.dominantSide === "downsideLongs" ? "아래쪽" : "균형"} 쪽을 관찰합니다.`
      : "청산 압력 또는 큰 체결 근거가 일부 부족해 구조 신호의 확정 강도를 낮췄습니다."
  ];

  const primaryDirection: "above" | "below" =
    state === "downside_watch" || (state === "neutral" && totalScore < 0) ? "below" : "above";
  const primaryCondition = state === "risk"
    ? stateChangeCondition(input.asset, input.generatedAt, state)
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
    summary: {
      state,
      headline,
      topRisk,
      reasons,
      primaryCondition
    },
    pro: {
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
        closedPrice: observation.closedPrice
      })),
      pressure: input.pressure
        ? {
            dominantSide: input.pressure.dominantSide,
            grade: input.pressure.grade,
            upsideShortPressure: input.pressure.upsideShortPressure,
            downsideLongPressure: input.pressure.downsideLongPressure,
            summary: input.pressure.summary
          }
        : null,
      flow: input.flow
        ? {
            dominantSide: input.flow.dominantSide,
            grade: input.flow.grade,
            imbalancePercent: input.flow.imbalancePercent,
            largeTradeCount: input.flow.largeTradeCount,
            totalLargeNotionalUsd: input.flow.totalLargeNotionalUsd,
            summary: input.flow.summary
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
