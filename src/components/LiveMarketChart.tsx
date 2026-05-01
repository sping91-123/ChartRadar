"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CandlestickSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type Time
} from "lightweight-charts";
import { Activity, AlertTriangle, BarChart3, Bug, Calculator, ClipboardCheck, Copy, History, LockKeyhole, RefreshCcw, Settings2 } from "lucide-react";
import {
  analyzeTimeframe,
  chartTimeframes,
  fetchBinanceCandles,
  summarizeMarket,
  type Candle,
  type ChartTimeframe,
  type DirectionState,
  type MarketAnalysis,
  type ReasonTone
} from "@/lib/marketAnalysis";
import { appendJournalEntry } from "@/lib/journal";

const symbols = ["BTCUSDT.P", "ETHUSDT.P", "SOLUSDT.P", "XRPUSDT.P", "DOGEUSDT.P"];
const dailyFreeReadouts = 5;
const creditStorageKey = "coters.readCredits.v1";

interface MarketCachePayload {
  analysis: MarketAnalysis;
  candles: Candle[];
}

interface CreditState {
  date: string;
  remaining: number;
  used: number;
  unlockedKeys: string[];
}

interface PineSnapshot {
  msb?: DirectionState | "long" | "short" | 1 | -1;
  choch?: DirectionState | "long" | "short" | 1 | -1;
  market?: 1 | -1 | 0;
  chochDir?: 1 | -1 | 0;
  h0?: number | null;
  h1?: number | null;
  l0?: number | null;
  l1?: number | null;
  hiCount?: number;
  loCount?: number;
  timeframe?: string;
  symbol?: string;
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: value > 100 ? 2 : 5
  }).format(value);
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

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function freshCreditState(): CreditState {
  return {
    date: todayKey(),
    remaining: dailyFreeReadouts,
    used: 0,
    unlockedKeys: []
  };
}

function readCreditState(): CreditState {
  if (typeof window === "undefined") return freshCreditState();

  try {
    const stored = window.localStorage.getItem(creditStorageKey);
    if (!stored) return freshCreditState();
    const parsed = JSON.parse(stored) as CreditState;
    if (parsed.date !== todayKey()) return freshCreditState();

    return {
      date: parsed.date,
      remaining: Math.max(0, Number(parsed.remaining) || 0),
      used: Math.max(0, Number(parsed.used) || 0),
      unlockedKeys: Array.isArray(parsed.unlockedKeys) ? parsed.unlockedKeys : []
    };
  } catch {
    return freshCreditState();
  }
}

function writeCreditState(nextState: CreditState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(creditStorageKey, JSON.stringify(nextState));
}

function stateLabel(value: string) {
  if (value === "bullish") return "상승";
  if (value === "bearish") return "하락";
  if (value === "neutral") return "중립";
  if (value === "above") return "위";
  if (value === "below") return "아래";
  if (value === "long") return "롱";
  if (value === "short") return "숏";
  if (value === "premium") return "프리미엄";
  if (value === "discount") return "디스카운트";
  if (value === "equilibrium") return "중간";
  if (value === "none") return "없음";
  return "미확인";
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
  if (analysis.readiness === "high" && analysis.riskFlags.length <= 1) return "조건 양호";
  if (analysis.bias === "neutral" || analysis.readiness === "low") return "관찰 우선";
  return "주의 필요";
}

function userFacingNextStep(analysis: MarketAnalysis | null) {
  if (!analysis) return "차트 데이터를 불러오는 중";
  if (analysis.bias === "neutral") return "진입보다 구조 확인";
  if (analysis.readiness === "high") return "진입 전 손절/수량 확인";
  return "반응 확인 후 판단";
}

function decisionTone(value: string) {
  if (value.includes("양호") || value.includes("손절")) return "border-signal-success/25 bg-signal-success/10 text-signal-success";
  if (value.includes("주의") || value.includes("관찰")) return "border-signal-warning/25 bg-signal-warning/10 text-signal-warning";
  return "border-white/10 bg-black/20 text-slate-200";
}

function formatPriceRange(low: number, high: number) {
  return `${formatPrice(low)} - ${formatPrice(high)}`;
}

function planQualityClasses(quality?: string) {
  if (quality === "A") return "border-signal-success/30 bg-signal-success/10 text-signal-success";
  if (quality === "B") return "border-accent-blue/30 bg-accent-blue/10 text-accent-blue";
  return "border-signal-warning/30 bg-signal-warning/10 text-signal-warning";
}

function normalizeDirection(value: PineSnapshot["msb"] | PineSnapshot["choch"] | 0 | undefined) {
  if (value === 1 || value === "long" || value === "bullish") return "bullish";
  if (value === -1 || value === "short" || value === "bearish") return "bearish";
  if (value === "neutral") return "neutral";
  return "unknown";
}

function parsePineSnapshot(value: string): PineSnapshot | null {
  if (!value.trim()) return null;

  try {
    return JSON.parse(value) as PineSnapshot;
  } catch {
    const entries = value
      .split(/[\n,]+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => part.split(/[:=]/).map((piece) => piece.trim()));

    if (!entries.length) return null;

    const parsed: Record<string, string | number | null> = {};
    for (const [key, rawValue] of entries) {
      if (!key || rawValue === undefined) continue;
      const numeric = Number(rawValue);
      parsed[key] = Number.isFinite(numeric) ? numeric : rawValue;
    }

    return parsed as PineSnapshot;
  }
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

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-surface-line bg-surface-cardSoft p-3">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-white">{value}</p>
    </div>
  );
}

export function LiveMarketChart() {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartApiRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);

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
  const [showDetailedReadout, setShowDetailedReadout] = useState(false);
  const [pineSnapshotInput, setPineSnapshotInput] = useState("");
  const [creditState, setCreditState] = useState<CreditState>(() => freshCreditState());
  const [paywallMessage, setPaywallMessage] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  const cacheKey = `coters.marketCache.${symbol}.${analysisMode}.${msbMode}`;
  const readoutKey = `${symbol}.${activeTimeframe}.${analysisMode}.${msbMode}`;

  useEffect(() => {
    const nextState = readCreditState();
    writeCreditState(nextState);
    setCreditState(nextState);
  }, []);

  useEffect(() => {
    const storedSymbol = window.localStorage.getItem("coters.symbol");
    const storedTimeframe = window.localStorage.getItem("coters.timeframe") as ChartTimeframe | null;
    const storedMode = window.localStorage.getItem("coters.analysisMode") as "confirmed" | "aggressive" | null;
    const storedMsbMode = window.localStorage.getItem("coters.msbMode") as "close" | "wick" | null;

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
    window.localStorage.setItem("coters.symbol", symbol);
  }, [symbol]);

  useEffect(() => {
    window.localStorage.setItem("coters.timeframe", activeTimeframe);
  }, [activeTimeframe]);

  useEffect(() => {
    window.localStorage.setItem("coters.analysisMode", analysisMode);
  }, [analysisMode]);

  useEffect(() => {
    window.localStorage.setItem("coters.msbMode", msbMode);
  }, [msbMode]);

  useEffect(() => {
    try {
      const cached = window.localStorage.getItem(cacheKey);
      if (!cached) return;
      const parsed = JSON.parse(cached) as MarketCachePayload;
      if (!candles.length && parsed.candles.length && !analysis) {
        setCandles(parsed.candles);
        setAnalysis(parsed.analysis);
        setIsUsingCachedData(true);
      }
    } catch {
      // Ignore corrupted cache and keep loading live data.
    }
  }, [analysis, cacheKey, candles.length]);

  const loadMarket = useCallback(async (options?: { consumeCredit?: boolean }) => {
    setIsLoading(true);
    setError("");
    setPaywallMessage("");

    if (options?.consumeCredit) {
      const currentCredits = readCreditState();
      const alreadyUnlocked = currentCredits.unlockedKeys.includes(readoutKey);

      if (!alreadyUnlocked) {
        if (currentCredits.remaining <= 0) {
          setCreditState(currentCredits);
          setPaywallMessage("오늘 무료 판독권을 모두 사용했습니다. 이미 열어본 조합은 계속 볼 수 있고, 새 코인/타임프레임 판독은 PRO에서 열리는 구조입니다.");
          setIsLoading(false);
          return;
        }

        const nextCredits: CreditState = {
          ...currentCredits,
          remaining: currentCredits.remaining - 1,
          used: currentCredits.used + 1,
          unlockedKeys: [...currentCredits.unlockedKeys, readoutKey]
        };
        writeCreditState(nextCredits);
        setCreditState(nextCredits);
      } else {
        setCreditState(currentCredits);
      }
    }

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
      const nextAnalysis = summarizeMarket(symbol, activeTimeframe, analyses, latestPrice);
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
      const fallback = typeof window !== "undefined" ? window.localStorage.getItem(cacheKey) : null;

      if (fallback) {
        try {
          const parsed = JSON.parse(fallback) as MarketCachePayload;
          setCandles(parsed.candles);
          setAnalysis(parsed.analysis);
          setIsUsingCachedData(true);
          setError("실시간 데이터를 잠시 불러오지 못해 최근 저장된 판독값을 보여주고 있습니다.");
        } catch {
          setError(loadError instanceof Error ? loadError.message : "시장 데이터를 불러오지 못했습니다.");
        }
      } else {
        setError(loadError instanceof Error ? loadError.message : "시장 데이터를 불러오지 못했습니다.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [activeTimeframe, analysisMode, cacheKey, msbMode, readoutKey, symbol]);

  useEffect(() => {
    loadMarket({ consumeCredit: true });
    const id = window.setInterval(() => loadMarket({ consumeCredit: false }), 30000);
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

    return () => {
      if (candleSeriesRef.current) {
        priceLinesRef.current.forEach((line) => candleSeriesRef.current?.removePriceLine(line));
        priceLinesRef.current = [];
      }
      chart.remove();
      chartApiRef.current = null;
      candleSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!candleSeriesRef.current) return;

    candleSeriesRef.current.setData(
      candles.map((candle) => ({
        time: candle.time as Time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close
      }))
    );

    chartApiRef.current?.timeScale().fitContent();
  }, [candles]);

  const activeAnalysis = useMemo(
    () => analysis?.timeframeAnalyses.find((item) => item.timeframe === activeTimeframe),
    [analysis, activeTimeframe]
  );

  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series) return;

    priceLinesRef.current.forEach((line) => series.removePriceLine(line));
    priceLinesRef.current = [];

    if (!activeAnalysis) return;

    const lines: Array<{ price: number | null | undefined; color: string; title: string; style?: LineStyle }> = [];

    if (activeAnalysis.ema200Value) {
      lines.push({
        price: activeAnalysis.ema200Value,
        color: "#facc15",
        title: `${activeAnalysis.timeframe} EMA200`,
        style: LineStyle.Dotted
      });
    }

    if (activeAnalysis.latestOb) {
      const color = activeAnalysis.latestOb.direction === "bullish" ? "#34d399" : "#fb4d5f";
      lines.push(
        { price: activeAnalysis.latestOb.top, color, title: `${activeAnalysis.timeframe} OB 상단` },
        { price: activeAnalysis.latestOb.bottom, color, title: `${activeAnalysis.timeframe} OB 하단` }
      );
    }

    if (activeAnalysis.latestFvg) {
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
  }, [activeAnalysis]);

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

  const parityRows = useMemo(() => {
    if (!activeAnalysis || !pineSnapshot) return [];

    const pineMsb = normalizeDirection(pineSnapshot.msb ?? pineSnapshot.market);
    const pineChoch = normalizeDirection(pineSnapshot.choch ?? pineSnapshot.chochDir);
    const rows = [
      {
        label: "MSB 방향",
        web: stateLabel(activeAnalysis.msb),
        pine: stateLabel(pineMsb),
        matched: activeAnalysis.msb === pineMsb,
        result: activeAnalysis.msb === pineMsb ? "일치" : "차이"
      },
      {
        label: "CHoCH 방향",
        web: stateLabel(activeAnalysis.choch),
        pine: stateLabel(pineChoch),
        matched: activeAnalysis.choch === pineChoch,
        result: activeAnalysis.choch === pineChoch ? "일치" : "차이"
      },
      {
        label: "h0",
        web: activeAnalysis.debug.h0 ? formatPrice(activeAnalysis.debug.h0) : "-",
        pine: pineSnapshot.h0 ? formatPrice(Number(pineSnapshot.h0)) : "-",
        ...compareNumber(activeAnalysis.debug.h0, pineSnapshot.h0)
      },
      {
        label: "h1",
        web: activeAnalysis.debug.h1 ? formatPrice(activeAnalysis.debug.h1) : "-",
        pine: pineSnapshot.h1 ? formatPrice(Number(pineSnapshot.h1)) : "-",
        ...compareNumber(activeAnalysis.debug.h1, pineSnapshot.h1)
      },
      {
        label: "l0",
        web: activeAnalysis.debug.l0 ? formatPrice(activeAnalysis.debug.l0) : "-",
        pine: pineSnapshot.l0 ? formatPrice(Number(pineSnapshot.l0)) : "-",
        ...compareNumber(activeAnalysis.debug.l0, pineSnapshot.l0)
      },
      {
        label: "l1",
        web: activeAnalysis.debug.l1 ? formatPrice(activeAnalysis.debug.l1) : "-",
        pine: pineSnapshot.l1 ? formatPrice(Number(pineSnapshot.l1)) : "-",
        ...compareNumber(activeAnalysis.debug.l1, pineSnapshot.l1)
      },
      {
        label: "hiPts 수",
        web: String(activeAnalysis.debug.hiCount),
        pine: pineSnapshot.hiCount === undefined ? "-" : String(pineSnapshot.hiCount),
        matched: pineSnapshot.hiCount === activeAnalysis.debug.hiCount,
        result: pineSnapshot.hiCount === activeAnalysis.debug.hiCount ? "일치" : "차이"
      },
      {
        label: "loPts 수",
        web: String(activeAnalysis.debug.loCount),
        pine: pineSnapshot.loCount === undefined ? "-" : String(pineSnapshot.loCount),
        matched: pineSnapshot.loCount === activeAnalysis.debug.loCount,
        result: pineSnapshot.loCount === activeAnalysis.debug.loCount ? "일치" : "차이"
      }
    ];
    return rows;
  }, [activeAnalysis, pineSnapshot]);

  const parityScore = useMemo(() => {
    if (!parityRows.length) return null;
    const matched = parityRows.filter((row) => row.matched).length;
    return Math.round((matched / parityRows.length) * 100);
  }, [parityRows]);

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

  function saveAnalysisToJournal() {
    if (!analysis || !activeAnalysis) return;

    const noteParts = [
      `판정: ${analysis.verdict}`,
      `행동 가이드: ${analysis.actionGuide}`,
      `현재 위치: ${analysis.currentLocationLabel}`,
      `상위 구조: ${alignmentSummary?.higher ?? "-"}`,
      `단기 구조: ${alignmentSummary?.fast ?? "-"}`,
      `MSB/CHoCH: ${stateLabel(activeAnalysis.msb)} / ${stateLabel(activeAnalysis.choch)}`,
      `체크포인트:`,
      ...analysis.checkpoints.map((item) => `- ${item}`),
      `위험 신호:`,
      ...(analysis.riskFlags.length ? analysis.riskFlags.map((item) => `- ${item}`) : ["- 없음"]),
      `기회 신호:`,
      ...(analysis.opportunityFlags.length ? analysis.opportunityFlags.map((item) => `- ${item}`) : ["- 없음"])
    ];

    appendJournalEntry({
      title: `${symbol} ${activeTimeframe} 판독 저장`,
      bias: analysis.bias === "long" ? "롱" : analysis.bias === "short" ? "숏" : "관찰",
      note: noteParts.join("\n"),
      source: "chart",
      symbol,
      timeframe: activeTimeframe,
      verdict: analysis.verdict
    });

    setSavedMessage("현재 판독을 복기에 저장했습니다.");
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
            <h2 className="text-lg font-bold text-white">차트 판독</h2>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              방향보다 먼저, 지금 자리가 위험한지 구조와 구간을 점검합니다.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => loadMarket({ consumeCredit: false })}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-surface-line bg-surface-cardSoft px-3 text-sm font-bold text-slate-300 hover:border-accent-blue/60 hover:text-white"
        >
          <RefreshCcw size={16} className={isLoading ? "animate-spin" : ""} aria-hidden />
          새로고침
        </button>
      </div>

      <div className="mt-4 rounded-lg border border-accent-blue/20 bg-accent-blue/10 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-accent-blue">무료 판독권</p>
            <p className="mt-1 text-sm leading-6 text-slate-300">
              새 코인/타임프레임 조합을 볼 때 1개씩 사용됩니다. 자동 새로고침과 이미 열어본 조합은 차감되지 않습니다.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2">
              <p className="text-[11px] font-semibold text-slate-500">남은 횟수</p>
              <p className="mt-1 text-lg font-black text-white">{creditState.remaining}</p>
            </div>
            <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2">
              <p className="text-[11px] font-semibold text-slate-500">오늘 사용</p>
              <p className="mt-1 text-lg font-black text-white">{creditState.used}</p>
            </div>
            <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2">
              <p className="text-[11px] font-semibold text-slate-500">무료 한도</p>
              <p className="mt-1 text-lg font-black text-white">{dailyFreeReadouts}</p>
            </div>
          </div>
        </div>
        {paywallMessage ? (
          <div className="mt-3 rounded-md border border-signal-warning/30 bg-signal-warning/10 p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-2">
              <LockKeyhole className="mt-0.5 shrink-0 text-signal-warning" size={16} aria-hidden />
              <div>
                <p className="text-sm font-bold text-signal-warning">PRO 판독 잠금</p>
                <p className="mt-1 text-sm leading-6 text-slate-300">{paywallMessage}</p>
              </div>
              </div>
              <Link
                href="/pro"
                className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-md border border-signal-warning/30 bg-black/20 px-3 text-sm font-bold text-signal-warning hover:bg-signal-warning/10"
              >
                PRO 구성 보기
              </Link>
            </div>
          </div>
        ) : null}
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

        <div className="grid grid-cols-5 gap-2">
          {chartTimeframes.map((timeframe) => (
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
          고급 판독 기준 {showAdvancedControls ? "접기" : "열기"}
        </button>
      </div>

      {showAdvancedControls ? (
        <div className="mt-3 grid gap-3 rounded-lg border border-surface-line bg-surface-cardSoft p-3 sm:grid-cols-2">
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
              닫힌 봉 기준
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
              진행 중 봉 포함
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
              MSB 종가 기준
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
              MSB 윅 포함
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
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
          {activeAnalysis ? (
            <div className="border-b border-surface-line bg-black/20 px-4 py-2 text-xs leading-5 text-slate-400">
              차트 가격선: EMA200, 현재 TF OB, 현재 TF FVG/iFVG 구간
            </div>
          ) : null}
          <div className="relative">
            <div ref={chartRef} className="h-[360px] w-full" />
            {isLoading && !analysis ? (
              <div className="absolute inset-0 flex items-center justify-center bg-surface-cardSoft/85 backdrop-blur-sm">
                <div className="rounded-md border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold text-slate-200">
                  차트와 판독값을 불러오는 중입니다.
                </div>
              </div>
            ) : null}
          </div>
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
                <p className="text-xs font-semibold opacity-80">자동 판독</p>
                <h3 className="mt-1 text-2xl font-black">{analysis?.verdict ?? "데이터 대기 중"}</h3>
              </div>
              <Activity size={26} aria-hidden />
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              {analysis ? `종합 점수 ${analysis.biasScore}. ${analysis.summaryLine}` : "캔들 데이터를 불러오고 있습니다."}
            </p>
            {analysis ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className={`rounded-md border px-3 py-3 ${readinessClasses(analysis.readiness)}`}>
                  <span className="block text-xs font-semibold opacity-80">진입 준비도</span>
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
                  진입 전 체크
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
                  판독 저장
                </button>
              </div>
            ) : null}
            {savedMessage ? (
              <p className="mt-3 rounded-md border border-signal-success/25 bg-signal-success/10 px-3 py-2 text-sm text-signal-success">
                {savedMessage}
              </p>
            ) : null}
          </div>

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
                  지금은 {analysis.verdict} 쪽입니다. 다만 실제 진입은 현재 위치, 무효화 기준, 포지션 크기를 같이 확인해야 합니다.
                </p>
              </div>
            </div>
          ) : null}

          {analysis?.proPlan ? (
            <div className="rounded-lg border border-accent-blue/30 bg-accent-blue/10 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold text-accent-blue">PRO 미리보기</p>
                  <h3 className="mt-1 text-lg font-black text-white">{analysis.proPlan.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{analysis.proPlan.reason}</p>
                </div>
                <span className={`inline-flex shrink-0 rounded-md border px-3 py-1.5 text-sm font-black ${planQualityClasses(analysis.proPlan.quality)}`}>
                  {analysis.proPlan.quality}급 · 신뢰 {analysis.proPlan.confidence}%
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <MiniMetric label="관찰 진입 구간" value={formatPriceRange(analysis.proPlan.entryLow, analysis.proPlan.entryHigh)} />
                <MiniMetric label="무효화 기준" value={formatPrice(analysis.proPlan.invalidation)} />
                <MiniMetric label="1차 목표 후보" value={`${formatPrice(analysis.proPlan.target1)} / ${analysis.proPlan.rr1.toFixed(1)}R`} />
                <MiniMetric label="2차 목표 후보" value={`${formatPrice(analysis.proPlan.target2)} / ${analysis.proPlan.rr2.toFixed(1)}R`} />
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
              <p className="text-sm font-bold text-signal-warning">PRO 시나리오 대기</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                지금은 방향 우세가 충분히 또렷하지 않아 진입·무효화·목표 후보를 계산하지 않았습니다. 이 상태에서 억지로 자리를 만들지 않는 것이 더 좋은 판독입니다.
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
                    </div>
                  </div>
                ))}
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
                    ? `${activeAnalysis.latestSweep.direction === "bullish" ? "저점 스윕" : "고점 스윕"} / ${activeAnalysis.latestSweep.age}봉 전`
                    : "없음"
                }
              />
              <MiniMetric
                label="최근 CISD"
                value={
                  activeAnalysis.latestCisd
                    ? `${activeAnalysis.latestCisd.direction === "bullish" ? "상승" : "하락"} / ${activeAnalysis.latestCisd.age}봉 전`
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
                          {item.inFvg ? "현재가 내부" : `${item.latestFvg.age}봉 전 생성`}
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
                <MiniMetric label="스윕 기준" value="확정 pivot 이후" />
                <MiniMetric label="판독 모드" value={analysisMode === "confirmed" ? "닫힌 봉 기준" : "진행 중 봉 포함"} />
                <MiniMetric label="4H EMA200" value={fourHourAnalysis ? stateLabel(fourHourAnalysis.ema200Side) : "-"} />
                <MiniMetric label="현재 킬존" value={killzoneLabel(analysis.killzone)} />
                <MiniMetric label="최근 갱신" value={formatUpdatedAt(analysis.updatedAt)} />
                <MiniMetric label="진입 준비도" value={readinessLabel(analysis.readiness)} />
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
                          Pine 지표에서 같은 봉 기준 값을 JSON 또는 key=value 형태로 붙여넣으면 웹앱 값과 즉시 비교합니다.
                        </p>
                      </div>
                      {parityScore !== null ? (
                        <span className={`rounded-md border px-3 py-1.5 text-sm font-black ${parityScore >= 90 ? "border-signal-success/30 bg-signal-success/10 text-signal-success" : parityScore >= 70 ? "border-signal-warning/30 bg-signal-warning/10 text-signal-warning" : "border-signal-danger/30 bg-signal-danger/10 text-signal-danger"}`}>
                          일치율 {parityScore}%
                        </span>
                      ) : null}
                    </div>
                    <textarea
                      value={pineSnapshotInput}
                      onChange={(event) => setPineSnapshotInput(event.target.value)}
                      placeholder={'예: {"market":1,"chochDir":-1,"h0":104500,"h1":105100,"l0":103800,"l1":102900,"hiCount":12,"loCount":12}'}
                      className="mt-3 min-h-24 w-full rounded-md border border-surface-line bg-surface-card px-3 py-2 text-xs leading-5 text-slate-200 outline-none focus:border-accent-blue"
                    />
                    {pineSnapshotInput.trim() && !pineSnapshot ? (
                      <p className="mt-2 text-xs text-signal-danger">스냅샷 형식을 읽지 못했습니다. JSON 또는 market=1, h0=... 형태로 넣어주세요.</p>
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
                            <span>{row.label}</span>
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
              <div className="mt-3 flex flex-wrap gap-2">
                {analysis.reasons.map((reason) => (
                  <span
                    key={`${reason.text}-${reason.tone}`}
                    className={`rounded-md border px-2.5 py-1.5 text-sm font-semibold ${reasonClasses(reason.tone)}`}
                  >
                    {reason.text}
                  </span>
                ))}
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
                  <h3 className="text-sm font-bold text-white">유료화 가치 포인트</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    무료 사용자는 방향 우세와 위험 신호만 빠르게 확인하고, PRO에서는 같은 판독값을 바탕으로
                    관찰 진입 구간, 무효화 기준, 목표 후보, 손익비, 복기 저장까지 하나의 매매 계획서처럼 정리합니다.
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <p className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs leading-5 text-slate-300">
                      무료: 롱/숏 우세도, MSB/CHoCH, OB/FVG/iFVG, Sweep/CISD, 위험 신호
                    </p>
                    <p className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs leading-5 text-slate-300">
                      PRO: 진입 후보, 무효화 가격, 목표 후보, 손익비 예시, 복기 저장
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
