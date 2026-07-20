"use client";

import { useEffect, useRef } from "react";
import { CandlestickSeries, ColorType, LineStyle, createChart } from "lightweight-charts";
import type { PerpetualDecisionSnapshot } from "@/lib/perpetualDecisionSnapshot";

export function PerpetualDecisionChart({ snapshot, compact = false }: { snapshot: PerpetualDecisionSnapshot; compact?: boolean }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: compact ? 172 : 280,
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
        title: condition.role === "primary" ? "다음 확인" : condition.role === "confirmation" ? "추가 확인" : "판단 변경"
      });
    });
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

  return <div ref={containerRef} className="w-full" role="img" aria-label={`${snapshot.symbol} 15분 확정 캔들과 판단 조건 차트`} />;
}
