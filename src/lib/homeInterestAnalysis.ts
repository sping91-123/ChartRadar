import type { Candle, DirectionState } from "@/lib/marketAnalysis";
import type { CryptoExchangeId } from "@/lib/server/cryptoExchangeData";

export type HomeInterestSummaryTimeframe = "15m" | "1h" | "4h";

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
  updatedAt: string;
  direction: "up" | "down" | "sideways";
  directionLabel: string;
  compositeScore: number;
  chart: {
    timeframe: "15m";
    candles: Candle[];
  };
  summary: {
    headline: string;
    topRisk: string;
    nextCheck: string;
  };
  timeframes: Array<{
    timeframe: HomeInterestSummaryTimeframe;
    label: string;
    structure: DirectionState;
  }>;
  pressure: {
    dominant: "long" | "short" | "balanced";
    summary: string;
  } | null;
  pro?: {
    timeframes: Array<{
      timeframe: HomeInterestSummaryTimeframe;
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
