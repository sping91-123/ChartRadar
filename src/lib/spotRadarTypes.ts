export type SpotExchange = "upbit" | "bithumb";

export type SpotRadarCategory = "volume" | "gainer" | "pullback" | "overheat" | "pressure" | "watch";

export interface SpotRadarItem {
  exchange: SpotExchange;
  market: string;
  symbol: string;
  koreanName: string;
  englishName: string;
  price: number;
  changePercent: number;
  changePrice: number;
  quoteVolume24h: number;
  highPrice: number;
  lowPrice: number;
  rangePosition: number | null;
  category: SpotRadarCategory;
  categoryLabel: string;
  risk: string;
  check: string;
  updatedAt: string;
}

export interface SpotRadarSummary {
  exchange: SpotExchange;
  exchangeLabel: string;
  totalMarkets: number;
  displayedMarkets: number;
  gainers: number;
  losers: number;
  averageChangePercent: number;
  leaderSymbol: string;
  leaderVolume: number;
}

export interface SpotRadarPayload {
  exchange: SpotExchange;
  exchangeLabel: string;
  summary: SpotRadarSummary;
  items: SpotRadarItem[];
  cachedAt: number;
  cached: boolean;
}

export type SpotChartTone = "long" | "short" | "watch" | "risk" | "info";

export interface SpotChartSummary {
  exchange: SpotExchange;
  market: string;
  symbol: string;
  timeframe: "1h";
  structureLabel: string;
  currentPrice: number | null;
  rangePositionPercent: number | null;
  changePercent: number | null;
  volumeRatio: number | null;
  ma20Position: "above" | "below" | "flat" | "unknown";
  supportPrice: number | null;
  resistancePrice: number | null;
  tone: SpotChartTone;
  detail: string;
  updatedAt: string;
  sparkline: number[];
}

export interface SpotChartRadarPayload {
  exchange: SpotExchange;
  exchangeLabel: string;
  items: SpotChartSummary[];
  failedMarkets: string[];
  cachedAt: number;
  cached: boolean;
}
