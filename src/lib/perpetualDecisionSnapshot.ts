import type { Candle, DirectionState, MarketRegime, TimeframeAnalysis } from "@/lib/marketAnalysis";
import type { ConfirmedCommonRangeOteV1 } from "@/lib/confirmedCommonRangeOte";
import type { LargeTradeFlowReport, LargeTradeSide } from "@/lib/largeTradeFlow";
import type { LiquidationPressureReport, LiquidationPressureSide } from "@/lib/liquidationPressure";
import {
  buildHierarchicalPerpetualDecision,
  type HierarchicalPerpetualDecision
} from "./hierarchicalPerpetualDecision";
import {
  perpetualStructureTimeframes,
  type PerpetualStructureTimeframe,
  type QualifiedMssState
} from "./qualifiedMss";

export const perpetualDecisionEngineVersion = "perpetual-v3.0.0";
// All v3 monitor IDs use a new semantic prefix so v2 conditions cannot be
// evaluated against the six-timeframe MSS hierarchy.
export const perpetualMonitorConditionVersion = "perpetual-condition-v3.0.0";
export const perpetualDecisionStateConditionVersion = "perpetual-state-v3.0.0";

export function hasQualifiedMssSemantics(
  snapshot: Pick<PerpetualDecisionSnapshot, "engineVersion" | "payloadSchemaVersion">
) {
  return snapshot.engineVersion === perpetualDecisionEngineVersion && snapshot.payloadSchemaVersion === 3;
}

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
  basis?: string;
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
    mss: PerpetualTimedLevel | null;
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

export interface PerpetualStructureEvidence {
  timeframe: PerpetualStructureTimeframe;
  label: string;
  trend: DirectionState;
  continuation: DirectionState;
  warning: DirectionState;
  observedAt: string | null;
  historyMode: "bounded-replay";
  known: boolean;
  integrity: QualifiedMssState["integrity"];
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
  payloadSchemaVersion?: 3;
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
    events?: Pick<PerpetualEvidenceDetails["events"], "mss" | "msb" | "choch">;
    context?: PerpetualStructureEvidence[];
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
    analysisConsensus?: HierarchicalPerpetualDecision;
  };
  pro?: {
    detailVersion?: 1;
    confirmedCommonRangeV1?: ConfirmedCommonRangeOteV1 | null;
    confirmationConditions: MonitorCondition[];
    invalidationConditions: MonitorCondition[];
    multiTimeframeEvidence: PerpetualDecisionEvidence[];
    qualifiedMssEvidence?: QualifiedMssState[];
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
  structureTimeframes: QualifiedMssState[];
  confirmedCommonRangeV1?: ConfirmedCommonRangeOteV1 | null;
  pressure: LiquidationPressureReport | null;
  flow: LargeTradeFlowReport | null;
  previousSnapshot?: Pick<PerpetualDecisionSnapshot, "summary" | "generatedAt" | "engineVersion"> | null;
}

const timeframeLabels: Record<PerpetualTimeframeObservation["timeframe"], string> = {
  "15m": "15분",
  "1h": "1시간",
  "4h": "4시간"
};

const structureTimeframeLabels: Record<PerpetualStructureTimeframe, string> = {
  "1m": "1분",
  "5m": "5분",
  "15m": "15분",
  "1h": "1시간",
  "4h": "4시간",
  "1d": "1일"
};

const tickSizes: Record<PerpetualAsset, number> = {
  btc: 0.1,
  eth: 0.01
};

function addHours(iso: string, hours: number) {
  return new Date(new Date(iso).getTime() + hours * 60 * 60 * 1000).toISOString();
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

function qualifiedTimedLevel(event: QualifiedMssState["latestMss"] | QualifiedMssState["activeMsb"] | QualifiedMssState["activeChoch"]): PerpetualTimedLevel | null {
  if (!event) return null;
  return {
    direction: event.direction,
    level: event.level,
    occurredAt: event.occurredAt,
    ageBars: event.ageBars
  };
}

function evidenceDetails(
  observation: PerpetualTimeframeObservation,
  qualified?: QualifiedMssState
): PerpetualEvidenceDetails {
  const { analysis, candleTimes } = observation;
  return {
    events: {
      mss: qualifiedTimedLevel(qualified?.latestMss ?? null),
      msb: qualified ? qualifiedTimedLevel(qualified.activeMsb) : timedLevel(analysis.latestMsbEvent, candleTimes),
      choch: qualified ? qualifiedTimedLevel(qualified.activeChoch) : timedLevel(analysis.latestChochEvent, candleTimes),
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
  threshold,
  basis
}: {
  asset: PerpetualAsset;
  generatedAt: string;
  timeframe: MonitorCondition["timeframe"];
  role: MonitorConditionRole;
  direction: "above" | "below";
  threshold: number;
  basis: string;
}): MonitorCondition {
  const kind = direction === "above" ? "price_cross_above" : "price_cross_below";
  const hours = timeframe === "15m" ? 24 : timeframe === "1h" ? 72 : 14 * 24;
  const normalized = Number(threshold.toFixed(asset === "btc" ? 1 : 2));
  return {
    id: conditionId(asset, timeframe, role, kind, normalized),
    kind,
    role,
    timeframe,
    label: `${basis} ${normalized.toLocaleString("ko-KR")} ${direction === "above" ? "위" : "아래"}에서 ${timeframeLabels[timeframe]}봉이 마감하면 ${role === "invalidation" ? "현재 해석을" : "현재 방향 근거가 유지되는지"} 최신 분석에서 다시 판단합니다.`,
    threshold: normalized,
    basis,
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
    id: [perpetualDecisionStateConditionVersion, asset, "15m", "primary", "decision_state_change", baselineState].join(":"),
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
  direction: "above" | "below",
  qualified?: QualifiedMssState
) {
  const eventLevel = (
    event: { direction: "bullish" | "bearish"; level: number } | null | undefined
  ) => event?.direction === (direction === "above" ? "bullish" : "bearish") ? event.level : undefined;
  const candidates = direction === "above"
    ? [
        { value: observation.analysis.buySideLiquidity?.level, basis: "위쪽 유동성 가격" },
        { value: observation.analysis.condition.donchianHigh, basis: "최근 범위 고점" },
        { value: eventLevel(qualified?.latestMss), basis: "확정 구조(MSS) 돌파선" },
        { value: eventLevel(qualified?.activeMsb), basis: "추세 지속(MSB) 돌파선" },
        { value: eventLevel(qualified?.activeChoch), basis: "전환 경고(CHoCH) 돌파선" },
        { value: eventLevel(observation.analysis.latestMsbEvent), basis: "최근 구조 돌파선" },
        { value: eventLevel(observation.analysis.latestChochEvent), basis: "최근 전환 돌파선" },
        { value: observation.rangeHigh, basis: "최근 확정봉 고점" }
      ]
    : [
        { value: observation.analysis.sellSideLiquidity?.level, basis: "아래쪽 유동성 가격" },
        { value: observation.analysis.condition.donchianLow, basis: "최근 범위 저점" },
        { value: eventLevel(qualified?.latestMss), basis: "확정 구조(MSS) 돌파선" },
        { value: eventLevel(qualified?.activeMsb), basis: "추세 지속(MSB) 돌파선" },
        { value: eventLevel(qualified?.activeChoch), basis: "전환 경고(CHoCH) 돌파선" },
        { value: eventLevel(observation.analysis.latestMsbEvent), basis: "최근 구조 돌파선" },
        { value: eventLevel(observation.analysis.latestChochEvent), basis: "최근 전환 돌파선" },
        { value: observation.rangeLow, basis: "최근 확정봉 저점" }
      ];
  const valid = candidates
    .filter((candidate): candidate is { value: number; basis: string } => Number.isFinite(candidate.value))
    .filter((candidate) => (direction === "above" ? candidate.value > price : candidate.value < price))
    .sort((left, right) => (direction === "above" ? left.value - right.value : right.value - left.value));
  const selected = valid[0];
  if (!selected) return null;
  const tick = tickSizes[asset];
  return {
    value: Math.round(selected.value / tick) * tick,
    basis: selected.basis
  };
}

function qualityHeadline(quality: SnapshotQuality) {
  if (quality === "unavailable") return "필수 선물 데이터를 확인하지 못했습니다.";
  if (quality === "partial") return "일부 근거가 부족해 방향 판단을 보류합니다.";
  if (quality === "stale") return "데이터 시차가 커져 최신 상태를 다시 확인해야 합니다.";
  return null;
}

export function buildPerpetualDecisionSnapshot(input: BuildPerpetualDecisionInput): PerpetualDecisionSnapshot {
  const byTimeframe = new Map(input.timeframes.map((observation) => [observation.timeframe, observation]));
  const qualifiedByTimeframe = new Map(input.structureTimeframes.map((observation) => [observation.timeframe, observation]));
  const primary = byTimeframe.get("15m") ?? input.timeframes[0];
  const hourly = byTimeframe.get("1h") ?? input.timeframes[1];
  const fourHourly = byTimeframe.get("4h") ?? input.timeframes[2];
  const qualifiedPrimary = qualifiedByTimeframe.get("15m");
  const qualifiedHourly = qualifiedByTimeframe.get("1h");
  const qualifiedFourHourly = qualifiedByTimeframe.get("4h");
  const analysisConsensus = buildHierarchicalPerpetualDecision(input.structureTimeframes);
  const quality = resolveSnapshotQuality(input.sourceStatus);
  const currentFlowValue = flowValue(input.flow, input.sourceStatus.flow);
  const consensusSide = analysisConsensus.finalDirection === "bullish" ? 1 : analysisConsensus.finalDirection === "bearish" ? -1 : 0;
  const flowSide = Math.sign(currentFlowValue);
  const flowConflict = consensusSide !== 0 && flowSide !== 0 && consensusSide !== flowSide && Math.abs(input.flow?.imbalancePercent ?? 0) >= 20;
  const hierarchyConflict = analysisConsensus.conflict === "macro" || analysisConsensus.conflict === "macro_current" || analysisConsensus.conflict === "current";

  let state: DecisionState;
  if (quality !== "ready" || flowConflict || hierarchyConflict) state = "risk";
  else if (analysisConsensus.finalDirection === "bullish") state = "upside_watch";
  else if (analysisConsensus.finalDirection === "bearish") state = "downside_watch";
  else state = "neutral";

  const safeHeadline = qualityHeadline(quality);
  const riskHeadline = flowConflict
    ? "여러 시간대 구조와 큰 금액 체결이 엇갈려 지금은 기다릴 때입니다."
    : analysisConsensus.conflict === "macro"
      ? "1일과 4시간 큰 흐름이 엇갈려 방향 판단을 기다립니다."
      : analysisConsensus.conflict === "macro_current"
        ? "큰 흐름과 현재 구조가 반대라 지금은 기다릴 때입니다."
        : analysisConsensus.conflict === "current"
          ? "1시간과 15분 현재 구조가 엇갈려 지금은 기다릴 때입니다."
          : "근거가 엇갈려 지금은 기다릴 때입니다.";
  const headline =
    safeHeadline ??
    (state === "upside_watch"
      ? "현재는 오르는 근거가 더 많습니다."
      : state === "downside_watch"
        ? "현재는 내리는 근거가 더 많습니다."
      : state === "risk"
          ? riskHeadline
          : "큰 흐름과 현재 구조가 같은 방향으로 모이길 기다립니다.");

  const topRisk =
    quality !== "ready"
      ? "일부 데이터가 늦거나 비어 있어 현재 결론을 그대로 믿기 어렵습니다."
      : flowConflict
        ? "확정 구조와 큰 금액 체결이 반대라 첫 움직임이 되돌려질 수 있습니다."
        : hierarchyConflict
          ? "상위 시간대와 현재 구조가 정렬되지 않아 짧은 반응만 보고 방향을 바꾸기 어렵습니다."
          : analysisConsensus.reaction === "rejecting"
            ? "5분·1분 단기 반응이 큰 흐름과 반대라 되돌림이 커질 수 있습니다."
            : analysisConsensus.layers.some((layer) => layer.warningDirection !== "unknown")
              ? "CHoCH 전환 경고가 있어 확정 구조가 유지되는지 다음 봉에서 다시 봐야 합니다."
          : input.pressure?.grade === "extreme"
            ? "한쪽 포지션이 많이 몰려 있어 급격한 반대 움직임이 나올 수 있습니다."
            : primary.analysis.condition.volatilityState === "expanded"
              ? "평소보다 움직임이 커 작은 변동에도 현재 해석이 자주 바뀔 수 있습니다."
              : state === "neutral"
                ? "방향 근거가 약한 구간이라 작은 움직임을 추세로 오해하기 쉽습니다."
                : "다음 판단 기준이 충족되기 전에 따라가면 되돌림에 흔들릴 수 있습니다.";

  const reasons: [string, string] = [
    `${analysisConsensus.layers[0].detail} ${analysisConsensus.layers[1].detail} ${analysisConsensus.layers[2].detail}`,
    input.flow && input.pressure
      ? `${publicFlowSummary(input.flow)} ${publicPressureSummary(input.pressure)}`
      : "몰린 포지션이나 큰 금액 체결 데이터가 부족해 차트 흐름만으로 단정하지 않습니다."
  ];

  const primaryDirection: "above" | "below" = state === "downside_watch" ? "below" : "above";
  const primaryThreshold = state === "risk" || state === "neutral"
    ? null
    : nextThreshold(input.asset, input.price, primary, primaryDirection, qualifiedPrimary);
  const primaryCondition = state === "risk" || state === "neutral" || !primaryThreshold
    ? stateChangeCondition(
        input.asset,
        input.generatedAt,
        state,
        !primaryThreshold && state !== "risk" && state !== "neutral"
          ? "현재 방향 판단이 바뀌면 최신 분석에서 다시 봅니다."
          : state === "neutral"
          ? "1일·4시간 큰 흐름과 1시간·15분 현재 구조가 같은 방향으로 모이면 다시 판단합니다."
          : quality === "ready"
          ? "엇갈린 시간대 구조와 큰 금액 체결이 정리되면 다시 판단합니다."
          : "빠진 데이터가 다시 들어오고 방향 신호가 한쪽으로 모이면 다시 판단합니다."
      )
    : priceCondition({
        asset: input.asset,
        generatedAt: input.generatedAt,
        timeframe: "15m",
        role: "primary",
        direction: primaryDirection,
        threshold: primaryThreshold.value,
        basis: primaryThreshold.basis
      });

  const hasDirectionalScenario = state === "upside_watch" || state === "downside_watch";
  const scenarioDirection: "above" | "below" = state === "downside_watch" ? "below" : "above";
  const inverseDirection: "above" | "below" = scenarioDirection === "above" ? "below" : "above";
  const confirmationThreshold = hasDirectionalScenario
    ? nextThreshold(input.asset, input.price, hourly, scenarioDirection, qualifiedHourly)
    : null;
  const confirmationConditions = hasDirectionalScenario && confirmationThreshold ? [
    priceCondition({
      asset: input.asset,
      generatedAt: input.generatedAt,
      timeframe: "1h",
      role: "confirmation",
      direction: scenarioDirection,
      threshold: confirmationThreshold.value,
      basis: confirmationThreshold.basis
    })
  ] : [];
  const primaryInvalidationThreshold = hasDirectionalScenario
    ? nextThreshold(input.asset, input.price, primary, inverseDirection, qualifiedPrimary)
    : null;
  const higherInvalidationThreshold = hasDirectionalScenario
    ? nextThreshold(input.asset, input.price, fourHourly, inverseDirection, qualifiedFourHourly)
    : null;
  const invalidationConditions = hasDirectionalScenario ? [
    ...(primaryInvalidationThreshold ? [priceCondition({
      asset: input.asset,
      generatedAt: input.generatedAt,
      timeframe: "15m",
      role: "invalidation",
      direction: inverseDirection,
      threshold: primaryInvalidationThreshold.value,
      basis: primaryInvalidationThreshold.basis
    })] : []),
    ...(higherInvalidationThreshold ? [priceCondition({
      asset: input.asset,
      generatedAt: input.generatedAt,
      timeframe: "4h",
      role: "invalidation",
      direction: inverseDirection,
      threshold: higherInvalidationThreshold.value,
      basis: higherInvalidationThreshold.basis
    })] : [])
  ] : [];

  const previousChange = input.previousSnapshot &&
    input.previousSnapshot.engineVersion === perpetualDecisionEngineVersion &&
    input.previousSnapshot.summary.state !== state
    ? {
        from: input.previousSnapshot.summary.state,
        to: state,
        changedAt: input.generatedAt
      }
    : null;
  const publicPrimaryDetails = evidenceDetails(primary, qualifiedPrimary);
  const primaryStructure: DirectionState = qualifiedPrimary?.trend ?? "unknown";
  const primaryWarning: DirectionState = qualifiedPrimary
    ? qualifiedPrimary.activeChoch?.direction ?? (qualifiedPrimary.known ? "neutral" : "unknown")
    : "unknown";

  return {
    payloadSchemaVersion: 3,
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
      structure: primaryStructure,
      transition: primaryWarning,
      events: {
        mss: publicPrimaryDetails.events.mss,
        msb: publicPrimaryDetails.events.msb,
        choch: publicPrimaryDetails.events.choch
      },
      context: perpetualStructureTimeframes.map((timeframe) => {
        const qualified = qualifiedByTimeframe.get(timeframe);
        return {
          timeframe,
          label: structureTimeframeLabels[timeframe],
          trend: (qualified?.trend ?? "unknown") as DirectionState,
          continuation: qualified
            ? qualified.activeMsb?.direction ?? (qualified.known ? "neutral" : "unknown")
            : "unknown",
          warning: qualified
            ? qualified.activeChoch?.direction ?? (qualified.known ? "neutral" : "unknown")
            : "unknown",
          observedAt: qualified?.lastClosedAt ?? null,
          historyMode: "bounded-replay" as const,
          known: qualified?.known ?? false,
          integrity: qualified?.integrity ?? "unavailable"
        };
      }),
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
      primaryCondition,
      analysisConsensus
    },
    pro: {
      detailVersion: 1,
      ...(input.confirmedCommonRangeV1 !== undefined
        ? { confirmedCommonRangeV1: input.confirmedCommonRangeV1 }
        : {}),
      confirmationConditions: quality === "ready" ? confirmationConditions : [],
      invalidationConditions: quality === "ready" ? invalidationConditions : [],
      qualifiedMssEvidence: input.structureTimeframes,
      multiTimeframeEvidence: input.timeframes.map((observation) => {
        const qualified = qualifiedByTimeframe.get(observation.timeframe);
        const structure = (qualified?.trend ?? "unknown") as DirectionState;
        const transition: DirectionState = qualified
          ? qualified.activeChoch?.direction ?? (qualified.known ? "neutral" : "unknown")
          : "unknown";
        return {
          timeframe: observation.timeframe,
          label: timeframeLabels[observation.timeframe],
          structure,
          transition,
          score: qualified
            ? (qualified.trend === "bullish" ? 1 : qualified.trend === "bearish" ? -1 : 0) * qualified.trendStrength
            : 0,
          regime: observation.analysis.condition.regime,
          observedAt: observation.observedAt,
          closedPrice: observation.closedPrice,
          details: evidenceDetails(observation, qualified)
        };
      }),
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
  const { analysisConsensus: _analysisConsensus, ...summary } = basic.summary;
  return { ...basic, summary };
}

export function serializeStoredPerpetualSnapshot(snapshot: PerpetualDecisionSnapshot): PerpetualDecisionSnapshot {
  const { pro: _pro, ...basic } = snapshot;
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

export function isMonitorConditionCompatible(
  condition: MonitorCondition,
  snapshot: Pick<PerpetualDecisionSnapshot, "engineVersion">
) {
  if (snapshot.engineVersion !== perpetualDecisionEngineVersion) return false;
  if (condition.kind === "decision_state_change") {
    return condition.id.startsWith(`${perpetualDecisionStateConditionVersion}:`);
  }
  return condition.id.startsWith(`${perpetualMonitorConditionVersion}:`);
}

export function isMonitorConditionMet(condition: MonitorCondition, snapshot: PerpetualDecisionSnapshot) {
  if (!isMonitorConditionCompatible(condition, snapshot)) return false;
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
    const alignedDirection = snapshot.summary.state === "upside_watch" || snapshot.summary.state === "downside_watch";
    return Boolean(condition.baselineState && snapshot.summary.state !== condition.baselineState && alignedDirection);
  }
  const pressure = snapshot.pro?.pressure?.dominantSide;
  if (!pressure) return false;
  if (condition.targetPressure) return pressure === condition.targetPressure;
  return Boolean(condition.baselinePressure && pressure !== condition.baselinePressure);
}
