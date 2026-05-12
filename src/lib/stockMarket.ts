// 글로벌 레이더에 필요한 주요 종목과 캔들 공급자를 관리한다.
import type { Candle, ChartTimeframe } from "@/lib/marketAnalysis";

export interface StockSymbolInfo {
  symbol: string;
  name: string;
  group: "index_etf" | "mega_cap" | "ai_chip" | "growth" | "finance" | "commodity";
}

export const stockSymbols: StockSymbolInfo[] = [
  { symbol: "SPY", name: "S&P 500 ETF", group: "index_etf" },
  { symbol: "QQQ", name: "Nasdaq 100 ETF", group: "index_etf" },
  { symbol: "DIA", name: "Dow Jones ETF", group: "index_etf" },
  { symbol: "IWM", name: "Russell 2000 ETF", group: "index_etf" },
  { symbol: "VOO", name: "Vanguard S&P 500", group: "index_etf" },
  { symbol: "TQQQ", name: "Nasdaq 3x Long", group: "index_etf" },
  { symbol: "SQQQ", name: "Nasdaq 3x Short", group: "index_etf" },
  { symbol: "AAPL", name: "Apple", group: "mega_cap" },
  { symbol: "MSFT", name: "Microsoft", group: "mega_cap" },
  { symbol: "NVDA", name: "Nvidia", group: "mega_cap" },
  { symbol: "GOOGL", name: "Alphabet", group: "mega_cap" },
  { symbol: "AMZN", name: "Amazon", group: "mega_cap" },
  { symbol: "META", name: "Meta", group: "mega_cap" },
  { symbol: "AVGO", name: "Broadcom", group: "mega_cap" },
  { symbol: "AMD", name: "AMD", group: "ai_chip" },
  { symbol: "TSM", name: "TSMC", group: "ai_chip" },
  { symbol: "ASML", name: "ASML", group: "ai_chip" },
  { symbol: "ARM", name: "Arm", group: "ai_chip" },
  { symbol: "MU", name: "Micron", group: "ai_chip" },
  { symbol: "QCOM", name: "Qualcomm", group: "ai_chip" },
  { symbol: "INTC", name: "Intel", group: "ai_chip" },
  { symbol: "TSLA", name: "Tesla", group: "growth" },
  { symbol: "NFLX", name: "Netflix", group: "growth" },
  { symbol: "PLTR", name: "Palantir", group: "growth" },
  { symbol: "COIN", name: "Coinbase", group: "growth" },
  { symbol: "MSTR", name: "MicroStrategy", group: "growth" },
  { symbol: "SHOP", name: "Shopify", group: "growth" },
  { symbol: "UBER", name: "Uber", group: "growth" },
  { symbol: "CRWD", name: "CrowdStrike", group: "growth" },
  { symbol: "JPM", name: "JPMorgan", group: "finance" },
  { symbol: "BAC", name: "Bank of America", group: "finance" },
  { symbol: "GS", name: "Goldman Sachs", group: "finance" },
  { symbol: "XLF", name: "Financials ETF", group: "finance" },
  { symbol: "XLE", name: "Energy ETF", group: "commodity" },
  { symbol: "GLD", name: "Gold ETF", group: "commodity" },
  { symbol: "SLV", name: "Silver ETF", group: "commodity" },
  { symbol: "USO", name: "Oil ETF", group: "commodity" },
  { symbol: "UNG", name: "Natural Gas ETF", group: "commodity" }
];

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
    error?: { description?: string };
  };
}

const yahooIntervalByTimeframe: Record<ChartTimeframe, { interval: string; range: string }> = {
  "5m": { interval: "5m", range: "5d" },
  "15m": { interval: "15m", range: "10d" },
  "1h": { interval: "60m", range: "3mo" },
  "4h": { interval: "60m", range: "6mo" },
  "1d": { interval: "1d", range: "2y" }
};

const CACHE_TTL_MS = 3 * 60 * 1000;
const candleCache = new Map<string, { candles: Candle[]; cachedAt: number }>();

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function aggregateCandles(candles: Candle[], groupSize: number): Candle[] {
  if (groupSize <= 1) return candles;
  const result: Candle[] = [];

  for (let index = 0; index < candles.length; index += groupSize) {
    const group = candles.slice(index, index + groupSize);
    if (group.length < groupSize) continue;
    result.push({
      time: group[0].time,
      open: group[0].open,
      high: Math.max(...group.map((item) => item.high)),
      low: Math.min(...group.map((item) => item.low)),
      close: group[group.length - 1].close,
      volume: group.reduce((sum, item) => sum + item.volume, 0)
    });
  }

  return result;
}

export function normalizeStockSymbol(symbol: string) {
  return symbol.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "").slice(0, 12);
}

export function findStockSymbol(symbol: string) {
  const normalized = normalizeStockSymbol(symbol);
  return stockSymbols.find((item) => item.symbol === normalized) ?? null;
}

export async function fetchStockCandles(symbol: string, timeframe: ChartTimeframe): Promise<Candle[]> {
  const normalized = normalizeStockSymbol(symbol);
  if (!normalized) throw new Error("종목 코드가 올바르지 않습니다.");

  const cacheKey = `${normalized}:${timeframe}`;
  const cached = candleCache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.cachedAt < CACHE_TTL_MS) return cached.candles;

  const config = yahooIntervalByTimeframe[timeframe];
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(normalized)}`);
  url.searchParams.set("interval", config.interval);
  url.searchParams.set("range", config.range);
  url.searchParams.set("includePrePost", "false");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 ChartRadar/1.0"
    },
    cache: "no-store"
  });

  if (!response.ok) throw new Error(`Yahoo Finance ${response.status}`);

  const payload = (await response.json()) as YahooChartResponse;
  const result = payload.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];
  if (!quote || !timestamps.length) throw new Error(payload.chart?.error?.description ?? "글로벌 시장 캔들을 찾지 못했습니다.");

  const candles = timestamps
    .map((timestamp, index) => {
      const open = quote.open?.[index];
      const high = quote.high?.[index];
      const low = quote.low?.[index];
      const close = quote.close?.[index];
      const volume = quote.volume?.[index] ?? 0;
      if (!isFiniteNumber(open) || !isFiniteNumber(high) || !isFiniteNumber(low) || !isFiniteNumber(close)) return null;
      return {
        time: timestamp,
        open,
        high,
        low,
        close,
        volume: isFiniteNumber(volume) ? volume : 0
      } satisfies Candle;
    })
    .filter((item): item is Candle => item !== null);

  const normalizedCandles = timeframe === "4h" ? aggregateCandles(candles, 4) : candles;
  if (normalizedCandles.length < 30) throw new Error("분석에 필요한 캔들 수가 부족합니다.");

  candleCache.set(cacheKey, { candles: normalizedCandles, cachedAt: now });
  return normalizedCandles;
}
