// 코인 레이더 화면에서 LiveMarketChart가 공유하는 UI 상태 타입입니다.
import type { Candle, MarketAnalysis } from "@/lib/marketAnalysis";

export type AnalysisMode = "confirmed" | "aggressive";
export type MsbMode = "close" | "wick";

export interface MarketCachePayload {
  analysis: MarketAnalysis;
  candles: Candle[];
}

export interface AltAnalysisUsageSnapshot {
  dateKey: string;
  symbols: string[];
}

export interface AltAnalysisGate {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  symbols: string[];
}

export interface OverlaySettings {
  ema200: boolean;
  poc: boolean;
  orderBlocks: boolean;
  fvgs: boolean;
  ote: boolean;
  msb: boolean;
  choch: boolean;
  sweep: boolean;
  cisd: boolean;
}

export interface ParityRow {
  label: string;
  web: string;
  pine: string;
  matched: boolean;
  result: string;
  importance: "core" | "major" | "minor";
}

export type MarketBriefingState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; text: string; model: string; cached: boolean }
  | { status: "error"; message: string };

export type RadarProfile = "combined" | "ict" | "technical";
export type StructureSensitivity = 5 | 7 | 9;

export type RadarPulseTone = "long" | "short" | "warn" | "neutral";

export interface RadarPulseItem {
  label: string;
  title: string;
  text: string;
  tone: RadarPulseTone;
}
