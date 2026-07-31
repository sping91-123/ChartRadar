import { createHash } from "node:crypto";
import type {
  ActiveExchangeProvider,
  CanonicalExchangeCashflow,
  CanonicalExchangeFill,
  ExchangeCashflowType,
  ExchangeExecutionType,
  ExchangeOpenClose,
  ExchangePositionMode,
  ExchangePositionSide
} from "../../exchangeJournal";
import { addDecimal, compareDecimal, multiplyDecimal, negateDecimal, normalizeDecimal } from "../../decimal";
import type { ExchangeOrderContext } from "./types";

type UnknownRecord = Record<string, unknown>;

export interface CcxtMarketLike {
  id?: string;
  symbol?: string;
  contract?: boolean;
  swap?: boolean;
  future?: boolean;
  linear?: boolean;
  quote?: string;
  settle?: string;
  contractSize?: number | string;
}

export interface CcxtTradeLike {
  id?: string;
  order?: string;
  symbol?: string;
  side?: string;
  amount?: number;
  price?: number;
  cost?: number;
  timestamp?: number;
  datetime?: string;
  fee?: { cost?: number; currency?: string };
  info?: unknown;
}

export interface CcxtLedgerLike {
  id?: string;
  symbol?: string;
  currency?: string;
  code?: string;
  amount?: number;
  timestamp?: number;
  datetime?: string;
  type?: string;
  direction?: string;
  info?: unknown;
}

function record(value: unknown): UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function stringValue(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return "";
}

function booleanValue(value: unknown): boolean | null {
  const normalized = stringValue(value).toLowerCase();
  if (value === true || value === 1 || normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (value === false || value === 0 || normalized === "false" || normalized === "0" || normalized === "no") return false;
  return null;
}

function decimalValue(value: unknown, fallback = "0") {
  const raw = stringValue(value);
  if (!raw) return fallback;
  try {
    return normalizeDecimal(raw);
  } catch {
    return fallback;
  }
}

function optionalDecimal(value: unknown) {
  const raw = stringValue(value);
  if (!raw) return null;
  try {
    return normalizeDecimal(raw);
  } catch {
    return null;
  }
}

function firstValue(info: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = info[key];
    if (value !== undefined && value !== null && stringValue(value) !== "") return value;
  }
  return undefined;
}

function feeDetails(info: UnknownRecord) {
  let value = info.feeDetail;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (Array.isArray(value)) return value.map(record).filter((item) => Object.keys(item).length > 0);
  const detail = record(value);
  return Object.keys(detail).length > 0 ? [detail] : [];
}

function firstFeeDetail(info: UnknownRecord) {
  return feeDetails(info)[0] ?? {};
}

function summedFeeDetail(info: UnknownRecord) {
  const details = feeDetails(info);
  if (details.length === 0) return undefined;
  const amounts = details.map((detail) => optionalDecimal(firstValue(detail, ["fee", "totalFee"])));
  if (amounts.some((amount) => amount === null)) return null;
  const validAmounts = amounts.filter((amount): amount is string => amount !== null);
  return validAmounts.length > 0 ? addDecimal(...validAmounts) : undefined;
}

function isoTime(value: unknown, fallback?: string) {
  const raw = stringValue(value);
  const numeric = Number(raw);
  const date = Number.isFinite(numeric) && raw ? new Date(numeric) : new Date(raw || fallback || "");
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function positionSideFrom(value: unknown): ExchangePositionSide {
  const normalized = stringValue(value).toLowerCase();
  if (normalized === "long" || normalized === "1") return "long";
  if (normalized === "short" || normalized === "2") return "short";
  if (normalized === "net" || normalized === "0" || normalized === "both") return "net";
  return "unknown";
}

function positionModeFromSide(side: ExchangePositionSide): ExchangePositionMode {
  if (side === "long" || side === "short") return "hedge";
  if (side === "net") return "one_way";
  return "unknown";
}

function positionModeFrom(value: unknown): ExchangePositionMode {
  const normalized = stringValue(value).toLowerCase();
  if (normalized === "hedge" || normalized === "hedge_mode" || normalized === "long_short_mode") return "hedge";
  if (
    normalized === "one_way" ||
    normalized === "oneway" ||
    normalized === "one_way_mode" ||
    normalized === "net_mode"
  ) {
    return "one_way";
  }
  return "unknown";
}

function explicitOpenClose(value: unknown): ExchangeOpenClose {
  const normalized = stringValue(value).toLowerCase();
  if (!normalized) return "unknown";
  if (normalized.includes("mixed") || normalized.includes("reverse")) return "mixed";
  if (normalized.includes("close") || normalized.includes("reduce")) return "close";
  if (normalized.includes("open") || normalized.includes("increase")) return "open";
  return "unknown";
}

function openCloseFrom(
  info: UnknownRecord,
  side: "buy" | "sell",
  quantity: string,
  positionSide: ExchangePositionSide,
  reduceOnly: boolean | null,
  orderContext?: ExchangeOrderContext
): ExchangeOpenClose {
  const explicit = explicitOpenClose(firstValue(info, ["tradeSide", "openClose", "offset", "action"]));
  if (explicit !== "unknown") return explicit;
  const closedSize = optionalDecimal(firstValue(info, ["closedSize", "closeQty", "closeSize"]));
  if (closedSize !== null) {
    if (compareDecimal(closedSize, "0") === 0) return "open";
    const comparison = compareDecimal(closedSize, quantity);
    if (comparison >= 0) return "close";
    return "mixed";
  }
  if (orderContext?.openClose && orderContext.openClose !== "unknown") return orderContext.openClose;
  if (reduceOnly === true) return "close";
  if (positionSide === "long") return side === "buy" ? "open" : "close";
  if (positionSide === "short") return side === "sell" ? "open" : "close";
  return "unknown";
}

function executionTypeFrom(value: unknown): ExchangeExecutionType {
  const normalized = stringValue(value).toLowerCase();
  if (normalized.includes("liquidat")) return "liquidation";
  if (normalized.includes("adl")) return "adl";
  if (normalized.includes("deliver") || normalized.includes("settle")) return "delivery";
  if (
    !normalized ||
    normalized.includes("trade") ||
    normalized.includes("fill") ||
    normalized === "market" ||
    normalized === "limit"
  ) {
    return "trade";
  }
  return "other";
}

function cashflowTypeFrom(value: unknown): ExchangeCashflowType {
  const normalized = stringValue(value).toLowerCase();
  if (normalized.includes("fund")) return "funding";
  if (
    normalized === "8" ||
    normalized === "173" ||
    normalized === "174" ||
    normalized === "contract_main_settle_fee_user_in" ||
    normalized === "contract_main_settle_fee_user_out" ||
    normalized === "margin_settle_fee_user_in" ||
    normalized === "margin_settle_fee_user_out"
  ) {
    return "funding";
  }
  if (normalized.includes("trading_fee") || normalized === "fee" || normalized.includes("commission")) return "trade_fee";
  if (normalized.includes("liquidat") || normalized.includes("insurance")) return "liquidation_fee";
  if (normalized.includes("adl")) return "adl";
  if (normalized.includes("settle") || normalized.includes("delivery")) return "settlement";
  if (normalized.includes("transfer")) return "transfer";
  return "other";
}

function fingerprint(value: Record<string, unknown>) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function signedFee(provider: ActiveExchangeProvider, info: UnknownRecord, feeCost: unknown) {
  const detailFee = summedFeeDetail(info);
  if (detailFee === null) return null;
  const providerFee = firstValue(info, ["fee", "execFee", "commission"]) ?? detailFee;
  const ccxtFee = optionalDecimal(feeCost);
  if (provider !== "okx" && ccxtFee !== null) return negateDecimal(ccxtFee);
  const normalized = optionalDecimal(providerFee ?? feeCost);
  if (normalized === null) return null;
  if (provider === "okx" && providerFee !== undefined) return normalized;
  return negateDecimal(normalized);
}

function providerPnl(info: UnknownRecord) {
  const raw = firstValue(info, ["fillPnl", "execPnl", "realizedPnl", "closedPnl", "pnl"]);
  return raw === undefined ? null : optionalDecimal(raw);
}

export function marketIsUsdtPerpetual(market: CcxtMarketLike | undefined) {
  if (!market) return false;
  return market.contract === true &&
    market.swap === true &&
    market.linear !== false &&
    stringValue(market.settle || market.quote).toUpperCase() === "USDT";
}

export function normalizeCcxtTrade(
  provider: ActiveExchangeProvider,
  connectionId: string,
  trade: CcxtTradeLike,
  market: CcxtMarketLike | undefined,
  orderContext?: ExchangeOrderContext
): CanonicalExchangeFill | null {
  if (!marketIsUsdtPerpetual(market)) return null;
  const info = record(trade.info);
  const externalTradeId = stringValue(trade.id || firstValue(info, ["tradeId", "execId", "fillId", "billId"]));
  const externalOrderId = stringValue(trade.order || firstValue(info, ["orderId", "ordId"])) || null;
  const symbol = stringValue(trade.symbol || market?.symbol).toUpperCase();
  const rawSide = stringValue(trade.side || info.side).toLowerCase();
  const price = decimalValue(firstValue(info, ["fillPx", "price", "execPrice"]) ?? trade.price, "");
  const contracts = decimalValue(
    firstValue(info, ["fillSz", "size", "qty", "quantity", "execQty"]) ?? trade.amount,
    ""
  );
  const executedAt = isoTime(
    firstValue(info, ["fillTime", "execTime", "closeTime", "time", "timestamp"]),
    trade.datetime ?? (trade.timestamp ? new Date(trade.timestamp).toISOString() : undefined)
  );
  if (!externalTradeId || !symbol || (rawSide !== "buy" && rawSide !== "sell") || !price || !contracts || !executedAt) {
    return null;
  }
  const side: "buy" | "sell" = rawSide;
  if (compareDecimal(contracts, "0") <= 0 || compareDecimal(price, "0") <= 0) return null;

  const contractMultiplier = market?.contractSize ? decimalValue(market.contractSize) : "1";
  const quantityBase = multiplyDecimal(contracts, contractMultiplier);
  const rawPositionSide = positionSideFrom(firstValue(info, ["posSide", "positionSide", "positionIdx"]));
  const positionSide = rawPositionSide === "unknown" ? orderContext?.positionSide ?? "unknown" : rawPositionSide;
  const positionMode = orderContext?.positionMode ?? positionModeFromSide(positionSide);
  const reduceOnly = orderContext?.reduceOnly ?? booleanValue(firstValue(info, ["reduceOnly", "reduce_only"]));
  const openClose = openCloseFrom(info, side, quantityBase, positionSide, reduceOnly, orderContext);
  const feeDetail = firstFeeDetail(info);
  const detailCurrencies = new Set(
    feeDetails(info)
      .map((detail) => stringValue(firstValue(detail, ["feeCoin", "feeCoinCode"])).toUpperCase())
      .filter(Boolean)
  );
  if (!trade.fee?.currency && !firstValue(info, ["feeCcy", "commissionAsset"]) && detailCurrencies.size > 1) {
    return null;
  }
  const feeCurrency = stringValue(
    trade.fee?.currency ||
    firstValue(info, ["feeCcy", "commissionAsset"]) ||
    firstValue(feeDetail, ["feeCoin", "feeCoinCode"])
  ).toUpperCase() || "UNKNOWN";
  const parsedFee = signedFee(provider, info, trade.fee?.cost);
  const feeNativeSigned = parsedFee ?? "0";
  const feeQuoteSigned = feeCurrency === "USDT" && parsedFee !== null ? parsedFee : null;
  const quoteNotional = trade.cost !== undefined
    ? decimalValue(trade.cost)
    : multiplyDecimal(quantityBase, price);
  const executionType = executionTypeFrom(firstValue(info, ["execType", "tradeType", "type", "orderType"]));
  const providerSequence = stringValue(firstValue(info, ["seq", "billId", "tradeId"])) || null;

  const canonical = {
    provider,
    connectionId,
    externalTradeId,
    externalOrderId,
    symbol,
    product: "usdt_perpetual" as const,
    side,
    positionMode,
    positionSide,
    openClose,
    reduceOnly,
    quantityBase,
    quantityContracts: contracts,
    contractMultiplier,
    price,
    quoteNotional,
    providerRealizedPnl: providerPnl(info),
    feeNativeSigned,
    feeCurrency,
    feeQuoteSigned,
    executedAt,
    providerSequence,
    executionType,
    payloadFingerprint: ""
  };
  canonical.payloadFingerprint = fingerprint({
    ...canonical,
    payloadFingerprint: undefined
  });
  return canonical;
}

export function normalizeCcxtCashflow(
  provider: ActiveExchangeProvider,
  connectionId: string,
  entry: CcxtLedgerLike,
  source: "funding" | "ledger" = "ledger"
): CanonicalExchangeCashflow | null {
  const info = record(entry.info);
  const externalCashflowId = stringValue(entry.id || firstValue(info, ["id", "billId", "execId", "tranId"]));
  const rawAmount = optionalDecimal(
    firstValue(info, ["amount", "income", "change", "cashFlow", "balChg", "pnl", "execFee"]) ?? entry.amount
  );
  const currency = stringValue(
    entry.currency || entry.code || firstValue(info, ["currency", "ccy", "asset", "coin"])
  ).toUpperCase();
  const occurredAt = isoTime(
    firstValue(info, ["timestamp", "time", "execTime", "fillTime", "ts"]),
    entry.datetime ?? (entry.timestamp ? new Date(entry.timestamp).toISOString() : undefined)
  );
  if (!externalCashflowId || rawAmount === null || !currency || !occurredAt) return null;
  const direction = stringValue(entry.direction || firstValue(info, ["direction", "side"])).toLowerCase();
  const amountSigned = direction === "out" && compareDecimal(rawAmount, "0") > 0 ? negateDecimal(rawAmount) : rawAmount;
  const rawType = entry.type || firstValue(info, ["incomeType", "execType", "businessType", "subType", "type"]);
  const type = source === "funding" ? "funding" : cashflowTypeFrom(rawType);
  const symbol = stringValue(entry.symbol || firstValue(info, ["symbol", "instId"])) || null;
  const positionSide = positionSideFrom(firstValue(info, ["posSide", "positionSide", "positionIdx"]));
  const reconciliationOnly = type === "trade_fee";
  const canonical = {
    provider,
    connectionId,
    externalCashflowId,
    symbol: symbol?.toUpperCase() ?? null,
    positionSide,
    type,
    amountSigned,
    currency,
    amountQuoteSigned: currency === "USDT" ? amountSigned : null,
    occurredAt,
    relatedTradeId: stringValue(firstValue(info, ["tradeId", "execId"])) || null,
    relatedOrderId: stringValue(firstValue(info, ["orderId", "ordId"])) || null,
    allocationStatus: positionSide === "unknown" && type === "funding" ? "ambiguous" as const : "unallocated" as const,
    reconciliationOnly,
    payloadFingerprint: ""
  };
  canonical.payloadFingerprint = fingerprint({
    ...canonical,
    payloadFingerprint: undefined
  });
  return canonical;
}

export function normalizeCcxtOrderContext(order: unknown): ExchangeOrderContext | null {
  const row = record(order);
  const info = record(row.info);
  const externalOrderId = stringValue(row.id || firstValue(info, ["orderId", "ordId"]));
  const symbol = stringValue(row.symbol || info.symbol || info.instId).toUpperCase();
  if (!externalOrderId || !symbol) return null;
  const side = positionSideFrom(firstValue(info, ["posSide", "positionSide", "positionIdx"]));
  const explicitMode = positionModeFrom(firstValue(info, ["holdMode", "positionMode", "posMode"]));
  const reduceOnly = booleanValue(firstValue(info, ["reduceOnly", "reduce_only"]));
  const orderOpenClose = explicitOpenClose(firstValue(info, ["tradeSide", "openClose", "offset", "action"]));
  return {
    externalOrderId,
    symbol,
    positionMode: explicitMode === "unknown" ? positionModeFromSide(side) : explicitMode,
    positionSide: side,
    openClose: orderOpenClose !== "unknown" ? orderOpenClose : reduceOnly === true ? "close" : "unknown",
    reduceOnly
  };
}
