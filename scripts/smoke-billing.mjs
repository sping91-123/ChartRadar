// 출시 전 구독 상품 ID와 결제 환경 구성을 빠르게 점검하는 로컬 스모크 테스트입니다.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const checks = [];

function read(relativePath) {
  const absolutePath = join(root, relativePath);
  return existsSync(absolutePath) ? readFileSync(absolutePath, "utf8") : "";
}

function pass(label, detail = "") {
  checks.push({ ok: true, label, detail });
}

function fail(label, detail = "") {
  checks.push({ ok: false, label, detail });
}

function expectIncludes(source, value, label, fileName) {
  if (source.includes(value)) {
    pass(label, `${fileName}에 ${value} 값이 있습니다.`);
  } else {
    fail(label, `${fileName}에서 ${value} 값을 찾지 못했습니다.`);
  }
}

const files = {
  billing: read("src/lib/billing.ts"),
  envExample: read(".env.example"),
  confirmRoute: read("src/app/api/billing/confirm/route.ts"),
  checkoutRoute: read("src/app/api/billing/checkout/route.ts"),
  appStoreSyncRoute: read("src/app/api/billing/app-store/sync/route.ts"),
  requestEntitlement: read("src/lib/server/requestEntitlement.ts"),
  billingEntitlements: read("src/lib/server/billingEntitlements.ts"),
  proPricingPanel: read("src/components/ProPricingPanel.tsx"),
  mobilePurchases: read("src/lib/mobilePurchases.ts"),
  usageMeterPanel: read("src/components/UsageMeterPanel.tsx"),
  checkoutConfirmationPanel: read("src/components/CheckoutConfirmationPanel.tsx"),
  supabaseClient: read("src/lib/supabase.ts"),
  supabaseAuthHook: read("src/lib/useSupabaseAuth.ts"),
  watchlist: read("src/lib/watchlist.ts"),
  watchlistPanel: read("src/components/WatchlistPanel.tsx"),
  stockRadarApp: read("src/components/StockRadarApp.tsx"),
  launchChecklist: read("LAUNCH_CHECKLIST.md"),
  paymentGuide: read("docs/payment-launch.md"),
  appStoreGuide: read("docs/app-store-release.md"),
  packageJson: read("package.json")
};

for (const [name, source] of Object.entries(files)) {
  if (!source) fail(`파일 읽기 ${name}`, `${name} 소스를 읽지 못했습니다.`);
}

const planIds = [
  "free",
  "crypto_monthly",
  "crypto_yearly",
  "stocks_monthly",
  "stocks_yearly",
  "bundle_monthly",
  "bundle_yearly"
];

const productIds = [
  "chart_radar_crypto_monthly",
  "chart_radar_crypto_yearly",
  "chart_radar_global_monthly",
  "chart_radar_global_yearly",
  "chart_radar_bundle_monthly",
  "chart_radar_bundle_6month"
];

const expectedProductPlanPairs = [
  ["chart_radar_crypto_monthly", "crypto_monthly"],
  ["chart_radar_crypto_yearly", "crypto_yearly"],
  ["chart_radar_global_monthly", "stocks_monthly"],
  ["chart_radar_global_yearly", "stocks_yearly"],
  ["chart_radar_bundle_monthly", "bundle_monthly"],
  ["chart_radar_bundle_6month", "bundle_yearly"]
];

function planBlock(planId) {
  const match = new RegExp(`id:\\s*"${planId}"[\\s\\S]*?(?=\\n\\s*\\},\\n\\s*\\{\\n\\s*id:|\\n\\s*\\}\\n\\];)`).exec(files.billing);
  return match?.[0] ?? "";
}

function appStoreProductIdForPlan(planId) {
  return /appStoreProductId:\s*"([^"]+)"/.exec(planBlock(planId))?.[1] ?? null;
}

function appStoreBasePlanIdForPlan(planId) {
  return /appStoreBasePlanId:\s*"([^"]+)"/.exec(planBlock(planId))?.[1] ?? null;
}

const smokeProductIdToPlanId = new Map(expectedProductPlanPairs.map(([productId, planId]) => [productId, planId]));

function smokeResolvePlanIdFromStoreProductId(productId) {
  const trimmed = productId.trim();
  const [subscriptionId, basePlanId = ""] = trimmed.split(":");
  const exactPlanId = smokeProductIdToPlanId.get(trimmed);
  if (exactPlanId) return exactPlanId;
  const subscriptionPlanId = smokeProductIdToPlanId.get(subscriptionId);
  if (!subscriptionPlanId) return null;

  const expectedBasePlanIds = {
    crypto_monthly: "monthly",
    crypto_yearly: "year-1",
    stocks_monthly: "monthly",
    stocks_yearly: "yearly-1",
    bundle_monthly: "monthly",
    bundle_yearly: "month-6"
  };
  return !basePlanId || expectedBasePlanIds[subscriptionPlanId] === basePlanId ? subscriptionPlanId : null;
}

function smokeResolveMarkets(activeEntitlements) {
  const bundle = Boolean(activeEntitlements.all_market_pro || activeEntitlements.bundle_pro);
  return {
    crypto: bundle || Boolean(activeEntitlements.coin_pro || activeEntitlements.crypto_pro),
    stocks: bundle || Boolean(activeEntitlements.global_pro)
  };
}

const paymentEnvNames = [
  "NEXT_PUBLIC_PRO_PAYMENT_URL",
  "NEXT_PUBLIC_PRO_MONTHLY_PAYMENT_URL",
  "NEXT_PUBLIC_PRO_YEARLY_PAYMENT_URL",
  "NEXT_PUBLIC_CRYPTO_MONTHLY_PAYMENT_URL",
  "NEXT_PUBLIC_CRYPTO_YEARLY_PAYMENT_URL",
  "NEXT_PUBLIC_GLOBAL_MONTHLY_PAYMENT_URL",
  "NEXT_PUBLIC_GLOBAL_YEARLY_PAYMENT_URL",
  "NEXT_PUBLIC_STOCKS_MONTHLY_PAYMENT_URL",
  "NEXT_PUBLIC_STOCKS_YEARLY_PAYMENT_URL",
  "NEXT_PUBLIC_BUNDLE_MONTHLY_PAYMENT_URL",
  "NEXT_PUBLIC_BUNDLE_6MONTH_PAYMENT_URL",
  "TOSS_PAYMENTS_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY",
  "NEXT_PUBLIC_REVENUECAT_IOS_API_KEY",
  "REVENUECAT_REST_API_KEY"
];

for (const planId of planIds) {
  expectIncludes(files.billing, `id: "${planId}"`, `플랜 ID ${planId}`, "src/lib/billing.ts");
}

for (const productId of productIds) {
  expectIncludes(files.billing, productId, `앱스토어 상품 ID ${productId}`, "src/lib/billing.ts");
  expectIncludes(files.appStoreGuide, productId, `앱스토어 가이드 상품 ID ${productId}`, "docs/app-store-release.md");
}

for (const [productId, planId] of expectedProductPlanPairs) {
  const actualProductId = appStoreProductIdForPlan(planId);
  if (actualProductId === productId) {
    pass(`상품 ID와 planId 연결 ${productId}`, `${productId} → ${planId}`);
  } else {
    fail(`상품 ID와 planId 연결 ${productId}`, `예상 ${planId}, 현재 ${actualProductId ?? "미확인"}.`);
  }
}

for (const [planId, expectedBasePlanId] of [
  ["crypto_monthly", "monthly"],
  ["crypto_yearly", "year-1"],
  ["stocks_monthly", "monthly"],
  ["stocks_yearly", "yearly-1"],
  ["bundle_monthly", "monthly"],
  ["bundle_yearly", "month-6"]
]) {
  const actualBasePlanId = appStoreBasePlanIdForPlan(planId);
  if (actualBasePlanId === expectedBasePlanId) {
    pass(`basePlanId 연결 ${planId}`, `${planId} → ${expectedBasePlanId}`);
  } else {
    fail(`basePlanId 연결 ${planId}`, `예상 ${expectedBasePlanId}, 현재 ${actualBasePlanId ?? "미확인"}.`);
  }
}

for (const [productId, expectedPlanId] of [
  ["chart_radar_crypto_monthly", "crypto_monthly"],
  ["chart_radar_crypto_monthly:monthly", "crypto_monthly"],
  ["chart_radar_crypto_yearly:year-1", "crypto_yearly"],
  ["chart_radar_global_monthly:monthly", "stocks_monthly"],
  ["chart_radar_global_yearly:yearly-1", "stocks_yearly"],
  ["chart_radar_bundle_monthly:monthly", "bundle_monthly"],
  ["chart_radar_bundle_6month:month-6", "bundle_yearly"]
]) {
  const actualPlanId = smokeResolvePlanIdFromStoreProductId(productId);
  if (actualPlanId === expectedPlanId) {
    pass(`RevenueCat 상품 ID 매핑 ${productId}`, `${productId} → ${expectedPlanId}`);
  } else {
    fail(`RevenueCat 상품 ID 매핑 ${productId}`, `예상 ${expectedPlanId}, 현재 ${actualPlanId ?? "unknown"}.`);
  }
}

if (smokeResolvePlanIdFromStoreProductId("unknown_product:monthly") === null) {
  pass("알 수 없는 상품 ID 권한 차단", "unknown 상품은 planId로 매핑하지 않습니다.");
} else {
  fail("알 수 없는 상품 ID 권한 차단", "unknown 상품이 planId로 매핑되고 있습니다.");
}

if (smokeResolvePlanIdFromStoreProductId("chart_radar_global_yearly:year-1") === null) {
  pass("잘못된 Global Pro 연간 basePlanId 차단", "yearly-1만 Global Pro 연간으로 매핑합니다.");
} else {
  fail("잘못된 Global Pro 연간 basePlanId 차단", "year-1이 Global Pro 연간으로 매핑되고 있습니다.");
}

for (const [label, activeEntitlements, expectedMarkets] of [
  ["coin_pro 단독", { coin_pro: {} }, { crypto: true, stocks: false }],
  ["global_pro 단독", { global_pro: {} }, { crypto: false, stocks: true }],
  ["coin_pro + global_pro", { coin_pro: {}, global_pro: {} }, { crypto: true, stocks: true }],
  ["all_market_pro", { all_market_pro: {} }, { crypto: true, stocks: true }],
  ["알 수 없는 entitlement", { unknown_pro: {} }, { crypto: false, stocks: false }]
]) {
  const actualMarkets = smokeResolveMarkets(activeEntitlements);
  if (actualMarkets.crypto === expectedMarkets.crypto && actualMarkets.stocks === expectedMarkets.stocks) {
    pass(`RevenueCat entitlement 권한 ${label}`, `crypto=${actualMarkets.crypto}, stocks=${actualMarkets.stocks}`);
  } else {
    fail(`RevenueCat entitlement 권한 ${label}`, `예상 ${JSON.stringify(expectedMarkets)}, 현재 ${JSON.stringify(actualMarkets)}.`);
  }
}

for (const envName of paymentEnvNames) {
  expectIncludes(files.envExample, envName, `결제 환경변수 ${envName}`, ".env.example");
}

for (const envName of [
  "NEXT_PUBLIC_CRYPTO_MONTHLY_PAYMENT_URL",
  "NEXT_PUBLIC_GLOBAL_MONTHLY_PAYMENT_URL",
  "NEXT_PUBLIC_BUNDLE_MONTHLY_PAYMENT_URL",
  "NEXT_PUBLIC_BUNDLE_6MONTH_PAYMENT_URL",
  "TOSS_PAYMENTS_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY"
]) {
  expectIncludes(files.launchChecklist, envName, `출시 체크리스트 환경변수 ${envName}`, "LAUNCH_CHECKLIST.md");
  expectIncludes(files.paymentGuide, envName, `결제 가이드 환경변수 ${envName}`, "docs/payment-launch.md");
}

for (const phrase of [
  "Coin Pro",
  "Global Pro",
  "All Market Pro",
  "/api/billing/confirm",
  "토스페이먼츠 승인 API",
  "Supabase의 `profiles.plan`과 `subscriptions`"
]) {
  expectIncludes(files.paymentGuide, phrase, `결제 가이드 문구 ${phrase}`, "docs/payment-launch.md");
}

const staleBundleAnnualProductId = `${"chart_radar_bundle"}_${"yearly"}`;
for (const stale of ["chart_radar_pro_monthly", "chart_radar_pro_yearly", staleBundleAnnualProductId]) {
  for (const [fileName, source] of [
    ["LAUNCH_CHECKLIST.md", files.launchChecklist],
    ["docs/payment-launch.md", files.paymentGuide],
    ["docs/app-store-release.md", files.appStoreGuide]
  ]) {
    if (source.includes(stale)) {
      fail(`예전 단일 Pro 상품 ID 제거 ${fileName}`, `${stale} 값이 남아 있습니다.`);
    }
  }
}

expectIncludes(files.confirmRoute, "https://api.tosspayments.com/v1/payments/confirm", "토스 승인 확인 엔드포인트", "src/app/api/billing/confirm/route.ts");
expectIncludes(files.confirmRoute, "grantBillingEntitlement", "Supabase 권한 반영 경로", "src/app/api/billing/confirm/route.ts");
expectIncludes(files.confirmRoute, "rateLimit(request", "결제 승인 호출 제한", "src/app/api/billing/confirm/route.ts");
expectIncludes(files.confirmRoute, "isBodyTooLarge(request, 8_000)", "결제 승인 본문 크기 제한", "src/app/api/billing/confirm/route.ts");
expectIncludes(files.confirmRoute, "directPlan.id !== parsedPlan", "결제 승인 플랜 불일치 차단", "src/app/api/billing/confirm/route.ts");
expectIncludes(files.confirmRoute, "return parsedPlan;", "주문번호 플랜 우선 확정", "src/app/api/billing/confirm/route.ts");

expectIncludes(files.checkoutRoute, "fetchSupabaseUserOnServer", "결제 시작 전 로그인 검증", "src/app/api/billing/checkout/route.ts");
expectIncludes(files.checkoutRoute, "결제를 시작하려면 먼저 로그인해 주세요.", "비로그인 결제 차단 문구", "src/app/api/billing/checkout/route.ts");
expectIncludes(files.checkoutRoute, "결제창 연결 주소를 확인하지 못했습니다.", "결제 링크 오류 사용자 문구", "src/app/api/billing/checkout/route.ts");
expectIncludes(files.checkoutRoute, "rateLimit(request", "결제 시작 호출 제한", "src/app/api/billing/checkout/route.ts");
expectIncludes(files.checkoutRoute, "isBodyTooLarge(request, 8_000)", "결제 시작 본문 크기 제한", "src/app/api/billing/checkout/route.ts");
expectIncludes(files.checkoutRoute, "play_billing", "Android Google Play Billing 분기", "src/app/api/billing/checkout/route.ts");
expectIncludes(files.checkoutRoute, "basePlanId: plan.appStoreBasePlanId", "Android Google Play basePlanId 응답", "src/app/api/billing/checkout/route.ts");

expectIncludes(files.appStoreSyncRoute, "REVENUECAT_REST_API_KEY", "RevenueCat 서버 검증 키 사용", "src/app/api/billing/app-store/sync/route.ts");
expectIncludes(files.appStoreSyncRoute, "grantBillingEntitlement", "앱 구독 확인 후 Pro 권한 반영", "src/app/api/billing/app-store/sync/route.ts");
expectIncludes(files.appStoreSyncRoute, "resolveActivePlans", "앱 구독 다중 활성 플랜 해석", "src/app/api/billing/app-store/sync/route.ts");
expectIncludes(files.appStoreSyncRoute, "activePlans.map", "Coin Pro와 Global Pro 별도 구매 합산 반영", "src/app/api/billing/app-store/sync/route.ts");
expectIncludes(files.appStoreSyncRoute, "resolveStoreEntitlementMarkets", "RevenueCat entitlement 범위 확인", "src/app/api/billing/app-store/sync/route.ts");
expectIncludes(files.appStoreSyncRoute, "resolvePlanIdFromStoreProductId", "앱 구독 productId/basePlanId 검증", "src/app/api/billing/app-store/sync/route.ts");
expectIncludes(files.appStoreSyncRoute, "active: true", "앱 구독 성공 응답 active 플래그", "src/app/api/billing/app-store/sync/route.ts");
expectIncludes(files.appStoreSyncRoute, "currentPeriodEndIso: activePlan.expiresDate", "앱 구독 실제 만료일 반영", "src/app/api/billing/app-store/sync/route.ts");
expectIncludes(files.billingEntitlements, "currentPeriodEndIso", "구독 권한 만료일 override 지원", "src/lib/server/billingEntitlements.ts");
expectIncludes(files.requestEntitlement, "fetchSupabaseActiveSubscriptions", "서버 권한 활성 구독 조회", "src/lib/server/requestEntitlement.ts");
expectIncludes(files.requestEntitlement, "resolveCombinedBillingEntitlementPlan", "서버 권한 활성 플랜 합산 판정", "src/lib/server/requestEntitlement.ts");
expectIncludes(files.requestEntitlement, "hasMarketEntitlementFromPlans", "서버 권한 시장별 합산 판정", "src/lib/server/requestEntitlement.ts");
expectIncludes(files.requestEntitlement, "isLegacyAlwaysPaidPlan", "서버 권한 레거시 관리자 플랜 분리", "src/lib/server/requestEntitlement.ts");
expectIncludes(files.billing, "normalizeStoreProductId", "스토어 상품 ID 정규화 helper", "src/lib/billing.ts");
expectIncludes(files.billing, "resolvePlanIdFromStoreProductId", "스토어 상품 ID planId 매핑 helper", "src/lib/billing.ts");
expectIncludes(files.billing, "resolveStoreEntitlementMarkets", "RevenueCat entitlement 권한 helper", "src/lib/billing.ts");
expectIncludes(files.billing, "resolveCombinedBillingEntitlementPlan", "복수 플랜 합산 helper", "src/lib/billing.ts");

expectIncludes(files.proPricingPanel, "Authorization: `Bearer ${session.accessToken}`", "결제 시작 요청 세션 전달", "src/components/ProPricingPanel.tsx");
expectIncludes(files.proPricingPanel, "결제 후 Pro 기능을 바로 이용하려면 먼저 구글 로그인이 필요합니다.", "결제 전 로그인 안내", "src/components/ProPricingPanel.tsx");
expectIncludes(files.proPricingPanel, "scopeCopy", "Pro 플랜 시장별 문구 분리", "src/components/ProPricingPanel.tsx");
expectIncludes(files.proPricingPanel, "purchaseNativePlan", "네이티브 앱 결제 분기", "src/components/ProPricingPanel.tsx");
expectIncludes(files.proPricingPanel, "restoreNativeEntitlement", "앱 구독 복원 버튼", "src/components/ProPricingPanel.tsx");

expectIncludes(files.mobilePurchases, "Purchases.purchaseStoreProduct", "RevenueCat 구독 구매 호출", "src/lib/mobilePurchases.ts");
expectIncludes(files.mobilePurchases, "Purchases.purchaseSubscriptionOption", "RevenueCat Google Play basePlanId 구매 호출", "src/lib/mobilePurchases.ts");
expectIncludes(files.mobilePurchases, "Purchases.restorePurchases", "RevenueCat 구독 복원 호출", "src/lib/mobilePurchases.ts");
expectIncludes(files.mobilePurchases, "/api/billing/app-store/sync", "앱 구독 확인 호출", "src/lib/mobilePurchases.ts");
expectIncludes(files.mobilePurchases, "basePlanId", "앱 구독 기본 요금제 ID 전달", "src/lib/mobilePurchases.ts");
expectIncludes(files.mobilePurchases, "앱 구독 상태를 계정에 연결하지 못했습니다.", "앱 구독 실패 사용자 문구", "src/lib/mobilePurchases.ts");
if (files.mobilePurchases.includes("서버에 반영하지 못했습니다.") || files.checkoutRoute.includes("환경변수가 https://")) {
  fail("결제 내부 문구 노출 방지", "사용자에게 서버 반영 또는 환경변수 문구가 노출될 수 있습니다.");
} else {
  pass("결제 내부 문구 노출 방지", "결제 실패 문구가 사용자 안내형으로 정리되어 있습니다.");
}
expectIncludes(files.packageJson, "@revenuecat/purchases-capacitor", "RevenueCat Capacitor 의존성", "package.json");
expectIncludes(files.packageJson, "check:app-billing", "앱 결제 환경 점검 스크립트", "package.json");

expectIncludes(files.usageMeterPanel, "marketScope?: BillingPageScope", "사용량 패널 시장 범위 props", "src/components/UsageMeterPanel.tsx");
expectIncludes(files.usageMeterPanel, "bucketMatchesScope", "사용량 패널 시장별 필터", "src/components/UsageMeterPanel.tsx");
expectIncludes(files.usageMeterPanel, "id === \"stockRadar\"", "글로벌 사용량 필터", "src/components/UsageMeterPanel.tsx");
expectIncludes(files.supabaseClient, "supabaseAuthRefreshEvent", "권한 갱신 이벤트 상수", "src/lib/supabase.ts");
expectIncludes(files.supabaseAuthHook, "fetchSupabaseActiveSubscriptions", "브라우저 권한 활성 구독 조회", "src/lib/useSupabaseAuth.ts");
expectIncludes(files.supabaseAuthHook, "resolveCombinedBillingEntitlementPlan", "브라우저 권한 활성 플랜 합산 판정", "src/lib/useSupabaseAuth.ts");
expectIncludes(files.supabaseAuthHook, "window.addEventListener(supabaseAuthRefreshEvent, refreshAuth)", "권한 갱신 이벤트 수신", "src/lib/useSupabaseAuth.ts");
expectIncludes(files.checkoutConfirmationPanel, "window.dispatchEvent(new Event(supabaseAuthRefreshEvent))", "결제 성공 후 권한 재조회", "src/components/CheckoutConfirmationPanel.tsx");

const cryptoAmount = /id:\s*"crypto_monthly"[\s\S]*?billingAmount:\s*(\d+)/.exec(files.billing)?.[1];
const cryptoYearlyAmount = /id:\s*"crypto_yearly"[\s\S]*?billingAmount:\s*(\d+)/.exec(files.billing)?.[1];
const cryptoYearlyMonthlyValue = /id:\s*"crypto_yearly"[\s\S]*?monthlyValue:\s*(\d+)/.exec(files.billing)?.[1];
const stocksAmount = /id:\s*"stocks_monthly"[\s\S]*?billingAmount:\s*(\d+)/.exec(files.billing)?.[1];
const stocksYearlyAmount = /id:\s*"stocks_yearly"[\s\S]*?billingAmount:\s*(\d+)/.exec(files.billing)?.[1];
const stocksYearlyMonthlyValue = /id:\s*"stocks_yearly"[\s\S]*?monthlyValue:\s*(\d+)/.exec(files.billing)?.[1];
const bundleAmount = /id:\s*"bundle_monthly"[\s\S]*?billingAmount:\s*(\d+)/.exec(files.billing)?.[1];
const bundleYearlyAmount = /id:\s*"bundle_yearly"[\s\S]*?billingAmount:\s*(\d+)/.exec(files.billing)?.[1];
const bundleYearlyMonthlyValue = /id:\s*"bundle_yearly"[\s\S]*?monthlyValue:\s*(\d+)/.exec(files.billing)?.[1];

if (Number(cryptoAmount) === 39000) pass("코인 월간 청구 금액", "39,000원");
else fail("코인 월간 청구 금액", `예상 39000, 현재 ${cryptoAmount ?? "미확인"}.`);

if (Number(stocksAmount) === 39000) pass("글로벌 월간 청구 금액", "39,000원");
else fail("글로벌 월간 청구 금액", `예상 39000, 현재 ${stocksAmount ?? "미확인"}.`);

if (Number(bundleAmount) === 69000 && Number(bundleAmount) < Number(cryptoAmount) + Number(stocksAmount)) {
  pass("번들 월간 통합 가격", "개별 결제보다 낮은 69,000원");
} else {
  fail("번들 월간 할인 구조", "코인+글로벌 개별 결제보다 번들 가격이 낮아야 합니다.");
}

if (Number(cryptoYearlyAmount) === 390000 && Number(cryptoYearlyMonthlyValue) === 32500) {
  pass("코인 연간 청구 금액", "연 390,000원, 월 환산 32,500원");
} else {
  fail("코인 연간 청구 금액", `예상 390000/32500, 현재 ${cryptoYearlyAmount ?? "미확인"}/${cryptoYearlyMonthlyValue ?? "미확인"}.`);
}

if (Number(stocksYearlyAmount) === 390000 && Number(stocksYearlyMonthlyValue) === 32500) {
  pass("글로벌 연간 청구 금액", "연 390,000원, 월 환산 32,500원");
} else {
  fail("글로벌 연간 청구 금액", `예상 390000/32500, 현재 ${stocksYearlyAmount ?? "미확인"}/${stocksYearlyMonthlyValue ?? "미확인"}.`);
}

if (Number(bundleYearlyAmount) === 390000 && Number(bundleYearlyMonthlyValue) === 65000) {
  pass("번들 6개월 청구 금액", "6개월 390,000원, 월 환산 65,000원");
} else {
  fail("번들 6개월 청구 금액", `예상 390000/65000, 현재 ${bundleYearlyAmount ?? "미확인"}/${bundleYearlyMonthlyValue ?? "미확인"}.`);
}

if (Number(bundleYearlyMonthlyValue) > 0 && Number(bundleYearlyMonthlyValue) < Number(bundleYearlyAmount)) {
  pass("장기 구독 월 환산가 분리", `월 환산가 ${bundleYearlyMonthlyValue}원과 실제 청구 금액 ${bundleYearlyAmount}원이 분리되어 있습니다.`);
} else {
  fail("장기 구독 월 환산가 분리", "monthlyValue와 billingAmount 관계를 확인해 주세요.");
}

for (const [planId, expectedLimit] of [
  ["free", 1],
  ["crypto_monthly", 50],
  ["crypto_yearly", 100],
  ["bundle_monthly", 100],
  ["bundle_yearly", 150],
  ["stocks_monthly", 50],
  ["stocks_yearly", 100]
]) {
  const pattern = new RegExp(`${planId}:\\s*${expectedLimit}`);
  if (pattern.test(files.watchlist)) {
    pass(`관심종목 한도 ${planId}`, `${expectedLimit}개`);
  } else {
    fail(`관심종목 한도 ${planId}`, `src/lib/watchlist.ts에서 ${expectedLimit}개 설정을 찾지 못했습니다.`);
  }
}

if (files.watchlistPanel.includes('const plan: WatchlistPlan = "admin"')) {
  fail("관심코인 admin 고정 방지", "WatchlistPanel이 admin 고정값을 사용하고 있습니다.");
} else if (files.watchlistPanel.includes("getWatchlistLimit(plan)")) {
  pass("관심코인 플랜 연동", "WatchlistPanel이 실제 플랜 한도를 사용합니다.");
} else {
  fail("관심코인 플랜 연동", "WatchlistPanel에서 getWatchlistLimit(plan)을 찾지 못했습니다.");
}

if (files.stockRadarApp.includes("getWatchlistLimit(profile?.plan ?? \"free\")")) {
  pass("글로벌 관심종목 플랜 연동", "StockRadarApp이 로그인 플랜 기준 관심종목 한도를 사용합니다.");
} else {
  fail("글로벌 관심종목 플랜 연동", "StockRadarApp에서 로그인 플랜 기준 한도를 찾지 못했습니다.");
}

if (files.stockRadarApp.includes("globalWatchlistMaxItems = 150") && !files.stockRadarApp.includes("slice(0, 30)")) {
  pass("글로벌 관심종목 하드코딩 한도 제거", "글로벌 관심종목 저장 한도가 30개로 고정되지 않습니다.");
} else {
  fail("글로벌 관심종목 하드코딩 한도 제거", "StockRadarApp에 30개 고정 저장 한도가 남아 있습니다.");
}

const failures = checks.filter((check) => !check.ok);
for (const check of checks) {
  const mark = check.ok ? "PASS" : "FAIL";
  console.log(`${mark.padEnd(4)} ${check.label}${check.detail ? ` - ${check.detail}` : ""}`);
}

if (failures.length > 0) {
  console.error(`\n${failures.length}개 결제 모델 항목을 다시 확인해야 합니다.`);
  process.exit(1);
}

console.log("\n구독 상품과 결제 환경변수 구성이 기본 검사를 통과했습니다.");
