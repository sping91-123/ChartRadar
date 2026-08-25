"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type IPriceLine,
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
import { hasQualifiedMssSemantics, type PerpetualDecisionSnapshot } from "@/lib/perpetualDecisionSnapshot";

function lightweightLineStyle(style: PerpetualChartLineStyle) {
  if (style === "dashed") return LineStyle.Dashed;
  if (style === "dotted") return LineStyle.Dotted;
  return LineStyle.Solid;
}

function seriesMarker(marker: ResolvedPerpetualChartMarker, showText: boolean, qualifiedMssSemantics: boolean): SeriesMarker<Time> {
  return {
    time: marker.time as Time,
    position: marker.position,
    color: marker.color,
    shape: marker.shape,
    ...(showText ? { text: marker.kind === "mss" ? "새 추세" : marker.kind === "msb" ? qualifiedMssSemantics ? "추세 지속" : "가격 구조" : qualifiedMssSemantics ? "전환 주의" : "전환 신호" } : {})
  };
}

export function PerpetualDecisionChart({ snapshot, compact = false }: { snapshot: PerpetualDecisionSnapshot; compact?: boolean }) {
  const qualifiedMssSemantics = hasQualifiedMssSemantics(snapshot);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const [compactCandleLimit, setCompactCandleLimit] = useState(48);
  const [showMarkerText, setShowMarkerText] = useState(false);
  const [showAllOverlays, setShowAllOverlays] = useState(!compact);
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
    if (!container || container.clientWidth <= 0) return;
    setShowMarkerText(!compact && container.clientWidth >= 520);
    if (compact) {
      const measuredLimit = compactPerpetualCandleLimit(container.clientWidth);
      setCompactCandleLimit((current) => current === measuredLimit ? current : measuredLimit);
    }
  }, [compact]);
  const legendId = `perpetual-chart-legend-${useId().replace(/:/g, "")}`;
  const fullOverlayModel = useMemo(() => buildPerpetualChartOverlayModel(snapshot, timeframe), [snapshot, timeframe]);
  const primaryLineId = `condition-${snapshot.summary.primaryCondition.id}`;
  const coreLine = fullOverlayModel.lines.find((line) => line.id === primaryLineId)
    ?? fullOverlayModel.lines.find((line) => line.group === "condition");
  const coreLineId = coreLine?.id ?? null;
  const hasAdvancedOverlays = fullOverlayModel.lines.some((line) => line.id !== coreLineId) || fullOverlayModel.markers.length > 0;
  const overlayModel = useMemo(() => {
    if (!compact || showAllOverlays) return fullOverlayModel;
    return {
      lines: fullOverlayModel.lines.filter((line) => line.id === coreLineId),
      legendItems: fullOverlayModel.legendItems.filter((item) => item.id === coreLineId),
      markers: []
    };
  }, [compact, coreLineId, fullOverlayModel, showAllOverlays]);
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
    () => [...overlayModel.legendItems, ...buildPerpetualSignalLegendItems(allResolvedMarkers, visibleMarkerIds, !qualifiedMssSemantics)],
    [allResolvedMarkers, overlayModel.legendItems, qualifiedMssSemantics, visibleMarkerIds]
  );
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: compact ? 240 : 360,
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
      wickDownColor: "#fb7185",
      // The compact Home chart already shows the live price in the decision card.
      // Hiding the closed-candle value here keeps it from colliding with the
      // actionable condition label on narrow screens.
      lastValueVisible: !compact,
      priceLineVisible: !compact
    });
    const markers = createSeriesMarkers(series, []);
    chartRef.current = chart;
    seriesRef.current = series;
    markersRef.current = markers;

    const resize = () => {
      const width = container.clientWidth;
      if (width <= 0) return;
      chart.applyOptions({ width, height: compact ? 240 : 360 });
      const nextShowMarkerText = !compact && width >= 520;
      setShowMarkerText((current) => current === nextShowMarkerText ? current : nextShowMarkerText);
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
      priceLinesRef.current = [];
      chart.remove();
    };
  }, [compact]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    const priceLines = overlayModel.lines.map((line) => series.createPriceLine({
      price: line.price,
      color: line.color,
      lineWidth: line.lineWidth,
      lineStyle: lightweightLineStyle(line.lineStyle),
      axisLabelVisible: line.axisLabelVisible,
      title: ""
    }));
    priceLinesRef.current = priceLines;

    return () => {
      if (seriesRef.current !== series) return;
      priceLines.forEach((line) => series.removePriceLine(line));
      if (priceLinesRef.current === priceLines) priceLinesRef.current = [];
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
    markers.setMarkers(resolvedMarkers.map((marker) => seriesMarker(marker, showMarkerText, qualifiedMssSemantics)));
    chart.timeScale().fitContent();
  }, [qualifiedMssSemantics, resolvedMarkers, showMarkerText, visibleCandles]);

  const timeframeLabel = chartViewTimeframeLabels[timeframe];

  return (
    <section aria-label={`${snapshot.symbol} ${timeframeLabel} 차트`} data-pull-to-refresh-ignore="">
      <div className={`mb-2 ${compact ? "px-2" : ""}`}>
        <div className="flex min-h-11 items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-black text-ui-text">{timeframeLabel}봉에서 가격과 흐름 확인</p>
            {compact ? <p className="mt-0.5 text-[10px] leading-4 text-ui-subtle">{showAllOverlays && hasAdvancedOverlays ? "반응 가격대와 흐름 신호까지 표시 중" : coreLineId ? "이 시간대에서 가장 먼저 볼 가격만 표시" : "이 시간대에 표시할 판단 가격 없음"}</p> : null}
          </div>
          {compact && hasAdvancedOverlays ? (
            <button
              type="button"
              aria-pressed={showAllOverlays}
              onClick={() => setShowAllOverlays((current) => !current)}
              className="min-h-11 shrink-0 rounded-ui-sm bg-ui-inset px-2.5 text-[10px] font-black text-ui-text"
            >
              {showAllOverlays ? "핵심만 보기" : "가격대·흐름 보기"}
            </button>
          ) : null}
        </div>
        <ChartTimeframeSelector value={timeframe} onChange={setTimeframe} className="mt-2 w-full min-[390px]:ml-auto min-[390px]:w-56" />
      </div>
      <div className="relative" aria-busy={isLoading}>
        <div
          ref={setContainerRef}
          className="w-full"
          role="img"
          aria-label={`${snapshot.symbol} ${timeframeLabel} 캔들과 다음에 볼 가격, 반응 가격대, 가격 흐름 신호 차트`}
          aria-describedby={legendItems.length ? legendId : undefined}
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
      {legendItems.length ? <PerpetualChartLegend id={legendId} items={legendItems} timeframeLabel={timeframeLabel} /> : null}
    </section>
  );
}
