import type {
  MonitorCondition,
  MonitorConditionKind,
  MonitorConditionRole,
  PerpetualAsset,
  PerpetualDecisionSnapshot,
  PerpetualSymbol
} from "@/lib/perpetualDecisionSnapshot";
import { decisionStateLabel, plainDecisionText } from "./perpetualDecisionCopy";

export type PerpetualMonitorStatus =
  | "active"
  | "paused"
  | "paused_entitlement"
  | "triggered"
  | "expired"
  | "canceled";

export interface PerpetualScenarioMonitor {
  id: string;
  snapshotId: string;
  lastSnapshotId: string | null;
  conditionId: string;
  condition: MonitorCondition;
  asset: PerpetualAsset;
  symbol: PerpetualSymbol;
  timeframe: MonitorCondition["timeframe"];
  conditionKind: MonitorConditionKind;
  conditionRole: MonitorConditionRole;
  status: PerpetualMonitorStatus;
  expiresAt: string;
  lastEvaluatedAt: string | null;
  triggeredAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastEvaluation?: { quality: PerpetualDecisionSnapshot["quality"]; generatedAt: string; headline: string } | null;
}

export interface PerpetualMonitorRow {
  id: string;
  user_id: string;
  snapshot_id: string;
  last_snapshot_id: string | null;
  condition_id: string;
  condition: MonitorCondition;
  asset: PerpetualAsset;
  symbol: PerpetualSymbol;
  timeframe: MonitorCondition["timeframe"];
  condition_kind: MonitorConditionKind;
  condition_role: MonitorConditionRole;
  status: PerpetualMonitorStatus;
  expires_at: string;
  last_evaluated_at: string | null;
  triggered_at: string | null;
  paused_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PerpetualMonitorCapabilities {
  monitorLimit: number;
  /** Saved quota usage: active/paused scenario monitors plus enabled legacy presets. */
  activeMonitorCount: number;
  /** Conditions currently being evaluated, excluding paused scenarios. */
  runningMonitorCount: number;
  scenarioMonitorCount: number;
  presetCount: number;
  canCreateMonitor: boolean;
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function allowsPerpetualPushMarket(markets: readonly string[] | null | undefined) {
  return !markets?.length || markets.includes("crypto");
}

export function perpetualPushDeliveryStatus(targetCount: number, sentCount: number) {
  if (targetCount === 0) return "in_app_only" as const;
  if (sentCount === targetCount) return "sent" as const;
  if (sentCount > 0) return "partial" as const;
  return "failed" as const;
}

export function toPerpetualScenarioMonitor(row: PerpetualMonitorRow): PerpetualScenarioMonitor {
  return {
    id: row.id,
    snapshotId: row.snapshot_id,
    lastSnapshotId: row.last_snapshot_id,
    conditionId: row.condition_id,
    condition: row.condition,
    asset: row.asset,
    symbol: row.symbol,
    timeframe: row.timeframe,
    conditionKind: row.condition_kind,
    conditionRole: row.condition_role,
    status: row.status,
    expiresAt: row.expires_at,
    lastEvaluatedAt: row.last_evaluated_at,
    triggeredAt: row.triggered_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function monitorNotificationCopy(condition: MonitorCondition, snapshot: PerpetualDecisionSnapshot) {
  const kind = condition.role === "invalidation" ? "시나리오 무효화"
    : condition.kind === "decision_state_change" || condition.kind === "pressure_state_change" ? "판단 변경" : "관찰 조건 충족";
  const time = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(snapshot.generatedAt));
  const price = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  let change = plainDecisionText(snapshot.summary.headline);
  if (condition.kind === "decision_state_change" && condition.baselineState) {
    change = `${decisionStateLabel(condition.baselineState)} → ${decisionStateLabel(snapshot.summary.state)}`;
  } else if (condition.kind === "price_cross_above" || condition.kind === "price_cross_below") {
    const closedPrice = snapshot.pro?.multiTimeframeEvidence.find(item => item.timeframe === condition.timeframe)?.closedPrice;
    const frame = condition.timeframe === "15m" ? "15분" : condition.timeframe === "1h" ? "1시간" : "4시간";
    const side = condition.kind === "price_cross_above" ? "이상" : "이하";
    change = `${frame} 확정봉 종가${typeof closedPrice === "number" && Number.isFinite(closedPrice) ? ` ${price(closedPrice)}` : ""} · 저장 기준 ${condition.threshold !== null ? price(condition.threshold) : "가격"} ${side}`;
  } else if (condition.kind === "pressure_state_change") {
    const pressure = { upsideShorts: "숏 청산 압력", downsideLongs: "롱 청산 압력", balanced: "압력 균형" };
    const current = snapshot.pro?.pressure?.dominantSide;
    change = `${condition.baselinePressure ? pressure[condition.baselinePressure] : "이전 압력"} → ${current ? pressure[current] : "압력 변화 확인"}`;
  }
  return {
    title: `${snapshot.asset.toUpperCase()} · ${kind}`,
    body: `${time} KST · ${change}. 주의: ${plainDecisionText(snapshot.summary.topRisk)} 알림 당시 근거를 확인하세요.`
  };
}

export function pendingEventNeedsDelivery(
  event: { delivery_status: string; delivery_lease_until: string | null },
  now = Date.now()
) {
  if (event.delivery_status === "pending" || event.delivery_status === "failed") return true;
  return event.delivery_status === "sending" && (!event.delivery_lease_until || Date.parse(event.delivery_lease_until) < now);
}

export function monitorLinksSnapshot(
  monitor: Pick<PerpetualMonitorRow, "snapshot_id" | "last_snapshot_id">,
  snapshotId: string,
  allowLastEvaluated = false
) {
  return monitor.snapshot_id === snapshotId || (allowLastEvaluated && monitor.last_snapshot_id === snapshotId);
}

export function journalMonitorIdForSnapshot(
  snapshotId: string,
  savedMonitor: { monitorId: string; snapshotId: string } | null,
  alertMonitorId: string | null,
  exactAlertContext: boolean
) {
  if (savedMonitor?.snapshotId === snapshotId) return savedMonitor.monitorId;
  return exactAlertContext ? alertMonitorId : null;
}

export function isPerpetualSnapshotScopedStateCurrent(
  snapshotId: string,
  state: { snapshotId: string } | null
) {
  return state?.snapshotId === snapshotId;
}
