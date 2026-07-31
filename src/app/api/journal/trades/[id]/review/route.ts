import { compareDecimal } from "@/lib/decimal";
import {
  matchSavedDecisionCandidates,
  type SavedExchangeDecisionJournal
} from "@/lib/exchangeJournal";
import { exchangeApiContext, privateExchangeJson } from "@/lib/server/exchangeApi";
import {
  listExchangeConnections,
  selectExchangeConnectionsForEntitlement
} from "@/lib/server/exchangeConnectionStore";
import { isUuid } from "@/lib/perpetualMonitor";
import { entitlementRateKey } from "@/lib/server/requestEntitlement";
import { rateLimit, readJsonBodyLimited } from "@/lib/server/rateLimit";
import { isSupabaseAdminConfigured, supabaseAdminRest } from "@/lib/server/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = Promise<{ id: string }>;

interface OwnedPositionRow {
  id: string;
  connection_id: string;
  symbol: string;
  position_side: "long" | "short";
  opened_at: string;
  closed_at: string;
  net_pnl: string;
}

interface OwnedDecisionJournalRow {
  id: string;
  user_id: string;
  source: "snapshot" | "alert" | "news";
  created_at: string;
  decision_snapshot_id: string | null;
  decision_context: SavedExchangeDecisionJournal["decisionContext"];
}

function stringList(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const rows = value.map((item) => typeof item === "string" ? item.trim() : "");
  if (rows.some((item) => !item || item.length > maxLength)) return null;
  return Array.from(new Set(rows));
}

export async function PATCH(request: Request, { params }: { params: RouteParams }) {
  const context = await exchangeApiContext(request);
  if (!context.ok) return context.response;
  if (!isSupabaseAdminConfigured()) {
    return privateExchangeJson({ error: "자동 복기 저장소가 설정되지 않았습니다." }, { status: 503 });
  }
  const { id } = await params;
  if (!isUuid(id)) return privateExchangeJson({ error: "유효하지 않은 거래 ID입니다." }, { status: 400 });
  const limited = await rateLimit(request, {
    key: entitlementRateKey(`exchange-review:${id}`, context.entitlement),
    limit: 20,
    windowMs: 10 * 60 * 1000
  });
  if (!limited.allowed) return privateExchangeJson({ error: "복기 저장 요청이 많습니다." }, { status: 429 });
  const parsed = await readJsonBodyLimited<{
    strategyTags?: unknown;
    keptPrinciples?: unknown;
    brokenPrinciples?: unknown;
    nextCheckpoint?: unknown;
    memo?: unknown;
    decisionCandidateJournalId?: unknown;
  }>(request, 8_192);
  if (!parsed.ok) {
    return privateExchangeJson(
      { error: parsed.tooLarge ? "복기 내용이 너무 큽니다." : "복기 형식이 올바르지 않습니다." },
      { status: parsed.tooLarge ? 413 : 400 }
    );
  }
  const body = parsed.value;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return privateExchangeJson({ error: "복기 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const strategyTags = stringList(body.strategyTags ?? [], 8, 32);
  const keptPrinciples = stringList(body.keptPrinciples ?? [], 12, 60);
  const brokenPrinciples = stringList(body.brokenPrinciples ?? [], 12, 60);
  const nextCheckpoint = typeof body.nextCheckpoint === "string" ? body.nextCheckpoint.trim() : "";
  const memo = typeof body.memo === "string" ? body.memo.trim() : "";
  const decisionCandidateJournalId = body.decisionCandidateJournalId === undefined ||
    body.decisionCandidateJournalId === null ||
    body.decisionCandidateJournalId === ""
    ? null
    : typeof body.decisionCandidateJournalId === "string" && isUuid(body.decisionCandidateJournalId)
      ? body.decisionCandidateJournalId
      : undefined;
  if (
    !strategyTags ||
    !keptPrinciples ||
    !brokenPrinciples ||
    nextCheckpoint.length > 500 ||
    memo.length > 2_000 ||
    decisionCandidateJournalId === undefined ||
    keptPrinciples.some((item) => brokenPrinciples.includes(item))
  ) {
    return privateExchangeJson({ error: "선택한 기준과 메모를 다시 확인해 주세요." }, { status: 400 });
  }
  const userId = context.entitlement.userId as string;
  try {
    const eligibleConnections = selectExchangeConnectionsForEntitlement(
      await listExchangeConnections(userId, true),
      context.capabilities.connectionLimit
    );
    if (eligibleConnections.length === 0) {
      return privateExchangeJson({ error: "거래를 찾지 못했습니다." }, { status: 404 });
    }
    const connectionFilter = encodeURIComponent(`(${eligibleConnections.map((connection) => connection.id).join(",")})`);
    const positions = await supabaseAdminRest<OwnedPositionRow[]>(
      `exchange_trade_positions?select=id,connection_id,symbol,position_side,opened_at,closed_at,net_pnl&id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}&connection_id=in.${connectionFilter}&is_current=eq.true&limit=1`
    );
    const position = positions[0];
    if (!position) return privateExchangeJson({ error: "거래를 찾지 못했습니다." }, { status: 404 });
    let linkedDecisionJournal: OwnedDecisionJournalRow | null = null;
    if (decisionCandidateJournalId) {
      const candidateRows = await supabaseAdminRest<OwnedDecisionJournalRow[]>(
        `journals?select=id,user_id,source,created_at,decision_snapshot_id,decision_context&id=eq.${encodeURIComponent(decisionCandidateJournalId)}&user_id=eq.${encodeURIComponent(userId)}&market=eq.crypto&source=in.(snapshot,alert,news)&decision_context=not.is.null&limit=1`
      );
      const candidate = candidateRows[0];
      const matched = candidate
        ? matchSavedDecisionCandidates(
            [{ id: position.id, userId, symbol: position.symbol, openedAt: position.opened_at }],
            [{
              id: candidate.id,
              userId: candidate.user_id,
              source: candidate.source,
              savedAt: candidate.created_at,
              decisionSnapshotId: candidate.decision_snapshot_id,
              decisionContext: candidate.decision_context
            }],
            userId
          ).get(position.id)
        : null;
      if (!candidate || matched?.journalId !== candidate.id) {
        return privateExchangeJson({ error: "진입 전 저장 판단 후보를 다시 확인해 주세요." }, { status: 400 });
      }
      linkedDecisionJournal = candidate;
    }
    const reviewRows = await supabaseAdminRest<Array<{
      id: string;
      strategy_tags: string[];
      kept_principles: string[];
      broken_principles: string[];
      next_checkpoint: string;
      memo: string;
      reviewed_at: string;
    }>>("exchange_trade_reviews?on_conflict=position_id", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=representation",
      body: {
        position_id: id,
        user_id: userId,
        strategy_tags: strategyTags,
        kept_principles: keptPrinciples,
        broken_principles: brokenPrinciples,
        next_checkpoint: nextCheckpoint,
        memo
      }
    });

    let journalSaved = true;
    const outcome = compareDecimal(position.net_pnl, "0") > 0
      ? "win"
      : compareDecimal(position.net_pnl, "0") < 0
        ? "loss"
        : "breakeven";
    const note = [
      `시장/종목: ${position.symbol}`,
      `결과: ${outcome === "win" ? "익절" : outcome === "loss" ? "손절" : "본절"}`,
      `전략 태그: ${strategyTags.join(", ") || "미선택"}`,
      `지킨 기준: ${keptPrinciples.join(", ") || "미선택"}`,
      `깨진 기준: ${brokenPrinciples.join(", ") || "없음"}`,
      `다음 매매 전 체크: ${nextCheckpoint || "진입 근거와 무효화 기준 확인"}`,
      `메모: ${memo}`
    ].join("\n");
    try {
      const existing = await supabaseAdminRest<Array<{ id: string }>>(
        `journals?select=id&user_id=eq.${encodeURIComponent(userId)}&trade_position_id=eq.${encodeURIComponent(id)}&limit=1`
      );
      const journalBody = {
        user_id: userId,
        title: `${position.symbol} 자동 매매복기`,
        bias: position.position_side === "long" ? "롱" : "숏",
        note,
        market: "crypto",
        source: "exchange",
        symbol: position.symbol,
        outcome,
        outcome_at: position.closed_at,
        trade_position_id: id,
        ...(linkedDecisionJournal ? {
          decision_snapshot_id: linkedDecisionJournal.decision_snapshot_id,
          decision_context: {
            ...linkedDecisionJournal.decision_context,
            linkedDecisionJournalId: linkedDecisionJournal.id
          }
        } : {})
      };
      if (existing[0]) {
        await supabaseAdminRest(
          `journals?id=eq.${encodeURIComponent(existing[0].id)}&user_id=eq.${encodeURIComponent(userId)}`,
          { method: "PATCH", body: journalBody }
        );
      } else {
        await supabaseAdminRest("journals", {
          method: "POST",
          prefer: "return=minimal",
          body: journalBody
        });
      }
    } catch {
      journalSaved = false;
    }
    return privateExchangeJson({
      review: reviewRows[0] ?? null,
      journalSaved,
      decisionLinked: Boolean(linkedDecisionJournal)
    });
  } catch {
    return privateExchangeJson({ error: "복기를 저장하지 못했습니다." }, { status: 503 });
  }
}
