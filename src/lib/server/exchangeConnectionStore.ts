import { createHash, randomUUID } from "node:crypto";
import type {
  ActiveExchangeProvider,
  CanonicalExchangeCashflow,
  CanonicalExchangeFill,
  ExchangeConnectionStatus,
  ExchangePositionMode,
  ReconstructedRoundTrip
} from "@/lib/exchangeJournal";
import {
  decryptExchangeCredentials,
  encryptExchangeCredentials,
  hashExchangeAccountUid,
  maskedApiKey,
  type EncryptedExchangeCredentials
} from "@/lib/server/exchangeCredentials";
import { exchangeTradePositionFingerprint } from "@/lib/server/exchangeTradeFingerprint";
import type { ExchangeCredentialValidation, ExchangeOrderContext } from "@/lib/server/exchanges/types";
import { supabaseAdminRest, supabaseAdminRestAll, supabaseAdminRpc } from "@/lib/server/supabaseAdmin";
import type {
  PostExitConfirmation,
  TradeDurationClass,
  TradeQualityConfidence,
  TradeQualityGrade,
  TradeQualityTimeframe,
  TradeSignificance
} from "@/lib/tradeQuality";

export interface ExchangeConnectionRow {
  id: string;
  user_id: string;
  provider: ActiveExchangeProvider;
  product: "usdt_perpetual";
  label: string;
  account_uid_hash: string;
  account_mode: string;
  position_mode: ExchangePositionMode;
  status: ExchangeConnectionStatus;
  masked_api_key: string;
  permission_summary: Record<string, unknown>;
  ip_whitelist: string[];
  history_days: 30 | 90;
  first_sync_from: string;
  flat_baseline_at: string;
  baseline_open_symbols: string[];
  symbol_flat_baselines: Record<string, string>;
  last_synced_at: string | null;
  next_sync_at: string;
  sync_lease_token: string | null;
  sync_lease_until: string | null;
  sync_failure_count: number;
  last_error_code: string | null;
  created_at: string;
  updated_at: string;
}

interface ExchangeCredentialRow {
  connection_id: string;
  user_id: string;
  encrypted_credentials: string;
  encryption_iv: string;
  authentication_tag: string;
  key_version: 1;
}

interface ExchangeCheckpointRow {
  cursor: Record<string, unknown>;
  watermark: string;
}

interface ExchangeFillRow {
  connection_id: string;
  provider: ActiveExchangeProvider;
  external_trade_id: string;
  external_order_id: string | null;
  symbol: string;
  side: "buy" | "sell";
  position_mode: CanonicalExchangeFill["positionMode"];
  position_side: CanonicalExchangeFill["positionSide"];
  open_close: CanonicalExchangeFill["openClose"];
  reduce_only: boolean | null;
  quantity_base: string;
  quantity_contracts: string | null;
  contract_multiplier: string | null;
  price: string;
  quote_notional: string;
  provider_realized_pnl: string | null;
  fee_native_signed: string;
  fee_currency: string;
  fee_quote_signed: string | null;
  executed_at: string;
  provider_sequence: string | null;
  execution_type: CanonicalExchangeFill["executionType"];
  payload_fingerprint: string;
}

interface ExchangeCashflowRow {
  connection_id: string;
  provider: ActiveExchangeProvider;
  external_cashflow_id: string;
  symbol: string | null;
  position_side: CanonicalExchangeCashflow["positionSide"];
  cashflow_type: CanonicalExchangeCashflow["type"];
  amount_signed: string;
  currency: string;
  amount_quote_signed: string | null;
  occurred_at: string;
  related_trade_id: string | null;
  related_order_id: string | null;
  allocation_status: CanonicalExchangeCashflow["allocationStatus"];
  reconciliation_only: boolean;
  payload_fingerprint: string;
}

export interface ExchangeTradeAssessmentRow {
  status: "ready" | "insufficient_data" | "market_data_unavailable";
  evaluation_version: "market_context_v1";
  position_fingerprint: string;
  input_fingerprint: string;
  market_provider: ActiveExchangeProvider;
  market_symbol: string;
  primary_timeframe: TradeQualityTimeframe;
  context_timeframe: Exclude<TradeQualityTimeframe, "1m"> | "1d";
  requested_from: string;
  requested_until: string;
  coverage_ratio: number;
  expected_bars: number;
  observed_bars: number;
  max_gap_bars: number;
  confidence: TradeQualityConfidence | "unavailable";
  entry_score: number | null;
  entry_grade: TradeQualityGrade | null;
  exit_score: number | null;
  exit_grade: TradeQualityGrade | null;
  holding_seconds: number;
  duration_class: TradeDurationClass;
  significance: TradeSignificance | null;
  post_exit_confirmation: PostExitConfirmation;
  metrics: Record<string, number | null>;
  entry_reasons: string[];
  exit_reasons: string[];
  significance_reasons: string[];
  warnings: string[];
  next_retry_at: string | null;
  evaluated_at: string;
}

export interface ExchangeTradeAssessmentWrite extends ExchangeTradeAssessmentRow {
  position_id: string;
  connection_id: string;
  user_id: string;
}

export interface ExchangePositionRow {
  id: string;
  connection_id: string;
  position_fingerprint: string;
  provider: ActiveExchangeProvider;
  symbol: string;
  position_side: "long" | "short";
  opened_at: string;
  closed_at: string;
  quantity_base: string;
  average_entry_price: string;
  average_exit_price: string;
  realized_pnl: string;
  provider_realized_pnl: string | null;
  fee_total: string;
  funding_total: string;
  net_pnl: string;
  exit_reason: "trade" | "liquidation" | "adl" | "delivery";
  fill_count: number;
  quality: "complete" | "partial";
  warnings: string[];
  exchange_trade_assessments?: ExchangeTradeAssessmentRow[];
  exchange_trade_reviews?: Array<{
    strategy_tags: string[];
    kept_principles: string[];
    broken_principles: string[];
    next_checkpoint: string;
    memo: string;
    reviewed_at: string;
  }>;
}

export function publicExchangeConnection(row: ExchangeConnectionRow) {
  return {
    id: row.id,
    provider: row.provider,
    product: row.product,
    label: row.label,
    accountMode: row.account_mode,
    positionMode: row.position_mode,
    status: row.status,
    maskedApiKey: row.masked_api_key,
    ipWhitelist: row.ip_whitelist,
    historyDays: row.history_days,
    lastSyncedAt: row.last_synced_at,
    nextSyncAt: row.next_sync_at,
    syncFailureCount: row.sync_failure_count,
    lastErrorCode: row.last_error_code,
    createdAt: row.created_at
  };
}

export async function listExchangeConnections(userId: string, includeDisconnected = false) {
  const filter = includeDisconnected ? "" : "&status=neq.disconnected";
  return supabaseAdminRest<ExchangeConnectionRow[]>(
    `exchange_connections?select=*&user_id=eq.${encodeURIComponent(userId)}${filter}&order=created_at.asc`
  );
}

export function selectExchangeConnectionsForEntitlement(
  rows: ExchangeConnectionRow[],
  connectionLimit: number
) {
  const active = rows.filter((row) => row.status !== "disconnected");
  const retained = rows.filter((row) => row.status === "disconnected").reverse();
  return [...active, ...retained].slice(0, Math.max(1, connectionLimit));
}

export async function getExchangeConnection(userId: string, connectionId: string) {
  const rows = await supabaseAdminRest<ExchangeConnectionRow[]>(
    `exchange_connections?select=*&id=eq.${encodeURIComponent(connectionId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`
  );
  return rows[0] ?? null;
}

export async function getExchangeCredential(connection: ExchangeConnectionRow) {
  const rows = await supabaseAdminRest<ExchangeCredentialRow[]>(
    `exchange_credentials?select=connection_id,user_id,encrypted_credentials,encryption_iv,authentication_tag,key_version&connection_id=eq.${encodeURIComponent(connection.id)}&user_id=eq.${encodeURIComponent(connection.user_id)}&limit=1`
  );
  const row = rows[0];
  if (!row) return null;
  return decryptExchangeCredentials(connection.id, connection.user_id, connection.provider, {
    ciphertext: row.encrypted_credentials,
    iv: row.encryption_iv,
    authTag: row.authentication_tag,
    keyVersion: row.key_version
  });
}

export async function createExchangeConnection(input: {
  userId: string;
  provider: ActiveExchangeProvider;
  label: string;
  historyDays: 30 | 90;
  connectionLimit: number;
  credentials: { apiKey: string; secret: string; passphrase?: string };
  validation: ExchangeCredentialValidation;
  positionBaseline: {
    observedAt: string;
    openSymbols: string[];
  };
}) {
  const id = randomUUID();
  const encrypted: EncryptedExchangeCredentials = encryptExchangeCredentials(
    id,
    input.userId,
    input.provider,
    input.credentials
  );
  const firstSyncFrom = new Date(Date.now() - input.historyDays * 24 * 60 * 60 * 1000).toISOString();
  const rows = await supabaseAdminRpc<Array<{ id: string }>>("create_exchange_connection", {
    p_id: id,
    p_user_id: input.userId,
    p_provider: input.provider,
    p_label: input.label.trim().slice(0, 80),
    p_account_uid_hash: hashExchangeAccountUid(input.provider, input.validation.accountUid),
    p_account_mode: input.validation.accountMode,
    p_position_mode: input.validation.positionMode,
    p_masked_api_key: maskedApiKey(input.credentials.apiKey),
    p_permission_summary: input.validation.permissionSummary,
    p_ip_whitelist: input.validation.ipWhitelist,
    p_history_days: input.historyDays,
    p_first_sync_from: firstSyncFrom,
    p_flat_baseline_at: input.positionBaseline.observedAt,
    p_baseline_open_symbols: input.positionBaseline.openSymbols,
    p_connection_limit: input.connectionLimit,
    p_encrypted_credentials: encrypted.ciphertext,
    p_encryption_iv: encrypted.iv,
    p_authentication_tag: encrypted.authTag,
    p_key_version: encrypted.keyVersion
  });
  if (rows[0]?.id !== id) throw new Error("exchange_connection_create_failed");
  return getExchangeConnection(input.userId, id);
}

export async function disconnectExchangeConnection(userId: string, connectionId: string, deleteHistory: boolean) {
  return supabaseAdminRpc<boolean>("disconnect_exchange_connection", {
    p_connection_id: connectionId,
    p_user_id: userId,
    p_delete_history: deleteHistory
  });
}

export async function claimExchangeConnection(userId: string, connectionId: string, leaseToken: string) {
  return supabaseAdminRpc<boolean>("claim_exchange_connection", {
    p_connection_id: connectionId,
    p_user_id: userId,
    p_lease_token: leaseToken
  });
}

export async function claimDueExchangeConnections(
  limit: number,
  leaseToken: string,
  allowedUserIds: string[] | null
) {
  return supabaseAdminRpc<Array<Pick<ExchangeConnectionRow, "id" | "user_id" | "provider" | "history_days">>>(
    "claim_due_exchange_connections",
    {
      p_limit: limit,
      p_lease_token: leaseToken,
      p_allowed_user_ids: allowedUserIds
    }
  );
}

export async function getExchangeSyncCheckpoint(userId: string, connectionId: string) {
  const rows = await supabaseAdminRest<ExchangeCheckpointRow[]>(
    `exchange_sync_checkpoints?select=cursor,watermark&connection_id=eq.${encodeURIComponent(connectionId)}&user_id=eq.${encodeURIComponent(userId)}&stream=eq.fills&symbol=eq.*&limit=1`
  );
  return rows[0] ?? null;
}

export async function loadCanonicalExchangeLedger(userId: string, connectionId: string) {
  const [fillRows, cashflowRows] = await Promise.all([
    supabaseAdminRestAll<ExchangeFillRow>(
      `exchange_trade_fills?select=connection_id,provider,external_trade_id,external_order_id,symbol,side,position_mode,position_side,open_close,reduce_only,quantity_base,quantity_contracts,contract_multiplier,price,quote_notional,provider_realized_pnl,fee_native_signed,fee_currency,fee_quote_signed,executed_at,provider_sequence,execution_type,payload_fingerprint&connection_id=eq.${encodeURIComponent(connectionId)}&user_id=eq.${encodeURIComponent(userId)}&order=executed_at.asc`
    ),
    supabaseAdminRestAll<ExchangeCashflowRow>(
      `exchange_cashflows?select=connection_id,provider,external_cashflow_id,symbol,position_side,cashflow_type,amount_signed,currency,amount_quote_signed,occurred_at,related_trade_id,related_order_id,allocation_status,reconciliation_only,payload_fingerprint&connection_id=eq.${encodeURIComponent(connectionId)}&user_id=eq.${encodeURIComponent(userId)}&order=occurred_at.asc`
    )
  ]);
  return {
    fills: fillRows.map((row): CanonicalExchangeFill => ({
      provider: row.provider,
      connectionId: row.connection_id,
      externalTradeId: row.external_trade_id,
      externalOrderId: row.external_order_id,
      symbol: row.symbol,
      product: "usdt_perpetual",
      side: row.side,
      positionMode: row.position_mode,
      positionSide: row.position_side,
      openClose: row.open_close,
      reduceOnly: row.reduce_only,
      quantityBase: row.quantity_base,
      quantityContracts: row.quantity_contracts,
      contractMultiplier: row.contract_multiplier,
      price: row.price,
      quoteNotional: row.quote_notional,
      providerRealizedPnl: row.provider_realized_pnl,
      feeNativeSigned: row.fee_native_signed,
      feeCurrency: row.fee_currency,
      feeQuoteSigned: row.fee_quote_signed,
      executedAt: row.executed_at,
      providerSequence: row.provider_sequence,
      executionType: row.execution_type,
      payloadFingerprint: row.payload_fingerprint
    })),
    cashflows: cashflowRows.map((row): CanonicalExchangeCashflow => ({
      provider: row.provider,
      connectionId: row.connection_id,
      externalCashflowId: row.external_cashflow_id,
      symbol: row.symbol,
      positionSide: row.position_side,
      type: row.cashflow_type,
      amountSigned: row.amount_signed,
      currency: row.currency,
      amountQuoteSigned: row.amount_quote_signed,
      occurredAt: row.occurred_at,
      relatedTradeId: row.related_trade_id,
      relatedOrderId: row.related_order_id,
      allocationStatus: row.allocation_status,
      reconciliationOnly: row.reconciliation_only,
      payloadFingerprint: row.payload_fingerprint
    }))
  };
}

function orderPayload(order: ExchangeOrderContext, observedAt: string) {
  const base = {
    external_order_id: order.externalOrderId,
    symbol: order.symbol,
    position_mode: order.positionMode,
    position_side: order.positionSide,
    open_close: order.openClose,
    reduce_only: order.reduceOnly,
    observed_at: observedAt
  };
  return {
    ...base,
    payload_fingerprint: createHash("sha256").update(JSON.stringify(base)).digest("hex")
  };
}

function fillPayload(fill: CanonicalExchangeFill) {
  return {
    external_trade_id: fill.externalTradeId,
    external_order_id: fill.externalOrderId,
    symbol: fill.symbol,
    side: fill.side,
    position_mode: fill.positionMode,
    position_side: fill.positionSide,
    open_close: fill.openClose,
    reduce_only: fill.reduceOnly,
    quantity_base: fill.quantityBase,
    quantity_contracts: fill.quantityContracts,
    contract_multiplier: fill.contractMultiplier,
    price: fill.price,
    quote_notional: fill.quoteNotional,
    provider_realized_pnl: fill.providerRealizedPnl,
    fee_native_signed: fill.feeNativeSigned,
    fee_currency: fill.feeCurrency,
    fee_quote_signed: fill.feeQuoteSigned,
    executed_at: fill.executedAt,
    provider_sequence: fill.providerSequence,
    execution_type: fill.executionType,
    payload_fingerprint: fill.payloadFingerprint
  };
}

function cashflowPayload(cashflow: CanonicalExchangeCashflow) {
  return {
    external_cashflow_id: cashflow.externalCashflowId,
    symbol: cashflow.symbol,
    position_side: cashflow.positionSide,
    cashflow_type: cashflow.type,
    amount_signed: cashflow.amountSigned,
    currency: cashflow.currency,
    amount_quote_signed: cashflow.amountQuoteSigned,
    occurred_at: cashflow.occurredAt,
    related_trade_id: cashflow.relatedTradeId,
    related_order_id: cashflow.relatedOrderId,
    allocation_status: cashflow.allocationStatus,
    reconciliation_only: cashflow.reconciliationOnly,
    payload_fingerprint: cashflow.payloadFingerprint
  };
}

function positionPayload(position: ReconstructedRoundTrip) {
  return {
    round_trip_key: position.roundTripKey,
    symbol: position.symbol,
    position_side: position.positionSide,
    opened_at: position.openedAt,
    closed_at: position.closedAt,
    quantity_base: position.quantityBase,
    average_entry_price: position.averageEntryPrice,
    average_exit_price: position.averageExitPrice,
    realized_pnl: position.realizedPnl,
    provider_realized_pnl: position.providerRealizedPnl,
    fee_total: position.feeTotal,
    funding_total: position.fundingTotal,
    net_pnl: position.netPnl,
    exit_reason: position.exitReason,
    fill_count: position.fillCount,
    calculation_version: position.calculationVersion,
    quality: position.quality,
    position_fingerprint: exchangeTradePositionFingerprint({
      connectionId: position.connectionId,
      provider: position.provider,
      symbol: position.symbol,
      positionSide: position.positionSide,
      openedAt: position.openedAt,
      closedAt: position.closedAt,
      quantityBase: position.quantityBase,
      averageEntryPrice: position.averageEntryPrice,
      averageExitPrice: position.averageExitPrice,
      realizedPnl: position.realizedPnl,
      feeTotal: position.feeTotal,
      fundingTotal: position.fundingTotal,
      netPnl: position.netPnl,
      exitReason: position.exitReason,
      fillCount: position.fillCount,
      quality: position.quality
    }),
    warnings: position.warnings
  };
}

export async function commitExchangeSync(input: {
  connectionId: string;
  userId: string;
  leaseToken: string;
  startedAt: string;
  status: "ready" | "partial";
  cursor: Record<string, unknown>;
  watermark: string;
  orders: ExchangeOrderContext[];
  fills: CanonicalExchangeFill[];
  cashflows: CanonicalExchangeCashflow[];
  positions: ReconstructedRoundTrip[];
  symbolFlatBaselines: Record<string, string>;
  warnings: string[];
}) {
  return supabaseAdminRpc<Record<string, number>>("commit_exchange_sync_batch", {
    p_connection_id: input.connectionId,
    p_user_id: input.userId,
    p_lease_token: input.leaseToken,
    p_started_at: input.startedAt,
    p_status: input.status,
    p_stream: "fills",
    p_symbol: "*",
    p_cursor: input.cursor,
    p_watermark: input.watermark,
    p_orders: input.orders.map((order) => orderPayload(order, input.watermark)),
    p_fills: input.fills.map(fillPayload),
    p_cashflows: input.cashflows.map(cashflowPayload),
    p_positions: input.positions.map(positionPayload),
    p_symbol_flat_baselines: input.symbolFlatBaselines,
    p_warnings: input.warnings
  });
}

export async function failExchangeSync(input: {
  connectionId: string;
  userId: string;
  leaseToken: string;
  startedAt: string;
  status: "partial" | "permission_changed" | "ip_mismatch" | "rate_limited" | "provider_unavailable";
  errorCode: string;
}) {
  return supabaseAdminRpc<boolean>("fail_exchange_sync", {
    p_connection_id: input.connectionId,
    p_user_id: input.userId,
    p_lease_token: input.leaseToken,
    p_started_at: input.startedAt,
    p_status: input.status,
    p_error_code: input.errorCode.slice(0, 80)
  });
}

export async function listExchangePositions(userId: string, since: string, connectionIds: string[]) {
  if (connectionIds.length === 0) return [];
  const connectionFilter = encodeURIComponent(`(${connectionIds.join(",")})`);
  return supabaseAdminRestAll<ExchangePositionRow>(
    `exchange_trade_positions?select=id,connection_id,position_fingerprint,provider,symbol,position_side,opened_at,closed_at,quantity_base,average_entry_price,average_exit_price,realized_pnl,provider_realized_pnl,fee_total,funding_total,net_pnl,exit_reason,fill_count,quality,warnings,exchange_trade_assessments!exchange_trade_assessments_position_owner_fkey(status,evaluation_version,position_fingerprint,input_fingerprint,market_provider,market_symbol,primary_timeframe,context_timeframe,requested_from,requested_until,coverage_ratio,expected_bars,observed_bars,max_gap_bars,confidence,entry_score,entry_grade,exit_score,exit_grade,holding_seconds,duration_class,significance,post_exit_confirmation,metrics,entry_reasons,exit_reasons,significance_reasons,warnings,next_retry_at,evaluated_at),exchange_trade_reviews!exchange_trade_reviews_position_owner_fkey(strategy_tags,kept_principles,broken_principles,next_checkpoint,memo,reviewed_at)&user_id=eq.${encodeURIComponent(userId)}&connection_id=in.${connectionFilter}&is_current=eq.true&closed_at=gte.${encodeURIComponent(since)}&order=closed_at.desc`,
    500
  );
}

export async function listExchangeAssessmentCandidates(userId: string, connectionId: string, limit = 2, now = new Date()) {
  return supabaseAdminRpc<ExchangePositionRow[]>("list_due_exchange_trade_assessment_positions", {
    p_user_id: userId,
    p_connection_id: connectionId,
    p_now: now.toISOString(),
    p_limit: Math.max(1, Math.min(limit, 10))
  });
}

export async function upsertExchangeTradeAssessment(input: ExchangeTradeAssessmentWrite) {
  return supabaseAdminRpc<boolean>("upsert_exchange_trade_assessment", {
    p_position_id: input.position_id,
    p_connection_id: input.connection_id,
    p_user_id: input.user_id,
    p_position_fingerprint: input.position_fingerprint,
    p_assessment: {
      status: input.status,
      evaluation_version: input.evaluation_version,
      input_fingerprint: input.input_fingerprint,
      market_provider: input.market_provider,
      market_symbol: input.market_symbol,
      primary_timeframe: input.primary_timeframe,
      context_timeframe: input.context_timeframe,
      requested_from: input.requested_from,
      requested_until: input.requested_until,
      coverage_ratio: input.coverage_ratio,
      expected_bars: input.expected_bars,
      observed_bars: input.observed_bars,
      max_gap_bars: input.max_gap_bars,
      confidence: input.confidence,
      entry_score: input.entry_score,
      entry_grade: input.entry_grade,
      exit_score: input.exit_score,
      exit_grade: input.exit_grade,
      holding_seconds: input.holding_seconds,
      duration_class: input.duration_class,
      significance: input.significance,
      post_exit_confirmation: input.post_exit_confirmation,
      metrics: input.metrics,
      entry_reasons: input.entry_reasons,
      exit_reasons: input.exit_reasons,
      significance_reasons: input.significance_reasons,
      warnings: input.warnings,
      next_retry_at: input.next_retry_at,
      evaluated_at: input.evaluated_at
    }
  });
}
