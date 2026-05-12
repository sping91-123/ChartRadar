"use client";
// 글로벌 시장 주요 종목을 차트와 기술지표 레이더로 보여주는 화면.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CandlestickSeries, createChart, type IChartApi, type ISeriesApi, type Time } from "lightweight-charts";
import { Activity, AlertTriangle, BarChart3, Gauge, Loader2, RefreshCw, Search, Shield, Sparkles } from "lucide-react";
import { TechnicalRadarPanel } from "@/components/TechnicalRadarPanel";
import { chartTimeframes, type Candle, type ChartTimeframe } from "@/lib/marketAnalysis";
import { analyzeTechnicalRadar, type TechnicalRadarReport } from "@/lib/technicalRadar";
import type { StockSymbolInfo } from "@/lib/stockMarket";
import { recordUsageEvent } from "@/lib/usageMeter";

const fallbackUniverse: StockSymbolInfo[] = [
  { symbol: "SPY", name: "S&P 500 ETF", group: "index_etf" },
  { symbol: "QQQ", name: "Nasdaq 100 ETF", group: "index_etf" },
  { symbol: "NVDA", name: "Nvidia", group: "mega_cap" },
  { symbol: "AAPL", name: "Apple", group: "mega_cap" },
  { symbol: "AMD", name: "AMD", group: "ai_chip" },
  { symbol: "TSLA", name: "Tesla", group: "growth" },
  { symbol: "JPM", name: "JPMorgan", group: "finance" },
  { symbol: "GLD", name: "Gold ETF", group: "commodity" }
];

const groupLabels: Record<StockSymbolInfo["group"], string> = {
  index_etf: "지수 ETF",
  mega_cap: "빅테크",
  ai_chip: "AI·반도체",
  growth: "성장주",
  finance: "금융·섹터",
  commodity: "원자재 ETF"
};

const groupOrder: StockSymbolInfo["group"][] = ["index_etf", "mega_cap", "ai_chip", "growth", "finance", "commodity"];
const featuredSymbols = ["SPY", "QQQ", "NVDA", "AAPL", "TSLA", "GLD"];

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; candles: Candle[]; dataSource: string; cachedAt: number }
  | { status: "error"; message: string };

function formatPrice(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "미확인";
  return value.toLocaleString("ko-KR", { maximumFractionDigits: value >= 100 ? 2 : 4 });
}

function symbolName(symbol: string, universe: StockSymbolInfo[]) {
  const found = universe.find((item) => item.symbol === symbol);
  return found ? found.name : symbol;
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "미확인";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function directionTone(report: TechnicalRadarReport | null) {
  if (!report) return "neutral";
  if (report.bullishCount >= report.bearishCount + 3) return "bullish";
  if (report.bearishCount >= report.bullishCount + 3) return "bearish";
  return "neutral";
}

function toneBadgeClass(tone: "bullish" | "bearish" | "neutral") {
  if (tone === "bullish") return "border-emerald-400/25 bg-emerald-500/10 text-emerald-200";
  if (tone === "bearish") return "border-rose-400/25 bg-rose-500/10 text-rose-200";
  return "border-sky-300/25 bg-sky-400/10 text-sky-100";
}

function StockSnapshot({
  report,
  latest,
  changePercent
}: {
  report: TechnicalRadarReport | null;
  latest: Candle | null;
  changePercent: number | null;
}) {
  const tone = directionTone(report);
  const support = report?.supportResistance.support ?? null;
  const resistance = report?.supportResistance.resistance ?? null;

  return (
    <div className="grid gap-3 lg:grid-cols-4">
      <div className={`rounded-lg border p-4 lg:col-span-2 ${toneBadgeClass(tone)}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] opacity-80">오늘의 글로벌 레이더</p>
            <h3 className="mt-2 text-2xl font-black text-white">{report?.trendLabel ?? "데이터 확인 중"}</h3>
          </div>
          <Gauge size={24} aria-hidden />
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-200">
          {report?.summary ?? "글로벌 시장 캔들을 불러오면 추세, 모멘텀, 변동성, 거래량을 요약합니다."}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md bg-black/20 p-2">
            <p className="text-lg font-black text-emerald-300">{report?.bullishCount ?? "-"}</p>
            <p className="text-[11px] font-bold text-slate-300">상승 근거</p>
          </div>
          <div className="rounded-md bg-black/20 p-2">
            <p className="text-lg font-black text-rose-300">{report?.bearishCount ?? "-"}</p>
            <p className="text-[11px] font-bold text-slate-300">하락 근거</p>
          </div>
          <div className="rounded-md bg-black/20 p-2">
            <p className="text-lg font-black text-slate-200">{report?.neutralCount ?? "-"}</p>
            <p className="text-[11px] font-bold text-slate-300">횡보 근거</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-surface-line bg-black/20 p-4">
        <Activity className="text-cyan-300" size={20} aria-hidden />
        <p className="mt-3 text-xs font-bold text-slate-400">현재가와 변동</p>
        <p className="mt-1 text-2xl font-black text-white">{latest ? formatPrice(latest.close) : "미확인"}</p>
        <p className={`mt-1 text-sm font-black ${changePercent !== null && changePercent >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
          {formatPercent(changePercent)}
        </p>
      </div>

      <div className="rounded-lg border border-surface-line bg-black/20 p-4">
        <Shield className="text-cyan-300" size={20} aria-hidden />
        <p className="mt-3 text-xs font-bold text-slate-400">가까운 기준선</p>
        <p className="mt-1 text-sm font-black text-emerald-200">지지 {formatPrice(support)}</p>
        <p className="mt-1 text-sm font-black text-rose-200">저항 {formatPrice(resistance)}</p>
      </div>

      {report && report.fearGreed.score >= 75 ? (
        <div className="rounded-lg border border-amber-300/25 bg-amber-500/10 p-4 lg:col-span-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 shrink-0 text-amber-300" size={18} aria-hidden />
            <p className="text-sm leading-6 text-amber-100">
              캔들 기반 심리 참고값이 높은 편입니다. 추세가 강해도 과열 구간에서는 추격보다 눌림, 지지선, 거래량 확인이 더 중요합니다.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function StockRadarApp() {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartApiRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [symbol, setSymbol] = useState("QQQ");
  const [timeframe, setTimeframe] = useState<ChartTimeframe>("1d");
  const [universe, setUniverse] = useState<StockSymbolInfo[]>(fallbackUniverse);
  const [selectedGroup, setSelectedGroup] = useState<StockSymbolInfo["group"] | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [state, setState] = useState<LoadState>({ status: "idle" });

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
      .slice(0, 24);
  }, [searchQuery, selectedGroup, universe]);

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const response = await fetch(`/api/stocks/candles?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`, {
        cache: "no-store"
      });
      const data = (await response.json().catch(() => ({}))) as {
        candles?: Candle[];
        dataSource?: string;
        cachedAt?: number;
        universe?: StockSymbolInfo[];
        error?: string;
      };

      if (Array.isArray(data.universe) && data.universe.length) setUniverse(data.universe);
      if (!response.ok) throw new Error(data.error ?? `서버 오류 (${response.status})`);
      if (!Array.isArray(data.candles) || data.candles.length === 0) throw new Error("캔들 데이터가 비어 있습니다.");

      setState({
        status: "ready",
        candles: data.candles,
        dataSource: data.dataSource ?? "글로벌 시장 데이터",
        cachedAt: data.cachedAt ?? Date.now()
      });
      recordUsageEvent("stockRadar");
    } catch (error) {
      const message = error instanceof Error ? error.message : "글로벌 시장 데이터를 불러오지 못했습니다.";
      setState({ status: "error", message });
    }
  }, [symbol, timeframe]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!chartRef.current) return;

    const chart = createChart(chartRef.current, {
      height: 360,
      layout: {
        background: { color: "transparent" },
        textColor: "#cbd5e1"
      },
      grid: {
        vertLines: { color: "rgba(148,163,184,0.08)" },
        horzLines: { color: "rgba(148,163,184,0.08)" }
      },
      rightPriceScale: { borderColor: "rgba(148,163,184,0.18)" },
      timeScale: { borderColor: "rgba(148,163,184,0.18)", timeVisible: timeframe !== "1d" }
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

    const resizeObserver = new ResizeObserver(() => {
      if (!chartRef.current) return;
      chart.applyOptions({ width: chartRef.current.clientWidth });
    });
    resizeObserver.observe(chartRef.current);

    return () => {
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

  return (
    <section className="rounded-lg border border-surface-line bg-surface-card p-4 shadow-glow sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-accent-blue/30 bg-accent-blue/15 text-accent-blue">
            <BarChart3 size={21} aria-hidden />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-accent-blue">Global Radar</p>
            <h2 className="mt-1 text-xl font-black text-white">글로벌 레이더</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              미국 주요 주식, 지수 ETF, 반도체, 성장주, 원자재 ETF를 기술지표 중심으로 빠르게 훑습니다.
              종목별 추세, 모멘텀, 변동성, 거래량을 한 화면에서 정리해 관심종목 선별과 장전 점검에 활용할 수 있습니다.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => load()}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-accent-blue/30 bg-accent-blue/10 px-3 text-xs font-black text-accent-blue transition hover:bg-accent-blue hover:text-slate-950"
        >
          <RefreshCw size={14} aria-hidden />
          새로고침
        </button>
      </div>

      <div className="mt-5 rounded-lg border border-accent-blue/20 bg-accent-blue/[0.06] p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.18em] text-accent-blue">
              <Sparkles size={13} aria-hidden />
              오늘 볼 글로벌 시장
            </p>
            <h3 className="mt-2 text-2xl font-black text-white">
              {symbol}
              <span className="ml-2 text-base font-bold text-slate-400">{selectedInfo?.name ?? symbol}</span>
            </h3>
            <p className="mt-1 text-xs font-bold text-slate-500">
              {selectedInfo ? groupLabels[selectedInfo.group] : "관심 시장"} · {timeframe} 기준 판독
            </p>
          </div>
          <label className="relative block lg:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} aria-hidden />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="티커나 이름 검색"
              className="h-11 w-full rounded-md border border-surface-line bg-surface-cardSoft pl-9 pr-3 text-sm font-bold text-white outline-none transition placeholder:text-slate-600 focus:border-accent-blue/70"
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
              className={`min-h-11 shrink-0 rounded-md border px-3 text-left transition ${
                symbol === item.symbol
                  ? "border-accent-blue bg-accent-blue text-slate-950"
                  : "border-surface-line bg-surface-cardSoft text-slate-200 hover:border-accent-blue/60"
              }`}
            >
              <span className="block text-sm font-black">{item.symbol}</span>
              <span className={`block text-[10px] font-bold ${symbol === item.symbol ? "text-slate-800" : "text-slate-500"}`}>
                {groupLabels[item.group]}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {(["all", ...groupOrder] as Array<StockSymbolInfo["group"] | "all">).map((group) => (
            <button
              key={group}
              type="button"
              onClick={() => setSelectedGroup(group)}
              className={`min-h-8 rounded-md border px-2.5 text-[11px] font-black transition ${
                selectedGroup === group
                  ? "border-white/20 bg-white text-slate-950"
                  : "border-white/10 bg-black/20 text-slate-300 hover:border-accent-blue/60"
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
              className={`min-h-12 rounded-md border px-2.5 text-left transition ${
                symbol === item.symbol
                  ? "border-accent-blue bg-accent-blue/90 text-slate-950"
                  : "border-white/10 bg-black/20 text-slate-200 hover:border-accent-blue/60"
              }`}
            >
              <span className="block text-sm font-black">{item.symbol}</span>
              <span className={`block truncate text-[11px] font-bold ${symbol === item.symbol ? "text-slate-800" : "text-slate-500"}`}>
                {item.name}
              </span>
            </button>
          ))}
        </div>
        {visibleUniverse.length === 0 ? (
          <p className="mt-3 rounded-md border border-white/10 bg-black/20 p-3 text-xs font-bold text-slate-500">
            검색 결과가 없습니다. 티커를 조금 짧게 입력해 보세요.
          </p>
        ) : null}
      </div>

      <div className="mt-5 grid grid-cols-5 gap-2">
        {chartTimeframes.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTimeframe(item)}
            className={`min-h-10 rounded-md border px-2 text-xs font-black transition ${
              timeframe === item
                ? "border-accent-blue bg-accent-blue text-slate-950"
                : "border-surface-line bg-surface-cardSoft text-slate-300 hover:border-accent-blue/60"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {state.status === "ready" ? (
        <div className="mt-5">
          <StockSnapshot report={technicalReport} latest={latest} changePercent={changePercent} />
        </div>
      ) : null}

      <div className="mt-5 rounded-lg border border-surface-line bg-black/20 p-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">선택 종목</p>
            <h3 className="mt-1 text-2xl font-black text-white">
              {symbol} <span className="text-base text-slate-500">{symbolName(symbol, universe)}</span>
            </h3>
          </div>
          {latest ? (
            <div className="text-left sm:text-right">
              <p className="text-xl font-black text-white">{formatPrice(latest.close)}</p>
              <p className={`text-xs font-bold ${changePercent !== null && changePercent >= 0 ? "text-signal-success" : "text-signal-danger"}`}>
                {changePercent === null ? "변동률 미확인" : `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}%`}
              </p>
            </div>
          ) : null}
        </div>

        {state.status === "loading" ? (
          <div className="grid h-[360px] place-items-center rounded-md border border-white/10 bg-white/[0.02] text-sm text-slate-400">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="animate-spin" size={16} aria-hidden />
              글로벌 시장 데이터를 불러오는 중입니다.
            </span>
          </div>
        ) : state.status === "error" ? (
          <div className="rounded-md border border-signal-danger/30 bg-signal-danger/10 p-4 text-sm text-signal-danger">
            {state.message}
          </div>
        ) : (
          <div ref={chartRef} className="h-[360px] w-full" />
        )}
      </div>

      {state.status === "ready" ? (
        <>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            데이터 기준: {state.dataSource}. 차트 판독과 관심종목 선별을 위한 보조 데이터입니다.
          </p>
          <div className="mt-5">
            <TechnicalRadarPanel candles={state.candles} timeframe={timeframe} />
          </div>
        </>
      ) : null}
    </section>
  );
}
