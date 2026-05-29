"use client";
// 글로벌 시장 주요 종목을 차트와 기술지표 레이더로 보여주는 화면.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { CandlestickSeries, createChart, type IChartApi, type ISeriesApi, type Time } from "lightweight-charts";
import { BarChart3, Bookmark, BookmarkCheck, RefreshCw, Search, Sparkles } from "lucide-react";
import { RadarInsightPanel } from "@/components/RadarInsightPanel";
import { TechnicalRadarPanel } from "@/components/TechnicalRadarPanel";
import { analyzeTimeframe, type Candle, type ChartTimeframe } from "@/lib/marketAnalysis";
import { analyzeTechnicalRadar, type TechnicalRadarReport } from "@/lib/technicalRadar";
import type { StockSymbolInfo } from "@/lib/stockMarket";
import {
  fallbackUniverse,
  featuredSymbols,
  globalWatchlistMaxItems,
  groupLabels,
  groupOrder,
  radarModes,
  type GlobalRadarMode,
  type LoadState
} from "@/components/global/stockRadarConfig";
import { readGlobalWatchlist, writeGlobalWatchlist } from "@/components/global/globalWatchlist";
import { GlobalBeginnerGuide } from "@/components/global/GlobalBeginnerGuide";
import { GlobalAssetChecklist, GlobalPlaybook } from "@/components/global/GlobalAssetPlaybook";
import { StockSnapshot } from "@/components/global/GlobalStockSnapshot";
import { GlobalIctPanel } from "@/components/global/GlobalIctPanel";
import { GlobalRadarControlDock } from "@/components/global/GlobalRadarControlDock";
import { GlobalAssetChartPanel } from "@/components/global/GlobalAssetChartPanel";
import { formatKstChartTime, getGlobalSessionState, groupPlaybook, toneBadgeClass } from "@/components/global/stockRadarDisplay";
import { getUsageGate, recordUsageEvent } from "@/lib/usageMeter";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";
import { hasMarketEntitlement } from "@/lib/billing";
import { getWatchlistLimit } from "@/lib/watchlist";
import { withSupabaseAuth } from "@/lib/authFetch";
import { getChartThemeOptions, observeChartThemeChange } from "@/lib/chartTheme";
import { technicalRadarReportToRadarInsight, visibleRadarInsightForPlan } from "@/lib/radarInsight";

export function StockRadarApp() {
  const { profile } = useSupabaseAuth();
  const pathname = usePathname();
  const isPaid = hasMarketEntitlement(profile?.plan, "stocks");
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartApiRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [symbol, setSymbol] = useState("QQQ");
  const [timeframe, setTimeframe] = useState<ChartTimeframe>("1d");
  const [radarMode, setRadarMode] = useState<GlobalRadarMode>("combined");
  const [universe, setUniverse] = useState<StockSymbolInfo[]>(fallbackUniverse);
  const [selectedGroup, setSelectedGroup] = useState<StockSymbolInfo["group"] | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [state, setState] = useState<LoadState>({ status: "idle" });
  const [sessionState, setSessionState] = useState<ReturnType<typeof getGlobalSessionState> | null>(null);
  const [savedSymbols, setSavedSymbols] = useState<string[]>([]);
  const watchlistLimit = getWatchlistLimit(profile?.plan ?? "free");
  const showMobileDock = pathname === "/global/assets";

  const selectedInfo = useMemo(() => universe.find((item) => item.symbol === symbol) ?? null, [symbol, universe]);
  const featuredItems = useMemo(
    () => featuredSymbols.map((featuredSymbol) => universe.find((item) => item.symbol === featuredSymbol)).filter(Boolean) as StockSymbolInfo[],
    [universe]
  );
  const visibleUniverse = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return universe
      .filter((item) => selectedGroup === "all" || item.group === selectedGroup)
      .filter((item) => !query || item.symbol.toLowerCase().includes(query) || item.name.toLowerCase().includes(query))
      .slice(0, 48);
  }, [searchQuery, selectedGroup, universe]);
  const savedItems = useMemo(
    () => savedSymbols.map((savedSymbol) => universe.find((item) => item.symbol === savedSymbol)).filter(Boolean) as StockSymbolInfo[],
    [savedSymbols, universe]
  );
  const visibleSavedItems = useMemo(() => savedItems.slice(0, watchlistLimit), [savedItems, watchlistLimit]);
  const isSavedSymbol = savedSymbols.includes(symbol);
  const canSaveSelectedSymbol = isSavedSymbol || savedSymbols.length < watchlistLimit;

  const toggleSavedSymbol = useCallback((targetSymbol: string) => {
    setSavedSymbols((current) => {
      const normalized = targetSymbol.toUpperCase();
      if (!current.includes(normalized) && current.length >= watchlistLimit) return current;
      const next = current.includes(normalized)
        ? current.filter((item) => item !== normalized)
        : [normalized, ...current].slice(0, globalWatchlistMaxItems);
      writeGlobalWatchlist(next);
      return next;
    });
  }, [watchlistLimit]);

  const load = useCallback(async () => {
    const usageGate = getUsageGate("stockRadar", isPaid);
    if (!usageGate.allowed) {
      setState({ status: "error", message: usageGate.message });
      return;
    }

    setState({ status: "loading" });
    try {
      const response = await fetch(
        `/api/stocks/candles?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`,
        await withSupabaseAuth({ cache: "no-store" })
      );
      const data = (await response.json().catch(() => ({}))) as {
        candles?: Candle[];
        dataSource?: string;
        cachedAt?: number;
        universe?: StockSymbolInfo[];
        error?: string;
      };

      if (Array.isArray(data.universe) && data.universe.length) setUniverse(data.universe);
      if (!response.ok) throw new Error("글로벌 시장 흐름을 잠시 확인하지 못했습니다. 잠시 뒤 다시 확인해 주세요.");
      if (!Array.isArray(data.candles) || data.candles.length === 0) {
        throw new Error("이 자산의 최근 가격 흐름을 잠시 확인하지 못했습니다. 다른 자산을 먼저 확인해 주세요.");
      }

      setState({
        status: "ready",
        candles: data.candles,
        dataSource: data.dataSource ?? "글로벌 시장 데이터",
        cachedAt: data.cachedAt ?? Date.now()
      });
      recordUsageEvent("stockRadar");
    } catch (error) {
      const message = error instanceof Error ? error.message : "글로벌 시장 흐름을 잠시 확인하지 못했습니다.";
      setState({ status: "error", message });
    }
  }, [isPaid, symbol, timeframe]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setSessionState(getGlobalSessionState());
    const timer = window.setInterval(() => setSessionState(getGlobalSessionState()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setSavedSymbols(readGlobalWatchlist());
  }, []);

  useEffect(() => {
    if (!chartRef.current) return;
    const chartThemeOptions = getChartThemeOptions();

    const chart = createChart(chartRef.current, {
      height: 360,
      ...chartThemeOptions,
      localization: {
        timeFormatter: (time: Time) => formatKstChartTime(time, timeframe)
      },
      timeScale: {
        ...chartThemeOptions.timeScale,
        timeVisible: timeframe !== "1d",
        tickMarkFormatter: (time: Time) => formatKstChartTime(time, timeframe)
      }
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444"
    });

    chartApiRef.current = chart;
    candleSeriesRef.current = series;
    const stopObservingTheme = observeChartThemeChange(() => {
      const nextThemeOptions = getChartThemeOptions();
      chart.applyOptions({
        ...nextThemeOptions,
        timeScale: {
          ...nextThemeOptions.timeScale,
          timeVisible: timeframe !== "1d",
          tickMarkFormatter: (time: Time) => formatKstChartTime(time, timeframe)
        }
      });
    });

    const resizeObserver = new ResizeObserver(() => {
      if (!chartRef.current) return;
      chart.applyOptions({ width: chartRef.current.clientWidth });
    });
    resizeObserver.observe(chartRef.current);

    return () => {
      stopObservingTheme();
      resizeObserver.disconnect();
      chart.remove();
      chartApiRef.current = null;
      candleSeriesRef.current = null;
    };
  }, [timeframe]);

  useEffect(() => {
    if (state.status !== "ready" || !candleSeriesRef.current || !chartApiRef.current) return;
    candleSeriesRef.current.setData(
      state.candles.map((candle) => ({
        time: candle.time as Time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close
      }))
    );
    chartApiRef.current.timeScale().fitContent();
  }, [state]);

  const latest = state.status === "ready" ? state.candles[state.candles.length - 1] : null;
  const previous = state.status === "ready" ? state.candles[state.candles.length - 2] : null;
  const changePercent = latest && previous ? ((latest.close - previous.close) / previous.close) * 100 : null;
  const technicalReport = useMemo(() => (state.status === "ready" ? analyzeTechnicalRadar(state.candles) : null), [state]);
  const radarInsight = useMemo(
    () =>
      technicalReport
        ? technicalRadarReportToRadarInsight(technicalReport, {
            market: "global",
            symbol,
            timeframe,
            sessionNote: sessionState?.detail ?? undefined,
            groupNote: groupPlaybook(selectedInfo?.group)
          })
        : null,
    [selectedInfo?.group, sessionState?.detail, symbol, technicalReport, timeframe]
  );
  const visibleRadarInsight = useMemo(
    () => (radarInsight ? visibleRadarInsightForPlan(radarInsight, isPaid) : null),
    [isPaid, radarInsight]
  );
  const ictAnalysis = useMemo(
    () => (state.status === "ready" ? analyzeTimeframe(timeframe, state.candles, { zigLen: 5, useCloseForMsb: true }) : null),
    [state, timeframe]
  );

  return (
    <section
      id="asset-radar"
      className="scroll-mt-24 border-y border-surface-line py-5 pb-40 sm:py-6 sm:pb-36"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center text-accent-blue">
            <BarChart3 size={21} aria-hidden />
          </div>
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-accent-blue">자산레이더</p>
            <h2 className="mt-1 text-xl font-black text-white">선택 자산 상세 판단</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              글로벌 전체 판단 이후 개별 종목을 확인하는 심화 영역입니다.
              상단 대시보드의 시장 모드, 매크로 압력, 섹터 로테이션과 함께 해석하세요.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => load()}
          className="inline-flex min-h-10 items-center justify-center gap-2 border-b border-accent-blue/40 bg-transparent px-1 text-xs font-black text-accent-blue transition hover:border-accent-blue hover:text-cyan-200"
        >
          <RefreshCw size={14} aria-hidden />
          새로고침
        </button>
      </div>

      <div className="mt-5 border-y border-accent-blue/20 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.18em] text-accent-blue">
              <Sparkles size={13} aria-hidden />
              상세 확인할 글로벌 자산
            </p>
            <h3 className="mt-2 break-words text-2xl font-black text-white">
              {symbol}{" "}
              <span className="ml-2 text-base font-bold text-slate-400">{selectedInfo?.name ?? symbol}</span>
            </h3>
            <p className="mt-1 text-xs font-bold text-slate-500">
              {selectedInfo ? groupLabels[selectedInfo.group] : "관심 시장"} · {timeframe} · {radarModes.find((item) => item.value === radarMode)?.label ?? "종합"} 분석
            </p>
          </div>
          <label className="relative block lg:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} aria-hidden />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="종목 검색"
              className="h-11 w-full border-b border-surface-line bg-transparent pl-8 pr-0 text-sm font-bold text-white outline-none transition placeholder:text-slate-600 focus:border-accent-blue/70"
            />
          </label>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {featuredItems.map((item) => (
            <button
              key={item.symbol}
              type="button"
              onClick={() => {
                setSymbol(item.symbol);
                setSearchQuery("");
              }}
              className={`min-h-11 shrink-0 border-b-2 px-1 text-left transition ${
                symbol === item.symbol
                  ? "border-accent-blue text-accent-blue"
                  : "border-transparent bg-transparent text-slate-200 hover:text-white"
              }`}
            >
              <span className="block text-sm font-black">{item.symbol}</span>
              <span className={`block text-[10px] font-bold ${symbol === item.symbol ? "text-accent-blue/80" : "text-slate-500"}`}>
                {groupLabels[item.group]}
              </span>
            </button>
          ))}
        </div>

        <GlobalAssetChecklist selectedInfo={selectedInfo} />

        <div className="mt-4 border-y border-white/10 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black text-white">관심 글로벌 종목</p>
              <p className="mt-1 text-[11px] font-bold text-slate-500">
                매일 보는 ETF와 종목을 저장하면 이곳에 고정됩니다. 미국장 30초 체크 이후 개별 판단을 이어가세요.
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggleSavedSymbol(symbol)}
              disabled={!canSaveSelectedSymbol}
              className={`inline-flex min-h-9 items-center justify-center gap-1.5 border-b px-0 text-xs font-black transition disabled:cursor-not-allowed disabled:border-slate-500/30 disabled:text-slate-500 ${
                isSavedSymbol
                  ? "border-emerald-300/35 text-emerald-200"
                  : "border-accent-blue/30 text-accent-blue hover:text-cyan-100"
              }`}
            >
              {isSavedSymbol ? <BookmarkCheck size={13} aria-hidden /> : <Bookmark size={13} aria-hidden />}
              {isSavedSymbol ? "저장됨" : canSaveSelectedSymbol ? "관심 추가" : "한도 도달"}
            </button>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {visibleSavedItems.map((item) => (
              <button
                key={item.symbol}
                type="button"
                onClick={() => {
                  setSymbol(item.symbol);
                  setSearchQuery("");
                }}
                className={`min-h-10 shrink-0 border-b-2 px-1 text-left transition ${
                  symbol === item.symbol
                    ? "border-emerald-300 text-emerald-200"
                    : "border-transparent bg-transparent text-slate-200 hover:text-white"
                }`}
              >
                <span className="block text-xs font-black">{item.symbol}</span>
                <span className={`block max-w-[110px] truncate text-[10px] font-bold ${symbol === item.symbol ? "text-emerald-200/80" : "text-slate-500"}`}>
                  {item.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {(["all", ...groupOrder] as Array<StockSymbolInfo["group"] | "all">).map((group) => (
            <button
              key={group}
              type="button"
              onClick={() => setSelectedGroup(group)}
              className={`min-h-8 border-b-2 px-0 text-[11px] font-black transition ${
                selectedGroup === group
                  ? "border-white text-white"
                  : "border-transparent bg-transparent text-slate-300 hover:text-white"
              }`}
            >
              {group === "all" ? "전체" : groupLabels[group]}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {visibleUniverse.map((item) => (
            <button
              key={item.symbol}
              type="button"
              onClick={() => setSymbol(item.symbol)}
              className={`min-h-12 border-b-2 px-0 text-left transition ${
                symbol === item.symbol
                  ? "border-accent-blue text-accent-blue"
                  : "border-transparent bg-transparent text-slate-200 hover:text-white"
              }`}
            >
              <span className="block text-sm font-black">{item.symbol}</span>
              <span className={`block truncate text-[11px] font-bold ${symbol === item.symbol ? "text-accent-blue/80" : "text-slate-500"}`}>
                {item.name}
              </span>
            </button>
          ))}
        </div>
        {visibleUniverse.length === 0 ? (
          <p className="mt-3 border-y border-white/10 py-3 text-xs font-bold text-slate-500">
            검색 결과가 없습니다. 종목명이나 심볼을 조금 짧게 입력해 보세요.
          </p>
        ) : null}
      </div>

      {state.status === "ready" && radarMode !== "ict" && visibleRadarInsight ? (
        <div className="mt-5">
          <RadarInsightPanel insight={visibleRadarInsight} isPro={isPaid} />
          <div className="mt-5">
            <StockSnapshot report={technicalReport} latest={latest} changePercent={changePercent} />
          </div>
        </div>
      ) : null}

      <GlobalAssetChartPanel
        symbol={symbol}
        universe={universe}
        latest={latest}
        changePercent={changePercent}
        chartRef={chartRef}
        state={state}
      />

      {state.status === "ready" ? (
        <>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            현재 화면은 {state.dataSource} 가격 흐름을 한국 시간 기준으로 정리합니다.
          </p>
          {radarMode !== "technical" && ictAnalysis ? (
            <div className="mt-5">
              <GlobalIctPanel analysis={ictAnalysis} timeframe={timeframe} candlesLength={state.candles.length} />
            </div>
          ) : null}
          {radarMode !== "ict" ? (
            <div className="mt-5">
              <TechnicalRadarPanel
                candles={state.candles}
                timeframe={timeframe}
                assetLabel={selectedInfo?.name ? `${selectedInfo.name}(${symbol})` : symbol}
                intro="이동평균, MACD, RSI, 일목균형표, Supertrend, 거래량, 변동성 지표로 글로벌 자산의 방향과 과열도를 확인합니다."
              />
            </div>
          ) : null}
        </>
      ) : null}
      <GlobalRadarControlDock
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
        radarMode={radarMode}
        onRadarModeChange={setRadarMode}
        showMobileDock={showMobileDock}
      />
    </section>
  );
}
