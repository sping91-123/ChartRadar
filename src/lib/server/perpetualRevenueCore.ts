export type PerpetualRevenueCoreMode = "off" | "shadow" | "on";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function perpetualRevenueCoreMode(): PerpetualRevenueCoreMode {
  const configured = process.env.PERPETUAL_REVENUE_CORE_V1?.trim().toLowerCase();
  if (configured === "off" || configured === "shadow" || configured === "on") return configured;
  return process.env.NODE_ENV === "production" ? "off" : "on";
}

export function isPerpetualSnapshotGenerationEnabled(mode: PerpetualRevenueCoreMode) {
  return mode === "shadow" || mode === "on";
}

export function perpetualRevenueCoreCanaryUserIds(raw = process.env.PERPETUAL_REVENUE_CORE_CANARY_USER_IDS ?? "") {
  const values = raw.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  if (values.length === 0 || values.length > 2 || values.some((value) => !uuidPattern.test(value))) return new Set<string>();
  return new Set(values);
}

export function isPerpetualRevenueCoreCanaryWindowActive(
  rawExpiresAt = process.env.PERPETUAL_REVENUE_CORE_CANARY_EXPIRES_AT ?? "",
  now = Date.now()
) {
  const expiresAt = Date.parse(rawExpiresAt);
  return Number.isFinite(expiresAt) && expiresAt > now && expiresAt <= now + 24 * 60 * 60 * 1000;
}

export function isPerpetualRevenueCoreUserEnabled(
  userId: string | null | undefined,
  mode = perpetualRevenueCoreMode(),
  canaryUserIds = perpetualRevenueCoreCanaryUserIds()
) {
  if (mode === "on") return true;
  if (mode !== "shadow" || !userId || !isPerpetualRevenueCoreCanaryWindowActive()) return false;
  return canaryUserIds.has(userId.toLowerCase());
}

export function isPerpetualRevenueCoreScannerEnabled(
  mode = perpetualRevenueCoreMode(),
  canaryUserIds = perpetualRevenueCoreCanaryUserIds()
) {
  return mode === "on" || (
    mode === "shadow" &&
    canaryUserIds.size > 0 &&
    isPerpetualRevenueCoreCanaryWindowActive()
  );
}

export function shouldRunPerpetualRevenueMaintenance(mode: PerpetualRevenueCoreMode) {
  return mode === "off" || mode === "shadow" || mode === "on";
}
