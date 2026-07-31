import { createHash } from "node:crypto";
import type { ActiveExchangeProvider } from "@/lib/exchangeJournal";
import {
  listExchangeAssessmentCandidates,
  upsertExchangeTradeAssessment,
  type ExchangePositionRow,
  type ExchangeTradeAssessmentWrite
} from "@/lib/server/exchangeConnectionStore";
import {
  ExchangeMarketDataError,
  fetchExchangeTradeQualityCandles
} from "@/lib/server/exchanges/marketCandles";
import {
  classifyTradeDuration,
  evaluateTradeQuality,
  tradeQualityEvaluationVersion,
  tradeQualityTimeframeForHoldingSeconds,
  type TradeQualityPosition
} from "@/lib/tradeQuality";

const maxAssessmentsPerSync = 1;

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function positionForAssessment(row: ExchangePositionRow): TradeQualityPosition {
  return {
    id: row.id,
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
    fillCount: row.fill_count
  };
}

function candleInputFingerprint(
  positionFingerprint: string,
  provider: ActiveExchangeProvider,
  marketSymbol: string,
  timeframe: string,
  candles: Array<{ openTimeMs: number; open: number; high: number; low: number; close: number; volume: number }>
) {
  const hash = createHash("sha256");
  hash.update(`${positionFingerprint}|${provider}|${marketSymbol}|${timeframe}`);
  for (const candle of candles) {
    hash.update(`|${candle.openTimeMs},${candle.open},${candle.high},${candle.low},${candle.close},${candle.volume}`);
  }
  return hash.digest("hex");
}

function unavailableAssessment(input: {
  position: TradeQualityPosition;
  userId: string;
  positionFingerprint: string;
  code: ExchangeMarketDataError["code"];
  retryAfterMs?: number | null;
  evaluatedAt: string;
}): ExchangeTradeAssessmentWrite {
  const openedAt = Date.parse(input.position.openedAt);
  const closedAt = Date.parse(input.position.closedAt);
  const holdingSeconds = Math.max(0, Math.floor((closedAt - openedAt) / 1000));
  const timeframe = tradeQualityTimeframeForHoldingSeconds(holdingSeconds);
  const retryDelayMs = input.code === "rate_limited"
    ? Math.max(30 * 60_000, input.retryAfterMs ?? 0)
    : 6 * 60 * 60_000;
  return {
    position_id: input.position.id,
    connection_id: input.position.connectionId,
    user_id: input.userId,
    status: "market_data_unavailable",
    evaluation_version: tradeQualityEvaluationVersion,
    position_fingerprint: input.positionFingerprint,
    input_fingerprint: sha256(`${input.positionFingerprint}|${input.code}|${input.evaluatedAt.slice(0, 13)}`),
    market_provider: input.position.provider,
    market_symbol: input.position.symbol,
    primary_timeframe: timeframe,
    context_timeframe: timeframe === "1m"
      ? "5m"
      : timeframe === "5m"
        ? "15m"
        : timeframe === "15m"
          ? "1h"
          : timeframe === "1h"
            ? "4h"
            : "1d",
    requested_from: input.position.openedAt,
    requested_until: input.position.closedAt,
    coverage_ratio: 0,
    expected_bars: 0,
    observed_bars: 0,
    max_gap_bars: 0,
    confidence: "unavailable",
    entry_score: null,
    entry_grade: null,
    exit_score: null,
    exit_grade: null,
    holding_seconds: holdingSeconds,
    duration_class: classifyTradeDuration(holdingSeconds),
    significance: null,
    post_exit_confirmation: "unavailable",
    metrics: {
      atr_at_entry: null,
      entry_range_position: null,
      entry_extension_atr: null,
      mfe_price_pct: null,
      mae_price_pct: null,
      mfe_atr: null,
      mae_atr: null,
      capture_ratio: null,
      giveback_ratio: null,
      cost_share: null
    },
    entry_reasons: [],
    exit_reasons: [],
    significance_reasons: [],
    warnings: [`market_${input.code}`],
    next_retry_at: new Date(Date.parse(input.evaluatedAt) + retryDelayMs).toISOString(),
    evaluated_at: input.evaluatedAt
  };
}

function retryAt(evaluatedAt: string, delayMs: number) {
  return new Date(Date.parse(evaluatedAt) + delayMs).toISOString();
}

export async function evaluatePendingExchangeTrades(
  userId: string,
  connectionId: string,
  options: { limit?: number; nowMs?: number } = {}
) {
  const nowMs = options.nowMs ?? Date.now();
  const limit = Math.max(1, Math.min(options.limit ?? maxAssessmentsPerSync, maxAssessmentsPerSync));
  const candidates = await listExchangeAssessmentCandidates(
    userId,
    connectionId,
    limit,
    new Date(nowMs)
  );
  let ready = 0;
  let insufficient = 0;
  let unavailable = 0;
  const warnings: string[] = [];

  for (const row of candidates) {
    if (row.quality !== "complete") {
      warnings.push("trade_quality_partial_skipped");
      continue;
    }
    const position = positionForAssessment(row);
    const positionFingerprint = row.position_fingerprint;
    const evaluatedAt = new Date().toISOString();
    let market: Awaited<ReturnType<typeof fetchExchangeTradeQualityCandles>>;
    try {
      market = await fetchExchangeTradeQualityCandles({
        provider: position.provider,
        symbol: position.symbol,
        openedAt: position.openedAt,
        closedAt: position.closedAt,
        nowMs
      });
    } catch (error) {
      if (!(error instanceof ExchangeMarketDataError)) {
        warnings.push("trade_quality_market_fetch_failed");
        continue;
      }
      unavailable += 1;
      warnings.push(`trade_quality_${error.code}`);
      try {
        const persisted = await upsertExchangeTradeAssessment(unavailableAssessment({
          position,
          userId,
          positionFingerprint,
          code: error.code,
          retryAfterMs: error.retryAfterMs,
          evaluatedAt
        }));
        if (!persisted) warnings.push("trade_quality_stale_skipped");
      } catch {
        warnings.push("trade_quality_persist_failed");
      }
      if (error.code === "rate_limited") break;
      continue;
    }

    try {
      const assessment = evaluateTradeQuality({
        position,
        candles: market.candles,
        coverage: market.coverage
      });
      const write: ExchangeTradeAssessmentWrite = {
        position_id: position.id,
        connection_id: position.connectionId,
        user_id: userId,
        status: assessment.status,
        evaluation_version: tradeQualityEvaluationVersion,
        position_fingerprint: positionFingerprint,
        input_fingerprint: candleInputFingerprint(
          positionFingerprint,
          market.provider,
          market.marketSymbol,
          market.timeframe,
          market.candles
        ),
        market_provider: market.provider,
        market_symbol: market.marketSymbol,
        primary_timeframe: assessment.primaryTimeframe,
        context_timeframe: assessment.contextTimeframe,
        requested_from: market.requestedFrom,
        requested_until: market.requestedUntil,
        coverage_ratio: assessment.coverage.ratio,
        expected_bars: assessment.coverage.expectedBars,
        observed_bars: assessment.coverage.observedBars,
        max_gap_bars: assessment.coverage.maxGapBars,
        confidence: assessment.confidence,
        entry_score: assessment.entryScore,
        entry_grade: assessment.entryGrade,
        exit_score: assessment.exitScore,
        exit_grade: assessment.exitGrade,
        holding_seconds: assessment.holdingSeconds,
        duration_class: assessment.durationClass,
        significance: assessment.significance,
        post_exit_confirmation: assessment.postExitConfirmation,
        metrics: {
          atr_at_entry: assessment.atrAtEntry,
          entry_range_position: assessment.entryRangePosition,
          entry_extension_atr: assessment.entryExtensionAtr,
          mfe_price_pct: assessment.mfePricePct,
          mae_price_pct: assessment.maePricePct,
          mfe_atr: assessment.mfeAtr,
          mae_atr: assessment.maeAtr,
          capture_ratio: assessment.captureRatio,
          giveback_ratio: assessment.givebackRatio,
          cost_share: assessment.costShare
        },
        entry_reasons: assessment.entryReasons,
        exit_reasons: assessment.exitReasons,
        significance_reasons: assessment.significanceReasons,
        warnings: Array.from(new Set([...assessment.warnings, ...market.warnings])).slice(0, 12),
        next_retry_at: assessment.status === "insufficient_data"
          ? retryAt(evaluatedAt, 6 * 60 * 60_000)
          : market.postExitPending
            ? market.postExitReadyAt
            : null,
        evaluated_at: evaluatedAt
      };
      try {
        const persisted = await upsertExchangeTradeAssessment(write);
        if (!persisted) {
          warnings.push("trade_quality_stale_skipped");
        } else if (assessment.status === "ready") {
          ready += 1;
        } else {
          insufficient += 1;
        }
      } catch {
        warnings.push("trade_quality_persist_failed");
      }
    } catch {
      warnings.push("trade_quality_evaluation_failed");
    }
  }

  return {
    attempted: candidates.length,
    ready,
    insufficient,
    unavailable,
    warnings: Array.from(new Set(warnings))
  };
}
