// 앱에서 RevenueCat 구독 결제와 서버 권한 동기화를 처리합니다.
import { Capacitor } from "@capacitor/core";
import { Purchases, type CustomerInfo } from "@revenuecat/purchases-capacitor";
import type { BillingPlan } from "@/lib/billing";
import { supabaseAuthRefreshEvent } from "@/lib/supabase";

type NativePurchasePlatform = "android" | "ios";

interface NativePurchaseParams {
  plan: BillingPlan;
  userId: string;
  accessToken: string;
}

interface NativeRestoreParams {
  userId: string;
  accessToken: string;
}

interface AppStoreSyncResponse {
  active?: boolean;
  error?: string;
  message?: string;
  planId?: string;
}

let configuredUserId: string | null = null;

export function getNativePurchasePlatform(): NativePurchasePlatform | null {
  if (!Capacitor.isNativePlatform()) return null;
  const platform = Capacitor.getPlatform();
  return platform === "android" || platform === "ios" ? platform : null;
}

export function isNativePurchaseAvailable() {
  return getNativePurchasePlatform() !== null;
}

function getRevenueCatApiKey(platform: NativePurchasePlatform) {
  return platform === "android"
    ? process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY
    : process.env.NEXT_PUBLIC_REVENUECAT_IOS_API_KEY;
}

async function configurePurchases(platform: NativePurchasePlatform, userId: string) {
  if (configuredUserId === userId) return;
  const apiKey = getRevenueCatApiKey(platform);
  if (!apiKey) {
    throw new Error("앱 결제를 잠시 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.");
  }

  await Purchases.configure({ apiKey, appUserID: userId });
  configuredUserId = userId;
}

function hasActivePlan(customerInfo: CustomerInfo, plan: BillingPlan) {
  const active = customerInfo.entitlements.active;
  if (plan.marketScope === "bundle") return Boolean(active.all_market_pro || active.bundle_pro);
  if (plan.marketScope === "crypto") return Boolean(active.coin_pro || active.crypto_pro || active.all_market_pro || active.bundle_pro);
  if (plan.marketScope === "stocks") return Boolean(active.global_pro || active.all_market_pro || active.bundle_pro);
  return false;
}

async function syncAppStoreEntitlement(params: NativePurchaseParams & { platform: NativePurchasePlatform }) {
  const response = await fetch("/api/billing/app-store/sync", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      appUserId: params.userId,
      planId: params.plan.id,
      platform: params.platform
    })
  });

  const data = (await response.json().catch(() => ({}))) as AppStoreSyncResponse;
  if (!response.ok || !data.active) {
    throw new Error(data.error ?? data.message ?? "앱 구독 상태를 계정에 연결하지 못했습니다. 잠시 후 다시 확인해 주세요.");
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(supabaseAuthRefreshEvent));
  }

  return data;
}

async function syncAnyAppStoreEntitlement(params: NativeRestoreParams & { platform: NativePurchasePlatform }) {
  const response = await fetch("/api/billing/app-store/sync", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      appUserId: params.userId,
      platform: params.platform
    })
  });

  const data = (await response.json().catch(() => ({}))) as AppStoreSyncResponse;
  if (!response.ok || !data.active) {
    throw new Error(data.error ?? data.message ?? "복원한 구독 상태를 계정에 연결하지 못했습니다. 잠시 후 다시 확인해 주세요.");
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(supabaseAuthRefreshEvent));
  }

  return data;
}

function normalizePurchaseError(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "userCancelled" in error &&
    (error as { userCancelled?: boolean }).userCancelled
  ) {
    return new Error("결제가 취소되었습니다. 필요하실 때 다시 시작하시면 됩니다.");
  }

  if (error instanceof Error) return error;
  return new Error("앱 결제 진행 중 오류가 발생했습니다.");
}

export async function purchaseNativePlan(params: NativePurchaseParams) {
  const platform = getNativePurchasePlatform();
  if (!platform) throw new Error("앱 결제는 Android 또는 iOS 앱에서만 사용할 수 있습니다.");
  if (!params.plan.appStoreProductId) throw new Error("현재 앱에서는 이 요금제를 결제할 수 없습니다. 다른 요금제를 선택해 주세요.");

  try {
    await configurePurchases(platform, params.userId);
    const { products } = await Purchases.getProducts({
      productIdentifiers: [params.plan.appStoreProductId]
    });

    const product = products[0];
    if (!product) throw new Error("스토어에서 구독 상품을 찾지 못했습니다. 잠시 후 다시 시도해 주세요.");

    const result = await Purchases.purchaseStoreProduct({ product });
    if (!hasActivePlan(result.customerInfo, params.plan)) {
      const { customerInfo } = await Purchases.getCustomerInfo();
      if (!hasActivePlan(customerInfo, params.plan)) {
        throw new Error("결제는 완료되었지만 활성 구독 권한을 확인하지 못했습니다. 구매 복원을 눌러 다시 연결해 주세요.");
      }
    }

    await syncAppStoreEntitlement({ ...params, platform });
    return { message: "구독이 확인되어 Pro 권한이 열렸습니다." };
  } catch (error) {
    throw normalizePurchaseError(error);
  }
}

export async function restoreNativePurchases(params: NativePurchaseParams) {
  const platform = getNativePurchasePlatform();
  if (!platform) throw new Error("구매 복원은 Android 또는 iOS 앱에서만 사용할 수 있습니다.");

  await configurePurchases(platform, params.userId);
  const { customerInfo } = await Purchases.restorePurchases();
  if (!hasActivePlan(customerInfo, params.plan)) {
    throw new Error("복원 가능한 활성 구독을 찾지 못했습니다.");
  }

  await syncAppStoreEntitlement({ ...params, platform });
  return { message: "구독을 복원하고 Pro 권한을 다시 연결했습니다." };
}

export async function restoreNativeEntitlement(params: NativeRestoreParams) {
  const platform = getNativePurchasePlatform();
  if (!platform) throw new Error("구매 복원은 Android 또는 iOS 앱에서만 사용할 수 있습니다.");

  await configurePurchases(platform, params.userId);
  await Purchases.restorePurchases();
  await syncAnyAppStoreEntitlement({ ...params, platform });
  return { message: "활성 구독을 확인하고 Pro 권한을 다시 연결했습니다." };
}
