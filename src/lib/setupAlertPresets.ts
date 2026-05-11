// 레이더 TOP 감지를 사용자가 다시 볼 감시 조건으로 저장하는 브라우저 저장 로직이다.
import type { ScoutSetup } from "@/lib/setupScout";

export interface SetupAlertPreset {
  id: string;
  symbol: string;
  mode?: ScoutSetup["mode"];
  timeframe: string;
  side: ScoutSetup["plan"]["side"];
  quality: ScoutSetup["plan"]["quality"];
  score: number;
  headline: string;
  savedAt: number;
}

export interface SetupAlertMatch {
  id: string;
  preset: SetupAlertPreset;
  setup: {
    symbol: string;
    mode: ScoutSetup["mode"];
    timeframe: string;
    side: ScoutSetup["plan"]["side"];
    quality: ScoutSetup["plan"]["quality"];
    score: number;
    headline: string;
    scannedAt: string;
  };
  matchedAt: number;
}

export const SETUP_ALERT_PRESETS_STORAGE_KEY = "chart-radar.setupAlertPresets.v1";
export const SETUP_ALERT_MATCHES_STORAGE_KEY = "chart-radar.setupAlertMatches.v1";
export const SETUP_ALERT_PRESETS_CHANGED_EVENT = "chart-radar:setup-alert-presets";
export const SETUP_ALERT_MATCHES_CHANGED_EVENT = "chart-radar:setup-alert-matches";
export const REQUEST_SETUP_ALERT_CHECK_EVENT = "chart-radar:request-setup-alert-check";
export const SETUP_ALERT_CHECK_FINISHED_EVENT = "chart-radar:setup-alert-check-finished";

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
  window.dispatchEvent(new CustomEvent(SETUP_ALERT_PRESETS_CHANGED_EVENT));
}

export function buildSetupAlertPreset(setup: ScoutSetup): SetupAlertPreset {
  return {
    id: getSetupAlertPresetId(setup),
    symbol: setup.symbol,
    mode: setup.mode,
    timeframe: setup.timeframe,
    side: setup.plan.side,
    quality: setup.plan.quality,
    score: setup.score,
    headline: setup.headline,
    savedAt: Date.now()
  };
}

export function findSetupAlertMatches(presets: SetupAlertPreset[], setups: ScoutSetup[]): SetupAlertMatch[] {
  const matches: SetupAlertMatch[] = [];
  const usedPresetIds = new Set<string>();

  for (const preset of presets) {
    const match = setups.find((setup) => {
      if (setup.symbol !== preset.symbol) return false;
      if (setup.timeframe !== preset.timeframe) return false;
      if (setup.plan.side !== preset.side) return false;
      if (preset.mode && setup.mode !== preset.mode) return false;
      if (setup.score < Math.max(50, preset.score - 5)) return false;
      return setup.status === "entry" || setup.status === "active" || setup.proximity === "ready" || setup.proximity === "near";
    });

    if (!match || usedPresetIds.has(preset.id)) continue;
    usedPresetIds.add(preset.id);
    matches.push({
      id: `${preset.id}:${match.scannedAt}:${match.score}`,
      preset,
      setup: {
        symbol: match.symbol,
        mode: match.mode,
        timeframe: match.timeframe,
        side: match.plan.side,
        quality: match.plan.quality,
        score: match.score,
        headline: match.headline,
        scannedAt: match.scannedAt
      },
      matchedAt: Date.now()
    });
  }

  return matches;
}

export function readSetupAlertMatches(): SetupAlertMatch[] {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(SETUP_ALERT_MATCHES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is SetupAlertMatch => {
      if (!item || typeof item !== "object") return false;
      const match = item as Partial<SetupAlertMatch>;
      return typeof match.id === "string" && typeof match.matchedAt === "number" && Boolean(match.preset) && Boolean(match.setup);
    });
  } catch {
    return [];
  }
}

export function writeSetupAlertMatches(matches: SetupAlertMatch[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(SETUP_ALERT_MATCHES_STORAGE_KEY, JSON.stringify(matches.slice(0, 20)));
  window.dispatchEvent(new CustomEvent(SETUP_ALERT_MATCHES_CHANGED_EVENT));
}
