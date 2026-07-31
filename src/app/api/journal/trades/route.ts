import {
  matchSavedDecisionCandidates,
  type ActiveExchangeProvider,
  type SavedExchangeDecisionJournal
} from "@/lib/exchangeJournal";
import {
  listExchangeConnections,
  listExchangePositions,
  selectExchangeConnectionsForEntitlement
} from "@/lib/server/exchangeConnectionStore";
import { exchangeApiContext, privateExchangeJson } from "@/lib/server/exchangeApi";
import { isSupabaseAdminConfigured, supabaseAdminRestAll } from "@/lib/server/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ManualJournalRow {
  id: string;
  user_id: string;
  title: string;
  bias: string;
  note: string;
  source: string;
  market: string | null;
  symbol: string | null;
  outcome: string | null;
  decision_snapshot_id: string | null;
  decision_context: SavedExchangeDecisionJournal["decisionContext"] | null;
  created_at: string;
}

const providers = new Set<ActiveExchangeProvider>(["okx", "bybit", "bitget", "bingx"]);

export async function GET(request: Request) {
  const context = await exchangeApiContext(request);
  if (!context.ok) return context.response;
  if (!isSupabaseAdminConfigured()) {
    return privateExchangeJson({ error: "자동 복기 저장소가 설정되지 않았습니다." }, { status: 503 });
  }
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider");
  const symbol = url.searchParams.get("symbol")?.trim().toUpperCase() ?? "";
  const side = url.searchParams.get("side");
  const review = url.searchParams.get("review");
  if (provider && !providers.has(provider as ActiveExchangeProvider)) {
    return privateExchangeJson({ error: "지원하지 않는 거래소 필터입니다." }, { status: 400 });
  }
  if (side && side !== "long" && side !== "short") {
    return privateExchangeJson({ error: "지원하지 않는 방향 필터입니다." }, { status: 400 });
  }
  if (review && review !== "pending" && review !== "done") {
    return privateExchangeJson({ error: "지원하지 않는 복기 상태 필터입니다." }, { status: 400 });
  }
  const since = new Date(Date.now() - context.capabilities.historyDays * 24 * 60 * 60 * 1000).toISOString();
  const candidateSince = new Date(Date.parse(since) - 6 * 60 * 60 * 1000).toISOString();
  const userId = context.entitlement.userId as string;
  try {
    const connections = await listExchangeConnections(userId, true);
    const eligible = selectExchangeConnectionsForEntitlement(
      connections,
      context.capabilities.connectionLimit
    );
    const [positionRows, manualRows] = await Promise.all([
      listExchangePositions(
        userId,
        since,
        eligible.map((connection) => connection.id)
      ),
      supabaseAdminRestAll<ManualJournalRow>(
        `journals?select=id,user_id,title,bias,note,source,market,symbol,outcome,decision_snapshot_id,decision_context,created_at&user_id=eq.${encodeURIComponent(userId)}&created_at=gte.${encodeURIComponent(candidateSince)}&source=neq.exchange&order=created_at.desc`,
        500
      )
    ]);
    const decisionCandidates = matchSavedDecisionCandidates(
      positionRows.map((row) => ({
        id: row.id,
        userId,
        symbol: row.symbol,
        openedAt: row.opened_at
      })),
      manualRows
        .filter((row) =>
          row.user_id === userId &&
          row.market === "crypto" &&
          (row.source === "snapshot" || row.source === "alert" || row.source === "news") &&
          row.decision_context !== null
        )
        .map((row) => ({
          id: row.id,
          userId: row.user_id,
          source: row.source as SavedExchangeDecisionJournal["source"],
          savedAt: row.created_at,
          decisionSnapshotId: row.decision_snapshot_id,
          decisionContext: row.decision_context as SavedExchangeDecisionJournal["decisionContext"]
        })),
      userId
    );
    const positions = positionRows
      .filter((row) => !provider || row.provider === provider)
      .filter((row) => !symbol || row.symbol.includes(symbol))
      .filter((row) => !side || row.position_side === side)
      .filter((row) => {
        const reviewed = Boolean(row.exchange_trade_reviews?.[0]);
        return !review || (review === "done" ? reviewed : !reviewed);
      })
      .sort((left, right) => {
        const leftReviewed = Boolean(left.exchange_trade_reviews?.[0]);
        const rightReviewed = Boolean(right.exchange_trade_reviews?.[0]);
        if (leftReviewed !== rightReviewed) return leftReviewed ? 1 : -1;
        return Date.parse(right.closed_at) - Date.parse(left.closed_at);
      })
      .map((row) => ({
        id: row.id,
        kind: "exchange" as const,
        connectionId: row.connection_id,
        provider: row.provider,
        symbol: row.symbol,
        positionSide: row.position_side,
        openedAt: row.opened_at,
        closedAt: row.closed_at,
        quantityBase: row.quantity_base,
        averageEntryPrice: row.average_entry_price,
        averageExitPrice: row.average_exit_price,
        realizedPnl: row.realized_pnl,
        feeTotal: row.fee_total,
        fundingTotal: row.funding_total,
        netPnl: row.net_pnl,
        exitReason: row.exit_reason,
        quality: row.quality,
        warnings: row.warnings,
        assessment: (() => {
          if (row.quality !== "complete") return null;
          const assessment = row.exchange_trade_assessments?.[0];
          if (!assessment || assessment.position_fingerprint !== row.position_fingerprint) return null;
          return {
            status: assessment.status,
            marketProvider: assessment.market_provider,
            primaryTimeframe: assessment.primary_timeframe,
            contextTimeframe: assessment.context_timeframe,
            coverageRatio: Number(assessment.coverage_ratio),
            confidence: assessment.confidence,
            entryScore: assessment.entry_score,
            entryGrade: assessment.entry_grade,
            exitScore: assessment.exit_score,
            exitGrade: assessment.exit_grade,
            holdingSeconds: Number(assessment.holding_seconds),
            durationClass: assessment.duration_class,
            significance: assessment.significance,
            postExitConfirmation: assessment.post_exit_confirmation,
            metrics: {
              atrAtEntry: assessment.metrics.atr_at_entry ?? null,
              entryRangePosition: assessment.metrics.entry_range_position ?? null,
              entryExtensionAtr: assessment.metrics.entry_extension_atr ?? null,
              mfePricePct: assessment.metrics.mfe_price_pct ?? null,
              maePricePct: assessment.metrics.mae_price_pct ?? null,
              mfeAtr: assessment.metrics.mfe_atr ?? null,
              maeAtr: assessment.metrics.mae_atr ?? null,
              captureRatio: assessment.metrics.capture_ratio ?? null,
              givebackRatio: assessment.metrics.giveback_ratio ?? null,
              costShare: assessment.metrics.cost_share ?? null
            },
            entryReasons: assessment.entry_reasons,
            exitReasons: assessment.exit_reasons,
            significanceReasons: assessment.significance_reasons,
            warnings: assessment.warnings,
            evaluatedAt: assessment.evaluated_at
          };
        })(),
        review: row.exchange_trade_reviews?.[0] ?? null,
        decisionCandidate: decisionCandidates.get(row.id) ?? null
      }));
    return privateExchangeJson({
      windowDays: context.capabilities.historyDays,
      positions
    });
  } catch {
    return privateExchangeJson({ error: "자동 복기 거래를 불러오지 못했습니다." }, { status: 503 });
  }
}
