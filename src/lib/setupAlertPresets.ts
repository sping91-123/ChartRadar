// 레이더 TOP 감지를 사용자가 다시 볼 감시 조건으로 저장하는 브라우저 저장 로직이다.
import type { ScoutSetup, ScoutSetupPayload } from "@/lib/setupScout";

export type SetupAlertMarket = "crypto" | "stocks";

export interface SetupAlertPreset {
  id: string;
  market: SetupAlertMarket;
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
  market: SetupAlertMarket;
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

export interface SetupAlertMonitorStatus {
  market: SetupAlertMarket;
  checkedAt: number;
  presetCount: number;
  setupCount: number;
  matchCount: number;
  reason: "auto" | "manual" | "preset-change" | "visible";
}

export const SETUP_ALERT_PRESETS_STORAGE_KEY = "chart-radar.setupAlertPresets.v1";
export const SETUP_ALERT_MATCHES_STORAGE_KEY = "chart-radar.setupAlertMatches.v1";
export const SETUP_ALERT_MONITOR_STATUS_STORAGE_KEY = "chart-radar.setupAlertMonitorStatus.v1";
export const SETUP_ALERT_PRESETS_CHANGED_EVENT = "chart-radar:setup-alert-presets";
export const SETUP_ALERT_MATCHES_CHANGED_EVENT = "chart-radar:setup-alert-matches";
export const REQUEST_SETUP_ALERT_CHECK_EVENT = "chart-radar:request-setup-alert-check";
export const SETUP_ALERT_CHECK_FINISHED_EVENT = "chart-radar:setup-alert-check-finished";
export const SETUP_ALERT_MONITOR_STATUS_EVENT = "chart-radar:setup-alert-monitor-status";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function marketStorageKey(baseKey: string, market: SetupAlertMarket) {
  return `${baseKey}.${market}`;
}

function storageKeysFor(baseKey: string, market?: SetupAlertMarket) {
  if (market === "stocks") return [marketStorageKey(baseKey, "stocks")];
  if (market === "crypto") return [marketStorageKey(baseKey, "crypto"), baseKey];
  return [marketStorageKey(baseKey, "crypto"), marketStorageKey(baseKey, "stocks"), baseKey];
}

function normalizeMarket(value: unknown): SetupAlertMarket {
  return value === "stocks" ? "stocks" : "crypto";
}

export function getSetupAlertPresetId(
  setup: Pick<ScoutSetup, "symbol" | "timeframe" | "mode" | "plan">,
  market: SetupAlertMarket = "crypto"
) {
  return `${market}:${setup.symbol}:${setup.timeframe}:${setup.mode}:${setup.plan.side}`;
}

function normalizePreset(item: unknown): SetupAlertPreset | null {
  if (!item || typeof item !== "object") return null;
  const preset = item as Partial<SetupAlertPreset>;
  if (
    typeof preset.id !== "string" ||
    typeof preset.symbol !== "string" ||
    typeof preset.timeframe !== "string" ||
    (preset.side !== "long" && preset.side !== "short") ||
    (preset.quality !== "A" && preset.quality !== "B" && preset.quality !== "C") ||
    typeof preset.score !== "number" ||
    typeof preset.headline !== "string" ||
    typeof preset.savedAt !== "number"
  ) {
    return null;
  }

  const market = normalizeMarket(preset.market);
  const hasScopedId = preset.id.startsWith("crypto:") || preset.id.startsWith("stocks:");

  return {
    id: hasScopedId ? preset.id : `${market}:${preset.id}`,
    market,
    symbol: preset.symbol,
    mode: preset.mode,
    timeframe: preset.timeframe,
    side: preset.side,
    quality: preset.quality,
    score: preset.score,
    headline: preset.headline,
    savedAt: preset.savedAt
  };
}

export function readSetupAlertPresets(market?: SetupAlertMarket): SetupAlertPreset[] {
  if (!canUseStorage()) return [];

  const presets: SetupAlertPreset[] = [];
  const seenIds = new Set<string>();

  try {
    for (const key of storageKeysFor(SETUP_ALERT_PRESETS_STORAGE_KEY, market)) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) continue;

      for (const item of parsed) {
        const preset = normalizePreset(item);
        if (!preset) continue;
        if (market && preset.market !== market) continue;
        if (seenIds.has(preset.id)) continue;
        seenIds.add(preset.id);
        presets.push(preset);
      }
    }

    return presets.sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

export function writeSetupAlertPresets(presets: SetupAlertPreset[], market: SetupAlertMarket = "crypto") {
  if (!canUseStorage()) return;
  const scopedPresets = presets
    .map((preset) => ({ ...preset, market, id: preset.id.startsWith(`${market}:`) ? preset.id : `${market}:${preset.id}` }))
    .slice(0, 30);

  window.localStorage.setItem(marketStorageKey(SETUP_ALERT_PRESETS_STORAGE_KEY, market), JSON.stringify(scopedPresets));
  window.dispatchEvent(new CustomEvent(SETUP_ALERT_PRESETS_CHANGED_EVENT, { detail: { market } }));
}

export function buildSetupAlertPreset(setup: ScoutSetup, market: SetupAlertMarket = "crypto"): SetupAlertPreset {
  return {
    id: getSetupAlertPresetId(setup, market),
    market,
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

export function findSetupAlertMatches(
  presets: SetupAlertPreset[],
  setups: Array<ScoutSetup | ScoutSetupPayload>,
  market: SetupAlertMarket = "crypto"
): SetupAlertMatch[] {
  const matches: SetupAlertMatch[] = [];
  const usedPresetIds = new Set<string>();
  const scopedPresets = presets.filter((preset) => preset.market === market);

  for (const preset of scopedPresets) {
    const match = setups.find((setup) => {
      if (setup.symbol !== preset.symbol) return false;
      if (setup.timeframe !== preset.timeframe) return false;
      // Basic payloads intentionally omit the live score and quality evidence.
      // Do not turn a historical preset score into a current alert match.
      if (!("plan" in setup)) return false;
      const side = setup.plan.side;
      if (side !== preset.side) return false;
      if (preset.mode && setup.mode !== preset.mode) return false;
      if (setup.score < Math.max(50, preset.score - 5)) return false;
      return setup.status === "entry" || setup.status === "active" || setup.proximity === "ready" || setup.proximity === "near";
    });

    if (!match || !("plan" in match) || usedPresetIds.has(preset.id)) continue;
    usedPresetIds.add(preset.id);
    matches.push({
      id: `${preset.id}:${match.scannedAt}:${match.score}`,
      market,
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

function normalizeMatch(item: unknown): SetupAlertMatch | null {
  if (!item || typeof item !== "object") return null;
  const match = item as Partial<SetupAlertMatch>;
  const preset = normalizePreset(match.preset);
  if (typeof match.id !== "string" || typeof match.matchedAt !== "number" || !preset || !match.setup) return null;
  const market = normalizeMarket(match.market ?? preset.market);

  return {
    id: match.id.startsWith("crypto:") || match.id.startsWith("stocks:") ? match.id : `${market}:${match.id}`,
    market,
    preset: { ...preset, market },
    setup: match.setup,
    matchedAt: match.matchedAt
  };
}

export function readSetupAlertMatches(market?: SetupAlertMarket): SetupAlertMatch[] {
  if (!canUseStorage()) return [];

  const matches: SetupAlertMatch[] = [];
  const seenIds = new Set<string>();

  try {
    for (const key of storageKeysFor(SETUP_ALERT_MATCHES_STORAGE_KEY, market)) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) continue;

      for (const item of parsed) {
        const match = normalizeMatch(item);
        if (!match) continue;
        if (market && match.market !== market) continue;
        if (seenIds.has(match.id)) continue;
        seenIds.add(match.id);
        matches.push(match);
      }
    }

    return matches.sort((a, b) => b.matchedAt - a.matchedAt);
  } catch {
    return [];
  }
}

export function writeSetupAlertMatches(matches: SetupAlertMatch[], market: SetupAlertMarket = "crypto") {
  if (!canUseStorage()) return;
  const scopedMatches = matches.map((match) => ({ ...match, market })).slice(0, 30);
  window.localStorage.setItem(marketStorageKey(SETUP_ALERT_MATCHES_STORAGE_KEY, market), JSON.stringify(scopedMatches));
  window.dispatchEvent(new CustomEvent(SETUP_ALERT_MATCHES_CHANGED_EVENT, { detail: { market } }));
}

export function readSetupAlertMonitorStatus(market: SetupAlertMarket = "crypto"): SetupAlertMonitorStatus | null {
  if (!canUseStorage()) return null;

  try {
    const raw =
      window.localStorage.getItem(marketStorageKey(SETUP_ALERT_MONITOR_STATUS_STORAGE_KEY, market)) ??
      (market === "crypto" ? window.localStorage.getItem(SETUP_ALERT_MONITOR_STATUS_STORAGE_KEY) : null);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SetupAlertMonitorStatus>;
    if (
      typeof parsed.checkedAt !== "number" ||
      typeof parsed.presetCount !== "number" ||
      typeof parsed.setupCount !== "number" ||
      typeof parsed.matchCount !== "number"
    ) {
      return null;
    }

    return {
      market,
      checkedAt: parsed.checkedAt,
      presetCount: parsed.presetCount,
      setupCount: parsed.setupCount,
      matchCount: parsed.matchCount,
      reason: parsed.reason === "manual" || parsed.reason === "preset-change" || parsed.reason === "visible" ? parsed.reason : "auto"
    };
  } catch {
    return null;
  }
}

export function writeSetupAlertMonitorStatus(status: SetupAlertMonitorStatus, market: SetupAlertMarket = "crypto") {
  if (!canUseStorage()) return;
  const scopedStatus = { ...status, market };
  window.localStorage.setItem(marketStorageKey(SETUP_ALERT_MONITOR_STATUS_STORAGE_KEY, market), JSON.stringify(scopedStatus));
  window.dispatchEvent(new CustomEvent(SETUP_ALERT_MONITOR_STATUS_EVENT, { detail: scopedStatus }));
}
