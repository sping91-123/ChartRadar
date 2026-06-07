"use client";
// 글로벌 시장 주요 종목을 차트와 기술지표 레이더로 보여주는 화면.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CandlestickSeries, createChart, type IChartApi, type ISeriesApi, type Time } from "lightweight-charts";
import { RadarInsightPanel } from "@/components/RadarInsightPanel";
import { TechnicalRadarPanel } from "@/components/TechnicalRadarPanel";
import { analyzeTimeframe, type Candle, type ChartTimeframe } from "@/lib/marketAnalysis";
import { analyzeTechnicalRadar, type TechnicalRadarReport } from "@/lib/technicalRadar";
import type { StockSymbolInfo } from "@/lib/stockMarket";
import {
  fallbackUniverse,
  featuredSymbols,
  globalWatchlistMaxItems,
  type GlobalRadarMode,
  type LoadState
} from "@/components/global/stockRadarConfig";
import { readGlobalWatchlist, writeGlobalWatchlist } from "@/components/global/globalWatchlist";
import { GlobalBeginnerGuide } from "@/components/global/GlobalBeginnerGuide";
import { GlobalPlaybook } from "@/components/global/GlobalAssetPlaybook";
import { StockSnapshot } from "@/components/global/GlobalStockSnapshot";
import { GlobalIctPanel } from "@/components/global/GlobalIctPanel";
import { GlobalRadarControlDock } from "@/components/global/GlobalRadarControlDock";
import { GlobalAssetChartPanel } from "@/components/global/GlobalAssetChartPanel";
import { GlobalAssetSelectionPanel } from "@/components/global/GlobalAssetSelectionPanel";
import { formatKstChartTime, getGlobalSessionState, groupPlaybook } from "@/components/global/stockRadarDisplay";
import { getUsageGate, recordUsageEvent } from "@/lib/usageMeter";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";
import { hasMarketEntitlement } from "@/lib/billing";
import { getWatchlistLimit } from "@/lib/watchlist";
import { withSupabaseAuth } from "@/lib/authFetch";
import { getChartThemeOptions, observeChartThemeChange } from "@/lib/chartTheme";
import { technicalRadarReportToRadarInsight, visibleRadarInsightForPlan } from "@/lib/radarInsight";

export function StockRadarApp() {
  const { profile } = useSupabaseAuth();
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
      className="scroll-mt-24 pb-8 sm:pb-10"
    >
      <GlobalAssetSelectionPanel
        symbol={symbol}
        selectedInfo={selectedInfo}
        timeframe={timeframe}
        radarMode={radarMode}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onRefresh={load}
        featuredItems={featuredItems}
        onSelectSymbol={setSymbol}
        visibleSavedItems={visibleSavedItems}
        onToggleSavedSymbol={toggleSavedSymbol}
        canSaveSelectedSymbol={canSaveSelectedSymbol}
        isSavedSymbol={isSavedSymbol}
        selectedGroup={selectedGroup}
        onSelectedGroupChange={setSelectedGroup}
        visibleUniverse={visibleUniverse}
      />
      <GlobalRadarControlDock
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
        radarMode={radarMode}
        onRadarModeChange={setRadarMode}
      />

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
          <p className="mt-3 text-xs leading-5 text-ui-subtle">
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
    </section>
  );
}
