// 레이더 TOP 감지를 사용자가 다시 볼 감시 조건으로 저장하는 브라우저 저장 로직이다.
import type { ScoutSetup } from "@/lib/setupScout";

export interface SetupAlertPreset {
  id: string;
  symbol: string;
  timeframe: string;
  side: ScoutSetup["plan"]["side"];
  quality: ScoutSetup["plan"]["quality"];
  score: number;
  headline: string;
  savedAt: number;
}

export const SETUP_ALERT_PRESETS_STORAGE_KEY = "chart-radar.setupAlertPresets.v1";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getSetupAlertPresetId(setup: Pick<ScoutSetup, "symbol" | "timeframe" | "mode" | "plan">) {
  return `${setup.symbol}:${setup.timeframe}:${setup.mode}:${setup.plan.side}`;
}

export function readSetupAlertPresets(): SetupAlertPreset[] {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(SETUP_ALERT_PRESETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is SetupAlertPreset => {
      if (!item || typeof item !== "object") return false;
      const preset = item as Partial<SetupAlertPreset>;
      return (
        typeof preset.id === "string" &&
        typeof preset.symbol === "string" &&
        typeof preset.timeframe === "string" &&
        (preset.side === "long" || preset.side === "short") &&
        (preset.quality === "A" || preset.quality === "B" || preset.quality === "C") &&
        typeof preset.score === "number" &&
        typeof preset.headline === "string" &&
        typeof preset.savedAt === "number"
      );
    });
  } catch {
    return [];
  }
}

export function writeSetupAlertPresets(presets: SetupAlertPreset[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(SETUP_ALERT_PRESETS_STORAGE_KEY, JSON.stringify(presets.slice(0, 20)));
  window.dispatchEvent(new CustomEvent("chart-radar:setup-alert-presets"));
}

export function buildSetupAlertPreset(setup: ScoutSetup): SetupAlertPreset {
  return {
    id: getSetupAlertPresetId(setup),
    symbol: setup.symbol,
    timeframe: setup.timeframe,
    side: setup.plan.side,
    quality: setup.plan.quality,
    score: setup.score,
    headline: setup.headline,
    savedAt: Date.now()
  };
}
