import { safeReturnTo } from "./authRedirect";

export const coinProSources = [
  "direct",
  "crypto-gate",
  "alt-analysis",
  "alt-analysis-limit",
  "alt-scout",
  "watchlist",
  "perpetual-evidence",
  "perpetual-monitor",
  "paused-monitor",
  "perpetual-ai",
  "ai-limit",
  "alert-limit",
  "usage-meter",
  "spot-condition",
  "news",
  "exchange-journal",
  "perpetual-monitor-limit"
] as const;

export const coinProPlacements = [
  "direct_paywall",
  "crypto_detail_lock",
  "alt_usage_banner",
  "alt_daily_limit",
  "alt_scout_results",
  "watchlist_limit",
  "perpetual_evidence_lock",
  "perpetual_monitor_lock",
  "perpetual_ai_lock",
  "ai_daily_limit",
  "alert_limit",
  "usage_meter",
  "spot_condition"
] as const;

export const coinProRouteKeys = [
  "crypto_home",
  "perpetual_btc",
  "perpetual_eth",
  "alts",
  "spot",
  "alerts",
  "journal"
] as const;

export type CoinProSource = (typeof coinProSources)[number];
export type CoinProPlacement = (typeof coinProPlacements)[number];
export type CoinProRouteKey = (typeof coinProRouteKeys)[number];

const routeByKey: Record<CoinProRouteKey, string> = {
  crypto_home: "/crypto/home",
  perpetual_btc: "/crypto/perpetual?asset=btc",
  perpetual_eth: "/crypto/perpetual?asset=eth",
  alts: "/crypto/perpetual/alts",
  spot: "/crypto/spot",
  alerts: "/crypto/alertset",
  journal: "/journal"
};

function isOneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && values.includes(value as T[number]);
}

export function normalizeCoinProSource(value: unknown): CoinProSource {
  return isOneOf(value, coinProSources) ? value : "direct";
}

export function normalizeCoinProPlacement(value: unknown): CoinProPlacement {
  return isOneOf(value, coinProPlacements) ? value : "direct_paywall";
}

export function normalizeCoinProRouteKey(value: unknown): CoinProRouteKey {
  return isOneOf(value, coinProRouteKeys) ? value : "crypto_home";
}

export function normalizeCoinSymbol(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "").slice(0, 24);
  return normalized && /^[A-Z0-9][A-Z0-9._-]{1,23}$/.test(normalized) ? normalized : null;
}

export function routeKeyFromReturnTo(value: unknown): CoinProRouteKey {
  const returnTo = safeReturnTo(typeof value === "string" ? value : null, "");
  if (!returnTo) return "crypto_home";
  const parsed = new URL(returnTo, "https://chartradar.kr");
  if (parsed.pathname === "/crypto/perpetual/alts" || parsed.pathname === "/alts") return "alts";
  if (parsed.pathname === "/crypto/spot" || parsed.pathname === "/spot") return "spot";
  if (parsed.pathname.startsWith("/crypto/alert") || parsed.pathname === "/alerts") return "alerts";
  if (parsed.pathname === "/journal" || parsed.pathname === "/crypto/review") return "journal";
  if (parsed.pathname === "/crypto/perpetual") {
    const asset = parsed.searchParams.get("asset")?.toLowerCase();
    return asset === "eth" ? "perpetual_eth" : "perpetual_btc";
  }
  return "crypto_home";
}

export function returnToFromRouteKey(routeKey: CoinProRouteKey) {
  return routeByKey[routeKey];
}

export function buildCoinProHref(params: {
  source: CoinProSource;
  placement: CoinProPlacement;
  routeKey?: CoinProRouteKey;
  returnTo?: string | null;
  symbol?: string | null;
}) {
  const routeKey = params.routeKey ?? routeKeyFromReturnTo(params.returnTo);
  const returnTo = safeReturnTo(params.returnTo, returnToFromRouteKey(routeKey));
  const search = new URLSearchParams({
    market: "crypto",
    source: normalizeCoinProSource(params.source),
    placement: normalizeCoinProPlacement(params.placement),
    route: routeKey,
    returnTo
  });
  const symbol = normalizeCoinSymbol(params.symbol);
  if (symbol) search.set("symbol", symbol);
  return `/pro?${search.toString()}`;
}

export function buildCoinProPlayStoreUrl(params: {
  source: CoinProSource;
  placement: CoinProPlacement;
  routeKey: CoinProRouteKey;
  funnelSessionId: string;
  symbol?: string | null;
}) {
  const referrer = new URLSearchParams({
    campaign: "coin-pro-v2",
    market: "crypto",
    source: normalizeCoinProSource(params.source),
    placement: normalizeCoinProPlacement(params.placement),
    route: normalizeCoinProRouteKey(params.routeKey),
    funnel: params.funnelSessionId
  });
  const symbol = normalizeCoinSymbol(params.symbol);
  if (symbol) referrer.set("symbol", symbol);
  const play = new URL("https://play.google.com/store/apps/details");
  play.searchParams.set("id", "com.staronlabs.chartradar");
  play.searchParams.set("referrer", referrer.toString());
  return play.toString();
}
