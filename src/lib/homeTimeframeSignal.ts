import type { DirectionState } from "@/lib/marketAnalysis";

export type HomeTimeframeSignalState =
  | "bullish_supported"
  | "bearish_supported"
  | "bullish"
  | "bearish"
  | "bullish_reversal_warning"
  | "bearish_reversal_warning"
  | "conflict"
  | "neutral"
  | "unknown";

export interface HomeTimeframeSignalInput {
  trend: DirectionState;
  continuation: DirectionState;
  warning: DirectionState;
  known?: boolean;
}

export interface HomeTimeframeSignal extends HomeTimeframeSignalInput {
  state: HomeTimeframeSignalState;
  known: boolean;
}

function isDirectional(direction: DirectionState): direction is "bullish" | "bearish" {
  return direction === "bullish" || direction === "bearish";
}

export function resolveHomeTimeframeSignal(input: HomeTimeframeSignalInput): HomeTimeframeSignal {
  const known = input.known ?? (input.trend !== "unknown");
  const result = { ...input, known };

  if (!known) return { ...result, state: "unknown" };

  if (isDirectional(input.continuation) && (!isDirectional(input.trend) || input.continuation !== input.trend)) {
    return { ...result, state: "conflict" };
  }

  if (isDirectional(input.warning)) {
    if (!isDirectional(input.trend) || input.warning === input.trend) return { ...result, state: "conflict" };
    return {
      ...result,
      state: input.warning === "bullish" ? "bullish_reversal_warning" : "bearish_reversal_warning"
    };
  }

  if (isDirectional(input.continuation)) {
    return {
      ...result,
      state: input.trend === "bullish" ? "bullish_supported" : "bearish_supported"
    };
  }

  if (input.trend === "bullish") return { ...result, state: "bullish" };
  if (input.trend === "bearish") return { ...result, state: "bearish" };
  if (input.trend === "neutral") return { ...result, state: "neutral" };
  return { ...result, state: "unknown" };
}

export function homeTimeframeGroupLabel(signals: HomeTimeframeSignal[]) {
  const trends = signals.map((signal) => signal.known ? signal.trend : "unknown");
  const trendLabel = trends.every((trend) => trend === "bullish")
    ? "둘 다 상승"
    : trends.every((trend) => trend === "bearish")
      ? "둘 다 하락"
      : trends.every((trend) => trend === "unknown")
        ? "둘 다 확인 중"
        : trends.some((trend) => trend === "unknown")
          ? "일부 확인 중"
          : trends.includes("bullish") && trends.includes("bearish")
            ? "방향 엇갈림"
            : trends.every((trend) => trend === "neutral")
              ? "둘 다 뚜렷하지 않음"
              : "한쪽만 방향 확인";

  if (signals.some((signal) => signal.state === "conflict")) return `${trendLabel} · 신호 점검`;

  const warningDirections = signals
    .filter((signal) => signal.state === "bullish_reversal_warning" || signal.state === "bearish_reversal_warning")
    .map((signal) => signal.warning);
  if (warningDirections.length > 0) {
    if (warningDirections.every((direction) => direction === "bullish")) return `${trendLabel} · 상승 전환 주의`;
    if (warningDirections.every((direction) => direction === "bearish")) return `${trendLabel} · 하락 전환 주의`;
    return `${trendLabel} · 전환 주의`;
  }
  return trendLabel;
}
