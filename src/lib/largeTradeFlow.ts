// Binance 공개 선물 체결 데이터를 큰 금액 체결 흐름으로 요약합니다.
export type LargeTradeSide = "buy" | "sell" | "balanced";
export type LargeTradeGrade = "calm" | "normal" | "heated" | "extreme";

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
    summary: `${sideLabel(side)} · ${formatUsd(totalLargeNotionalUsd)}`,
    trigger: largest ? `최대 ${largest.side === "buy" ? "매수" : "매도"} ${formatUsd(largest.notionalUsd)}` : "뚜렷한 큰 체결 적음",
    windowMinutes,
    topTrades,
    updatedAt,
    source: "binance-futures"
  };
}
