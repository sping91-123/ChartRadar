/**
 * 관심 코인 (Watchlist) — 로컬 스토리지 기반 관리.
 *
 * 플랜별 최대 종목:
 *  - free / 비로그인 : 5개
 *  - Coin Pro 월간  : 50개
 *  - Coin Pro 연간  : 100개
 *  - All Market 월간: 100개
 *  - All Market 연간: 150개
 */

import type { BillingEntitlementPlan } from "./billing";
import { isLikelyUsdtPerpSymbol } from "./cryptoUniverse";

export type WatchlistPlan = NonNullable<BillingEntitlementPlan>;

export const WATCHLIST_LIMIT: Record<string, number> = {
  free: 5,
  member: 5,
  premium: 100,
  admin: 150,
  crypto_monthly: 50,
  crypto_yearly: 100,
  bundle_monthly: 100,
  bundle_yearly: 150,
  stocks_monthly: 5,
  stocks_yearly: 5
};

const STORAGE_KEY = "chartRadar.watchlist.v1";
const LEGACY_UNTITLED_RISK_STORAGE_KEY = "untitledRisk.watchlist.v1";
const LEGACY_STORAGE_KEY = "coters.watchlist.v1";

/** 저장된 관심 코인 목록 반환. 유효하지 않은 심볼은 자동 제거. */
export function getWatchlist(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw =
      window.localStorage.getItem(STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_UNTITLED_RISK_STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return [];
    window.localStorage.setItem(STORAGE_KEY, raw);
    window.localStorage.removeItem(LEGACY_UNTITLED_RISK_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    // 바이낸스 전체 USDT-M 심볼을 허용한다.
    const valid = (parsed as string[]).filter((s) => isLikelyUsdtPerpSymbol(s));
    return valid;
  } catch {
    return [];
  }
}

function saveWatchlist(list: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    window.localStorage.removeItem(LEGACY_UNTITLED_RISK_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // 용량 초과 등 무시
  }
}

export function getWatchlistLimit(plan: BillingEntitlementPlan): number {
  return WATCHLIST_LIMIT[plan ?? "free"] ?? WATCHLIST_LIMIT.free;
}

/** 관심 코인 추가. plan 한도를 초과하면 false 반환. */
export function addToWatchlist(symbol: string, plan: WatchlistPlan): boolean {
  const current = getWatchlist();
  if (current.includes(symbol)) return true; // 이미 있음
  const limit = getWatchlistLimit(plan);
  if (current.length >= limit) return false; // 한도 초과
  saveWatchlist([...current, symbol]);
  return true;
}

/** 관심 코인 제거. */
export function removeFromWatchlist(symbol: string) {
  const current = getWatchlist();
  saveWatchlist(current.filter((s) => s !== symbol));
}

/** 심볼에서 코인 이름만 추출. "ADAUSDT.P" → "ADA" */
export function symbolToName(symbol: string): string {
  return symbol.replace("USDT.P", "").replace("USDT", "");
}
