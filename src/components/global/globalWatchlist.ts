import { globalWatchlistMaxItems, globalWatchlistStorageKey } from "@/components/global/stockRadarConfig";

const defaultGlobalWatchlist = ["SPY", "QQQ", "NVDA"];

export function readGlobalWatchlist() {
  if (typeof window === "undefined") return defaultGlobalWatchlist;

  try {
    const raw = window.localStorage.getItem(globalWatchlistStorageKey);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (!Array.isArray(parsed)) return defaultGlobalWatchlist;
    const symbols = parsed.filter((item): item is string => typeof item === "string").slice(0, globalWatchlistMaxItems);
    return symbols.length ? symbols : defaultGlobalWatchlist;
  } catch {
    return defaultGlobalWatchlist;
  }
}

export function writeGlobalWatchlist(symbols: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(globalWatchlistStorageKey, JSON.stringify(symbols.slice(0, globalWatchlistMaxItems)));
}
