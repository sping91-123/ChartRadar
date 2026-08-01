// 앱에서 RevenueCat 구독 결제와 서버 권한 동기화를 처리합니다.
import { Capacitor } from "@capacitor/core";
import { Purchases, type PurchasesOfferings, type PurchasesPackage, type PurchasesStoreProduct, type SubscriptionOption } from "@revenuecat/purchases-capacitor";
import { getStoreProductIdentifier, hasStoreEntitlementForPlan, type BillingPlan, type BillingPlanId } from "@/lib/billing";
import { supabaseAuthRefreshEvent } from "@/lib/supabase";

type NativePurchasePlatform = "android" | "ios";

interface NativePurchaseParams {
  plan: BillingPlan;
  userId: string;
  accessToken: string;
  attributionId?: string;
  attributionSource?: string;
  funnelSessionId?: string;
  onStage?: (stage: NativePurchaseStageEvent) => void;
  isCheckoutActive?: () => boolean;
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
  status?: "active" | "not_active" | "pending" | "setup_required" | "login_required";
  reconciliationStatus?: "active" | "not_active" | "duplicate" | "stale";
}

type RevenueCatCustomerInfo = {
  entitlements: {
    active: Record<string, unknown>;
  };
};

export type NativePurchaseErrorCode =
  | "native_unavailable"
  | "config_missing"
  | "configure_timeout"
  | "offering_load_failed"
  | "package_not_found"
  | "product_load_failed"
  | "product_not_found"
  | "base_plan_not_found"
  | "purchase_cancelled"
  | "purchase_failed"
  | "entitlement_missing";

export type NativeEntitlementPendingCode =
  | "sync_pending"
  | "sync_not_active"
  | "sync_setup_required"
  | "sync_login_required"
  | "sync_unreachable";

export type NativePurchaseResult =
  | { status: "active"; planId: BillingPlanId; message: string }
  | {
      status: "entitlement_sync_pending";
      planId: BillingPlanId;
      code: NativeEntitlementPendingCode;
      message: string;
    };

export interface NativePlanOffer {
  priceLabel: string;
  trialEligible: boolean | null;
  offerId: string | null;
}

export type NativePurchaseStage =
  | "native_start"
  | "configure_start"
  | "configure_success"
  | "configure_cached"
  | "get_products_start"
  | "get_products_success"
  | "product_matched"
  | "base_plan_matched"
  | "purchase_start"
  | "purchase_success"
  | "entitlement_sync_start"
  | "entitlement_sync_success"
  | "entitlement_sync_pending"
  | "purchase_cancel"
  | "purchase_error";

export interface NativePurchaseStageEvent {
  stage: NativePurchaseStage;
  details?: Record<string, string | number | boolean | null>;
}

export class NativePurchaseError extends Error {
  code: NativePurchaseErrorCode;

  constructor(code: NativePurchaseErrorCode, message: string) {
    super(message);
    this.name = "NativePurchaseError";
    this.code = code;
  }
}

let configuredPlatform: NativePurchasePlatform | null = null;
let identifiedUserId: string | null = null;
let configurePromise: Promise<void> | null = null;
let identityPromise: Promise<void> = Promise.resolve();
let reconciliationPromise: Promise<AppStoreSyncResponse | null> | null = null;
let lastReconciliationKey = "";
let lastReconciliationAt = 0;
const CONFIGURE_TIMEOUT_MS = 20_000;
const RECONCILIATION_THROTTLE_MS = 5 * 60 * 1000;

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

function emitNativePurchaseStage(params: Pick<NativePurchaseParams, "onStage">, stage: NativePurchaseStage, details: Record<string, string | number | boolean | null> = {}) {
  params.onStage?.({ stage, details });
}

function ensureCheckoutActive(params: Pick<NativePurchaseParams, "isCheckoutActive">) {
  if (params.isCheckoutActive && !params.isCheckoutActive()) {
    throw new NativePurchaseError("purchase_failed", "The checkout request expired before the store was opened.");
  }
}

function withNativePurchaseTimeout<T>(promise: Promise<T>, timeoutMs: number, error: NativePurchaseError) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(error), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

function getRevenueCatApiKey(platform: NativePurchasePlatform) {
  return platform === "android"
    ? process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY
    : process.env.NEXT_PUBLIC_REVENUECAT_IOS_API_KEY;
}

async function configurePurchases(platform: NativePurchasePlatform, userId: string, onStage?: NativePurchaseParams["onStage"]) {
  if (configuredPlatform === platform && identifiedUserId === userId) {
    onStage?.({ stage: "configure_cached", details: { platform } });
    return;
  }
  const apiKey = getRevenueCatApiKey(platform);
  if (!apiKey) {
    throw new NativePurchaseError("config_missing", "RevenueCat API key is missing.");
  }

  onStage?.({ stage: "configure_start", details: { platform } });
  if (!configurePromise) {
    configurePromise = withNativePurchaseTimeout(
      Purchases.configure({ apiKey }),
      CONFIGURE_TIMEOUT_MS,
      new NativePurchaseError("configure_timeout", "Native purchase configuration timed out.")
    ).then(() => {
      configuredPlatform = platform;
    }).catch((error) => {
      configurePromise = null;
      configuredPlatform = null;
      throw error;
    });
  }

  await configurePromise;
  if (configuredPlatform !== platform) {
    throw new NativePurchaseError("config_missing", "RevenueCat was configured for another platform.");
  }
  await enqueueIdentityOperation(async () => {
    if (identifiedUserId !== userId) {
      await Purchases.logIn({ appUserID: userId });
      identifiedUserId = userId;
    }
  });
  onStage?.({ stage: "configure_success", details: { platform } });
}

function enqueueIdentityOperation(operation: () => Promise<void>) {
  const next = identityPromise.catch(() => undefined).then(operation);
  identityPromise = next.catch(() => undefined);
  return next;
}

export async function logOutNativePurchases() {
  if (!getNativePurchasePlatform() || !configuredPlatform) return;
  await enqueueIdentityOperation(async () => {
    if (!identifiedUserId) return;
    await Purchases.logOut();
    identifiedUserId = null;
    lastReconciliationKey = "";
    lastReconciliationAt = 0;
  });
}

function hasActivePlan(customerInfo: RevenueCatCustomerInfo, plan: BillingPlan) {
  return hasStoreEntitlementForPlan(customerInfo.entitlements.active, plan);
}

function getNativeStoreProductIds(plan: BillingPlan, explicitPlatform?: NativePurchasePlatform) {
  const platform = explicitPlatform ?? getNativePurchasePlatform() ?? "android";
  if (!plan.storeProducts) throw new NativePurchaseError("product_not_found", "Missing app store product configuration for plan.");
  const productId = platform === "android" ? plan.storeProducts.android.productId : plan.storeProducts.ios.productId;
  const basePlanId = platform === "android" ? plan.storeProducts.android.basePlanId : "";

  return {
    productId,
    basePlanId,
    storeProductId: getStoreProductIdentifier(plan, platform) ?? productId
  };
}

function getRevenueCatPackageId(plan: BillingPlan) {
  if (!plan.storeProducts) throw new NativePurchaseError("package_not_found", "Missing RevenueCat package id for plan.");
  return plan.storeProducts.revenueCatPackageId;
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

function isRequestedBasePlan(candidate: SubscriptionOption, plan: BillingPlan) {
  const { productId, basePlanId, storeProductId } = getNativeStoreProductIds(plan);
  return candidate.id === basePlanId ||
    candidate.id.startsWith(`${basePlanId}:`) ||
    candidate.storeProductId === storeProductId ||
    (candidate.productId === productId && candidate.storeProductId.endsWith(`:${basePlanId}`));
}

function hasRequestedFreeTrial(candidate: SubscriptionOption, plan: BillingPlan) {
  return Boolean(plan.trialDays && candidate.freePhase?.billingPeriod.iso8601 === `P${plan.trialDays}D`);
}

export function resolveNativeTrialEligibility(
  platform: NativePurchasePlatform,
  plan: BillingPlan,
  option: SubscriptionOption | null
): boolean | null {
  if (platform !== "android" || !plan.trialDays || !option) return null;
  return hasRequestedFreeTrial(option, plan);
}

export function findSubscriptionOption(product: PurchasesStoreProduct, plan: BillingPlan): SubscriptionOption | null {
  const { productId, basePlanId, storeProductId } = getNativeStoreProductIds(plan);
  const options = product.subscriptionOptions ?? [];
  const trialOption = options.find((candidate) => isRequestedBasePlan(candidate, plan) && hasRequestedFreeTrial(candidate, plan));
  if (trialOption) return trialOption;
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
      platform: params.platform,
      attributionId: params.attributionId,
      attributionSource: params.attributionSource,
      funnelSessionId: params.funnelSessionId
    })
  });

  const data = (await response.json().catch(() => ({}))) as AppStoreSyncResponse;
  if (response.ok && data.active && typeof window !== "undefined") {
    window.dispatchEvent(new Event(supabaseAuthRefreshEvent));
  }

  return data;
}

async function syncAnyAppStoreEntitlement(
  params: NativeRestoreParams & { platform: NativePurchasePlatform },
  options: { requireActive?: boolean } = {}
) {
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
  if (!response.ok || (options.requireActive !== false && !data.active)) {
    throw new Error(data.error ?? data.message ?? "불러온 구독 권한을 계정에 연결하지 못했습니다. 잠시 후 다시 확인해 주세요.");
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(supabaseAuthRefreshEvent));
  }

  return data;
}

export async function refreshNativeEntitlement(params: NativeRestoreParams): Promise<AppStoreSyncResponse | null> {
  const platform = getNativePurchasePlatform();
  if (!platform) return null;
  const key = `${platform}:${params.userId}`;
  const now = Date.now();
  if (key === lastReconciliationKey && now - lastReconciliationAt < RECONCILIATION_THROTTLE_MS) return null;
  if (reconciliationPromise) {
    await reconciliationPromise.catch(() => null);
    return refreshNativeEntitlement(params);
  }

  reconciliationPromise = (async () => {
    await configurePurchases(platform, params.userId);
    const result = await syncAnyAppStoreEntitlement({ ...params, platform }, { requireActive: false });
    lastReconciliationKey = key;
    lastReconciliationAt = Date.now();
    return result;
  })().finally(() => {
    reconciliationPromise = null;
  });
  return reconciliationPromise;
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
  const { productId, basePlanId } = getNativeStoreProductIds(params.plan);
  const subscriptionOption = params.platform === "android" ? findSubscriptionOption(params.product, params.plan) : null;
  logNativePurchase("matched base plan id", {
    planId: params.plan.id,
    basePlanId,
    matched: params.platform !== "android" || Boolean(subscriptionOption),
    optionCount: params.product.subscriptionOptions?.length ?? 0
  });
  emitNativePurchaseStage(params, "base_plan_matched", {
    planId: params.plan.id,
    basePlanId,
    matched: params.platform !== "android" || Boolean(subscriptionOption),
    optionCount: params.product.subscriptionOptions?.length ?? 0
  });
  if (params.platform === "android" && !subscriptionOption) {
    throw new NativePurchaseError("base_plan_not_found", "Requested Google Play base plan was not found in RevenueCat subscription options.");
  }

  ensureCheckoutActive(params);
  logNativePurchase(subscriptionOption ? "purchaseSubscriptionOption start" : params.aPackage ? "purchasePackage start" : "purchaseStoreProduct start", {
    planId: params.plan.id,
    productId,
    basePlanId
  });
  emitNativePurchaseStage(params, "purchase_start", { planId: params.plan.id, productId, basePlanId });
  return subscriptionOption
    ? Purchases.purchaseSubscriptionOption({ subscriptionOption })
    : params.aPackage
      ? Purchases.purchasePackage({ aPackage: params.aPackage })
      : Purchases.purchaseStoreProduct({ product: params.product });
}

async function purchaseOfferingPackage(params: NativePurchaseParams & { platform: NativePurchasePlatform; aPackage: PurchasesPackage }) {
  const { productId, basePlanId } = getNativeStoreProductIds(params.plan);
  const subscriptionOption = params.platform === "android" ? findSubscriptionOption(params.aPackage.product, params.plan) : null;
  logNativePurchase("matched base plan id", {
    planId: params.plan.id,
    basePlanId,
    matched: params.platform !== "android" || Boolean(subscriptionOption),
    optionCount: params.aPackage.product.subscriptionOptions?.length ?? 0
  });
  emitNativePurchaseStage(params, "base_plan_matched", {
    planId: params.plan.id,
    basePlanId,
    matched: params.platform !== "android" || Boolean(subscriptionOption),
    optionCount: params.aPackage.product.subscriptionOptions?.length ?? 0
  });
  ensureCheckoutActive(params);
  logNativePurchase("purchasePackage start", {
    planId: params.plan.id,
    productId,
    basePlanId,
    packageId: params.aPackage.identifier
  });
  emitNativePurchaseStage(params, "purchase_start", { planId: params.plan.id, productId, basePlanId });
  return Purchases.purchasePackage({ aPackage: params.aPackage });
}

async function purchaseAndroidStoreProduct(params: NativePurchaseParams & { product: PurchasesStoreProduct }) {
  const { productId, basePlanId } = getNativeStoreProductIds(params.plan);
  const subscriptionOption = findSubscriptionOption(params.product, params.plan);
  logNativePurchase("matched base plan id", {
    planId: params.plan.id,
    basePlanId,
    matched: Boolean(subscriptionOption),
    optionCount: params.product.subscriptionOptions?.length ?? 0
  });
  emitNativePurchaseStage(params, "base_plan_matched", {
    planId: params.plan.id,
    basePlanId,
    matched: Boolean(subscriptionOption),
    optionCount: params.product.subscriptionOptions?.length ?? 0
  });
  if (!subscriptionOption) {
    throw new NativePurchaseError("base_plan_not_found", "Requested Google Play base plan was not found in RevenueCat subscription options.");
  }

  ensureCheckoutActive(params);
  logNativePurchase("purchaseSubscriptionOption start", {
    planId: params.plan.id,
    productId,
    basePlanId
  });
  emitNativePurchaseStage(params, "purchase_start", { planId: params.plan.id, productId, basePlanId });
  return Purchases.purchaseSubscriptionOption({ subscriptionOption });
}

function pendingCodeForSync(data: AppStoreSyncResponse | null): NativeEntitlementPendingCode {
  if (!data) return "sync_unreachable";
  if (data.status === "setup_required") return "sync_setup_required";
  if (data.status === "login_required") return "sync_login_required";
  if (data.status === "not_active") return "sync_not_active";
  return "sync_pending";
}

export async function purchaseNativePlan(params: NativePurchaseParams): Promise<NativePurchaseResult> {
  const platform = getNativePurchasePlatform();
  if (!platform) throw new NativePurchaseError("native_unavailable", "Native purchases are not available on this platform.");
  const { productId, basePlanId } = getNativeStoreProductIds(params.plan);

  try {
    logNativePurchase("native purchase start", { platform, planId: params.plan.id, productId, basePlanId });
    emitNativePurchaseStage(params, "native_start", { platform, planId: params.plan.id, productId, basePlanId });
    await configurePurchases(platform, params.userId, params.onStage);
    if (platform === "android") {
      logNativePurchase("getProducts start", { planId: params.plan.id, productId });
      emitNativePurchaseStage(params, "get_products_start", { planId: params.plan.id, productId });
      const { products } = await Purchases.getProducts({
        productIdentifiers: [productId]
      });
      logNativePurchase("getProducts success", { planId: params.plan.id, productId, productCount: products.length });
      emitNativePurchaseStage(params, "get_products_success", { planId: params.plan.id, productId, productCount: products.length });

      if (products.length === 0) {
        throw new NativePurchaseError("product_load_failed", "RevenueCat returned no products for the requested product id.");
      }

      const product = findStoreProduct(products, params.plan);
      logNativePurchase("matched product id", { planId: params.plan.id, productId, matched: Boolean(product) });
      emitNativePurchaseStage(params, "product_matched", { planId: params.plan.id, productId, matched: Boolean(product) });
      if (!product) throw new NativePurchaseError("product_not_found", "Requested app store product was not found in RevenueCat products.");
      await purchaseAndroidStoreProduct({ ...params, product });
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
        await purchaseOfferingPackage({ ...params, platform, aPackage: offeringPackage });
      } else {
        warnNativePurchase("offering package not found, falling back to getProducts", {
          planId: params.plan.id,
          productId,
          packageId: getRevenueCatPackageId(params.plan)
        });
      logNativePurchase("getProducts start", { planId: params.plan.id, productId });
        emitNativePurchaseStage(params, "get_products_start", { planId: params.plan.id, productId });
        const { products } = await Purchases.getProducts({
          productIdentifiers: [productId]
        });
        logNativePurchase("getProducts success", { planId: params.plan.id, productId, productCount: products.length });
        emitNativePurchaseStage(params, "get_products_success", { planId: params.plan.id, productId, productCount: products.length });

        if (products.length === 0) {
          throw new NativePurchaseError("product_load_failed", "RevenueCat returned no products for the requested product id.");
        }

        const product = findStoreProduct(products, params.plan);
        logNativePurchase("matched product id", { planId: params.plan.id, productId, matched: Boolean(product) });
        emitNativePurchaseStage(params, "product_matched", { planId: params.plan.id, productId, matched: Boolean(product) });
        if (!product) throw new NativePurchaseError("product_not_found", "Requested app store product was not found in RevenueCat products.");
        await purchaseMatchedProduct({ ...params, platform, product });
      }
    }
    logNativePurchase("purchase success", { planId: params.plan.id, productId, basePlanId });
    emitNativePurchaseStage(params, "purchase_success", { planId: params.plan.id, productId, basePlanId });
    emitNativePurchaseStage(params, "entitlement_sync_start", { planId: params.plan.id, productId, basePlanId });
    try {
      const sync = await syncAppStoreEntitlement({ ...params, platform });
      if (sync.active) {
        emitNativePurchaseStage(params, "entitlement_sync_success", { planId: params.plan.id, productId, basePlanId });
        return { status: "active", planId: params.plan.id, message: "구독이 확인되어 Pro 권한이 열렸습니다." };
      }
      const code = pendingCodeForSync(sync);
      emitNativePurchaseStage(params, "entitlement_sync_pending", { planId: params.plan.id, productId, basePlanId, code });
      return {
        status: "entitlement_sync_pending",
        planId: params.plan.id,
        code,
        message: "Google Play 결제는 완료됐고 Pro 권한을 확인 중입니다. 중복 결제하지 말고 ‘구독 권한 다시 확인’을 이용해 주세요."
      };
    } catch {
      const code: NativeEntitlementPendingCode = "sync_unreachable";
      emitNativePurchaseStage(params, "entitlement_sync_pending", { planId: params.plan.id, productId, basePlanId, code });
      return {
        status: "entitlement_sync_pending",
        planId: params.plan.id,
        code,
        message: "Google Play 결제는 완료됐고 Pro 권한을 확인 중입니다. 중복 결제하지 말고 ‘구독 권한 다시 확인’을 이용해 주세요."
      };
    }
  } catch (error) {
    const normalized = normalizePurchaseError(error);
    warnNativePurchase(normalized instanceof NativePurchaseError && normalized.code === "purchase_cancelled" ? "purchase cancel" : "purchase error", {
      planId: params.plan.id,
      productId,
      basePlanId,
      errorCode: normalized instanceof NativePurchaseError ? normalized.code : "unknown"
    });
    emitNativePurchaseStage(params, normalized instanceof NativePurchaseError && normalized.code === "purchase_cancelled" ? "purchase_cancel" : "purchase_error", {
      planId: params.plan.id,
      productId,
      basePlanId,
      errorCode: normalized instanceof NativePurchaseError ? normalized.code : "unknown"
    });
    throw normalized;
  }
}

export async function fetchNativePlanOffers(plans: BillingPlan[], userId: string) {
  const platform = getNativePurchasePlatform();
  if (!platform) return {};

  await configurePurchases(platform, userId);
  const paidPlans = plans.filter((plan) => plan.storeProducts);
  const productIdentifiers = Array.from(new Set(paidPlans.map((plan) => getNativeStoreProductIds(plan, platform).productId)));
  const offers: Partial<Record<BillingPlanId, NativePlanOffer>> = {};

  const offerings = await Purchases.getOfferings().catch(() => null);
  if (offerings) {
    for (const plan of paidPlans) {
      const offeringPackage = findOfferingPackage(offerings, plan);
      if (offeringPackage?.product.priceString) {
        const option = platform === "android" ? findSubscriptionOption(offeringPackage.product, plan) : null;
        offers[plan.id] = {
          priceLabel: plan.periodLabel === "6개월 구독" ? `${offeringPackage.product.priceString} / 6개월` : offeringPackage.product.priceString,
          trialEligible: resolveNativeTrialEligibility(platform, plan, option),
          offerId: option?.id ?? null
        };
      }
    }
  }

  const missingProductIdentifiers = Array.from(
    new Set(
      paidPlans
        .filter((plan) => !offers[plan.id])
        .map((plan) => getNativeStoreProductIds(plan, platform).productId)
    )
  ) as string[];
  if (missingProductIdentifiers.length === 0) return offers;
  if (productIdentifiers.length === 0) return offers;

  const { products } = await Purchases.getProducts({ productIdentifiers: missingProductIdentifiers });

  for (const plan of paidPlans) {
    if (offers[plan.id]) continue;
    const product = findStoreProduct(products, plan);
    if (product?.priceString) {
      const option = platform === "android" ? findSubscriptionOption(product, plan) : null;
      offers[plan.id] = {
        priceLabel: plan.periodLabel === "6개월 구독" ? `${product.priceString} / 6개월` : product.priceString,
        trialEligible: resolveNativeTrialEligibility(platform, plan, option),
        offerId: option?.id ?? null
      };
    }
  }

  return offers;
}

export async function fetchNativePlanPriceLabels(plans: BillingPlan[], userId: string) {
  const offers = await fetchNativePlanOffers(plans, userId);
  return Object.fromEntries(Object.entries(offers).map(([planId, offer]) => [planId, offer?.priceLabel]));
}

export async function restoreNativePurchases(params: NativePurchaseParams) {
  const platform = getNativePurchasePlatform();
  if (!platform) throw new Error("구독 권한 불러오기는 Android 또는 iOS 앱에서만 사용할 수 있습니다.");

  await configurePurchases(platform, params.userId);
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
  await Purchases.restorePurchases();
  await syncAnyAppStoreEntitlement({ ...params, platform });
  return { message: "구독 권한을 확인하고 Pro 권한을 다시 연결했습니다." };
}
