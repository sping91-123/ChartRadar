// 글로벌 자산레이더의 기본 자산 목록과 화면 선택 상수를 정의한다.
import type { Candle, ChartTimeframe } from "@/lib/marketAnalysis";
import type { StockSymbolInfo } from "@/lib/stockMarket";

export const fallbackUniverse: StockSymbolInfo[] = [
  { symbol: "NQ=F", name: "Nasdaq 100 Futures", group: "futures" },
  { symbol: "ES=F", name: "S&P 500 Futures", group: "futures" },
  { symbol: "GC=F", name: "Gold Futures", group: "futures" },
  { symbol: "CL=F", name: "Crude Oil Futures", group: "futures" },
  { symbol: "ZN=F", name: "10Y Treasury Note Futures", group: "futures" },
  { symbol: "SPY", name: "S&P 500 ETF", group: "index_etf" },
  { symbol: "QQQ", name: "Nasdaq 100 ETF", group: "index_etf" },
  { symbol: "^VIX", name: "CBOE Volatility Index", group: "macro_proxy" },
  { symbol: "UUP", name: "US Dollar ETF", group: "macro_proxy" },
  { symbol: "TLT", name: "20Y Treasury ETF", group: "macro_proxy" },
  { symbol: "NVDA", name: "Nvidia", group: "mega_cap" },
  { symbol: "AAPL", name: "Apple", group: "mega_cap" },
  { symbol: "SMH", name: "Semiconductor ETF", group: "ai_chip" },
  { symbol: "AMD", name: "AMD", group: "ai_chip" },
  { symbol: "TSLA", name: "Tesla", group: "growth" },
  { symbol: "JPM", name: "JPMorgan", group: "finance" },
  { symbol: "GLD", name: "Gold ETF", group: "commodity" }
];

export const groupLabels: Record<StockSymbolInfo["group"], string> = {
  futures: "해외선물",
  index_etf: "지수 ETF",
  macro_proxy: "매크로 프록시",
  sector_etf: "섹터 ETF",
  mega_cap: "빅테크",
  ai_chip: "AI·반도체",
  growth: "성장주",
  finance: "금융·섹터",
  commodity: "원자재 ETF"
};

export const groupOrder: StockSymbolInfo["group"][] = ["futures", "index_etf", "macro_proxy", "sector_etf", "mega_cap", "ai_chip", "growth", "finance", "commodity"];
export const featuredSymbols = ["NQ=F", "ES=F", "QQQ", "SPY", "^VIX", "TLT", "NVDA", "SMH", "GLD", "CL=F"];
export const globalWatchlistStorageKey = "chart-radar.globalWatchlist.v1";
export const globalWatchlistMaxItems = 150;

export type GlobalRadarMode = "combined" | "ict" | "technical";

export const radarModes: Array<{ value: GlobalRadarMode; label: string; caption: string }> = [
  { value: "combined", label: "종합", caption: "ICT와 기술지표를 함께 봅니다." },
  { value: "ict", label: "ICT", caption: "구조와 구간만 봅니다." },
  { value: "technical", label: "기술지표", caption: "기술지표만 봅니다." }
];

export const timeframeMinutes: Record<ChartTimeframe, number> = {
  "5m": 5,
  "15m": 15,
  "1h": 60,
  "4h": 240,
  "1d": 1440
};

export type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; candles: Candle[]; dataSource: string; cachedAt: number }
  | { status: "error"; message: string };
