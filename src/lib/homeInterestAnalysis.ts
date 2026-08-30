import type { Candle, DirectionState } from "@/lib/marketAnalysis";
import type { CryptoExchangeId } from "@/lib/server/cryptoExchangeData";

export type HomeInterestSummaryTimeframe = "5m" | "15m" | "1h" | "4h" | "1d";
export type HomeInterestChartTimeframe = "15m" | "1h" | "4h";

const homeInterestRefreshMaxDelayMs = 60_000;
const homeInterestRefreshRetryDelayMs = 15_000;

export function homeInterestRefreshDelay(expiresAt: string | null | undefined, now = Date.now()) {
  const expiry = Date.parse(expiresAt ?? "");
  if (!Number.isFinite(expiry) || expiry <= now) return homeInterestRefreshRetryDelayMs;
  return Math.min(homeInterestRefreshMaxDelayMs, Math.max(500, expiry - now + 500));
}

export interface HomeInterestAnalysisSummary {
  access: "basic" | "coin_pro";
  selection: {
    exchangeId: CryptoExchangeId;
    exchangeLabel: string;
    marketId: string;
    base: string;
    quote: string;
  };
  price: number;
  changePercent: number | null;
  generatedAt: string;
  observedAt: string;
  expiresAt: string;
  quality: "ready" | "partial" | "stale";
  qualityDetail: string;
  updatedAt: string;
  direction: "up" | "down" | "sideways";
  directionLabel: string;
  compositeScore: number;
  chart: {
    timeframe: "15m";
    candles: Candle[];
    candlesByTimeframe: Record<HomeInterestChartTimeframe, Candle[]>;
  };
  summary: {
    headline: string;
    topRisk: string;
    nextCheck: string;
    nextCondition: {
      label: string;
      met: string;
      unmet: string;
      note: string;
    };
  };
  timeframes: Array<{
    timeframe: HomeInterestSummaryTimeframe;
    label: string;
    observedAt: string;
    structure: DirectionState;
  }>;
  pressure: {
    dominant: "long" | "short" | "balanced";
    summary: string;
    sourceLabel: string;
  };
  pro?: {
    insight: {
      structure: string;
      transition: string;
      pressure: string;
    };
    timeframes: Array<{
      timeframe: HomeInterestChartTimeframe;
      label: string;
      structure: DirectionState;
      transition: DirectionState;
      score: number;
      regime: string;
    }>;
    pressure: {
      longScore: number;
      shortScore: number;
      evidence: Array<{ label: string; value: string }>;
      source: string;
    } | null;
  };
}

export interface HomeInterestAnalysisResponse {
  snapshot?: HomeInterestAnalysisSummary;
  capabilities?: {
    access: HomeInterestAnalysisSummary["access"];
    maxCoins: number;
    canSeeProDetail: boolean;
  };
  error?: string;
}
