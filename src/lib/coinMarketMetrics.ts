export interface CoinMarketMetricsPayload {
  btcDominancePercent: number | null;
  usdKrw: number | null;
  kimchiPremiumPercent: number | null;
  kimchiSource: "upbit-btc" | null;
  cachedAt: number;
  cached: boolean;
  stale?: boolean;
  warnings: string[];
}
