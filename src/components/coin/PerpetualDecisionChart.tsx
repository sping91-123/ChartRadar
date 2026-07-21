"use client";

import { useEffect, useRef } from "react";
import { CandlestickSeries, ColorType, LineStyle, createChart, createSeriesMarkers, type SeriesMarker, type Time } from "lightweight-charts";
import type { PerpetualDecisionSnapshot } from "@/lib/perpetualDecisionSnapshot";

function markerTime(occurredAt: string | null, candleTimes: Set<number>) {
  if (!occurredAt) return null;
  const parsed = Date.parse(occurredAt);
  if (!Number.isFinite(parsed)) return null;
  const seconds = Math.floor(parsed / 1000);
  return candleTimes.has(seconds) ? (seconds as Time) : null;
}

export function PerpetualDecisionChart({ snapshot, compact = false }: { snapshot: PerpetualDecisionSnapshot; compact?: boolean }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

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
      timeScale: { borderColor: "rgba(148,163,184,0.16)", timeVisible: true, secondsVisible: false },
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
    series.setData(snapshot.chart.candles.map((candle) => ({
      time: candle.time as never,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close
    })));
    const conditions = [
      snapshot.summary.primaryCondition,
      ...(snapshot.pro?.confirmationConditions ?? []),
      ...(snapshot.pro?.invalidationConditions ?? [])
    ];
    conditions.forEach((condition) => {
      if (condition.threshold === null || !Number.isFinite(condition.threshold)) return;
      series.createPriceLine({
        price: condition.threshold,
        color: condition.role === "invalidation" ? "#fb7185" : condition.role === "confirmation" ? "#60a5fa" : "#fbbf24",
        lineWidth: 1,
        lineStyle: condition.role === "primary" ? LineStyle.Solid : LineStyle.Dashed,
        axisLabelVisible: true,
        title: condition.role === "primary" ? "먼저 확인" : condition.role === "confirmation" ? "추가 확인" : "해석 재확인"
      });
    });

    const primaryEvidence = snapshot.pro?.multiTimeframeEvidence.find((item) => item.timeframe === "15m");
    const details = primaryEvidence?.details;
    if (details) {
      const candleTimes = new Set(snapshot.chart.candles.map((candle) => candle.time));
      const markers: SeriesMarker<Time>[] = [];
      const msbTime = markerTime(details.events.msb?.occurredAt ?? null, candleTimes);
      if (msbTime && details.events.msb) {
        markers.push({
          time: msbTime,
          position: details.events.msb.direction === "bullish" ? "belowBar" : "aboveBar",
          color: details.events.msb.direction === "bullish" ? "#34d399" : "#fb7185",
          shape: details.events.msb.direction === "bullish" ? "arrowUp" : "arrowDown",
          text: "추세 확인"
        });
      }
      const chochTime = markerTime(details.events.choch?.occurredAt ?? null, candleTimes);
      if (chochTime && details.events.choch) {
        markers.push({
          time: chochTime,
          position: details.events.choch.direction === "bullish" ? "belowBar" : "aboveBar",
          color: "#fbbf24",
          shape: "circle",
          text: "전환 가능"
        });
      }
      if (markers.length) {
        markers.sort((left, right) => Number(left.time) - Number(right.time));
        createSeriesMarkers(series, markers);
      }

      const zoneLines = [
        ...(details.zones.orderBlock
          ? [
              { price: details.zones.orderBlock.top, color: "#2dd4bf", title: "큰 주문 구간 위" },
              { price: details.zones.orderBlock.bottom, color: "#2dd4bf", title: "큰 주문 구간 아래" }
            ]
          : []),
        ...(details.zones.fvg
          ? [
              { price: details.zones.fvg.top, color: "#38bdf8", title: "빠른 이동 구간 위" },
              { price: details.zones.fvg.bottom, color: "#38bdf8", title: "빠른 이동 구간 아래" }
            ]
          : []),
        details.location.poc
          ? { price: details.location.poc.poc, color: "#f59e0b", title: "거래 집중 가격" }
          : null
      ].filter((line): line is { price: number; color: string; title: string } => Boolean(line && Number.isFinite(line.price)));
      zoneLines.forEach((line) => series.createPriceLine({
        price: line.price,
        color: line.color,
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: line.title
      }));
    }
    chart.timeScale().fitContent();

    const observer = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth });
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      chart.remove();
    };
  }, [compact, snapshot]);

  if (snapshot.chart.candles.length === 0) {
    return (
      <div className="flex min-h-36 items-center justify-center bg-ui-inset/55 px-4 text-center text-xs font-semibold leading-5 text-ui-muted" role="status">
        확정 캔들 차트를 불러오지 못했습니다. 판단 상태와 저장 조건은 그대로 유지합니다.
      </div>
    );
  }

  return <div ref={containerRef} className="w-full" role="img" aria-label={`${snapshot.symbol} 15분 캔들, 추세 변화, 확인 가격 차트`} />;
}
