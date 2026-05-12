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

if (!billing) fail("결제 플랜 소스", "src/lib/billing.ts 파일을 읽지 못했습니다.");
if (!envExample) fail("환경변수 예시", ".env.example 파일을 읽지 못했습니다.");
if (!confirmRoute) fail("결제 승인 확인 API", "src/app/api/billing/confirm/route.ts 파일을 읽지 못했습니다.");

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

expectIncludes(confirmRoute, "https://api.tosspayments.com/v1/payments/confirm", "토스 승인 확인 엔드포인트", "src/app/api/billing/confirm/route.ts");
expectIncludes(confirmRoute, "supabaseAdminRest", "Supabase 권한 반영 경로", "src/app/api/billing/confirm/route.ts");

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
