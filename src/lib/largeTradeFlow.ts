// Binance 공개 선물 체결 데이터를 큰 금액 체결 흐름으로 요약합니다.
export type LargeTradeSide = "buy" | "sell" | "balanced";
export type LargeTradeGrade = "calm" | "normal" | "heated" | "extreme";
export type LargeTradeAnomalyLevel = "low" | "watch" | "high";

export interface BinanceAggregateTradeRow {
  a?: number;
  p?: string;
  q?: string;
  T?: number;
  m?: boolean;
}

export interface LargeTradeEntry {
  side: Exclude<LargeTradeSide, "balanced">;
  price: number;
  quantity: number;
  notionalUsd: number;
  timestamp: number;
}

export interface LargeTradeFlowReport {
  symbol: string;
  thresholdUsd: number;
  tradeCount: number;
  largeTradeCount: number;
  buyNotionalUsd: number;
  sellNotionalUsd: number;
  totalLargeNotionalUsd: number;
  buyCount: number;
  sellCount: number;
  imbalancePercent: number;
  dominantSide: LargeTradeSide;
  grade: LargeTradeGrade;
  anomalyLevel: LargeTradeAnomalyLevel;
  anomalyScore: number;
  summary: string;
  trigger: string;
  windowMinutes: number | null;
  topTrades: LargeTradeEntry[];
  updatedAt: number;
  source: "binance-futures";
}

const baseThresholdUsd: Record<string, number> = {
  BTCUSDT: 500_000,
  ETHUSDT: 250_000,
  SOLUSDT: 100_000,
  BNBUSDT: 100_000,
  XRPUSDT: 75_000,
  DOGEUSDT: 75_000
};

function toNumber(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function formatUsd(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "$0";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function sideLabel(side: LargeTradeSide) {
  if (side === "buy") return "큰 매수 체결";
  if (side === "sell") return "큰 매도 체결";
  return "큰 체결 균형";
}

function gradeFor(totalLargeNotionalUsd: number, thresholdUsd: number, imbalancePercent: number, largeTradeCount: number): LargeTradeGrade {
  if (largeTradeCount <= 0) return "calm";
  const heat = totalLargeNotionalUsd / Math.max(thresholdUsd, 1);
  const bias = Math.abs(imbalancePercent);
  if (heat >= 10 && bias >= 45) return "extreme";
  if (heat >= 6 && bias >= 30) return "heated";
  if (heat >= 2 || largeTradeCount >= 3) return "normal";
  return "calm";
}

function dominantSide(buyNotionalUsd: number, sellNotionalUsd: number): LargeTradeSide {
  const total = buyNotionalUsd + sellNotionalUsd;
  if (total <= 0) return "balanced";
  const imbalance = ((buyNotionalUsd - sellNotionalUsd) / total) * 100;
  if (imbalance >= 12) return "buy";
  if (imbalance <= -12) return "sell";
  return "balanced";
}

function thresholdFor(symbol: string, notionals: number[]) {
  const base = baseThresholdUsd[symbol] ?? 100_000;
  const sorted = notionals.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (sorted.length < 20) return base;
  const index = Math.floor(sorted.length * 0.95);
  return Math.max(base, sorted[Math.min(index, sorted.length - 1)] ?? base);
}

function quantityBucket(quantity: number) {
  if (quantity >= 1_000) return quantity.toFixed(0);
  if (quantity >= 10) return quantity.toFixed(1);
  if (quantity >= 1) return quantity.toFixed(2);
  return quantity.toFixed(4);
}

function anomalyLevelFor(score: number): LargeTradeAnomalyLevel {
  if (score >= 60) return "high";
  if (score >= 35) return "watch";
  return "low";
}

function repeatedTradeSignal(trades: LargeTradeEntry[], thresholdUsd: number) {
  const candidates = trades.filter((trade) => trade.notionalUsd >= thresholdUsd * 0.25).slice(-300);
  if (candidates.length < 10) {
    return { anomalyLevel: "low" as const, anomalyScore: 0 };
  }

  const bucketCounts = new Map<string, number>();
  for (const trade of candidates) {
    const bucket = quantityBucket(trade.quantity);
    bucketCounts.set(bucket, (bucketCounts.get(bucket) ?? 0) + 1);
  }

  const maxRepeatCount = Array.from(bucketCounts.values()).reduce((max, value) => Math.max(max, value), 0);
  const repeatRatio = maxRepeatCount / candidates.length;
  const sorted = candidates.slice().sort((a, b) => a.timestamp - b.timestamp);
  let alternatingRepeats = 0;
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    const quantityGap = Math.abs(current.quantity - previous.quantity) / Math.max(current.quantity, previous.quantity, 1);
    if (previous.side !== current.side && quantityGap <= 0.02) alternatingRepeats += 1;
  }

  const alternatingRatio = alternatingRepeats / Math.max(1, sorted.length - 1);
  const buyNotional = candidates.filter((trade) => trade.side === "buy").reduce((sum, trade) => sum + trade.notionalUsd, 0);
  const sellNotional = candidates.filter((trade) => trade.side === "sell").reduce((sum, trade) => sum + trade.notionalUsd, 0);
  const totalNotional = buyNotional + sellNotional;
  const balancePercent = totalNotional > 0 ? Math.abs(((buyNotional - sellNotional) / totalNotional) * 100) : 100;
  const timestamps = sorted.map((trade) => trade.timestamp);
  const windowMinutes =
    timestamps.length >= 2 ? Math.max(1, Math.round((timestamps[timestamps.length - 1] - timestamps[0]) / 60_000)) : 1;
  const densityScore = candidates.length / windowMinutes >= 20 ? 12 : candidates.length / windowMinutes >= 10 ? 7 : 0;
  const balanceScore = totalNotional >= thresholdUsd * 5 && balancePercent <= 8 ? 18 : totalNotional >= thresholdUsd * 3 && balancePercent <= 14 ? 10 : 0;
  const score = Math.min(100, Math.round(repeatRatio * 35 + alternatingRatio * 45 + balanceScore + densityScore));

  return {
    anomalyLevel: anomalyLevelFor(score),
    anomalyScore: score
  };
}

export function buildLargeTradeFlowReport(symbol: string, rows: BinanceAggregateTradeRow[], updatedAt = Date.now()): LargeTradeFlowReport {
  const trades = rows
    .map((row) => {
      const price = toNumber(row.p);
      const quantity = toNumber(row.q);
      const timestamp = toNumber(row.T);
      if (price === null || quantity === null || timestamp === null || price <= 0 || quantity <= 0) return null;
      return {
        side: row.m ? ("sell" as const) : ("buy" as const),
        price,
        quantity,
        notionalUsd: price * quantity,
        timestamp
      };
    })
    .filter((row): row is LargeTradeEntry => row !== null);

  const thresholdUsd = thresholdFor(
    symbol,
    trades.map((trade) => trade.notionalUsd)
  );
  const largeTrades = trades.filter((trade) => trade.notionalUsd >= thresholdUsd);
  const buyTrades = largeTrades.filter((trade) => trade.side === "buy");
  const sellTrades = largeTrades.filter((trade) => trade.side === "sell");
  const buyNotionalUsd = buyTrades.reduce((sum, trade) => sum + trade.notionalUsd, 0);
  const sellNotionalUsd = sellTrades.reduce((sum, trade) => sum + trade.notionalUsd, 0);
  const totalLargeNotionalUsd = buyNotionalUsd + sellNotionalUsd;
  const imbalancePercent = totalLargeNotionalUsd > 0 ? ((buyNotionalUsd - sellNotionalUsd) / totalLargeNotionalUsd) * 100 : 0;
  const side = dominantSide(buyNotionalUsd, sellNotionalUsd);
  const grade = gradeFor(totalLargeNotionalUsd, thresholdUsd, imbalancePercent, largeTrades.length);
  const topTrades = largeTrades.slice().sort((a, b) => b.notionalUsd - a.notionalUsd).slice(0, 3);
  const timestamps = trades.map((trade) => trade.timestamp).sort((a, b) => a - b);
  const windowMinutes =
    timestamps.length >= 2 ? Math.max(1, Math.round((timestamps[timestamps.length - 1] - timestamps[0]) / 60_000)) : null;
  const largest = topTrades[0];
  const anomaly = repeatedTradeSignal(trades, thresholdUsd);

  return {
    symbol,
    thresholdUsd,
    tradeCount: trades.length,
    largeTradeCount: largeTrades.length,
    buyNotionalUsd,
    sellNotionalUsd,
    totalLargeNotionalUsd,
    buyCount: buyTrades.length,
    sellCount: sellTrades.length,
    imbalancePercent,
    dominantSide: side,
    grade,
    anomalyLevel: anomaly.anomalyLevel,
    anomalyScore: anomaly.anomalyScore,
    summary: `${sideLabel(side)} · ${formatUsd(totalLargeNotionalUsd)}`,
    trigger: largest ? `최대 ${largest.side === "buy" ? "매수" : "매도"} ${formatUsd(largest.notionalUsd)}` : "뚜렷한 큰 체결 적음",
    windowMinutes,
    topTrades,
    updatedAt,
    source: "binance-futures"
  };
}
