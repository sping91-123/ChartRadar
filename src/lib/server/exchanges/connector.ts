import { createHmac } from "node:crypto";
import ccxt from "ccxt";
import { compareDecimal } from "@/lib/decimal";
import type {
  ActiveExchangeProvider,
  CanonicalExchangeCashflow,
  CanonicalExchangeFill,
  ExchangeCredentialInput
} from "@/lib/exchangeJournal";
import { isExchangeProviderEnabled } from "@/lib/server/exchangeJournalConfig";
import {
  marketIsUsdtPerpetual,
  normalizeCcxtCashflow,
  normalizeCcxtOrderContext,
  normalizeCcxtTrade,
  type CcxtLedgerLike,
  type CcxtMarketLike,
  type CcxtTradeLike
} from "@/lib/server/exchanges/normalization";
import {
  parseBingxCredentialValidation,
  parseBitgetCredentialValidation,
  parseBybitCredentialValidation,
  parseOkxCredentialValidation
} from "@/lib/server/exchanges/permissions";
import {
  ExchangeConnectorError,
  type ExchangeConnector,
  type ExchangeCredentialValidation,
  type ExchangeFetchResult,
  type ExchangeOrderContext,
  type ExchangePositionSnapshot,
  type ExchangeSyncCursor
} from "@/lib/server/exchanges/types";

type UnknownRecord = Record<string, unknown>;
type Callable = (params?: UnknownRecord) => Promise<unknown>;
const paginatedRecordLimit = 500;

interface PrivateCcxtExchange {
  has: Record<string, unknown>;
  markets: Record<string, CcxtMarketLike>;
  loadMarkets(): Promise<Record<string, CcxtMarketLike>>;
  fetchMyTrades(
    symbol?: string,
    since?: number,
    limit?: number,
    params?: UnknownRecord
  ): Promise<CcxtTradeLike[]>;
  fetchFundingHistory?(
    code?: string,
    since?: number,
    limit?: number,
    params?: UnknownRecord
  ): Promise<CcxtLedgerLike[]>;
  fetchLedger?(
    code?: string,
    since?: number,
    limit?: number,
    params?: UnknownRecord
  ): Promise<CcxtLedgerLike[]>;
  fetchClosedOrders?(
    symbol?: string,
    since?: number,
    limit?: number,
    params?: UnknownRecord
  ): Promise<unknown[]>;
  fetchCanceledAndClosedOrders?(
    symbol?: string,
    since?: number,
    limit?: number,
    params?: UnknownRecord
  ): Promise<unknown[]>;
  fetchPositions?(symbols?: string[], params?: UnknownRecord): Promise<Array<{
    symbol?: string;
    contracts?: number | string;
  }>>;
  [key: string]: unknown;
}

function record(value: unknown): UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function parseTime(value: string) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new ExchangeConnectorError("response_invalid", "provider_unavailable");
  return time;
}

function createCcxtExchange(provider: ActiveExchangeProvider, credentials: ExchangeCredentialInput): PrivateCcxtExchange {
  const ExchangeClass = (ccxt as unknown as Record<
    string,
    new (options?: Record<string, unknown>) => PrivateCcxtExchange
  >)[provider];
  if (!ExchangeClass) throw new ExchangeConnectorError("provider_unavailable", "provider_unavailable");
  return new ExchangeClass({
    apiKey: credentials.apiKey,
    secret: credentials.secret,
    password: credentials.passphrase,
    enableRateLimit: true,
    timeout: 12_000,
    options: {
      defaultType: "swap",
      defaultSubType: "linear",
      adjustForTimeDifference: true
    }
  });
}

async function callImplicit(exchange: PrivateCcxtExchange, method: string, params: UnknownRecord = {}) {
  const candidate = exchange[method];
  if (typeof candidate !== "function") {
    throw new ExchangeConnectorError("provider_unavailable", "provider_unavailable");
  }
  return (candidate as Callable).call(exchange, params);
}

function safeConnectorError(error: unknown): ExchangeConnectorError {
  if (error instanceof ExchangeConnectorError) return error;
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (/429|rate.?limit|too many|10006|100410|50011/.test(message)) {
    return new ExchangeConnectorError("rate_limited", "rate_limited");
  }
  if (/\bip\b|ip address|ip whitelist|whitelist|allowlist|10010|100419|40038/.test(message)) {
    return new ExchangeConnectorError("ip_mismatch", "ip_mismatch");
  }
  if (/permission|10005|100004|25620/.test(message)) {
    return new ExchangeConnectorError("permission_changed", "permission_changed");
  }
  if (/api.?key|signature|passphrase|secret|10003|10004|50105|50113|40006|40009|40036/.test(message)) {
    return new ExchangeConnectorError("invalid_credentials", "permission_changed");
  }
  return new ExchangeConnectorError("provider_unavailable", "provider_unavailable");
}

async function bitgetAccountInfo(credentials: ExchangeCredentialInput) {
  const passphrase = credentials.passphrase?.trim();
  if (!passphrase) throw new ExchangeConnectorError("invalid_credentials", "permission_changed");
  const timestamp = String(Date.now());
  const path = "/api/v3/account/info";
  const signature = createHmac("sha256", credentials.secret)
    .update(`${timestamp}GET${path}`)
    .digest("base64");
  const response = await fetch(`https://api.bitget.com${path}`, {
    headers: {
      "ACCESS-KEY": credentials.apiKey,
      "ACCESS-SIGN": signature,
      "ACCESS-PASSPHRASE": passphrase,
      "ACCESS-TIMESTAMP": timestamp,
      locale: "en-US",
      "Content-Type": "application/json"
    },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000)
  });
  const payload = await response.json().catch(() => null);
  if (response.status === 429) throw new ExchangeConnectorError("rate_limited", "rate_limited");
  if (response.status >= 500) throw new ExchangeConnectorError("provider_unavailable", "provider_unavailable");
  if (!response.ok || !payload) throw new ExchangeConnectorError("invalid_credentials", "permission_changed");
  return payload;
}

async function validateProviderCredentials(
  provider: ActiveExchangeProvider,
  credentials: ExchangeCredentialInput
): Promise<ExchangeCredentialValidation> {
  if (!isExchangeProviderEnabled(provider)) {
    throw new ExchangeConnectorError("provider_unavailable", "provider_unavailable");
  }
  try {
    if (provider === "bitget") return parseBitgetCredentialValidation(await bitgetAccountInfo(credentials));
    const exchange = createCcxtExchange(provider, credentials);
    if (provider === "okx") {
      return parseOkxCredentialValidation(await callImplicit(exchange, "privateGetAccountConfig"));
    }
    if (provider === "bybit") {
      return parseBybitCredentialValidation(await callImplicit(exchange, "privateGetV5UserQueryApi"));
    }
    const permissionPayload = await callImplicit(exchange, "accountV1PrivateGetAccountApiPermissions");
    const uidPayload = await callImplicit(exchange, "accountV1PrivateGetUid");
    const uid = String(record(record(uidPayload).data).uid ?? "");
    const keyInfoPayload = await callImplicit(exchange, "accountV1PrivateGetApiKeyQuery", {
      uid,
      apiKey: credentials.apiKey
    });
    return parseBingxCredentialValidation(permissionPayload, uidPayload, keyInfoPayload);
  } catch (error) {
    throw safeConnectorError(error);
  }
}

function providerParams(provider: ActiveExchangeProvider, cursor: ExchangeSyncCursor) {
  const until = parseTime(cursor.until);
  if (provider === "okx") return { type: "swap", instType: "SWAP", until };
  if (provider === "bybit") return { type: "swap", subType: "linear", category: "linear", until };
  if (provider === "bitget") {
    return {
      uta: true,
      productType: "USDT-FUTURES",
      category: "USDT-FUTURES",
      until
    };
  }
  return { type: "swap", subType: "linear", until };
}

function paginationParams(provider: ActiveExchangeProvider, cursor: ExchangeSyncCursor) {
  return {
    ...providerParams(provider, cursor),
    paginate: true,
    paginationCalls: 5
  };
}

function uniqueRows<T>(rows: T[], key: (row: T) => string) {
  return Array.from(new Map(rows.map((row) => [key(row), row])).values());
}

function unifiedSymbolFromId(markets: Record<string, CcxtMarketLike>, value: unknown) {
  const marketId = String(value ?? "").trim();
  if (!marketId) return undefined;
  return Object.values(markets).find((market) => market.id === marketId)?.symbol ?? marketId;
}

async function fetchOkxFundingPages(
  exchange: PrivateCcxtExchange,
  since: number,
  cursor: ExchangeSyncCursor
) {
  const rows: CcxtLedgerLike[] = [];
  let after: string | undefined;
  let complete = false;
  for (let page = 0; page < 5; page += 1) {
    const batch = await exchange.fetchFundingHistory?.(undefined, since, 100, {
      ...providerParams("okx", cursor),
      ...(after ? { after } : {})
    }) ?? [];
    rows.push(...batch);
    if (batch.length < 100) {
      complete = true;
      break;
    }
    const next = String(record(batch[batch.length - 1]?.info).billId ?? "").trim();
    if (!next || next === after) break;
    after = next;
  }
  return { rows, complete };
}

async function fetchBitgetFinancialPages(
  exchange: PrivateCcxtExchange,
  markets: Record<string, CcxtMarketLike>,
  since: number,
  until: number
) {
  const rows: CcxtLedgerLike[] = [];
  let cursor: string | undefined;
  let complete = false;
  for (let page = 0; page < 5; page += 1) {
    const payload = record(await callImplicit(exchange, "privateUtaGetV3AccountFinancialRecords", {
      category: "USDT-FUTURES",
      coin: "USDT",
      startTime: since,
      endTime: until,
      limit: 100,
      ...(cursor ? { cursor } : {})
    }));
    if (String(payload.code ?? "") !== "00000") {
      throw new ExchangeConnectorError("response_invalid", "provider_unavailable");
    }
    const data = record(payload.data);
    const list = Array.isArray(data.list) ? data.list.map(record) : [];
    rows.push(...list.map((entry): CcxtLedgerLike => ({
      id: String(entry.id ?? ""),
      symbol: unifiedSymbolFromId(markets, entry.symbol),
      code: String(entry.coin ?? ""),
      amount: undefined,
      timestamp: Number(entry.ts),
      type: String(entry.type ?? ""),
      info: entry
    })));
    const next = String(data.cursor ?? "").trim();
    if (list.length < 100 || !next) {
      complete = true;
      break;
    }
    if (next === cursor) break;
    cursor = next;
  }
  return { rows, complete };
}

async function fetchBitgetFillPages(
  exchange: PrivateCcxtExchange,
  markets: Record<string, CcxtMarketLike>,
  since: number,
  until: number
) {
  const rows: CcxtTradeLike[] = [];
  let cursor: string | undefined;
  let complete = false;
  for (let page = 0; page < 5; page += 1) {
    const payload = record(await callImplicit(exchange, "privateUtaGetV3TradeFills", {
      category: "USDT-FUTURES",
      startTime: since,
      endTime: until,
      limit: 100,
      ...(cursor ? { cursor } : {})
    }));
    if (String(payload.code ?? "") !== "00000") {
      throw new ExchangeConnectorError("response_invalid", "provider_unavailable");
    }
    const data = record(payload.data);
    const list = Array.isArray(data.list) ? data.list.map(record) : [];
    rows.push(...list.map((entry): CcxtTradeLike => ({
      id: String(entry.execId ?? ""),
      order: String(entry.orderId ?? ""),
      symbol: unifiedSymbolFromId(markets, entry.symbol),
      side: String(entry.side ?? ""),
      timestamp: Number(entry.createdTime),
      info: entry
    })));
    const next = String(data.cursor ?? "").trim();
    if (list.length < 100 || !next) {
      complete = true;
      break;
    }
    if (next === cursor) break;
    cursor = next;
  }
  return { rows, complete };
}

async function fetchBingxIncomeRows(
  exchange: PrivateCcxtExchange,
  markets: Record<string, CcxtMarketLike>,
  since: number,
  until: number
) {
  const payload = record(await callImplicit(exchange, "swapV2PrivateGetUserIncome", {
    startTime: since,
    endTime: until,
    limit: 1_000
  }));
  if (Number(payload.code) !== 0) {
    throw new ExchangeConnectorError("response_invalid", "provider_unavailable");
  }
  const list = Array.isArray(payload.data) ? payload.data.map(record) : [];
  return {
    rows: list.map((entry): CcxtLedgerLike => ({
      id: String(entry.tranId ?? entry.tradeId ?? ""),
      symbol: unifiedSymbolFromId(markets, entry.symbol),
      code: String(entry.asset ?? ""),
      amount: undefined,
      timestamp: Number(entry.time),
      type: String(entry.incomeType ?? ""),
      info: entry
    })),
    complete: list.length < 1_000
  };
}

async function fetchBingxTradesByWindow(
  exchange: PrivateCcxtExchange,
  symbol: string,
  since: number,
  until: number,
  budget: { calls: number }
): Promise<{ rows: CcxtTradeLike[]; complete: boolean }> {
  if (budget.calls >= 8) return { rows: [], complete: false };
  budget.calls += 1;
  const rows = await exchange.fetchMyTrades(symbol, since, 1_000, {
    type: "swap",
    subType: "linear",
    until
  });
  if (rows.length < 1_000) return { rows, complete: true };
  if (until - since <= 1) return { rows, complete: false };
  const midpoint = since + Math.floor((until - since) / 2);
  const [older, newer] = await Promise.all([
    fetchBingxTradesByWindow(exchange, symbol, since, midpoint, budget),
    fetchBingxTradesByWindow(exchange, symbol, midpoint + 1, until, budget)
  ]);
  return {
    rows: [...older.rows, ...newer.rows],
    complete: older.complete && newer.complete
  };
}

class CcxtExchangeConnector implements ExchangeConnector {
  constructor(readonly provider: ActiveExchangeProvider) {}

  validateCredentials(credentials: ExchangeCredentialInput) {
    return validateProviderCredentials(this.provider, credentials);
  }

  async fetchPositionSnapshot(credentials: ExchangeCredentialInput): Promise<ExchangePositionSnapshot> {
    const exchange = createCcxtExchange(this.provider, credentials);
    if (typeof exchange.fetchPositions !== "function" || exchange.has.fetchPositions !== true) {
      throw new ExchangeConnectorError("response_invalid", "provider_unavailable");
    }
    try {
      await exchange.loadMarkets();
      const positions = await exchange.fetchPositions(undefined, {
        ...(this.provider === "bitget" ? { uta: true, productType: "USDT-FUTURES" } : {}),
        ...(this.provider === "bybit" ? { category: "linear" } : {}),
        ...(this.provider === "okx" ? { instType: "SWAP" } : {})
      });
      const openSymbols = positions
        .filter((position) => {
          const value = String(position.contracts ?? "").trim();
          if (!value) return false;
          try {
            return compareDecimal(value, "0") !== 0;
          } catch {
            throw new ExchangeConnectorError("response_invalid", "provider_unavailable");
          }
        })
        .map((position) => String(position.symbol ?? "").trim().toUpperCase())
        .filter(Boolean);
      return {
        observedAt: new Date().toISOString(),
        openSymbols: Array.from(new Set(openSymbols)).sort()
      };
    } catch (error) {
      throw safeConnectorError(error);
    }
  }

  async fetchOrdersForContext(
    credentials: ExchangeCredentialInput,
    cursor: ExchangeSyncCursor
  ): Promise<ExchangeFetchResult<ExchangeOrderContext>> {
    const exchange = createCcxtExchange(this.provider, credentials);
    const bitgetOrderHistoryAvailable = this.provider === "bitget" &&
      typeof exchange.fetchCanceledAndClosedOrders === "function" &&
      exchange.has.fetchCanceledAndClosedOrders === true;
    const closedOrderHistoryAvailable = typeof exchange.fetchClosedOrders === "function" &&
      exchange.has.fetchClosedOrders === true;
    if (!bitgetOrderHistoryAvailable && !closedOrderHistoryAvailable) {
      return {
        rows: [],
        nextCursor: null,
        paginationComplete: true,
        complete: false,
        warnings: ["order_context_unavailable"]
      };
    }
    try {
      const since = parseTime(cursor.since);
      const rows = this.provider === "bitget" && bitgetOrderHistoryAvailable
        ? await exchange.fetchCanceledAndClosedOrders!(
            undefined,
            since,
            paginatedRecordLimit,
            paginationParams(this.provider, cursor)
          )
        : await exchange.fetchClosedOrders!(
            undefined,
            since,
            paginatedRecordLimit,
            paginationParams(this.provider, cursor)
          );
      const normalizedRows = rows.map(normalizeCcxtOrderContext);
      if (normalizedRows.some((row) => row === null)) {
        throw new ExchangeConnectorError("response_invalid", "provider_unavailable");
      }
      const normalized = normalizedRows.filter((row): row is ExchangeOrderContext => row !== null);
      return {
        rows: uniqueRows(normalized, (row) => row.externalOrderId),
        nextCursor: null,
        paginationComplete: rows.length < paginatedRecordLimit,
        complete: rows.length < paginatedRecordLimit,
        warnings: rows.length >= paginatedRecordLimit ? ["order_context_truncated"] : []
      };
    } catch (error) {
      throw safeConnectorError(error);
    }
  }

  async fetchFills(
    credentials: ExchangeCredentialInput,
    connectionId: string,
    cursor: ExchangeSyncCursor,
    orderContexts?: ExchangeOrderContext[]
  ): Promise<ExchangeFetchResult<CanonicalExchangeFill>> {
    const exchange = createCcxtExchange(this.provider, credentials);
    try {
      const markets = await exchange.loadMarkets();
      const orderResult = orderContexts
        ? { rows: orderContexts, nextCursor: null, paginationComplete: true, complete: true, warnings: [] }
        : await this.fetchOrdersForContext(credentials, cursor);
      const orderMap = new Map(orderResult.rows.map((order) => [order.externalOrderId, order]));
      const symbols = this.provider === "bingx" ? cursor.symbols ?? [] : [undefined];
      if (this.provider === "bingx" && symbols.length === 0) {
        return {
          rows: [],
          nextCursor: null,
          paginationComplete: true,
          complete: true,
          warnings: ["bingx_no_symbol_activity"]
        };
      }

      const rawRows: CcxtTradeLike[] = [];
      const since = parseTime(cursor.since);
      let pageComplete = true;
      if (this.provider === "bingx") {
        const until = parseTime(cursor.until);
        const budget = { calls: 0 };
        for (const symbol of symbols) {
          const result = await fetchBingxTradesByWindow(exchange, symbol as string, since, until, budget);
          rawRows.push(...result.rows);
          pageComplete = pageComplete && result.complete;
        }
      } else if (this.provider === "bitget") {
        const page = await fetchBitgetFillPages(exchange, markets, since, parseTime(cursor.until));
        rawRows.push(...page.rows);
        pageComplete = page.complete;
      } else {
        const page = await exchange.fetchMyTrades(
          undefined,
          since,
          paginatedRecordLimit,
          paginationParams(this.provider, cursor)
        );
        rawRows.push(...page);
        pageComplete = page.length < paginatedRecordLimit;
      }
      const normalizedRows = rawRows.map((trade) => {
          const market = trade.symbol ? markets[trade.symbol] : undefined;
          const orderId = String(trade.order ?? record(trade.info).orderId ?? record(trade.info).ordId ?? "");
          return {
            inScope: !market || marketIsUsdtPerpetual(market),
            row: normalizeCcxtTrade(this.provider, connectionId, trade, market, orderMap.get(orderId))
          };
        });
      if (normalizedRows.some((item) => item.inScope && item.row === null)) {
        throw new ExchangeConnectorError("response_invalid", "provider_unavailable");
      }
      const normalized = normalizedRows
        .map((item) => item.row)
        .filter((row): row is CanonicalExchangeFill => row !== null);
      const complete = pageComplete && cursor.symbolsTruncated !== true;
      return {
        rows: uniqueRows(normalized, (row) => `${row.connectionId}:${row.product}:${row.externalTradeId}`),
        nextCursor: null,
        paginationComplete: complete,
        complete,
        warnings: [
          ...orderResult.warnings,
          ...(pageComplete ? [] : ["fill_page_requires_continuation"]),
          ...(cursor.symbolsTruncated ? ["bingx_symbol_scope_truncated"] : [])
        ]
      };
    } catch (error) {
      throw safeConnectorError(error);
    }
  }

  async fetchCashflows(
    credentials: ExchangeCredentialInput,
    connectionId: string,
    cursor: ExchangeSyncCursor
  ): Promise<ExchangeFetchResult<CanonicalExchangeCashflow>> {
    const exchange = createCcxtExchange(this.provider, credentials);
    const fundingRows: CcxtLedgerLike[] = [];
    const ledgerRows: CcxtLedgerLike[] = [];
    const warnings: string[] = [];
    const since = parseTime(cursor.since);
    const until = parseTime(cursor.until);
    try {
      const markets = await exchange.loadMarkets();
      let fundingComplete = true;
      let ledgerComplete = true;
      let paginationComplete = true;
      if (this.provider === "bitget") {
        const financial = await fetchBitgetFinancialPages(exchange, markets, since, until);
        ledgerRows.push(...financial.rows);
        fundingComplete = financial.complete;
        ledgerComplete = financial.complete;
        paginationComplete = financial.complete;
      } else if (this.provider === "bingx") {
        const income = await fetchBingxIncomeRows(exchange, markets, since, until);
        ledgerRows.push(...income.rows);
        fundingComplete = income.complete;
        ledgerComplete = income.complete;
        paginationComplete = income.complete;
      } else {
        if (typeof exchange.fetchFundingHistory === "function" && exchange.has.fetchFundingHistory === true) {
          if (this.provider === "okx") {
            const funding = await fetchOkxFundingPages(exchange, since, cursor);
            fundingRows.push(...funding.rows);
            fundingComplete = funding.complete;
            paginationComplete = paginationComplete && funding.complete;
          } else {
            const funding = await exchange.fetchFundingHistory(
              undefined,
              since,
              paginatedRecordLimit,
              paginationParams(this.provider, cursor)
            );
            fundingRows.push(...funding);
            fundingComplete = funding.length < paginatedRecordLimit;
            paginationComplete = paginationComplete && fundingComplete;
          }
        } else {
          fundingComplete = false;
          warnings.push("funding_history_unavailable");
        }
        if (typeof exchange.fetchLedger === "function" && exchange.has.fetchLedger === true) {
          const ledger = await exchange.fetchLedger(
            undefined,
            since,
            paginatedRecordLimit,
            paginationParams(this.provider, cursor)
          );
          ledgerRows.push(...ledger);
          ledgerComplete = ledger.length < paginatedRecordLimit;
          paginationComplete = paginationComplete && ledgerComplete;
        } else {
          ledgerComplete = false;
          warnings.push("ledger_unavailable");
        }
      }
      const normalizedRows = [
        ...fundingRows.map((entry) => normalizeCcxtCashflow(this.provider, connectionId, entry, "funding")),
        ...ledgerRows.map((entry) => normalizeCcxtCashflow(this.provider, connectionId, entry, "ledger"))
      ];
      if (normalizedRows.some((row) => row === null)) {
        throw new ExchangeConnectorError("response_invalid", "provider_unavailable");
      }
      const normalized = normalizedRows.filter((row): row is CanonicalExchangeCashflow => row !== null);
      const complete = fundingComplete && ledgerComplete;
      return {
        rows: uniqueRows(normalized, (row) => `${row.connectionId}:${row.externalCashflowId}`),
        nextCursor: null,
        paginationComplete,
        complete,
        warnings: [...warnings, ...(complete ? [] : ["cashflow_page_requires_continuation"])]
      };
    } catch (error) {
      throw safeConnectorError(error);
    }
  }
}

const connectors = new Map<ActiveExchangeProvider, ExchangeConnector>();

export function getExchangeConnector(provider: ActiveExchangeProvider): ExchangeConnector {
  const cached = connectors.get(provider);
  if (cached) return cached;
  const connector = new CcxtExchangeConnector(provider);
  connectors.set(provider, connector);
  return connector;
}
