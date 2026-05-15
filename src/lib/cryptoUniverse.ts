// 바이낸스 USDT-M 코인 목록과 유동성 순위를 제공하는 유틸리티.
export interface CryptoSymbolInfo {
  symbol: string;
  ticker: string;
  baseAsset: string;
  quoteAsset: string;
  price: number | null;
  changePercent: number | null;
  quoteVolume: number;
}

interface BinanceExchangeInfo {
  symbols: Array<{
    symbol: string;
    pair?: string;
    contractType?: string;
    status?: string;
    baseAsset?: string;
    quoteAsset?: string;
  }>;
}

interface BinanceTicker {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  quoteVolume: string;
}

const BINANCE_FUTURES_BASE = "https://fapi.binance.com/fapi/v1";
const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedAt = 0;
let cachedSymbols: CryptoSymbolInfo[] = [];
let inflight: Promise<CryptoSymbolInfo[]> | null = null;

const fallbackPerpTickers = [
  "SOLUSDT",
  "XRPUSDT",
  "DOGEUSDT",
  "BNBUSDT",
  "ADAUSDT",
  "AVAXUSDT",
  "LINKUSDT",
  "SUIUSDT",
  "TRXUSDT",
  "DOTUSDT",
  "NEARUSDT",
  "APTUSDT",
  "ARBUSDT",
  "OPUSDT",
  "TONUSDT",
  "INJUSDT",
  "SEIUSDT",
  "TIAUSDT",
  "FILUSDT",
  "ATOMUSDT",
  "LTCUSDT",
  "BCHUSDT",
  "ETCUSDT",
  "UNIUSDT",
  "AAVEUSDT",
  "WLDUSDT",
  "JUPUSDT",
  "PYTHUSDT",
  "ORDIUSDT",
  "PEPEUSDT",
  "WIFUSDT",
  "FETUSDT",
  "RENDERUSDT",
  "RUNEUSDT",
  "GALAUSDT",
  "MANAUSDT",
  "SANDUSDT",
  "DYDXUSDT",
  "LDOUSDT",
  "1000SHIBUSDT"
];

function toRadarSymbol(symbol: string) {
  return `${symbol}.P`;
}

function parseFinite(value: string | undefined) {
  if (value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isSupportedPerpetual(symbol: BinanceExchangeInfo["symbols"][number]) {
  return (
    symbol.status === "TRADING" &&
    symbol.contractType === "PERPETUAL" &&
    symbol.quoteAsset === "USDT" &&
    typeof symbol.symbol === "string" &&
    /^[A-Z0-9]{2,30}USDT$/.test(symbol.symbol) &&
    (typeof symbol.baseAsset !== "string" || /^[A-Z0-9]{2,30}$/.test(symbol.baseAsset))
  );
}

function fallbackCryptoSymbols(): CryptoSymbolInfo[] {
  return fallbackPerpTickers.map((ticker, index) => ({
    symbol: toRadarSymbol(ticker),
    ticker,
    baseAsset: ticker.replace(/USDT$/, ""),
    quoteAsset: "USDT",
    price: null,
    changePercent: null,
    quoteVolume: fallbackPerpTickers.length - index
  }));
}

async function fetchCryptoSymbolsFromBinance(): Promise<CryptoSymbolInfo[]> {
  const [exchangeResponse, tickerResponse] = await Promise.all([
    fetch(`${BINANCE_FUTURES_BASE}/exchangeInfo`, { cache: "no-store" }),
    fetch(`${BINANCE_FUTURES_BASE}/ticker/24hr`, { cache: "no-store" })
  ]);

  if (!exchangeResponse.ok) throw new Error(`Binance exchangeInfo ${exchangeResponse.status}`);
  if (!tickerResponse.ok) throw new Error(`Binance ticker ${tickerResponse.status}`);

  const exchangeInfo = (await exchangeResponse.json()) as BinanceExchangeInfo;
  const tickers = (await tickerResponse.json()) as BinanceTicker[];
  const tickerBySymbol = new Map(tickers.map((ticker) => [ticker.symbol, ticker]));

  return exchangeInfo.symbols
    .filter(isSupportedPerpetual)
    .map((item) => {
      const ticker = tickerBySymbol.get(item.symbol);
      const price = parseFinite(ticker?.lastPrice);
      const changePercent = parseFinite(ticker?.priceChangePercent);
      const quoteVolume = parseFinite(ticker?.quoteVolume) ?? 0;

      return {
        symbol: toRadarSymbol(item.symbol),
        ticker: item.symbol,
        baseAsset: item.baseAsset ?? item.symbol.replace(/USDT$/, ""),
        quoteAsset: item.quoteAsset ?? "USDT",
        price,
        changePercent,
        quoteVolume
      };
    })
    .sort((a, b) => b.quoteVolume - a.quoteVolume);
}

export async function getCryptoSymbols(force = false): Promise<CryptoSymbolInfo[]> {
  const now = Date.now();
  if (!force && cachedSymbols.length > 0 && now - cachedAt < CACHE_TTL_MS) {
    return cachedSymbols;
  }

  if (!inflight) {
    inflight = fetchCryptoSymbolsFromBinance()
      .then((symbols) => {
        cachedSymbols = symbols;
        cachedAt = Date.now();
        return symbols;
      })
      .catch((error) => {
        console.warn("[cryptoUniverse] Binance symbol universe unavailable, using fallback symbols:", error);
        if (cachedSymbols.length > 0) return cachedSymbols;
        const symbols = fallbackCryptoSymbols();
        cachedSymbols = symbols;
        cachedAt = Date.now();
        return symbols;
      })
      .finally(() => {
        inflight = null;
      });
  }

  return inflight;
}

export async function getLiquidCryptoSymbols(options: {
  includeMajor?: boolean;
  excludeMajor?: boolean;
  limit?: number;
} = {}) {
  const includeMajor = options.includeMajor ?? true;
  const excludeMajor = options.excludeMajor ?? false;
  const limit = options.limit ?? 32;
  const major = new Set(["BTCUSDT.P", "ETHUSDT.P"]);

  const symbols = excludeMajor ? fallbackCryptoSymbols() : await getCryptoSymbols();
  const filtered = symbols.filter((item) => {
    const isMajor = major.has(item.symbol);
    if (excludeMajor && isMajor) return false;
    if (!includeMajor && isMajor) return false;
    return true;
  });

  return filtered.slice(0, limit).map((item) => item.symbol);
}

export function isLikelyUsdtPerpSymbol(symbol: string) {
  return /^[A-Z0-9]{2,30}USDT\.P$/.test(symbol);
}
