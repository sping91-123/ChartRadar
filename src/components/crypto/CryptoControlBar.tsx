"use client";
// 코인 레이더 상단 고정 컨트롤 바를 조합하는 controlled component입니다.
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
    <div
      data-testid="crypto-control-bar"
      className="sticky top-0 z-40 border-b border-ui-line bg-ui-canvas py-2 shadow-none backdrop-blur"
    >
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
