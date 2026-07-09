import ccxt from "ccxt";
import { buildLiquidationPressureReport, type BuildLiquidationPressureInput, type LiquidationPressureReport } from "@/lib/liquidationPressure";
import {
  analyzeTimeframe,
  fetchBinanceCandles,
  summarizeMarket,
  type Candle,
  type ChartTimeframe,
  type DirectionState,
  type MarketAnalysis,
  type TimeframeAnalysis
} from "@/lib/marketAnalysis";
import { fetchLiquidationPressureReport } from "@/lib/server/liquidationPressureSource";

export type CryptoExchangeId = "binance" | "okx" | "bingx" | "bitget" | "gateio" | "bybit";

export interface CryptoExchangeMarket {
  exchangeId: CryptoExchangeId;
  exchangeLabel: string;
  symbol: string;
  marketId: string;
  base: string;
  quote: string;
  settle: string;
  active: boolean;
  quoteVolume?: number | null;
}

export interface CryptoHomeSnapshot {
  selection: CryptoExchangeMarket;
  price: number;
  changePercent: number | null;
  quoteVolume: number | null;
  chartCandles: Candle[];
  direction: "up" | "down" | "sideways";
  directionLabel: "상승세" | "하락세" | "횡보";
  compositeScore: number;
  scoreBreakdown: CryptoHomeScoreBreakdown;
  analysis: MarketAnalysis;
  timeframes: Array<{
    timeframe: ChartTimeframe;
    label: string;
    msb: DirectionState;
    choch: DirectionState;
    score: number;
    regime: string;
  }>;
  pressure: {
    longScore: number;
    shortScore: number;
    dominant: "long" | "short" | "balanced";
    report: LiquidationPressureReport;
    evidence: Array<{
      label: string;
      value: string;
      available: boolean;
    }>;
    source: "binance-public" | "binance-public-proxy" | "ccxt-public-partial";
    exchangeStatuses: CryptoExchangeDataStatus[];
  };
  strategyRadar: Array<{
    title: string;
    body: string;
    tone: "risk" | "long" | "short" | "watch";
  }>;
  aiInput: {
    symbol: string;
    analysisScope: string;
    activeTimeframe: ChartTimeframe;
    tradingMode: "swing";
    price: number;
    verdict: string;
    bias: MarketAnalysis["bias"];
    biasScore: number;
    scoreRange: string;
    readiness: MarketAnalysis["readiness"];
    summaryLine: string;
    actionGuide: string;
    currentLocationLabel: string;
    killzone: MarketAnalysis["killzone"];
    opportunityFlags: string[];
    riskFlags: string[];
    reasons: MarketAnalysis["reasons"];
    active: {
      timeframe: ChartTimeframe;
      msb: string;
      choch: string;
      ob: string;
      fvg: string;
      sweep: string;
      cisd: string;
      pd: string;
      poc: string;
      rsi: string;
      macd: string;
      volatility: string;
      volume: string;
      bollinger: string;
    };
    aggregate: {
      directionLabel: string;
      compositeScore: number;
      alignment: string;
      shortTimeframeSummary: string;
      higherTimeframeSummary: string;
      volatility: string;
      volume: string;
      keySignals: string[];
    };
    pressure: {
      dominant: "long" | "short" | "balanced";
      dominantLabel: string;
      longScore: number;
      shortScore: number;
      summary: string;
      structurePressureRead: string;
      evidence: string[];
    };
    timeframes: Array<{
      timeframe: ChartTimeframe;
      msb: string;
      choch: string;
      score: number;
      summary: string;
    }>;
    scenario: null;
  };
  updatedAt: string;
}

export interface CryptoExchangeDataStatus {
  exchangeId: CryptoExchangeId;
  exchangeLabel: string;
  status: "available" | "partial" | "unavailable";
  available: string[];
  unavailable: string[];
}

export interface CryptoHomeScoreBreakdown {
  finalScore: number;
  rawScore: number;
  adjustedScore: number;
  maxContribution: number;
  adjustmentLabel: string;
  adjustmentValue: number;
  rows: Array<{
    timeframe: ChartTimeframe;
    label: string;
    weight: number;
    msb: DirectionState;
    choch: DirectionState;
    msbContribution: number;
    chochContribution: number;
    totalContribution: number;
  }>;
}

export interface CryptoHomeTicker {
  selection: CryptoExchangeMarket;
  price: number | null;
  changePercent: number | null;
  quoteVolume: number | null;
  updatedAt: string;
}

const timeframes: ChartTimeframe[] = ["5m", "15m", "1h", "4h", "1d"];
const timeframeLabels: Record<ChartTimeframe, string> = {
  "5m": "5분",
  "15m": "15분",
  "1h": "1시간",
  "4h": "4시간",
  "1d": "일봉"
};
const timeframeWeights: Record<ChartTimeframe, number> = {
  "5m": 0.8,
  "15m": 1,
  "1h": 1.2,
  "4h": 1.5,
  "1d": 1.5
};

const exchangeConfigs: Record<
  CryptoExchangeId,
  {
    ccxtId: string;
    label: string;
    options: Record<string, unknown>;
  }
> = {
  binance: { ccxtId: "binance", label: "Binance", options: { defaultType: "future" } },
  okx: { ccxtId: "okx", label: "OKX", options: { defaultType: "swap" } },
  bingx: { ccxtId: "bingx", label: "BingX", options: { defaultType: "swap" } },
  bitget: { ccxtId: "bitget", label: "Bitget", options: { defaultType: "swap" } },
  gateio: { ccxtId: "gate", label: "Gate.io", options: { defaultType: "swap" } },
  bybit: { ccxtId: "bybit", label: "Bybit", options: { defaultType: "swap" } }
};

const marketCache = new Map<CryptoExchangeId, { expiresAt: number; markets: CryptoExchangeMarket[] }>();
const exchangeCache = new Map<CryptoExchangeId, any>();
const MARKET_CACHE_TTL_MS = 5 * 60 * 1000;
const BINANCE_FAPI = "https://fapi.binance.com";
const DATA_STATUS_TIMEOUT_MS = 3500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function cryptoExchangeOptions() {
  return (Object.keys(exchangeConfigs) as CryptoExchangeId[]).map((id) => ({
    id,
    label: exchangeConfigs[id].label
  }));
}

export function normalizeCryptoExchangeId(value: string | null | undefined): CryptoExchangeId | null {
  if (!value) return null;
  const normalized = value.toLowerCase().trim();
  if (normalized === "gate" || normalized === "gate.io") return "gateio";
  return normalized in exchangeConfigs ? (normalized as CryptoExchangeId) : null;
}

function exchangeFor(exchangeId: CryptoExchangeId) {
  const cached = exchangeCache.get(exchangeId);
  if (cached) return cached;

  const config = exchangeConfigs[exchangeId];
  const ExchangeClass = (ccxt as unknown as Record<string, new (options?: Record<string, unknown>) => any>)[config.ccxtId];
  if (!ExchangeClass) throw new Error(`Unsupported exchange: ${exchangeId}`);

  const exchange = new ExchangeClass({
    enableRateLimit: true,
    timeout: 8000,
    options: config.options
  });
  exchangeCache.set(exchangeId, exchange);
  return exchange;
}

function marketSymbolPart(value: unknown) {
  return typeof value === "string" ? value.toUpperCase() : "";
}

function isUsdtSwapMarket(market: any) {
  const quote = marketSymbolPart(market.quote);
  const settle = marketSymbolPart(market.settle);
  const symbol = typeof market.symbol === "string" ? market.symbol : "";
  const type = typeof market.type === "string" ? market.type : "";
  const active = market.active !== false;
  const isSwap = market.swap === true || type === "swap";
  const isLinear = market.linear !== false;
  const usdtSettled = quote === "USDT" || settle === "USDT" || symbol.includes("/USDT");
  return active && isSwap && isLinear && usdtSettled;
}

function fallbackBinanceMarkets(): CryptoExchangeMarket[] {
  return ["BTC", "ETH", "SOL", "XRP", "DOGE", "BNB"].map((base) => ({
    exchangeId: "binance",
    exchangeLabel: "Binance",
    symbol: `${base}/USDT:USDT`,
    marketId: `${base}USDT`,
    base,
    quote: "USDT",
    settle: "USDT",
    active: true,
    quoteVolume: null
  }));
}

async function fetchBinance24hQuoteVolumeMap() {
  const response = await fetch(`${BINANCE_FAPI}/fapi/v1/ticker/24hr`, {
    headers: { Accept: "application/json" },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Binance ticker/24hr ${response.status}`);
  const payload = (await response.json()) as Array<{ symbol?: string; quoteVolume?: string }>;
  return new Map(
    payload
      .map((item) => [String(item.symbol ?? "").toUpperCase(), safeNumber(item.quoteVolume)] as const)
      .filter(([symbol]) => Boolean(symbol))
  );
}

async function fetchBinanceTickerDirect(marketId: string) {
  const symbol = marketId.toUpperCase().replace(".P", "");
  const response = await fetch(`${BINANCE_FAPI}/fapi/v1/ticker/24hr?symbol=${encodeURIComponent(symbol)}`, {
    headers: { Accept: "application/json" },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Binance ticker/24hr ${response.status}`);
  const payload = (await response.json()) as {
    lastPrice?: string;
    priceChangePercent?: string;
    quoteVolume?: string;
  };
  return {
    last: safeNumber(payload.lastPrice),
    close: safeNumber(payload.lastPrice),
    percentage: safeNumber(payload.priceChangePercent),
    quoteVolume: safeNumber(payload.quoteVolume),
    info: payload
  };
}

async function fetchBinanceFuturesMarketsDirect(): Promise<CryptoExchangeMarket[]> {
  const [response, volumeMap] = await Promise.all([
    fetch(`${BINANCE_FAPI}/fapi/v1/exchangeInfo`, {
      headers: { Accept: "application/json" },
      cache: "no-store"
    }),
    fetchBinance24hQuoteVolumeMap().catch(() => new Map<string, number | null>())
  ]);
  if (!response.ok) throw new Error(`Binance exchangeInfo ${response.status}`);

  const payload = (await response.json()) as {
    symbols?: Array<{
      symbol?: string;
      baseAsset?: string;
      quoteAsset?: string;
      marginAsset?: string;
      contractType?: string;
      status?: string;
    }>;
  };

  const markets = (payload.symbols ?? [])
    .filter((item) => item.status === "TRADING" && item.contractType === "PERPETUAL" && item.quoteAsset === "USDT")
    .map((item): CryptoExchangeMarket => {
      const base = String(item.baseAsset ?? "");
      const marketId = String(item.symbol ?? `${base}USDT`);
      return {
        exchangeId: "binance",
        exchangeLabel: "Binance",
        symbol: `${base}/USDT:USDT`,
        marketId,
        base,
        quote: "USDT",
        settle: String(item.marginAsset ?? "USDT"),
        active: true,
        quoteVolume: volumeMap.get(marketId.toUpperCase()) ?? null
      };
    })
    .filter((market) => market.base && market.marketId)
    .sort(sortMarketsByVolume);

  if (!markets.length) throw new Error("Binance exchangeInfo returned no USDT perpetual markets");
  return markets;
}

function tickerQuoteVolume(ticker: unknown) {
  if (!isRecord(ticker)) return null;
  const info = isRecord(ticker.info) ? ticker.info : {};
  return safeNumber(
    ticker.quoteVolume ??
      ticker.baseVolume ??
      info.quoteVolume ??
      info.turnover24h ??
      info.turnover ??
      info.volumeUsd24h ??
      info.volume_24h
  );
}

function tickerLastPrice(ticker: unknown) {
  if (!isRecord(ticker)) return null;
  const info = isRecord(ticker.info) ? ticker.info : {};
  return safeNumber(ticker.last ?? ticker.close ?? info.lastPrice ?? info.last ?? info.close ?? info.markPrice);
}

function tickerChangePercent(ticker: unknown) {
  if (!isRecord(ticker)) return null;
  const info = isRecord(ticker.info) ? ticker.info : {};
  const direct = safeNumber(
    ticker.percentage ??
      ticker.changePercent ??
      ticker.priceChangePercent ??
      info.priceChangePercent ??
      info.changePercent ??
      info.changePercent24h ??
      info.change24hPercent ??
      info.changeRate ??
      info.priceChangeRate
  );
  if (direct !== null) return direct;

  const last = tickerLastPrice(ticker);
  const open = safeNumber(ticker.open ?? info.openPrice ?? info.open24h);
  if (last !== null && open !== null && open > 0) return ((last - open) / open) * 100;

  const absoluteChange = safeNumber(ticker.change ?? ticker.priceChange ?? info.priceChange ?? info.change24h);
  const previous = last !== null && absoluteChange !== null ? last - absoluteChange : null;
  if (last !== null && absoluteChange !== null && previous !== null && previous > 0) return (absoluteChange / previous) * 100;

  return null;
}

function changePercentFromHourlyCandles(candles: Candle[], latestPrice: number | null | undefined) {
  if (candles.length < 25) return null;
  const latest = latestPrice !== null && latestPrice !== undefined && Number.isFinite(latestPrice) && latestPrice > 0 ? latestPrice : candles.at(-1)?.close ?? null;
  const base = candles.at(-25)?.close ?? null;
  if (latest === null || base === null || !Number.isFinite(latest) || !Number.isFinite(base) || base <= 0) return null;
  return ((latest - base) / base) * 100;
}

async function fetchFallback24hChangePercent(selection: CryptoExchangeMarket, latestPrice: number | null | undefined) {
  try {
    const candles = await fetchExchangeCandles(selection.exchangeId, selection.symbol, "1h", 80);
    return changePercentFromHourlyCandles(candles, latestPrice);
  } catch (error) {
    console.warn("[cryptoExchangeData] 24h change fallback failed:", selection.exchangeId, selection.symbol, error);
    return null;
  }
}

async function fetchSelectionTicker(selection: CryptoExchangeMarket) {
  if (selection.exchangeId === "binance") {
    return fetchBinanceTickerDirect(selection.marketId);
  }

  const exchange = exchangeFor(selection.exchangeId);
  try {
    return await exchange.fetchTicker(selection.symbol);
  } catch {
    return exchange.fetchTicker(selection.symbol, { type: "swap", subType: "linear" });
  }
}

function compactUsdtSymbol(base: string) {
  return `${base.toUpperCase()}USDT`;
}

function dashedUsdtSymbol(base: string) {
  return `${base.toUpperCase()}-USDT`;
}

function gateUsdtSymbol(base: string) {
  return `${base.toUpperCase()}_USDT`;
}

function firstDataRow(payload: unknown) {
  if (!isRecord(payload)) return null;
  if (Array.isArray(payload.data) && isRecord(payload.data[0])) return payload.data[0];
  if (isRecord(payload.data)) return payload.data;
  if (isRecord(payload.result) && Array.isArray(payload.result.list) && isRecord(payload.result.list[0])) return payload.result.list[0];
  return null;
}

async function fetchStatusOk(url: string, hasData: (payload: unknown) => boolean) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DATA_STATUS_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 ChartRadar/1.0" },
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) return false;
    return hasData(await response.json());
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function statusFromChecks(
  exchangeId: CryptoExchangeId,
  checks: Record<"price" | "funding" | "openInterest" | "longShort", boolean>
): CryptoExchangeDataStatus {
  const labels = {
    price: "가격/24h",
    funding: "펀딩비",
    openInterest: "미결제약정",
    longShort: "롱/숏 비율"
  };
  const available = (Object.keys(labels) as Array<keyof typeof labels>)
    .filter((key) => checks[key])
    .map((key) => labels[key]);
  const unavailable = (Object.keys(labels) as Array<keyof typeof labels>)
    .filter((key) => !checks[key])
    .map((key) => labels[key]);

  return {
    exchangeId,
    exchangeLabel: exchangeConfigs[exchangeId].label,
    status: unavailable.length === 0 ? "available" : available.length > 0 ? "partial" : "unavailable",
    available,
    unavailable
  };
}

async function fetchExchangeDataStatus(exchangeId: CryptoExchangeId, base: string): Promise<CryptoExchangeDataStatus> {
  const compact = compactUsdtSymbol(base);
  const dashed = dashedUsdtSymbol(base);
  const gateSymbol = gateUsdtSymbol(base);

  if (exchangeId === "binance") {
    const [price, funding, openInterest, longShort] = await Promise.all([
      fetchStatusOk(`${BINANCE_FAPI}/fapi/v1/ticker/24hr?symbol=${compact}`, (payload) => {
        const row = isRecord(payload) ? payload : null;
        return safeNumber(row?.lastPrice) !== null && safeNumber(row?.priceChangePercent) !== null;
      }),
      fetchStatusOk(`${BINANCE_FAPI}/fapi/v1/premiumIndex?symbol=${compact}`, (payload) => {
        const row = isRecord(payload) ? payload : null;
        return safeNumber(row?.lastFundingRate) !== null;
      }),
      fetchStatusOk(`${BINANCE_FAPI}/fapi/v1/openInterest?symbol=${compact}`, (payload) => {
        const row = isRecord(payload) ? payload : null;
        return safeNumber(row?.openInterest) !== null;
      }),
      fetchStatusOk(`${BINANCE_FAPI}/futures/data/globalLongShortAccountRatio?symbol=${compact}&period=1h&limit=1`, (payload) => {
        const row = Array.isArray(payload) && isRecord(payload[0]) ? payload[0] : null;
        return safeNumber(row?.longAccount) !== null && safeNumber(row?.shortAccount) !== null;
      })
    ]);
    return statusFromChecks(exchangeId, { price, funding, openInterest, longShort });
  }

  if (exchangeId === "okx") {
    const [price, funding, openInterest, longShort] = await Promise.all([
      fetchStatusOk(`https://www.okx.com/api/v5/market/ticker?instId=${dashed}-SWAP`, (payload) => {
        const row = firstDataRow(payload);
        return safeNumber(row?.last) !== null && safeNumber(row?.open24h) !== null;
      }),
      fetchStatusOk(`https://www.okx.com/api/v5/public/funding-rate?instId=${dashed}-SWAP`, (payload) => {
        const row = firstDataRow(payload);
        return safeNumber(row?.fundingRate) !== null;
      }),
      fetchStatusOk(`https://www.okx.com/api/v5/public/open-interest?instType=SWAP&instId=${dashed}-SWAP`, (payload) => {
        const row = firstDataRow(payload);
        return safeNumber(row?.oiUsd ?? row?.oi) !== null;
      }),
      fetchStatusOk(`https://www.okx.com/api/v5/rubik/stat/contracts/long-short-account-ratio?ccy=${base.toUpperCase()}&period=1H`, (payload) => {
        return isRecord(payload) && Array.isArray(payload.data) && Array.isArray(payload.data[0]) && safeNumber(payload.data[0][1]) !== null;
      })
    ]);
    return statusFromChecks(exchangeId, { price, funding, openInterest, longShort });
  }

  if (exchangeId === "bingx") {
    const [price, funding, openInterest] = await Promise.all([
      fetchStatusOk(`https://open-api.bingx.com/openApi/swap/v2/quote/ticker?symbol=${dashed}`, (payload) => {
        const row = firstDataRow(payload);
        return safeNumber(row?.lastPrice) !== null && safeNumber(row?.priceChangePercent) !== null;
      }),
      fetchStatusOk(`https://open-api.bingx.com/openApi/swap/v2/quote/premiumIndex?symbol=${dashed}`, (payload) => {
        const row = firstDataRow(payload);
        return safeNumber(row?.lastFundingRate) !== null;
      }),
      fetchStatusOk(`https://open-api.bingx.com/openApi/swap/v2/quote/openInterest?symbol=${dashed}`, (payload) => {
        const row = firstDataRow(payload);
        return safeNumber(row?.openInterest) !== null;
      })
    ]);
    return statusFromChecks(exchangeId, { price, funding, openInterest, longShort: false });
  }

  if (exchangeId === "bitget") {
    const [price, funding, openInterest, longShort] = await Promise.all([
      fetchStatusOk(`https://api.bitget.com/api/v2/mix/market/ticker?symbol=${compact}&productType=USDT-FUTURES`, (payload) => {
        const row = firstDataRow(payload);
        return safeNumber(row?.lastPr) !== null && safeNumber(row?.change24h) !== null;
      }),
      fetchStatusOk(`https://api.bitget.com/api/v2/mix/market/current-fund-rate?symbol=${compact}&productType=USDT-FUTURES`, (payload) => {
        const row = firstDataRow(payload);
        return safeNumber(row?.fundingRate) !== null;
      }),
      fetchStatusOk(`https://api.bitget.com/api/v2/mix/market/open-interest?symbol=${compact}&productType=USDT-FUTURES`, (payload) => {
        const row = firstDataRow(payload);
        return isRecord(row) && Array.isArray(row.openInterestList) && safeNumber(row.openInterestList[0]?.size) !== null;
      }),
      fetchStatusOk(`https://api.bitget.com/api/v2/mix/market/account-long-short?symbol=${compact}&productType=USDT-FUTURES&period=1h`, (payload) => {
        const row = firstDataRow(payload);
        return safeNumber(row?.longAccountRatio) !== null && safeNumber(row?.shortAccountRatio) !== null;
      })
    ]);
    return statusFromChecks(exchangeId, { price, funding, openInterest, longShort });
  }

  if (exchangeId === "gateio") {
    const [price, funding, openInterest, longShort] = await Promise.all([
      fetchStatusOk(`https://api.gateio.ws/api/v4/futures/usdt/tickers?contract=${gateSymbol}`, (payload) => {
        const row = Array.isArray(payload) && isRecord(payload[0]) ? payload[0] : null;
        return safeNumber(row?.last) !== null && safeNumber(row?.change_percentage) !== null;
      }),
      fetchStatusOk(`https://api.gateio.ws/api/v4/futures/usdt/tickers?contract=${gateSymbol}`, (payload) => {
        const row = Array.isArray(payload) && isRecord(payload[0]) ? payload[0] : null;
        return safeNumber(row?.funding_rate ?? row?.funding_rate_indicative) !== null;
      }),
      fetchStatusOk(`https://api.gateio.ws/api/v4/futures/usdt/tickers?contract=${gateSymbol}`, (payload) => {
        const row = Array.isArray(payload) && isRecord(payload[0]) ? payload[0] : null;
        return safeNumber(row?.total_size) !== null;
      }),
      fetchStatusOk(`https://api.gateio.ws/api/v4/futures/usdt/contracts/${gateSymbol}`, (payload) => {
        const row = isRecord(payload) ? payload : null;
        return safeNumber(row?.long_users) !== null && safeNumber(row?.short_users) !== null;
      })
    ]);
    return statusFromChecks(exchangeId, { price, funding, openInterest, longShort });
  }

  const [price, funding, openInterest, longShort] = await Promise.all([
    fetchStatusOk(`https://api.bybit.com/v5/market/tickers?category=linear&symbol=${compact}`, (payload) => {
      const row = firstDataRow(payload);
      return safeNumber(row?.lastPrice) !== null && safeNumber(row?.price24hPcnt) !== null;
    }),
    fetchStatusOk(`https://api.bybit.com/v5/market/tickers?category=linear&symbol=${compact}`, (payload) => {
      const row = firstDataRow(payload);
      return safeNumber(row?.fundingRate) !== null;
    }),
    fetchStatusOk(`https://api.bybit.com/v5/market/tickers?category=linear&symbol=${compact}`, (payload) => {
      const row = firstDataRow(payload);
      return safeNumber(row?.openInterestValue ?? row?.openInterest) !== null;
    }),
    fetchStatusOk(`https://api.bybit.com/v5/market/account-ratio?category=linear&symbol=${compact}&period=1h&limit=1`, (payload) => {
      const row = firstDataRow(payload);
      return safeNumber(row?.buyRatio) !== null && safeNumber(row?.sellRatio) !== null;
    })
  ]);
  return statusFromChecks(exchangeId, { price, funding, openInterest, longShort });
}

async function fetchExchangeDataStatuses(base: string) {
  const exchangeIds = Object.keys(exchangeConfigs) as CryptoExchangeId[];
  const results = await Promise.allSettled(exchangeIds.map((exchangeId) => fetchExchangeDataStatus(exchangeId, base)));
  return results.map((result, index) => {
    const exchangeId = exchangeIds[index];
    if (result.status === "fulfilled") return result.value;
    return {
      exchangeId,
      exchangeLabel: exchangeConfigs[exchangeId].label,
      status: "unavailable" as const,
      available: [],
      unavailable: ["가격/24h", "펀딩비", "미결제약정", "롱/숏 비율"]
    };
  });
}

function sortMarketsByVolume(a: CryptoExchangeMarket, b: CryptoExchangeMarket) {
  const aVolume = a.quoteVolume;
  const bVolume = b.quoteVolume;
  const aHasVolume = aVolume !== null && aVolume !== undefined && Number.isFinite(aVolume);
  const bHasVolume = bVolume !== null && bVolume !== undefined && Number.isFinite(bVolume);
  if (aHasVolume && bHasVolume && aVolume !== bVolume) return Number(bVolume) - Number(aVolume);
  if (aHasVolume !== bHasVolume) return aHasVolume ? -1 : 1;
  return a.base.localeCompare(b.base);
}

async function enrichMarketVolumes(exchangeId: CryptoExchangeId, markets: CryptoExchangeMarket[]) {
  if (!markets.length) return markets;
  if (markets.some((market) => market.quoteVolume !== undefined)) return markets.sort(sortMarketsByVolume);

  try {
    const exchange = exchangeFor(exchangeId);
    if (typeof exchange.fetchTickers !== "function") return markets.sort(sortMarketsByVolume);
    const tickers = await exchange.fetchTickers(
      markets.map((market) => market.symbol),
      { type: "swap", subType: "linear" }
    );
    const withVolume = markets.map((market) => ({
      ...market,
      quoteVolume: tickerQuoteVolume(tickers?.[market.symbol])
    }));
    return withVolume.sort(sortMarketsByVolume);
  } catch (error) {
    console.warn("[cryptoExchangeData] market volume enrichment failed:", exchangeId, error);
    return markets.sort(sortMarketsByVolume);
  }
}

export async function getExchangeMarkets(exchangeId: CryptoExchangeId) {
  const cached = marketCache.get(exchangeId);
  if (cached && cached.expiresAt > Date.now()) return cached.markets;

  if (exchangeId === "binance") {
    try {
      const markets = await fetchBinanceFuturesMarketsDirect();
      marketCache.set(exchangeId, { markets, expiresAt: Date.now() + MARKET_CACHE_TTL_MS });
      return markets;
    } catch (error) {
      console.warn("[cryptoExchangeData] Binance direct market universe failed:", error);
    }
  }

  try {
    const exchange = exchangeFor(exchangeId);
    const marketsBySymbol = await exchange.loadMarkets(false, { type: "swap", subType: "linear" });
    const config = exchangeConfigs[exchangeId];
    const markets = Object.values(marketsBySymbol)
      .filter(isUsdtSwapMarket)
      .map((market: any): CryptoExchangeMarket => ({
        exchangeId,
        exchangeLabel: config.label,
        symbol: market.symbol,
        marketId: String(market.id ?? market.symbol),
        base: String(market.base ?? market.symbol?.split("/")?.[0] ?? ""),
        quote: String(market.quote ?? "USDT"),
        settle: String(market.settle ?? "USDT"),
        active: market.active !== false,
        quoteVolume: undefined
      }))
      .filter((market) => market.base && market.symbol)
      .sort((a, b) => a.base.localeCompare(b.base));

    if (!markets.length) throw new Error(`${exchangeId} returned no USDT swap markets`);
    const enrichedMarkets = await enrichMarketVolumes(exchangeId, markets);
    marketCache.set(exchangeId, { markets: enrichedMarkets, expiresAt: Date.now() + MARKET_CACHE_TTL_MS });
    return enrichedMarkets;
  } catch (error) {
    console.warn("[cryptoExchangeData] market universe failed:", exchangeId, error);
    const fallback = exchangeId === "binance" ? await fetchBinanceFuturesMarketsDirect().catch(() => fallbackBinanceMarkets()) : [];
    marketCache.set(exchangeId, { markets: fallback, expiresAt: Date.now() + 60_000 });
    return fallback;
  }
}

export async function resolveExchangeMarket(exchangeId: CryptoExchangeId, symbol: string | null | undefined) {
  const markets = await getExchangeMarkets(exchangeId);
  const target = symbol?.trim();
  if (!target) return markets.find((market) => market.base === "BTC") ?? markets[0] ?? fallbackBinanceMarkets()[0];
  const compactTarget = target.toUpperCase().replace(".P", "").replace("/", "").replace(":USDT", "");
  return (
    markets.find((market) => market.symbol === target || market.marketId === target) ??
    markets.find((market) => market.base.toUpperCase() === target.toUpperCase()) ??
    markets.find((market) => market.marketId.toUpperCase() === compactTarget || `${market.base.toUpperCase()}USDT` === compactTarget) ??
    markets.find((market) => market.base === "BTC") ??
    markets[0] ??
    fallbackBinanceMarkets()[0]
  );
}

function parseOhlcvRows(rows: unknown): Candle[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      const values = Array.isArray(row) ? row : [];
      return {
        time: Math.floor(Number(values[0]) / 1000),
        open: Number(values[1]),
        high: Number(values[2]),
        low: Number(values[3]),
        close: Number(values[4]),
        volume: Number(values[5])
      };
    })
    .filter(
      (candle) =>
        Number.isFinite(candle.time) &&
        Number.isFinite(candle.open) &&
        Number.isFinite(candle.high) &&
        Number.isFinite(candle.low) &&
        Number.isFinite(candle.close) &&
        Number.isFinite(candle.volume)
    );
}

async function fetchExchangeCandles(exchangeId: CryptoExchangeId, symbol: string, timeframe: ChartTimeframe, limit = 320) {
  const exchange = exchangeFor(exchangeId);
  try {
    const rows = await exchange.fetchOHLCV(symbol, timeframe, undefined, limit, { type: "swap", subType: "linear" });
    const candles = parseOhlcvRows(rows);
    if (candles.length < 60) throw new Error(`${exchangeId} ${symbol} ${timeframe} candles unavailable`);
    return candles;
  } catch (error) {
    if (exchangeId === "binance") {
      const normalized = symbol.toUpperCase().split(":")[0]?.replace("/", "") ?? "BTCUSDT";
      return fetchBinanceCandles(normalized, timeframe, limit);
    }
    throw error;
  }
}

function directionValue(direction: DirectionState) {
  if (direction === "bullish") return 1;
  if (direction === "bearish") return -1;
  return 0;
}

function compositeStructureScore(analyses: TimeframeAnalysis[]): CryptoHomeScoreBreakdown {
  const max = timeframes.reduce((sum, timeframe) => sum + timeframeWeights[timeframe] * 1.6, 0);
  const rows = analyses.map((analysis) => {
    const weight = timeframeWeights[analysis.timeframe];
    const msbContribution = weight * directionValue(analysis.msb);
    const chochContribution = weight * directionValue(analysis.choch) * 0.6;
    return {
      timeframe: analysis.timeframe,
      label: timeframeLabels[analysis.timeframe],
      weight,
      msb: analysis.msb,
      choch: analysis.choch,
      msbContribution,
      chochContribution,
      totalContribution: msbContribution + chochContribution
    };
  });
  const raw = rows.reduce((sum, row) => sum + row.totalContribution, 0);
  const rawScore = 50 + (raw / max) * 50;
  let adjustedScore = rawScore;
  const active = analyses.find((item) => item.timeframe === "1h") ?? analyses[0];
  let adjustmentLabel = "보정 없음";
  if (active?.condition.regime === "range" || active?.condition.regime === "compression") {
    adjustedScore = 50 + (rawScore - 50) * 0.8;
    adjustmentLabel = active.condition.regime === "range" ? "횡보 구간 보정" : "압축 구간 보정";
  }
  const finalScore = Math.round(Math.max(0, Math.min(100, adjustedScore)));
  return {
    finalScore,
    rawScore: Number(rawScore.toFixed(2)),
    adjustedScore: Number(adjustedScore.toFixed(2)),
    maxContribution: Number(max.toFixed(2)),
    adjustmentLabel,
    adjustmentValue: Number((adjustedScore - rawScore).toFixed(2)),
    rows: rows.map((row) => ({
      ...row,
      msbContribution: Number(row.msbContribution.toFixed(2)),
      chochContribution: Number(row.chochContribution.toFixed(2)),
      totalContribution: Number(row.totalContribution.toFixed(2))
    }))
  };
}

function directionForScore(score: number): CryptoHomeSnapshot["direction"] {
  if (score >= 62) return "up";
  if (score <= 38) return "down";
  return "sideways";
}

function directionLabel(direction: CryptoHomeSnapshot["direction"]): CryptoHomeSnapshot["directionLabel"] {
  if (direction === "up") return "상승세";
  if (direction === "down") return "하락세";
  return "횡보";
}

function formatOptionalPercent(value: number | null | undefined, digits = 3) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "데이터 없음";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

function fundingEvidenceValue(report: LiquidationPressureReport) {
  const value = formatOptionalPercent(report.fundingRatePercent, 4);
  if (value === "데이터 없음") return value;
  if (!report.fundingRateSource || report.fundingRateSource === "Binance") return value;
  return `${value} · ${report.fundingRateSource}`;
}

function formatOptionalNumber(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "데이터 없음";
  return value.toLocaleString("ko-KR", { maximumFractionDigits: digits });
}

function formatLongShortSnapshot(snapshot: LiquidationPressureReport["globalLongShort"]) {
  if (snapshot.longPercent === null || snapshot.shortPercent === null) return "데이터 없음";
  const ratio = snapshot.ratio === null ? "" : ` · 비율 ${snapshot.ratio.toFixed(2)}`;
  return `롱 ${snapshot.longPercent.toFixed(1)}% / 숏 ${snapshot.shortPercent.toFixed(1)}%${ratio}`;
}

function formatTakerFlow(flow: LiquidationPressureReport["takerFlow"]) {
  if (flow.buyPercent === null || flow.sellPercent === null) return "데이터 없음";
  return `매수 ${flow.buyPercent.toFixed(1)}% / 매도 ${flow.sellPercent.toFixed(1)}%`;
}

function pressurePayload(report: LiquidationPressureReport, source: CryptoHomeSnapshot["pressure"]["source"]) {
  const longScore = report.downsideLongPressure;
  const shortScore = report.upsideShortPressure;
  const dominant: CryptoHomeSnapshot["pressure"]["dominant"] =
    longScore > shortScore + 8 ? "long" : shortScore > longScore + 8 ? "short" : "balanced";
  const evidence = [
    {
      label: "펀딩비",
      value: fundingEvidenceValue(report),
      available: report.fundingRatePercent !== null
    },
    {
      label: "OI 변화",
      value: formatOptionalPercent(report.openInterestChangePercent, 2),
      available: report.openInterestChangePercent !== null
    },
    {
      label: "미결제약정",
      value: formatOptionalNumber(report.openInterestValue, 0),
      available: report.openInterestValue !== null
    },
    {
      label: "전체 롱/숏",
      value: formatLongShortSnapshot(report.globalLongShort),
      available: report.globalLongShort.longPercent !== null && report.globalLongShort.shortPercent !== null
    },
    {
      label: "상위 계정 롱/숏",
      value: formatLongShortSnapshot(report.topAccountLongShort),
      available: report.topAccountLongShort.longPercent !== null && report.topAccountLongShort.shortPercent !== null
    },
    {
      label: "상위 포지션 롱/숏",
      value: formatLongShortSnapshot(report.topPositionLongShort),
      available: report.topPositionLongShort.longPercent !== null && report.topPositionLongShort.shortPercent !== null
    },
    {
      label: "Taker 매수/매도",
      value: formatTakerFlow(report.takerFlow),
      available: report.takerFlow.buyPercent !== null && report.takerFlow.sellPercent !== null
    }
  ];

  return {
    longScore,
    shortScore,
    dominant,
    report,
    source,
    evidence
  };
}

function binanceSymbol(selection: CryptoExchangeMarket) {
  return `${selection.base.toUpperCase()}USDT`;
}

async function fetchGenericPressure(exchangeId: CryptoExchangeId, symbol: string, price: number) {
  const exchange = exchangeFor(exchangeId);
  const exchangeWithMethods = exchange as {
    fetchFundingRate?: (symbol: string, params?: Record<string, unknown>) => Promise<unknown>;
    fetchOpenInterest?: (symbol: string, params?: Record<string, unknown>) => Promise<unknown>;
    fetchOpenInterestHistory?: (symbol: string, timeframe?: string, since?: number, limit?: number, params?: Record<string, unknown>) => Promise<unknown>;
  };

  const [fundingResult, openInterestResult, openInterestHistoryResult] = await Promise.allSettled([
    exchangeWithMethods.fetchFundingRate ? exchangeWithMethods.fetchFundingRate(symbol, { type: "swap", subType: "linear" }) : Promise.resolve(null),
    exchangeWithMethods.fetchOpenInterest ? exchangeWithMethods.fetchOpenInterest(symbol, { type: "swap", subType: "linear" }) : Promise.resolve(null),
    exchangeWithMethods.fetchOpenInterestHistory
      ? exchangeWithMethods.fetchOpenInterestHistory(symbol, "1h", undefined, 8, { type: "swap", subType: "linear" })
      : Promise.resolve(null)
  ]);

  const fundingPayload = fundingResult.status === "fulfilled" && isRecord(fundingResult.value) ? fundingResult.value : null;
  const openInterestPayload = openInterestResult.status === "fulfilled" && isRecord(openInterestResult.value) ? openInterestResult.value : null;
  const historyPayload = openInterestHistoryResult.status === "fulfilled" && Array.isArray(openInterestHistoryResult.value) ? openInterestHistoryResult.value : [];
  const firstHistory = historyPayload[0];
  const lastHistory = historyPayload[historyPayload.length - 1];
  const firstOi = isRecord(firstHistory) ? safeNumber(firstHistory.openInterestValue ?? firstHistory.openInterestAmount ?? firstHistory.openInterest) : null;
  const lastOi = isRecord(lastHistory) ? safeNumber(lastHistory.openInterestValue ?? lastHistory.openInterestAmount ?? lastHistory.openInterest) : null;
  const openInterestChangePercent = firstOi && lastOi !== null ? ((lastOi - firstOi) / firstOi) * 100 : null;
  const input: BuildLiquidationPressureInput = {
    symbol,
    period: "1h",
    markPrice: safeNumber(fundingPayload?.markPrice) ?? price,
    indexPrice: safeNumber(fundingPayload?.indexPrice),
    fundingRate: safeNumber(fundingPayload?.fundingRate),
    nextFundingTime: safeNumber(fundingPayload?.nextFundingTimestamp),
    openInterestValue: safeNumber(openInterestPayload?.openInterestValue ?? openInterestPayload?.openInterestAmount ?? openInterestPayload?.openInterest),
    openInterestChangePercent,
    updatedAt: Date.now()
  };
  return pressurePayload(buildLiquidationPressureReport(input), "ccxt-public-partial");
}

async function fetchPressure(selection: CryptoExchangeMarket, price: number) {
  if (selection.exchangeId === "binance") {
    try {
      const report = await fetchLiquidationPressureReport(binanceSymbol(selection), "1h");
      return pressurePayload(report, "binance-public");
    } catch (error) {
      console.warn("[cryptoExchangeData] Binance pressure failed, falling back to ccxt partial:", error);
    }
  } else {
    try {
      const report = await fetchLiquidationPressureReport(binanceSymbol(selection), "1h");
      return pressurePayload(report, "binance-public-proxy");
    } catch (error) {
      console.warn("[cryptoExchangeData] Binance proxy pressure failed, falling back to ccxt partial:", error);
    }
  }
  return fetchGenericPressure(selection.exchangeId, selection.symbol, price);
}

function stateLabel(value: DirectionState) {
  if (value === "bullish") return "상방";
  if (value === "bearish") return "하방";
  if (value === "neutral") return "중립";
  return "미확인";
}

function homePocLabel(value: string) {
  if (value === "above") return "위쪽";
  if (value === "below") return "아래쪽";
  if (value === "near") return "근처";
  return "미확인";
}

function homePremiumDiscountLabel(value: string) {
  if (value === "premium") return "상단 가격권";
  if (value === "discount") return "하단 가격권";
  if (value === "equilibrium") return "균형 가격권";
  return "가격 위치 미확인";
}

function homeMacdLabel(value: string) {
  if (value === "rising") return "상승";
  if (value === "falling") return "하락";
  if (value === "neutral") return "중립";
  return "미확인";
}

function homeVolatilityLabel(value: string) {
  if (value === "expanded") return "확대";
  if (value === "compressed") return "압축";
  if (value === "normal") return "보통";
  return "미확인";
}

function homeVolumeLabel(value: string) {
  if (value === "high") return "높음";
  if (value === "low") return "낮음";
  if (value === "normal") return "보통";
  return "미확인";
}

function homeBollingerLabel(value: string) {
  if (value === "upper") return "상단";
  if (value === "middle") return "중간";
  if (value === "lower") return "하단";
  if (value === "outsideUpper") return "상단 밖";
  if (value === "outsideLower") return "하단 밖";
  return "미확인";
}

function homeFriendlyText(text: string) {
  return text
    .replace(/\biFVG\b/g, "전환 가격 공백")
    .replace(/\bFVG\b/g, "가격 공백")
    .replace(/\bMSB\b/g, "확정 구조")
    .replace(/\bCHoCH\b/g, "전환 신호")
    .replace(/\bOB\b/g, "수급 구간")
    .replace(/\bPOC\b/g, "핵심 매물대")
    .replace(/\bPD\b/g, "가격 위치")
    .replace(/\bOTE\b/g, "되돌림 구간")
    .replace(/\bCISD\b/g, "단기 전환")
    .replace(/\bBB\b/g, "브레이커 구간")
    .replace(/\bDealing range\b/gi, "가격 범위")
    .replace(/프리미엄/g, "상단 가격권")
    .replace(/디스카운트/g, "하단 가격권")
    .replace(/\babove\b/gi, "위")
    .replace(/\bbelow\b/gi, "아래")
    .replace(/\bbullish\b/gi, "상방")
    .replace(/\bbearish\b/gi, "하방")
    .replace(/\brising\b/gi, "상승")
    .replace(/\bfalling\b/gi, "하락")
    .replace(/\bneutral\b/gi, "중립")
    .replace(/\bexpanded\b/gi, "확대")
    .replace(/\bcompressed\b/gi, "압축")
    .replace(/\bnormal\b/gi, "보통")
    .replace(/\bhigh\b/gi, "높음")
    .replace(/\blow\b/gi, "낮음")
    .replace(/확정 구조 상승/g, "확정 구조 상방")
    .replace(/확정 구조 하락/g, "확정 구조 하방")
    .replace(/전환 신호 상승/g, "전환 신호 상방")
    .replace(/전환 신호 하락/g, "전환 신호 하방")
    .replace(/상승 수급 구간/g, "상방 수급 구간")
    .replace(/하락 수급 구간/g, "하방 수급 구간")
    .replace(/상승 가격 공백/g, "상방 가격 공백")
    .replace(/하락 가격 공백/g, "하방 가격 공백")
    .replace(/현재가가 핵심 매물대 위에서 유지/g, "핵심 매물대 위 유지")
    .replace(/현재가가 핵심 매물대 아래에서 유지/g, "핵심 매물대 아래 유지");
}

function activeAnalysisPayload(active: TimeframeAnalysis) {
  return {
    timeframe: active.timeframe,
    msb: stateLabel(active.msb),
    choch: stateLabel(active.choch),
    ob: active.latestOb ? `${stateLabel(active.latestOb.direction)} 수급 구간` : "없음",
    fvg: active.latestFvg ? `${stateLabel(active.latestFvg.direction)} ${active.latestFvg.state === "ifvg" ? "전환 가격 공백" : "가격 공백"}` : "없음",
    sweep: active.latestSweep ? stateLabel(active.latestSweep.direction) : "없음",
    cisd: active.latestCisd ? stateLabel(active.latestCisd.direction) : "없음",
    pd: homePremiumDiscountLabel(active.premiumDiscount),
    poc: active.volumeProfile ? homePocLabel(active.volumeProfile.position) : "핵심 매물대 미확인",
    rsi: active.condition.rsi14 === null ? "미확인" : active.condition.rsi14.toFixed(1),
    macd: homeMacdLabel(active.condition.macdState),
    volatility: homeVolatilityLabel(active.condition.volatilityState),
    volume: homeVolumeLabel(active.condition.volumeState),
    bollinger: homeBollingerLabel(active.condition.bollingerPosition)
  };
}

function signalSide(score: number) {
  if (score > 0.35) return "long";
  if (score < -0.35) return "short";
  return "mixed";
}

function signalSideLabel(score: number) {
  const side = signalSide(score);
  if (side === "long") return "상방 우위";
  if (side === "short") return "하방 우위";
  return "혼조";
}

function frameGroupSignal(analyses: TimeframeAnalysis[], frameGroup: ChartTimeframe[]) {
  return analyses
    .filter((item) => frameGroup.includes(item.timeframe))
    .reduce((sum, item) => sum + timeframeWeights[item.timeframe] * (directionValue(item.msb) + directionValue(item.choch) * 0.6), 0);
}

function frameGroupSummary(analyses: TimeframeAnalysis[], frameGroup: ChartTimeframe[]) {
  const selected = frameGroup
    .map((timeframe) => analyses.find((item) => item.timeframe === timeframe))
    .filter((item): item is TimeframeAnalysis => Boolean(item));
  const score = frameGroupSignal(selected, frameGroup);
  const detail = selected.map((item) => `${timeframeLabels[item.timeframe]} ${stateLabel(item.msb)}/${stateLabel(item.choch)}`).join(", ");
  return `${signalSideLabel(score)}${detail ? ` · ${detail}` : ""}`;
}

function aggregateConditionSummary(analyses: TimeframeAnalysis[], valueFor: (analysis: TimeframeAnalysis) => string) {
  const counts = new Map<string, number>();
  for (const analysis of analyses) {
    const label = valueFor(analysis);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "ko-KR"))
    .map(([label, count]) => `${label} ${count}개`)
    .join(", ");
}

function aggregateAlignmentSummary(shortSignal: number, higherSignal: number) {
  const shortSide = signalSide(shortSignal);
  const higherSide = signalSide(higherSignal);
  if (shortSide !== "mixed" && shortSide === higherSide) {
    return `단기와 상위 프레임이 모두 ${shortSide === "long" ? "상방" : "하방"} 쪽으로 정렬되어 있습니다.`;
  }
  if (shortSide !== "mixed" && higherSide !== "mixed" && shortSide !== higherSide) {
    return "단기와 상위 프레임 방향이 서로 엇갈립니다.";
  }
  if (higherSide !== "mixed") {
    return `상위 프레임은 ${higherSide === "long" ? "상방" : "하방"} 우위지만 단기 신호는 아직 혼조입니다.`;
  }
  if (shortSide !== "mixed") {
    return `단기 신호는 ${shortSide === "long" ? "상방" : "하방"} 우위지만 상위 프레임 확인은 아직 부족합니다.`;
  }
  return "단기와 상위 프레임 모두 혼조라 방향 확정 강도는 낮습니다.";
}

function chooseRepresentativeAnalysis(analyses: TimeframeAnalysis[], scoreBreakdown: CryptoHomeScoreBreakdown) {
  const strongest = [...scoreBreakdown.rows]
    .sort((left, right) => Math.abs(right.totalContribution) - Math.abs(left.totalContribution))
    .find((row) => Math.abs(row.totalContribution) > 0.01);
  return analyses.find((item) => item.timeframe === strongest?.timeframe) ?? analyses.find((item) => item.timeframe === "15m") ?? analyses[0];
}

function buildAggregatePayload(
  analyses: TimeframeAnalysis[],
  scoreBreakdown: CryptoHomeScoreBreakdown,
  direction: CryptoHomeSnapshot["direction"]
): CryptoHomeSnapshot["aiInput"]["aggregate"] {
  const shortFrames: ChartTimeframe[] = ["5m", "15m"];
  const higherFrames: ChartTimeframe[] = ["1h", "4h", "1d"];
  const shortSignal = frameGroupSignal(analyses, shortFrames);
  const higherSignal = frameGroupSignal(analyses, higherFrames);
  return {
    directionLabel: directionLabel(direction),
    compositeScore: scoreBreakdown.finalScore,
    alignment: aggregateAlignmentSummary(shortSignal, higherSignal),
    shortTimeframeSummary: frameGroupSummary(analyses, shortFrames),
    higherTimeframeSummary: frameGroupSummary(analyses, higherFrames),
    volatility: aggregateConditionSummary(analyses, (item) => homeVolatilityLabel(item.condition.volatilityState)),
    volume: aggregateConditionSummary(analyses, (item) => homeVolumeLabel(item.condition.volumeState)),
    keySignals: [...scoreBreakdown.rows]
      .sort((left, right) => Math.abs(right.totalContribution) - Math.abs(left.totalContribution))
      .slice(0, 3)
      .map((row) => `${row.label} 확정 구조 ${stateLabel(row.msb)}, 전환 신호 ${stateLabel(row.choch)}`)
  };
}

function homePressureDominantLabel(pressure: CryptoHomeSnapshot["pressure"]) {
  if (pressure.dominant === "long") return "롱 압력 우세";
  if (pressure.dominant === "short") return "숏 압력 우세";
  return "압력 균형";
}

function homePressureSummary(pressure: CryptoHomeSnapshot["pressure"]) {
  if (pressure.dominant === "long") return `롱 압력이 ${pressure.longScore}점으로 숏 ${pressure.shortScore}점보다 우세합니다.`;
  if (pressure.dominant === "short") return `숏 압력이 ${pressure.shortScore}점으로 롱 ${pressure.longScore}점보다 우세합니다.`;
  return `롱 ${pressure.longScore}점, 숏 ${pressure.shortScore}점으로 압력 차이가 크지 않습니다.`;
}

function homePressureEvidence(pressure: CryptoHomeSnapshot["pressure"], limit = 3) {
  return pressure.evidence
    .filter((item) => item.available)
    .slice(0, limit)
    .map((item) => `${item.label} ${item.value}`);
}

function pressureStructureRead(aggregate: CryptoHomeSnapshot["aiInput"]["aggregate"], pressure: CryptoHomeSnapshot["pressure"]) {
  const shortSide = signalSide(frameSummarySignal(aggregate.shortTimeframeSummary));
  const higherSide = signalSide(frameSummarySignal(aggregate.higherTimeframeSummary));
  const pressureSide = pressure.dominant;

  if (pressureSide === "balanced") {
    return `구조는 ${aggregate.alignment} 압력은 균형권이라 가격 반응 확인이 더 중요합니다.`;
  }
  if (shortSide === pressureSide || higherSide === pressureSide) {
    return `구조 흐름과 ${homePressureDominantLabel(pressure)}가 일부 같은 방향으로 맞습니다.`;
  }
  return `구조 흐름과 ${homePressureDominantLabel(pressure)}가 완전히 맞지는 않아 추격 판단은 보수적으로 봅니다.`;
}

function frameSummarySignal(summary: string) {
  if (summary.includes("상방 우위")) return 1;
  if (summary.includes("하방 우위")) return -1;
  return 0;
}

function buildAiInput(
  selection: CryptoExchangeMarket,
  analysis: MarketAnalysis,
  active: TimeframeAnalysis,
  snapshotTimeframes: CryptoHomeSnapshot["timeframes"],
  aggregate: CryptoHomeSnapshot["aiInput"]["aggregate"],
  pressure: CryptoHomeSnapshot["pressure"]
) {
  return {
    symbol: `${selection.exchangeLabel}:${selection.base}USDT`,
    analysisScope: "전체 프레임 종합 기준",
    activeTimeframe: analysis.activeTimeframe,
    tradingMode: "swing" as const,
    price: analysis.price,
    verdict: analysis.verdict,
    bias: analysis.bias,
    biasScore: analysis.biasScore,
    scoreRange: "범위 제한 없는 구조 기울기값",
    readiness: analysis.readiness,
    summaryLine: homeFriendlyText(analysis.summaryLine),
    actionGuide: homeFriendlyText(analysis.actionGuide),
    currentLocationLabel: homeFriendlyText(analysis.currentLocationLabel),
    killzone: analysis.killzone,
    opportunityFlags: analysis.opportunityFlags.map(homeFriendlyText),
    riskFlags: analysis.riskFlags.map(homeFriendlyText),
    reasons: analysis.reasons.map((reason) => ({ ...reason, text: homeFriendlyText(reason.text) })),
    active: activeAnalysisPayload(active),
    aggregate,
    pressure: {
      dominant: pressure.dominant,
      dominantLabel: homePressureDominantLabel(pressure),
      longScore: pressure.longScore,
      shortScore: pressure.shortScore,
      summary: homePressureSummary(pressure),
      structurePressureRead: pressureStructureRead(aggregate, pressure),
      evidence: homePressureEvidence(pressure)
    },
    timeframes: snapshotTimeframes.map((item) => ({
      timeframe: item.timeframe,
      msb: stateLabel(item.msb),
      choch: stateLabel(item.choch),
      score: item.score,
      summary: `${timeframeLabels[item.timeframe]} 확정 구조 ${stateLabel(item.msb)}, 전환 신호 ${stateLabel(item.choch)}`
    })),
    scenario: null
  };
}

function firstMeaningfulText(items: string[], fallback: string) {
  return items.map((item) => item.trim()).find(Boolean) ?? fallback;
}

function buildStrategyRadar(
  analysis: MarketAnalysis,
  analyses: TimeframeAnalysis[],
  scoreBreakdown: CryptoHomeScoreBreakdown,
  direction: CryptoHomeSnapshot["direction"],
  aggregate: CryptoHomeSnapshot["aiInput"]["aggregate"],
  pressure: CryptoHomeSnapshot["pressure"]
): CryptoHomeSnapshot["strategyRadar"] {
  const hasExpandedVolatility = analyses.some((item) => item.condition.volatilityState === "expanded");
  const hasCompressedVolatility = analyses.some((item) => item.condition.volatilityState === "compressed");
  const riskAnalysis =
    hasExpandedVolatility
      ? "일부 프레임에서 변동폭이 커진 상태라 방향보다 리스크 관리가 먼저입니다."
      : hasCompressedVolatility
        ? "가격이 좁게 모인 상태라 첫 움직임보다 유지 여부가 중요합니다."
        : "전체 변동폭은 과도하지 않아 구조 방향과 압력 일치 여부를 함께 볼 수 있습니다.";
  const riskEvidence = firstMeaningfulText(
    analysis.riskFlags.map(homeFriendlyText),
    `전체 프레임 변동성은 ${aggregate.volatility}, 거래량 상태는 ${aggregate.volume}입니다.`
  );
  const riskCheck = firstMeaningfulText(
    analysis.checkpoints.map(homeFriendlyText),
    homeFriendlyText(analysis.actionGuide || "추격 판단보다 구조가 다시 모이는지 먼저 확인합니다.")
  );

  const trendAnalysis =
    direction === "up"
      ? "전체 프레임 종합 구조는 위쪽으로 기울어 있습니다."
      : direction === "down"
        ? "전체 프레임 종합 구조는 아래쪽으로 기울어 있습니다."
        : "단기와 상위 프레임 근거가 섞여 있어 아직 한쪽 판단을 강하게 두기 어렵습니다.";
  const trendEvidence = `종합 점수 ${scoreBreakdown.finalScore}점. ${aggregate.alignment} 단기: ${aggregate.shortTimeframeSummary}. 상위: ${aggregate.higherTimeframeSummary}.`;
  const trendCheck =
    direction === "up"
      ? "상위 프레임 확정 구조가 유지되고 짧은 프레임 전환 신호가 같은 방향으로 붙는지 확인합니다."
      : direction === "down"
        ? "반등 크기보다 짧은 프레임 전환 신호 회복 여부와 상위 프레임 저항 반응을 확인합니다."
        : "확정 구조와 전환 신호가 같은 방향으로 정렬될 때까지 판단 강도를 낮춥니다.";

  const pressureSummary = homePressureSummary(pressure);
  const availablePressureEvidence = homePressureEvidence(pressure, 2).join(", ");
  const shortTermAnalysis =
    pressure.dominant === "long"
      ? `짧은 구간에서는 위쪽 변동성이 먼저 커질 수 있습니다. ${pressureStructureRead(aggregate, pressure)}`
      : pressure.dominant === "short"
        ? `짧은 구간에서는 아래쪽 변동성이 먼저 커질 수 있습니다. ${pressureStructureRead(aggregate, pressure)}`
        : `짧은 구간 압력은 균형에 가까워 구조 확인이 더 중요합니다. ${pressureStructureRead(aggregate, pressure)}`;
  const shortTermEvidence = availablePressureEvidence ? `${pressureSummary} 근거는 ${availablePressureEvidence}입니다.` : pressureSummary;
  const shortTermCheck =
    pressure.dominant === "balanced"
      ? "5분과 15분 전환 신호가 같은 방향으로 재정렬되는지 확인합니다."
      : `압력 방향과 단기 구조가 같은 쪽으로 맞는지 확인합니다. 현재 단기 구조는 ${aggregate.shortTimeframeSummary}입니다.`;

  return [
    {
      title: "리스크 체크",
      body: [`분석: ${riskAnalysis}`, `근거: ${riskEvidence}`, `확인: ${riskCheck}`].join("\n"),
      tone: hasExpandedVolatility ? "risk" : "watch"
    },
    {
      title: "구조 방향",
      body: [`분석: ${trendAnalysis}`, `근거: ${trendEvidence}`, `확인: ${trendCheck}`].join("\n"),
      tone: direction === "up" ? "long" : direction === "down" ? "short" : "watch"
    },
    {
      title: "단기 확인",
      body: [`분석: ${shortTermAnalysis}`, `근거: ${shortTermEvidence}`, `확인: ${shortTermCheck}`].join("\n"),
      tone: pressure.dominant === "long" ? "long" : pressure.dominant === "short" ? "short" : "watch"
    }
  ];
}

export async function getCryptoHomeTicker(exchangeId: CryptoExchangeId, rawSymbol: string | null | undefined): Promise<CryptoHomeTicker> {
  const selection = await resolveExchangeMarket(exchangeId, rawSymbol);
  const tickerResult = await fetchSelectionTicker(selection).catch((error: unknown) => {
    console.warn("[cryptoExchangeData] ticker failed:", selection.exchangeId, selection.symbol, error);
    return null;
  });
  const ticker = isRecord(tickerResult) ? tickerResult : null;
  const price = tickerLastPrice(ticker);
  const changePercent = tickerChangePercent(ticker) ?? (await fetchFallback24hChangePercent(selection, price));
  return {
    selection,
    price,
    changePercent,
    quoteVolume: tickerQuoteVolume(ticker),
    updatedAt: new Date().toISOString()
  };
}

export async function getCryptoHomeSnapshot(exchangeId: CryptoExchangeId, rawSymbol: string | null | undefined): Promise<CryptoHomeSnapshot> {
  const selection = await resolveExchangeMarket(exchangeId, rawSymbol);
  const [tickerResult, candleResults] = await Promise.all([
    fetchSelectionTicker(selection).catch((error: unknown) => {
      console.warn("[cryptoExchangeData] ticker failed:", selection.exchangeId, selection.symbol, error);
      return null;
    }),
    Promise.all(timeframes.map(async (timeframe) => ({ timeframe, candles: await fetchExchangeCandles(selection.exchangeId, selection.symbol, timeframe) })))
  ]);

  const analyses = candleResults.map(({ timeframe, candles }) => analyzeTimeframe(timeframe, candles));
  const hourlyCandles = candleResults.find((item) => item.timeframe === "1h")?.candles ?? [];
  const latestCandle = hourlyCandles.at(-1) ?? candleResults[0]?.candles.at(-1);
  const ticker = isRecord(tickerResult) ? tickerResult : null;
  const price = tickerLastPrice(ticker) ?? latestCandle?.close ?? 0;
  const changePercent = tickerChangePercent(ticker) ?? changePercentFromHourlyCandles(hourlyCandles, price);
  const scoreBreakdown = compositeStructureScore(analyses);
  const active = chooseRepresentativeAnalysis(analyses, scoreBreakdown);
  const analysis = summarizeMarket(`${selection.exchangeLabel}:${selection.base}USDT`, active.timeframe, analyses, price, "swing");
  const compositeScore = scoreBreakdown.finalScore;
  const direction = directionForScore(compositeScore);
  const aggregate = buildAggregatePayload(analyses, scoreBreakdown, direction);
  const previewCandles = candleResults.find((item) => item.timeframe === "15m")?.candles ?? hourlyCandles;
  const snapshotTimeframes = analyses.map((item) => ({
    timeframe: item.timeframe,
    label: timeframeLabels[item.timeframe],
    msb: item.msb,
    choch: item.choch,
    score: item.score,
    regime: item.condition.regime
  }));
  const [pressure, exchangeStatuses] = await Promise.all([
    fetchPressure(selection, price),
    fetchExchangeDataStatuses(selection.base)
  ]);
  const pressureWithStatuses = {
    ...pressure,
    exchangeStatuses
  };

  return {
    selection,
    price,
    changePercent,
    quoteVolume: tickerQuoteVolume(ticker),
    chartCandles: previewCandles.slice(-96),
    direction,
    directionLabel: directionLabel(direction),
    compositeScore,
    scoreBreakdown,
    analysis,
    timeframes: snapshotTimeframes,
    pressure: pressureWithStatuses,
    strategyRadar: buildStrategyRadar(analysis, analyses, scoreBreakdown, direction, aggregate, pressureWithStatuses),
    aiInput: buildAiInput(selection, analysis, active, snapshotTimeframes, aggregate, pressureWithStatuses),
    updatedAt: new Date().toISOString()
  };
}
