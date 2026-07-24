import type { PerpetualAsset, PerpetualDecisionSnapshot } from "@/lib/perpetualDecisionSnapshot";
import {
  type GlobalReactionObservation,
  type NewsImpactClassification,
  type NewsImpactEvent,
  type NewsImpactReaction,
  type NewsImpactStage,
  type NewsMarket,
  type NewsReactionMetric,
  type NewsRiskEffect,
  type NewsSourceReference
} from "@/lib/newsImpact";
import { isAllowedNewsSourceUrl, isAllowedUrlForHosts, newsSourceById, newsSourceCatalog } from "@/lib/server/news/sourceCatalog";
import type { NormalizedNewsSourceItem } from "@/lib/server/news/normalizeNewsSourceItem";
import { repairLegacyMacroPresentation } from "@/lib/newsImpactPresentationRules";
import { isSupabaseAdminConfigured, supabaseAdminRest, supabaseAdminRpc } from "@/lib/server/supabaseAdmin";

export interface NewsSourceItemRow {
  id: string;
  source_id: string;
  external_id: string;
  canonical_url: string;
  original_title: string;
  published_at: string;
  first_seen_at: string;
  content_hash: string;
  policy_status: "allowed" | "review" | "blocked";
  markets: NewsMarket[];
  targets: Array<"btc" | "eth" | "global">;
  category: NewsImpactEvent["category"];
  event_type: string;
  entities: string[];
  action: string;
  structured_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface NewsImpactEventRow {
  id: string;
  semantic_key: string;
  market: NewsMarket;
  category: NewsImpactEvent["category"];
  targets: Array<"btc" | "eth" | "global">;
  importance: NewsImpactEvent["importance"];
  version: number;
  status: NewsImpactEvent["status"];
  occurred_at: string;
  first_seen_at: string;
  headline: string;
  fact_summary: string;
  primary_source_item_id: string | null;
  macro_event_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface NewsReactionRow {
  id: string;
  event_id: string;
  event_version: number;
  target: "btc" | "eth" | "global";
  stage: NewsImpactStage;
  classification: NewsImpactClassification;
  risk_effect: NewsRiskEffect;
  quality: NewsImpactReaction["quality"];
  event_at: string;
  evaluated_at: string | null;
  next_check_at: string | null;
  pre_snapshot_id: string | null;
  evaluated_snapshot_id: string | null;
  baseline_observation_id: string | null;
  evaluated_observation_id: string | null;
  price_change_percent: number | null;
  state_before: NewsImpactReaction["stateBefore"];
  state_after: NewsImpactReaction["stateAfter"];
  reaction_summary: string;
  metrics: { items?: NewsReactionMetric[]; [key: string]: unknown };
  created_at: string;
  updated_at: string;
}

interface GlobalObservationRow {
  id: string;
  bucket_at: string;
  observed_at: string;
  quality: GlobalReactionObservation["quality"];
  market_mode: GlobalReactionObservation["marketMode"];
  metrics: Record<string, number | null>;
  signal_groups: GlobalReactionObservation["signalGroups"];
  created_at: string;
}

interface NewsEventSourceRow {
  event_id: string;
  source_item_id: string;
  is_primary: boolean;
}

function asArray<T>(value: T[] | null | undefined) {
  return Array.isArray(value) ? value : [];
}

function rowToSource(row: NewsSourceItemRow): NewsSourceReference {
  return {
    id: row.id,
    name: newsSourceById(row.source_id)?.name ?? row.source_id,
    kind: "official",
    url: row.canonical_url,
    publishedAt: row.published_at
  };
}

function rowToReaction(row: NewsReactionRow, event: NewsImpactEventRow): NewsImpactReaction {
  const frozen = row.metrics?.eventContext && typeof row.metrics.eventContext === "object"
    ? row.metrics.eventContext as { headline?: unknown; factSummary?: unknown }
    : null;
  const presentation = repairLegacyMacroPresentation({
    category: event.category,
    macroEventKey: typeof event.metadata?.macro_source_event_id === "string" ? event.metadata.macro_source_event_id : null,
    headline: typeof frozen?.headline === "string" ? frozen.headline : event.headline,
    factSummary: typeof frozen?.factSummary === "string" ? frozen.factSummary : event.fact_summary
  });
  const rawNextCondition = row.metrics?.nextCondition && typeof row.metrics.nextCondition === "object"
    ? row.metrics.nextCondition as Record<string, unknown>
    : null;
  const nextCondition = rawNextCondition &&
    typeof rawNextCondition.label === "string" &&
    ["15m", "1h", "4h"].includes(String(rawNextCondition.timeframe)) &&
    ["price_cross_above", "price_cross_below", "pressure_state_change", "decision_state_change"].includes(String(rawNextCondition.kind))
    ? {
        label: rawNextCondition.label.slice(0, 180),
        timeframe: rawNextCondition.timeframe as "15m" | "1h" | "4h",
        kind: rawNextCondition.kind as "price_cross_above" | "price_cross_below" | "pressure_state_change" | "decision_state_change",
        threshold: typeof rawNextCondition.threshold === "number" && Number.isFinite(rawNextCondition.threshold)
          ? rawNextCondition.threshold
          : null
      }
    : null;
  return {
    eventId: row.event_id,
    reactionId: row.id,
    eventVersion: row.event_version,
    market: event.market,
    target: row.target,
    stage: row.stage,
    classification: row.classification,
    riskEffect: row.risk_effect,
    eventAt: row.event_at,
    evaluatedAt: row.evaluated_at,
    headline: presentation.headline,
    factSummary: presentation.factSummary,
    reactionSummary: row.reaction_summary,
    nextCheckAt: row.next_check_at,
    ...(row.pre_snapshot_id ? { preSnapshotId: row.pre_snapshot_id } : {}),
    ...(row.evaluated_snapshot_id ? { evaluatedSnapshotId: row.evaluated_snapshot_id } : {}),
    quality: row.quality,
    priceChangePercent: row.price_change_percent === null ? null : Number(row.price_change_percent),
    stateBefore: row.state_before,
    stateAfter: row.state_after,
    ...(nextCondition ? { nextCondition } : {})
  };
}

function stageRank(stage: NewsImpactStage) {
  return stage === "final_60m" ? 3 : stage === "provisional_15m" ? 2 : 1;
}

export function newsSyncBucketAt(now = new Date()) {
  return new Date(Math.floor(now.getTime() / (5 * 60_000)) * 5 * 60_000).toISOString();
}

export async function claimNewsSyncRun(now = new Date()) {
  if (!isSupabaseAdminConfigured()) return null;
  return supabaseAdminRpc<string | null>("claim_news_sync_run", { p_bucket_at: newsSyncBucketAt(now) }, { timeoutMs: 10_000 });
}

export async function renewNewsSyncRun(runId: string) {
  if (!isSupabaseAdminConfigured()) return false;
  return supabaseAdminRpc<boolean>("renew_news_sync_run", {
    p_run_id: runId,
    p_lease_seconds: 600
  }, { timeoutMs: 10_000 });
}

export async function finishNewsSyncRun(runId: string, input: {
  startedAt: string;
  finishedAt: string;
  status: "stored" | "checked" | "partial" | "failed" | "skipped";
  sourceResults: unknown[];
  fetchedCount: number;
  acceptedCount: number;
  duplicateCount: number;
  evaluatedCount: number;
  wouldSendCount: number;
  error?: string | null;
}) {
  if (!isSupabaseAdminConfigured()) return;
  await supabaseAdminRest(`news_sync_runs?id=eq.${encodeURIComponent(runId)}`, {
    method: "PATCH",
    body: {
      started_at: input.startedAt,
      finished_at: input.finishedAt,
      status: input.status,
      source_results: input.sourceResults,
      fetched_count: input.fetchedCount,
      accepted_count: input.acceptedCount,
      duplicate_count: input.duplicateCount,
      evaluated_count: input.evaluatedCount,
      would_send_count: input.wouldSendCount,
      error: input.error?.slice(0, 500) ?? null,
      lease_expires_at: null
    },
    timeoutMs: 10_000
  });
}

export async function readNewsSourceHealth(sourceId: string) {
  if (!isSupabaseAdminConfigured()) return null;
  const rows = await supabaseAdminRest<Array<{
    source_id: string;
    consecutive_failures: number;
    circuit_open_until: string | null;
  }>>(`news_source_health?source_id=eq.${encodeURIComponent(sourceId)}&limit=1`).catch(() => []);
  return rows[0] ?? null;
}

export async function readEnabledNewsSourceIds() {
  return new Set((await readEnabledNewsSourcePolicies()).keys());
}

export async function readEnabledNewsSourcePolicies() {
  if (!isSupabaseAdminConfigured()) return new Map<string, string[]>();
  const rows = await supabaseAdminRest<Array<{ source_id: string; allowed_hosts: string[] }>>(
    "news_source_catalog?select=source_id,allowed_hosts&policy_status=eq.allowed&enabled=eq.true&limit=100"
  );
  return new Map(rows
    .filter((row) => Array.isArray(row.allowed_hosts) && row.allowed_hosts.length > 0)
    .map((row) => [row.source_id, row.allowed_hosts] as const));
}

export async function recordNewsSourceSuccess(sourceId: string) {
  if (!isSupabaseAdminConfigured()) return;
  await supabaseAdminRest("news_source_health?on_conflict=source_id", {
    method: "POST",
    body: {
      source_id: sourceId,
      consecutive_failures: 0,
      circuit_open_until: null,
      last_success_at: new Date().toISOString(),
      last_error: null
    },
    prefer: "resolution=merge-duplicates"
  });
}

export async function recordNewsSourceFailure(sourceId: string, error: unknown) {
  if (!isSupabaseAdminConfigured()) return;
  const current = await readNewsSourceHealth(sourceId);
  const failures = (current?.consecutive_failures ?? 0) + 1;
  const now = new Date();
  await supabaseAdminRest("news_source_health?on_conflict=source_id", {
    method: "POST",
    body: {
      source_id: sourceId,
      consecutive_failures: failures,
      circuit_open_until: failures >= 3 ? new Date(now.getTime() + 15 * 60_000).toISOString() : null,
      last_failure_at: now.toISOString(),
      last_error: (error instanceof Error ? error.message : String(error)).slice(0, 500)
    },
    prefer: "resolution=merge-duplicates"
  });
}

export async function upsertNewsSourceItem(item: NormalizedNewsSourceItem) {
  const existing = await supabaseAdminRest<NewsSourceItemRow[]>(
    `news_source_items?source_id=eq.${encodeURIComponent(item.sourceId)}&external_id=eq.${encodeURIComponent(item.externalId)}&limit=1`
  );
  const rows = await supabaseAdminRest<NewsSourceItemRow[]>("news_source_items?on_conflict=source_id,external_id", {
    method: "POST",
    body: {
      source_id: item.sourceId,
      external_id: item.externalId,
      canonical_url: item.canonicalUrl,
      original_title: item.originalTitle,
      published_at: item.publishedAt,
      first_seen_at: existing[0]?.first_seen_at ?? item.firstSeenAt,
      content_hash: item.contentHash,
      policy_status: "allowed",
      markets: item.markets,
      targets: item.targets,
      category: item.category,
      event_type: item.eventType,
      entities: item.entities,
      action: item.action,
      structured_payload: item.structuredPayload
    },
    prefer: "resolution=merge-duplicates,return=representation"
  });
  const row = rows[0];
  if (!row) throw new Error("news_source_item_upsert_empty");
  return { row, changed: Boolean(existing[0] && existing[0].content_hash !== item.contentHash), duplicate: Boolean(existing[0] && existing[0].content_hash === item.contentHash) };
}

export async function upsertNewsImpactEvent(input: {
  semanticKey: string;
  market: NewsMarket;
  item: NormalizedNewsSourceItem;
  sourceItem: NewsSourceItemRow;
  headline: string;
  factSummary: string;
  macroEventId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const existing = await supabaseAdminRest<NewsImpactEventRow[]>(
    `news_impact_events?semantic_key=eq.${encodeURIComponent(input.semanticKey)}&market=eq.${input.market}&limit=1`
  );
  const previous = existing[0];
  const existingLinks = previous
    ? await supabaseAdminRest<NewsEventSourceRow[]>(
        `news_event_sources?event_id=eq.${previous.id}&source_item_id=eq.${input.sourceItem.id}&limit=1`
      )
    : [];
  const sourceHashes = previous?.metadata?.source_hashes && typeof previous.metadata.source_hashes === "object"
    ? previous.metadata.source_hashes as Record<string, unknown>
    : {};
  const previousSourceHash = typeof sourceHashes[input.sourceItem.id] === "string"
    ? sourceHashes[input.sourceItem.id] as string
    : previous?.primary_source_item_id === input.sourceItem.id && typeof previous.metadata?.content_hash === "string"
      ? previous.metadata.content_hash
      : null;
  const sourceAlreadyLinked = Boolean(previous && (previous.primary_source_item_id === input.sourceItem.id || existingLinks.length > 0));
  const changed = Boolean(previous && sourceAlreadyLinked && previousSourceHash !== input.item.contentHash);
  const presentationChanged = Boolean(
    previous &&
    typeof input.metadata?.summary_rule_version === "string" &&
    previous.metadata?.summary_rule_version !== input.metadata.summary_rule_version
  );
  const previousHistory = Array.isArray(previous?.metadata?.revision_history)
    ? previous.metadata.revision_history as unknown[]
    : [];
  const previousRevisionDetectedAt = typeof previous?.metadata?.revision_detected_at === "string"
    ? previous.metadata.revision_detected_at
    : null;
  const previousPushSourceItemIds = Array.isArray(previous?.metadata?.push_source_item_ids)
    ? previous.metadata.push_source_item_ids.filter((value): value is string => typeof value === "string")
    : previous?.metadata?.push_eligible === true && previous.primary_source_item_id
      ? [previous.primary_source_item_id]
      : [];
  const pushSourceItemIds = input.metadata?.push_eligible === true
    ? Array.from(new Set([...previousPushSourceItemIds, input.sourceItem.id]))
    : previousPushSourceItemIds.filter((sourceItemId) => sourceItemId !== input.sourceItem.id);
  const revisionHistory = previous && changed
    ? [...previousHistory, {
        version: previous.version,
        headline: previous.headline,
        factSummary: previous.fact_summary,
        updatedAt: previous.version > 1
          ? previousRevisionDetectedAt ?? previous.updated_at
          : previous.first_seen_at
      }].slice(-20)
    : previousHistory;
  const scopedTargets = input.item.targets.filter((target) => input.market === "crypto" ? target !== "global" : target === "global");
  const importanceRank = { normal: 1, high: 2, critical: 3 } as const;
  const storedSourceAdmissions = previous?.metadata?.source_admissions && typeof previous.metadata.source_admissions === "object"
    ? previous.metadata.source_admissions as Record<string, unknown>
    : {};
  const sourceAdmissions: Record<string, {
    targets: string[];
    importance: "normal" | "high" | "critical";
    active: boolean;
  }> = {};
  for (const [sourceItemId, value] of Object.entries(storedSourceAdmissions)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const record = value as Record<string, unknown>;
    const sourceImportance = record.importance === "critical" || record.importance === "high" ? record.importance : "normal";
    sourceAdmissions[sourceItemId] = {
      targets: Array.isArray(record.targets) ? record.targets.filter((target): target is string => typeof target === "string") : [],
      importance: sourceImportance,
      active: record.active !== false
    };
  }
  if (previous?.primary_source_item_id && Object.keys(sourceAdmissions).length === 0) {
    sourceAdmissions[previous.primary_source_item_id] = {
      targets: previous.targets,
      importance: previous.importance,
      active: true
    };
  }
  sourceAdmissions[input.sourceItem.id] = {
    targets: scopedTargets,
    importance: input.item.importance,
    active: true
  };
  const activeAdmissions = Object.values(sourceAdmissions).filter((sourceAdmission) => sourceAdmission.active);
  const targets = Array.from(new Set(activeAdmissions.flatMap((sourceAdmission) => sourceAdmission.targets)));
  const importance = activeAdmissions.reduce<"normal" | "high" | "critical">(
    (highest, sourceAdmission) => importanceRank[sourceAdmission.importance] > importanceRank[highest]
      ? sourceAdmission.importance
      : highest,
    "normal"
  );
  const body = {
    semantic_key: input.semanticKey,
    market: input.market,
    category: previous?.category ?? input.item.category,
    targets,
    importance,
    version: previous ? previous.version + (changed ? 1 : 0) : 1,
    status: previous ? (changed ? "revised" : previous.status) : "active",
    occurred_at: changed || !previous ? input.item.publishedAt : previous.occurred_at,
    first_seen_at: previous?.first_seen_at ?? input.item.firstSeenAt,
    headline: (changed || presentationChanged || !previous ? input.headline : previous.headline).slice(0, 180),
    fact_summary: (changed || presentationChanged || !previous ? input.factSummary : previous.fact_summary).slice(0, 600),
    primary_source_item_id: previous?.primary_source_item_id ?? input.sourceItem.id,
    macro_event_id: input.macroEventId ?? previous?.macro_event_id ?? null,
    metadata: {
      ...(previous?.metadata ?? {}),
      ...(changed || presentationChanged || !previous ? input.metadata ?? {} : {}),
      push_eligible: pushSourceItemIds.length > 0,
      push_source_item_ids: pushSourceItemIds,
      content_hash: previous?.primary_source_item_id && previous.primary_source_item_id !== input.sourceItem.id
        ? previous.metadata?.content_hash ?? input.item.contentHash
        : input.item.contentHash,
      source_hashes: { ...sourceHashes, [input.sourceItem.id]: input.item.contentHash },
      source_admissions: sourceAdmissions,
      macro_source_event_id: typeof input.item.structuredPayload.macroSourceEventId === "string"
        ? input.item.structuredPayload.macroSourceEventId
        : previous?.metadata?.macro_source_event_id ?? null,
      revision_detected_at: changed
        ? input.item.firstSeenAt
        : previousRevisionDetectedAt,
      revision_history: revisionHistory
    }
  };
  const rows = await supabaseAdminRest<NewsImpactEventRow[]>("news_impact_events?on_conflict=semantic_key,market", {
    method: "POST",
    body,
    prefer: "resolution=merge-duplicates,return=representation"
  });
  const event = rows[0];
  if (!event) throw new Error("news_impact_event_upsert_empty");
  await supabaseAdminRest("news_event_sources?on_conflict=event_id,source_item_id", {
    method: "POST",
    body: { event_id: event.id, source_item_id: input.sourceItem.id, is_primary: event.primary_source_item_id === input.sourceItem.id },
    prefer: "resolution=merge-duplicates"
  });
  return { event, changed, duplicate: Boolean(previous && !changed) };
}

export async function retractNewsEventsForRejectedSourceItems(
  sourceId: string,
  rejectedExternalIds: readonly string[],
  detectedAt: string
) {
  if (rejectedExternalIds.length === 0) return [] as NewsImpactEventRow[];
  const rejectedSet = new Set(rejectedExternalIds);
  const sourceItems = await supabaseAdminRest<NewsSourceItemRow[]>(
    `news_source_items?source_id=eq.${encodeURIComponent(sourceId)}&limit=500`
  );
  const rejectedItems = sourceItems.filter((item) => rejectedSet.has(item.external_id));
  if (rejectedItems.length === 0) return [] as NewsImpactEventRow[];
  const rejectedItemIds = new Set(rejectedItems.map((item) => item.id));
  const rejectedLinks = await supabaseAdminRest<NewsEventSourceRow[]>(
    `news_event_sources?source_item_id=in.(${Array.from(rejectedItemIds).join(",")})&limit=500`
  );
  const eventIds = Array.from(new Set(rejectedLinks.map((link) => link.event_id)));
  if (eventIds.length === 0) return [] as NewsImpactEventRow[];
  const [events, allLinks] = await Promise.all([
    supabaseAdminRest<NewsImpactEventRow[]>(`news_impact_events?id=in.(${eventIds.join(",")})&limit=500`),
    supabaseAdminRest<NewsEventSourceRow[]>(`news_event_sources?event_id=in.(${eventIds.join(",")})&limit=500`)
  ]);
  const allItemIds = Array.from(new Set(allLinks.map((link) => link.source_item_id)));
  const allItems = allItemIds.length > 0
    ? await supabaseAdminRest<NewsSourceItemRow[]>(`news_source_items?id=in.(${allItemIds.join(",")})&limit=500`)
    : [];
  const itemById = new Map(allItems.map((item) => [item.id, item]));
  const importanceRank = { normal: 1, high: 2, critical: 3 } as const;
  const updated: NewsImpactEventRow[] = [];

  for (const event of events) {
    const linkedIds = allLinks.filter((link) => link.event_id === event.id).map((link) => link.source_item_id);
    const storedAdmissions = event.metadata?.source_admissions && typeof event.metadata.source_admissions === "object"
      ? event.metadata.source_admissions as Record<string, unknown>
      : {};
    const sourceAdmissions: Record<string, {
      targets: string[];
      importance: "normal" | "high" | "critical";
      active: boolean;
    }> = {};
    for (const [sourceItemId, value] of Object.entries(storedAdmissions)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const record = value as Record<string, unknown>;
      sourceAdmissions[sourceItemId] = {
        targets: Array.isArray(record.targets) ? record.targets.filter((target): target is string => typeof target === "string") : [],
        importance: record.importance === "critical" || record.importance === "high" ? record.importance : "normal",
        active: record.active !== false
      };
    }
    for (const sourceItemId of linkedIds) {
      const item = itemById.get(sourceItemId);
      if (!item || sourceAdmissions[sourceItemId]) continue;
      sourceAdmissions[sourceItemId] = {
        targets: item.targets.filter((target) => event.market === "crypto" ? target !== "global" : target === "global"),
        importance: event.importance,
        active: item.policy_status === "allowed"
      };
    }
    let changed = false;
    for (const sourceItemId of Array.from(rejectedItemIds)) {
      if (sourceAdmissions[sourceItemId]?.active) {
        sourceAdmissions[sourceItemId] = { ...sourceAdmissions[sourceItemId], active: false };
        changed = true;
      }
    }
    if (!changed) continue;
    const activeEntries = Object.entries(sourceAdmissions).filter(([, admission]) => admission.active);
    const nextTargets = Array.from(new Set(activeEntries.flatMap(([, admission]) => admission.targets)));
    const nextImportance = activeEntries.reduce<"normal" | "high" | "critical">(
      (highest, [, admission]) => importanceRank[admission.importance] > importanceRank[highest]
        ? admission.importance
        : highest,
      "normal"
    );
    const remainingPushSourceIds = Array.isArray(event.metadata?.push_source_item_ids)
      ? event.metadata.push_source_item_ids.filter((value): value is string => (
          typeof value === "string" && !rejectedItemIds.has(value) && sourceAdmissions[value]?.active === true
        ))
      : [];
    const remainingPrimaryId = activeEntries[0]?.[0] ?? event.primary_source_item_id;
    const body = {
      version: event.version + 1,
      status: activeEntries.length > 0 ? "revised" : "retracted",
      targets: activeEntries.length > 0 ? nextTargets : event.targets,
      importance: activeEntries.length > 0 ? nextImportance : event.importance,
      primary_source_item_id: rejectedItemIds.has(event.primary_source_item_id ?? "") ? remainingPrimaryId : event.primary_source_item_id,
      metadata: {
        ...event.metadata,
        source_admissions: sourceAdmissions,
        push_source_item_ids: remainingPushSourceIds,
        push_eligible: remainingPushSourceIds.length > 0,
        retraction_detected_at: detectedAt,
        retraction_source_id: sourceId
      }
    };
    const rows = await supabaseAdminRest<NewsImpactEventRow[]>(`news_impact_events?id=eq.${event.id}`, {
      method: "PATCH",
      body,
      prefer: "return=representation"
    });
    if (rows[0]) updated.push(rows[0]);
    const retiredTargets = activeEntries.length === 0
      ? event.targets
      : event.targets.filter((target) => !nextTargets.includes(target));
    await Promise.all(retiredTargets.map((target) => supabaseAdminRest(
      `news_market_reactions?event_id=eq.${event.id}&target=eq.${target}`,
      { method: "PATCH", body: { next_check_at: null } }
    )));
  }
  return updated;
}

export async function updateNewsImpactEventPresentation(input: {
  eventId: string;
  headline: string;
  factSummary: string;
  method: string;
  ruleVersion: string;
  currentMetadata: Record<string, unknown>;
}) {
  const rows = await supabaseAdminRest<NewsImpactEventRow[]>(
    `news_impact_events?id=eq.${encodeURIComponent(input.eventId)}`,
    {
      method: "PATCH",
      body: {
        headline: input.headline.slice(0, 180),
        fact_summary: input.factSummary.slice(0, 600),
        metadata: {
          ...input.currentMetadata,
          summary_method: input.method,
          summary_rule_version: input.ruleVersion
        }
      },
      prefer: "return=representation"
    }
  );
  if (!rows[0]) throw new Error("news_impact_event_presentation_update_empty");
  return rows[0];
}

export async function upsertGlobalReactionObservation(observation: Omit<GlobalReactionObservation, "id"> & { bucketAt: string }) {
  const rows = await supabaseAdminRest<GlobalObservationRow[]>("global_reaction_observations?on_conflict=bucket_at", {
    method: "POST",
    body: {
      bucket_at: observation.bucketAt,
      observed_at: observation.observedAt,
      quality: observation.quality,
      market_mode: observation.marketMode,
      metrics: observation.metrics,
      signal_groups: observation.signalGroups
    },
    prefer: "resolution=merge-duplicates,return=representation"
  });
  const row = rows[0];
  if (!row) throw new Error("global_reaction_observation_upsert_empty");
  return globalObservationFromRow(row);
}

export function globalObservationFromRow(row: GlobalObservationRow): GlobalReactionObservation {
  return {
    id: row.id,
    observedAt: row.observed_at,
    quality: row.quality,
    marketMode: row.market_mode,
    metrics: row.metrics,
    signalGroups: row.signal_groups
  };
}

export async function findGlobalObservationBefore(beforeAt: string, withinMinutes = 10) {
  const lower = new Date(Date.parse(beforeAt) - withinMinutes * 60_000).toISOString();
  const rows = await supabaseAdminRest<GlobalObservationRow[]>(
    `global_reaction_observations?quality=eq.ready&observed_at=lt.${encodeURIComponent(beforeAt)}&observed_at=gte.${encodeURIComponent(lower)}&order=observed_at.desc&limit=1`
  );
  return rows[0] ? globalObservationFromRow(rows[0]) : null;
}

export async function findGlobalObservationAfter(afterAt: string, withinMinutes = 10) {
  const upper = new Date(Date.parse(afterAt) + withinMinutes * 60_000).toISOString();
  const rows = await supabaseAdminRest<GlobalObservationRow[]>(
    `global_reaction_observations?quality=eq.ready&observed_at=gte.${encodeURIComponent(afterAt)}&observed_at=lte.${encodeURIComponent(upper)}&order=observed_at.asc&limit=1`
  );
  return rows[0] ? globalObservationFromRow(rows[0]) : null;
}

export async function upsertNewsReaction(input: {
  eventId: string;
  eventVersion: number;
  target: "btc" | "eth" | "global";
  stage: NewsImpactStage;
  classification: NewsImpactClassification;
  riskEffect: NewsRiskEffect;
  quality: NewsImpactReaction["quality"];
  eventAt: string;
  evaluatedAt: string | null;
  nextCheckAt: string | null;
  preSnapshotId?: string | null;
  evaluatedSnapshotId?: string | null;
  baselineObservationId?: string | null;
  evaluatedObservationId?: string | null;
  priceChangePercent?: number | null;
  stateBefore?: NewsImpactReaction["stateBefore"];
  stateAfter?: NewsImpactReaction["stateAfter"];
  reactionSummary: string;
  metrics?: Record<string, unknown>;
}) {
  const rows = await supabaseAdminRest<NewsReactionRow[]>("news_market_reactions?on_conflict=event_id,event_version,target,stage", {
    method: "POST",
    body: {
      event_id: input.eventId,
      event_version: input.eventVersion,
      target: input.target,
      stage: input.stage,
      classification: input.classification,
      risk_effect: input.riskEffect,
      quality: input.quality,
      event_at: input.eventAt,
      evaluated_at: input.evaluatedAt,
      next_check_at: input.nextCheckAt,
      pre_snapshot_id: input.preSnapshotId ?? null,
      evaluated_snapshot_id: input.evaluatedSnapshotId ?? null,
      baseline_observation_id: input.baselineObservationId ?? null,
      evaluated_observation_id: input.evaluatedObservationId ?? null,
      price_change_percent: input.priceChangePercent ?? null,
      state_before: input.stateBefore ?? null,
      state_after: input.stateAfter ?? null,
      reaction_summary: input.reactionSummary.slice(0, 700),
      metrics: input.metrics ?? {}
    },
    prefer: "resolution=merge-duplicates,return=representation"
  });
  const row = rows[0];
  if (!row) throw new Error("news_reaction_upsert_empty");
  return row;
}

export async function readDueNewsReactions(now = new Date()) {
  return supabaseAdminRest<NewsReactionRow[]>(
    `news_market_reactions?next_check_at=not.is.null&next_check_at=lte.${encodeURIComponent(now.toISOString())}&order=next_check_at.asc&limit=100`
  );
}

export async function readNewsReactionStage(eventId: string, eventVersion: number, target: "btc" | "eth" | "global", stage: NewsImpactStage) {
  const rows = await supabaseAdminRest<NewsReactionRow[]>(
    `news_market_reactions?event_id=eq.${encodeURIComponent(eventId)}&event_version=eq.${eventVersion}&target=eq.${target}&stage=eq.${stage}&limit=1`
  );
  return rows[0] ?? null;
}

export async function readNewsEventRow(eventId: string) {
  const rows = await supabaseAdminRest<NewsImpactEventRow[]>(`news_impact_events?id=eq.${encodeURIComponent(eventId)}&limit=1`);
  return rows[0] ?? null;
}

export async function readRecentActionableNewsCandidates(since: string) {
  const reactions = await supabaseAdminRest<NewsReactionRow[]>(
    `news_market_reactions?quality=eq.ready&classification=in.(risk_increase,decision_state_changed,conflicts_with_existing_state)&evaluated_at=gte.${encodeURIComponent(since)}&order=evaluated_at.desc&limit=100`
  );
  if (reactions.length === 0) return [];
  const eventIds = Array.from(new Set(reactions.map((reaction) => reaction.event_id)));
  const events = await supabaseAdminRest<NewsImpactEventRow[]>(
    `news_impact_events?id=in.(${eventIds.join(",")})&status=neq.retracted&limit=100`
  );
  const eventById = new Map(events.map((event) => [event.id, event]));
  return reactions.flatMap((reaction) => {
    const event = eventById.get(reaction.event_id);
    return event && event.version === reaction.event_version
      ? [{ event, reaction }]
      : [];
  });
}

export async function readGlobalObservationById(id: string) {
  const rows = await supabaseAdminRest<GlobalObservationRow[]>(
    `global_reaction_observations?id=eq.${encodeURIComponent(id)}&limit=1`
  );
  return rows[0] ? globalObservationFromRow(rows[0]) : null;
}

export async function readNewsSourceStatusSummary(market?: NewsMarket) {
  const relevantSources = market
    ? newsSourceCatalog.filter((source) => source.markets.includes(market))
    : [...newsSourceCatalog];
  const relevantIds = new Set(relevantSources.map((source) => source.id));
  const fallbackBlocked = relevantSources.filter((source) => source.policyStatus !== "allowed").length;
  if (!isSupabaseAdminConfigured()) return {
    active: 0,
    healthy: 0,
    degraded: 0,
    blocked: fallbackBlocked,
    latestRunAt: null as string | null,
    accepted24h: 0,
    latestAcceptedAt: null as string | null
  };
  const recentSince = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const [catalog, health, runs, recentEvents] = await Promise.all([
    supabaseAdminRest<Array<{ source_id: string; policy_status: "allowed" | "review" | "blocked"; enabled: boolean; allowed_hosts: string[] }>>(
      "news_source_catalog?select=source_id,policy_status,enabled,allowed_hosts&limit=100"
    ).catch(() => []),
    supabaseAdminRest<Array<{ source_id: string; consecutive_failures: number; circuit_open_until: string | null; last_success_at: string | null }>>(
      "news_source_health?select=source_id,consecutive_failures,circuit_open_until,last_success_at&limit=50"
    ).catch(() => []),
    supabaseAdminRest<Array<{ finished_at: string; status: string }>>(
      "news_sync_runs?select=finished_at,status&order=finished_at.desc&limit=10"
    ).catch(() => []),
    market
      ? supabaseAdminRest<Array<{ occurred_at: string }>>(
          `news_impact_events?select=occurred_at&market=eq.${market}&status=neq.retracted&occurred_at=gte.${encodeURIComponent(recentSince)}&order=occurred_at.desc&limit=500`
        ).catch(() => [])
      : Promise.resolve([] as Array<{ occurred_at: string }>)
  ]);
  const relevantCatalog = catalog.filter((source) => relevantIds.has(source.source_id));
  const activeIds = new Set(relevantCatalog.filter((source) => (
    source.policy_status === "allowed" && source.enabled &&
    Array.isArray(source.allowed_hosts) && source.allowed_hosts.length > 0
  )).map((source) => source.source_id));
  const healthById = new Map(health.map((row) => [row.source_id, row]));
  const degradedIds = new Set(Array.from(activeIds).filter((sourceId) => {
    const row = healthById.get(sourceId);
    return !row?.last_success_at || row.consecutive_failures > 0 ||
      Boolean(row.circuit_open_until && Date.parse(row.circuit_open_until) > Date.now());
  }));
  const latestRun = runs[0] ?? null;
  const latestUsableRun = runs.find((run) => run.status === "stored" || run.status === "partial") ?? null;
  const latestFailed = latestRun?.status === "failed";
  const degraded = Math.min(activeIds.size, degradedIds.size + (latestFailed ? 1 : 0));
  return {
    active: activeIds.size,
    healthy: Math.max(0, activeIds.size - degraded),
    degraded,
    blocked: relevantCatalog.length > 0 ? relevantCatalog.filter((source) => (
      source.policy_status !== "allowed" || !source.enabled ||
      !Array.isArray(source.allowed_hosts) || source.allowed_hosts.length === 0
    )).length : fallbackBlocked,
    latestRunAt: latestUsableRun?.finished_at ?? null,
    accepted24h: recentEvents.length,
    latestAcceptedAt: recentEvents[0]?.occurred_at ?? null
  };
}

export async function clearNewsReactionNextCheck(reactionId: string) {
  await supabaseAdminRest(`news_market_reactions?id=eq.${encodeURIComponent(reactionId)}`, {
    method: "PATCH",
    body: { next_check_at: null }
  });
}

export async function postponeNewsReaction(reactionId: string, nextCheckAt: string) {
  await supabaseAdminRest(`news_market_reactions?id=eq.${encodeURIComponent(reactionId)}`, {
    method: "PATCH",
    body: { next_check_at: nextCheckAt }
  });
}

export async function readNewsImpactEvents(input: {
  market: NewsMarket;
  asset?: PerpetualAsset | null;
  eventId?: string | null;
  snapshotId?: string | null;
  since: string;
  limit: number;
}) {
  const eventFilter = input.eventId
    ? `id=eq.${encodeURIComponent(input.eventId)}&market=eq.${input.market}&occurred_at=gte.${encodeURIComponent(input.since)}`
    : `market=eq.${input.market}&occurred_at=gte.${encodeURIComponent(input.since)}`;
  const fetchLimit = input.eventId ? 1 : 100;
  const rows = await supabaseAdminRest<NewsImpactEventRow[]>(
    `news_impact_events?${eventFilter}&status=neq.retracted&order=occurred_at.desc&limit=${fetchLimit}`
  );
  const importanceRank: Record<NewsImpactEvent["importance"], number> = { critical: 3, high: 2, normal: 1 };
  const filtered = rows
    .filter((event) => !input.asset || event.targets.includes(input.asset))
    .sort((left, right) => importanceRank[right.importance] - importanceRank[left.importance] || Date.parse(right.occurred_at) - Date.parse(left.occurred_at))
    .slice(0, Math.max(1, Math.min(input.limit, 100)));
  if (filtered.length === 0) return [];
  const eventIds = filtered.map((event) => event.id);
  const links = await supabaseAdminRest<NewsEventSourceRow[]>(
    `news_event_sources?event_id=in.(${eventIds.join(",")})&limit=500`
  );
  const sourceIds = Array.from(new Set(links.map((link) => link.source_item_id)));
  const sources = sourceIds.length > 0
    ? await supabaseAdminRest<NewsSourceItemRow[]>(`news_source_items?id=in.(${sourceIds.join(",")})&limit=500`)
    : [];
  const sourceCatalogIds = Array.from(new Set(sources.map((source) => source.source_id)));
  const allowedCatalog = sourceCatalogIds.length > 0
    ? await supabaseAdminRest<Array<{ source_id: string; allowed_hosts: string[] }>>(
        `news_source_catalog?select=source_id,allowed_hosts&source_id=in.(${sourceCatalogIds.join(",")})&policy_status=eq.allowed&enabled=eq.true&limit=100`
      )
    : [];
  const allowedCatalogHosts = new Map(allowedCatalog.map((source) => [source.source_id, source.allowed_hosts]));
  const reactions = await supabaseAdminRest<NewsReactionRow[]>(
    `news_market_reactions?event_id=in.(${eventIds.join(",")})&order=evaluated_at.desc.nullslast,created_at.desc&limit=500`
  );
  const sourceById = new Map(sources.map((source) => [source.id, source]));

  return filtered.map((event): NewsImpactEvent | null => {
    const eventLinks = links.filter((link) => link.event_id === event.id);
    const eventSources = eventLinks
      .map((link) => sourceById.get(link.source_item_id))
      .filter((value): value is NewsSourceItemRow => Boolean(
        value &&
        value.policy_status === "allowed" &&
        isAllowedNewsSourceUrl(value.source_id, value.canonical_url) &&
        isAllowedUrlForHosts(value.canonical_url, allowedCatalogHosts.get(value.source_id) ?? [])
      ));
    const primary = eventSources.find((source) => source.id === event.primary_source_item_id) ?? eventSources[0];
    if (!primary) return null;
    const allEventReactions = reactions
      .filter((reaction) => (
        reaction.event_id === event.id &&
        (!input.asset || reaction.target === input.asset || reaction.target === "global") &&
        (!input.snapshotId || reaction.evaluated_snapshot_id === input.snapshotId)
      ))
      .sort((left, right) => right.event_version - left.event_version || stageRank(right.stage) - stageRank(left.stage));
    const eventReactions = allEventReactions.filter((reaction) => reaction.event_version === event.version);
    const latest = eventReactions[0] ?? null;
    const metrics = asArray(latest?.metrics?.items);
    return {
      id: event.id,
      semanticKey: event.semantic_key,
      market: event.market,
      category: event.category,
      targets: event.targets,
      importance: event.importance,
      version: event.version,
      status: event.status,
      occurredAt: event.occurred_at,
      firstSeenAt: event.first_seen_at,
      updatedAt: event.updated_at,
      headline: event.headline,
      factSummary: event.fact_summary,
      primarySource: rowToSource(primary),
      sourceCount: eventSources.length,
      ...(typeof event.metadata?.macro_source_event_id === "string" ? { macroEventKey: event.metadata.macro_source_event_id } : {}),
      reactionEligibility: event.metadata?.reaction_eligible === false ? "context_only" : "eligible",
      reaction: latest ? rowToReaction(latest, event) : null,
      pro: {
        sources: eventSources.map(rowToSource),
        reactionHistory: allEventReactions.map((reaction) => rowToReaction(reaction, event)),
        metrics,
        revisions: Array.isArray(event.metadata?.revision_history)
          ? (event.metadata.revision_history as Array<{ version?: unknown; headline?: unknown; factSummary?: unknown; updatedAt?: unknown }>).flatMap((revision) => (
              typeof revision.version === "number" && typeof revision.headline === "string" && typeof revision.factSummary === "string" && typeof revision.updatedAt === "string"
                ? [{ version: revision.version, headline: revision.headline, factSummary: revision.factSummary, updatedAt: revision.updatedAt }]
                : []
            ))
          : []
      }
    };
  }).filter((event): event is NewsImpactEvent => Boolean(event));
}

export async function readNewsDecisionContext(reactionId: string, asset: PerpetualAsset, snapshotId?: string | null) {
  const reactions = await supabaseAdminRest<NewsReactionRow[]>(
    `news_market_reactions?id=eq.${encodeURIComponent(reactionId)}&target=eq.${asset}&limit=1`
  );
  const reaction = reactions[0];
  if (!reaction || (snapshotId && reaction.evaluated_snapshot_id !== snapshotId)) return null;
  const event = await readNewsEventRow(reaction.event_id);
  if (
    !event ||
    event.market !== "crypto" ||
    event.status === "retracted" ||
    event.version !== reaction.event_version
  ) return null;
  const links = await supabaseAdminRest<Array<{ source_item_id: string }>>(
    `news_event_sources?select=source_item_id&event_id=eq.${encodeURIComponent(event.id)}&limit=100`
  );
  if (links.length === 0) return null;
  const items = await supabaseAdminRest<Array<{ source_id: string; canonical_url: string }>>(
    `news_source_items?select=source_id,canonical_url&id=in.(${links.map((link) => link.source_item_id).join(",")})&policy_status=eq.allowed&limit=100`
  );
  if (items.length === 0) return null;
  const allowed = await supabaseAdminRest<Array<{ source_id: string; allowed_hosts: string[] }>>(
    `news_source_catalog?select=source_id,allowed_hosts&source_id=in.(${Array.from(new Set(items.map((item) => item.source_id))).join(",")})&policy_status=eq.allowed&enabled=eq.true&limit=100`
  );
  const allowedHosts = new Map(allowed.map((source) => [source.source_id, source.allowed_hosts]));
  if (!items.some((item) => (
    isAllowedNewsSourceUrl(item.source_id, item.canonical_url) &&
    isAllowedUrlForHosts(item.canonical_url, allowedHosts.get(item.source_id) ?? [])
  ))) return null;
  return rowToReaction(reaction, event);
}

export function snapshotReactionMetrics(before: PerpetualDecisionSnapshot | null, after: PerpetualDecisionSnapshot | null) {
  const evidenceScore = (snapshot: PerpetualDecisionSnapshot | null) => snapshot?.pro?.multiTimeframeEvidence.reduce((sum, evidence) => sum + evidence.score, 0) ?? null;
  const items: NewsReactionMetric[] = [
    { key: "price", label: "가격", before: before?.price ?? null, after: after?.price ?? null, change: before && after ? after.price - before.price : null, unit: "USDT" },
    { key: "structure", label: "다중 시간대 구조 점수", before: evidenceScore(before), after: evidenceScore(after), change: before && after ? (evidenceScore(after) ?? 0) - (evidenceScore(before) ?? 0) : null, unit: "score" },
    { key: "flow", label: "대형 체결 불균형", before: before?.pro?.flow?.imbalancePercent ?? null, after: after?.pro?.flow?.imbalancePercent ?? null, change: null, unit: "%" },
    { key: "pressure", label: "상방-하방 청산 압력", before: before?.pro?.pressure ? before.pro.pressure.upsideShortPressure - before.pro.pressure.downsideLongPressure : null, after: after?.pro?.pressure ? after.pro.pressure.upsideShortPressure - after.pro.pressure.downsideLongPressure : null, change: null, unit: "pt" }
  ];
  return { items };
}
