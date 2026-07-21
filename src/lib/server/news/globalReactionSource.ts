import { fetchStockCandles } from "@/lib/stockMarket";
import type { Candle } from "@/lib/marketAnalysis";
import { globalMarketModeFromScore } from "@/lib/globalMarketMode";
import { completedRecentGlobalCandles, globalObservationQuality, type GlobalReactionObservation } from "@/lib/newsImpact";
import { newsSyncBucketAt } from "@/lib/server/news/newsImpactStore";

const futuresSymbols = ["NQ=F", "ES=F", "YM=F", "RTY=F"] as const;
const riskSymbols = ["^VIX", "UUP", "TLT", "ZN=F"] as const;
const sectorSymbols = ["XLK", "XLY", "XLP", "XLV", "XLI", "XLU", "XLC", "XLF", "XLE", "SMH", "SOXX"] as const;
const allSymbols = [...futuresSymbols, ...riskSymbols, ...sectorSymbols] as const;
function returns(candles: Candle[]) {
  const closed = candles.filter((candle) => Number.isFinite(candle.close) && candle.close > 0).slice(-22);
  return closed.slice(1).map((candle, index) => ((candle.close - closed[index].close) / closed[index].close) * 100);
}

function latestZScore(candles: Candle[]) {
  const values = returns(candles);
  if (values.length < 20) return null;
  const latest = values.at(-1)!;
  const history = values.slice(0, -1);
  const mean = history.reduce((sum, value) => sum + value, 0) / history.length;
  const variance = history.reduce((sum, value) => sum + (value - mean) ** 2, 0) / history.length;
  const deviation = Math.sqrt(variance);
  if (!Number.isFinite(deviation) || deviation === 0) return 0;
  return Number(((latest - mean) / deviation).toFixed(3));
}

function average(values: Array<number | null>) {
  const finite = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (finite.length === 0) return 0;
  return Number((finite.reduce((sum, value) => sum + value, 0) / finite.length).toFixed(3));
}

export async function buildGlobalReactionObservation(now = new Date()): Promise<Omit<GlobalReactionObservation, "id"> & { bucketAt: string }> {
  const settled = await Promise.allSettled(allSymbols.map(async (symbol) => ({
    symbol,
    candles: completedRecentGlobalCandles(await fetchStockCandles(symbol, "5m"), now.getTime())
  })));
  const bySymbol = new Map<string, Candle[]>();
  for (const result of settled) {
    if (result.status === "fulfilled" && result.value.candles.length > 0) bySymbol.set(result.value.symbol, result.value.candles);
  }
  const metrics = Object.fromEntries(allSymbols.map((symbol) => [symbol, bySymbol.has(symbol) ? latestZScore(bySymbol.get(symbol)!) : null]));
  const futures = average(futuresSymbols.map((symbol) => metrics[symbol]));
  const risk = average([
    metrics["^VIX"] === null ? null : -metrics["^VIX"]!,
    metrics.UUP === null ? null : -metrics.UUP!,
    metrics.TLT,
    metrics["ZN=F"]
  ]);
  const sectors = average(sectorSymbols.map((symbol) => metrics[symbol]));
  const availableFutures = futuresSymbols.filter((symbol) => metrics[symbol] !== null).length;
  const availableRisk = riskSymbols.filter((symbol) => metrics[symbol] !== null).length;
  const availableSectors = sectorSymbols.filter((symbol) => metrics[symbol] !== null).length;
  const quality: GlobalReactionObservation["quality"] = globalObservationQuality({ availableFutures, availableRisk, availableSectors });
  const marketModeScore = Number((futures * 1.25 + risk * 1.3 + sectors * 0.75).toFixed(3));
  const marketMode = globalMarketModeFromScore(marketModeScore, bySymbol.size);
  return {
    bucketAt: newsSyncBucketAt(now),
    observedAt: now.toISOString(),
    quality,
    marketMode,
    metrics: { ...metrics, marketModeScore },
    signalGroups: { futures, risk, sectors }
  };
}
