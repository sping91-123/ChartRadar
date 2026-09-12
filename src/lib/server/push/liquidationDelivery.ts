import { isLiquidationAlertKey, readLiquidationAlertSnapshot, liquidationAlertKey } from "@/lib/liquidationAlert";
import { supabaseAdminRest } from "@/lib/server/supabaseAdmin";
import { sendFcmMessage } from "@/lib/server/firebaseMessaging";
import type { PushAlertEvent, PushTokenRow } from "@/lib/server/push/types";

export async function deliverLiquidationEvent(userId: string, targets: PushTokenRow[], event: PushAlertEvent) {
  const alert = readLiquidationAlertSnapshot(event.auditEvidence?.snapshot.alert);
  if (!alert || !isLiquidationAlertKey(event.eventKey) || liquidationAlertKey(alert) !== event.eventKey)
    throw new Error("Invalid liquidation alert evidence");
  const now = Date.now();
  const observedAt = Date.parse(alert.observedAt);
  const ttlSeconds = Math.floor((observedAt + 5 * 60_000 - now) / 1000);
  if (!targets.length || observedAt > now || ttlSeconds <= 0 || ttlSeconds > 300) return { sent: 0, failed: 0, duplicate: 0 };
  const payload = { ...event.data, auditEvidence: event.auditEvidence, sentCount: 0 };
  // Save the exact user-visible evidence before delivery; only the insert winner sends.
  const inserted = await supabaseAdminRest<Array<{ id: string }>>(
    "push_alert_events?on_conflict=user_id,event_key&select=id", {
      method: "POST", prefer: "resolution=ignore-duplicates,return=representation", timeoutMs: 5000,
      body: { user_id: userId, market: event.market, rule_id: event.ruleId, event_key: event.eventKey,
        title: event.title, body: event.body, payload, notification_kind: "generic",
        occurred_at: alert.observedAt, delivery_status: "sending", delivery_attempt_count: 1,
        delivery_expires_at: new Date(Date.parse(alert.observedAt) + 5 * 60_000).toISOString() }
    }
  );
  const row = inserted?.[0];
  if (!row) return { sent: 0, failed: 0, duplicate: targets.length };
  const results = await Promise.allSettled(targets.map(token => sendFcmMessage({
    token: token.token, title: event.title, body: event.body, data: event.data,
    tag: event.eventKey, ttlSeconds
  })));
  const sent = results.filter(result => result.status === "fulfilled").length;
  const failed = results.length - sent;
  await supabaseAdminRest("push_alert_events?id=eq." + row.id + "&user_id=eq." + encodeURIComponent(userId), {
    method: "PATCH", timeoutMs: 5000,
    body: { payload: { ...payload, sentCount: sent, failedCount: failed }, sent_count: sent, failed_count: failed,
      delivery_status: sent === targets.length ? "sent" : sent > 0 ? "partial" : "failed",
      ...(sent > 0 ? { sent_at: new Date().toISOString(), delivered_at: new Date().toISOString() } : {}) }
  });
  return { sent, failed, duplicate: 0 };
}
