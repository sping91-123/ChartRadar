export const STORED_MACRO_FRESHNESS_MS = 60 * 60 * 1000;

export function isStoredMacroPayloadStale(
  updatedAt: string | undefined,
  now = Date.now(),
  maxAgeMs = STORED_MACRO_FRESHNESS_MS
) {
  const updatedMs = updatedAt ? Date.parse(updatedAt) : Number.NaN;
  return !Number.isFinite(updatedMs) || now - updatedMs > maxAgeMs;
}
