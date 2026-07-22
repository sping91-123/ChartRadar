import type {
  MonitorCondition,
  MonitorConditionKind,
  MonitorConditionRole,
  PerpetualAsset,
  PerpetualSymbol
} from "@/lib/perpetualDecisionSnapshot";

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

export function monitorNotificationCopy(condition: MonitorCondition) {
  if (condition.role === "invalidation") {
    return { title: "시나리오 무효화", body: `${condition.label} 조건이 확인되었습니다.` };
  }
  if (condition.kind === "decision_state_change" || condition.kind === "pressure_state_change") {
    return { title: "판단 변경", body: `${condition.label} 조건이 확인되었습니다.` };
  }
  return { title: "관찰 조건 충족", body: `${condition.label} 조건이 확인되었습니다.` };
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
