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
          className={`min-h-8 border-b-2 px-2 text-xs font-black transition sm:min-h-10 sm:text-sm ${
            activeTimeframe === timeframe
              ? "border-accent-blue bg-transparent text-accent-blue"
              : "border-transparent bg-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          {timeframe}
        </button>
      ))}
    </div>
  );
}
