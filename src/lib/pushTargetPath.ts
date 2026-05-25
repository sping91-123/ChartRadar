// 앱 푸시 알림 데이터에서 안전한 내부 이동 경로를 결정합니다.
export type PushTargetData = Record<string, unknown>;

const allowedPushTargetPaths = new Set([
  "/alerts",
  "/crypto",
  "/alts",
  "/global",
  "/global/assets",
  "/news?market=global",
  "/news?market=crypto",
  "/journal?market=global",
  "/journal?market=crypto"
]);

const cryptoMajorSymbols = new Set(["BTC", "BTCUSDT", "BTCUSDT.P", "ETH", "ETHUSDT", "ETHUSDT.P"]);
const globalAssetSymbols = new Set(["QQQ", "SPY", "NQ=F", "ES=F", "VIX", "^VIX", "VIXY", "NVDA", "SMH", "SOXX", "AMD", "GLD", "CL=F"]);

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizedValue(value: unknown) {
  return stringValue(value).toLowerCase().replace(/-/g, "_");
}

function normalizedSymbol(value: unknown) {
  return stringValue(value).toUpperCase();
}

export function sanitizePushTargetPath(value: unknown) {
  const path = stringValue(value);
  if (!path) return null;
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return null;
  if (/[\u0000-\u001f]/.test(path)) return null;
  return allowedPushTargetPaths.has(path) ? path : null;
}

function isCryptoMajorSymbol(symbol: string) {
  return cryptoMajorSymbols.has(symbol);
}

function isGlobalAssetSymbol(symbol: string) {
  return globalAssetSymbols.has(symbol);
}

function isMacroLike(type: string, alertKind: string) {
  return (
    alertKind === "macro" ||
    alertKind === "macro_event" ||
    alertKind === "news" ||
    alertKind === "event_pressure" ||
    type === "macro_news" ||
    type === "macro_event" ||
    type === "news" ||
    type === "event_pressure"
  );
}

function routeFromPushMetadata(data: PushTargetData) {
  const type = normalizedValue(data.type);
  const alertKind = normalizedValue(data.alertKind ?? data.alert_kind ?? data.kind);
  const market = normalizedValue(data.market);
  const symbol = normalizedSymbol(data.symbol);

  if (type === "push_test") return "/alerts";
  if (alertKind === "liquidation" || type === "liquidation" || type === "liquidation_pressure") return "/crypto";
  if (isMacroLike(type, alertKind)) return market === "crypto" ? "/news?market=crypto" : "/news?market=global";
  if (alertKind === "global_momentum" || alertKind === "risk_off" || alertKind === "semiconductor_leadership") return "/global";
  if (alertKind === "global_asset" || market === "global_asset") return "/global/assets";
  if ((market === "global" || market === "stocks") && symbol && isGlobalAssetSymbol(symbol)) return "/global/assets";
  if (market === "global" || market === "stocks") return "/global";
  if (market === "alts") return "/alts";
  if ((market === "crypto" || alertKind === "market_scout" || alertKind === "watchlist") && symbol) {
    return isCryptoMajorSymbol(symbol) ? "/crypto" : "/alts";
  }
  if (market === "crypto") return "/crypto";

  return null;
}

export function resolvePushTargetPath(data: PushTargetData | null | undefined) {
  const payload = data ?? {};
  const explicitTargetPath = sanitizePushTargetPath(payload.targetPath);
  if (explicitTargetPath && explicitTargetPath !== "/alerts") return explicitTargetPath;

  const metadataTargetPath = routeFromPushMetadata(payload);
  if (metadataTargetPath) return metadataTargetPath;
  if (explicitTargetPath) return explicitTargetPath;

  return sanitizePushTargetPath(payload.target) ?? "/alerts";
}
