import type { DecisionState, PerpetualDecisionSnapshot } from "@/lib/perpetualDecisionSnapshot";
import type { Candle } from "@/lib/marketAnalysis";
import type { CftcPositioningBrief } from "@/lib/cftcPositioning";

export type NewsMarket = "crypto" | "global";
export type NewsImpactStage = "detected" | "provisional_15m" | "final_60m";
export type NewsImpactClassification =
  | "pending"
  | "supports_existing_state"
  | "conflicts_with_existing_state"
  | "decision_state_changed"
  | "risk_increase"
  | "no_material_reaction"
  | "insufficient_data";
export type NewsRiskEffect = "increased" | "decreased" | "unchanged";
export type NewsImportance = "normal" | "high" | "critical";
export type NewsImpactStatus = "active" | "revised" | "retracted";
export type NewsSourcePolicyStatus = "allowed" | "review" | "blocked";
export type NewsSourceKind = "official" | "primary";
export type NewsImpactCategory = "macro" | "regulation" | "corporate_sector" | "market_infrastructure";

export interface NewsSourceReference {
  id: string;
  name: string;
  kind: NewsSourceKind;
  url: string;
  publishedAt: string;
}

export interface NewsReactionMetric {
  key: string;
  label: string;
  before: number | null;
  after: number | null;
  change: number | null;
  unit: string;
  zScore?: number | null;
}

export interface NewsDecisionContext {
  eventId: string;
  reactionId: string;
  market: NewsMarket;
  target: "btc" | "eth" | "global";
  stage: NewsImpactStage;
  classification: NewsImpactClassification;
  riskEffect: NewsRiskEffect;
  eventAt: string;
  evaluatedAt: string | null;
  headline: string;
  factSummary: string;
  reactionSummary: string;
  nextCheckAt: string | null;
  preSnapshotId?: string;
  evaluatedSnapshotId?: string;
}

export interface NewsImpactReaction extends NewsDecisionContext {
  eventVersion: number;
  quality: "ready" | "partial" | "stale" | "unavailable";
  priceChangePercent?: number | null;
  stateBefore?: DecisionState | null;
  stateAfter?: DecisionState | null;
  nextCondition?: {
    label: string;
    timeframe: "15m" | "1h" | "4h";
    kind: "price_cross_above" | "price_cross_below" | "pressure_state_change" | "decision_state_change";
    threshold: number | null;
  } | null;
}

export interface NewsImpactEvent {
  id: string;
  semanticKey: string;
  market: NewsMarket;
  category: NewsImpactCategory;
  targets: Array<"btc" | "eth" | "global">;
  importance: NewsImportance;
  version: number;
  status: NewsImpactStatus;
  occurredAt: string;
  firstSeenAt: string;
  updatedAt: string;
  headline: string;
  factSummary: string;
  primarySource: NewsSourceReference;
  sourceCount: number;
  macroEventKey?: string;
  reactionEligibility?: "eligible" | "context_only";
  reaction: NewsImpactReaction | null;
  pro?: {
    sources: NewsSourceReference[];
    reactionHistory: NewsImpactReaction[];
    metrics: NewsReactionMetric[];
    revisions: Array<{
      version: number;
      headline: string;
      factSummary: string;
      updatedAt: string;
    }>;
  };
}

export interface NewsImpactCapabilities {
  canSeeProEvidence: boolean;
  canEnableImpactAlerts: boolean;
  canSaveJournal: boolean;
  requiresAuth: boolean;
  alertDefaultEnabled: false;
}

export interface NewsMarketBriefMetric {
  key: string;
  label: string;
  value: string;
  tone: "positive" | "negative" | "neutral" | "watch";
}

export interface NewsMarketBrief {
  market: NewsMarket;
  asset: "btc" | "eth" | null;
  generatedAt: string;
  quality: "ready" | "partial" | "stale" | "unavailable";
  stateLabel: string;
  headline: string;
  topRisk: string;
  nextCondition: string;
  snapshotId?: string;
  ctaHref: string;
  metrics: NewsMarketBriefMetric[];
  weeklyPositioning?: CftcPositioningBrief | null;
}

export interface NewsImpactListResponse {
  mode: "off" | "shadow" | "on";
  market: NewsMarket;
  asset: "btc" | "eth" | null;
  snapshotId?: string | null;
  snapshotContext: "not_requested" | "matched" | "not_matched" | "ignored_official_only";
  generatedAt: string;
  quality: "ready" | "partial" | "stale" | "unavailable";
  warning: string | null;
  sourceHealth: {
    active: number;
    healthy: number;
    degraded: number;
    blocked: number;
    accepted24h: number;
    latestAcceptedAt: string | null;
  };
  marketBrief: NewsMarketBrief | null;
  events: NewsImpactEvent[];
  capabilities: NewsImpactCapabilities;
  nextCursor: string | null;
  error?: string;
}

export interface GlobalReactionObservation {
  id: string;
  observedAt: string;
  quality: "ready" | "partial" | "stale" | "unavailable";
  marketMode: "Risk-On" | "Neutral" | "Risk-Off";
  metrics: Record<string, number | null>;
  signalGroups: {
    futures: number;
    risk: number;
    sectors: number;
  };
}

export interface ClassifiedReaction {
  classification: NewsImpactClassification;
  riskEffect: NewsRiskEffect;
  reactionSummary: string;
  priceChangePercent: number | null;
  stateBefore: DecisionState | null;
  stateAfter: DecisionState | null;
}

const gradeRank = { calm: 0, normal: 1, heated: 2, extreme: 3 } as const;
const FIVE_MINUTES_MS = 5 * 60_000;
const MAX_GLOBAL_OBSERVATION_AGE_MS = 45 * 60_000;

export function completedRecentGlobalCandles(candles: Candle[], nowMs: number) {
  const completed = candles.filter((candle) => {
    const openedAt = candle.time * 1_000;
    return Number.isFinite(openedAt) && openedAt + FIVE_MINUTES_MS <= nowMs;
  });
  const latest = completed.at(-1);
  if (!latest || nowMs - (latest.time * 1_000 + FIVE_MINUTES_MS) > MAX_GLOBAL_OBSERVATION_AGE_MS) return [];
  return completed;
}

export function globalObservationQuality(input: {
  availableFutures: number;
  availableRisk: number;
  availableSectors: number;
}) {
  const readyGroups = [
    input.availableFutures >= 3,
    input.availableRisk >= 2,
    input.availableSectors >= 7
  ].filter(Boolean).length;
  const available = input.availableFutures + input.availableRisk + input.availableSectors;
  return readyGroups >= 2 ? "ready" as const : available > 0 ? "partial" as const : "unavailable" as const;
}

function directionForState(state: DecisionState) {
  if (state === "upside_watch") return 1;
  if (state === "downside_watch") return -1;
  return 0;
}

function structureSignal(before: PerpetualDecisionSnapshot, after: PerpetualDecisionSnapshot, direction: number) {
  if (!before.pro || !after.pro || direction === 0) return 0;
  const beforeScore = before.pro.multiTimeframeEvidence.reduce((sum, evidence) => sum + evidence.score, 0);
  const afterScore = after.pro.multiTimeframeEvidence.reduce((sum, evidence) => sum + evidence.score, 0);
  const deltaTowardState = (afterScore - beforeScore) * direction;
  if (deltaTowardState >= 0.75) return 1;
  if (deltaTowardState <= -0.75) return -1;
  return 0;
}

function flowSignal(before: PerpetualDecisionSnapshot, after: PerpetualDecisionSnapshot, direction: number) {
  const beforeFlow = before.pro?.flow;
  const afterFlow = after.pro?.flow;
  if (!beforeFlow || !afterFlow || direction === 0) return 0;
  const alignedSide = direction > 0 ? "buy" : "sell";
  const oppositeSide = direction > 0 ? "sell" : "buy";
  const strengthened = afterFlow.dominantSide === alignedSide && (
    beforeFlow.dominantSide !== alignedSide || gradeRank[afterFlow.grade] > gradeRank[beforeFlow.grade]
  );
  const conflicted = afterFlow.dominantSide === oppositeSide && (
    beforeFlow.dominantSide !== oppositeSide || gradeRank[afterFlow.grade] > gradeRank[beforeFlow.grade]
  );
  return strengthened ? 1 : conflicted ? -1 : 0;
}

function pressureSignal(before: PerpetualDecisionSnapshot, after: PerpetualDecisionSnapshot, direction: number) {
  const beforePressure = before.pro?.pressure;
  const afterPressure = after.pro?.pressure;
  if (!beforePressure || !afterPressure || direction === 0) return 0;
  const alignedSide = direction > 0 ? "upsideShorts" : "downsideLongs";
  const oppositeSide = direction > 0 ? "downsideLongs" : "upsideShorts";
  const strengthened = afterPressure.dominantSide === alignedSide && (
    beforePressure.dominantSide !== alignedSide || gradeRank[afterPressure.grade] > gradeRank[beforePressure.grade]
  );
  const conflicted = afterPressure.dominantSide === oppositeSide && (
    beforePressure.dominantSide !== oppositeSide || gradeRank[afterPressure.grade] > gradeRank[beforePressure.grade]
  );
  return strengthened ? 1 : conflicted ? -1 : 0;
}

function percentChange(before: number, after: number) {
  if (!Number.isFinite(before) || !Number.isFinite(after) || before === 0) return null;
  return Number((((after - before) / before) * 100).toFixed(3));
}

function cryptoReactionSummary(classification: NewsImpactClassification, priceChangePercent: number | null) {
  const move = priceChangePercent === null ? "가격 변화는 확인하지 못했습니다." : `가격은 기준 대비 ${priceChangePercent >= 0 ? "+" : ""}${priceChangePercent.toFixed(2)}% 움직였습니다.`;
  if (classification === "risk_increase") return `발표 이후 시장 데이터에서 리스크 상태 전환이 관측됐습니다. ${move}`;
  if (classification === "decision_state_changed") return `발표 이후 시장 데이터에서 판단 상태 변화가 관측됐습니다. ${move}`;
  if (classification === "supports_existing_state") return `발표 이후 구조·체결·청산 근거가 기존 판단을 강화했습니다. ${move}`;
  if (classification === "conflicts_with_existing_state") return `발표 이후 구조·체결·청산 근거가 기존 판단과 충돌했습니다. ${move}`;
  if (classification === "insufficient_data") return "같은 기준으로 비교할 발표 전후 자료가 부족해 영향을 판단하지 않습니다.";
  return `발표 이후 판단을 바꿀 정도의 반응은 아직 관측되지 않았습니다. ${move}`;
}

export function classifyCryptoNewsReaction(
  before: PerpetualDecisionSnapshot | null,
  after: PerpetualDecisionSnapshot | null
): ClassifiedReaction {
  const stateBefore = before?.summary.state ?? null;
  const stateAfter = after?.summary.state ?? null;
  const priceChangePercent = before && after ? percentChange(before.price, after.price) : null;
  if (before && after && before.engineVersion !== after.engineVersion) {
    return {
      classification: "insufficient_data",
      riskEffect: "unchanged",
      reactionSummary: "분석 기준 버전이 달라 발표 전후 반응을 비교하지 않습니다.",
      priceChangePercent: null,
      stateBefore,
      stateAfter
    };
  }
  if (
    !before ||
    !after ||
    before.quality !== "ready" ||
    after.quality !== "ready" ||
    !before.pro ||
    !after.pro ||
    Date.parse(after.generatedAt) <= Date.parse(before.generatedAt)
  ) {
    return {
      classification: "insufficient_data",
      riskEffect: "unchanged",
      reactionSummary: cryptoReactionSummary("insufficient_data", priceChangePercent),
      priceChangePercent,
      stateBefore,
      stateAfter
    };
  }
  if (before.asset !== after.asset) {
    return {
      classification: "insufficient_data",
      riskEffect: "unchanged",
      reactionSummary: "서로 다른 자산의 관측값은 뉴스 영향 비교에 사용하지 않습니다.",
      priceChangePercent: null,
      stateBefore,
      stateAfter
    };
  }

  let classification: NewsImpactClassification = "no_material_reaction";
  let riskEffect: NewsRiskEffect = "unchanged";
  if (after.summary.state === "risk" && before.summary.state !== "risk") {
    classification = "risk_increase";
    riskEffect = "increased";
  } else if (before.summary.state !== after.summary.state) {
    classification = "decision_state_changed";
    riskEffect = before.summary.state === "risk" ? "decreased" : "unchanged";
  } else {
    const direction = directionForState(before.summary.state);
    const signals = [
      structureSignal(before, after, direction),
      flowSignal(before, after, direction),
      pressureSignal(before, after, direction)
    ];
    if (signals.filter((signal) => signal > 0).length >= 2) classification = "supports_existing_state";
    else if (signals.filter((signal) => signal < 0).length >= 2) {
      classification = "conflicts_with_existing_state";
      riskEffect = "increased";
    }
  }

  return {
    classification,
    riskEffect,
    reactionSummary: cryptoReactionSummary(classification, priceChangePercent),
    priceChangePercent,
    stateBefore,
    stateAfter
  };
}

export function classifyGlobalNewsReaction(
  before: GlobalReactionObservation | null,
  after: GlobalReactionObservation | null
): ClassifiedReaction {
  if (
    !before ||
    !after ||
    before.quality !== "ready" ||
    after.quality !== "ready" ||
    Date.parse(after.observedAt) <= Date.parse(before.observedAt)
  ) {
    return {
      classification: "insufficient_data",
      riskEffect: "unchanged",
      reactionSummary: "발표 전후의 글로벌 시장 관측값이 충분하지 않아 영향을 판단하지 않습니다.",
      priceChangePercent: null,
      stateBefore: null,
      stateAfter: null
    };
  }

  let classification: NewsImpactClassification = "no_material_reaction";
  let riskEffect: NewsRiskEffect = "unchanged";
  if (after.marketMode === "Risk-Off" && before.marketMode !== "Risk-Off") {
    classification = "risk_increase";
    riskEffect = "increased";
  } else if (after.marketMode !== before.marketMode) {
    classification = "decision_state_changed";
    riskEffect = before.marketMode === "Risk-Off" ? "decreased" : "unchanged";
  } else {
    const direction = before.marketMode === "Risk-On" ? 1 : before.marketMode === "Risk-Off" ? -1 : 0;
    const signals = Object.values(after.signalGroups).map((value) => Math.abs(value) >= 1.5 ? Math.sign(value) : 0);
    if (direction !== 0 && signals.filter((signal) => signal === direction).length >= 2) {
      classification = "supports_existing_state";
    } else if (direction !== 0 && signals.filter((signal) => signal === -direction).length >= 2) {
      classification = "conflicts_with_existing_state";
      riskEffect = "increased";
    }
  }

  const label = classification === "risk_increase"
    ? "리스크 증가"
    : classification === "decision_state_changed"
      ? "글로벌 판단 상태 변화"
      : classification === "supports_existing_state"
        ? "기존 글로벌 판단 강화"
        : classification === "conflicts_with_existing_state"
          ? "기존 글로벌 판단과 충돌"
          : "뚜렷한 글로벌 반응 없음";
  const observedSignals = [
    Math.abs(after.signalGroups.futures) >= 1.5 ? (after.signalGroups.futures > 0 ? "지수선물 강세 확대" : "지수선물 약세 확대") : null,
    Math.abs(after.signalGroups.risk) >= 1.5 ? (after.signalGroups.risk > 0 ? "변동성·달러·채권 부담 완화" : "변동성·달러·채권 부담 확대") : null,
    Math.abs(after.signalGroups.sectors) >= 1.5 ? (after.signalGroups.sectors > 0 ? "상승 섹터 확산" : "하락 섹터 확산") : null
  ].filter((value): value is string => Boolean(value));
  const evidence = observedSignals.length > 0
    ? `${observedSignals.join(" · ")}가 평소 20개 구간보다 크게 관측됐습니다.`
    : "지수선물·위험지표·섹터 폭에서 평소보다 큰 같은 방향 움직임은 확인되지 않았습니다.";
  return {
    classification,
    riskEffect,
    reactionSummary: `발표 이후 ${evidence} 현재 분류는 '${label}'입니다.`,
    priceChangePercent: null,
    stateBefore: null,
    stateAfter: null
  };
}

export function nextNewsImpactCheckAt(eventAt: string, stage: NewsImpactStage) {
  const eventMs = Date.parse(eventAt);
  if (!Number.isFinite(eventMs) || stage === "final_60m") return null;
  if (stage === "detected") {
    return new Date(eventMs + 15 * 60_000).toISOString();
  }
  return new Date(eventMs + 60 * 60_000).toISOString();
}

export function newsReactionAnchorAt(event: {
  macroEventId?: string | null;
  reactionAnchorPolicy?: "occurred_at" | "first_seen" | null;
  version: number;
  occurredAt: string;
  firstSeenAt: string;
  updatedAt: string;
  revisionDetectedAt?: string | null;
}) {
  if (event.version > 1) {
    const revisionDetectedAt = event.revisionDetectedAt?.trim();
    return revisionDetectedAt && Number.isFinite(Date.parse(revisionDetectedAt))
      ? revisionDetectedAt
      : event.updatedAt;
  }
  if (event.reactionAnchorPolicy === "occurred_at") return event.occurredAt;
  if (event.reactionAnchorPolicy === "first_seen") return event.firstSeenAt;
  return event.macroEventId ? event.occurredAt : event.firstSeenAt;
}

export function nextNewsImpactStage(stage: NewsImpactStage): Exclude<NewsImpactStage, "detected"> | null {
  if (stage === "detected") return "provisional_15m";
  if (stage === "provisional_15m") return "final_60m";
  return null;
}

export function serializeBasicNewsImpactEvent(event: NewsImpactEvent): NewsImpactEvent {
  const { pro: _pro, ...basic } = event;
  if (!basic.reaction) return basic;
  const {
    preSnapshotId: _preSnapshotId,
    evaluatedSnapshotId: _evaluatedSnapshotId,
    priceChangePercent: _priceChangePercent,
    stateBefore: _stateBefore,
    stateAfter: _stateAfter,
    ...reaction
  } = basic.reaction;
  return { ...basic, reaction };
}

export function officialMacroHeadline(value: string) {
  const normalized = value
    .replace(/[-_]+/g, " ")
    .replace(/\b\d{10,}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (/core producer price index|core ppi/i.test(normalized)) return "미국 근원 생산자물가지수(PPI) 발표";
  if (/producer price index|\bppi\b/i.test(normalized)) return "미국 생산자물가지수(PPI) 발표";
  if (/core consumer price index|core cpi/i.test(normalized)) return "미국 근원 소비자물가지수(CPI) 발표";
  if (/consumer price index|\bcpi\b/i.test(normalized)) return "미국 소비자물가지수(CPI) 발표";
  if (/employment situation|nonfarm|payroll/i.test(normalized)) return "미국 고용보고서 발표";
  if (/personal consumption expenditures|\bpce\b/i.test(normalized)) return "미국 개인소비지출(PCE) 물가 발표";
  if (/gross domestic product|\bgdp\b/i.test(normalized)) return "미국 국내총생산(GDP) 발표";
  if (/retail sales/i.test(normalized)) return "미국 소매판매 발표";
  if (/initial jobless claims|jobless claims|unemployment insurance claims/i.test(normalized)) return "미국 신규 실업수당 청구 발표";
  if (/consumer sentiment/i.test(normalized)) return "미국 소비자심리지수 발표";
  if (/consumer confidence/i.test(normalized)) return "미국 소비자신뢰지수 발표";
  if (/manufacturing pmi/i.test(normalized)) return "미국 제조업 구매관리자지수(PMI) 발표";
  if (/services pmi/i.test(normalized)) return "미국 서비스업 구매관리자지수(PMI) 발표";
  if (/durable goods/i.test(normalized)) return "미국 내구재 주문 발표";
  if (/existing home sales/i.test(normalized)) return "미국 기존주택판매 발표";
  if (/new home sales/i.test(normalized)) return "미국 신규주택판매 발표";
  if (/housing starts|building permits/i.test(normalized)) return "미국 주택착공·건축허가 발표";
  if (/industrial production|capacity utilization/i.test(normalized)) return "미국 산업생산·설비가동률 발표";
  if (/import price|export price/i.test(normalized)) return "미국 수출입물가지수 발표";
  if (/jolts|job openings/i.test(normalized)) return "미국 구인·이직 보고서(JOLTS) 발표";
  if (/ism manufacturing/i.test(normalized)) return "미국 ISM 제조업지수 발표";
  if (/ism services|ism non manufacturing/i.test(normalized)) return "미국 ISM 서비스업지수 발표";
  if (/factory orders/i.test(normalized)) return "미국 공장주문 발표";
  if (/construction spending/i.test(normalized)) return "미국 건설지출 발표";
  if (/trade balance|international trade/i.test(normalized)) return "미국 무역수지 발표";
  if (/pending home sales/i.test(normalized)) return "미국 잠정주택판매 발표";
  if (/employment cost index|\beci\b/i.test(normalized)) return "미국 고용비용지수(ECI) 발표";
  if (/productivity|unit labor costs?/i.test(normalized)) return "미국 생산성·단위노동비용 발표";
  if (/testif|testimony/i.test(normalized)) return "미 연준 인사 공식 증언";
  if (/speaks|speech|remarks/i.test(normalized)) return "미 연준 인사 공식 발언";
  if (/[가-힣]/.test(value)) return value.replace(/\s+/g, " ").trim();
  return normalized ? `미국 공식 경제지표 · ${normalized.slice(0, 120)}` : "미국 공식 경제지표 발표";
}

export function serializeOfficialNewsImpactEvent(event: NewsImpactEvent): NewsImpactEvent {
  return {
    id: event.id,
    semanticKey: event.semanticKey,
    market: event.market,
    category: event.category,
    targets: [...event.targets],
    importance: event.importance,
    version: event.version,
    status: event.status,
    occurredAt: event.occurredAt,
    firstSeenAt: event.firstSeenAt,
    updatedAt: event.updatedAt,
    headline: event.headline,
    factSummary: event.factSummary,
    primarySource: {
      id: event.primarySource.id,
      name: event.primarySource.name,
      kind: event.primarySource.kind,
      url: event.primarySource.url,
      publishedAt: event.primarySource.publishedAt
    },
    sourceCount: event.sourceCount,
    ...(event.macroEventKey ? { macroEventKey: event.macroEventKey } : {}),
    ...(event.reactionEligibility ? { reactionEligibility: event.reactionEligibility } : {}),
    reaction: null
  };
}

export function isNewsImpactAlertEligible(reaction: Pick<NewsImpactReaction, "classification" | "quality">) {
  return reaction.quality === "ready" && (
    reaction.classification === "risk_increase" ||
    reaction.classification === "decision_state_changed" ||
    reaction.classification === "conflicts_with_existing_state"
  );
}
