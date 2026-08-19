"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time
} from "lightweight-charts";
import { ChartTimeframeSelector } from "@/components/coin/ChartTimeframeSelector";
import { PerpetualChartLegend } from "@/components/coin/PerpetualChartLegend";
import { useChartTimeframeCandles } from "@/components/coin/useChartTimeframeCandles";
import { chartViewTimeframeLabels } from "@/lib/chartTimeframeView";
import {
  buildPerpetualChartOverlayModel,
  buildPerpetualSignalLegendItems,
  compactPerpetualCandleLimit,
  resolvePerpetualChartMarkers,
  type PerpetualChartLineStyle,
  type ResolvedPerpetualChartMarker
} from "@/lib/perpetualDecisionChartOverlays";
import type { PerpetualDecisionSnapshot } from "@/lib/perpetualDecisionSnapshot";

function lightweightLineStyle(style: PerpetualChartLineStyle) {
  if (style === "dashed") return LineStyle.Dashed;
  if (style === "dotted") return LineStyle.Dotted;
  return LineStyle.Solid;
}

function seriesMarker(marker: ResolvedPerpetualChartMarker, compact: boolean): SeriesMarker<Time> {
  return {
    time: marker.time as Time,
    position: marker.position,
    color: marker.color,
    shape: marker.shape,
    ...(compact ? {} : { text: marker.kind === "msb" ? "추세 확인" : "전환 가능" })
  };
}

export function PerpetualDecisionChart({ snapshot, compact = false }: { snapshot: PerpetualDecisionSnapshot; compact?: boolean }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const [compactCandleLimit, setCompactCandleLimit] = useState(64);
  const {
    timeframe,
    setTimeframe,
    candles,
    isLoading,
    error,
    retry
  } = useChartTimeframeCandles({
    cacheKey: `${snapshot.id}:${snapshot.generatedAt}`,
    symbol: snapshot.symbol,
    asOf: snapshot.generatedAt,
    initialCandles: snapshot.chart.candles
  });
  const setContainerRef = useCallback((container: HTMLDivElement | null) => {
    containerRef.current = container;
    if (!compact || !container || container.clientWidth <= 0) return;
    const measuredLimit = compactPerpetualCandleLimit(container.clientWidth);
    setCompactCandleLimit((current) => current === measuredLimit ? current : measuredLimit);
  }, [compact]);
  const legendId = `perpetual-chart-legend-${useId().replace(/:/g, "")}`;
  const overlayModel = useMemo(() => buildPerpetualChartOverlayModel(snapshot, timeframe), [snapshot, timeframe]);
  const visibleCandles = useMemo(
    () => compact ? candles.slice(-compactCandleLimit) : candles,
    [candles, compact, compactCandleLimit]
  );
  const resolvedMarkers = useMemo(
    () => resolvePerpetualChartMarkers(overlayModel.markers, visibleCandles.map((candle) => candle.time)),
    [overlayModel.markers, visibleCandles]
  );
  const allResolvedMarkers = useMemo(
    () => resolvePerpetualChartMarkers(overlayModel.markers, candles.map((candle) => candle.time)),
    [candles, overlayModel.markers]
  );
  const visibleMarkerIds = useMemo(
    () => new Set(resolvedMarkers.map((marker) => marker.id)),
    [resolvedMarkers]
  );
  const legendItems = useMemo(
    () => [...overlayModel.legendItems, ...buildPerpetualSignalLegendItems(allResolvedMarkers, visibleMarkerIds)],
    [allResolvedMarkers, overlayModel.legendItems, visibleMarkerIds]
  );
  const counts = useMemo(() => ({
    conditions: overlayModel.legendItems.filter((item) => item.group === "condition").length,
    zones: overlayModel.legendItems.filter((item) => item.group === "zone").length,
    signals: resolvedMarkers.length
  }), [overlayModel.legendItems, resolvedMarkers.length]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: compact ? 190 : 360,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#94a3b8",
        attributionLogo: false
      },
      grid: {
        vertLines: { color: "rgba(148,163,184,0.06)" },
        horzLines: { color: "rgba(148,163,184,0.08)" }
      },
      rightPriceScale: { borderColor: "rgba(148,163,184,0.16)" },
      timeScale: {
        borderColor: "rgba(148,163,184,0.16)",
        timeVisible: true,
        secondsVisible: false,
        ...(compact ? { rightOffsetPixels: 56 } : {})
      },
      handleScroll: !compact,
      handleScale: !compact
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#34d399",
      downColor: "#fb7185",
      borderVisible: false,
      wickUpColor: "#34d399",
      wickDownColor: "#fb7185"
    });
    const markers = createSeriesMarkers(series, []);
    chartRef.current = chart;
    seriesRef.current = series;
    markersRef.current = markers;

    overlayModel.lines.forEach((line) => {
      series.createPriceLine({
        price: line.price,
        color: line.color,
        lineWidth: line.lineWidth,
        lineStyle: lightweightLineStyle(line.lineStyle),
        axisLabelVisible: compact ? line.axisLabelVisible : true,
        title: compact ? "" : line.detailLabel
      });
    });

    const resize = () => {
      const width = container.clientWidth;
      if (width <= 0) return;
      chart.applyOptions({ width });
      if (compact) {
        const nextLimit = compactPerpetualCandleLimit(width);
        setCompactCandleLimit((current) => current === nextLimit ? current : nextLimit);
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    return () => {
      observer.disconnect();
      markersRef.current = null;
      seriesRef.current = null;
      chartRef.current = null;
      chart.remove();
    };
  }, [compact, overlayModel]);

  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const markers = markersRef.current;
    if (!chart || !series || !markers) return;
    series.setData(visibleCandles.map((candle) => ({
      time: candle.time as Time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close
    })));
    markers.setMarkers(resolvedMarkers.map((marker) => seriesMarker(marker, compact)));
    chart.timeScale().fitContent();
  }, [compact, resolvedMarkers, visibleCandles]);

  const timeframeLabel = chartViewTimeframeLabels[timeframe];

  return (
    <section aria-label={`${snapshot.symbol} ${timeframeLabel} 차트`}>
      <div className={`mb-2 ${compact ? "px-2" : ""}`}>
        <div className="flex flex-wrap items-center justify-between gap-1">
          <p className="text-[11px] font-black text-ui-text">{timeframeLabel} 확정 봉에서 직접 확인</p>
          {compact ? (
            <span className="text-[10px] font-semibold text-ui-subtle">
              조건선 {counts.conditions} · 가격대 {counts.zones} · 구조 신호 {counts.signals}
            </span>
          ) : null}
        </div>
        <ChartTimeframeSelector value={timeframe} onChange={setTimeframe} className="mt-2 w-full min-[390px]:ml-auto min-[390px]:w-56" />
      </div>
      <div className="relative" aria-busy={isLoading}>
        <div
          ref={setContainerRef}
          className="w-full"
          role="img"
          aria-label={`${snapshot.symbol} ${timeframeLabel} 캔들과 조건선, 가격대, 구조 신호 차트`}
          aria-describedby={compact && legendItems.length ? legendId : undefined}
        />
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-ui-panel/80 px-4 text-center text-xs font-semibold text-ui-muted" role="status">
            {timeframeLabel} 확정 봉을 불러오는 중입니다.
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ui-panel/90 px-4 text-center text-xs font-semibold leading-5 text-ui-muted" role="alert">
            <p>{error}</p>
            <button type="button" onClick={retry} className="min-h-11 rounded-ui-sm bg-ui-inset px-3 font-black text-ui-text">다시 불러오기</button>
          </div>
        ) : candles.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center bg-ui-panel/90 px-4 text-center text-xs font-semibold leading-5 text-ui-muted" role="status">
            {timeframeLabel} 확정 봉을 확인하지 못했습니다. 판단 상태와 저장 조건은 그대로 유지합니다.
          </div>
        ) : null}
      </div>
      {compact && legendItems.length ? <PerpetualChartLegend id={legendId} items={legendItems} /> : null}
    </section>
  );
}
