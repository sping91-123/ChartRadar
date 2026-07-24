import { hasMarketEntitlement } from "@/lib/billing";
import { resolveEffectiveEntitlement } from "@/lib/effectiveEntitlement";
import { isNewsImpactAlertEligible } from "@/lib/newsImpact";
import { remainingNewsPushTargets, resolveNewsDeliveryStatus, selectLatestNewsReaction } from "@/lib/newsImpactDelivery";
import { sendFcmMessage } from "@/lib/server/firebaseMessaging";
import type { NewsImpactEventRow, NewsReactionRow } from "@/lib/server/news/newsImpactStore";
import { isAllowedNewsSourceUrl, isAllowedUrlForHosts, isNewsSourcePushEnabled } from "@/lib/server/news/sourceCatalog";
import type { PushSubscriptionRow, PushTokenRow } from "@/lib/server/push/types";
import { supabaseAdminAuth, supabaseAdminRest, supabaseAdminRpc } from "@/lib/server/supabaseAdmin";
import type { SupabaseUser } from "@/lib/supabase";

interface NewsAlertPreferenceRow {
  user_id: string;
  market: "crypto" | "global";
  enabled: boolean;
}

interface NewsOutboxRow {
  id: string;
  user_id: string;
  market: "crypto" | "stocks";
  event_key: string;
  title: string;
  body: string;
  payload: Record<string, string>;
  delivery_status: "pending" | "sending" | "sent" | "partial" | "failed" | "in_app_only";
  delivery_attempt_count: number;
  delivery_not_before: string | null;
  delivery_expires_at: string | null;
  delivery_succeeded_token_ids: string[];
  delivery_attempted_token_ids: string[];
  news_event_id: string | null;
  news_reaction_id: string | null;
}

const OUTBOX_REQUEST_TIMEOUT_MS = 10_000;
const OUTBOX_LEASE_SECONDS = 300;

function groupSubscriptions(rows: PushSubscriptionRow[]) {
  const grouped = new Map<string, PushSubscriptionRow[]>();
  for (const row of rows) {
    const current = grouped.get(row.user_id) ?? [];
    current.push(row);
    grouped.set(row.user_id, current);
  }
  return grouped;
}

function canReceiveNewsMarket(
  userId: string,
  market: "crypto" | "global",
  subscriptions: Map<string, PushSubscriptionRow[]>,
  adminIds: ReadonlySet<string>
) {
  const entitlement = resolveEffectiveEntitlement({
    isAuthenticated: true,
    isAdmin: adminIds.has(userId),
    subscriptions: subscriptions.get(userId) ?? []
  });
  return hasMarketEntitlement(entitlement.plan, market === "crypto" ? "crypto" : "stocks");
}

function newsAlertCopy(event: NewsImpactEventRow, reaction: NewsReactionRow) {
  const label = reaction.classification === "risk_increase"
    ? "리스크 증가"
    : reaction.classification === "decision_state_changed"
      ? "판단 상태 변화"
      : "기존 판단과 충돌";
  return {
    title: `뉴스 후 시장 데이터: ${label}`,
    body: reaction.reaction_summary.slice(0, 420),
    eventKey: `news-impact:${event.semantic_key}:${reaction.event_version}:${reaction.id}`
  };
}

function newsAlertPayload(event: NewsImpactEventRow, reaction: NewsReactionRow) {
  const asset = reaction.target === "global" ? "" : reaction.target;
  const targetPath = event.market === "crypto"
    ? `/crypto/news?event=${event.id}&asset=${asset || "btc"}&source=alert`
    : `/news?market=global&event=${event.id}&source=alert`;
  return {
    type: "news_impact",
    alertKind: "news_impact",
    destination: "news_impact",
    market: event.market,
    eventId: event.id,
    reactionId: reaction.id,
    asset,
    targetPath
  };
}

async function exactAdminIds(userIds: string[]) {
  const admins = new Set<string>();
  for (let index = 0; index < userIds.length; index += 20) {
    const batch = userIds.slice(index, index + 20);
    const users = await Promise.all(batch.map((userId) =>
      supabaseAdminAuth<SupabaseUser | null>(`admin/users/${encodeURIComponent(userId)}`, {
        allowNotFound: true,
        timeoutMs: OUTBOX_REQUEST_TIMEOUT_MS
      }).catch(() => null)
    ));
    users.forEach((user, userIndex) => {
      if (user?.app_metadata?.role === "admin") admins.add(batch[userIndex]);
    });
  }
  return admins;
}

function pushEligibleSourceItemIds(event: NewsImpactEventRow) {
  return Array.isArray(event.metadata?.push_source_item_ids)
    ? event.metadata.push_source_item_ids.filter((value): value is string => typeof value === "string")
    : [];
}

export async function enqueueNewsImpactAlerts(candidates: Array<{ event: NewsImpactEventRow; reaction: NewsReactionRow }>) {
  const eligible = candidates.filter(({ event, reaction }) => (
    event.metadata?.push_eligible === true &&
    pushEligibleSourceItemIds(event).length > 0 &&
    isNewsImpactAlertEligible(reaction)
  ));
  if (eligible.length === 0) return { eligible: 0, claimed: 0, entitlementBlocked: 0 };
  const markets = Array.from(new Set(eligible.map(({ event }) => event.market)));
  const preferences = await supabaseAdminRest<NewsAlertPreferenceRow[]>(
    `news_alert_preferences?enabled=eq.true&market=in.(${markets.join(",")})&limit=1000`,
    { timeoutMs: OUTBOX_REQUEST_TIMEOUT_MS }
  );
  if (preferences.length === 0) return { eligible: eligible.length, claimed: 0, entitlementBlocked: 0 };
  const userIds = Array.from(new Set(preferences.map((preference) => preference.user_id)));
  const [subscriptions, adminIds, deletionRows] = await Promise.all([
    supabaseAdminRest<PushSubscriptionRow[]>(
      `subscriptions?select=user_id,provider,status,plan,market_scope,current_period_end,revoked_at&user_id=in.(${userIds.join(",")})&order=current_period_end.desc&limit=2000`,
      { timeoutMs: OUTBOX_REQUEST_TIMEOUT_MS }
    ),
    exactAdminIds(userIds),
    supabaseAdminRest<Array<{ user_id: string }>>(
      `account_deletion_requests?select=user_id&user_id=in.(${userIds.join(",")})&status=in.(pending,processing,failed)&limit=1000`,
      { timeoutMs: OUTBOX_REQUEST_TIMEOUT_MS }
    )
  ]);
  const subscriptionsByUser = groupSubscriptions(subscriptions);
  const deletionUsers = new Set(deletionRows.map((row) => row.user_id));
  let claimed = 0;
  let entitlementBlocked = 0;
  for (const { event, reaction } of eligible) {
    for (const preference of preferences.filter((row) => row.market === event.market)) {
      if (deletionUsers.has(preference.user_id)) {
        entitlementBlocked += 1;
        continue;
      }
      if (!canReceiveNewsMarket(preference.user_id, event.market, subscriptionsByUser, adminIds)) {
        entitlementBlocked += 1;
        continue;
      }
      const copy = newsAlertCopy(event, reaction);
      const rows = await supabaseAdminRpc<NewsOutboxRow[]>("claim_news_impact_alert", {
        p_user_id: preference.user_id,
        p_reaction_id: reaction.id,
        p_event_key: copy.eventKey,
        p_title: copy.title,
        p_body: copy.body,
        p_payload: newsAlertPayload(event, reaction)
      }, { timeoutMs: OUTBOX_REQUEST_TIMEOUT_MS });
      if (rows.length > 0) claimed += 1;
    }
  }
  return { eligible: eligible.length, claimed, entitlementBlocked };
}

function tokenMatchesMarket(token: PushTokenRow, market: NewsOutboxRow["market"]) {
  if (!token.markets || token.markets.length === 0) return true;
  return market === "crypto" ? token.markets.includes("crypto") : token.markets.some((value) => value === "stocks" || value === "global");
}

async function allowedPushEligibleSourceExists(eventId: string, pushSourceItemIds: string[]) {
  if (pushSourceItemIds.length === 0) return false;
  const links = await supabaseAdminRest<Array<{ source_item_id: string }>>(
    `news_event_sources?select=source_item_id&event_id=eq.${encodeURIComponent(eventId)}&limit=100`,
    { timeoutMs: OUTBOX_REQUEST_TIMEOUT_MS }
  );
  const linkedIds = new Set(links.map((link) => link.source_item_id));
  const itemIds = pushSourceItemIds.filter((sourceItemId) => linkedIds.has(sourceItemId));
  if (itemIds.length === 0) return false;
  const items = await supabaseAdminRest<Array<{ source_id: string; policy_status: string; canonical_url: string }>>(
    `news_source_items?select=source_id,policy_status,canonical_url&id=in.(${itemIds.join(",")})&policy_status=eq.allowed&limit=100`,
    { timeoutMs: OUTBOX_REQUEST_TIMEOUT_MS }
  );
  if (items.length === 0) return false;
  const sourceIds = Array.from(new Set(items.map((item) => item.source_id)));
  const sources = await supabaseAdminRest<Array<{ source_id: string; allowed_hosts: string[] }>>(
    `news_source_catalog?select=source_id,allowed_hosts&source_id=in.(${sourceIds.join(",")})&policy_status=eq.allowed&enabled=eq.true&limit=100`,
    { timeoutMs: OUTBOX_REQUEST_TIMEOUT_MS }
  );
  const allowedHosts = new Map(sources.map((source) => [source.source_id, source.allowed_hosts]));
  return items.some((item) => (
    isNewsSourcePushEnabled(item.source_id) &&
    isAllowedNewsSourceUrl(item.source_id, item.canonical_url) &&
    isAllowedUrlForHosts(item.canonical_url, allowedHosts.get(item.source_id) ?? [])
  ));
}

async function validateDeliveryLease(lease: NewsOutboxRow) {
  if (!lease.news_event_id || !lease.news_reaction_id) return "missing_news_link";
  const claimedReactions = await supabaseAdminRest<NewsReactionRow[]>(
    `news_market_reactions?id=eq.${encodeURIComponent(lease.news_reaction_id)}&event_id=eq.${encodeURIComponent(lease.news_event_id)}&limit=1`,
    { timeoutMs: OUTBOX_REQUEST_TIMEOUT_MS }
  );
  const claimedReaction = claimedReactions[0];
  if (!claimedReaction) return "reaction_no_longer_exists";
  const events = await supabaseAdminRest<NewsImpactEventRow[]>(
    `news_impact_events?id=eq.${encodeURIComponent(lease.news_event_id)}&limit=1`,
    { timeoutMs: OUTBOX_REQUEST_TIMEOUT_MS }
  );
  const event = events[0];
  if (!event || event.status === "retracted" || event.version !== claimedReaction.event_version || event.metadata?.push_eligible !== true) {
    return "event_revised_or_retracted";
  }
  const stageRows = await supabaseAdminRest<NewsReactionRow[]>(
    `news_market_reactions?event_id=eq.${encodeURIComponent(event.id)}&event_version=eq.${event.version}&target=eq.${claimedReaction.target}&limit=10`,
    { timeoutMs: OUTBOX_REQUEST_TIMEOUT_MS }
  );
  const reaction = selectLatestNewsReaction(stageRows);
  if (!reaction || !isNewsImpactAlertEligible(reaction)) return "superseded_by_non_actionable_reaction";
  const expectedMarket = event.market === "crypto" ? "crypto" : "stocks";
  if (lease.market !== expectedMarket) return "market_mismatch";
  if (event.market === "crypto" && (reaction.target === "global" || !event.targets.includes(reaction.target))) return "asset_mismatch";
  if (event.market === "global" && (reaction.target !== "global" || !event.targets.includes("global"))) return "market_mismatch";
  if (!await allowedPushEligibleSourceExists(event.id, pushEligibleSourceItemIds(event))) return "source_not_allowed";

  const [preferences, deletionRows] = await Promise.all([
    supabaseAdminRest<NewsAlertPreferenceRow[]>(
      `news_alert_preferences?user_id=eq.${encodeURIComponent(lease.user_id)}&market=eq.${event.market}&enabled=eq.true&limit=1`,
      { timeoutMs: OUTBOX_REQUEST_TIMEOUT_MS }
    ),
    supabaseAdminRest<Array<{ user_id: string }>>(
      `account_deletion_requests?select=user_id&user_id=eq.${encodeURIComponent(lease.user_id)}&status=in.(pending,processing,failed)&limit=1`,
      { timeoutMs: OUTBOX_REQUEST_TIMEOUT_MS }
    )
  ]);
  if (deletionRows.length > 0) return "account_deletion_pending";
  if (preferences.length === 0) return "preference_disabled";
  const [subscriptions, user] = await Promise.all([
    supabaseAdminRest<PushSubscriptionRow[]>(
      `subscriptions?select=user_id,provider,status,plan,market_scope,current_period_end,revoked_at&user_id=eq.${encodeURIComponent(lease.user_id)}&order=current_period_end.desc&limit=50`,
      { timeoutMs: OUTBOX_REQUEST_TIMEOUT_MS }
    ),
    supabaseAdminAuth<SupabaseUser | null>(`admin/users/${encodeURIComponent(lease.user_id)}`, {
      allowNotFound: true,
      timeoutMs: OUTBOX_REQUEST_TIMEOUT_MS
    }).catch(() => null)
  ]);
  const grouped = groupSubscriptions(subscriptions);
  const adminIds = new Set(user?.app_metadata?.role === "admin" ? [lease.user_id] : []);
  if (!canReceiveNewsMarket(lease.user_id, event.market, grouped, adminIds)) return "entitlement_expired";

  if (reaction.id !== lease.news_reaction_id) {
    const copy = newsAlertCopy(event, reaction);
    const rows = await supabaseAdminRest<NewsOutboxRow[]>(
      `push_alert_events?id=eq.${encodeURIComponent(lease.id)}&delivery_status=eq.sending&delivery_attempt_count=eq.${lease.delivery_attempt_count}`,
      {
        method: "PATCH",
        body: {
          news_reaction_id: reaction.id,
          title: copy.title,
          body: copy.body,
          payload: newsAlertPayload(event, reaction)
        },
        prefer: "return=representation",
        timeoutMs: OUTBOX_REQUEST_TIMEOUT_MS
      }
    );
    if (!rows[0]) return "delivery_lease_lost";
    return rows[0];
  }
  return lease;
}

async function completeInAppOnly(lease: NewsOutboxRow, reason: string) {
  await supabaseAdminRpc<boolean>("complete_news_impact_delivery", {
    p_event_id: lease.id,
    p_attempt: lease.delivery_attempt_count,
    p_status: "in_app_only",
    p_sent_count: 0,
    p_failed_count: 0,
    p_error: reason,
    p_success_token_ids: []
  }, { timeoutMs: OUTBOX_REQUEST_TIMEOUT_MS });
  await supabaseAdminRest(`push_alert_events?id=eq.${lease.id}`, {
    method: "PATCH",
    body: { push_suppressed_reason: reason },
    timeoutMs: OUTBOX_REQUEST_TIMEOUT_MS
  }).catch(() => undefined);
}

export async function deliverNewsImpactOutbox(deliveryEnabled: boolean) {
  const now = new Date().toISOString();
  await supabaseAdminRpc<number>("finalize_exhausted_news_impact_deliveries", {}, {
    timeoutMs: OUTBOX_REQUEST_TIMEOUT_MS
  }).catch(() => 0);
  const pending = await supabaseAdminRest<NewsOutboxRow[]>(
    `push_alert_events?rule_id=eq.news-impact&delivery_status=in.(pending,failed,sending)&delivery_attempt_count=lt.3&or=(delivery_not_before.is.null,delivery_not_before.lte.${encodeURIComponent(now)})&order=delivery_attempt_count.asc,occurred_at.asc&limit=100`,
    { timeoutMs: OUTBOX_REQUEST_TIMEOUT_MS }
  ).catch(() => []);
  let sent = 0;
  let failed = 0;
  let inAppOnly = 0;
  for (const event of pending) {
    if (event.delivery_expires_at && Date.parse(event.delivery_expires_at) <= Date.now()) {
      const expired = await supabaseAdminRpc<boolean>("expire_news_impact_delivery", {
        p_event_id: event.id
      }, { timeoutMs: OUTBOX_REQUEST_TIMEOUT_MS }).catch(() => false);
      if (expired) inAppOnly += 1;
      continue;
    }
    const leased = await supabaseAdminRpc<NewsOutboxRow[]>("lease_news_impact_delivery", {
      p_event_id: event.id,
      p_lease_seconds: OUTBOX_LEASE_SECONDS
    }, { timeoutMs: OUTBOX_REQUEST_TIMEOUT_MS });
    const initialLease = leased[0];
    if (!initialLease) continue;
    const validation = await validateDeliveryLease(initialLease).catch(() => "delivery_revalidation_failed" as const);
    if (typeof validation === "string") {
      await completeInAppOnly(initialLease, validation);
      inAppOnly += 1;
      continue;
    }
    const lease = validation;
    const tokens = await supabaseAdminRest<PushTokenRow[]>(
      `push_tokens?select=id,user_id,token,markets,rule_ids&user_id=eq.${lease.user_id}&enabled=eq.true&platform=eq.android&provider=eq.fcm&limit=20`,
      { timeoutMs: OUTBOX_REQUEST_TIMEOUT_MS }
    ).catch(() => []);
    const targets = tokens.filter((token) => tokenMatchesMarket(token, lease.market));
    const remainingTargets = remainingNewsPushTargets(targets, lease.delivery_attempted_token_ids ?? []);
    let eventSent = 0;
    let eventFailed = 0;
    let error: string | null = null;
    const succeededTokenIds: string[] = [];
    let claimedTargets = remainingTargets;
    if (deliveryEnabled && remainingTargets.length > 0) {
      const claimedTokenIds = await supabaseAdminRpc<string[]>("claim_news_impact_delivery_tokens", {
        p_event_id: lease.id,
        p_attempt: lease.delivery_attempt_count,
        p_token_ids: remainingTargets.map((token) => token.id)
      }, { timeoutMs: OUTBOX_REQUEST_TIMEOUT_MS });
      const claimedSet = new Set(claimedTokenIds);
      claimedTargets = remainingTargets.filter((token) => claimedSet.has(token.id));
      const results = await Promise.allSettled(claimedTargets.map((token) => sendFcmMessage({
        token: token.token,
        title: lease.title,
        body: lease.body,
        data: Object.fromEntries(Object.entries(lease.payload).map(([key, value]) => [key, String(value)])),
        tag: lease.news_event_id ? `news-impact:${lease.news_event_id}` : `news-impact:${lease.id}`
      })));
      eventSent = results.filter((result) => result.status === "fulfilled").length;
      eventFailed = results.length - eventSent + (remainingTargets.length - claimedTargets.length);
      results.forEach((result, index) => {
        if (result.status === "fulfilled") succeededTokenIds.push(claimedTargets[index].id);
      });
      error = results.find((result): result is PromiseRejectedResult => result.status === "rejected")?.reason instanceof Error
        ? results.find((result): result is PromiseRejectedResult => result.status === "rejected")!.reason.message
        : claimedTargets.length < remainingTargets.length
          ? "token_attempt_claim_incomplete"
          : null;
    }
    const sentBefore = lease.delivery_succeeded_token_ids?.length ?? 0;
    const allTargetsAlreadyAttempted = deliveryEnabled && targets.length > 0 && remainingTargets.length === 0;
    const status = allTargetsAlreadyAttempted
      ? sentBefore >= targets.length
        ? "sent"
        : sentBefore > 0
          ? "partial"
          : "in_app_only"
      : resolveNewsDeliveryStatus({
          deliveryEnabled,
          targetCount: targets.length,
          sentBefore,
          sentNow: eventSent,
          failedNow: eventFailed,
          attempt: lease.delivery_attempt_count,
          allowRetry: false
        });
    await supabaseAdminRpc<boolean>("complete_news_impact_delivery", {
      p_event_id: lease.id,
      p_attempt: lease.delivery_attempt_count,
      p_status: status,
      p_sent_count: eventSent,
      p_failed_count: eventFailed,
      p_error: error?.slice(0, 500) ?? null,
      p_success_token_ids: succeededTokenIds
    }, { timeoutMs: OUTBOX_REQUEST_TIMEOUT_MS });
    if (status === "in_app_only") {
      await supabaseAdminRest(`push_alert_events?id=eq.${lease.id}`, {
        method: "PATCH",
        body: {
          push_suppressed_reason: !deliveryEnabled
            ? "push_disabled"
            : targets.length === 0
              ? "no_fcm_token"
              : "delivery_attempts_exhausted"
        },
        timeoutMs: OUTBOX_REQUEST_TIMEOUT_MS
      }).catch(() => undefined);
    }
    sent += eventSent;
    failed += eventFailed;
    if (status === "in_app_only") inAppOnly += 1;
  }
  return { events: pending.length, sent, failed, inAppOnly };
}
