"use client";
// 코인 레이더 모바일 하단 컨트롤 바를 조합하는 controlled component입니다.
import { useEffect, useState } from "react";
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
  const [isChartSectionVisible, setIsChartSectionVisible] = useState(true);

  useEffect(() => {
    const target = document.getElementById("basic-coins");
    if (!target || !("IntersectionObserver" in window)) {
      setIsChartSectionVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsChartSectionVisible(entry.isIntersecting);
      },
      { root: null, threshold: 0.03 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  if (!isChartSectionVisible) return null;

  return (
    <div
      data-testid="crypto-control-bar"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto border-t border-ui-line bg-ui-canvas/95 px-3 pb-[calc(0.35rem+env(safe-area-inset-bottom))] pt-1.5 shadow-none sm:inset-x-3 sm:bottom-2 sm:max-w-5xl sm:border-y sm:px-2 sm:py-2"
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
