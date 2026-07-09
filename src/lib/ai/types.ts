// AI 코멘트와 종합 피드백에 공통으로 쓰는 타입 정의
import type { BiasSide, ChartTimeframe } from "../marketAnalysis";

export interface CommentaryInput {
  symbol: string;
  timeframe: ChartTimeframe;
  side: BiasSide;
  score: number;
  currentPrice: number;
  entryLow: number;
  entryHigh: number;
  invalidation: number;
  target1: number;
  target2: number;
  proximity: "ready" | "near" | "wait";
  distancePercent: number;
  context: {
    killzone: "asia" | "london" | "newyork" | "off";
    higherTfAlignedCount: number;
    inOte: boolean;
    inOb: boolean;
    inFvg: boolean;
    pocPosition: "above" | "below" | "near" | "unknown";
    quality: "A" | "B" | "C";
    riskFlags: string[];
    opportunityFlags: string[];
  };
}

export interface CommentaryOutput {
  commentary: string;
  model: string;
  cached: boolean;
}

export interface MarketBriefingInput {
  symbol: string;
  analysisScope?: string;
  activeTimeframe: ChartTimeframe;
  tradingMode: "scalp" | "swing";
  price: number;
  verdict: string;
  bias: BiasSide;
  biasScore: number;
  scoreRange: string;
  readiness: "high" | "medium" | "low";
  summaryLine: string;
  actionGuide: string;
  currentLocationLabel: string;
  killzone: "asia" | "london" | "newyork" | "off";
  opportunityFlags: string[];
  riskFlags: string[];
  reasons: Array<{ text: string; tone: string }>;
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
  aggregate?: {
    directionLabel: string;
    compositeScore: number;
    alignment: string;
    shortTimeframeSummary: string;
    higherTimeframeSummary: string;
    volatility: string;
    volume: string;
    keySignals: string[];
  };
  pressure?: {
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
  scenario: {
    title: string;
    reason: string;
    entry: string;
    invalidation: string;
    targets: string;
    confidence: number;
  } | null;
}

export interface MarketBriefingOutput {
  briefing: string;
  model: string;
  cached: boolean;
}

export interface AIProvider {
  readonly model: string;
  generateCommentary(input: CommentaryInput): Promise<string>;
  generateMarketBriefing(input: MarketBriefingInput): Promise<string>;
}

export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}
