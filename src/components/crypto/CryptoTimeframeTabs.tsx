// 코인 레이더 타임프레임 탭 UI를 담당하는 controlled component입니다.
import type { ChartTimeframe } from "@/lib/marketAnalysis";

interface CryptoTimeframeTabsProps {
  timeframes: ChartTimeframe[];
  activeTimeframe: ChartTimeframe;
  onChange: (timeframe: ChartTimeframe) => void;
}

export function CryptoTimeframeTabs({ timeframes, activeTimeframe, onChange }: CryptoTimeframeTabsProps) {
  return (
    <div className="grid grid-cols-5 gap-1">
      {timeframes.map((timeframe) => (
        <button
          key={timeframe}
          type="button"
          onClick={() => onChange(timeframe)}
          className={`min-h-8 rounded-ui-sm px-2 text-xs font-semibold transition sm:min-h-9 sm:text-sm ${activeTimeframe === timeframe ? "bg-ui-active text-ui-text" : "text-ui-muted hover:bg-ui-inset/60 hover:text-ui-text"}`}
        >
          {timeframe}
        </button>
      ))}
    </div>
  );
}
