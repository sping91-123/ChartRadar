// 코인 레이더 타임프레임 탭 UI를 담당하는 controlled component입니다.
import type { ChartTimeframe } from "@/lib/marketAnalysis";

interface CryptoTimeframeTabsProps {
  timeframes: ChartTimeframe[];
  activeTimeframe: ChartTimeframe;
  onChange: (timeframe: ChartTimeframe) => void;
}

export function CryptoTimeframeTabs({ timeframes, activeTimeframe, onChange }: CryptoTimeframeTabsProps) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {timeframes.map((timeframe) => (
        <button
          key={timeframe}
          type="button"
          onClick={() => onChange(timeframe)}
          className={`min-h-10 rounded-md border px-2 text-sm font-black transition ${
            activeTimeframe === timeframe
              ? "border-accent-blue bg-accent-blue text-slate-950"
              : "border-surface-line bg-surface-cardSoft text-slate-300 hover:border-accent-blue/60"
          }`}
        >
          {timeframe}
        </button>
      ))}
    </div>
  );
}
