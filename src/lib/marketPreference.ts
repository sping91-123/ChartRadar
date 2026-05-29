export type PreferredMarket = "coin" | "global";

export const lastMarketKey = "chartRadar.lastMarket.v1";
export const legacyDefaultEntryKey = "chartRadar.defaultEntry.v1";

export function normalizePreferredMarket(value: string | null): PreferredMarket | null {
  if (value === "coin" || value === "global") return value;
  return null;
}

export function readPreferredMarket(): PreferredMarket | null {
  if (typeof window === "undefined") return null;
  const saved = normalizePreferredMarket(window.localStorage.getItem(lastMarketKey));
  if (saved) return saved;

  const legacy = normalizePreferredMarket(window.localStorage.getItem(legacyDefaultEntryKey));
  if (legacy) {
    window.localStorage.setItem(lastMarketKey, legacy);
    return legacy;
  }

  return null;
}

export function savePreferredMarket(market: PreferredMarket) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(lastMarketKey, market);
  window.localStorage.setItem(legacyDefaultEntryKey, market);
}

export function clearPreferredMarket() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(lastMarketKey);
  window.localStorage.setItem(legacyDefaultEntryKey, "select");
}
