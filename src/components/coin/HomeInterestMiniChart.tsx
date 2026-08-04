"use client";

import { useEffect, useRef } from "react";
import { CandlestickSeries, createChart, type ISeriesApi } from "lightweight-charts";
import { getChartThemeOptions, observeChartThemeChange } from "@/lib/chartTheme";
import type { Candle } from "@/lib/marketAnalysis";

export function HomeInterestMiniChart({ candles, symbol }: { candles: Candle[]; symbol: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const theme = getChartThemeOptions();
    const chart = createChart(container, {
      autoSize: true,
      height: 180,
      ...theme,
      layout: { ...theme.layout, background: { color: "transparent" } },
      grid: {
        vertLines: { color: "rgba(148,163,184,0.04)" },
        horzLines: { color: "rgba(148,163,184,0.07)" }
      },
      timeScale: {
        ...theme.timeScale,
        timeVisible: true,
        secondsVisible: false,
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
          rightOffsetPixels: 48
        }
      });
    });
    return () => {
      stopObservingTheme();
      chart.remove();
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    series.setData(candles.map((candle) => ({
      time: candle.time as never,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close
    })));
  }, [candles]);

  return (
    <div className="relative h-[180px] w-full">
      <div ref={containerRef} className="h-full w-full" role="img" aria-label={`${symbol} 15분 캔들 차트`} />
      {!candles.length ? (
        <div className="absolute inset-0 grid place-items-center text-xs font-semibold text-ui-muted" role="status">15분 차트를 확인하는 중입니다.</div>
      ) : null}
    </div>
  );
}
