// 앱에서 RevenueCat 구독 결제와 서버 권한 동기화를 처리합니다.
import { Capacitor } from "@capacitor/core";
import type { PurchasesOfferings, PurchasesPackage, PurchasesStoreProduct, SubscriptionOption } from "@revenuecat/purchases-capacitor";
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

export type NativePurchaseErrorCode =
  | "native_unavailable"
  | "config_missing"
  | "offering_load_failed"
  | "package_not_found"
  | "product_load_failed"
  | "product_not_found"
  | "base_plan_not_found"
  | "purchase_cancelled"
  | "purchase_failed"
  | "entitlement_missing";

export class NativePurchaseError extends Error {
  code: NativePurchaseErrorCode;

  constructor(code: NativePurchaseErrorCode, message: string) {
    super(message);
    this.name = "NativePurchaseError";
    this.code = code;
  }
}

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

function logNativePurchase(event: string, details: Record<string, string | number | boolean | null> = {}) {
  console.info(`[ChartRadar billing] ${event}`, details);
}

function warnNativePurchase(event: string, details: Record<string, string | number | boolean | null> = {}) {
  console.warn(`[ChartRadar billing] ${event}`, details);
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
    throw new NativePurchaseError("config_missing", "RevenueCat API key is missing.");
  }

  const Purchases = await getRevenueCatPurchases();
  await Purchases.configure({ apiKey, appUserID: userId });
  configuredUserId = userId;
}

function hasActivePlan(customerInfo: RevenueCatCustomerInfo, plan: BillingPlan) {
  return hasStoreEntitlementForPlan(customerInfo.entitlements.active, plan);
}

function getNativeStoreProductIds(plan: BillingPlan) {
  if (!plan.appStoreProductId) throw new NativePurchaseError("product_not_found", "Missing app store product id for plan.");
  if (!plan.appStoreBasePlanId) throw new NativePurchaseError("base_plan_not_found", "Missing app store base plan id for plan.");

  return {
    productId: plan.appStoreProductId,
    basePlanId: plan.appStoreBasePlanId,
    storeProductId: getStoreProductIdentifier(plan) ?? plan.appStoreProductId
  };
}

function getRevenueCatPackageId(plan: BillingPlan) {
  return plan.id === "bundle_yearly" ? "bundle_6month" : plan.id;
}

function findStoreProduct(products: PurchasesStoreProduct[], plan: BillingPlan) {
  const { productId, storeProductId } = getNativeStoreProductIds(plan);
  return products.find((product) => product.identifier === productId || product.identifier === storeProductId) ?? null;
}

function findOfferingPackage(offerings: PurchasesOfferings, plan: BillingPlan): PurchasesPackage | null {
  const packageId = getRevenueCatPackageId(plan);
  const { productId, storeProductId } = getNativeStoreProductIds(plan);
  const offering = offerings.current ?? offerings.all.default ?? Object.values(offerings.all)[0] ?? null;
  const packages = offering?.availablePackages ?? [];

  return (
    packages.find((candidate) => candidate.identifier === packageId) ??
    packages.find((candidate) => candidate.product.identifier === productId || candidate.product.identifier === storeProductId) ??
    null
  );
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
    return new NativePurchaseError("purchase_cancelled", "Purchase was cancelled by the user.");
  }

  if (error instanceof NativePurchaseError) return error;
  if (error instanceof Error) return error;
  return new NativePurchaseError("purchase_failed", "Native purchase failed.");
}

async function purchaseMatchedProduct(params: NativePurchaseParams & { platform: NativePurchasePlatform; product: PurchasesStoreProduct; aPackage?: PurchasesPackage | null }) {
  const Purchases = await getRevenueCatPurchases();
  const { productId, basePlanId } = getNativeStoreProductIds(params.plan);
  const subscriptionOption = params.platform === "android" ? findSubscriptionOption(params.product, params.plan) : null;
  logNativePurchase("matched base plan id", {
    planId: params.plan.id,
    basePlanId,
    matched: params.platform !== "android" || Boolean(subscriptionOption),
    optionCount: params.product.subscriptionOptions?.length ?? 0
  });
  if (params.platform === "android" && !subscriptionOption) {
    throw new NativePurchaseError("base_plan_not_found", "Requested Google Play base plan was not found in RevenueCat subscription options.");
  }

  logNativePurchase(subscriptionOption ? "purchaseSubscriptionOption start" : params.aPackage ? "purchasePackage start" : "purchaseStoreProduct start", {
    planId: params.plan.id,
    productId,
    basePlanId
  });
  return subscriptionOption
    ? Purchases.purchaseSubscriptionOption({ subscriptionOption })
    : params.aPackage
      ? Purchases.purchasePackage({ aPackage: params.aPackage })
      : Purchases.purchaseStoreProduct({ product: params.product });
}

async function purchaseOfferingPackage(params: NativePurchaseParams & { platform: NativePurchasePlatform; aPackage: PurchasesPackage }) {
  const Purchases = await getRevenueCatPurchases();
  const { productId, basePlanId } = getNativeStoreProductIds(params.plan);
  const subscriptionOption = params.platform === "android" ? findSubscriptionOption(params.aPackage.product, params.plan) : null;
  logNativePurchase("matched base plan id", {
    planId: params.plan.id,
    basePlanId,
    matched: params.platform !== "android" || Boolean(subscriptionOption),
    optionCount: params.aPackage.product.subscriptionOptions?.length ?? 0
  });
  logNativePurchase("purchasePackage start", {
    planId: params.plan.id,
    productId,
    basePlanId,
    packageId: params.aPackage.identifier
  });
  return Purchases.purchasePackage({ aPackage: params.aPackage });
}

async function purchaseAndroidStoreProduct(params: NativePurchaseParams & { product: PurchasesStoreProduct }) {
  const Purchases = await getRevenueCatPurchases();
  const { productId, basePlanId } = getNativeStoreProductIds(params.plan);
  const subscriptionOption = findSubscriptionOption(params.product, params.plan);
  logNativePurchase("matched base plan id", {
    planId: params.plan.id,
    basePlanId,
    matched: Boolean(subscriptionOption),
    optionCount: params.product.subscriptionOptions?.length ?? 0
  });
  logNativePurchase("purchaseStoreProduct start", {
    planId: params.plan.id,
    productId,
    basePlanId
  });
  return Purchases.purchaseStoreProduct({ product: params.product });
}

export async function purchaseNativePlan(params: NativePurchaseParams) {
  const platform = getNativePurchasePlatform();
  if (!platform) throw new NativePurchaseError("native_unavailable", "Native purchases are not available on this platform.");
  const { productId, basePlanId } = getNativeStoreProductIds(params.plan);

  try {
    logNativePurchase("native purchase start", { platform, planId: params.plan.id, productId, basePlanId });
    await configurePurchases(platform, params.userId);
    const Purchases = await getRevenueCatPurchases();
    let result;
    if (platform === "android") {
      logNativePurchase("getProducts start", { planId: params.plan.id, productId });
      const { products } = await Purchases.getProducts({
        productIdentifiers: [productId]
      });
      logNativePurchase("getProducts success", { planId: params.plan.id, productId, productCount: products.length });

      if (products.length === 0) {
        throw new NativePurchaseError("product_load_failed", "RevenueCat returned no products for the requested product id.");
      }

      const product = findStoreProduct(products, params.plan);
      logNativePurchase("matched product id", { planId: params.plan.id, productId, matched: Boolean(product) });
      if (!product) throw new NativePurchaseError("product_not_found", "Requested app store product was not found in RevenueCat products.");
      result = await purchaseAndroidStoreProduct({ ...params, product });
    } else {
      logNativePurchase("getOfferings start", { planId: params.plan.id, productId, packageId: getRevenueCatPackageId(params.plan) });
      const offerings = await Purchases.getOfferings().catch((error) => {
        warnNativePurchase("getOfferings error", { planId: params.plan.id, productId });
        throw error;
      });
      const offeringPackage = findOfferingPackage(offerings, params.plan);
      logNativePurchase("getOfferings success", {
        planId: params.plan.id,
        productId,
        packageId: getRevenueCatPackageId(params.plan),
        offeringCount: Object.keys(offerings.all).length,
        packageCount: (offerings.current ?? offerings.all.default)?.availablePackages.length ?? 0,
        matched: Boolean(offeringPackage)
      });

      if (offeringPackage) {
        logNativePurchase("matched offering package", {
          planId: params.plan.id,
          productId,
          basePlanId,
          packageId: offeringPackage.identifier
        });
        result = await purchaseOfferingPackage({ ...params, platform, aPackage: offeringPackage });
      } else {
        warnNativePurchase("offering package not found, falling back to getProducts", {
          planId: params.plan.id,
          productId,
          packageId: getRevenueCatPackageId(params.plan)
        });
        logNativePurchase("getProducts start", { planId: params.plan.id, productId });
        const { products } = await Purchases.getProducts({
          productIdentifiers: [productId]
        });
        logNativePurchase("getProducts success", { planId: params.plan.id, productId, productCount: products.length });

        if (products.length === 0) {
          throw new NativePurchaseError("product_load_failed", "RevenueCat returned no products for the requested product id.");
        }

        const product = findStoreProduct(products, params.plan);
        logNativePurchase("matched product id", { planId: params.plan.id, productId, matched: Boolean(product) });
        if (!product) throw new NativePurchaseError("product_not_found", "Requested app store product was not found in RevenueCat products.");
        result = await purchaseMatchedProduct({ ...params, platform, product });
      }
    }
    logNativePurchase("purchase success", { planId: params.plan.id, productId, basePlanId });
    if (!hasActivePlan(result.customerInfo, params.plan)) {
      const { customerInfo } = await Purchases.getCustomerInfo();
      if (!hasActivePlan(customerInfo, params.plan)) {
        throw new NativePurchaseError("entitlement_missing", "Purchase finished, but matching entitlement was not active.");
      }
    }

    await syncAppStoreEntitlement({ ...params, platform });
    return { message: "구독이 확인되어 Pro 권한이 열렸습니다." };
  } catch (error) {
    const normalized = normalizePurchaseError(error);
    warnNativePurchase(normalized instanceof NativePurchaseError && normalized.code === "purchase_cancelled" ? "purchase cancel" : "purchase error", {
      planId: params.plan.id,
      productId,
      basePlanId,
      errorCode: normalized instanceof NativePurchaseError ? normalized.code : "unknown"
    });
    throw normalized;
  }
}

export async function fetchNativePlanPriceLabels(plans: BillingPlan[], userId: string) {
  const platform = getNativePurchasePlatform();
  if (!platform) return {};

  await configurePurchases(platform, userId);
  const Purchases = await getRevenueCatPurchases();
  const paidPlans = plans.filter((plan) => plan.appStoreProductId);
  const productIdentifiers = Array.from(new Set(paidPlans.map((plan) => plan.appStoreProductId).filter(Boolean))) as string[];
  const priceLabels: Partial<Record<BillingPlanId, string>> = {};

  const offerings = await Purchases.getOfferings().catch(() => null);
  if (offerings) {
    for (const plan of paidPlans) {
      const offeringPackage = findOfferingPackage(offerings, plan);
      if (offeringPackage?.product.priceString) {
        priceLabels[plan.id] = plan.periodLabel === "6개월 구독" ? `${offeringPackage.product.priceString} / 6개월` : offeringPackage.product.priceString;
      }
    }
  }

  const missingProductIdentifiers = Array.from(
    new Set(
      paidPlans
        .filter((plan) => !priceLabels[plan.id])
        .map((plan) => plan.appStoreProductId)
        .filter(Boolean)
    )
  ) as string[];
  if (missingProductIdentifiers.length === 0) return priceLabels;
  if (productIdentifiers.length === 0) return priceLabels;

  const { products } = await Purchases.getProducts({ productIdentifiers: missingProductIdentifiers });

  for (const plan of paidPlans) {
    if (priceLabels[plan.id]) continue;
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
