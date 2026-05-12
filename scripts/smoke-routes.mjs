// 출시 전 핵심 페이지와 결제 진입 API 응답을 점검하는 로컬 스모크 테스트다.
const baseUrl = (process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 15000);

const checks = [
  { label: "홈", path: "/" },
  { label: "BTC/ETH", path: "/survival" },
  { label: "알트코인", path: "/alts" },
  { label: "글로벌", path: "/global" },
  { label: "해외주식", path: "/stocks" },
  { label: "레이더 뉴스", path: "/news" },
  { label: "알림 센터", path: "/alerts" },
  { label: "Pro", path: "/pro" },
  { label: "로그인", path: "/login" },
  { label: "매매복기", path: "/journal" },
  { label: "계산기", path: "/calculator" },
  { label: "약관", path: "/terms" },
  { label: "개인정보", path: "/privacy" },
  { label: "환불 안내", path: "/refund" },
  { label: "로봇 정책", path: "/robots.txt" },
  { label: "사이트맵", path: "/sitemap.xml" },
  { label: "웹앱 매니페스트", path: "/manifest.webmanifest" },
  {
    label: "월간 결제 로그인 보호",
    path: "/api/billing/checkout",
    method: "POST",
    body: { planId: "crypto_monthly", platform: "web" },
    expectedStatus: [401],
  },
  {
    label: "연간 결제 로그인 보호",
    path: "/api/billing/checkout",
    method: "POST",
    body: { planId: "bundle_yearly", platform: "web" },
    expectedStatus: [401],
  },
  {
    label: "결제 승인 로그인 보호",
    path: "/api/billing/confirm",
    method: "POST",
    body: {
      planId: "crypto_monthly",
      orderId: "cr_crypto_monthly_smoke",
      amount: 14900,
      paymentKey: "smoke_payment_key",
    },
    expectedStatus: [401],
  },
  {
    label: "결제 승인 금액 검증",
    path: "/api/billing/confirm",
    method: "POST",
    body: {
      planId: "crypto_monthly",
      orderId: "cr_crypto_monthly_smoke",
      amount: 1,
      paymentKey: "smoke_payment_key",
    },
    expectedStatus: [400],
  },
];

async function fetchWithTimeout(check) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}${check.path}`, {
      method: check.method ?? "GET",
      headers: check.body ? { "content-type": "application/json" } : undefined,
      body: check.body ? JSON.stringify(check.body) : undefined,
      signal: controller.signal,
    });

    const text = await response.text();
    const expectedStatus = check.expectedStatus ?? [200, 201, 202, 204];
    return {
      check,
      ok: expectedStatus.includes(response.status),
      status: response.status,
      detail: text.slice(0, 180).replace(/\s+/g, " ").trim(),
    };
  } catch (error) {
    return {
      check,
      ok: false,
      status: "ERR",
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

const results = await Promise.all(checks.map(fetchWithTimeout));
const failures = results.filter((result) => !result.ok);

for (const result of results) {
  const mark = result.ok ? "PASS" : "FAIL";
  console.log(`${mark.padEnd(4)} ${String(result.status).padEnd(4)} ${result.check.label} ${result.check.path}`);
  if (!result.ok && result.detail) {
    console.log(`     ${result.detail}`);
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length}개 경로가 스모크 테스트를 통과하지 못했습니다.`);
  console.error(`개발 서버가 켜져 있는지 먼저 확인해 주세요. 기준 URL은 ${baseUrl}입니다.`);
  process.exit(1);
}

console.log(`\n모든 핵심 경로가 정상 응답했습니다. 기준 URL은 ${baseUrl}입니다.`);
