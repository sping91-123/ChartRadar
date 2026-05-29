import type { Time } from "lightweight-charts";
import type { Candle } from "@/lib/marketAnalysis";
import {
  defaultOverlaySettings,
  legacyOverlaySettingsStorageKeys,
  overlayPresets,
  overlaySettingsStorageKey,
  structureSensitivityOptions
} from "@/components/crypto/constants";
import { readLocalStorageWithLegacy } from "@/components/crypto/dataHelpers";
import type { OverlaySettings, StructureSensitivity } from "@/components/crypto/types";

const kstOffsetSeconds = 9 * 3600;

export function toKstTime(utcSec: number): Time {
  return (utcSec + kstOffsetSeconds) as unknown as Time;
}

export function candleTimeAt(candles: Candle[], index: number): Time | null {
  if (index < 0 || index >= candles.length) return null;
  return toKstTime(candles[index].time);
}

export function readOverlaySettings(): OverlaySettings {
  if (typeof window === "undefined") return defaultOverlaySettings;

  try {
    const raw = readLocalStorageWithLegacy(overlaySettingsStorageKey, legacyOverlaySettingsStorageKeys);
    if (!raw) return defaultOverlaySettings;
    const parsed = JSON.parse(raw) as Partial<OverlaySettings>;
    return { ...defaultOverlaySettings, ...parsed };
  } catch {
    return defaultOverlaySettings;
  }
}

export function overlayPresetMatches(settings: OverlaySettings, preset: keyof typeof overlayPresets) {
  const target = overlayPresets[preset];
  return (Object.keys(target) as Array<keyof OverlaySettings>).every((key) => settings[key] === target[key]);
}

export function structureSensitivityLabel(value: StructureSensitivity) {
  return structureSensitivityOptions.find((item) => item.value === value)?.label ?? "빠른 변화 감지";
}
