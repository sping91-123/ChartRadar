// 코인 레이더 모바일 하단 컨트롤 바를 조합하는 controlled component입니다.
import type { ChartTimeframe } from "@/lib/marketAnalysis";
import type { RadarProfile } from "@/components/crypto/types";
import { CryptoModeTabs } from "@/components/crypto/CryptoModeTabs";
import { CryptoTimeframeTabs } from "@/components/crypto/CryptoTimeframeTabs";

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
    <div className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-5xl rounded-lg border border-surface-line bg-slate-950/92 p-2 shadow-2xl shadow-black/40 backdrop-blur">
      <div className="mx-auto max-w-5xl">
        <CryptoTimeframeTabs timeframes={timeframes} activeTimeframe={activeTimeframe} onChange={onTimeframeChange} />
        <CryptoModeTabs options={modes} activeMode={activeMode} onChange={onModeChange} />
      </div>
    </div>
  );
}
