// RevenueCat PurchasesError codes from the installed SDK. Never retain raw SDK messages or userInfo.
export const purchaseSdkCodes = new Set([
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15",
  "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "28", "29", "30",
  "31", "32", "33", "34", "35", "42"
]);
export const purchaseErrorCategories = new Set(["cancelled", "network", "store", "pending", "already_owned", "configuration", "not_allowed", "in_progress", "unknown"]);
export interface PurchaseErrorDiagnostic {
  code: string;
  sdkCode: string | null;
  category: string;
  retryable: boolean;
  message: string;
}

export function diagnosePurchaseError(error: unknown): PurchaseErrorDiagnostic {
  const source = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const candidate = typeof source.code === "number" || typeof source.code === "string" ? String(source.code) : "";
  const sdkCode = purchaseSdkCodes.has(candidate) ? candidate : null;
  const result = (category: string, message: string, retryable = false): PurchaseErrorDiagnostic => ({
    code: category === "cancelled" ? "purchase_cancelled" : sdkCode ? `sdk_${category}` : "purchase_failed",
    sdkCode, category, retryable, message
  });
  if (sdkCode === "1" || source.userCancelled === true) return result("cancelled", "결제가 취소되었습니다.");
  if (["10", "32", "33", "35"].includes(sdkCode ?? "")) return result("network", "네트워크 또는 스토어 응답을 확인하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요. 결제를 승인했다면 먼저 ‘구독 권한 다시 확인’을 눌러 주세요.", true);
  if (sdkCode === "20") return result("pending", "스토어에서 결제 승인이나 추가 인증을 기다리고 있습니다. 스토어의 안내를 완료한 뒤 ‘구독 권한 다시 확인’을 눌러 주세요. 새 결제를 시작하지 마세요.");
  if (["6", "7", "13"].includes(sdkCode ?? "")) return result("already_owned", "이미 구매했거나 다른 계정에 연결된 구독입니다. 구매 당시 앱·스토어 계정으로 로그인한 뒤 ‘구독 권한 다시 확인’을 눌러 주세요.");
  if (sdkCode === "15") return result("in_progress", "이미 진행 중인 결제가 있습니다. 열린 스토어 결제를 마친 뒤 ‘구독 권한 다시 확인’을 눌러 주세요.");
  if (["2", "8", "9", "12", "16", "29", "31"].includes(sdkCode ?? "")) return result("store", "스토어에서 결제 결과를 확인하지 못했습니다. 구매 내역을 확인하고 ‘구독 권한 다시 확인’을 먼저 눌러 주세요.");
  if (["3", "4", "18", "19"].includes(sdkCode ?? "")) return result("not_allowed", "현재 스토어 계정에서 이 구매를 진행할 수 없습니다. 계정의 구매 제한과 결제 수단을 확인해 주세요.");
  if (sdkCode && sdkCode !== "0" && sdkCode !== "42") return result("configuration", "상품 또는 결제 서비스 설정을 확인해야 합니다. 반복 결제하지 말고 잠시 후 다시 확인해 주세요.");
  return result("unknown", "결제 결과를 확인하지 못했습니다. 결제를 승인했다면 구매 내역을 확인하고 ‘구독 권한 다시 확인’을 먼저 눌러 주세요.");
}

// A terminal error describes the result; retain the operation that actually failed.
export function retainPurchaseOperation<T extends { stage: string }>(previous: T | undefined, next: T): T | undefined {
  return next.stage === "purchase_error" || next.stage === "purchase_cancel" ? previous : next;
}
