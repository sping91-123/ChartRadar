import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { DirectionState } from "@/lib/marketAnalysis";

export function HomeTimeframeDirection({ direction }: { direction: DirectionState }) {
  const copy = direction === "bullish"
    ? { label: "상승", tone: "text-ui-long", icon: ArrowUp }
    : direction === "bearish"
      ? { label: "하락", tone: "text-ui-short", icon: ArrowDown }
      : direction === "neutral"
        ? { label: "중립", tone: "text-ui-watch", icon: Minus }
        : { label: "확인 중", tone: "text-ui-subtle", icon: Minus };
  const Icon = copy.icon;
  return (
    <span className={`mt-0.5 inline-flex items-center justify-center gap-0.5 ${copy.tone}`} aria-label={copy.label}>
      <Icon size={14} strokeWidth={2.6} aria-hidden />
      <span className="text-[10px] font-black">{copy.label}</span>
    </span>
  );
}
