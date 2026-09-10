import { rapidMoveThresholds, type RapidMoveSymbol } from "@/lib/rapidPriceMove";
import { sendFcmMessage } from "@/lib/server/firebaseMessaging";
import { supabaseAdminRest } from "@/lib/server/supabaseAdmin";
import { ruleAllowed, userPlan } from "@/lib/server/push/entitlements";
import { tokenWants } from "@/lib/server/push/preferences";
import { scanRapidMoveEvent } from "@/lib/server/push/scanners/rapidMoveScanner";
import type { PushAlertEvent, PushSubscriptionRow, PushTokenRow } from "@/lib/server/push/types";
import type { RecentPushAlertEventRow } from "@/lib/server/push/duplicateGuard";

export function sameRapidMove(recent: RecentPushAlertEventRow[], event: PushAlertEvent, now = Date.now()) {
  const previous = recent.filter((row) => row.rule_id === "rapid-price-move" && row.payload?.symbol === event.symbol)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
  if (!previous) return false;
  const age = now - Date.parse(previous.created_at);
  if (previous.event_key === event.eventKey) return true;
  if (previous.payload?.direction !== event.data.direction || age >= 30 * 60000) return false;
  if (age < 5 * 60000) return true;
  const oldPrice = Number(previous.payload?.end_price);
  const price = Number(event.data.end_price);
  const extraChange = (price / oldPrice - 1) * 100 * (event.data.direction === "up" ? 1 : -1);
  const symbol = event.symbol as RapidMoveSymbol;
  const threshold = rapidMoveThresholds[symbol]?.[5];
  // Window rolling alone is not a new move: require additional price movement.
  return !Number.isFinite(extraChange) || !threshold || extraChange < threshold;
}

export async function deliverRapidMoveEvent(userId: string, tokens: PushTokenRow[], event: PushAlertEvent) {
  const targets = tokens.filter((token) => tokenWants(token, event));
  const ttlSeconds = Math.floor((Date.parse(event.data.observed_at) + 120_000 - Date.now()) / 1000);
  if (!targets.length || !Number.isFinite(ttlSeconds) || ttlSeconds <= 0) return { sent: 0, failed: 0, duplicate: 0 };
  const payload = { ...event.data, auditEvidence: event.auditEvidence, sentCount: 0 };
  // Existing unique (user_id,event_key) atomically chooses one sender, and makes
  // the preserved chart available before the notification can be opened.
  const inserted = await supabaseAdminRest<Array<{ id: string }>>(
    "push_alert_events?on_conflict=user_id,event_key&select=id", {
      method: "POST", prefer: "resolution=ignore-duplicates,return=representation", timeoutMs: 5000,
      body: { user_id: userId, market: "crypto", rule_id: event.ruleId, event_key: event.eventKey,
        title: event.title, body: event.body, payload, notification_kind: "generic",
        occurred_at: event.data.observed_at, delivery_status: "sending", delivery_attempt_count: 1 }
    }
  );
  const row = inserted?.[0];
  if (!row) return { sent: 0, failed: 0, duplicate: targets.length };
  const results = await Promise.allSettled(targets.map((token) => sendFcmMessage({
    token: token.token, title: event.title, body: event.body, data: event.data,
    tag: `rapid-price-move:${event.symbol}`, ttlSeconds
  })));
  const sent = results.filter((result) => result.status === "fulfilled").length;
  const failed = results.length - sent;
  await supabaseAdminRest(`push_alert_events?id=eq.${row.id}&user_id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH", timeoutMs: 5000,
    body: { payload: { ...payload, sentCount: sent, failedCount: failed },
      delivery_status: sent === targets.length ? "sent" : sent > 0 ? "partial" : "failed",
      ...(sent > 0 ? { sent_at: new Date().toISOString() } : {}) }
  });
  return { sent, failed, duplicate: 0 };
}

export async function runRapidMoveScan({ dryRun = false }: { dryRun?: boolean } = {}) {
  const result = { sourceCount: 0, candidates: 0, users: 0, sent: 0, failed: 0, suppressed: 0, duplicate: 0, wouldSend: 0, errors: [] as string[] };
  const symbols = ["BTCUSDT", "ETHUSDT"] as const;
  const sources = await Promise.allSettled(symbols.map(scanRapidMoveEvent));
  const events: PushAlertEvent[] = [];
  sources.forEach((source, i) => {
    if (source.status === "fulfilled") { result.sourceCount++; if (source.value) events.push(source.value); }
    else result.errors.push(`${symbols[i]}:source_unavailable`);
  });
  result.candidates = events.length;
  // Quiet markets cost only two bounded market requests, with no account reads.
  if (!events.length) return result;
  const tokens = await supabaseAdminRest<PushTokenRow[]>(
    "push_tokens?select=id,user_id,token,markets,rule_ids&enabled=eq.true&platform=eq.android&provider=eq.fcm&rule_ids=cs.{rapid-price-move}&limit=500", { timeoutMs: 5000 }
  );
  const userIds = Array.from(new Set(tokens.map((token) => token.user_id)));
  if (!userIds.length) return result;
  const subscriptions = await supabaseAdminRest<PushSubscriptionRow[]>(
    `subscriptions?select=user_id,provider,status,plan,market_scope,current_period_end,revoked_at&user_id=in.(${userIds.join(",")})&limit=1000`, { timeoutMs: 5000 }
  );
  const byUser = new Map<string, PushSubscriptionRow[]>();
  for (const row of subscriptions) byUser.set(row.user_id, [...(byUser.get(row.user_id) ?? []), row]);
  result.users = userIds.length;
  // Bound simultaneous account/provider requests independently of user count.
  for (let offset = 0; offset < userIds.length; offset += 8) {
    await Promise.all(userIds.slice(offset, offset + 8).map(async (userId) => {
      try {
        const plan = await userPlan(byUser, userId);
        if (!plan) return;
        const userTokens = tokens.filter((token) => token.user_id === userId);
        if (!events.some((event) => ruleAllowed(event, plan) && userTokens.some((token) => tokenWants(token, event)))) return;
        const since = new Date(Date.now() - 30 * 60000).toISOString();
        const recent = await supabaseAdminRest<RecentPushAlertEventRow[]>(
          `push_alert_events?select=event_key,market,rule_id,payload,created_at&user_id=eq.${userId}&rule_id=eq.rapid-price-move&created_at=gte.${encodeURIComponent(since)}&order=created_at.desc&limit=100`, { timeoutMs: 5000 }
        );
        for (const event of events) {
          if (!ruleAllowed(event, plan)) continue;
          const targets = userTokens.filter((token) => tokenWants(token, event));
          if (!targets.length) continue;
          if (sameRapidMove(recent, event)) { result.suppressed += targets.length; continue; }
          if (dryRun) { result.wouldSend += targets.length; continue; }
          const delivered = await deliverRapidMoveEvent(userId, targets, event);
          result.sent += delivered.sent; result.failed += delivered.failed; result.duplicate += delivered.duplicate;
        }
      } catch { result.errors.push("user_delivery_failed"); }
    }));
  }
  return result;
}
