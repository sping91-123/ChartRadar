import type { Candle, ChartTimeframe } from "@/lib/marketAnalysis";

export const chartViewTimeframes = ["15m", "1h", "4h"] as const satisfies readonly ChartTimeframe[];

export type ChartViewTimeframe = (typeof chartViewTimeframes)[number];

export const chartViewTimeframeLabels: Record<ChartViewTimeframe, string> = {
  "15m": "15분",
  "1h": "1시간",
  "4h": "4시간"
};

interface ClosedChartCandlesPayload {
  candles?: Candle[];
  error?: string;
}

export async function fetchClosedChartCandles({
  symbol,
  timeframe,
  asOf,
  signal
}: {
  symbol: string;
  timeframe: ChartViewTimeframe;
  asOf: string;
  signal?: AbortSignal;
}) {
  const asOfMs = new Date(asOf).getTime();
  if (!Number.isFinite(asOfMs)) throw new Error("차트 기준 시각을 확인하지 못했습니다.");

  const params = new URLSearchParams({
    symbol,
    timeframe,
    limit: "97",
    closedOnly: "1",
    futuresOnly: "1",
    endTime: String(asOfMs)
  });
  const response = await fetch(`/data/candles?${params.toString()}`, { cache: "no-store", signal });
  const payload = (await response.json().catch(() => ({}))) as ClosedChartCandlesPayload;
  if (!response.ok || !Array.isArray(payload.candles)) {
    throw new Error(payload.error ?? `${chartViewTimeframeLabels[timeframe]} 차트를 불러오지 못했습니다.`);
  }
  return payload.candles.slice(-96);
}
