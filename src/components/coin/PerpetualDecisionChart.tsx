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
import { PerpetualChartLegend } from "@/components/coin/PerpetualChartLegend";
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
  const setContainerRef = useCallback((container: HTMLDivElement | null) => {
    containerRef.current = container;
    if (!compact || !container || container.clientWidth <= 0) return;
    const measuredLimit = compactPerpetualCandleLimit(container.clientWidth);
    setCompactCandleLimit((current) => current === measuredLimit ? current : measuredLimit);
  }, [compact]);
  const legendId = `perpetual-chart-legend-${useId().replace(/:/g, "")}`;
  const overlayModel = useMemo(() => buildPerpetualChartOverlayModel(snapshot), [snapshot]);
  const visibleCandles = useMemo(
    () => compact ? snapshot.chart.candles.slice(-compactCandleLimit) : snapshot.chart.candles,
    [compact, compactCandleLimit, snapshot.chart.candles]
  );
  const resolvedMarkers = useMemo(
    () => resolvePerpetualChartMarkers(overlayModel.markers, visibleCandles.map((candle) => candle.time)),
    [overlayModel.markers, visibleCandles]
  );
  const allResolvedMarkers = useMemo(
    () => resolvePerpetualChartMarkers(overlayModel.markers, snapshot.chart.candles.map((candle) => candle.time)),
    [overlayModel.markers, snapshot.chart.candles]
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

  if (snapshot.chart.candles.length === 0) {
    return (
      <div className="flex min-h-36 items-center justify-center bg-ui-inset/55 px-4 text-center text-xs font-semibold leading-5 text-ui-muted" role="status">
        확정 캔들 차트를 불러오지 못했습니다. 판단 상태와 저장 조건은 그대로 유지합니다.
      </div>
    );
  }

  return (
    <section aria-label={`${snapshot.symbol} 15분 차트`}>
      {compact ? (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-1 px-2">
          <p className="text-[11px] font-black text-ui-text">15분 차트에서 직접 확인</p>
          <span className="text-[10px] font-semibold text-ui-subtle">
            조건선 {counts.conditions} · 가격대 {counts.zones} · 구조 신호 {counts.signals}
          </span>
        </div>
      ) : null}
      <div
        ref={setContainerRef}
        className="w-full"
        role="img"
        aria-label={`${snapshot.symbol} 15분 캔들과 조건선, 가격대, 구조 신호 차트`}
        aria-describedby={compact && legendItems.length ? legendId : undefined}
      />
      {compact ? <PerpetualChartLegend id={legendId} items={legendItems} /> : null}
    </section>
  );
}
