// 출시 전 모든 App Router page와 보호 API의 응답/redirect 목적지를 확인합니다.
import { existsSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

const root = process.cwd();
const baseUrl = (process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 15_000);
const smokeClientIp = `127.0.1.${Math.floor(Math.random() * 200) + 20}`;

const pageChecks = [
  "/",
  "/account",
  "/account/delete",
  "/admin/entitlements",
  "/alerts?market=global",
  "/auth/callback",
  "/checkout/fail",
  "/checkout/success",
  "/crypto/alert",
  "/crypto/alertlist",
  "/crypto/alertset",
  "/crypto/home",
  "/crypto/news",
  "/crypto/perpetual",
  "/crypto/perpetual/alts",
  "/crypto/review",
  "/crypto/spot",
  "/faq",
  "/global",
  "/global/alertlist",
  "/global/assets",
  "/journal",
  "/learn",
  "/login",
  "/menu",
  "/news?market=global",
  "/privacy",
  "/pro",
  "/refund",
  "/schedule?market=crypto",
  "/stocks",
  "/terms"
].map((path) => ({ label: path, path }));

const redirectChecks = [
  ["/crypto", "/crypto/home"],
  ["/majors", "/crypto/perpetual"],
  ["/alts", "/crypto/perpetual/alts"],
  ["/coin", "/crypto/home"],
  ["/spot", "/crypto/spot"],
  ["/diagnosis", "/crypto/home"],
  ["/report", "/crypto/home"],
  ["/settings", "/menu"],
  ["/pro/apply", "/pro"],
  ["/calculator", "/crypto/home"],
  ["/news?market=crypto", "/crypto/news"],
  ["/alerts?market=crypto", "/crypto/alertlist"],
  ["/macro-calendar?market=global", "/schedule?market=global"]
].map(([path, expectedLocation]) => ({
  label: `${path} → ${expectedLocation}`,
  path,
  expectedStatus: [307, 308],
  expectedLocation
}));

const assetChecks = [
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.webmanifest",
  "/api/health"
].map((path) => ({ label: path, path }));

const disabledBillingChecks = [
  {
    label: "Toss checkout disabled",
    path: "/api/billing/checkout",
    method: "POST",
    body: { planId: "crypto_monthly", platform: "web" },
    expectedStatus: [410]
  },
  {
    label: "Toss confirm disabled",
    path: "/api/billing/confirm",
    method: "POST",
    body: { planId: "crypto_monthly", orderId: "smoke", amount: 1, paymentKey: "smoke" },
    expectedStatus: [410]
  }
];

const protectedApiChecks = [
  {
    label: "account deletion status requires login",
    path: "/api/account/deletion",
    expectedStatus: [401]
  },
  {
    label: "account deletion request requires login",
    path: "/api/account/deletion",
    method: "POST",
    body: {},
    expectedStatus: [401]
  },
  {
    label: "Apple authorization storage requires login",
    path: "/api/auth/apple/authorization",
    method: "POST",
    body: { authorizationCode: "smoke" },
    expectedStatus: [401]
  },
  {
    label: "admin deletion queue requires login",
    path: "/api/admin/account-deletions",
    expectedStatus: [401]
  },
  {
    label: "deletion worker requires cron secret",
    path: "/api/account-deletions/process",
    expectedStatus: [401]
  },
  {
    label: "app-store sync requires login",
    path: "/api/billing/app-store/sync",
    method: "POST",
    body: { appUserId: "smoke", platform: "android" },
    expectedStatus: [401]
  }
];

const checks = [...pageChecks, ...redirectChecks, ...assetChecks, ...disabledBillingChecks, ...protectedApiChecks];

function walkPageFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(directory, entry.name);
    return entry.isDirectory() ? walkPageFiles(absolutePath) : entry.name === "page.tsx" ? [absolutePath] : [];
  });
}

function routeFromPageFile(filePath) {
  const normalized = relative(join(root, "src", "app"), filePath).split(sep).join("/");
  const route = normalized.replace(/(?:^|\/)page\.tsx$/, "").replace(/\([^/]+\)\//g, "");
  return route ? `/${route}` : "/";
}

const manifestRoutes = new Set(checks.map((check) => new URL(check.path, baseUrl).pathname));
const pageRoutes = walkPageFiles(join(root, "src", "app")).map(routeFromPageFile).sort();
const missingRoutes = pageRoutes.filter((route) => !manifestRoutes.has(route));
if (missingRoutes.length > 0) {
  console.error(`FAIL smoke manifest에 없는 page route: ${missingRoutes.join(", ")}`);
  process.exit(1);
}
console.log(`PASS page route manifest coverage (${pageRoutes.length})`);

function normalizedLocation(location) {
  if (!location) return "";
  const url = new URL(location, baseUrl);
  return `${url.pathname}${url.search}`;
}

async function fetchWithTimeout(check) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${check.path}`, {
      method: check.method ?? "GET",
      headers: {
        ...(check.body ? { "content-type": "application/json" } : {}),
        "x-forwarded-for": smokeClientIp
      },
      body: check.body ? JSON.stringify(check.body) : undefined,
      signal: controller.signal,
      redirect: "manual"
    });
    const detail = (await response.text()).slice(0, 180).replace(/\s+/g, " ").trim();
    const expectedStatus = check.expectedStatus ?? [200, 201, 202, 204];
    const actualLocation = normalizedLocation(response.headers.get("location"));
    const locationMatches = !check.expectedLocation || actualLocation === check.expectedLocation;
    return {
      check,
      status: response.status,
      actualLocation,
      detail,
      ok: expectedStatus.includes(response.status) && locationMatches
    };
  } catch (error) {
    return { check, status: "ERR", actualLocation: "", detail: error instanceof Error ? error.message : String(error), ok: false };
  } finally {
    clearTimeout(timer);
  }
}

const results = await Promise.all(checks.map(fetchWithTimeout));
const failures = results.filter((result) => !result.ok);
for (const result of results) {
  console.log(`${result.ok ? "PASS" : "FAIL"} ${String(result.status).padEnd(4)} ${result.check.label}`);
  if (!result.ok) {
    if (result.check.expectedLocation) console.log(`     Location expected=${result.check.expectedLocation} actual=${result.actualLocation || "missing"}`);
    if (result.detail) console.log(`     ${result.detail}`);
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length}개 경로가 스모크 테스트를 통과하지 못했습니다. 기준 URL: ${baseUrl}`);
  process.exit(1);
}

console.log(`\n모든 page route, redirect, 보호 API가 정상 응답했습니다. 기준 URL: ${baseUrl}`);
