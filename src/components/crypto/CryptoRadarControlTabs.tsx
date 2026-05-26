// 코인 레이더 타임프레임과 분석 모드 탭 묶음을 담당하는 controlled component입니다.
import type { ChartTimeframe } from "@/lib/marketAnalysis";
import type { RadarProfile } from "@/components/crypto/types";
import { CryptoModeTabs } from "@/components/crypto/CryptoModeTabs";
import { CryptoTimeframeTabs } from "@/components/crypto/CryptoTimeframeTabs";

interface CryptoModeOption {
  key: RadarProfile;
  label: string;
  description: string;
}

interface CryptoRadarControlTabsProps {
  timeframes: ChartTimeframe[];
  activeTimeframe: ChartTimeframe;
  onTimeframeChange: (timeframe: ChartTimeframe) => void;
  modes: CryptoModeOption[];
  activeMode: RadarProfile;
  onModeChange: (mode: RadarProfile) => void;
}

export function CryptoRadarControlTabs({
  timeframes,
  activeTimeframe,
  onTimeframeChange,
  modes,
  activeMode,
  onModeChange
}: CryptoRadarControlTabsProps) {
  return (
    <>
      <CryptoTimeframeTabs timeframes={timeframes} activeTimeframe={activeTimeframe} onChange={onTimeframeChange} />
      <CryptoModeTabs options={modes} activeMode={activeMode} onChange={onModeChange} />
    </>
  );
}
