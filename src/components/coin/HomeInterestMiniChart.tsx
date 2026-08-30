"use client";

import { useEffect, useRef } from "react";
import { CandlestickSeries, createChart, type ISeriesApi, type TickMarkType, type Time } from "lightweight-charts";
import { ChartTimeframeSelector } from "@/components/coin/ChartTimeframeSelector";
import { useChartTimeframeCandles } from "@/components/coin/useChartTimeframeCandles";
import { chartViewTimeframeLabels, type ChartViewTimeframe } from "@/lib/chartTimeframeView";
import { getChartThemeOptions, observeChartThemeChange } from "@/lib/chartTheme";
import type { Candle } from "@/lib/marketAnalysis";
import { formatPerpetualChartTick, formatPerpetualChartTime } from "@/lib/perpetualChartTime";

export function HomeInterestMiniChart({
  candles,
  candlesByTimeframe,
  symbol,
  asOf
}: {
  candles: Candle[];
  candlesByTimeframe: Record<ChartViewTimeframe, Candle[]>;
  symbol: string;
  asOf: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const chartApiRef = useRef<ReturnType<typeof createChart> | null>(null);
  const {
    timeframe,
    setTimeframe,
    candles: activeCandles
  } = useChartTimeframeCandles({
    cacheKey: `${symbol}:${asOf}`,
    symbol,
    asOf,
    initialCandles: candles,
    initialCandlesByTimeframe: candlesByTimeframe,
    allowRemoteFetch: false
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const theme = getChartThemeOptions();
    const chart = createChart(container, {
      autoSize: true,
      height: 180,
      ...theme,
      layout: { ...theme.layout, background: { color: "transparent" } },
      localization: {
        timeFormatter: (time: Time) => formatPerpetualChartTime(time)
      },
      grid: {
        vertLines: { color: "rgba(148,163,184,0.04)" },
        horzLines: { color: "rgba(148,163,184,0.07)" }
      },
      timeScale: {
        ...theme.timeScale,
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time: Time, tickMarkType: TickMarkType) => formatPerpetualChartTick(time, tickMarkType),
        rightOffsetPixels: 48
      },
      handleScroll: false,
      handleScale: false
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#34d399",
      downColor: "#fb7185",
      borderVisible: false,
      wickUpColor: "#34d399",
      wickDownColor: "#fb7185"
    });
    seriesRef.current = series;
    chartApiRef.current = chart;
    const stopObservingTheme = observeChartThemeChange(() => {
      const next = getChartThemeOptions();
      chart.applyOptions({
        ...next,
        layout: { ...next.layout, background: { color: "transparent" } },
        grid: {
          vertLines: { color: "rgba(148,163,184,0.04)" },
          horzLines: { color: "rgba(148,163,184,0.07)" }
        },
        timeScale: {
          ...next.timeScale,
          timeVisible: true,
          secondsVisible: false,
          tickMarkFormatter: (time: Time, tickMarkType: TickMarkType) => formatPerpetualChartTick(time, tickMarkType),
          rightOffsetPixels: 48
        }
      });
    });
    return () => {
      stopObservingTheme();
      chart.remove();
      seriesRef.current = null;
      chartApiRef.current = null;
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    series.setData(activeCandles.map((candle) => ({
      time: candle.time as never,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close
    })));
    chartApiRef.current?.timeScale().fitContent();
  }, [activeCandles]);

  const timeframeLabel = chartViewTimeframeLabels[timeframe];

  return (
    <div className="w-full">
      <ChartTimeframeSelector value={timeframe} onChange={setTimeframe} className="mb-2 w-full px-1 min-[390px]:ml-auto min-[390px]:w-56" />
      <div className="relative h-[180px] w-full">
        <div ref={containerRef} className="h-full w-full" role="img" aria-label={`${symbol} ${timeframeLabel} 확정 봉 차트`} />
        {!activeCandles.length ? (
          <div className="absolute inset-0 grid place-items-center bg-ui-panel/80 px-4 text-center text-xs font-semibold text-ui-muted" role="status">
            {timeframeLabel} 확정 봉을 확인하지 못했습니다.
          </div>
        ) : null}
      </div>
    </div>
  );
}
