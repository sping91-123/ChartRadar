// 출시 전 모든 App Router page와 보호 API의 응답/redirect 목적지를 확인합니다.
import { existsSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

const root = process.cwd();
const baseUrl = (process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 45_000);
const smokeClientIp = `127.0.1.${Math.floor(Math.random() * 200) + 20}`;

async function detectNewsImpactMode() {
  const override = process.env.SMOKE_NEWS_IMPACT_MODE;
  if (override === "off" || override === "shadow" || override === "on") return override;
  try {
    const response = await fetch(`${baseUrl}/api/news-impact?market=crypto&asset=btc`, {
      headers: { "x-forwarded-for": smokeClientIp }
    });
    const payload = await response.json();
    if (payload?.mode === "off" || payload?.mode === "shadow" || payload?.mode === "on") return payload.mode;
  } catch {}
  const configured = process.env.NEWS_IMPACT_V1;
  return configured === "shadow" || configured === "on" ? configured : "off";
}

const newsImpactRuntimeMode = await detectNewsImpactMode();
console.log(`News Impact runtime mode: ${newsImpactRuntimeMode}`);

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
  "/privacy",
  "/pro",
  "/refund",
  "/schedule?market=crypto",
  "/stocks",
  "/terms"
].map((path) => ({ label: path, path }));

const newsPageChecks = newsImpactRuntimeMode === "on"
  ? ["/crypto/news", "/news?market=global"].map((path) => ({ label: `${path} (on)`, path }))
  : [
      { label: `/crypto/news (${newsImpactRuntimeMode})`, path: "/crypto/news", expectedStatus: [307, 308], expectedLocation: "/crypto/home" },
      { label: `/news?market=global (${newsImpactRuntimeMode})`, path: "/news?market=global", expectedStatus: [307, 308], expectedLocation: "/global" }
    ];

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
  ["/alerts?market=crypto", "/crypto/alertlist"],
  ["/macro-calendar?market=global", "/schedule?market=global"]
].map(([path, expectedLocation]) => ({
  label: `${path} → ${expectedLocation}`,
  path,
  expectedStatus: [307, 308],
  expectedLocation
}));

redirectChecks.push({
  label: `/news?market=crypto → ${newsImpactRuntimeMode === "on" ? "/crypto/news" : "/crypto/home"}`,
  path: "/news?market=crypto",
  expectedStatus: [307, 308],
  expectedLocation: newsImpactRuntimeMode === "on" ? "/crypto/news" : "/crypto/home"
});

if (newsImpactRuntimeMode === "on") {
  const eventId = "20000000-0000-4000-8000-000000000001";
  const snapshotId = "10000000-0000-4000-8000-000000000001";
  redirectChecks.push({
    label: "/news crypto compatibility link preserves decision context",
    path: `/news?market=crypto&asset=eth&event=${eventId}&snapshot=${snapshotId}&source=alert&ignored=drop-me`,
    expectedStatus: [307, 308],
    expectedLocation: `/crypto/news?asset=eth&event=${eventId}&snapshot=${snapshotId}&source=alert`
  });
}

const assetChecks = [
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.webmanifest",
  "/api/health"
].map((path) => ({ label: path, path }));

assetChecks.push({
  label: "/api/news-impact?market=crypto&asset=btc",
  path: "/api/news-impact?market=crypto&asset=btc",
  expectedStatus: newsImpactRuntimeMode === "on" ? [200, 503] : [200]
});

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
    label: "News Impact sync requires cron secret",
    path: "/api/news-sync",
    expectedStatus: [401]
  },
  {
    label: "News Impact preference requires login",
    path: "/api/news-impact/preferences?market=crypto",
    expectedStatus: [401]
  },
  {
    label: "News Impact detail rejects invalid IDs",
    path: "/api/news-impact/not-a-uuid?market=crypto&asset=btc",
    expectedStatus: [400]
  },
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
  },
  {
    label: "Perpetual monitor list requires login",
    path: "/api/crypto/perpetual/monitors?status=active",
    expectedStatus: [401]
  },
  {
    label: "Perpetual monitor creation requires login",
    path: "/api/crypto/perpetual/monitors",
    method: "POST",
    body: { snapshotId: "70000000-0000-4000-8000-000000000001", conditionId: "smoke" },
    expectedStatus: [401]
  },
  {
    label: "Perpetual monitor update requires login",
    path: "/api/crypto/perpetual/monitors/70000000-0000-4000-8000-000000000001",
    method: "PATCH",
    body: { action: "pause" },
    expectedStatus: [401]
  },
  {
    label: "Perpetual Journal save requires login",
    path: "/api/crypto/perpetual/journal",
    method: "POST",
    body: { snapshotId: "70000000-0000-4000-8000-000000000001", source: "snapshot" },
    expectedStatus: [401]
  },
  {
    label: "Perpetual AI explanation requires Coin Pro",
    path: "/api/crypto/perpetual/briefing",
    method: "POST",
    body: { snapshotId: "70000000-0000-4000-8000-000000000001" },
    expectedStatus: [401]
  }
];

const checks = [...pageChecks, ...newsPageChecks, ...redirectChecks, ...assetChecks, ...disabledBillingChecks, ...protectedApiChecks];

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
