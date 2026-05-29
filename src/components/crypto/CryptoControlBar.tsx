// 코인 레이더 모바일 하단 컨트롤 바를 조합하는 controlled component입니다.
import type { ChartTimeframe } from "@/lib/marketAnalysis";
import type { RadarProfile } from "@/components/crypto/types";
import { CryptoRadarControlTabs } from "@/components/crypto/CryptoRadarControlTabs";

interface CryptoModeOption {
  key: RadarProfile;
  label: string;
  description: string;
}

interface CryptoControlBarProps {
  timeframes: ChartTimeframe[];
  activeTimeframe: ChartTimeframe;
  onTimeframeChange: (timeframe: ChartTimeframe) => void;
  modes: CryptoModeOption[];
  activeMode: RadarProfile;
  onModeChange: (mode: RadarProfile) => void;
}

export function CryptoControlBar({
  timeframes,
  activeTimeframe,
  onTimeframeChange,
  modes,
  activeMode,
  onModeChange
}: CryptoControlBarProps) {
  return (
    <div className="fixed inset-x-2 bottom-2 z-40 mx-auto max-w-5xl border-y border-white/10 bg-slate-950 px-1.5 py-2 shadow-none sm:inset-x-3 sm:px-2">
      <div className="mx-auto max-w-5xl">
        <CryptoRadarControlTabs
          timeframes={timeframes}
          activeTimeframe={activeTimeframe}
          onTimeframeChange={onTimeframeChange}
          modes={modes}
          activeMode={activeMode}
          onModeChange={onModeChange}
        />
      </div>
    </div>
  );
}
