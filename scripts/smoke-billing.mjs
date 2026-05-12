// 출시 전 구독 상품 ID와 결제 환경변수 구성을 빠르게 점검하는 로컬 스모크 테스트입니다.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const checks = [];

function read(relativePath) {
  const absolutePath = join(root, relativePath);
  if (!existsSync(absolutePath)) return "";
  return readFileSync(absolutePath, "utf8");
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

const billing = read("src/lib/billing.ts");
const envExample = read(".env.example");
const confirmRoute = read("src/app/api/billing/confirm/route.ts");
const checkoutRoute = read("src/app/api/billing/checkout/route.ts");
const proPricingPanel = read("src/components/ProPricingPanel.tsx");
const checkoutConfirmationPanel = read("src/components/CheckoutConfirmationPanel.tsx");
const supabaseClient = read("src/lib/supabase.ts");
const supabaseAuthHook = read("src/lib/useSupabaseAuth.ts");
const watchlist = read("src/lib/watchlist.ts");
const watchlistPanel = read("src/components/WatchlistPanel.tsx");
const launchChecklist = read("LAUNCH_CHECKLIST.md");
const paymentGuide = read("docs/payment-launch.md");
const appStoreGuide = read("docs/app-store-release.md");

if (!billing) fail("결제 플랜 소스", "src/lib/billing.ts 파일을 읽지 못했습니다.");
if (!envExample) fail("환경변수 예시", ".env.example 파일을 읽지 못했습니다.");
if (!confirmRoute) fail("결제 승인 확인 API", "src/app/api/billing/confirm/route.ts 파일을 읽지 못했습니다.");
if (!checkoutRoute) fail("결제 시작 API", "src/app/api/billing/checkout/route.ts 파일을 읽지 못했습니다.");
if (!proPricingPanel) fail("Pro 결제 패널", "src/components/ProPricingPanel.tsx 파일을 읽지 못했습니다.");
if (!checkoutConfirmationPanel) fail("결제 성공 패널", "src/components/CheckoutConfirmationPanel.tsx 파일을 읽지 못했습니다.");
if (!supabaseClient) fail("Supabase 클라이언트", "src/lib/supabase.ts 파일을 읽지 못했습니다.");
if (!supabaseAuthHook) fail("Supabase 인증 훅", "src/lib/useSupabaseAuth.ts 파일을 읽지 못했습니다.");
if (!watchlist) fail("관심코인 한도 소스", "src/lib/watchlist.ts 파일을 읽지 못했습니다.");
if (!watchlistPanel) fail("관심코인 패널", "src/components/WatchlistPanel.tsx 파일을 읽지 못했습니다.");
if (!launchChecklist) fail("출시 체크리스트", "LAUNCH_CHECKLIST.md 파일을 읽지 못했습니다.");
if (!paymentGuide) fail("결제 출시 가이드", "docs/payment-launch.md 파일을 읽지 못했습니다.");
if (!appStoreGuide) fail("앱스토어 출시 가이드", "docs/app-store-release.md 파일을 읽지 못했습니다.");

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
  "chart_radar_bundle_yearly"
];

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
  "NEXT_PUBLIC_BUNDLE_YEARLY_PAYMENT_URL",
  "TOSS_PAYMENTS_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY"
];

for (const planId of planIds) {
  expectIncludes(billing, `id: "${planId}"`, `플랜 ID ${planId}`, "src/lib/billing.ts");
}

for (const productId of productIds) {
  expectIncludes(billing, productId, `앱스토어 상품 ID ${productId}`, "src/lib/billing.ts");
}

for (const envName of paymentEnvNames) {
  expectIncludes(envExample, envName, `결제 환경변수 ${envName}`, ".env.example");
}

for (const envName of [
  "NEXT_PUBLIC_CRYPTO_MONTHLY_PAYMENT_URL",
  "NEXT_PUBLIC_GLOBAL_MONTHLY_PAYMENT_URL",
  "NEXT_PUBLIC_BUNDLE_MONTHLY_PAYMENT_URL",
  "TOSS_PAYMENTS_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY"
]) {
  expectIncludes(launchChecklist, envName, `출시 체크리스트 환경변수 ${envName}`, "LAUNCH_CHECKLIST.md");
  expectIncludes(paymentGuide, envName, `결제 가이드 환경변수 ${envName}`, "docs/payment-launch.md");
}

for (const phrase of [
  "Coin Pro",
  "Global Pro",
  "All Market Pro",
  "/api/billing/confirm",
  "토스페이먼츠 승인 API",
  "Supabase의 `profiles.plan`과 `subscriptions`"
]) {
  expectIncludes(paymentGuide, phrase, `결제 가이드 최신 문구 ${phrase}`, "docs/payment-launch.md");
}

for (const productId of productIds) {
  expectIncludes(appStoreGuide, productId, `앱스토어 가이드 상품 ID ${productId}`, "docs/app-store-release.md");
}

for (const [fileName, source] of [
  ["LAUNCH_CHECKLIST.md", launchChecklist],
  ["docs/payment-launch.md", paymentGuide],
  ["docs/app-store-release.md", appStoreGuide]
]) {
  for (const stale of [
    "월간 Pro와 연간 Pro 상품",
    "웹훅과 구독 권한 동기화",
    "chart_radar_pro_monthly",
    "chart_radar_pro_yearly"
  ]) {
    if (source.includes(stale)) {
      fail(`오래된 결제 문구 방지 ${fileName}`, `${stale} 문구가 남아 있습니다.`);
    }
  }
}

expectIncludes(confirmRoute, "https://api.tosspayments.com/v1/payments/confirm", "토스 승인 확인 엔드포인트", "src/app/api/billing/confirm/route.ts");
expectIncludes(confirmRoute, "supabaseAdminRest", "Supabase 권한 반영 경로", "src/app/api/billing/confirm/route.ts");
expectIncludes(confirmRoute, "rateLimit(request", "결제 승인 호출 제한", "src/app/api/billing/confirm/route.ts");
expectIncludes(confirmRoute, "isBodyTooLarge(request, 8_000)", "결제 승인 본문 크기 제한", "src/app/api/billing/confirm/route.ts");
expectIncludes(checkoutRoute, "fetchSupabaseUserOnServer", "결제 시작 전 로그인 검증", "src/app/api/billing/checkout/route.ts");
expectIncludes(checkoutRoute, "결제를 시작하려면 먼저 로그인해 주세요.", "비로그인 결제 차단 문구", "src/app/api/billing/checkout/route.ts");
expectIncludes(checkoutRoute, "rateLimit(request", "결제 시작 호출 제한", "src/app/api/billing/checkout/route.ts");
expectIncludes(checkoutRoute, "isBodyTooLarge(request, 8_000)", "결제 시작 본문 크기 제한", "src/app/api/billing/checkout/route.ts");
expectIncludes(proPricingPanel, "Authorization: `Bearer ${session.accessToken}`", "결제 시작 요청 세션 전달", "src/components/ProPricingPanel.tsx");
expectIncludes(proPricingPanel, "결제 후 Pro 권한을 바로 열려면 먼저 구글 로그인이 필요합니다.", "결제 전 로그인 안내", "src/components/ProPricingPanel.tsx");
expectIncludes(supabaseClient, "supabaseAuthRefreshEvent", "권한 갱신 이벤트 상수", "src/lib/supabase.ts");
expectIncludes(supabaseAuthHook, "window.addEventListener(supabaseAuthRefreshEvent, refreshAuth)", "권한 갱신 이벤트 수신", "src/lib/useSupabaseAuth.ts");
expectIncludes(checkoutConfirmationPanel, "window.dispatchEvent(new Event(supabaseAuthRefreshEvent))", "결제 성공 후 권한 재조회", "src/components/CheckoutConfirmationPanel.tsx");

const cryptoAmount = /id:\s*"crypto_monthly"[\s\S]*?billingAmount:\s*(\d+)/.exec(billing)?.[1];
const stocksAmount = /id:\s*"stocks_monthly"[\s\S]*?billingAmount:\s*(\d+)/.exec(billing)?.[1];
const bundleAmount = /id:\s*"bundle_monthly"[\s\S]*?billingAmount:\s*(\d+)/.exec(billing)?.[1];
const bundleYearlyAmount = /id:\s*"bundle_yearly"[\s\S]*?billingAmount:\s*(\d+)/.exec(billing)?.[1];
const bundleYearlyMonthlyValue = /id:\s*"bundle_yearly"[\s\S]*?monthlyValue:\s*(\d+)/.exec(billing)?.[1];

if (Number(cryptoAmount) === 14900) {
  pass("코인 월간 청구 금액", "14,900원.");
} else {
  fail("코인 월간 청구 금액", `예상 14900, 현재 ${cryptoAmount ?? "미확인"}.`);
}

if (Number(stocksAmount) === 14900) {
  pass("글로벌 월간 청구 금액", "14,900원.");
} else {
  fail("글로벌 월간 청구 금액", `예상 14900, 현재 ${stocksAmount ?? "미확인"}.`);
}

if (Number(bundleAmount) === 24900 && Number(bundleAmount) < Number(cryptoAmount) + Number(stocksAmount)) {
  pass("번들 월간 할인 구조", "개별 결제보다 낮은 24,900원.");
} else {
  fail("번들 월간 할인 구조", "코인+글로벌 개별 결제보다 번들 가격이 낮아야 합니다.");
}

if (Number(bundleYearlyMonthlyValue) > 0 && Number(bundleYearlyMonthlyValue) < Number(bundleYearlyAmount)) {
  pass("연간 월 환산가 분리", `월 환산가 ${bundleYearlyMonthlyValue}원과 실제 청구 금액 ${bundleYearlyAmount}원이 분리되어 있습니다.`);
} else {
  fail("연간 월 환산가 분리", "monthlyValue와 billingAmount 관계를 확인해 주세요.");
}

const watchlistLimitChecks = [
  ["free", 5],
  ["crypto_monthly", 50],
  ["crypto_yearly", 100],
  ["bundle_monthly", 100],
  ["bundle_yearly", 150],
  ["stocks_monthly", 5],
  ["stocks_yearly", 5]
];

for (const [planId, expectedLimit] of watchlistLimitChecks) {
  const pattern = new RegExp(`${planId}:\\s*${expectedLimit}`);
  if (pattern.test(watchlist)) {
    pass(`관심코인 한도 ${planId}`, `${expectedLimit}개.`);
  } else {
    fail(`관심코인 한도 ${planId}`, `src/lib/watchlist.ts에서 ${expectedLimit}개 설정을 찾지 못했습니다.`);
  }
}

if (watchlistPanel.includes('const plan: WatchlistPlan = "admin"')) {
  fail("관심코인 admin 고정 방지", "WatchlistPanel이 다시 admin 고정값을 사용하고 있습니다.");
} else if (watchlistPanel.includes("getWatchlistLimit(plan)")) {
  pass("관심코인 플랜 연동", "WatchlistPanel이 실제 플랜 한도를 사용합니다.");
} else {
  fail("관심코인 플랜 연동", "WatchlistPanel에서 getWatchlistLimit(plan)을 찾지 못했습니다.");
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
