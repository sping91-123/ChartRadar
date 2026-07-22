import {
  classifyCryptoNewsReaction,
  classifyGlobalNewsReaction,
  newsReactionAnchorAt,
  nextNewsImpactCheckAt,
  type ClassifiedReaction,
  type GlobalReactionObservation,
  type NewsImpactStage
} from "@/lib/newsImpact";
import {
  generatePeriodicPerpetualDecisionSnapshots,
  getPerpetualDecisionSnapshotById,
  getReadyPerpetualSnapshotAfter,
  getReadyPerpetualSnapshotBefore
} from "@/lib/server/perpetualDecisionSource";
import { buildGlobalReactionObservation } from "@/lib/server/news/globalReactionSource";
import { enqueueNewsImpactAlerts } from "@/lib/server/news/newsImpactAlertOutbox";
import {
  claimNewsSyncRun,
  clearNewsReactionNextCheck,
  findGlobalObservationAfter,
  findGlobalObservationBefore,
  finishNewsSyncRun,
  postponeNewsReaction,
  readDueNewsReactions,
  readGlobalObservationById,
  readNewsEventRow,
  readRecentActionableNewsCandidates,
  readNewsReactionStage,
  renewNewsSyncRun,
  snapshotReactionMetrics,
  upsertGlobalReactionObservation,
  upsertNewsImpactEvent,
  upsertNewsReaction,
  upsertNewsSourceItem,
  updateNewsImpactEventPresentation,
  type NewsImpactEventRow,
  type NewsReactionRow
} from "@/lib/server/news/newsImpactStore";
import { fetchOfficialNewsSources } from "@/lib/server/news/officialSourceAdapters";
import { deterministicOfficialPresentation, officialEventPresentation } from "@/lib/server/news/officialFactSummary";
import { semanticNewsEventKey } from "@/lib/server/news/normalizeNewsSourceItem";
import { isNewsImpactCollectionEnabled, isNewsImpactPushEnabled, newsImpactMode } from "@/lib/server/newsImpactMode";
import { isSupabaseAdminConfigured, supabaseAdminRpc } from "@/lib/server/supabaseAdmin";

const RETRY_MS = 5 * 60_000;
const MAX_EVALUATION_WAIT_MS = 10 * 60_000;
const GLOBAL_METRIC_ORDER = ["NQ=F", "ES=F", "YM=F", "RTY=F", "^VIX", "UUP", "TLT", "ZN=F", "SMH", "SOXX", "XLK", "XLY", "XLP", "XLV", "XLI", "XLU", "XLC", "XLF", "XLE", "marketModeScore"];
const GLOBAL_METRIC_LABELS: Record<string, string> = {
  "NQ=F": "나스닥100 선물",
  "ES=F": "S&P500 선물",
  "YM=F": "다우 선물",
  "RTY=F": "러셀2000 선물",
  "^VIX": "변동성 지수(VIX)",
  UUP: "미국 달러",
  TLT: "미 장기 국채",
  "ZN=F": "미 10년 국채선물",
  SMH: "반도체 섹터(SMH)",
  SOXX: "반도체 섹터(SOXX)",
  XLK: "기술주 섹터",
  XLY: "경기소비재 섹터",
  XLP: "필수소비재 섹터",
  XLV: "헬스케어 섹터",
  XLI: "산업재 섹터",
  XLU: "유틸리티 섹터",
  XLC: "커뮤니케이션 섹터",
  XLF: "금융 섹터",
  XLE: "에너지 섹터",
  marketModeScore: "전체 시장 위험 점수"
};

export interface NewsImpactSyncResult {
  mode: ReturnType<typeof newsImpactMode>;
  status: "disabled" | "unconfigured" | "duplicate" | "stored" | "partial" | "failed";
  runId: string | null;
  sources: Array<{ sourceId: string; status: string; fetchedCount: number; acceptedCount: number; warning?: string }>;
  fetchedCount: number;
  acceptedCount: number;
  duplicateCount: number;
  evaluatedCount: number;
  wouldSendCount: number;
  claimedAlertCount: number;
}

function evaluationQuality(result: ClassifiedReaction) {
  return result.classification === "insufficient_data" ? "unavailable" as const : "ready" as const;
}

function retryAt(now: Date) {
  return new Date(now.getTime() + RETRY_MS).toISOString();
}

function evaluationDeadline(checkAt: string) {
  return Date.parse(checkAt) + MAX_EVALUATION_WAIT_MS;
}

function globalReactionMetrics(before: GlobalReactionObservation | null, after: GlobalReactionObservation | null) {
  const keys = Array.from(new Set([
    ...Object.keys(before?.metrics ?? {}),
    ...Object.keys(after?.metrics ?? {})
  ])).sort((left, right) => {
    const leftIndex = GLOBAL_METRIC_ORDER.indexOf(left);
    const rightIndex = GLOBAL_METRIC_ORDER.indexOf(right);
    return (leftIndex < 0 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex < 0 ? Number.MAX_SAFE_INTEGER : rightIndex) || left.localeCompare(right);
  });
  return {
    items: keys.map((key) => {
      const beforeValue = before?.metrics[key] ?? null;
      const afterValue = after?.metrics[key] ?? null;
      return {
        key,
        label: GLOBAL_METRIC_LABELS[key] ?? key,
        before: beforeValue,
        after: afterValue,
        change: beforeValue === null || afterValue === null ? null : afterValue - beforeValue,
        unit: key === "marketModeScore" ? "점" : "σ"
      };
    })
  };
}

async function ensureDetectedReaction(event: NewsImpactEventRow, target: "btc" | "eth" | "global") {
  const existing = await readNewsReactionStage(event.id, event.version, target, "detected");
  if (existing) return existing;
  const baselineAt = newsReactionAnchorAt({
    macroEventId: event.macro_event_id,
    version: event.version,
    occurredAt: event.occurred_at,
    firstSeenAt: event.first_seen_at,
    updatedAt: event.updated_at,
    revisionDetectedAt: typeof event.metadata?.revision_detected_at === "string"
      ? event.metadata.revision_detected_at
      : null
  });
  const nextCheckAt = nextNewsImpactCheckAt(baselineAt, "detected");
  const detectedSummary = event.version > 1
    ? "공식 발표 내용이 수정되어 수정 시점 이후 15분 시장 반응을 다시 확인 중입니다."
    : "공식 발표를 확인했습니다. 발표 이후 15분 시장 반응을 확인 중입니다.";
  if (target === "global") {
    const baseline = await findGlobalObservationBefore(baselineAt, 10).catch(() => null);
    return upsertNewsReaction({
      eventId: event.id,
      eventVersion: event.version,
      target,
      stage: "detected",
      classification: "pending",
      riskEffect: "unchanged",
      quality: baseline?.quality ?? "unavailable",
      eventAt: baselineAt,
      evaluatedAt: null,
      nextCheckAt,
      baselineObservationId: baseline?.id ?? null,
      reactionSummary: detectedSummary,
      metrics: { eventContext: { version: event.version, headline: event.headline, factSummary: event.fact_summary } }
    });
  }
  const baseline = await getReadyPerpetualSnapshotBefore(target, baselineAt, 10);
  return upsertNewsReaction({
    eventId: event.id,
    eventVersion: event.version,
    target,
    stage: "detected",
    classification: "pending",
    riskEffect: "unchanged",
    quality: baseline?.quality ?? "unavailable",
    eventAt: baselineAt,
    evaluatedAt: null,
    nextCheckAt,
    preSnapshotId: baseline?.id ?? null,
    reactionSummary: detectedSummary,
    metrics: { eventContext: { version: event.version, headline: event.headline, factSummary: event.fact_summary } }
  });
}

async function evaluateCryptoReaction(
  current: NewsReactionRow,
  stage: Exclude<NewsImpactStage, "detected">,
  targetAt: string,
  now: Date
) {
  const before = current.pre_snapshot_id
    ? await getPerpetualDecisionSnapshotById(current.pre_snapshot_id)
    : null;
  const after = await getReadyPerpetualSnapshotAfter(current.target as "btc" | "eth", targetAt, 10);
  if (!after && now.getTime() <= evaluationDeadline(targetAt)) {
    await postponeNewsReaction(current.id, retryAt(now));
    return null;
  }
  const classified = classifyCryptoNewsReaction(before, after);
  return upsertNewsReaction({
    eventId: current.event_id,
    eventVersion: current.event_version,
    target: current.target,
    stage,
    classification: classified.classification,
    riskEffect: classified.riskEffect,
    quality: evaluationQuality(classified),
    eventAt: current.event_at,
    evaluatedAt: after?.generatedAt ?? now.toISOString(),
    nextCheckAt: stage === "provisional_15m" ? nextNewsImpactCheckAt(current.event_at, stage) : null,
    preSnapshotId: before?.id ?? current.pre_snapshot_id,
    evaluatedSnapshotId: after?.id ?? null,
    priceChangePercent: classified.priceChangePercent,
    stateBefore: classified.stateBefore,
    stateAfter: classified.stateAfter,
    reactionSummary: classified.reactionSummary,
    metrics: { ...snapshotReactionMetrics(before, after), eventContext: current.metrics?.eventContext }
  });
}

async function evaluateGlobalReaction(
  current: NewsReactionRow,
  stage: Exclude<NewsImpactStage, "detected">,
  targetAt: string,
  now: Date
) {
  const before = current.baseline_observation_id
    ? await readGlobalObservationById(current.baseline_observation_id)
    : null;
  const after = await findGlobalObservationAfter(targetAt, 10).catch(() => null);
  if (!after && now.getTime() <= evaluationDeadline(targetAt)) {
    await postponeNewsReaction(current.id, retryAt(now));
    return null;
  }
  const classified = classifyGlobalNewsReaction(before, after);
  return upsertNewsReaction({
    eventId: current.event_id,
    eventVersion: current.event_version,
    target: "global",
    stage,
    classification: classified.classification,
    riskEffect: classified.riskEffect,
    quality: evaluationQuality(classified),
    eventAt: current.event_at,
    evaluatedAt: after?.observedAt ?? now.toISOString(),
    nextCheckAt: stage === "provisional_15m" ? nextNewsImpactCheckAt(current.event_at, stage) : null,
    baselineObservationId: before?.id ?? current.baseline_observation_id,
    evaluatedObservationId: after?.id ?? null,
    reactionSummary: classified.reactionSummary,
    metrics: { ...globalReactionMetrics(before, after), eventContext: current.metrics?.eventContext }
  });
}

async function evaluateDueReaction(current: NewsReactionRow, now: Date) {
  const event = await readNewsEventRow(current.event_id);
  if (!event || event.status === "retracted" || event.version !== current.event_version) {
    await clearNewsReactionNextCheck(current.id);
    return null;
  }
  const stage = current.stage === "detected" ? "provisional_15m" : "final_60m";
  if (current.stage === "final_60m") {
    await clearNewsReactionNextCheck(current.id);
    return null;
  }
  const targetAt = current.stage === "detected"
    ? nextNewsImpactCheckAt(current.event_at, "detected")
    : nextNewsImpactCheckAt(current.event_at, "provisional_15m");
  if (!targetAt) {
    await clearNewsReactionNextCheck(current.id);
    return null;
  }
  const result = current.target === "global"
    ? await evaluateGlobalReaction(current, stage, targetAt, now)
    : await evaluateCryptoReaction(current, stage, targetAt, now);
  if (result) await clearNewsReactionNextCheck(current.id);
  return result;
}

async function runRetention(now: Date) {
  if (now.getUTCMinutes() >= 5) return;
  await supabaseAdminRpc("purge_news_impact_retention", {}).catch(() => undefined);
}

export async function runNewsImpactSync(now = new Date()): Promise<NewsImpactSyncResult> {
  const mode = newsImpactMode();
  const base: NewsImpactSyncResult = {
    mode,
    status: "disabled",
    runId: null,
    sources: [],
    fetchedCount: 0,
    acceptedCount: 0,
    duplicateCount: 0,
    evaluatedCount: 0,
    wouldSendCount: 0,
    claimedAlertCount: 0
  };
  if (!isNewsImpactCollectionEnabled(mode)) return base;
  if (!isSupabaseAdminConfigured()) return { ...base, status: "unconfigured" };

  const runId = await claimNewsSyncRun(now);
  if (!runId) return { ...base, status: "duplicate" };
  const startedAt = now.toISOString();
  let lastLeaseRenewalAt = Date.now();
  const keepLease = async (force = false) => {
    if (!force && Date.now() - lastLeaseRenewalAt < 60_000) return;
    if (!await renewNewsSyncRun(runId)) throw new Error("news_sync_lease_lost");
    lastLeaseRenewalAt = Date.now();
  };
  let result: NewsImpactSyncResult = { ...base, runId, status: "stored" };
  try {
    const [snapshotResults, globalResult] = await Promise.all([
      generatePeriodicPerpetualDecisionSnapshots(now),
      buildGlobalReactionObservation(now)
        .then(upsertGlobalReactionObservation)
        .then((observation) => ({ observation, error: null as string | null }))
        .catch((error) => ({ observation: null, error: error instanceof Error ? error.message : String(error) }))
    ]);
    const sourceResults = await fetchOfficialNewsSources(now);
    await keepLease();
    const sourceSummaries = sourceResults.map(({ items: _items, ...source }) => source);
    let duplicateCount = 0;
    let acceptedCount = 0;
    for (const source of sourceResults) {
      for (const item of source.items) {
        await keepLease();
        const storedItem = await upsertNewsSourceItem(item);
        if (storedItem.duplicate) duplicateCount += 1;
        else acceptedCount += 1;
        const deterministicPresentation = deterministicOfficialPresentation(item);
        const storedEvents: Array<Awaited<ReturnType<typeof upsertNewsImpactEvent>>> = [];
        for (const market of item.markets) {
          const storedEvent = await upsertNewsImpactEvent({
            semanticKey: semanticNewsEventKey({
              canonicalEventId: typeof item.structuredPayload.canonicalEventId === "string"
                ? item.structuredPayload.canonicalEventId
                : null,
              eventType: item.eventType,
              entities: item.entities,
              action: item.action,
              publishedAt: item.publishedAt
            }),
            market,
            item,
            sourceItem: storedItem.row,
            headline: deterministicPresentation.headline,
            factSummary: deterministicPresentation.factSummary,
            macroEventId: typeof item.structuredPayload.macroEventId === "string" ? item.structuredPayload.macroEventId : null,
            metadata: {
              summary_method: deterministicPresentation.method,
              summary_rule_version: deterministicPresentation.ruleVersion,
              admission_reason: item.structuredPayload.admissionReason ?? null,
              admission_rule_version: item.structuredPayload.admissionRuleVersion ?? null,
              push_eligible: item.structuredPayload.pushEligible === true
            }
          });
          storedEvents.push(storedEvent);
          for (const target of storedEvent.event.targets) {
            await ensureDetectedReaction(storedEvent.event, target);
          }
        }
        const changedEvents = storedEvents.filter((storedEvent) => !storedEvent.duplicate);
        if (!storedItem.duplicate && changedEvents.length > 0) {
          const presentation = await officialEventPresentation(item);
          await keepLease();
          if (presentation.method !== "deterministic") {
            await Promise.all(changedEvents.map((storedEvent) => updateNewsImpactEventPresentation({
              eventId: storedEvent.event.id,
              headline: presentation.headline,
              factSummary: presentation.factSummary,
              method: presentation.method,
              ruleVersion: presentation.ruleVersion,
              currentMetadata: storedEvent.event.metadata ?? {}
            })));
          }
        }
      }
    }

    const evaluatedCandidates: Array<{ event: NewsImpactEventRow; reaction: NewsReactionRow }> = [];
    const evaluationWarnings: string[] = [];
    const due = await readDueNewsReactions(now);
    for (const reaction of due) {
      try {
        await keepLease();
        const evaluated = await evaluateDueReaction(reaction, now);
        if (!evaluated || evaluated.classification === "pending") continue;
        const event = await readNewsEventRow(evaluated.event_id);
        if (event && event.version === evaluated.event_version && event.status !== "retracted") {
          evaluatedCandidates.push({ event, reaction: evaluated });
        }
      } catch (error) {
        const currentEvent = await readNewsEventRow(reaction.event_id).catch(() => null);
        if (!currentEvent || currentEvent.status === "retracted" || currentEvent.version !== reaction.event_version) {
          await clearNewsReactionNextCheck(reaction.id).catch(() => undefined);
        } else {
          await postponeNewsReaction(reaction.id, retryAt(now)).catch(() => undefined);
          evaluationWarnings.push((error instanceof Error ? error.message : String(error)).slice(0, 180));
        }
      }
    }
    const actionable = evaluatedCandidates.filter(({ reaction }) =>
      reaction.quality === "ready" && ["risk_increase", "decision_state_changed", "conflicts_with_existing_state"].includes(reaction.classification)
    );
    const pushEnabled = mode === "on" && isNewsImpactPushEnabled();
    const recoveryCandidates = pushEnabled
      ? await readRecentActionableNewsCandidates(new Date(now.getTime() - 30 * 60_000).toISOString()).catch(() => [])
      : [];
    const deliveryCandidates = Array.from(new Map(
      [...actionable, ...recoveryCandidates].map((candidate) => [candidate.reaction.id, candidate])
    ).values());
    await keepLease(true);
    const push = pushEnabled
      ? await enqueueNewsImpactAlerts(deliveryCandidates)
      : { eligible: actionable.length, claimed: 0, entitlementBlocked: 0 };
    const partial = sourceResults.some((source) => source.status === "failed") ||
      snapshotResults.some((snapshot) => snapshot.error) || Boolean(globalResult.error) || evaluationWarnings.length > 0;
    result = {
      ...result,
      status: partial ? "partial" : "stored",
      sources: sourceSummaries,
      fetchedCount: sourceResults.reduce((sum, source) => sum + source.fetchedCount, 0),
      acceptedCount,
      duplicateCount,
      evaluatedCount: evaluatedCandidates.length,
      wouldSendCount: actionable.length,
      claimedAlertCount: push.claimed
    };
    await runRetention(now);
    await finishNewsSyncRun(runId, {
      startedAt,
      finishedAt: new Date().toISOString(),
      status: partial ? "partial" : "stored",
      sourceResults: [
        ...sourceSummaries,
        ...snapshotResults.map((snapshot) => ({ sourceId: `perpetual_${snapshot.asset}`, status: snapshot.error ? "failed" : "succeeded", warning: snapshot.error })),
        { sourceId: "global_observation", status: globalResult.error ? "failed" : "succeeded", warning: globalResult.error },
        ...(evaluationWarnings.length > 0
          ? [{ sourceId: "reaction_evaluator", status: "failed", warning: `${evaluationWarnings.length}개 반응 평가 재시도 대기` }]
          : [])
      ],
      fetchedCount: result.fetchedCount,
      acceptedCount,
      duplicateCount,
      evaluatedCount: result.evaluatedCount,
      wouldSendCount: result.wouldSendCount
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishNewsSyncRun(runId, {
      startedAt,
      finishedAt: new Date().toISOString(),
      status: "failed",
      sourceResults: result.sources,
      fetchedCount: result.fetchedCount,
      acceptedCount: result.acceptedCount,
      duplicateCount: result.duplicateCount,
      evaluatedCount: result.evaluatedCount,
      wouldSendCount: result.wouldSendCount,
      error: message
    }).catch(() => undefined);
    console.error("[news-impact-sync] failed:", error);
    return { ...result, status: "failed" };
  }
}
