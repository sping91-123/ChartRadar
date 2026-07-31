import type {
  ActiveExchangeProvider,
  CanonicalExchangeCashflow,
  CanonicalExchangeFill,
  ExchangeConnectionStatus,
  ExchangeCredentialInput,
  ExchangePositionMode
} from "../../exchangeJournal";

export interface ExchangeCredentialValidation {
  provider: ActiveExchangeProvider;
  accountUid: string;
  accountMode: string;
  positionMode: ExchangePositionMode;
  ipWhitelist: string[];
  permissionSummary: Record<string, boolean | string | string[]>;
}

export interface ExchangeSyncCursor {
  since: string;
  until: string;
  cursor: string | null;
  symbols?: string[];
  symbolsTruncated?: boolean;
}

export interface ExchangeFetchResult<T> {
  rows: T[];
  nextCursor: string | null;
  paginationComplete: boolean;
  complete: boolean;
  warnings: string[];
}

export interface ExchangeConnector {
  readonly provider: ActiveExchangeProvider;
  validateCredentials(credentials: ExchangeCredentialInput): Promise<ExchangeCredentialValidation>;
  fetchPositionSnapshot(credentials: ExchangeCredentialInput): Promise<ExchangePositionSnapshot>;
  fetchFills(
    credentials: ExchangeCredentialInput,
    connectionId: string,
    cursor: ExchangeSyncCursor,
    orderContexts?: ExchangeOrderContext[]
  ): Promise<ExchangeFetchResult<CanonicalExchangeFill>>;
  fetchCashflows(
    credentials: ExchangeCredentialInput,
    connectionId: string,
    cursor: ExchangeSyncCursor
  ): Promise<ExchangeFetchResult<CanonicalExchangeCashflow>>;
  fetchOrdersForContext(
    credentials: ExchangeCredentialInput,
    cursor: ExchangeSyncCursor
  ): Promise<ExchangeFetchResult<ExchangeOrderContext>>;
}

export interface ExchangePositionSnapshot {
  observedAt: string;
  openSymbols: string[];
}

export interface ExchangeOrderContext {
  externalOrderId: string;
  symbol: string;
  positionMode: "one_way" | "hedge" | "unknown";
  positionSide: "net" | "long" | "short" | "unknown";
  openClose: "open" | "close" | "mixed" | "unknown";
  reduceOnly: boolean | null;
}

export class ExchangeConnectorError extends Error {
  constructor(
    public readonly code:
      | "invalid_credentials"
      | "permission_changed"
      | "ip_mismatch"
      | "rate_limited"
      | "provider_unavailable"
      | "response_invalid"
      | "cursor_stalled",
    public readonly status: ExchangeConnectionStatus,
    options?: { cause?: unknown }
  ) {
    super(code, options);
    this.name = "ExchangeConnectorError";
  }
}
