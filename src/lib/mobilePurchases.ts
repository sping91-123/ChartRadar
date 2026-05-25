// 앱에서 RevenueCat 구독 결제와 서버 권한 동기화를 처리합니다.
import { Capacitor } from "@capacitor/core";
import type { PurchasesStoreProduct, SubscriptionOption } from "@revenuecat/purchases-capacitor";
import { getStoreProductIdentifier, hasStoreEntitlementForPlan, type BillingPlan, type BillingPlanId } from "@/lib/billing";
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

type RevenueCatCustomerInfo = {
  entitlements: {
    active: Record<string, unknown>;
  };
};

let configuredUserId: string | null = null;

async function getRevenueCatPurchases() {
  const { Purchases } = await import("@revenuecat/purchases-capacitor");
  return Purchases;
}

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

  const Purchases = await getRevenueCatPurchases();
  await Purchases.configure({ apiKey, appUserID: userId });
  configuredUserId = userId;
}

function hasActivePlan(customerInfo: RevenueCatCustomerInfo, plan: BillingPlan) {
  return hasStoreEntitlementForPlan(customerInfo.entitlements.active, plan);
}

function getNativeStoreProductIds(plan: BillingPlan) {
  if (!plan.appStoreProductId) throw new Error("현재 앱에서는 이 요금제를 결제할 수 없습니다. 다른 요금제를 선택해 주세요.");
  if (!plan.appStoreBasePlanId) throw new Error("앱 구독 기본 요금제 연결을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.");

  return {
    productId: plan.appStoreProductId,
    basePlanId: plan.appStoreBasePlanId,
    storeProductId: getStoreProductIdentifier(plan) ?? plan.appStoreProductId
  };
}

function findStoreProduct(products: PurchasesStoreProduct[], plan: BillingPlan) {
  const { productId, storeProductId } = getNativeStoreProductIds(plan);
  return products.find((product) => product.identifier === productId || product.identifier === storeProductId) ?? null;
}

function findSubscriptionOption(product: PurchasesStoreProduct, plan: BillingPlan): SubscriptionOption | null {
  const { productId, basePlanId, storeProductId } = getNativeStoreProductIds(plan);
  const options = product.subscriptionOptions ?? [];
  const option =
    options.find(
      (candidate) =>
        candidate.id === basePlanId ||
        candidate.storeProductId === storeProductId ||
        (candidate.productId === productId && candidate.isBasePlan && candidate.id === basePlanId)
    ) ?? null;

  if (option) return option;
  if (product.defaultOption?.id === basePlanId || product.defaultOption?.storeProductId === storeProductId) {
    return product.defaultOption;
  }

  return null;
}

async function syncAppStoreEntitlement(params: NativePurchaseParams & { platform: NativePurchasePlatform }) {
  const { productId, basePlanId } = getNativeStoreProductIds(params.plan);
  const response = await fetch("/api/billing/app-store/sync", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      appUserId: params.userId,
      planId: params.plan.id,
      productId,
      basePlanId,
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
    throw new Error(data.error ?? data.message ?? "불러온 구독 권한을 계정에 연결하지 못했습니다. 잠시 후 다시 확인해 주세요.");
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
  const { productId, basePlanId } = getNativeStoreProductIds(params.plan);

  try {
    await configurePurchases(platform, params.userId);
    const Purchases = await getRevenueCatPurchases();
    const { products } = await Purchases.getProducts({
      productIdentifiers: [productId]
    });

    const product = findStoreProduct(products, params.plan);
    if (!product) throw new Error("스토어에서 구독 상품을 찾지 못했습니다. 잠시 후 다시 시도해 주세요.");

    const subscriptionOption = platform === "android" ? findSubscriptionOption(product, params.plan) : null;
    if (platform === "android" && !subscriptionOption && product.subscriptionOptions?.length) {
      throw new Error(`${params.plan.displayName}의 Google Play 기본 요금제 ${basePlanId}를 찾지 못했습니다.`);
    }

    const result = subscriptionOption
      ? await Purchases.purchaseSubscriptionOption({ subscriptionOption })
      : await Purchases.purchaseStoreProduct({ product });
    if (!hasActivePlan(result.customerInfo, params.plan)) {
      const { customerInfo } = await Purchases.getCustomerInfo();
      if (!hasActivePlan(customerInfo, params.plan)) {
        throw new Error("결제는 완료되었지만 활성 구독 권한을 확인하지 못했습니다. 구독 권한 불러오기를 눌러 다시 연결해 주세요.");
      }
    }

    await syncAppStoreEntitlement({ ...params, platform });
    return { message: "구독이 확인되어 Pro 권한이 열렸습니다." };
  } catch (error) {
    throw normalizePurchaseError(error);
  }
}

export async function fetchNativePlanPriceLabels(plans: BillingPlan[], userId: string) {
  const platform = getNativePurchasePlatform();
  if (!platform) return {};

  await configurePurchases(platform, userId);
  const Purchases = await getRevenueCatPurchases();
  const paidPlans = plans.filter((plan) => plan.appStoreProductId);
  const productIdentifiers = Array.from(new Set(paidPlans.map((plan) => plan.appStoreProductId).filter(Boolean))) as string[];
  if (productIdentifiers.length === 0) return {};

  const { products } = await Purchases.getProducts({ productIdentifiers });
  const priceLabels: Partial<Record<BillingPlanId, string>> = {};

  for (const plan of paidPlans) {
    const product = findStoreProduct(products, plan);
    if (product?.priceString) {
      priceLabels[plan.id] = plan.periodLabel === "6개월 구독" ? `${product.priceString} / 6개월` : product.priceString;
    }
  }

  return priceLabels;
}

export async function restoreNativePurchases(params: NativePurchaseParams) {
  const platform = getNativePurchasePlatform();
  if (!platform) throw new Error("구독 권한 불러오기는 Android 또는 iOS 앱에서만 사용할 수 있습니다.");

  await configurePurchases(platform, params.userId);
  const Purchases = await getRevenueCatPurchases();
  const { customerInfo } = await Purchases.restorePurchases();
  if (!hasActivePlan(customerInfo, params.plan)) {
    throw new Error("불러올 수 있는 활성 구독 권한을 찾지 못했습니다.");
  }

  await syncAppStoreEntitlement({ ...params, platform });
  return { message: "구독 권한을 불러와 Pro 권한을 다시 연결했습니다." };
}

export async function restoreNativeEntitlement(params: NativeRestoreParams) {
  const platform = getNativePurchasePlatform();
  if (!platform) throw new Error("구독 권한 불러오기는 Android 또는 iOS 앱에서만 사용할 수 있습니다.");

  await configurePurchases(platform, params.userId);
  const Purchases = await getRevenueCatPurchases();
  await Purchases.restorePurchases();
  await syncAnyAppStoreEntitlement({ ...params, platform });
  return { message: "구독 권한을 확인하고 Pro 권한을 다시 연결했습니다." };
}
