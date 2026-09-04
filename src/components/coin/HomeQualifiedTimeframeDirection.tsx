import { AlertTriangle, ArrowDown, ArrowUp, Minus } from "lucide-react";
import { resolveHomeTimeframeSignal, type HomeTimeframeSignalInput } from "@/lib/homeTimeframeSignal";
import type { DirectionState } from "@/lib/marketAnalysis";

const confirmedTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

function confirmedTrendText(direction: DirectionState, known: boolean) {
  if (!known || direction === "unknown") return "확정 추세 · 확인 중";
  if (direction === "bullish") return "확정 추세 · 상승";
  if (direction === "bearish") return "확정 추세 · 하락";
  return "확정 추세 · 중립";
}

function continuationText(direction: DirectionState, known: boolean) {
  if (!known || direction === "unknown") return "추세 지속 확인 중";
  if (direction === "bullish") return "상승 흐름 지속";
  if (direction === "bearish") return "하락 흐름 지속";
  return "추세 지속 신호 없음";
}

function transitionText(direction: DirectionState, known: boolean) {
  if (!known || direction === "unknown") return "전환 주의 확인 중";
  if (direction === "bullish") return "상승 전환 주의";
  if (direction === "bearish") return "하락 전환 주의";
  return "전환 주의 신호 없음";
}

function directionTone(direction: DirectionState) {
  if (direction === "bullish") return "text-ui-long";
  if (direction === "bearish") return "text-ui-short";
  if (direction === "neutral") return "text-ui-muted";
  return "text-ui-subtle";
}

function formatConfirmedTime(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return confirmedTimeFormatter.format(date);
}

export function HomeQualifiedTimeframeDirection({
  trend,
  continuation,
  warning,
  known,
  observedAt
}: HomeTimeframeSignalInput & { observedAt?: string | null }) {
  const signal = resolveHomeTimeframeSignal({ trend, continuation, warning, known });
  const visibleTrend = signal.known ? signal.trend : "unknown";
  const trendCopy = visibleTrend === "bullish"
    ? { label: "상승", tone: "text-ui-long", icon: ArrowUp }
    : visibleTrend === "bearish"
      ? { label: "하락", tone: "text-ui-short", icon: ArrowDown }
      : visibleTrend === "neutral"
        ? { label: "중립", tone: "text-ui-watch", icon: Minus }
        : { label: "확인 중", tone: "text-ui-subtle", icon: Minus };
  const Icon = trendCopy.icon;
  const confirmedTime = formatConfirmedTime(observedAt);
  const confirmedTrendCopy = confirmedTrendText(signal.trend, signal.known);
  const continuationCopy = continuationText(signal.continuation, signal.known);
  const transitionCopy = transitionText(signal.warning, signal.known);
  const transitionIsActive = signal.known && (signal.warning === "bullish" || signal.warning === "bearish");
  const needsSignalCheck = signal.state === "conflict";
  const accessibleCopy = [
    confirmedTrendCopy,
    continuationCopy,
    transitionCopy,
    needsSignalCheck ? "신호 조합 점검 필요" : null,
    confirmedTime ? `${confirmedTime} KST · 확정봉` : null
  ].filter(Boolean).join(", ");

  return (
    <span className="mt-0.5 inline-flex flex-col items-center justify-center">
      <span className="sr-only">{accessibleCopy}</span>
      <span className={`inline-flex items-center justify-center gap-0.5 ${trendCopy.tone}`} aria-hidden>
        <Icon size={14} strokeWidth={2.6} />
        <span className="text-[10px] font-black">{trendCopy.label}</span>
      </span>
      {needsSignalCheck ? (
        <span className="mt-0.5 inline-flex items-center justify-center gap-0.5 text-[10px] font-black leading-4 text-ui-watch" aria-hidden>
          <AlertTriangle size={11} strokeWidth={2.5} />
          신호 조합 점검 필요
        </span>
      ) : null}
      <span className="mt-1 grid text-[10px] font-bold leading-4" aria-hidden>
        <span className={directionTone(signal.known ? signal.trend : "unknown")}>{confirmedTrendCopy}</span>
        <span className={directionTone(signal.known ? signal.continuation : "unknown")}>{continuationCopy}</span>
        <span className={`inline-flex items-center justify-center gap-0.5 ${directionTone(signal.known ? signal.warning : "unknown")}`}>
          {transitionIsActive ? <AlertTriangle size={10} strokeWidth={2.5} /> : null}
          {transitionCopy}
        </span>
      </span>
      {confirmedTime ? <time dateTime={observedAt ?? undefined} className="mt-1 text-[10px] font-semibold leading-4 text-ui-subtle" aria-hidden>{confirmedTime} KST · 확정봉</time> : null}
    </span>
  );
}
