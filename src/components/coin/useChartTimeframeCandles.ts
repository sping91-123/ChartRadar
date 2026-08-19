"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchClosedChartCandles,
  type ChartViewTimeframe
} from "@/lib/chartTimeframeView";
import type { Candle } from "@/lib/marketAnalysis";

type CandleCache = Partial<Record<ChartViewTimeframe, Candle[]>>;

interface CandleCacheState {
  key: string;
  candles: CandleCache;
}

interface RequestState {
  key: string;
  status: "loading" | "error";
  message: string | null;
}

export function useChartTimeframeCandles({
  cacheKey,
  symbol,
  asOf,
  initialCandles,
  initialCandlesByTimeframe,
  allowRemoteFetch = true
}: {
  cacheKey: string;
  symbol: string;
  asOf: string;
  initialCandles: Candle[];
  initialCandlesByTimeframe?: CandleCache;
  allowRemoteFetch?: boolean;
}) {
  const initialCache = useMemo<CandleCache>(
    () => ({ ...initialCandlesByTimeframe, "15m": initialCandles }),
    [initialCandles, initialCandlesByTimeframe]
  );
  const [timeframe, setTimeframe] = useState<ChartViewTimeframe>("15m");
  const [cache, setCache] = useState<CandleCacheState>(() => ({
    key: cacheKey,
    candles: initialCache
  }));
  const [request, setRequest] = useState<RequestState | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const effectiveCache = cache.key === cacheKey ? cache.candles : initialCache;
  const hasSelectedCandles = Object.prototype.hasOwnProperty.call(effectiveCache, timeframe);
  const candles = effectiveCache[timeframe] ?? [];
  const currentRequestKey = `${cacheKey}:${timeframe}:${retryKey}`;
  const error = request?.key === currentRequestKey && request.status === "error" ? request.message : null;
  const isLoading = allowRemoteFetch && timeframe !== "15m" && !hasSelectedCandles && error === null;

  useEffect(() => {
    setCache((current) => {
      if (current.key !== cacheKey) return { key: cacheKey, candles: initialCache };
      if (current.candles["15m"] === initialCandles) return current;
      return {
        key: cacheKey,
        candles: { ...initialCache, ...current.candles, "15m": initialCandles }
      };
    });
  }, [cacheKey, initialCache, initialCandles]);

  useEffect(() => {
    if (!allowRemoteFetch || timeframe === "15m" || hasSelectedCandles) return;

    const controller = new AbortController();
    const requestKey = `${cacheKey}:${timeframe}:${retryKey}`;
    setRequest({ key: requestKey, status: "loading", message: null });
    void fetchClosedChartCandles({ symbol, timeframe, asOf, signal: controller.signal })
      .then((nextCandles) => {
        if (controller.signal.aborted) return;
        setCache((current) => ({
          key: cacheKey,
          candles: {
            ...(current.key === cacheKey ? current.candles : initialCache),
            [timeframe]: nextCandles
          }
        }));
        setRequest(null);
      })
      .catch((caught) => {
        if (controller.signal.aborted) return;
        setRequest({
          key: requestKey,
          status: "error",
          message: caught instanceof Error ? caught.message : "차트를 불러오지 못했습니다."
        });
      });

    return () => controller.abort();
  }, [allowRemoteFetch, asOf, cacheKey, hasSelectedCandles, initialCache, retryKey, symbol, timeframe]);

  return {
    timeframe,
    setTimeframe,
    candles,
    isLoading,
    error,
    retry: () => setRetryKey((current) => current + 1)
  };
}
