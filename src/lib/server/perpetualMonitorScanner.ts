import { cryptoAlertConditionLimit } from "@/lib/billing";
import { hasEffectiveScope, resolveEffectiveEntitlement } from "@/lib/effectiveEntitlement";
import { isMonitorConditionMet, perpetualDecisionEngineVersion, type PerpetualDecisionSnapshot } from "@/lib/perpetualDecisionSnapshot";
import { allowsPerpetualPushMarket, isUuid, monitorNotificationCopy, perpetualPushDeliveryStatus, type PerpetualMonitorRow } from "@/lib/perpetualMonitor";
import { sendFcmMessage } from "@/lib/server/firebaseMessaging";
import {
  claimPerpetualMonitorTrigger,
  completePerpetualAlertDelivery,
  groupPerpetualMonitorRowsByAsset,
  leasePerpetualAlertDelivery,
  listActivePerpetualMonitorRows,
  listPendingPerpetualAlertEvents,
  listStoredPerpetualMonitorOwnerIds,
  markExpiredPerpetualMonitors,
  markPerpetualMonitorEvaluated,
  reconcilePerpetualMonitorLimit,
  recordPerpetualDecisionOutcome
} from "@/lib/server/perpetualMonitorStore";
import { resolvePerpetualDecisionSnapshot } from "@/lib/server/perpetualDecisionSource";
import { recordServerProductEvent } from "@/lib/server/productEventStore";
import type { PushSubscriptionRow, PushTokenRow } from "@/lib/server/push/types";
import {
  isPerpetualRevenueCoreScannerEnabled,
  isPerpetualRevenueCoreUserEnabled,
  perpetualRevenueCoreMode,
  shouldRunPerpetualRevenueMaintenance
} from "@/lib/server/perpetualRevenueCore";
import { supabaseAdminAuth, supabaseAdminRestAll, supabaseAdminRpc } from "@/lib/server/supabaseAdmin";
import type { SupabaseUser } from "@/lib/supabase";

export interface PerpetualMonitorScanResult {
  enabled: boolean;
  evaluated: number;
  triggered: number;
  expired: number;
  inAppOnly: number;
  deliveryEvents: number;
  sent: number;
  failed: number;
  warnings: string[];
}

interface PerpetualMonitorScanOptions {
  dryRun?: boolean;
  deliveryEnabled?: boolean;
  send?: typeof sendFcmMessage;
}

function emptyResult(enabled: boolean): PerpetualMonitorScanResult {
  return {
    enabled,
    evaluated: 0,
    triggered: 0,
    expired: 0,
    inAppOnly: 0,
    deliveryEvents: 0,
    sent: 0,
    failed: 0,
    warnings: []
  };
}

function safeMessage(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 300);
}

function rowsByUser(rows: PushSubscriptionRow[]) {
  const result = new Map<string, PushSubscriptionRow[]>();
  for (const row of rows) result.set(row.user_id, [...(result.get(row.user_id) ?? []), row]);
  return result;
}

function chunks<T>(items: readonly T[], size = 100) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

async function reconcileStoredMonitorEntitlements(result: PerpetualMonitorScanResult, mode: ReturnType<typeof perpetualRevenueCoreMode>) {
  const userIds = (await listStoredPerpetualMonitorOwnerIds())
    .filter((userId) => isPerpetualRevenueCoreUserEnabled(userId, mode));
  const blockedUsers = new Set<string>();
  if (!userIds.length) return blockedUsers;
  const userChunks = chunks(userIds);
  const [subscriptionPages, deletionPages] = await Promise.all([
    Promise.all(userChunks.map((group) => supabaseAdminRestAll<PushSubscriptionRow>(
      `subscriptions?select=user_id,provider,status,plan,market_scope,current_period_end,revoked_at&user_id=in.(${group.join(",")})&order=current_period_end.desc`
    ))),
    Promise.all(userChunks.map((group) => supabaseAdminRestAll<{ user_id: string }>(
      `account_deletion_requests?select=user_id&user_id=in.(${group.join(",")})&status=in.(pending,processing,failed)&order=user_id.asc`
    )))
  ]);
  const subscriptions = subscriptionPages.flat();
  const deletionRows = deletionPages.flat();
  const subscriptionsByUser = rowsByUser(subscriptions);
  const deletionUsers = new Set(deletionRows.map((row) => row.user_id));

  for (const userId of userIds) {
    try {
      if (deletionUsers.has(userId)) {
        await reconcilePerpetualMonitorLimit(userId, 0);
        blockedUsers.add(userId);
        continue;
      }
      let user: SupabaseUser | null = null;
      if (mode === "shadow") {
        user = await supabaseAdminAuth<SupabaseUser>(`admin/users/${encodeURIComponent(userId)}`, { allowNotFound: true });
        if (!user || user.app_metadata?.role === "admin") {
          await reconcilePerpetualMonitorLimit(userId, 0);
          blockedUsers.add(userId);
          continue;
        }
      }
      const base = resolveEffectiveEntitlement({
        isAuthenticated: true,
        subscriptions: subscriptionsByUser.get(userId) ?? []
      });
      if (hasEffectiveScope(base, "crypto")) {
        await reconcilePerpetualMonitorLimit(userId, cryptoAlertConditionLimit(base.plan));
        continue;
      }
      user ??= await supabaseAdminAuth<SupabaseUser>(`admin/users/${encodeURIComponent(userId)}`, { allowNotFound: true });
      if (!user) {
        await reconcilePerpetualMonitorLimit(userId, 0);
        blockedUsers.add(userId);
        continue;
      }
      const effective = resolveEffectiveEntitlement({
        isAuthenticated: true,
        isAdmin: user.app_metadata?.role === "admin",
        subscriptions: subscriptionsByUser.get(userId) ?? []
      });
      await reconcilePerpetualMonitorLimit(userId, cryptoAlertConditionLimit(effective.plan));
    } catch (error) {
      result.warnings.push(`entitlement:${userId}:${safeMessage(error)}`);
      // Fail closed for this scan even when the stored rows can be reconciled
      // to the Basic preservation limit after an auth lookup failure.
      blockedUsers.add(userId);
      try {
        await reconcilePerpetualMonitorLimit(userId, 1);
      } catch (reconcileError) {
        result.warnings.push(`entitlement-fail-closed:${userId}:${safeMessage(reconcileError)}`);
      }
    }
  }
  return blockedUsers;
}

function validDeliveryPayload(payload: Record<string, unknown>) {
  const asset = payload.asset;
  const snapshotId = payload.snapshotId;
  const monitorId = payload.monitorId;
  const conditionId = payload.conditionId;
  if (
    payload.type !== "perpetual_scenario" ||
    payload.destination !== "perpetual_snapshot" ||
    (asset !== "btc" && asset !== "eth") ||
    !isUuid(snapshotId) ||
    !isUuid(monitorId) ||
    typeof conditionId !== "string" ||
    !conditionId
  ) return null;
  return { asset, snapshotId, monitorId, conditionId };
}

async function deliverPendingEvents(
  result: PerpetualMonitorScanResult,
  options: PerpetualMonitorScanOptions,
  mode: ReturnType<typeof perpetualRevenueCoreMode>,
  blockedUsers: ReadonlySet<string>
) {
  const events = (await listPendingPerpetualAlertEvents())
    .filter((event) => isPerpetualRevenueCoreUserEnabled(event.user_id, mode) && !blockedUsers.has(event.user_id));
  if (!events.length) return;
  const userIds = Array.from(new Set(events.map((event) => event.user_id)));
  const tokenPages = await Promise.all(chunks(userIds).map((group) => supabaseAdminRestAll<PushTokenRow>(
    `push_tokens?select=id,user_id,token,markets,rule_ids&user_id=in.(${group.join(",")})&enabled=eq.true&platform=eq.android&provider=eq.fcm&order=user_id.asc,id.asc`
  )));
  const tokens = tokenPages.flat();
  const tokensByUser = new Map<string, PushTokenRow[]>();
  for (const token of tokens) tokensByUser.set(token.user_id, [...(tokensByUser.get(token.user_id) ?? []), token]);
  const sender = options.send ?? sendFcmMessage;

  for (const event of events) {
    const payload = validDeliveryPayload(event.payload ?? {});
    if (!payload) {
      result.warnings.push(`delivery:${event.id}:invalid_payload`);
      const leased = await leasePerpetualAlertDelivery(event.id);
      if (leased) {
        await completePerpetualAlertDelivery({
          eventId: event.id,
          attempt: leased.delivery_attempt_count,
          status: "failed",
          sentCount: 0,
          failedCount: 0,
          error: "Invalid structured Perpetual alert payload."
        });
      }
      continue;
    }
    const targetTokens = (tokensByUser.get(event.user_id) ?? []).filter((token) => allowsPerpetualPushMarket(token.markets));
    if (targetTokens.length > 0 && options.deliveryEnabled === false) {
      result.warnings.push(`delivery:${event.id}:firebase_unavailable`);
      continue;
    }
    const leased = await leasePerpetualAlertDelivery(event.id);
    if (!leased) continue;
    result.deliveryEvents += 1;
    if (targetTokens.length === 0) {
      await completePerpetualAlertDelivery({
        eventId: event.id,
        attempt: leased.delivery_attempt_count,
        status: perpetualPushDeliveryStatus(0, 0),
        sentCount: 0,
        failedCount: 0
      });
      result.inAppOnly += 1;
      continue;
    }

    const outcomes = await Promise.allSettled(targetTokens.map((token) => sender({
      token: token.token,
      title: event.title,
      body: event.body,
      data: {
        type: "perpetual_scenario",
        destination: "perpetual_snapshot",
        asset: payload.asset,
        snapshotId: payload.snapshotId,
        monitorId: payload.monitorId,
        conditionId: payload.conditionId
      }
    })));
    const sent = outcomes.filter((outcome) => outcome.status === "fulfilled").length;
    const failed = outcomes.length - sent;
    await completePerpetualAlertDelivery({
      eventId: event.id,
      attempt: leased.delivery_attempt_count,
      status: perpetualPushDeliveryStatus(outcomes.length, sent),
      sentCount: sent,
      failedCount: failed,
      error: failed > 0 ? "One or more FCM deliveries failed." : null
    });
    result.sent += sent;
    result.failed += failed;
  }
}

export function monitorConditionMetForSnapshot(row: Pick<PerpetualMonitorRow, "condition">, snapshot: PerpetualDecisionSnapshot) {
  return isMonitorConditionMet(row.condition, snapshot);
}

async function runPerpetualRevenueRetention(result: PerpetualMonitorScanResult) {
  try {
    await supabaseAdminRpc("purge_perpetual_revenue_core_retention", {});
  } catch (error) {
    result.warnings.push(`retention:${safeMessage(error)}`);
  }
}

export async function runPerpetualMonitorScan(options: PerpetualMonitorScanOptions = {}): Promise<PerpetualMonitorScanResult> {
  const mode = perpetualRevenueCoreMode();
  if (!isPerpetualRevenueCoreScannerEnabled(mode)) {
    const disabled = emptyResult(false);
    if (shouldRunPerpetualRevenueMaintenance(mode) && options.dryRun !== true) {
      await runPerpetualRevenueRetention(disabled);
    }
    return disabled;
  }
  const result = emptyResult(true);
  const dryRun = options.dryRun === true;
  let blockedUsers = new Set<string>();

  if (!dryRun) {
    result.expired = await markExpiredPerpetualMonitors(perpetualDecisionEngineVersion);
    blockedUsers = await reconcileStoredMonitorEntitlements(result, mode);
  }

  const monitorRows = (await listActivePerpetualMonitorRows()).filter((row) => (
    isPerpetualRevenueCoreUserEnabled(row.user_id, mode) && !blockedUsers.has(row.user_id)
  ));
  const grouped = groupPerpetualMonitorRowsByAsset(monitorRows);
  for (const asset of ["btc", "eth"] as const) {
    const rows = grouped[asset];
    if (!rows.length) continue;
    let snapshot: PerpetualDecisionSnapshot;
    try {
      snapshot = (await resolvePerpetualDecisionSnapshot({ asset })).snapshot;
    } catch (error) {
      result.warnings.push(`snapshot:${asset}:${safeMessage(error)}`);
      continue;
    }

    for (const row of rows) {
      result.evaluated += 1;
      if (snapshot.quality !== "ready") {
        if (!dryRun) {
          await Promise.all([
            markPerpetualMonitorEvaluated(row.id, snapshot.id),
            recordPerpetualDecisionOutcome({
              snapshotId: row.snapshot_id,
              conditionId: row.condition_id,
              outcome: "insufficient_data",
              evaluatorVersion: perpetualDecisionEngineVersion,
              evidence: { quality: snapshot.quality }
            })
          ]);
        }
        continue;
      }
      if (!monitorConditionMetForSnapshot(row, snapshot)) {
        if (!dryRun) await markPerpetualMonitorEvaluated(row.id, snapshot.id);
        continue;
      }
      result.triggered += 1;
      if (dryRun) continue;

      const copy = monitorNotificationCopy(row.condition);
      const payload = {
        type: "perpetual_scenario",
        destination: "perpetual_snapshot",
        asset,
        snapshotId: snapshot.id,
        monitorId: row.id,
        conditionId: row.condition_id
      };
      const claimed = await claimPerpetualMonitorTrigger({
        monitorId: row.id,
        evaluatedSnapshotId: snapshot.id,
        eventKey: `perpetual:${row.id}:${row.condition_id}`,
        title: copy.title,
        body: copy.body,
        payload,
        outcome: row.condition_role === "invalidation" ? "invalidated" : "confirmed",
        evaluatorVersion: perpetualDecisionEngineVersion
      });
      if (!claimed?.claimed) continue;
      await recordServerProductEvent({
        eventName: "scenario_triggered",
        userId: claimed.user_id,
        surface: "alerts",
        asset,
        snapshotId: snapshot.id,
        monitorId: row.id,
        properties: { conditionRole: row.condition_role }
      });
    }
  }

  if (!dryRun) {
    try {
      await deliverPendingEvents(result, options, mode, blockedUsers);
    } catch (error) {
      result.warnings.push(`delivery:${safeMessage(error)}`);
    }
    await runPerpetualRevenueRetention(result);
  }
  return result;
}
