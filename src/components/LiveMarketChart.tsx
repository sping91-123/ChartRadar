"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CandlestickSeries,
  LineStyle,
  createSeriesMarkers,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesMarkersPluginApi,
  type ISeriesApi,
  type SeriesMarker,
  type Time
} from "lightweight-charts";
import { Activity, AlertTriangle, BarChart3, Bot, Bug, Calculator, ClipboardCheck, Copy, History, LockKeyhole, RefreshCcw, Settings2 } from "lucide-react";
import {
  analyzeTimeframe,
  chartTimeframes,
  fetchBinanceCandles,
  summarizeMarket,
  tradingModeConfigs,
  type AnalysisReason,
  type Candle,
  type ChartTimeframe,
  type DirectionState,
  type MarketAnalysis,
  type ReasonTone,
  type TimeframeAnalysis,
  type TradingMode
} from "@/lib/marketAnalysis";
import { appendJournalEntry } from "@/lib/journal";
import type { MarketBriefingInput } from "@/lib/ai/types";
import { normalizePineDirection, parsePineSnapshot, pineDirectionForTimeframe, type PineSnapshot } from "@/lib/pineParity";
import { createRemoteJournalEntry } from "@/lib/remoteJournal";
import { getSupabaseSession } from "@/lib/supabase";

const symbols = ["BTCUSDT.P", "ETHUSDT.P", "SOLUSDT.P", "XRPUSDT.P", "DOGEUSDT.P"];
const timeframeScoreLimit = 6.25;
const storagePrefix = "positionguard";
const legacyStoragePrefix = "co" + "ters";
const overlaySettingsStorageKey = `${storagePrefix}.overlaySettings.v1`;
const legacyOverlaySettingsStorageKey = `${legacyStoragePrefix}.overlaySettings.v1`;

interface MarketCachePayload {
  analysis: MarketAnalysis;
  candles: Candle[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidMarketCachePayload(value: unknown): value is MarketCachePayload {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value.candles) || !isRecord(value.analysis)) return false;

  const timeframeAnalyses = value.analysis.timeframeAnalyses;
  return (
    Array.isArray(timeframeAnalyses) &&
    timeframeAnalyses.length > 0 &&
    timeframeAnalyses.every((item) => isRecord(item) && isRecord(item.condition))
  );
}

function readMarketCache(cacheKey: string): MarketCachePayload | null {
  if (typeof window === "undefined") return null;

  const cached = window.localStorage.getItem(cacheKey);
  if (!cached) return null;

  try {
    const parsed = JSON.parse(cached) as unknown;
    if (isValidMarketCachePayload(parsed)) return parsed;
  } catch {
    // fall through and clear the broken cache below
  }

  window.localStorage.removeItem(cacheKey);
  return null;
}

interface OverlaySettings {
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

// 기본은 캔들만 보이게 둔다. 구조 판독은 차트 아래 카드에서 분리해 보여준다.
const defaultOverlaySettings: OverlaySettings = {
  ema200: false,
  poc: false,
  orderBlocks: false,
  fvgs: false,
  ote: false,
  msb: false,
  choch: false,
  sweep: false,
  cisd: false
};

const overlayPresets = {
  all: {
    ema200: true,
    poc: true,
    orderBlocks: true,
    fvgs: true,
    ote: true,
    msb: true,
    choch: true,
    sweep: true,
    cisd: true
  } satisfies OverlaySettings,
  structure: {
    ema200: true,
    poc: true,
    orderBlocks: false,
    fvgs: false,
    ote: false,
    msb: true,
    choch: true,
    sweep: true,
    cisd: true
  } satisfies OverlaySettings,
  zones: {
    ema200: false,
    poc: true,
    orderBlocks: true,
    fvgs: true,
    ote: true,
    msb: false,
    choch: false,
    sweep: false,
    cisd: false
  } satisfies OverlaySettings,
  minimal: {
    ema200: false,
    poc: false,
    orderBlocks: false,
    fvgs: false,
    ote: false,
    msb: false,
    choch: false,
    sweep: false,
    cisd: false
  } satisfies OverlaySettings
};

interface ParityRow {
  label: string;
  web: string;
  pine: string;
  matched: boolean;
  result: string;
  importance: "core" | "major" | "minor";
}

type MarketBriefingState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; text: string; model: string; cached: boolean }
  | { status: "error"; message: string };

function BriefingKeyword({ children, tone }: { children: string; tone: "long" | "short" | "warn" | "neutral" }) {
  const className =
    tone === "long"
      ? "rounded bg-signal-success/15 px-1 font-black text-signal-success"
      : tone === "short"
        ? "rounded bg-signal-danger/15 px-1 font-black text-signal-danger"
        : tone === "warn"
          ? "rounded bg-signal-warning/15 px-1 font-black text-signal-warning"
          : "rounded bg-accent-blue/15 px-1 font-black text-accent-blue";
  return <span className={className}>{children}</span>;
}

function HighlightedBriefing({ text }: { text: string }) {
  const pattern = /(롱|숏|상승|하락|횡보|주의|리스크|조정|과열|침체|OB|FVG|POC|PD|MSB|CHoCH|Sweep|CISD|강점|약점|대기|관찰)/g;
  return (
    <p className="whitespace-pre-line text-sm leading-7 text-slate-200">
      {text.split(pattern).map((part, index) => {
        if (!part) return null;
        if (["롱", "상승"].includes(part)) return <BriefingKeyword key={`${part}-${index}`} tone="long">{part}</BriefingKeyword>;
        if (["숏", "하락"].includes(part)) return <BriefingKeyword key={`${part}-${index}`} tone="short">{part}</BriefingKeyword>;
        if (["주의", "리스크", "조정", "과열", "침체", "약점"].includes(part)) {
          return <BriefingKeyword key={`${part}-${index}`} tone="warn">{part}</BriefingKeyword>;
        }
        if (["횡보", "OB", "FVG", "POC", "PD", "MSB", "CHoCH", "Sweep", "CISD", "강점", "대기", "관찰"].includes(part)) {
          return <BriefingKeyword key={`${part}-${index}`} tone="neutral">{part}</BriefingKeyword>;
        }
        return <span key={`${part}-${index}`}>{part}</span>;
      })}
    </p>
  );
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: value > 100 ? 2 : 5
  }).format(value);
}

/** lightweight-charts v5는 timeZone 옵션 미지원 → UTC 타임스탬프에 KST 오프셋 직접 가산 */
const KST_OFFSET_SEC = 9 * 3600; // +9h

function toKstTime(utcSec: number): Time {
  return (utcSec + KST_OFFSET_SEC) as unknown as Time;
}

function candleTimeAt(candles: Candle[], index: number): Time | null {
  if (index < 0 || index >= candles.length) return null;
  return toKstTime(candles[index].time);
}

function formatUpdatedAt(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function storageKey(name: string) {
  return `${storagePrefix}.${name}`;
}

function legacyStorageKey(name: string) {
  return `${legacyStoragePrefix}.${name}`;
}

function readLocalStorageWithLegacy(primaryKey: string, legacyKey: string) {
  const current = window.localStorage.getItem(primaryKey);
  if (current !== null) return current;

  const legacy = window.localStorage.getItem(legacyKey);
  if (legacy !== null) {
    window.localStorage.setItem(primaryKey, legacy);
    window.localStorage.removeItem(legacyKey);
  }

  return legacy;
}

function writeLocalStorage(primaryKey: string, legacyKey: string, value: string) {
  window.localStorage.setItem(primaryKey, value);
  window.localStorage.removeItem(legacyKey);
}

function readOverlaySettings(): OverlaySettings {
  if (typeof window === "undefined") return defaultOverlaySettings;

  try {
    const raw = readLocalStorageWithLegacy(overlaySettingsStorageKey, legacyOverlaySettingsStorageKey);
    if (!raw) return defaultOverlaySettings;
    const parsed = JSON.parse(raw) as Partial<OverlaySettings>;
    return { ...defaultOverlaySettings, ...parsed };
  } catch {
    return defaultOverlaySettings;
  }
}

function stateLabel(value: string) {
  if (value === "bullish") return "상승";
  if (value === "bearish") return "하락";
  if (value === "neutral") return "횡보";
  if (value === "above") return "위";
  if (value === "below") return "아래";
  if (value === "near") return "근처";
  if (value === "long") return "롱";
  if (value === "short") return "숏";
  if (value === "premium") return "프리미엄";
  if (value === "discount") return "디스카운트";
  if (value === "equilibrium") return "중간";
  if (value === "none") return "없음";
  return "데이터 부족";
}

function killzoneLabel(value?: string) {
  if (value === "asia") return "아시아";
  if (value === "london") return "런던";
  if (value === "newyork") return "뉴욕";
  return "바깥";
}

function biasClasses(bias?: string) {
  if (bias === "long") return "border-signal-success/30 bg-signal-success/10 text-signal-success";
  if (bias === "short") return "border-signal-danger/30 bg-signal-danger/10 text-signal-danger";
  return "border-signal-warning/30 bg-signal-warning/10 text-signal-warning";
}

function directionBadge(direction: DirectionState) {
  if (direction === "bullish") return "border-signal-success/30 bg-signal-success/10 text-signal-success";
  if (direction === "bearish") return "border-signal-danger/30 bg-signal-danger/10 text-signal-danger";
  return "border-white/10 bg-black/20 text-slate-300";
}

function reasonClasses(tone: ReasonTone) {
  if (tone === "bullish") return "border-signal-success/30 bg-signal-success/10 text-signal-success";
  if (tone === "bearish") return "border-signal-danger/30 bg-signal-danger/10 text-signal-danger";
  return "border-white/10 bg-black/25 text-slate-200";
}

function readinessClasses(readiness?: MarketAnalysis["readiness"]) {
  if (readiness === "high") return "border-signal-success/30 bg-signal-success/10 text-signal-success";
  if (readiness === "medium") return "border-signal-warning/30 bg-signal-warning/10 text-signal-warning";
  return "border-white/10 bg-black/20 text-slate-300";
}

function readinessLabel(readiness?: MarketAnalysis["readiness"]) {
  if (readiness === "high") return "높음";
  if (readiness === "medium") return "보통";
  return "낮음";
}

function userFacingRiskLabel(analysis: MarketAnalysis | null) {
  if (!analysis) return "대기 중";
  if (analysis.readiness === "high" && analysis.riskFlags.length <= 1) return "검토 조건 양호";
  if (analysis.bias === "neutral" || analysis.readiness === "low") return "관찰 우선";
  return "주의 필요";
}

function userFacingNextStep(analysis: MarketAnalysis | null) {
    if (!analysis) return "레이더가 차트 데이터를 감지하는 중";
  if (analysis.bias === "neutral") return "진입보다 구조 확인";
  if (analysis.readiness === "high") return "손절/수량 먼저 확인";
  return "반응 확인 후 판단";
}

function decisionTone(value: string) {
  if (value.includes("양호") || value.includes("손절")) return "border-signal-success/25 bg-signal-success/10 text-signal-success";
  if (value.includes("주의") || value.includes("관찰")) return "border-signal-warning/25 bg-signal-warning/10 text-signal-warning";
  return "border-white/10 bg-black/20 text-slate-200";
}

function formatIndicatorValue(value: number | null, digits = 2, suffix = "") {
  if (value === null || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString("ko-KR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })}${suffix}`;
}

function conditionLabel(value: string) {
  if (value === "overbought") return "과열권";
  if (value === "oversold") return "침체권";
  if (value === "rising") return "상승 모멘텀";
  if (value === "falling") return "하락 모멘텀";
  if (value === "expanded") return "변동성 확대";
  if (value === "compressed") return "변동성 축소";
  if (value === "high") return "거래량 증가";
  if (value === "low") return "거래량 둔화";
  if (value === "upper") return "상단권";
  if (value === "middle") return "중단권";
  if (value === "lower") return "하단권";
  if (value === "outsideUpper") return "상단 이탈";
  if (value === "outsideLower") return "하단 이탈";
  if (value === "normal") return "보통";
  return "데이터 부족";
}

function conditionTone(value: string) {
  if (value === "rising" || value === "lower" || value === "outsideLower") {
    return "border-signal-success/25 bg-signal-success/10 text-signal-success";
  }
  if (value === "falling" || value === "overbought" || value === "expanded" || value === "upper" || value === "outsideUpper") {
    return "border-signal-warning/25 bg-signal-warning/10 text-signal-warning";
  }
  if (value === "oversold" || value === "low" || value === "compressed" || value === "high") {
    return "border-accent-blue/25 bg-accent-blue/10 text-accent-blue";
  }
  return "border-white/10 bg-black/20 text-slate-300";
}

function aiStateLabel(value?: string | null) {
  if (value === "bullish") return "상승";
  if (value === "bearish") return "하락";
  if (value === "neutral") return "횡보";
  if (value === "above") return "위";
  if (value === "below") return "아래";
  if (value === "near") return "근처";
  if (value === "long") return "롱";
  if (value === "short") return "숏";
  if (value === "premium") return "프리미엄";
  if (value === "discount") return "디스카운트";
  if (value === "equilibrium") return "중간";
  if (value === "none") return "없음";
  return "데이터 부족";
}

function aiConditionLabel(value?: string | null) {
  if (value === "overbought") return "과열권";
  if (value === "oversold") return "침체권";
  if (value === "rising") return "상승 모멘텀";
  if (value === "falling") return "하락 모멘텀";
  if (value === "expanded") return "변동성 확대";
  if (value === "compressed") return "변동성 축소";
  if (value === "high") return "거래량 증가";
  if (value === "low") return "거래량 약화";
  if (value === "upper") return "상단권";
  if (value === "middle") return "중단권";
  if (value === "lower") return "하단권";
  if (value === "outsideUpper") return "상단 이탈";
  if (value === "outsideLower") return "하단 이탈";
  if (value === "normal") return "보통";
  return "데이터 부족";
}

function formatPriceRange(low: number, high: number) {
  return `${formatPrice(low)} - ${formatPrice(high)}`;
}

function planQualityClasses(quality?: string) {
  if (quality === "A") return "border-signal-success/30 bg-signal-success/10 text-signal-success";
  if (quality === "B") return "border-accent-blue/30 bg-accent-blue/10 text-accent-blue";
  return "border-signal-warning/30 bg-signal-warning/10 text-signal-warning";
}

function compareNumber(webValue: number | null, pineValue: number | null | undefined, tolerancePct = 0.0005) {
  if (webValue === null || pineValue === null || pineValue === undefined || !Number.isFinite(Number(pineValue))) {
    return { result: "대기", matched: false };
  }

  const diff = Math.abs(webValue - Number(pineValue));
  const tolerance = Math.max(Math.abs(webValue) * tolerancePct, 1e-8);
  return {
    result: diff <= tolerance ? "일치" : `차이 ${formatPrice(diff)}`,
    matched: diff <= tolerance
  };
}

function compareOptionalValue(webValue: string, pineValue: string | undefined) {
  if (!pineValue) {
    return { result: "대기", matched: false };
  }

  return {
    result: webValue === pineValue ? "일치" : "차이",
    matched: webValue === pineValue
  };
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-surface-line bg-surface-cardSoft p-3">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function SignalMetric({
  label,
  value,
  direction,
  isActive
}: {
  label: string;
  value: string;
  direction?: DirectionState | "neutral";
  isActive?: boolean;
}) {
  const tone =
    direction === "bullish"
      ? "border-signal-success/30 bg-signal-success/10 text-signal-success"
      : direction === "bearish"
        ? "border-signal-danger/30 bg-signal-danger/10 text-signal-danger"
        : "border-accent-blue/20 bg-accent-blue/5 text-slate-200";

  return (
    <div className={`rounded-md border p-3 ${tone}`}>
      <p className="text-xs font-semibold opacity-80">{label}</p>
      <p className="mt-1 text-sm font-black">{value}</p>
      {isActive ? <p className="mt-1 text-[11px] font-bold opacity-80">현재가 내부</p> : null}
    </div>
  );
}

const timeframeMinutes: Record<ChartTimeframe, number> = {
  "5m": 5,
  "15m": 15,
  "1h": 60,
  "4h": 240,
  "1d": 1440
};

function barsAgoLabel(age: number, timeframe: ChartTimeframe = "15m") {
  if (age <= 0) return "방금";
  const minutes = age * timeframeMinutes[timeframe];
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 1440) {
    const hours = minutes / 60;
    return Number.isInteger(hours) ? `${hours}시간 전` : `${hours.toFixed(1)}시간 전`;
  }
  const days = minutes / 1440;
  return Number.isInteger(days) ? `${days}일 전` : `${days.toFixed(1)}일 전`;
}

function eventDirectionLabel(direction: "bullish" | "bearish") {
  return direction === "bullish" ? "상승" : "하락";
}

function parityHint(row: ParityRow) {
  if (row.label.includes("MSB") || row.label.includes("CHoCH")) {
    return "구조 방향 차이는 봉 확정 여부, MSB 종가/윅 기준, ZigZag length를 먼저 맞춰보세요.";
  }

  if (row.label === "h0" || row.label === "h1" || row.label === "l0" || row.label === "l1") {
    return "스윙 포인트 차이는 보통 피벗 확정 시점이나 ZigZag 계산 기준에서 납니다.";
  }

  if (row.label.includes("OB") || row.label.includes("FVG")) {
    return "구간 차이는 origin candle 선택, mitigation 기준, iFVG 전환 기준을 비교해보세요.";
  }

  if (row.label.includes("OTE") || row.label.includes("PD")) {
    return "OTE/PD 차이는 기준 범위가 4H 20봉인지, 지표의 스윙 기준인지 확인이 필요합니다.";
  }

  if (row.label.includes("EMA")) {
    return "EMA 차이는 4H EMA 원본/스무딩 여부와 현재 봉 포함 여부를 확인하면 됩니다.";
  }

  return "해당 항목의 계산 기준과 현재 봉 포함 여부를 먼저 맞춰보세요.";
}

function timeframeSignalSummary(item: TimeframeAnalysis) {
  const parts: string[] = [];
  if (item.inOb && item.latestOb) parts.push(`${item.latestOb.direction === "bullish" ? "상승" : "하락"} OB 내부`);
  if (item.inFvg && item.latestFvg) parts.push(item.latestFvg.state === "ifvg" ? "iFVG 내부" : "FVG 내부");
  if (item.oteZone !== "none") parts.push(`${item.oteZone === "long" ? "롱" : "숏"} OTE`);
  if (item.latestSweep && item.latestSweep.age <= 8) parts.push(`Sweep ${barsAgoLabel(item.latestSweep.age, item.timeframe)}`);
  if (item.latestCisd && item.latestCisd.age <= 8) parts.push(`CISD ${barsAgoLabel(item.latestCisd.age, item.timeframe)}`);
  return parts.length ? parts.slice(0, 2).join(" / ") : "겹치는 신호 없음";
}

export function LiveMarketChart() {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartApiRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);

  const [symbol, setSymbol] = useState("BTCUSDT.P");
  const [activeTimeframe, setActiveTimeframe] = useState<ChartTimeframe>("15m");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [analysis, setAnalysis] = useState<MarketAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<"confirmed" | "aggressive">("confirmed");
  const [msbMode, setMsbMode] = useState<"close" | "wick">("close");
  const [isUsingCachedData, setIsUsingCachedData] = useState(false);
  const [showAdvancedControls, setShowAdvancedControls] = useState(false);
  const [showDetailedReadout, setShowDetailedReadout] = useState(true);
  const [pineSnapshotInput, setPineSnapshotInput] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [marketBriefing, setMarketBriefing] = useState<MarketBriefingState>({ status: "idle" });
  const [overlaySettings, setOverlaySettings] = useState<OverlaySettings>(defaultOverlaySettings);
  const effectiveTradingMode: TradingMode = activeTimeframe === "5m" || activeTimeframe === "15m" ? "scalp" : "swing";
  const modeTimeframes = chartTimeframes;

  const cacheKey = `${storagePrefix}.marketCache.${symbol}.${activeTimeframe}.${analysisMode}.${msbMode}`;

  useEffect(() => {
    setOverlaySettings(readOverlaySettings());
  }, []);

  useEffect(() => {
    const storedSymbol = readLocalStorageWithLegacy(storageKey("symbol"), legacyStorageKey("symbol"));
    const storedTimeframe = readLocalStorageWithLegacy(storageKey("timeframe"), legacyStorageKey("timeframe")) as ChartTimeframe | null;
    const storedMode = readLocalStorageWithLegacy(storageKey("analysisMode"), legacyStorageKey("analysisMode")) as "confirmed" | "aggressive" | null;
    const storedMsbMode = readLocalStorageWithLegacy(storageKey("msbMode"), legacyStorageKey("msbMode")) as "close" | "wick" | null;

    if (storedSymbol && symbols.includes(storedSymbol)) {
      setSymbol(storedSymbol);
    }
    if (storedTimeframe && chartTimeframes.includes(storedTimeframe)) {
      setActiveTimeframe(storedTimeframe);
    }
    if (storedMode === "confirmed" || storedMode === "aggressive") {
      setAnalysisMode(storedMode);
    }
    if (storedMsbMode === "close" || storedMsbMode === "wick") {
      setMsbMode(storedMsbMode);
    }
  }, []);

  useEffect(() => {
    writeLocalStorage(storageKey("symbol"), legacyStorageKey("symbol"), symbol);
  }, [symbol]);

  useEffect(() => {
    writeLocalStorage(storageKey("timeframe"), legacyStorageKey("timeframe"), activeTimeframe);
  }, [activeTimeframe]);

  useEffect(() => {
    writeLocalStorage(storageKey("analysisMode"), legacyStorageKey("analysisMode"), analysisMode);
  }, [analysisMode]);

  useEffect(() => {
    writeLocalStorage(storageKey("msbMode"), legacyStorageKey("msbMode"), msbMode);
  }, [msbMode]);

  useEffect(() => {
    writeLocalStorage(overlaySettingsStorageKey, legacyOverlaySettingsStorageKey, JSON.stringify(overlaySettings));
  }, [overlaySettings]);

  useEffect(() => {
    const parsed = readMarketCache(cacheKey);
    if (!parsed) return;

    if (!candles.length && parsed.candles.length && !analysis) {
      setCandles(parsed.candles);
      setAnalysis(parsed.analysis);
      setIsUsingCachedData(true);
    }
  }, [analysis, cacheKey, candles.length]);

  const loadMarket = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const candleSets = await Promise.all(
        chartTimeframes.map(async (timeframe) => ({
          timeframe,
          candles: await fetchBinanceCandles(symbol, timeframe, 320)
        }))
      );

      const activeCandles = candleSets.find((item) => item.timeframe === activeTimeframe)?.candles ?? [];
      const fourHourCandles = candleSets.find((item) => item.timeframe === "4h")?.candles ?? [];
      const analyses = candleSets.map((item) => {
        const analysisCandles =
          analysisMode === "confirmed" && item.candles.length > 50 ? item.candles.slice(0, -1) : item.candles;
        const oteAnchorCandles =
          analysisMode === "confirmed" && fourHourCandles.length > 50 ? fourHourCandles.slice(0, -1) : fourHourCandles;

        return analyzeTimeframe(item.timeframe, analysisCandles, {
          oteAnchorCandles,
          useCloseForMsb: msbMode === "close"
        });
      });
      const latestPrice = (analysisMode === "confirmed" && activeCandles.length > 50 ? activeCandles[activeCandles.length - 2] : activeCandles[activeCandles.length - 1])?.close ?? 0;

      setCandles(activeCandles);
      const nextAnalysis = summarizeMarket(symbol, activeTimeframe, analyses, latestPrice, effectiveTradingMode);
      setAnalysis(nextAnalysis);
      setIsUsingCachedData(false);

      if (typeof window !== "undefined") {
        const payload: MarketCachePayload = {
          analysis: nextAnalysis,
          candles: activeCandles
        };
        window.localStorage.setItem(cacheKey, JSON.stringify(payload));
      }
    } catch (loadError) {
      const fallback = readMarketCache(cacheKey);

      if (fallback) {
        setCandles(fallback.candles);
        setAnalysis(fallback.analysis);
        setIsUsingCachedData(true);
        setError("실시간 데이터를 잠시 불러오지 못해 최근 레이더 판독값을 보여주고 있습니다.");
      } else {
        setError(loadError instanceof Error ? loadError.message : "시장 데이터를 불러오지 못했습니다.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [activeTimeframe, analysisMode, cacheKey, effectiveTradingMode, msbMode, symbol]);

  useEffect(() => {
    loadMarket();
    const id = window.setInterval(() => loadMarket(), 30000);
    return () => window.clearInterval(id);
  }, [loadMarket]);

  useEffect(() => {
    if (!chartRef.current || chartApiRef.current) return;

    const chart = createChart(chartRef.current, {
      autoSize: true,
      layout: {
        background: { color: "#11151c" },
        textColor: "#cbd5e1"
      },
      grid: {
        vertLines: { color: "rgba(148, 163, 184, 0.08)" },
        horzLines: { color: "rgba(148, 163, 184, 0.08)" }
      },
      rightPriceScale: {
        borderColor: "rgba(148, 163, 184, 0.18)"
      },
      timeScale: {
        borderColor: "rgba(148, 163, 184, 0.18)",
        timeVisible: true
      },
      crosshair: {
        mode: 1
      }
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#34d399",
      downColor: "#fb4d5f",
      borderUpColor: "#34d399",
      borderDownColor: "#fb4d5f",
      wickUpColor: "#34d399",
      wickDownColor: "#fb4d5f"
    });

    chartApiRef.current = chart;
    candleSeriesRef.current = candleSeries;
    markersRef.current = createSeriesMarkers(candleSeries, []);

    return () => {
      if (candleSeriesRef.current) {
        priceLinesRef.current.forEach((line) => candleSeriesRef.current?.removePriceLine(line));
        priceLinesRef.current = [];
      }
      markersRef.current?.setMarkers([]);
      markersRef.current = null;
      chart.remove();
      chartApiRef.current = null;
      candleSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!candleSeriesRef.current) return;

    candleSeriesRef.current.setData(
      candles.map((candle) => ({
        time: toKstTime(candle.time),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close
      }))
    );

    // 가격 크기에 맞춰 Y축 정밀도 자동 조정 (XRP/DOGE 같은 저가 코인 대응)
    if (candles.length > 0) {
      const lastPrice = candles[candles.length - 1].close;
      const precision =
        lastPrice >= 1000 ? 1 : lastPrice >= 100 ? 2 : lastPrice >= 10 ? 3 : lastPrice >= 1 ? 4 : lastPrice >= 0.01 ? 5 : 6;
      candleSeriesRef.current.applyOptions({
        priceFormat: {
          type: "price",
          precision,
          minMove: Math.pow(10, -precision)
        }
      });
    }

    chartApiRef.current?.timeScale().fitContent();
  }, [candles]);

  const activeAnalysis = useMemo(
    () => analysis?.timeframeAnalyses.find((item) => item.timeframe === activeTimeframe),
    [analysis, activeTimeframe]
  );
  const hasAnyOverlay = useMemo(() => Object.values(overlaySettings).some(Boolean), [overlaySettings]);
  const combinedScoreLimit = useMemo(() => {
    if (!analysis) return null;
    const config = tradingModeConfigs[effectiveTradingMode];
    const weightedTimeframes = new Set<ChartTimeframe>([activeTimeframe, ...config.contextTimeframes]);
    const max = analysis.timeframeAnalyses.reduce((sum, item) => {
      if (!weightedTimeframes.has(item.timeframe)) return sum;
      const weight =
        config.contextTimeframes.includes(item.timeframe) ? 1.35 : item.timeframe === activeTimeframe ? 1.25 : 1;
      return sum + timeframeScoreLimit * weight;
    }, 0);
    return Number(max.toFixed(2));
  }, [activeTimeframe, analysis, effectiveTradingMode]);

  const marketBriefingInput = useMemo<MarketBriefingInput | null>(() => {
    if (!analysis || !activeAnalysis) return null;

    const scenario = analysis.proPlan
      ? {
          title: analysis.proPlan.title,
          reason: analysis.proPlan.reason,
          entry: formatPriceRange(analysis.proPlan.entryLow, analysis.proPlan.entryHigh),
          invalidation: formatPrice(analysis.proPlan.invalidation),
          targets: `${formatPrice(analysis.proPlan.target1)} / ${formatPrice(analysis.proPlan.target2)}`,
          confidence: analysis.proPlan.confidence
        }
      : null;

    return {
      symbol: analysis.symbol,
      activeTimeframe: analysis.activeTimeframe,
      tradingMode: analysis.tradingMode,
      price: analysis.price,
      verdict: analysis.verdict,
      bias: analysis.bias,
      biasScore: analysis.biasScore,
      scoreRange: combinedScoreLimit ? `-${combinedScoreLimit}~+${combinedScoreLimit}` : "계산 중",
      readiness: analysis.readiness,
      summaryLine: analysis.summaryLine,
      actionGuide: analysis.actionGuide,
      currentLocationLabel: analysis.currentLocationLabel,
      killzone: analysis.killzone,
      opportunityFlags: analysis.opportunityFlags.slice(0, 6),
      riskFlags: analysis.riskFlags.slice(0, 6),
      reasons: analysis.reasons.slice(0, 8).map((item) => ({ text: item.text, tone: item.tone })),
      active: {
        timeframe: activeAnalysis.timeframe,
        msb: aiStateLabel(activeAnalysis.msb),
        choch: aiStateLabel(activeAnalysis.choch),
        ob: activeAnalysis.latestOb
          ? `${aiStateLabel(activeAnalysis.latestOb.direction)}${activeAnalysis.inOb ? " 내부" : " 구간 대기"}`
          : "없음",
        fvg: activeAnalysis.latestFvg
          ? `${aiStateLabel(activeAnalysis.latestFvg.direction)} ${activeAnalysis.latestFvg.state === "ifvg" ? "iFVG" : "FVG"}${activeAnalysis.inFvg ? " 내부" : " 구간 대기"}`
          : "없음",
        sweep: activeAnalysis.latestSweep
          ? `${aiStateLabel(activeAnalysis.latestSweep.direction)} ${barsAgoLabel(activeAnalysis.latestSweep.age, activeTimeframe)}`
          : "없음",
        cisd: activeAnalysis.latestCisd
          ? `${aiStateLabel(activeAnalysis.latestCisd.direction)} ${barsAgoLabel(activeAnalysis.latestCisd.age, activeTimeframe)}`
          : "없음",
        pd: aiStateLabel(activeAnalysis.premiumDiscount),
        poc: activeAnalysis.volumeProfile
          ? `${aiStateLabel(activeAnalysis.volumeProfile.position)} ${Math.abs(activeAnalysis.volumeProfile.distancePercent).toFixed(2)}%`
          : "없음",
        rsi: `${formatIndicatorValue(activeAnalysis.condition.rsi14, 1)} ${aiConditionLabel(activeAnalysis.condition.rsiState)}`,
        macd: aiConditionLabel(activeAnalysis.condition.macdState),
        volatility: `${formatIndicatorValue(activeAnalysis.condition.atrPercent, 2, "%")} ${aiConditionLabel(activeAnalysis.condition.volatilityState)}`,
        volume: `${formatIndicatorValue(activeAnalysis.condition.volumeRatio, 2, "x")} ${aiConditionLabel(activeAnalysis.condition.volumeState)}`,
        bollinger: aiConditionLabel(activeAnalysis.condition.bollingerPosition)
      },
      timeframes: analysis.timeframeAnalyses.map((item) => ({
        timeframe: item.timeframe,
        msb: aiStateLabel(item.msb),
        choch: aiStateLabel(item.choch),
        score: item.score,
        summary: timeframeSignalSummary(item)
      })),
      scenario
    };
  }, [activeAnalysis, activeTimeframe, analysis, combinedScoreLimit]);
  const marketBriefingScopeKey = `${symbol}.${activeTimeframe}`;

  useEffect(() => {
    setMarketBriefing({ status: "idle" });
  }, [marketBriefingScopeKey]);

  const loadMarketBriefing = useCallback(async () => {
    if (!marketBriefingInput) return;
    setMarketBriefing({ status: "loading" });

    try {
      const response = await fetch("/api/ai/market-briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(marketBriefingInput)
      });
      const payload = (await response.json().catch(() => ({}))) as {
        briefing?: string;
        model?: string;
        cached?: boolean;
        error?: string;
      };

      if (!response.ok || !payload.briefing) {
        throw new Error(payload.error ?? "AI 종합 피드백을 생성하지 못했습니다.");
      }

      setMarketBriefing({
        status: "ready",
        text: payload.briefing,
        model: payload.model ?? "unknown",
        cached: Boolean(payload.cached)
      });
    } catch (briefingError) {
      setMarketBriefing({
        status: "error",
        message: briefingError instanceof Error ? briefingError.message : "AI 종합 피드백 생성에 실패했습니다."
      });
    }
  }, [marketBriefingInput]);

  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series) return;

    priceLinesRef.current.forEach((line) => series.removePriceLine(line));
    priceLinesRef.current = [];
    markersRef.current?.setMarkers([]);

    if (!activeAnalysis) return;

    const lines: Array<{ price: number | null | undefined; color: string; title: string; style?: LineStyle }> = [];
    const markers: SeriesMarker<Time>[] = [];

    if (overlaySettings.ema200 && activeAnalysis.ema200Value) {
      lines.push({
        price: activeAnalysis.ema200Value,
        color: "#facc15",
        title: `${activeAnalysis.timeframe} EMA200`,
        style: LineStyle.Dotted
      });
    }

    if (overlaySettings.poc && activeAnalysis.volumeProfile) {
      lines.push({
        price: activeAnalysis.volumeProfile.poc,
        color: "#fbbf24",
        title: `${activeAnalysis.timeframe} POC`,
        style: LineStyle.Dashed
      });
    }

    if (overlaySettings.orderBlocks && activeAnalysis.latestOb) {
      const color = activeAnalysis.latestOb.direction === "bullish" ? "#34d399" : "#fb4d5f";
      lines.push(
        { price: activeAnalysis.latestOb.top, color, title: `${activeAnalysis.timeframe} OB 상단` },
        { price: activeAnalysis.latestOb.bottom, color, title: `${activeAnalysis.timeframe} OB 하단` }
      );

      const obTime = candleTimeAt(candles, activeAnalysis.latestOb.originIndex);
      if (obTime) {
        markers.push({
          time: obTime,
          position: activeAnalysis.latestOb.direction === "bullish" ? "belowBar" : "aboveBar",
          color,
          shape: activeAnalysis.latestOb.direction === "bullish" ? "arrowUp" : "arrowDown",
          text: "OB"
        });
      }
    }

    if (overlaySettings.fvgs && activeAnalysis.latestFvg) {
      const color = activeAnalysis.latestFvg.direction === "bullish" ? "#38bdf8" : "#f59e0b";
      lines.push(
        {
          price: activeAnalysis.latestFvg.top,
          color,
          title: `${activeAnalysis.timeframe} ${activeAnalysis.latestFvg.state.toUpperCase()} 상단`,
          style: LineStyle.Dashed
        },
        {
          price: activeAnalysis.latestFvg.bottom,
          color,
          title: `${activeAnalysis.timeframe} ${activeAnalysis.latestFvg.state.toUpperCase()} 하단`,
          style: LineStyle.Dashed
        }
      );

      const fvgTime = candleTimeAt(candles, activeAnalysis.latestFvg.originIndex);
      if (fvgTime) {
        markers.push({
          time: fvgTime,
          position: activeAnalysis.latestFvg.direction === "bullish" ? "belowBar" : "aboveBar",
          color,
          shape: "circle",
          text: activeAnalysis.latestFvg.state === "ifvg" ? "iFVG" : "FVG"
        });
      }
    }

    if (overlaySettings.ote && activeAnalysis.oteLevels) {
      lines.push(
        {
          price: activeAnalysis.oteLevels.longLow,
          color: "#14b8a6",
          title: `${activeAnalysis.timeframe} OTE 롱 하단`,
          style: LineStyle.Dotted
        },
        {
          price: activeAnalysis.oteLevels.longHigh,
          color: "#14b8a6",
          title: `${activeAnalysis.timeframe} OTE 롱 상단`,
          style: LineStyle.Dotted
        },
        {
          price: activeAnalysis.oteLevels.shortLow,
          color: "#a855f7",
          title: `${activeAnalysis.timeframe} OTE 숏 하단`,
          style: LineStyle.Dotted
        },
        {
          price: activeAnalysis.oteLevels.shortHigh,
          color: "#a855f7",
          title: `${activeAnalysis.timeframe} OTE 숏 상단`,
          style: LineStyle.Dotted
        },
        {
          price: activeAnalysis.oteLevels.midpoint,
          color: "#94a3b8",
          title: `${activeAnalysis.timeframe} PD 50%`,
          style: LineStyle.Dashed
        }
      );
    }

    if (overlaySettings.msb && activeAnalysis.latestMsbEvent) {
      const msbTime = candleTimeAt(candles, activeAnalysis.latestMsbEvent.index);
      if (msbTime) {
        markers.push({
          time: msbTime,
          position: activeAnalysis.latestMsbEvent.direction === "bullish" ? "belowBar" : "aboveBar",
          color: activeAnalysis.latestMsbEvent.direction === "bullish" ? "#22c55e" : "#ef4444",
          shape: activeAnalysis.latestMsbEvent.direction === "bullish" ? "arrowUp" : "arrowDown",
          text: "MSB"
        });
      }
    }

    if (overlaySettings.choch && activeAnalysis.latestChochEvent) {
      const chochTime = candleTimeAt(candles, activeAnalysis.latestChochEvent.index);
      if (chochTime) {
        markers.push({
          time: chochTime,
          position: activeAnalysis.latestChochEvent.direction === "bullish" ? "belowBar" : "aboveBar",
          color: activeAnalysis.latestChochEvent.direction === "bullish" ? "#4ade80" : "#f87171",
          shape: "square",
          text: "CH"
        });
      }
    }

    if (overlaySettings.sweep && activeAnalysis.latestSweep) {
      const sweepTime = candleTimeAt(candles, activeAnalysis.latestSweep.index);
      if (sweepTime) {
        markers.push({
          time: sweepTime,
          position: activeAnalysis.latestSweep.direction === "bullish" ? "belowBar" : "aboveBar",
          color: activeAnalysis.latestSweep.direction === "bullish" ? "#60a5fa" : "#fbbf24",
          shape: "circle",
          text: "SWP"
        });
      }
    }

    if (overlaySettings.cisd && activeAnalysis.latestCisd) {
      const cisdTime = candleTimeAt(candles, activeAnalysis.latestCisd.index);
      if (cisdTime) {
        markers.push({
          time: cisdTime,
          position: activeAnalysis.latestCisd.direction === "bullish" ? "belowBar" : "aboveBar",
          color: activeAnalysis.latestCisd.direction === "bullish" ? "#10b981" : "#f97316",
          shape: "square",
          text: "CISD"
        });
      }
    }

    priceLinesRef.current = lines
      .filter((line) => Number.isFinite(line.price) && Number(line.price) > 0)
      .map((line) =>
        series.createPriceLine({
          price: Number(line.price),
          color: line.color,
          lineWidth: 1,
          lineStyle: line.style ?? LineStyle.Solid,
          axisLabelVisible: true,
          title: line.title
        })
      );
    markersRef.current?.setMarkers(markers);
  }, [activeAnalysis, candles, overlaySettings]);

  const mtfFvgMap = useMemo(
    () =>
      analysis?.timeframeAnalyses.filter(
        (item) => item.timeframe === "15m" || item.timeframe === "1h" || item.timeframe === "4h" || item.timeframe === "1d"
      ) ?? [],
    [analysis]
  );

  const fourHourAnalysis = useMemo(
    () => analysis?.timeframeAnalyses.find((item) => item.timeframe === "4h"),
    [analysis]
  );

  const alignmentSummary = useMemo(() => {
    if (!analysis) return null;

    const higher = analysis.timeframeAnalyses.filter((item) => item.timeframe === "4h" || item.timeframe === "1d");
    const fast = analysis.timeframeAnalyses.filter((item) => item.timeframe === "5m" || item.timeframe === "15m");
    const higherBullish = higher.filter((item) => item.msb === "bullish").length;
    const higherBearish = higher.filter((item) => item.msb === "bearish").length;
    const fastBullish = fast.filter((item) => item.msb === "bullish").length;
    const fastBearish = fast.filter((item) => item.msb === "bearish").length;

    return {
      higher:
        higherBullish === higher.length
          ? "상위 구조 롱 정렬"
          : higherBearish === higher.length
            ? "상위 구조 숏 정렬"
            : "상위 구조 혼합",
      fast:
        fastBullish === fast.length
          ? "단기 구조 롱 정렬"
          : fastBearish === fast.length
            ? "단기 구조 숏 정렬"
            : "단기 구조 혼합"
    };
  }, [analysis]);

  const pineSnapshot = useMemo(() => parsePineSnapshot(pineSnapshotInput), [pineSnapshotInput]);

  const parityRows = useMemo<ParityRow[]>(() => {
    if (!activeAnalysis || !pineSnapshot) return [];

    const pineMsbFromSnapshot = pineSnapshot.msb ? pineDirectionForTimeframe(pineSnapshot.msb, activeTimeframe) : "unknown";
    const pineChochFromSnapshot = pineSnapshot.choch
      ? pineDirectionForTimeframe(pineSnapshot.choch, activeTimeframe)
      : "unknown";
    const pineMsb = pineMsbFromSnapshot !== "unknown" ? pineMsbFromSnapshot : normalizePineDirection(pineSnapshot.market);
    const pineChoch = pineChochFromSnapshot !== "unknown" ? pineChochFromSnapshot : normalizePineDirection(pineSnapshot.chochDir);
    const pineLatestFvg = pineSnapshot.latestFvg ??
      (pineSnapshot.fvgDir && pineSnapshot.fvgDir !== "none"
        ? {
            direction: pineSnapshot.fvgDir,
            state: pineSnapshot.fvgIsIfvg ? ("ifvg" as const) : ("fvg" as const),
            top: pineSnapshot.fvgTop,
            bottom: pineSnapshot.fvgBottom
          }
        : null);
    const pineObDirection =
      pineSnapshot.latestOb?.direction && pineSnapshot.latestOb.direction !== "none" ? pineSnapshot.latestOb.direction : undefined;
    const pineCisdDirection =
      pineSnapshot.latestCisd?.direction ?? (pineSnapshot.cisd && pineSnapshot.cisd !== "none" ? normalizePineDirection(pineSnapshot.cisd) : undefined);
    const rows: ParityRow[] = [
      {
        label: "MSB direction",
        web: stateLabel(activeAnalysis.msb),
        pine: stateLabel(pineMsb),
        matched: activeAnalysis.msb === pineMsb,
        result: activeAnalysis.msb === pineMsb ? "일치" : "차이",
        importance: "core"
      },
      {
        label: "CHoCH direction",
        web: stateLabel(activeAnalysis.choch),
        pine: stateLabel(pineChoch),
        matched: activeAnalysis.choch === pineChoch,
        result: activeAnalysis.choch === pineChoch ? "일치" : "차이",
        importance: "core"
      },
      {
        label: "h0",
        web: activeAnalysis.debug.h0 ? formatPrice(activeAnalysis.debug.h0) : "-",
        pine: pineSnapshot.h0 ? formatPrice(Number(pineSnapshot.h0)) : "-",
        ...compareNumber(activeAnalysis.debug.h0, pineSnapshot.h0),
        importance: "major"
      },
      {
        label: "h1",
        web: activeAnalysis.debug.h1 ? formatPrice(activeAnalysis.debug.h1) : "-",
        pine: pineSnapshot.h1 ? formatPrice(Number(pineSnapshot.h1)) : "-",
        ...compareNumber(activeAnalysis.debug.h1, pineSnapshot.h1),
        importance: "major"
      },
      {
        label: "l0",
        web: activeAnalysis.debug.l0 ? formatPrice(activeAnalysis.debug.l0) : "-",
        pine: pineSnapshot.l0 ? formatPrice(Number(pineSnapshot.l0)) : "-",
        ...compareNumber(activeAnalysis.debug.l0, pineSnapshot.l0),
        importance: "major"
      },
      {
        label: "l1",
        web: activeAnalysis.debug.l1 ? formatPrice(activeAnalysis.debug.l1) : "-",
        pine: pineSnapshot.l1 ? formatPrice(Number(pineSnapshot.l1)) : "-",
        ...compareNumber(activeAnalysis.debug.l1, pineSnapshot.l1),
        importance: "major"
      },
      {
        label: "EMA200 side",
        web: stateLabel(activeAnalysis.ema200Side),
        pine: stateLabel(pineSnapshot.ema200Side ?? "unknown"),
        ...compareOptionalValue(activeAnalysis.ema200Side, pineSnapshot.ema200Side),
        importance: "major"
      },
      {
        label: "PD zone",
        web: stateLabel(activeAnalysis.premiumDiscount),
        pine: stateLabel(pineSnapshot.premiumDiscount ?? "unknown"),
        ...compareOptionalValue(activeAnalysis.premiumDiscount, pineSnapshot.premiumDiscount),
        importance: "major"
      },
      {
        label: "OTE zone",
        web: stateLabel(activeAnalysis.oteZone),
        pine: stateLabel(pineSnapshot.oteZone ?? "unknown"),
        ...compareOptionalValue(activeAnalysis.oteZone, pineSnapshot.oteZone),
        importance: "major"
      },
      {
        label: "OB direction",
        web: activeAnalysis.latestOb ? stateLabel(activeAnalysis.latestOb.direction) : "-",
        pine: pineObDirection ? stateLabel(pineObDirection) : "-",
        ...compareOptionalValue(activeAnalysis.latestOb?.direction ?? "", pineObDirection),
        importance: "major"
      },
      {
        label: "OB top",
        web: activeAnalysis.latestOb ? formatPrice(activeAnalysis.latestOb.top) : "-",
        pine: pineSnapshot.latestOb?.top ? formatPrice(Number(pineSnapshot.latestOb.top)) : "-",
        ...compareNumber(activeAnalysis.latestOb?.top ?? null, pineSnapshot.latestOb?.top),
        importance: "minor"
      },
      {
        label: "OB bottom",
        web: activeAnalysis.latestOb ? formatPrice(activeAnalysis.latestOb.bottom) : "-",
        pine: pineSnapshot.latestOb?.bottom ? formatPrice(Number(pineSnapshot.latestOb.bottom)) : "-",
        ...compareNumber(activeAnalysis.latestOb?.bottom ?? null, pineSnapshot.latestOb?.bottom),
        importance: "minor"
      },
      {
        label: "FVG direction",
        web: activeAnalysis.latestFvg ? stateLabel(activeAnalysis.latestFvg.direction) : "-",
        pine: pineLatestFvg?.direction ? stateLabel(pineLatestFvg.direction) : "-",
        ...compareOptionalValue(activeAnalysis.latestFvg?.direction ?? "", pineLatestFvg?.direction),
        importance: "major"
      },
      {
        label: "FVG state",
        web: activeAnalysis.latestFvg?.state?.toUpperCase() ?? "-",
        pine: pineLatestFvg?.state?.toUpperCase() ?? "-",
        ...compareOptionalValue(activeAnalysis.latestFvg?.state ?? "", pineLatestFvg?.state),
        importance: "minor"
      },
      {
        label: "FVG top",
        web: activeAnalysis.latestFvg ? formatPrice(activeAnalysis.latestFvg.top) : "-",
        pine: pineLatestFvg?.top ? formatPrice(Number(pineLatestFvg.top)) : "-",
        ...compareNumber(activeAnalysis.latestFvg?.top ?? null, pineLatestFvg?.top),
        importance: "minor"
      },
      {
        label: "FVG bottom",
        web: activeAnalysis.latestFvg ? formatPrice(activeAnalysis.latestFvg.bottom) : "-",
        pine: pineLatestFvg?.bottom ? formatPrice(Number(pineLatestFvg.bottom)) : "-",
        ...compareNumber(activeAnalysis.latestFvg?.bottom ?? null, pineLatestFvg?.bottom),
        importance: "minor"
      },
      {
        label: "Sweep direction",
        web: activeAnalysis.latestSweep ? stateLabel(activeAnalysis.latestSweep.direction) : "-",
        pine: pineSnapshot.latestSweep?.direction ? stateLabel(pineSnapshot.latestSweep.direction) : "-",
        ...compareOptionalValue(activeAnalysis.latestSweep?.direction ?? "", pineSnapshot.latestSweep?.direction),
        importance: "minor"
      },
      {
        label: "Sweep level",
        web: activeAnalysis.latestSweep ? formatPrice(activeAnalysis.latestSweep.level) : "-",
        pine: pineSnapshot.latestSweep?.level ? formatPrice(Number(pineSnapshot.latestSweep.level)) : "-",
        ...compareNumber(activeAnalysis.latestSweep?.level ?? null, pineSnapshot.latestSweep?.level),
        importance: "minor"
      },
      {
        label: "CISD direction",
        web: activeAnalysis.latestCisd ? stateLabel(activeAnalysis.latestCisd.direction) : "-",
        pine: pineCisdDirection ? stateLabel(pineCisdDirection) : "-",
        ...compareOptionalValue(activeAnalysis.latestCisd?.direction ?? "", pineCisdDirection),
        importance: "minor"
      },
      {
        label: "CISD level",
        web: activeAnalysis.latestCisd ? formatPrice(activeAnalysis.latestCisd.level) : "-",
        pine: pineSnapshot.latestCisd?.level ? formatPrice(Number(pineSnapshot.latestCisd.level)) : "-",
        ...compareNumber(activeAnalysis.latestCisd?.level ?? null, pineSnapshot.latestCisd?.level),
        importance: "minor"
      },
      {
        label: "hiPts count",
        web: String(activeAnalysis.debug.hiCount),
        pine: pineSnapshot.hiCount === undefined ? "-" : String(pineSnapshot.hiCount),
        matched: pineSnapshot.hiCount === activeAnalysis.debug.hiCount,
        result: pineSnapshot.hiCount === activeAnalysis.debug.hiCount ? "일치" : "차이",
        importance: "minor"
      },
      {
        label: "loPts count",
        web: String(activeAnalysis.debug.loCount),
        pine: pineSnapshot.loCount === undefined ? "-" : String(pineSnapshot.loCount),
        matched: pineSnapshot.loCount === activeAnalysis.debug.loCount,
        result: pineSnapshot.loCount === activeAnalysis.debug.loCount ? "일치" : "차이",
        importance: "minor"
      }
    ];

    return rows.filter((row) => row.web !== "-" || row.pine !== "-");
  }, [activeAnalysis, activeTimeframe, pineSnapshot]);

  const parityScore = useMemo(() => {
    if (!parityRows.length) return null;
    const weighted = parityRows.reduce(
      (acc, row) => {
        const weight = row.importance === "core" ? 3 : row.importance === "major" ? 2 : 1;
        return {
          total: acc.total + weight,
          matched: acc.matched + (row.matched ? weight : 0)
        };
      },
      { total: 0, matched: 0 }
    );
    return Math.round((weighted.matched / weighted.total) * 100);
  }, [parityRows]);

  const parityMismatches = useMemo(() => parityRows.filter((row) => !row.matched), [parityRows]);

  const groupedReasons = useMemo(() => {
    if (!analysis) {
      return {
        bullish: [] as AnalysisReason[],
        bearish: [] as AnalysisReason[],
        neutral: [] as AnalysisReason[]
      };
    }

    return {
      bullish: analysis.reasons.filter((reason) => reason.tone === "bullish"),
      bearish: analysis.reasons.filter((reason) => reason.tone === "bearish"),
      neutral: analysis.reasons.filter((reason) => reason.tone === "neutral")
    };
  }, [analysis]);

  function toggleOverlay(key: keyof OverlaySettings) {
    setOverlaySettings((current) => ({
      ...current,
      [key]: !current[key]
    }));
  }

  function applyOverlayPreset(preset: keyof typeof overlayPresets) {
    setOverlaySettings(overlayPresets[preset]);
  }

  function comparableSnapshotFromWeb() {
    if (!activeAnalysis) return null;

    return {
      symbol,
      timeframe: activeTimeframe,
      market: activeAnalysis.debug.market,
      chochDir: activeAnalysis.debug.choch,
      msb: activeAnalysis.msb,
      choch: activeAnalysis.choch,
      ema200Side: activeAnalysis.ema200Side,
      volumeProfile: activeAnalysis.volumeProfile,
      premiumDiscount: activeAnalysis.premiumDiscount,
      oteZone: activeAnalysis.oteZone,
      h0: activeAnalysis.debug.h0,
      h1: activeAnalysis.debug.h1,
      l0: activeAnalysis.debug.l0,
      l1: activeAnalysis.debug.l1,
      hiCount: activeAnalysis.debug.hiCount,
      loCount: activeAnalysis.debug.loCount,
      latestOb: activeAnalysis.latestOb
        ? {
            direction: activeAnalysis.latestOb.direction,
            top: activeAnalysis.latestOb.top,
            bottom: activeAnalysis.latestOb.bottom
          }
        : null,
      latestFvg: activeAnalysis.latestFvg
        ? {
            direction: activeAnalysis.latestFvg.direction,
            state: activeAnalysis.latestFvg.state,
            top: activeAnalysis.latestFvg.top,
            bottom: activeAnalysis.latestFvg.bottom
          }
        : null,
      latestSweep: activeAnalysis.latestSweep
        ? {
            direction: activeAnalysis.latestSweep.direction,
            level: activeAnalysis.latestSweep.level,
            age: activeAnalysis.latestSweep.age
          }
        : null,
      latestCisd: activeAnalysis.latestCisd
        ? {
            direction: activeAnalysis.latestCisd.direction,
            level: activeAnalysis.latestCisd.level,
            age: activeAnalysis.latestCisd.age
          }
        : null
    };
  }

  function fillParityTemplateFromWeb() {
    const snapshot = comparableSnapshotFromWeb();
    if (!snapshot) return;
    setPineSnapshotInput(JSON.stringify(snapshot, null, 2));
  }

  async function copyDebugSnapshot() {
    if (!activeAnalysis) return;

    const snapshot = {
      symbol,
      timeframe: activeTimeframe,
      price: analysis?.price ?? null,
      bias: analysis?.bias ?? null,
      readiness: analysis?.readiness ?? null,
      killzone: analysis?.killzone ?? null,
      msb: activeAnalysis.msb,
      choch: activeAnalysis.choch,
      score: activeAnalysis.score,
      h0: activeAnalysis.debug.h0,
      h1: activeAnalysis.debug.h1,
      l0: activeAnalysis.debug.l0,
      l1: activeAnalysis.debug.l1,
      market: activeAnalysis.debug.market,
      chochDir: activeAnalysis.debug.choch,
      hiCount: activeAnalysis.debug.hiCount,
      loCount: activeAnalysis.debug.loCount,
      latestOb: activeAnalysis.latestOb,
      latestBb: activeAnalysis.latestBb,
      latestFvg: activeAnalysis.latestFvg,
      latestSweep: activeAnalysis.latestSweep,
      latestCisd: activeAnalysis.latestCisd,
      volumeProfile: activeAnalysis.volumeProfile,
      condition: activeAnalysis.condition,
      overlaySettings,
      currentLocationLabel: analysis?.currentLocationLabel ?? null,
      msbMode,
      longScenario: analysis?.longScenario ?? null,
      shortScenario: analysis?.shortScenario ?? null,
      opportunityFlags: analysis?.opportunityFlags ?? [],
      riskFlags: analysis?.riskFlags ?? [],
      updatedAt: analysis?.updatedAt ?? null
    };

    await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function saveAnalysisToJournal() {
    if (!analysis || !activeAnalysis) return;

    const noteParts = [
      `판정: ${analysis.verdict}`,
      `행동 가이드: ${analysis.actionGuide}`,
      `현재 위치: ${analysis.currentLocationLabel}`,
      `상위 구조: ${alignmentSummary?.higher ?? "-"}`,
      `단기 구조: ${alignmentSummary?.fast ?? "-"}`,
      `MSB/CHoCH: ${stateLabel(activeAnalysis.msb)} / ${stateLabel(activeAnalysis.choch)}`,
      `POC: ${
        activeAnalysis.volumeProfile
          ? `${formatPrice(activeAnalysis.volumeProfile.poc)} / ${stateLabel(activeAnalysis.volumeProfile.position)}`
          : "-"
      }`,
      `시장 환경: RSI ${formatIndicatorValue(activeAnalysis.condition.rsi14, 1)} (${conditionLabel(activeAnalysis.condition.rsiState)}) / MACD ${conditionLabel(
        activeAnalysis.condition.macdState
      )} / ATR ${formatIndicatorValue(activeAnalysis.condition.atrPercent, 2, "%")} (${conditionLabel(activeAnalysis.condition.volatilityState)})`,
      `체크포인트:`,
      ...analysis.checkpoints.map((item) => `- ${item}`),
      `위험 신호:`,
      ...(analysis.riskFlags.length ? analysis.riskFlags.map((item) => `- ${item}`) : ["- 없음"]),
      `기회 신호:`,
      ...(analysis.opportunityFlags.length ? analysis.opportunityFlags.map((item) => `- ${item}`) : ["- 없음"])
    ];

    const payload = {
      title: `${symbol} ${activeTimeframe} 레이더 저장`,
      bias: analysis.bias === "long" ? "롱" : analysis.bias === "short" ? "숏" : "관찰",
      note: noteParts.join("\n"),
      source: "chart",
      symbol,
      timeframe: activeTimeframe,
      verdict: analysis.verdict
    } as const;

    const session = getSupabaseSession();
    if (session) {
      try {
        await createRemoteJournalEntry(session.accessToken, payload);
        setSavedMessage("현재 레이더 판독을 서버 복기에 저장했습니다.");
        window.setTimeout(() => setSavedMessage(""), 1800);
        return;
      } catch {
        setSavedMessage("서버 저장에 실패해 이 브라우저 복기에 저장했습니다.");
      }
    }

    appendJournalEntry(payload);

    if (!session) setSavedMessage("현재 레이더 판독을 복기에 저장했습니다.");
    window.setTimeout(() => setSavedMessage(""), 1800);
  }

  return (
    <section className="rounded-lg border border-surface-line bg-surface-card p-4 shadow-glow sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-accent-blue/25 bg-accent-blue/10 text-accent-blue">
            <BarChart3 size={21} aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">차트 레이더</h2>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              방향보다 먼저, 지금 자리가 위험한지 구조와 구간을 점검합니다.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => loadMarket()}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-surface-line bg-surface-cardSoft px-3 text-sm font-bold text-slate-300 hover:border-accent-blue/60 hover:text-white"
        >
          <RefreshCcw size={16} className={isLoading ? "animate-spin" : ""} aria-hidden />
          새로고침
        </button>
      </div>

      <div className="mt-4 rounded-lg border border-accent-blue/20 bg-accent-blue/10 p-4">
        <p className="text-xs font-semibold text-accent-blue">베타 안내</p>
        <p className="mt-1 text-sm leading-6 text-slate-300">
          현재 베타버전은 코인 데이터를 우선 분석합니다. 추후 해외선물까지 확대할 계획이며, 판독 중심은 ICT 구조에 보조 필터를 더한 분석입니다.
        </p>
        <p className="mt-2 text-xs leading-5 text-slate-400">
          베타 기간에는 모든 판독 기능을 공개합니다. 복기와 저장 데이터는 정식 서비스 전환 과정에서 보존되지 않을 수 있습니다.
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,220px)_1fr]">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
          {symbols.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setSymbol(item)}
              className={`min-h-10 rounded-md border px-3 text-sm font-bold transition ${
                symbol === item
                  ? "border-accent-blue bg-accent-blue text-slate-950"
                  : "border-surface-line bg-surface-cardSoft text-slate-300 hover:border-accent-blue/60"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="grid gap-2">
          <div className="grid grid-cols-5 gap-2">
          {modeTimeframes.map((timeframe) => (
            <button
              key={timeframe}
              type="button"
              onClick={() => setActiveTimeframe(timeframe)}
              className={`min-h-10 rounded-md border px-2 text-sm font-bold transition ${
                activeTimeframe === timeframe
                  ? "border-accent-blue bg-accent-blue text-slate-950"
                  : "border-surface-line bg-surface-cardSoft text-slate-300 hover:border-accent-blue/60"
              }`}
            >
              {timeframe}
            </button>
          ))}
          </div>
        </div>
      </div>

      {analysis ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className={`rounded-lg border p-4 shadow-[0_0_30px_rgba(56,189,248,0.08)] ${biasClasses(analysis.bias)}`}>
            <p className="text-xs font-semibold opacity-75">오늘 방향</p>
            <p className="mt-2 text-xl font-black">{analysis.verdict}</p>
          </div>
          <div className={`rounded-lg border p-4 ${decisionTone(userFacingRiskLabel(analysis))}`}>
            <p className="text-xs font-semibold opacity-75">자리 위험도</p>
            <p className="mt-2 text-xl font-black">{userFacingRiskLabel(analysis)}</p>
          </div>
          <div className={`rounded-lg border p-4 ${decisionTone(userFacingNextStep(analysis))}`}>
            <p className="text-xs font-semibold opacity-75">다음 행동</p>
            <p className="mt-2 text-xl font-black">{userFacingNextStep(analysis)}</p>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {["오늘 방향", "자리 위험도", "다음 행동"].map((item) => (
            <div key={item} className="min-h-24 animate-pulse rounded-lg border border-surface-line bg-surface-cardSoft p-4">
              <p className="text-xs font-semibold text-slate-500">{item}</p>
              <div className="mt-3 h-5 w-24 rounded bg-white/10" />
            </div>
          ))}
        </div>
      )}

      <div className="mt-3">
        <button
          type="button"
          onClick={() => setShowAdvancedControls((value) => !value)}
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-surface-line bg-surface-cardSoft px-3 text-sm font-bold text-slate-300 hover:border-accent-blue/60 hover:text-white"
        >
          <Settings2 size={16} aria-hidden />
          판독 성향 {showAdvancedControls ? "접기" : "열기"}
        </button>
      </div>

      {showAdvancedControls ? (
        <div className="mt-3 grid gap-3 rounded-lg border border-surface-line bg-surface-cardSoft p-3 sm:grid-cols-2">
          <div className="rounded-md border border-accent-blue/20 bg-accent-blue/5 p-3 text-xs leading-5 text-slate-300 sm:col-span-2">
            안정형은 실전 판단용 기본값이고, 빠른 감지형과 윅 기준은 차트 미리보기용입니다.
                          차트 레이더 후보는 무리한 감지를 줄이기 위해 닫힌 봉 + MSB 종가 기준으로 별도 고정합니다.
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAnalysisMode("confirmed")}
              className={`min-h-10 rounded-md border px-3 text-sm font-bold transition ${
                analysisMode === "confirmed"
                  ? "border-accent-blue bg-accent-blue text-slate-950"
                  : "border-surface-line bg-black/20 text-slate-300 hover:border-accent-blue/60"
              }`}
            >
              안정형
              <span className="mt-0.5 block text-[10px] font-semibold opacity-70">닫힌 봉</span>
            </button>
            <button
              type="button"
              onClick={() => setAnalysisMode("aggressive")}
              className={`min-h-10 rounded-md border px-3 text-sm font-bold transition ${
                analysisMode === "aggressive"
                  ? "border-accent-blue bg-accent-blue text-slate-950"
                  : "border-surface-line bg-black/20 text-slate-300 hover:border-accent-blue/60"
              }`}
            >
              빠른 감지형
              <span className="mt-0.5 block text-[10px] font-semibold opacity-70">진행 중 봉</span>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMsbMode("close")}
              className={`min-h-10 rounded-md border px-3 text-sm font-bold transition ${
                msbMode === "close"
                  ? "border-accent-blue bg-accent-blue text-slate-950"
                  : "border-surface-line bg-black/20 text-slate-300 hover:border-accent-blue/60"
              }`}
            >
              MSB 종가 확정
            </button>
            <button
              type="button"
              onClick={() => setMsbMode("wick")}
              className={`min-h-10 rounded-md border px-3 text-sm font-bold transition ${
                msbMode === "wick"
                  ? "border-accent-blue bg-accent-blue text-slate-950"
                  : "border-surface-line bg-black/20 text-slate-300 hover:border-accent-blue/60"
              }`}
            >
              MSB 윅 감지
            </button>
          </div>
          <div className="rounded-md border border-white/10 bg-black/20 p-3 sm:col-span-2">
            <p className="text-xs font-semibold text-slate-400">차트 오버레이</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => applyOverlayPreset("all")}
                className="min-h-9 rounded-md border border-accent-blue/30 bg-accent-blue/10 px-3 text-xs font-bold text-accent-blue hover:bg-accent-blue/20"
              >
                전체
              </button>
              <button
                type="button"
                onClick={() => applyOverlayPreset("structure")}
                className="min-h-9 rounded-md border border-white/10 bg-black/20 px-3 text-xs font-bold text-slate-300 hover:border-accent-blue/40"
              >
                구조 집중
              </button>
              <button
                type="button"
                onClick={() => applyOverlayPreset("zones")}
                className="min-h-9 rounded-md border border-white/10 bg-black/20 px-3 text-xs font-bold text-slate-300 hover:border-accent-blue/40"
              >
                구간 집중
              </button>
              <button
                type="button"
                onClick={() => applyOverlayPreset("minimal")}
                className="min-h-9 rounded-md border border-white/10 bg-black/20 px-3 text-xs font-bold text-slate-300 hover:border-accent-blue/40"
              >
                미니멀
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["ema200", "EMA200"],
                ["poc", "POC"],
                ["orderBlocks", "OB / BB"],
                ["fvgs", "FVG / iFVG"],
                ["ote", "OTE / PD"],
                ["msb", "MSB"],
                ["choch", "CHoCH"],
                ["sweep", "Sweep"],
                ["cisd", "CISD"]
              ].map(([key, label]) => {
                const settingKey = key as keyof OverlaySettings;
                const enabled = overlaySettings[settingKey];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleOverlay(settingKey)}
                    className={`min-h-10 rounded-md border px-3 text-xs font-bold transition ${
                      enabled
                        ? "border-accent-blue bg-accent-blue/15 text-accent-blue"
                        : "border-surface-line bg-black/20 text-slate-400 hover:border-accent-blue/40"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4">
        <div className="overflow-hidden rounded-lg border border-surface-line bg-surface-cardSoft">
          <div className="flex items-center justify-between border-b border-surface-line px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-slate-500">현재가</p>
              <p className="text-lg font-black text-white">{analysis ? formatPrice(analysis.price) : "-"}</p>
            </div>
            {analysis ? (
              <span className={`rounded-md border px-3 py-1.5 text-sm font-black ${biasClasses(analysis.bias)}`}>
                {analysis.verdict}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 border-b border-surface-line px-4 py-2 text-xs text-slate-400">
            <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1">
              {isUsingCachedData ? "최근 저장본" : "실시간 판독"}
            </span>
            <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1">
              자동 새로고침 30초
            </span>
            {analysis?.updatedAt ? (
              <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1">
                갱신 {formatUpdatedAt(analysis.updatedAt)}
              </span>
            ) : null}
          </div>
          {activeAnalysis && hasAnyOverlay ? (
            <div className="border-b border-surface-line bg-black/20 px-4 py-2 text-xs leading-5 text-slate-400">
              표시 중:{" "}
              {[
                overlaySettings.ema200 ? "EMA200" : null,
                overlaySettings.poc ? "POC" : null,
                overlaySettings.orderBlocks ? "OB/BB" : null,
                overlaySettings.fvgs ? "FVG/iFVG" : null,
                overlaySettings.ote ? "OTE/PD" : null,
                overlaySettings.msb ? "MSB" : null,
                overlaySettings.choch ? "CHoCH" : null,
                overlaySettings.sweep ? "Sweep" : null,
                overlaySettings.cisd ? "CISD" : null
              ]
                .filter(Boolean)
                .join(", ")}
            </div>
          ) : null}
          <div className="relative">
            <div ref={chartRef} className="h-[420px] w-full sm:h-[520px]" />
            {isLoading && !analysis ? (
              <div className="absolute inset-0 flex items-center justify-center bg-surface-cardSoft/85 backdrop-blur-sm">
                <div className="rounded-md border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold text-slate-200">
                  <span className="radar-scan-line inline-flex rounded-md px-1">레이더가 차트 구조를 감지하는 중입니다.</span>
                </div>
              </div>
            ) : null}
          </div>
          {activeAnalysis ? (
            <div className="border-t border-surface-line bg-black/20 px-4 py-3">
              <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-slate-300">
                <span className="rounded-md border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-emerald-300">OB</span>
                <span className="rounded-md border border-sky-400/20 bg-sky-400/10 px-2 py-1 text-sky-300">FVG / iFVG</span>
                <span className="rounded-md border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-amber-300">POC</span>
                <span className="rounded-md border border-teal-400/20 bg-teal-400/10 px-2 py-1 text-teal-300">OTE 롱</span>
                <span className="rounded-md border border-violet-400/20 bg-violet-400/10 px-2 py-1 text-violet-300">OTE 숏</span>
                <span className="rounded-md border border-slate-400/20 bg-slate-400/10 px-2 py-1 text-slate-300">PD 50%</span>
                <span className="rounded-md border border-green-500/20 bg-green-500/10 px-2 py-1 text-green-300">MSB</span>
                <span className="rounded-md border border-rose-400/20 bg-rose-400/10 px-2 py-1 text-rose-300">CHoCH</span>
                <span className="rounded-md border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-amber-300">Sweep</span>
                <span className="rounded-md border border-orange-400/20 bg-orange-400/10 px-2 py-1 text-orange-300">CISD</span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          {error ? (
            <div className="flex items-start gap-2 rounded-md border border-signal-danger/30 bg-signal-danger/10 p-3 text-sm leading-6 text-signal-danger">
              <AlertTriangle className="mt-0.5 shrink-0" size={16} aria-hidden />
              {error}
            </div>
          ) : null}

          <div className={`rounded-lg border p-4 ${biasClasses(analysis?.bias)}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold opacity-80">레이더 판독</p>
                <h3 className="mt-1 text-2xl font-black">{analysis?.verdict ?? "레이더 대기 중"}</h3>
              </div>
              <Activity size={26} aria-hidden />
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              {analysis
                ? `종합 점수 ${analysis.biasScore}${combinedScoreLimit ? ` / -${combinedScoreLimit}~+${combinedScoreLimit}` : ""}. ${analysis.summaryLine}`
                : "캔들 데이터를 불러오고 있습니다."}
            </p>
            {analysis ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className={`rounded-md border px-3 py-3 ${readinessClasses(analysis.readiness)}`}>
                  <span className="block text-xs font-semibold opacity-80">판독 상태</span>
                  <span className="mt-1 block text-lg font-black">{readinessLabel(analysis.readiness)}</span>
                </div>
                <div className="rounded-md border border-white/10 bg-black/15 p-3 text-sm leading-6 text-slate-100">
                  <span className="block text-xs font-semibold text-slate-400">행동 가이드</span>
                  <span className="mt-1 block">{analysis.actionGuide}</span>
                </div>
              </div>
            ) : null}
            {analysis ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <Link
                  href="/diagnosis"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent-blue px-3 text-sm font-extrabold text-slate-950 hover:bg-sky-300"
                >
                  <ClipboardCheck size={16} aria-hidden />
                  매매 전 체크
                </Link>
                <Link
                  href="/calculator"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/10 bg-black/20 px-3 text-sm font-bold text-slate-200 hover:border-accent-blue/60"
                >
                  <Calculator size={16} aria-hidden />
                  손절 수량 계산
                </Link>
                <button
                  type="button"
                  onClick={saveAnalysisToJournal}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/10 bg-black/20 px-3 text-sm font-bold text-slate-200 hover:border-accent-blue/60 hover:text-white"
                >
                  <History size={16} aria-hidden />
                  레이더 저장
                </button>
              </div>
            ) : null}
            {savedMessage ? (
              <p className="mt-3 rounded-md border border-signal-success/25 bg-signal-success/10 px-3 py-2 text-sm text-signal-success">
                {savedMessage}
              </p>
            ) : null}
          </div>

          {analysis && activeAnalysis ? (
            <div className="rounded-lg border border-accent-blue/25 bg-surface-cardSoft p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-accent-blue">AI 레이더 브리핑</p>
                  <h3 className="mt-1 text-lg font-black text-white">감지된 구조 전체를 긴 문장으로 종합합니다</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    선택 코인의 MSB, CHoCH, OB, FVG, Sweep, CISD, PD, POC와 보조지표를 함께 읽어 시장 해석을 정리합니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadMarketBriefing}
                  disabled={marketBriefing.status === "loading"}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-accent-blue px-4 text-sm font-extrabold text-slate-950 hover:bg-sky-300 disabled:cursor-wait disabled:opacity-70"
                >
                  <Bot size={16} aria-hidden />
                  {marketBriefing.status === "loading" ? "레이더 분석 중" : marketBriefing.status === "ready" ? "다시 돌리기" : "레이더 브리핑 생성"}
                </button>
              </div>

              {marketBriefing.status === "loading" ? (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-sm">
                  <div className="w-full max-w-sm rounded-2xl border border-accent-blue/25 bg-slate-950/95 p-6 text-center shadow-[0_0_90px_rgba(56,189,248,0.22)]">
                    <div className="radar-mark-lg mx-auto h-36 w-36 border border-accent-blue/30" />
                    <p className="mt-5 text-base font-black text-white">AI 레이더 스캔 중</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      MSB, CHoCH, OB, FVG, Sweep, CISD, PD, POC와 보조지표를 한 번에 훑고 있습니다.
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-4">
                {marketBriefing.status === "idle" ? (
                  <p className="text-sm leading-6 text-slate-400">
                    버튼을 누르면 현재 화면의 모든 레이더 감지값을 기반으로 긴 문장형 브리핑을 생성합니다. 이 내용은 매수·매도 신호가 아니라 구조 해석과 리스크 점검용입니다.
                  </p>
                ) : null}
                {marketBriefing.status === "ready" ? (
                  <>
                    <div className="mb-4 grid gap-2 sm:grid-cols-3">
                      <div className={`rounded-md border px-3 py-2 ${biasClasses(analysis.bias)}`}>
                        <p className="text-[11px] font-bold opacity-80">방향 결론</p>
                        <p className="mt-1 text-base font-black">
                          {analysis.bias === "long" ? "롱 우세" : analysis.bias === "short" ? "숏 우세" : "횡보 관찰"}
                        </p>
                      </div>
                      <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2">
                        <p className="text-[11px] font-bold text-slate-400">종합 점수</p>
                        <p className="mt-1 text-base font-black text-white">
                          {analysis.biasScore}
                          {combinedScoreLimit ? ` / -${combinedScoreLimit}~+${combinedScoreLimit}` : ""}
                        </p>
                      </div>
                      <div className={`rounded-md border px-3 py-2 ${readinessClasses(analysis.readiness)}`}>
                        <p className="text-[11px] font-bold opacity-80">판독 상태</p>
                        <p className="mt-1 text-base font-black">{readinessLabel(analysis.readiness)}</p>
                      </div>
                    </div>
                    <HighlightedBriefing text={marketBriefing.text} />
                    <p className="mt-3 text-xs text-slate-500">
                      model {marketBriefing.model}
                      {marketBriefing.cached ? " · cached" : ""}
                    </p>
                  </>
                ) : null}
                {marketBriefing.status === "error" ? (
                  <p className="text-sm leading-6 text-signal-danger">{marketBriefing.message}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {analysis && activeAnalysis && activeAnalysis.condition ? (
            <div className="rounded-lg border border-surface-line bg-surface-cardSoft p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-accent-blue">판독 체계</p>
                  <h3 className="mt-1 text-lg font-black text-white">ICT 구조가 중심, 보조지표는 보조 도구로 참고</h3>
                </div>
                <span className="inline-flex w-fit rounded-md border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-bold text-slate-300">
                  {activeTimeframe} 기준
                </span>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-accent-blue/20 bg-black/20 p-4">
                  <p className="text-xs font-bold text-accent-blue">진입 판단의 중심</p>
                  <h4 className="mt-1 text-base font-black text-white">ICT 구조 코어</h4>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <SignalMetric label="MSB" value={stateLabel(activeAnalysis.msb)} direction={activeAnalysis.msb} />
                    <SignalMetric label="CHoCH" value={stateLabel(activeAnalysis.choch)} direction={activeAnalysis.choch} />
                    <SignalMetric
                      label="OB"
                      value={activeAnalysis.latestOb ? stateLabel(activeAnalysis.latestOb.direction) : "없음"}
                      direction={activeAnalysis.latestOb?.direction}
                      isActive={activeAnalysis.inOb}
                    />
                    <SignalMetric
                      label="FVG"
                      value={activeAnalysis.latestFvg ? `${stateLabel(activeAnalysis.latestFvg.direction)} ${activeAnalysis.latestFvg.state === "ifvg" ? "iFVG" : "FVG"}` : "없음"}
                      direction={activeAnalysis.latestFvg?.direction}
                      isActive={activeAnalysis.inFvg}
                    />
                    <SignalMetric
                      label="Sweep"
                      value={activeAnalysis.latestSweep ? `${eventDirectionLabel(activeAnalysis.latestSweep.direction)} · ${barsAgoLabel(activeAnalysis.latestSweep.age, activeTimeframe)}` : "없음"}
                      direction={activeAnalysis.latestSweep?.direction}
                    />
                    <SignalMetric
                      label="CISD"
                      value={activeAnalysis.latestCisd ? `${eventDirectionLabel(activeAnalysis.latestCisd.direction)} · ${barsAgoLabel(activeAnalysis.latestCisd.age, activeTimeframe)}` : "없음"}
                      direction={activeAnalysis.latestCisd?.direction}
                    />
                    <SignalMetric label="PD" value={stateLabel(activeAnalysis.premiumDiscount)} direction="neutral" />
                    <SignalMetric
                      label="POC"
                      value={activeAnalysis.volumeProfile ? `${stateLabel(activeAnalysis.volumeProfile.position)} · ${Math.abs(activeAnalysis.volumeProfile.distancePercent).toFixed(2)}%` : "없음"}
                      direction="neutral"
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <p className="text-xs font-bold text-slate-400">진입 신호가 아닌 보조 도구</p>
                  <h4 className="mt-1 text-base font-black text-white">보조지표 참고값</h4>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className={`rounded-md border p-3 ${conditionTone(activeAnalysis.condition.rsiState)}`}>
                      <p className="text-xs font-semibold opacity-80">RSI 14</p>
                      <p className="mt-1 text-sm font-black">
                        {formatIndicatorValue(activeAnalysis.condition.rsi14, 1)} · {conditionLabel(activeAnalysis.condition.rsiState)}
                      </p>
                    </div>
                    <div className={`rounded-md border p-3 ${conditionTone(activeAnalysis.condition.macdState)}`}>
                      <p className="text-xs font-semibold opacity-80">MACD</p>
                      <p className="mt-1 text-sm font-black">{conditionLabel(activeAnalysis.condition.macdState)}</p>
                    </div>
                    <div className={`rounded-md border p-3 ${conditionTone(activeAnalysis.condition.volatilityState)}`}>
                      <p className="text-xs font-semibold opacity-80">ATR 변동성</p>
                      <p className="mt-1 text-sm font-black">
                        {formatIndicatorValue(activeAnalysis.condition.atrPercent, 2, "%")} · {conditionLabel(activeAnalysis.condition.volatilityState)}
                      </p>
                    </div>
                    <div className={`rounded-md border p-3 ${conditionTone(activeAnalysis.condition.volumeState)}`}>
                      <p className="text-xs font-semibold opacity-80">거래량</p>
                      <p className="mt-1 text-sm font-black">
                        {formatIndicatorValue(activeAnalysis.condition.volumeRatio, 2, "x")} · {conditionLabel(activeAnalysis.condition.volumeState)}
                      </p>
                    </div>
                    <div className={`rounded-md border p-3 sm:col-span-2 ${conditionTone(activeAnalysis.condition.bollingerPosition)}`}>
                      <p className="text-xs font-semibold opacity-80">볼린저 위치</p>
                      <p className="mt-1 text-sm font-black">{conditionLabel(activeAnalysis.condition.bollingerPosition)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <p className="mt-3 rounded-md border border-signal-warning/20 bg-signal-warning/10 px-3 py-2 text-xs leading-5 text-signal-warning">
                RSI·MACD·볼린저·거래량은 매수·매도 근거가 아닙니다. ICT 구조가 먼저 맞은 뒤 과열, 변동성 확대, 추격 위험을 확인하는 보조 도구로 참고하세요.
              </p>
            </div>
          ) : null}

          {analysis ? (
            <div className="rounded-lg border border-surface-line bg-surface-cardSoft p-4">
              <h3 className="text-sm font-bold text-white">지금 볼 구간</h3>
              <div className="mt-3 space-y-2">
                {analysis.checkpoints.map((item) => (
                  <p key={item} className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm leading-6 text-slate-200">
                    {item}
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          {analysis ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-surface-line bg-surface-cardSoft p-4">
                <h3 className="text-sm font-bold text-white">현재 위치 판단</h3>
                <p className="mt-3 rounded-md border border-white/10 bg-black/20 px-3 py-3 text-sm font-semibold text-slate-100">
                  {analysis.currentLocationLabel}
                </p>
              </div>
              <div className="rounded-lg border border-surface-line bg-surface-cardSoft p-4">
                <h3 className="text-sm font-bold text-white">현재 결론</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  지금은 {analysis.verdict} 쪽입니다. 다만 실제 진입은 현재 위치, 리스크 기준, 포지션 크기를 같이 확인해야 합니다.
                </p>
              </div>
            </div>
          ) : null}

          {analysis?.proPlan ? (
            <div className="rounded-lg border border-accent-blue/30 bg-accent-blue/10 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold text-accent-blue">분석 시나리오</p>
                  <h3 className="mt-1 text-lg font-black text-white">{analysis.proPlan.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{analysis.proPlan.reason}</p>
                  <p className="mt-2 rounded-md border border-signal-warning/25 bg-signal-warning/10 px-3 py-2 text-xs leading-5 text-signal-warning">
                    아래 가격대는 자동 진입 신호가 아니라 구조 분석용 참고값입니다. 고배율은 별도 손절 수량 계산 후 판단하세요.
                  </p>
                </div>
                <span className={`inline-flex shrink-0 rounded-md border px-3 py-1.5 text-sm font-black ${planQualityClasses(analysis.proPlan.quality)}`}>
                  {analysis.proPlan.quality}급 · 검토 {analysis.proPlan.confidence}%
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <MiniMetric label="관찰 구간" value={formatPriceRange(analysis.proPlan.entryLow, analysis.proPlan.entryHigh)} />
                <MiniMetric label="리스크 기준" value={formatPrice(analysis.proPlan.invalidation)} />
                <MiniMetric label="참고 목표 1" value={`${formatPrice(analysis.proPlan.target1)} / ${analysis.proPlan.rr1.toFixed(1)}R`} />
                <MiniMetric label="참고 목표 2" value={`${formatPrice(analysis.proPlan.target2)} / ${analysis.proPlan.rr2.toFixed(1)}R`} />
              </div>
              <div className="mt-3 space-y-2">
                {analysis.proPlan.cautions.slice(0, 3).map((item) => (
                  <p key={item} className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs leading-5 text-slate-300">
                    {item}
                  </p>
                ))}
              </div>
            </div>
          ) : analysis ? (
            <div className="rounded-lg border border-signal-warning/25 bg-signal-warning/10 p-4">
              <p className="text-sm font-bold text-signal-warning">분석 시나리오 대기</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                지금은 방향 우세가 충분히 또렷하지 않아 관찰 구간과 리스크 기준을 계산하지 않았습니다. 이 상태에서 억지로 자리를 만들지 않는 것이 더 좋은 판독입니다.
              </p>
            </div>
          ) : null}

          {analysis ? (
            <button
              type="button"
              onClick={() => setShowDetailedReadout((value) => !value)}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-surface-line bg-black/20 px-3 text-sm font-bold text-slate-200 hover:border-accent-blue/60 hover:text-white"
            >
              상세 판독 {showDetailedReadout ? "접기" : "펼치기"}
            </button>
          ) : null}

          {showDetailedReadout ? (
            <>
          {analysis ? (
            <div className="rounded-lg border border-surface-line bg-surface-cardSoft p-4">
              <h3 className="text-sm font-bold text-white">타임프레임 구조</h3>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {analysis.timeframeAnalyses.map((item) => (
                  <div key={item.timeframe} className="rounded-md border border-surface-line bg-black/20 px-3 py-2 text-center">
                    <p className="text-[11px] font-semibold text-slate-400">{item.timeframe}</p>
                    <div className="mt-2 space-y-2">
                      <div className={`rounded-md border px-2 py-1 text-xs font-bold ${directionBadge(item.msb)}`}>
                        MSB {stateLabel(item.msb)}
                      </div>
                      <div className={`rounded-md border px-2 py-1 text-xs font-bold ${directionBadge(item.choch)}`}>
                        CHoCH {stateLabel(item.choch)}
                      </div>
                      <div className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-[11px] font-semibold text-slate-300">
                        점수 {item.score} / -{timeframeScoreLimit}~+{timeframeScoreLimit}
                      </div>
                      <p className="text-[11px] leading-5 text-slate-500">{timeframeSignalSummary(item)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {activeAnalysis ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-surface-line bg-surface-cardSoft p-4">
                <h3 className="text-sm font-bold text-white">현재 TF 이벤트</h3>
                <div className="mt-3 space-y-2">
                  {activeAnalysis.latestMsbEvent ? (
                    <p className="rounded-md border border-emerald-500/20 bg-black/20 px-3 py-2 text-sm leading-6 text-slate-200">
                      MSB {eventDirectionLabel(activeAnalysis.latestMsbEvent.direction)} / {barsAgoLabel(Math.max(0, candles.length - 1 - activeAnalysis.latestMsbEvent.index), activeTimeframe)} / {formatPrice(activeAnalysis.latestMsbEvent.level)}
                    </p>
                  ) : null}
                  {activeAnalysis.latestChochEvent ? (
                    <p className="rounded-md border border-rose-500/20 bg-black/20 px-3 py-2 text-sm leading-6 text-slate-200">
                      CHoCH {eventDirectionLabel(activeAnalysis.latestChochEvent.direction)} / {barsAgoLabel(Math.max(0, candles.length - 1 - activeAnalysis.latestChochEvent.index), activeTimeframe)} / {formatPrice(activeAnalysis.latestChochEvent.level)}
                    </p>
                  ) : null}
                  {activeAnalysis.latestSweep ? (
                    <p className="rounded-md border border-amber-500/20 bg-black/20 px-3 py-2 text-sm leading-6 text-slate-200">
                      Sweep {eventDirectionLabel(activeAnalysis.latestSweep.direction)} / {barsAgoLabel(activeAnalysis.latestSweep.age, activeTimeframe)} / {formatPrice(activeAnalysis.latestSweep.level)}
                    </p>
                  ) : null}
                  {activeAnalysis.latestCisd ? (
                    <p className="rounded-md border border-orange-500/20 bg-black/20 px-3 py-2 text-sm leading-6 text-slate-200">
                      CISD {eventDirectionLabel(activeAnalysis.latestCisd.direction)} / {barsAgoLabel(activeAnalysis.latestCisd.age, activeTimeframe)} / {formatPrice(activeAnalysis.latestCisd.level)}
                    </p>
                  ) : null}
                  {!activeAnalysis.latestMsbEvent &&
                  !activeAnalysis.latestChochEvent &&
                  !activeAnalysis.latestSweep &&
                  !activeAnalysis.latestCisd ? (
                    <p className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm leading-6 text-slate-400">
                      최근 이벤트가 충분히 누적되지 않았습니다.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-lg border border-surface-line bg-surface-cardSoft p-4">
                <h3 className="text-sm font-bold text-white">현재 TF 주요 구간</h3>
                <div className="mt-3 space-y-2">
                  {activeAnalysis.latestOb ? (
                    <p className={`rounded-md border px-3 py-2 text-sm leading-6 ${directionBadge(activeAnalysis.latestOb.direction)}`}>
                      OB {eventDirectionLabel(activeAnalysis.latestOb.direction)} / {formatPriceRange(activeAnalysis.latestOb.bottom, activeAnalysis.latestOb.top)}
                    </p>
                  ) : null}
                  {activeAnalysis.latestBb ? (
                    <p className="rounded-md border border-violet-500/20 bg-black/20 px-3 py-2 text-sm leading-6 text-slate-200">
                      BB {eventDirectionLabel(activeAnalysis.latestBb.direction)} / {formatPriceRange(activeAnalysis.latestBb.bottom, activeAnalysis.latestBb.top)}
                    </p>
                  ) : null}
                  {activeAnalysis.latestFvg ? (
                    <p className={`rounded-md border px-3 py-2 text-sm leading-6 ${directionBadge(activeAnalysis.latestFvg.direction)}`}>
                      {activeAnalysis.latestFvg.state === "ifvg" ? "iFVG" : "FVG"} {eventDirectionLabel(activeAnalysis.latestFvg.direction)} / {formatPriceRange(activeAnalysis.latestFvg.bottom, activeAnalysis.latestFvg.top)}
                    </p>
                  ) : null}
                  {activeAnalysis.volumeProfile ? (
                    <p className="rounded-md border border-amber-500/20 bg-black/20 px-3 py-2 text-sm leading-6 text-slate-200">
                      POC {stateLabel(activeAnalysis.volumeProfile.position)} / {formatPrice(activeAnalysis.volumeProfile.poc)} · VA{" "}
                      {formatPriceRange(activeAnalysis.volumeProfile.val, activeAnalysis.volumeProfile.vah)}
                    </p>
                  ) : null}
                  {activeAnalysis.oteLevels ? (
                    <>
                      <p className="rounded-md border border-teal-500/20 bg-black/20 px-3 py-2 text-sm leading-6 text-slate-200">
                        OTE 롱 / {formatPriceRange(activeAnalysis.oteLevels.longLow, activeAnalysis.oteLevels.longHigh)}
                      </p>
                      <p className="rounded-md border border-purple-500/20 bg-black/20 px-3 py-2 text-sm leading-6 text-slate-200">
                        OTE 숏 / {formatPriceRange(activeAnalysis.oteLevels.shortLow, activeAnalysis.oteLevels.shortHigh)}
                      </p>
                    </>
                  ) : null}
                  {!activeAnalysis.latestOb &&
                  !activeAnalysis.latestBb &&
                  !activeAnalysis.latestFvg &&
                  !activeAnalysis.volumeProfile &&
                  !activeAnalysis.oteLevels ? (
                    <p className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm leading-6 text-slate-400">
                      아직 표시할 주요 구간이 부족합니다.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {analysis ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-surface-line bg-surface-cardSoft p-4">
                <h3 className="text-sm font-bold text-white">{analysis.longScenario.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">{analysis.longScenario.summary}</p>
                <div className="mt-3 space-y-2">
                  {analysis.longScenario.blockers.length > 0 ? (
                    analysis.longScenario.blockers.map((item) => (
                      <p
                        key={item}
                        className="rounded-md border border-signal-warning/20 bg-black/20 px-3 py-2 text-sm leading-6 text-slate-300"
                      >
                        {item}
                      </p>
                    ))
                  ) : (
                    <p className="rounded-md border border-signal-success/20 bg-black/20 px-3 py-2 text-sm leading-6 text-slate-300">
                      현재 기준으로 눈에 띄는 롱 반대 요소는 크지 않습니다.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-surface-line bg-surface-cardSoft p-4">
                <h3 className="text-sm font-bold text-white">{analysis.shortScenario.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">{analysis.shortScenario.summary}</p>
                <div className="mt-3 space-y-2">
                  {analysis.shortScenario.blockers.length > 0 ? (
                    analysis.shortScenario.blockers.map((item) => (
                      <p
                        key={item}
                        className="rounded-md border border-signal-warning/20 bg-black/20 px-3 py-2 text-sm leading-6 text-slate-300"
                      >
                        {item}
                      </p>
                    ))
                  ) : (
                    <p className="rounded-md border border-signal-success/20 bg-black/20 px-3 py-2 text-sm leading-6 text-slate-300">
                      현재 기준으로 눈에 띄는 숏 반대 요소는 크지 않습니다.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {analysis ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-emerald-500/20 bg-surface-cardSoft p-4">
                <h3 className="text-sm font-bold text-emerald-300">기회 신호</h3>
                <div className="mt-3 space-y-2">
                  {analysis.opportunityFlags.length > 0 ? (
                    analysis.opportunityFlags.map((item) => (
                      <p
                        key={item}
                        className="rounded-md border border-emerald-500/15 bg-emerald-500/5 px-3 py-2 text-sm leading-6 text-slate-200"
                      >
                        {item}
                      </p>
                    ))
                  ) : (
                    <p className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm leading-6 text-slate-300">
                      아직 강한 우세 신호가 겹쳐 보이지 않습니다. 구조 정렬과 구간 반응을 더 확인하세요.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-amber-500/20 bg-surface-cardSoft p-4">
                <h3 className="text-sm font-bold text-amber-300">위험 신호</h3>
                <div className="mt-3 space-y-2">
                  {analysis.riskFlags.length > 0 ? (
                    analysis.riskFlags.map((item) => (
                      <p
                        key={item}
                        className="rounded-md border border-amber-500/15 bg-amber-500/5 px-3 py-2 text-sm leading-6 text-slate-200"
                      >
                        {item}
                      </p>
                    ))
                  ) : (
                    <p className="rounded-md border border-signal-success/20 bg-black/20 px-3 py-2 text-sm leading-6 text-slate-300">
                      눈에 띄는 역행 신호는 많지 않습니다. 그래도 추격 여부와 손절 기준은 별도로 체크하세요.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {activeAnalysis ? (
            <div className="grid grid-cols-2 gap-3">
              <MiniMetric label="상위 구조" value={alignmentSummary?.higher ?? "-"} />
              <MiniMetric label="단기 구조" value={alignmentSummary?.fast ?? "-"} />
              <MiniMetric label="현재 TF MSB" value={stateLabel(activeAnalysis.msb)} />
              <MiniMetric label="현재 TF CHoCH" value={stateLabel(activeAnalysis.choch)} />
              <MiniMetric label="EMA200 위치" value={stateLabel(activeAnalysis.ema200Side)} />
              <MiniMetric
                label="POC 위치"
                value={
                  activeAnalysis.volumeProfile
                    ? `${stateLabel(activeAnalysis.volumeProfile.position)} / ${Math.abs(activeAnalysis.volumeProfile.distancePercent).toFixed(2)}%`
                    : "없음"
                }
              />
              <MiniMetric
                label="최근 OB"
                value={
                  activeAnalysis.latestOb
                    ? `${activeAnalysis.latestOb.direction === "bullish" ? "상승" : "하락"} / ${activeAnalysis.inOb ? "내부" : "외부"}`
                    : "없음"
                }
              />
              <MiniMetric
                label="최근 BB 후보"
                value={
                  activeAnalysis.latestBb
                    ? `${activeAnalysis.latestBb.direction === "bullish" ? "상승" : "하락"} / ${activeAnalysis.inBb ? "내부" : "외부"}`
                    : "없음"
                }
              />
              <MiniMetric
                label="최근 FVG"
                value={
                  activeAnalysis.latestFvg
                    ? `${activeAnalysis.latestFvg.direction === "bullish" ? "상승" : "하락"} / ${activeAnalysis.latestFvg.state === "ifvg" ? "iFVG" : "FVG"}`
                    : "없음"
                }
              />
              <MiniMetric
                label="최근 Sweep"
                value={
                  activeAnalysis.latestSweep
                    ? `${activeAnalysis.latestSweep.direction === "bullish" ? "저점 스윕" : "고점 스윕"} / ${barsAgoLabel(activeAnalysis.latestSweep.age, activeTimeframe)}`
                    : "없음"
                }
              />
              <MiniMetric
                label="최근 CISD"
                value={
                  activeAnalysis.latestCisd
                    ? `${activeAnalysis.latestCisd.direction === "bullish" ? "상승" : "하락"} / ${barsAgoLabel(activeAnalysis.latestCisd.age, activeTimeframe)}`
                    : "없음"
                }
              />
              <MiniMetric label="OTE" value={stateLabel(activeAnalysis.oteZone)} />
              <MiniMetric label="프리미엄/디스카운트" value={stateLabel(activeAnalysis.premiumDiscount)} />
              <MiniMetric label="FVG 내부" value={activeAnalysis.inFvg ? "예" : "아니오"} />
              <MiniMetric label="현재 구조 점수" value={String(activeAnalysis.score)} />
            </div>
          ) : null}

          {analysis ? (
            <div className="rounded-lg border border-surface-line bg-surface-cardSoft p-4">
              <h3 className="text-sm font-bold text-white">MTF FVG / iFVG 맵</h3>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {mtfFvgMap.map((item) => (
                  <div key={item.timeframe} className="rounded-md border border-surface-line bg-black/20 px-3 py-3">
                    <p className="text-xs font-semibold text-slate-400">{item.timeframe}</p>
                    {item.latestFvg ? (
                      <div className="mt-2 space-y-2">
                        <div className={`rounded-md border px-2 py-1 text-xs font-bold ${directionBadge(item.latestFvg.direction)}`}>
                          {item.latestFvg.state === "ifvg" ? "iFVG" : "FVG"} / {stateLabel(item.latestFvg.direction)}
                        </div>
                        <p className="text-xs text-slate-300">
                          {item.latestFvg.bottom.toLocaleString("ko-KR", { maximumFractionDigits: 5 })} -{" "}
                          {item.latestFvg.top.toLocaleString("ko-KR", { maximumFractionDigits: 5 })}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {item.inFvg ? "현재가 내부" : `${barsAgoLabel(item.latestFvg.age, item.timeframe)} 생성`}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-slate-500">최근 FVG 없음</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {analysis ? (
            <div className="rounded-lg border border-surface-line bg-surface-cardSoft p-4">
              <h3 className="text-sm font-bold text-white">분석 기준</h3>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <MiniMetric label="구조 기준" value="ZigZag 5" />
                <MiniMetric label="MSB 판정" value={msbMode === "close" ? "종가 돌파" : "윅 포함 돌파"} />
                <MiniMetric label="CHoCH 판정" value="윅 돌파" />
                <MiniMetric label="OTE 기준" value="4시간 20봉 범위" />
                <MiniMetric label="PD 기준" value="4시간 프리미엄/디스카운트" />
                <MiniMetric label="POC 기준" value="현재 TF 최근 180봉 VP" />
                <MiniMetric label="스윕 기준" value="확정 pivot 이후" />
                <MiniMetric label="레이더 기준" value={`${activeTimeframe} 타임프레임`} />
                <MiniMetric label="판독 모드" value={analysisMode === "confirmed" ? "닫힌 봉 기준" : "진행 중 봉 포함"} />
                <MiniMetric label="4H EMA200" value={fourHourAnalysis ? stateLabel(fourHourAnalysis.ema200Side) : "-"} />
                <MiniMetric label="현재 킬존" value={killzoneLabel(analysis.killzone)} />
                <MiniMetric label="최근 갱신" value={formatUpdatedAt(analysis.updatedAt)} />
                <MiniMetric label="판독 상태" value={readinessLabel(analysis.readiness)} />
              </div>
            </div>
          ) : null}

          {showAdvancedControls && activeAnalysis ? (
            <div className="rounded-lg border border-surface-line bg-surface-cardSoft p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Bug size={16} className="text-accent-blue" aria-hidden />
                  <h3 className="text-sm font-bold text-white">Pine 대조 디버그</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDebug((prev) => !prev)}
                    className="inline-flex min-h-9 items-center gap-2 rounded-md border border-surface-line bg-black/20 px-3 text-xs font-bold text-slate-300 hover:border-accent-blue/60 hover:text-white"
                  >
                    {showDebug ? "접기" : "열기"}
                  </button>
                  <button
                    type="button"
                    onClick={copyDebugSnapshot}
                    className="inline-flex min-h-9 items-center gap-2 rounded-md border border-surface-line bg-black/20 px-3 text-xs font-bold text-slate-300 hover:border-accent-blue/60 hover:text-white"
                  >
                    <Copy size={14} aria-hidden />
                    {copied ? "복사됨" : "값 복사"}
                  </button>
                </div>
              </div>
              {showDebug ? (
                <>
                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    현재 웹앱이 보고 있는 구조 값입니다. 같은 코인, 같은 타임프레임으로 TradingView 지표와 나란히 비교하면 어디서 갈라지는지 빨리 확인할 수 있습니다.
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <MiniMetric label="h0" value={activeAnalysis.debug.h0 ? formatPrice(activeAnalysis.debug.h0) : "-"} />
                    <MiniMetric label="h1" value={activeAnalysis.debug.h1 ? formatPrice(activeAnalysis.debug.h1) : "-"} />
                    <MiniMetric label="l0" value={activeAnalysis.debug.l0 ? formatPrice(activeAnalysis.debug.l0) : "-"} />
                    <MiniMetric label="l1" value={activeAnalysis.debug.l1 ? formatPrice(activeAnalysis.debug.l1) : "-"} />
                    <MiniMetric label="market" value={String(activeAnalysis.debug.market)} />
                    <MiniMetric label="choch_dir" value={String(activeAnalysis.debug.choch)} />
                    <MiniMetric label="hiPts 수" value={String(activeAnalysis.debug.hiCount)} />
                    <MiniMetric label="loPts 수" value={String(activeAnalysis.debug.loCount)} />
                  </div>
                  <div className="mt-4 rounded-lg border border-accent-blue/20 bg-black/20 p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-white">Pine 스냅샷 일치율</h4>
                        <p className="mt-1 text-xs leading-5 text-slate-400">
                          Pine 지표의 App State JSON Alert 또는 직접 적은 key=value 값을 붙여넣으면 웹앱 값과 즉시 비교합니다.
                        </p>
                      </div>
                      {parityScore !== null ? (
                        <span className={`rounded-md border px-3 py-1.5 text-sm font-black ${parityScore >= 90 ? "border-signal-success/30 bg-signal-success/10 text-signal-success" : parityScore >= 70 ? "border-signal-warning/30 bg-signal-warning/10 text-signal-warning" : "border-signal-danger/30 bg-signal-danger/10 text-signal-danger"}`}>
                          일치율 {parityScore}%
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={fillParityTemplateFromWeb}
                        className="inline-flex min-h-9 items-center rounded-md border border-accent-blue/30 bg-accent-blue/10 px-3 text-xs font-bold text-accent-blue hover:bg-accent-blue/20"
                      >
                        웹값 예시 채우기
                      </button>
                      <button
                        type="button"
                        onClick={() => setPineSnapshotInput("")}
                        className="inline-flex min-h-9 items-center rounded-md border border-white/10 bg-black/20 px-3 text-xs font-bold text-slate-300 hover:border-accent-blue/40"
                      >
                        입력 비우기
                      </button>
                    </div>
                    <textarea
                      value={pineSnapshotInput}
                      onChange={(event) => setPineSnapshotInput(event.target.value)}
                      placeholder={'예: {"market":1,"chochDir":-1,"h0":104500,"h1":105100,"l0":103800,"l1":102900,"hiCount":12,"loCount":12}'}
                      className="mt-3 min-h-24 w-full rounded-md border border-surface-line bg-surface-card px-3 py-2 text-xs leading-5 text-slate-200 outline-none focus:border-accent-blue"
                    />
                    <p className="mt-2 text-[11px] leading-5 text-slate-500">
                      지원 필드: market, chochDir, h0/h1/l0/l1, msb.{activeTimeframe}, choch.{activeTimeframe}, latestOb.*, latestFvg.*, fvgDir/fvgTop/fvgBottom, latestSweep.*, latestCisd.*, cisd
                    </p>
                    {pineSnapshotInput.trim() && !pineSnapshot ? (
                      <p className="mt-2 text-xs text-signal-danger">스냅샷 형식을 읽지 못했습니다. JSON 또는 market=1, h0=... 형태로 넣어주세요.</p>
                    ) : null}
                    {parityRows.length > 0 ? (
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <MiniMetric label="핵심 일치율" value={parityScore !== null ? `${parityScore}%` : "-"} />
                        <MiniMetric label="대조 항목 수" value={String(parityRows.length)} />
                        <MiniMetric label="어긋난 항목" value={String(parityMismatches.length)} />
                      </div>
                    ) : null}
                    {parityMismatches.length > 0 ? (
                      <div className="mt-3 rounded-md border border-signal-warning/25 bg-signal-warning/10 p-3">
                        <p className="text-xs font-bold text-signal-warning">먼저 볼 차이</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {parityMismatches.slice(0, 6).map((row) => (
                            <span
                              key={row.label}
                              className={`rounded-md border px-2.5 py-1 text-xs font-bold ${
                                row.importance === "core"
                                  ? "border-signal-danger/30 bg-signal-danger/10 text-signal-danger"
                                  : row.importance === "major"
                                    ? "border-signal-warning/30 bg-signal-warning/10 text-signal-warning"
                                    : "border-white/10 bg-black/20 text-slate-300"
                              }`}
                            >
                              {row.label}
                            </span>
                          ))}
                        </div>
                        <div className="mt-3 space-y-2">
                          {parityMismatches.slice(0, 3).map((row) => (
                            <p key={`${row.label}-hint`} className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs leading-5 text-slate-300">
                              <span className="font-bold text-slate-100">{row.label}</span>: {parityHint(row)}
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {parityRows.length > 0 ? (
                      <div className="mt-3 overflow-hidden rounded-md border border-surface-line">
                        <div className="grid grid-cols-4 bg-black/30 px-3 py-2 text-[11px] font-bold text-slate-400">
                          <span>항목</span>
                          <span>웹앱</span>
                          <span>Pine</span>
                          <span>결과</span>
                        </div>
                        {parityRows.map((row) => (
                          <div key={row.label} className="grid grid-cols-4 border-t border-surface-line px-3 py-2 text-xs text-slate-200">
                            <span className={row.importance === "core" ? "font-bold text-white" : row.importance === "major" ? "font-semibold text-slate-200" : "text-slate-300"}>
                              {row.label}
                            </span>
                            <span>{row.web}</span>
                            <span>{row.pine}</span>
                            <span className={row.matched ? "font-bold text-signal-success" : "font-bold text-signal-warning"}>
                              {row.result}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  필요할 때만 열어서 Pine 지표와 구조 값을 1:1로 맞춰볼 수 있게 접어뒀습니다.
                </p>
              )}
            </div>
          ) : null}

            </>
          ) : null}

          {analysis ? (
            <div className="rounded-lg border border-surface-line bg-surface-cardSoft p-4">
              <h3 className="text-sm font-bold text-white">판독 근거</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-md border border-signal-success/20 bg-signal-success/5 p-3">
                  <p className="text-xs font-bold text-signal-success">상승 근거</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {groupedReasons.bullish.length > 0 ? (
                      groupedReasons.bullish.map((reason) => (
                        <span
                          key={`${reason.text}-${reason.tone}`}
                          className={`rounded-md border px-2.5 py-1.5 text-sm font-semibold ${reasonClasses(reason.tone)}`}
                        >
                          {reason.text}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">뚜렷한 상승 근거 없음</span>
                    )}
                  </div>
                </div>
                <div className="rounded-md border border-signal-danger/20 bg-signal-danger/5 p-3">
                  <p className="text-xs font-bold text-signal-danger">하락 근거</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {groupedReasons.bearish.length > 0 ? (
                      groupedReasons.bearish.map((reason) => (
                        <span
                          key={`${reason.text}-${reason.tone}`}
                          className={`rounded-md border px-2.5 py-1.5 text-sm font-semibold ${reasonClasses(reason.tone)}`}
                        >
                          {reason.text}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">뚜렷한 하락 근거 없음</span>
                    )}
                  </div>
                </div>
                <div className="rounded-md border border-white/10 bg-black/20 p-3">
                  <p className="text-xs font-bold text-slate-300">횡보 / 참고</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {groupedReasons.neutral.length > 0 ? (
                      groupedReasons.neutral.map((reason) => (
                        <span
                          key={`${reason.text}-${reason.tone}`}
                          className={`rounded-md border px-2.5 py-1.5 text-sm font-semibold ${reasonClasses(reason.tone)}`}
                        >
                          {reason.text}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">추가 참고 근거 없음</span>
                    )}
                  </div>
                </div>
              </div>
              {analysis.warnings.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {analysis.warnings.map((warning) => (
                    <p key={warning} className="rounded-md border border-signal-warning/30 bg-signal-warning/10 p-2 text-sm leading-6 text-signal-warning">
                      {warning}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {showDetailedReadout && analysis ? (
            <div className="rounded-lg border border-accent-blue/25 bg-accent-blue/10 p-4">
              <div className="flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-accent-blue/25 bg-black/20 text-accent-blue">
                  <LockKeyhole size={17} aria-hidden />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">베타 기능 공개 안내</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    현재는 사람들 반응을 보기 위해 분석 시나리오, AI 코멘트, 복기 저장을 모두 공개합니다.
                    다만 정식 서비스 오픈 전에는 복기와 저장 데이터가 보존되지 않을 수 있습니다.
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <p className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs leading-5 text-slate-300">
                      제공 중: 롱/숏 우세도, MSB/CHoCH, OB/FVG/iFVG, Sweep/CISD, POC, PD, 위험 신호
                    </p>
                    <p className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs leading-5 text-slate-300">
                      주의: 베타 저장 데이터는 정식 서비스 전환 시 초기화될 수 있습니다.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
