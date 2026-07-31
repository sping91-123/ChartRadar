import type { ActiveExchangeProvider } from "../../exchangeJournal";
import {
  classifyTradeDuration,
  tradeQualityTimeframeForHoldingSeconds,
  tradeQualityTimeframeMilliseconds,
  type TradeQualityCandle,
  type TradeQualityCoverage,
  type TradeQualityTimeframe
} from "../../tradeQuality";

type UnknownRecord = Record<string, unknown>;

export class ExchangeMarketDataError extends Error {
  constructor(
    public readonly code: "rate_limited" | "provider_unavailable" | "response_invalid",
    public readonly retryAfterMs: number | null = null
  ) {
    super(code);
    this.name = "ExchangeMarketDataError";
  }
}

export interface ExchangeMarketCandleResult {
  provider: ActiveExchangeProvider;
  marketSymbol: string;
  timeframe: TradeQualityTimeframe;
  durationClass: ReturnType<typeof classifyTradeDuration>;
  requestedFrom: string;
  requestedUntil: string;
  postExitPending: boolean;
  postExitReadyAt: string | null;
  candles: TradeQualityCandle[];
  coverage: TradeQualityCoverage;
  warnings: string[];
}

const preEntryBars = 320;
const postExitBars = 6;
const requestTimeoutMs = 6_000;
const evaluationDeadlineMs = 8_000;
const maxProviderCalls = 7;

interface FetchBudget {
  deadlineMs: number;
  remainingCalls: number;
}

const providerRequestChains = new Map<ActiveExchangeProvider, Promise<void>>();
const providerLastRequestAt = new Map<ActiveExchangeProvider, number>();
const providerMinimumIntervalMs: Record<ActiveExchangeProvider, number> = {
  okx: 110,
  bybit: 55,
  bitget: 55,
  bingx: 1_050
};

function record(value: unknown): UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function numeric(value: unknown) {
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function compactUsdtSymbol(value: string) {
  const normalized = value.trim().toUpperCase().replace(".P", "");
  const beforeSettle = normalized.split(":")[0] ?? normalized;
  const compact = beforeSettle.replace(/[\/_-]/g, "");
  if (!compact.endsWith("USDT") || compact.length <= 4) {
    throw new ExchangeMarketDataError("response_invalid");
  }
  return compact;
}

export function normalizeExchangeTradeMarketSymbol(provider: ActiveExchangeProvider, symbol: string) {
  const compact = compactUsdtSymbol(symbol);
  const base = compact.slice(0, -4);
  if (provider === "okx") return `${base}-USDT-SWAP`;
  if (provider === "bingx") return `${base}-USDT`;
  return compact;
}

function parsedCandle(
  openTime: unknown,
  open: unknown,
  high: unknown,
  low: unknown,
  close: unknown,
  volume: unknown
): TradeQualityCandle | null {
  const values = [openTime, open, high, low, close, volume].map(numeric);
  if (values.some((value) => value === null)) return null;
  const [openTimeMs, openValue, highValue, lowValue, closeValue, volumeValue] = values as number[];
  if (
    openTimeMs <= 0 ||
    openValue <= 0 ||
    closeValue <= 0 ||
    highValue < Math.max(openValue, closeValue) ||
    lowValue > Math.min(openValue, closeValue)
  ) {
    return null;
  }
  return {
    openTimeMs,
    open: openValue,
    high: highValue,
    low: lowValue,
    close: closeValue,
    volume: Math.max(0, volumeValue)
  };
}

function retryAfterMilliseconds(response: Response) {
  const value = response.headers.get("retry-after");
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - Date.now()) : null;
}

function withProviderRequestSlot<T>(provider: ActiveExchangeProvider, task: () => Promise<T>) {
  const previous = providerRequestChains.get(provider) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(async () => {
    const waitMs = Math.max(
      0,
      providerMinimumIntervalMs[provider] - (Date.now() - (providerLastRequestAt.get(provider) ?? 0))
    );
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    providerLastRequestAt.set(provider, Date.now());
    return task();
  });
  providerRequestChains.set(provider, current.then(() => undefined, () => undefined));
  return current;
}

async function fetchPayload(provider: ActiveExchangeProvider, url: string, budget: FetchBudget) {
  if (budget.remainingCalls <= 0 || Date.now() >= budget.deadlineMs) {
    throw new ExchangeMarketDataError("provider_unavailable");
  }
  budget.remainingCalls -= 1;
  return withProviderRequestSlot(provider, async () => {
    const remainingMs = budget.deadlineMs - Date.now();
    if (remainingMs <= 0) throw new ExchangeMarketDataError("provider_unavailable");
    let response: Response;
    try {
      response = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(Math.max(250, Math.min(requestTimeoutMs, remainingMs)))
      });
    } catch {
      throw new ExchangeMarketDataError("provider_unavailable");
    }
    if (response.status === 429 || (provider === "bybit" && response.status === 403)) {
      throw new ExchangeMarketDataError("rate_limited", retryAfterMilliseconds(response));
    }
    if (!response.ok) throw new ExchangeMarketDataError("provider_unavailable");
    try {
      return await response.json() as unknown;
    } catch {
      throw new ExchangeMarketDataError("response_invalid");
    }
  });
}

function rowsToCandles(rows: unknown[], shape: "array" | "bingx") {
  return rows.map((row) => {
    if (Array.isArray(row)) return parsedCandle(row[0], row[1], row[2], row[3], row[4], row[5]);
    if (shape !== "bingx") return null;
    const item = record(row);
    return parsedCandle(
      item.time ?? item.ts ?? item.openTime,
      item.open ?? item.o,
      item.high ?? item.h,
      item.low ?? item.l,
      item.close ?? item.c,
      item.volume ?? item.v ?? 0
    );
  }).filter((candle): candle is TradeQualityCandle => candle !== null);
}

export function parseExchangeTradeCandlePayload(provider: ActiveExchangeProvider, payloadValue: unknown) {
  const payload = record(payloadValue);
  if (provider === "okx") {
    if (["50011", "50040"].includes(String(payload.code ?? ""))) {
      throw new ExchangeMarketDataError("rate_limited");
    }
    if (String(payload.code ?? "") !== "0" || !Array.isArray(payload.data)) {
      throw new ExchangeMarketDataError("response_invalid");
    }
    return payload.data
      .filter((row) => Array.isArray(row) && String(row[8] ?? "1") === "1")
      .map((row) => parsedCandle(row[0], row[1], row[2], row[3], row[4], row[5]))
      .filter((candle): candle is TradeQualityCandle => candle !== null);
  }
  if (provider === "bybit") {
    const result = record(payload.result);
    if (Number(payload.retCode) === 10006) throw new ExchangeMarketDataError("rate_limited");
    if (Number(payload.retCode) !== 0 || !Array.isArray(result.list)) {
      throw new ExchangeMarketDataError("response_invalid");
    }
    return rowsToCandles(result.list, "array");
  }
  if (provider === "bitget") {
    if (String(payload.code ?? "") === "429") {
      throw new ExchangeMarketDataError("rate_limited");
    }
    if (String(payload.code ?? "") !== "00000" || !Array.isArray(payload.data)) {
      throw new ExchangeMarketDataError("response_invalid");
    }
    return rowsToCandles(payload.data, "array");
  }
  if (Number(payload.code ?? -1) === 100410) throw new ExchangeMarketDataError("rate_limited");
  if (Number(payload.code ?? -1) !== 0 || !Array.isArray(payload.data)) {
    throw new ExchangeMarketDataError("response_invalid");
  }
  return rowsToCandles(payload.data, "bingx");
}

const bybitInterval: Record<TradeQualityTimeframe, string> = {
  "1m": "1",
  "5m": "5",
  "15m": "15",
  "1h": "60",
  "4h": "240"
};

const okxBar: Record<TradeQualityTimeframe, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "1H",
  "4h": "4H"
};

const bitgetGranularity: Record<TradeQualityTimeframe, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "1H",
  "4h": "4H"
};

async function fetchOkxCandles(
  symbol: string,
  timeframe: TradeQualityTimeframe,
  fromMs: number,
  untilMs: number,
  budget: FetchBudget
) {
  const rows: TradeQualityCandle[] = [];
  let cursor = untilMs;
  for (let page = 0; page < 4; page += 1) {
    const params = new URLSearchParams({
      instId: symbol,
      bar: okxBar[timeframe],
      after: String(cursor),
      limit: "300"
    });
    const pageRows = parseExchangeTradeCandlePayload(
      "okx",
      await fetchPayload("okx", `https://www.okx.com/api/v5/market/history-candles?${params}`, budget)
    );
    if (pageRows.length === 0) break;
    rows.push(...pageRows);
    const oldest = Math.min(...pageRows.map((row) => row.openTimeMs));
    if (oldest <= fromMs) break;
    if (oldest >= cursor) throw new ExchangeMarketDataError("response_invalid");
    cursor = oldest;
  }
  return rows;
}

async function fetchBybitCandles(
  symbol: string,
  timeframe: TradeQualityTimeframe,
  fromMs: number,
  untilMs: number,
  budget: FetchBudget
) {
  const params = new URLSearchParams({
    category: "linear",
    symbol,
    interval: bybitInterval[timeframe],
    start: String(fromMs),
    end: String(untilMs),
    limit: "1000"
  });
  return parseExchangeTradeCandlePayload(
    "bybit",
    await fetchPayload("bybit", `https://api.bybit.com/v5/market/kline?${params}`, budget)
  );
}

async function fetchBitgetCandles(
  symbol: string,
  timeframe: TradeQualityTimeframe,
  fromMs: number,
  untilMs: number,
  budget: FetchBudget
) {
  const rows: TradeQualityCandle[] = [];
  let cursor = untilMs;
  for (let page = 0; page < 6; page += 1) {
    const params = new URLSearchParams({
      symbol,
      productType: "usdt-futures",
      granularity: bitgetGranularity[timeframe],
      endTime: String(cursor),
      limit: "200"
    });
    const pageRows = parseExchangeTradeCandlePayload(
      "bitget",
      await fetchPayload(
        "bitget",
        `https://api.bitget.com/api/v2/mix/market/history-candles?${params}`,
        budget
      )
    );
    if (pageRows.length === 0) break;
    rows.push(...pageRows);
    const oldest = Math.min(...pageRows.map((row) => row.openTimeMs));
    if (oldest <= fromMs) break;
    if (oldest >= cursor) throw new ExchangeMarketDataError("response_invalid");
    cursor = oldest;
  }
  return rows;
}

async function fetchBingxCandles(
  symbol: string,
  timeframe: TradeQualityTimeframe,
  fromMs: number,
  untilMs: number,
  budget: FetchBudget
) {
  const params = new URLSearchParams({
    symbol,
    interval: timeframe,
    startTime: String(fromMs),
    endTime: String(untilMs),
    limit: "1440"
  });
  return parseExchangeTradeCandlePayload(
    "bingx",
    await fetchPayload("bingx", `https://open-api.bingx.com/openApi/swap/v3/quote/klines?${params}`, budget)
  );
}

function coverageFor(candles: TradeQualityCandle[], fromMs: number, untilMs: number, intervalMs: number) {
  const expectedBars = Math.max(0, Math.floor((untilMs - fromMs) / intervalMs));
  const observedBars = candles.length;
  let maxGapBars = candles.length === 0
    ? expectedBars
    : Math.max(0, Math.floor((candles[0].openTimeMs - fromMs) / intervalMs));
  for (let index = 1; index < candles.length; index += 1) {
    const gap = Math.max(0, Math.floor((candles[index].openTimeMs - candles[index - 1].openTimeMs) / intervalMs) - 1);
    maxGapBars = Math.max(maxGapBars, gap);
  }
  if (candles.length > 0) {
    const trailingGap = Math.max(
      0,
      Math.floor((untilMs - (candles.at(-1)!.openTimeMs + intervalMs)) / intervalMs)
    );
    maxGapBars = Math.max(maxGapBars, trailingGap);
  }
  return {
    ratio: expectedBars > 0 ? Math.min(1, observedBars / expectedBars) : 0,
    expectedBars,
    observedBars,
    maxGapBars
  };
}

export async function fetchExchangeTradeQualityCandles(input: {
  provider: ActiveExchangeProvider;
  symbol: string;
  openedAt: string;
  closedAt: string;
  nowMs?: number;
}): Promise<ExchangeMarketCandleResult> {
  const openedAtMs = Date.parse(input.openedAt);
  const closedAtMs = Date.parse(input.closedAt);
  if (!Number.isFinite(openedAtMs) || !Number.isFinite(closedAtMs) || closedAtMs <= openedAtMs) {
    throw new ExchangeMarketDataError("response_invalid");
  }
  const holdingSeconds = Math.floor((closedAtMs - openedAtMs) / 1000);
  const durationClass = classifyTradeDuration(holdingSeconds);
  const timeframe = tradeQualityTimeframeForHoldingSeconds(holdingSeconds);
  const intervalMs = tradeQualityTimeframeMilliseconds(timeframe);
  const nowMs = input.nowMs ?? Date.now();
  const lastClosedBoundary = Math.floor(nowMs / intervalMs) * intervalMs;
  const requestedFromMs = Math.floor((openedAtMs - preEntryBars * intervalMs) / intervalMs) * intervalMs;
  const postExitTargetMs = Math.ceil(closedAtMs / intervalMs) * intervalMs + postExitBars * intervalMs;
  const requestedUntilMs = Math.min(postExitTargetMs, lastClosedBoundary);
  const postExitPending = requestedUntilMs < postExitTargetMs;
  const marketSymbol = normalizeExchangeTradeMarketSymbol(input.provider, input.symbol);
  const budget: FetchBudget = {
    deadlineMs: Date.now() + evaluationDeadlineMs,
    remainingCalls: maxProviderCalls
  };
  const fetched = input.provider === "okx"
    ? await fetchOkxCandles(marketSymbol, timeframe, requestedFromMs, requestedUntilMs, budget)
    : input.provider === "bybit"
      ? await fetchBybitCandles(marketSymbol, timeframe, requestedFromMs, requestedUntilMs, budget)
      : input.provider === "bitget"
        ? await fetchBitgetCandles(marketSymbol, timeframe, requestedFromMs, requestedUntilMs, budget)
        : await fetchBingxCandles(marketSymbol, timeframe, requestedFromMs, requestedUntilMs, budget);
  const offGridCount = fetched.filter((candle) => candle.openTimeMs % intervalMs !== 0).length;
  const candles = Array.from(
    new Map(
      fetched
        .filter((candle) =>
          candle.openTimeMs % intervalMs === 0 &&
          candle.openTimeMs >= requestedFromMs &&
          candle.openTimeMs < requestedUntilMs &&
          candle.openTimeMs + intervalMs <= nowMs
        )
        .map((candle) => [candle.openTimeMs, candle] as const)
    ).values()
  ).sort((left, right) => left.openTimeMs - right.openTimeMs);
  const coverage = coverageFor(candles, requestedFromMs, requestedUntilMs, intervalMs);
  const warnings = [
    ...(coverage.ratio < 0.95 ? ["market_candle_gaps"] : []),
    ...(coverage.maxGapBars > 1 ? ["market_candle_large_gap"] : []),
    ...(offGridCount > 0 ? ["market_candle_off_grid"] : []),
    ...(postExitPending ? ["post_exit_pending"] : [])
  ];
  return {
    provider: input.provider,
    marketSymbol,
    timeframe,
    durationClass,
    requestedFrom: new Date(requestedFromMs).toISOString(),
    requestedUntil: new Date(requestedUntilMs).toISOString(),
    postExitPending,
    postExitReadyAt: postExitPending ? new Date(postExitTargetMs + 60_000).toISOString() : null,
    candles,
    coverage,
    warnings
  };
}
