// 앱 구독 결제에 필요한 로컬 환경변수와 상품 ID 설정을 점검합니다.
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const envPath = path.join(root, ".env.local");
const billingPath = path.join(root, "src", "lib", "billing.ts");

const requiredEnvKeys = [
  "NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY",
  "REVENUECAT_REST_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY"
];

const optionalEnvKeys = [
  "NEXT_PUBLIC_REVENUECAT_IOS_API_KEY"
];

const expectedProductIds = [
  "chart_radar_crypto_monthly",
  "chart_radar_crypto_yearly",
  "chart_radar_global_monthly",
  "chart_radar_global_yearly",
  "chart_radar_bundle_monthly",
  "chart_radar_bundle_6month"
];

function parseEnv(text) {
  const result = new Map();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    result.set(key, value);
  }
  return result;
}

function pass(label, detail) {
  console.log(`PASS ${label}${detail ? ` - ${detail}` : ""}`);
}

function warn(label, detail) {
  console.warn(`WARN ${label}${detail ? ` - ${detail}` : ""}`);
}

function fail(label, detail) {
  console.error(`FAIL ${label}${detail ? ` - ${detail}` : ""}`);
  process.exitCode = 1;
}

if (!fs.existsSync(envPath)) {
  fail(".env.local", "파일이 없습니다.");
} else {
  const env = parseEnv(fs.readFileSync(envPath, "utf8"));

  for (const key of requiredEnvKeys) {
    const value = env.get(key);
    if (value && !value.includes("your-") && value !== "***") {
      pass(`환경변수 ${key}`, "값이 들어 있습니다.");
    } else {
      fail(`환경변수 ${key}`, "Android 앱 결제 실사용 전에 반드시 입력해야 합니다.");
    }
  }

  for (const key of optionalEnvKeys) {
    const value = env.get(key);
    if (value && !value.includes("your-") && value !== "***") {
      pass(`환경변수 ${key}`, "값이 들어 있습니다.");
    } else {
      warn(`환경변수 ${key}`, "iOS 출시 전에는 입력해야 합니다.");
    }
  }
}

if (!fs.existsSync(billingPath)) {
  fail("billing.ts", "파일을 찾지 못했습니다.");
} else {
  const billingSource = fs.readFileSync(billingPath, "utf8");
  for (const productId of expectedProductIds) {
    if (billingSource.includes(productId)) {
      pass(`상품 ID ${productId}`, "코드에 연결되어 있습니다.");
    } else {
      fail(`상품 ID ${productId}`, "src/lib/billing.ts에 없습니다.");
    }
  }
}

if (process.exitCode) {
  console.error("\n앱 결제 설정이 아직 완료되지 않았습니다. 위 FAIL 항목을 먼저 채워 주세요.");
} else {
  console.log("\nAndroid 앱 구독 결제 환경변수와 상품 ID 기본 점검이 통과했습니다.");
}
