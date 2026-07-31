import { randomUUID } from "node:crypto";
import {
  reconstructRoundTrips,
  type CanonicalExchangeCashflow,
  type CanonicalExchangeFill,
  type ExchangeConnectionStatus
} from "@/lib/exchangeJournal";
import { buildSyncWindow } from "@/lib/exchangeSyncWindow";
import { selectBingxSyncSymbols } from "@/lib/exchangeBingxScope";
import { absDecimal, compareDecimal, subtractDecimal } from "@/lib/decimal";
import {
  claimExchangeConnection,
  commitExchangeSync,
  failExchangeSync,
  getExchangeConnection,
  getExchangeCredential,
  getExchangeSyncCheckpoint,
  loadCanonicalExchangeLedger
} from "@/lib/server/exchangeConnectionStore";
import { hashExchangeAccountUid } from "@/lib/server/exchangeCredentials";
import {
  assertExchangeMutationConfiguration,
  ExchangeJournalConfigurationError
} from "@/lib/server/exchangeJournalConfig";
import { assertExchangeOperationalControlEnabled } from "@/lib/server/exchangeOperationalControl";
import { evaluatePendingExchangeTrades } from "@/lib/server/exchangeTradeQuality";
import { getExchangeConnector } from "@/lib/server/exchanges/connector";
import { ExchangeConnectorError, type ExchangeSyncCursor } from "@/lib/server/exchanges/types";

const minimumRetryWindowMs = 1;

function uniqueFills(rows: CanonicalExchangeFill[]) {
  return Array.from(
    new Map(rows.map((row) => [`${row.connectionId}:${row.product}:${row.externalTradeId}`, row])).values()
  );
}

function uniqueCashflows(rows: CanonicalExchangeCashflow[]) {
  return Array.from(
    new Map(rows.map((row) => [`${row.connectionId}:${row.externalCashflowId}`, row])).values()
  );
}

function reconciledRoundTrips(roundTrips: ReturnType<typeof reconstructRoundTrips>["roundTrips"]) {
  return roundTrips.map((roundTrip) => {
    if (roundTrip.providerRealizedPnl === null) return roundTrip;
    const mismatch = absDecimal(subtractDecimal(roundTrip.providerRealizedPnl, roundTrip.realizedPnl));
    if (compareDecimal(mismatch, "0.01") <= 0) return roundTrip;
    return {
      ...roundTrip,
      quality: "partial" as const,
      warnings: Array.from(new Set([...roundTrip.warnings, "reconciliation_mismatch"]))
    };
  });
}

function failureStatus(error: ExchangeConnectorError): Exclude<ExchangeConnectionStatus, "syncing" | "ready" | "disconnected"> {
  if (
    error.status === "permission_changed" ||
    error.status === "ip_mismatch" ||
    error.status === "rate_limited" ||
    error.status === "provider_unavailable" ||
    error.status === "partial"
  ) {
    return error.status;
  }
  return "provider_unavailable";
}

export interface ExchangeSyncResult {
  connectionId: string;
  status: "ready" | "partial";
  fills: number;
  cashflows: number;
  positions: number;
  openPositions: number;
  warnings: string[];
}

export async function syncExchangeConnection(
  userId: string,
  connectionId: string,
  options: { leaseToken?: string; alreadyClaimed?: boolean } = {}
): Promise<ExchangeSyncResult> {
  const startedAt = new Date().toISOString();
  const leaseToken = options.leaseToken ?? randomUUID();
  let leaseHeld = options.alreadyClaimed === true;

  try {
    assertExchangeMutationConfiguration(userId);
    await assertExchangeOperationalControlEnabled();
    if (!options.alreadyClaimed) {
      const claimed = await claimExchangeConnection(userId, connectionId, leaseToken);
      if (!claimed) throw new ExchangeConnectorError("provider_unavailable", "provider_unavailable");
      leaseHeld = true;
    }
    const connection = await getExchangeConnection(userId, connectionId);
    if (!connection || connection.status === "disconnected") {
      throw new ExchangeConnectorError("provider_unavailable", "provider_unavailable");
    }
    const credentials = await getExchangeCredential(connection);
    if (!credentials) throw new ExchangeConnectorError("permission_changed", "permission_changed");
    const connector = getExchangeConnector(connection.provider);
    const validation = await connector.validateCredentials(credentials);
    if (hashExchangeAccountUid(connection.provider, validation.accountUid) !== connection.account_uid_hash) {
      throw new ExchangeConnectorError("permission_changed", "permission_changed");
    }

    const checkpoint = await getExchangeSyncCheckpoint(userId, connectionId);
    const window = buildSyncWindow(connection, checkpoint);
    const cursor: ExchangeSyncCursor = {
      since: window.since,
      until: window.until,
      cursor: null
    };

    const [existing, cashflowResult, orderResult, positionSnapshot] = await Promise.all([
      loadCanonicalExchangeLedger(userId, connectionId),
      connector.fetchCashflows(credentials, connectionId, cursor),
      connector.fetchOrdersForContext(credentials, cursor),
      connector.fetchPositionSnapshot(credentials)
    ]);
    if (connection.provider === "bingx") {
      const windowStart = Date.parse(window.since);
      const recentFillSymbols = existing.fills
        .filter((fill) => Date.parse(fill.executedAt) >= windowStart)
        .sort((left, right) => Date.parse(right.executedAt) - Date.parse(left.executedAt))
        .map((fill) => fill.symbol);
      const selection = selectBingxSyncSymbols([
        ...cashflowResult.rows.map((cashflow) => cashflow.symbol).filter((symbol): symbol is string => Boolean(symbol)),
        ...orderResult.rows.map((order) => order.symbol),
        ...positionSnapshot.openSymbols,
        ...recentFillSymbols
      ]);
      cursor.symbols = selection.symbols;
      cursor.symbolsTruncated = selection.truncated;
      if (cursor.symbols.length === 0 && !orderResult.complete) {
        throw new ExchangeConnectorError("provider_unavailable", "provider_unavailable");
      }
    }
    const fillResult = await connector.fetchFills(credentials, connectionId, cursor, orderResult.rows);

    const allFills = uniqueFills([...existing.fills, ...fillResult.rows]);
    const allCashflows = uniqueCashflows([...existing.cashflows, ...cashflowResult.rows]);
    const symbolFlatBaselines = { ...connection.symbol_flat_baselines };
    const openNow = new Set(positionSnapshot.openSymbols);
    for (const symbol of connection.baseline_open_symbols) {
      if (!openNow.has(symbol) && !symbolFlatBaselines[symbol]) {
        symbolFlatBaselines[symbol] = positionSnapshot.observedAt;
      }
    }
    const reconstruction = reconstructRoundTrips(allFills, allCashflows, {
      flatAt: connection.flat_baseline_at,
      openSymbols: connection.baseline_open_symbols,
      symbolFlatAt: symbolFlatBaselines
    });
    const coverageWarnings = [
      ...(!fillResult.complete ? ["fill_coverage_incomplete"] : []),
      ...(!cashflowResult.complete ? ["cashflow_coverage_incomplete"] : []),
      ...(!orderResult.complete ? ["order_context_coverage_incomplete"] : [])
    ];
    const roundTrips = reconciledRoundTrips(reconstruction.roundTrips).map((roundTrip) =>
      coverageWarnings.length === 0
        ? roundTrip
        : {
            ...roundTrip,
            quality: "partial" as const,
            warnings: Array.from(new Set([...roundTrip.warnings, ...coverageWarnings]))
          }
    );
    const warnings = Array.from(new Set([
      ...cashflowResult.warnings,
      ...orderResult.warnings,
      ...fillResult.warnings,
      ...reconstruction.warnings,
      ...coverageWarnings,
      ...roundTrips.flatMap((roundTrip) => roundTrip.warnings)
    ]));
    const paginationComplete = cashflowResult.paginationComplete &&
      orderResult.paginationComplete &&
      fillResult.paginationComplete;
    const complete = paginationComplete &&
      cashflowResult.complete &&
      orderResult.complete &&
      fillResult.complete &&
      roundTrips.every((roundTrip) => roundTrip.quality === "complete");
    const status = complete ? "ready" as const : "partial" as const;
    let nextCursor: Record<string, unknown>;
    let commitWatermark = checkpoint?.watermark ?? window.since;
    if (!paginationComplete) {
      const currentSpanMs = Date.parse(window.until) - Date.parse(window.since);
      if (currentSpanMs <= minimumRetryWindowMs) {
        throw new ExchangeConnectorError("cursor_stalled", "partial");
      }
      const retrySpanMs = Math.max(minimumRetryWindowMs, Math.floor(currentSpanMs / 2));
      const retryFloor = window.retry?.floor ?? window.since;
      const retryResumePhase = window.retry?.resumePhase ??
        (window.phase === "incremental" ? "incremental" : "backfill");
      const retryResumeBackfillBefore = window.retry?.resumeBackfillBefore ??
        (window.phase === "incremental" ? null : window.since);
      nextCursor = {
        phase: "retry",
        retryUntil: window.until,
        retryFloor,
        retrySpanMs,
        retryTargetWatermark: window.retry?.targetWatermark ?? window.watermark,
        retryResumePhase,
        retryResumeBackfillBefore
      };
      warnings.push("pagination_window_reduced");
    } else if (window.phase === "retry" && window.retry) {
      if (Date.parse(window.since) > Date.parse(window.retry.floor)) {
        nextCursor = {
          phase: "retry",
          retryUntil: window.since,
          retryFloor: window.retry.floor,
          retrySpanMs: window.retry.spanMs,
          retryTargetWatermark: window.retry.targetWatermark,
          retryResumePhase: window.retry.resumePhase,
          retryResumeBackfillBefore: window.retry.resumeBackfillBefore
        };
      } else {
        const backfillBefore = window.retry.resumePhase === "backfill" &&
          window.retry.resumeBackfillBefore &&
          Date.parse(window.retry.resumeBackfillBefore) > Date.parse(connection.first_sync_from)
          ? window.retry.resumeBackfillBefore
          : null;
        nextCursor = {
          phase: backfillBefore ? "backfill" : "incremental",
          backfillBefore
        };
        commitWatermark = window.retry.targetWatermark;
      }
    } else {
      const backfillBefore = window.phase !== "incremental" &&
        Date.parse(window.since) > Date.parse(connection.first_sync_from)
        ? window.since
        : null;
      nextCursor = {
        phase: backfillBefore ? "backfill" : "incremental",
        backfillBefore
      };
      commitWatermark = window.watermark;
    }

    await commitExchangeSync({
      connectionId,
      userId,
      leaseToken,
      startedAt,
      status,
      cursor: nextCursor,
      watermark: commitWatermark,
      orders: orderResult.rows,
      fills: fillResult.rows,
      cashflows: cashflowResult.rows,
      positions: roundTrips,
      symbolFlatBaselines,
      warnings
    });
    const assessment = await evaluatePendingExchangeTrades(userId, connectionId).catch(() => ({
      attempted: 0,
      ready: 0,
      insufficient: 0,
      unavailable: 0,
      warnings: ["trade_quality_deferred"]
    }));
    warnings.push(...assessment.warnings);
    return {
      connectionId,
      status,
      fills: fillResult.rows.length,
      cashflows: cashflowResult.rows.length,
      positions: roundTrips.length,
      openPositions: reconstruction.openPositionCount,
      warnings: Array.from(new Set(warnings))
    };
  } catch (error) {
    if (error instanceof ExchangeJournalConfigurationError) {
      if (leaseHeld) {
        await failExchangeSync({
          connectionId,
          userId,
          leaseToken,
          startedAt,
          status: "provider_unavailable",
          errorCode: error.code
        }).catch(() => undefined);
      }
      throw error;
    }
    const connectorError = error instanceof ExchangeConnectorError
      ? error
      : new ExchangeConnectorError("provider_unavailable", "provider_unavailable");
    if (leaseHeld) {
      await failExchangeSync({
        connectionId,
        userId,
        leaseToken,
        startedAt,
        status: failureStatus(connectorError),
        errorCode: connectorError.code
      }).catch(() => undefined);
    }
    throw connectorError;
  }
}
