// 푸시 알림 탭 이동 경로와 글로벌 자산 분류를 결정한다.
import type { SetupAlertMarket } from "@/lib/setupAlertPresets";
import { isCryptoMajorPushSymbol } from "@/lib/server/push/eligibility";
import type { PushAlertEvent } from "@/lib/server/push/types";

export const stockIndexSymbols = new Set(["QQQ", "SPY", "NQ=F", "ES=F"]);

export function cryptoSetupTargetPath(symbol?: string) {
  return symbol && !isCryptoMajorPushSymbol(symbol) ? "/alts" : "/crypto";
}

export function stockSetupTargetPath(symbol?: string) {
  return symbol && !stockIndexSymbols.has(symbol) ? "/global/assets" : "/global";
}

export function setupTargetPath(market: SetupAlertMarket, symbol?: string) {
  return market === "crypto" ? cryptoSetupTargetPath(symbol) : stockSetupTargetPath(symbol);
}

export function stockSetupAlertKind(symbol: string): PushAlertEvent["alertKind"] {
  return stockIndexSymbols.has(symbol) ? "global_momentum" : "global_asset";
}
