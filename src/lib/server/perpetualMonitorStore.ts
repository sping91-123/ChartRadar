import type { MonitorCondition, PerpetualAsset } from "@/lib/perpetualDecisionSnapshot";
import {
  toPerpetualScenarioMonitor,
  type PerpetualMonitorRow,
  type PerpetualMonitorStatus,
  type PerpetualScenarioMonitor
} from "@/lib/perpetualMonitor";
import { supabaseAdminRest, supabaseAdminRestAll, supabaseAdminRpc } from "@/lib/server/supabaseAdmin";

const monitorSelect = [
  "id",
  "user_id",
  "snapshot_id",
  "last_snapshot_id",
  "condition_id",
  "condition",
  "asset",
  "symbol",
  "timeframe",
  "condition_kind",
  "condition_role",
  "status",
  "expires_at",
  "last_evaluated_at",
  "triggered_at",
  "paused_at",
  "created_at",
  "updated_at"
].join(",");

export interface ClaimedPerpetualAlert {
  event_id: string;
  user_id: string;
  claimed: boolean;
}

export interface PerpetualAlertEventRow {
  id: string;
  user_id: string;
  market: "crypto";
  rule_id: "perpetual_scenario";
  event_key: string;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  delivery_status: "pending" | "sending" | "sent" | "partial" | "failed" | "in_app_only";
  delivery_attempt_count: number;
  delivery_lease_until: string | null;
}

export async function listUserPerpetualMonitors(
  userId: string,
  status?: PerpetualMonitorStatus
): Promise<PerpetualScenarioMonitor[]> {
  const statusFilter = status
    ? `&status=eq.${status}`
    : "&status=in.(active,paused,paused_entitlement)";
  const rows = await supabaseAdminRest<PerpetualMonitorRow[]>(
    `perpetual_scenario_monitors?select=${monitorSelect}&user_id=eq.${encodeURIComponent(userId)}${statusFilter}&order=created_at.desc&limit=100`
  );
  return rows.map(toPerpetualScenarioMonitor);
}

export async function listRecentTerminalPerpetualMonitors(
  userId: string,
  limit = 5
): Promise<PerpetualScenarioMonitor[]> {
  const safeLimit = Math.max(1, Math.min(20, Math.round(limit)));
  const rows = await supabaseAdminRest<PerpetualMonitorRow[]>(
    `perpetual_scenario_monitors?select=${monitorSelect}&user_id=eq.${encodeURIComponent(userId)}&status=in.(triggered,expired,canceled)&order=updated_at.desc&limit=${safeLimit}`
  );
  return rows.map(toPerpetualScenarioMonitor);
}

export async function countSavedPerpetualMonitors(userId: string) {
  const rows = await supabaseAdminRest<Array<{ id: string }>>(
    `perpetual_scenario_monitors?select=id&user_id=eq.${encodeURIComponent(userId)}&status=in.(active,paused)&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&limit=100`
  );
  return rows.length;
}

export async function countEnabledCryptoPresets(userId: string) {
  const rows = await supabaseAdminRest<Array<{ id: string }>>(
    `push_alert_presets?select=id&user_id=eq.${encodeURIComponent(userId)}&market=eq.crypto&enabled=eq.true&limit=100`
  );
  return rows.length;
}

export async function sharedCryptoConditionUsage(userId: string) {
  const [activeMonitorCount, enabledPresetCount] = await Promise.all([
    countSavedPerpetualMonitors(userId),
    countEnabledCryptoPresets(userId)
  ]);
  return {
    activeMonitorCount,
    enabledPresetCount,
    total: activeMonitorCount + enabledPresetCount
  };
}

export async function createPerpetualMonitor(params: {
  userId: string;
  snapshotId: string;
  condition: MonitorCondition;
  monitorLimit: number;
}) {
  const rows = await supabaseAdminRpc<PerpetualMonitorRow[]>("create_perpetual_monitor", {
    p_user_id: params.userId,
    p_snapshot_id: params.snapshotId,
    p_condition_id: params.condition.id,
    p_condition: params.condition,
    p_monitor_limit: params.monitorLimit
  });
  return rows[0] ? toPerpetualScenarioMonitor(rows[0]) : null;
}

export async function setPerpetualMonitorAction(params: {
  userId: string;
  monitorId: string;
  action: "pause" | "resume" | "cancel";
  monitorLimit: number;
}) {
  const rows = await supabaseAdminRpc<PerpetualMonitorRow[]>("set_perpetual_monitor_status", {
    p_user_id: params.userId,
    p_monitor_id: params.monitorId,
    p_action: params.action,
    p_monitor_limit: params.monitorLimit
  });
  return rows[0] ? toPerpetualScenarioMonitor(rows[0]) : null;
}

export async function listActivePerpetualMonitorRows() {
  return supabaseAdminRestAll<PerpetualMonitorRow>(
    `perpetual_scenario_monitors?select=${monitorSelect}&status=eq.active&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&order=created_at.asc`
  );
}

export async function listStoredPerpetualMonitorOwnerIds() {
  const rows = await supabaseAdminRestAll<{ user_id: string }>(
    "perpetual_scenario_monitors?select=user_id&status=in.(active,paused,paused_entitlement)&order=user_id.asc"
  );
  return Array.from(new Set(rows.map((row) => row.user_id)));
}

export async function listPendingPerpetualAlertEvents() {
  const rows = await supabaseAdminRest<PerpetualAlertEventRow[]>(
    "push_alert_events?select=id,user_id,market,rule_id,event_key,title,body,payload,delivery_status,delivery_attempt_count,delivery_lease_until&rule_id=eq.perpetual_scenario&delivery_status=in.(pending,failed,sending)&delivery_attempt_count=lt.3&order=created_at.asc&limit=200"
  );
  const now = Date.now();
  return rows.filter((row) => {
    if (row.delivery_status !== "sending") return true;
    const leaseUntil = row.delivery_lease_until;
    return !leaseUntil || Date.parse(leaseUntil) < now;
  });
}

export async function markPerpetualMonitorEvaluated(monitorId: string, snapshotId: string) {
  await supabaseAdminRest(`perpetual_scenario_monitors?id=eq.${encodeURIComponent(monitorId)}&status=eq.active`, {
    method: "PATCH",
    body: {
      last_snapshot_id: snapshotId,
      last_evaluated_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  });
}

export async function markExpiredPerpetualMonitors(evaluatorVersion: string) {
  return supabaseAdminRpc<number>("expire_perpetual_monitors", {
    p_evaluator_version: evaluatorVersion
  });
}

export async function reconcilePerpetualMonitorLimit(userId: string, monitorLimit: number) {
  return supabaseAdminRpc<{
    active_monitors: number;
    saved_monitors: number;
    enabled_presets: number;
    limit: number;
  }>("reconcile_perpetual_monitor_limit", {
    p_user_id: userId,
    p_monitor_limit: monitorLimit
  });
}

export async function recordPerpetualDecisionOutcome(params: {
  snapshotId: string;
  conditionId: string;
  outcome: "confirmed" | "invalidated" | "expired" | "insufficient_data";
  evaluatorVersion: string;
  evidence?: Record<string, string | number | boolean | null>;
}) {
  await supabaseAdminRpc("record_perpetual_decision_outcome", {
    p_snapshot_id: params.snapshotId,
    p_condition_id: params.conditionId,
    p_outcome: params.outcome,
    p_evaluator_version: params.evaluatorVersion,
    p_evidence: params.evidence ?? {}
  });
}

export async function claimPerpetualMonitorTrigger(params: {
  monitorId: string;
  evaluatedSnapshotId: string;
  eventKey: string;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  outcome: "confirmed" | "invalidated";
  evaluatorVersion: string;
}) {
  const rows = await supabaseAdminRpc<ClaimedPerpetualAlert[]>("claim_perpetual_monitor_trigger", {
    p_monitor_id: params.monitorId,
    p_evaluated_snapshot_id: params.evaluatedSnapshotId,
    p_event_key: params.eventKey,
    p_title: params.title,
    p_body: params.body,
    p_payload: params.payload,
    p_outcome: params.outcome,
    p_evaluator_version: params.evaluatorVersion
  });
  return rows[0] ?? null;
}

export async function leasePerpetualAlertDelivery(eventId: string) {
  const rows = await supabaseAdminRpc<PerpetualAlertEventRow[]>("lease_perpetual_alert_delivery", {
    p_event_id: eventId,
    p_lease_seconds: 90
  });
  return rows[0] ?? null;
}

export async function completePerpetualAlertDelivery(params: {
  eventId: string;
  attempt: number;
  status: "sent" | "partial" | "failed" | "in_app_only";
  sentCount: number;
  failedCount: number;
  error?: string | null;
}) {
  return supabaseAdminRpc<boolean>("complete_perpetual_alert_delivery", {
    p_event_id: params.eventId,
    p_attempt: params.attempt,
    p_status: params.status,
    p_sent_count: params.sentCount,
    p_failed_count: params.failedCount,
    p_error: params.error ?? null
  });
}

export function groupPerpetualMonitorRowsByAsset(rows: PerpetualMonitorRow[]) {
  const grouped: Record<PerpetualAsset, PerpetualMonitorRow[]> = { btc: [], eth: [] };
  for (const row of rows) grouped[row.asset].push(row);
  return grouped;
}
