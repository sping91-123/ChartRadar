// AI와 공개 API의 입력 검증이 출시 전 안전하게 막히는지 확인하는 스모크 테스트입니다.
const baseUrl = (process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 15000);
const smokeClientIp = `127.0.0.${Math.floor(Math.random() * 200) + 20}`;

const checks = [
  {
    label: "AI 카드 코멘트 빈 요청 차단",
    path: "/api/ai/commentary",
    method: "POST",
    body: {},
    expectedStatus: [400],
    expectedText: "입력값"
  },
  {
    label: "AI 종합 브리핑 빈 요청 차단",
    path: "/api/ai/market-briefing",
    method: "POST",
    body: {},
    expectedStatus: [400],
    expectedText: "입력값"
  },
  {
    label: "AI 카드 코멘트 대용량 요청 차단",
    path: "/api/ai/commentary",
    method: "POST",
    rawBody: "x".repeat(40_001),
    headers: { "content-type": "text/plain" },
    expectedStatus: [413],
    expectedText: "너무 큽니다"
  },
  {
    label: "AI 종합 브리핑 대용량 요청 차단",
    path: "/api/ai/market-briefing",
    method: "POST",
    rawBody: "x".repeat(80_001),
    headers: { "content-type": "text/plain" },
    expectedStatus: [413],
    expectedText: "너무 큽니다"
  },
  {
    label: "스캐너 비정상 모드 차단",
    path: "/api/scout?mode=invalid&risk=radar&scope=major",
    method: "GET",
    expectedStatus: [400],
    expectedText: "지원하지 않는 레이더"
  },
  {
    label: "레이더 뉴스 비정상 시장 차단",
    path: "/api/radar-news?market=forex",
    method: "GET",
    expectedStatus: [400],
    expectedText: "지원하지 않는 뉴스 시장"
  },
  {
    label: "글로벌 캔들 비정상 타임프레임 차단",
    path: "/api/stocks/candles?symbol=QQQ&timeframe=bad",
    method: "GET",
    expectedStatus: [400],
    expectedText: "타임프레임"
  },
  {
    label: "글로벌 캔들 미지원 종목 차단",
    path: "/api/stocks/candles?symbol=NOTREAL&timeframe=1d",
    method: "GET",
    expectedStatus: [400],
    expectedText: "지원하지 않는"
  },
  {
    label: "청산 압력 비정상 심볼 차단",
    path: "/api/liquidation-pressure?symbol=***&period=15m",
    method: "GET",
    expectedStatus: [400],
    expectedText: "심볼"
  },
  {
    label: "청산 압력 비정상 기간 차단",
    path: "/api/liquidation-pressure?symbol=BTCUSDT.P&period=bad",
    method: "GET",
    expectedStatus: [400],
    expectedText: "기간"
  },
  {
    label: "옵션 시장 비정상 통화 차단",
    path: "/api/options-market?currency=XRP",
    method: "GET",
    expectedStatus: [400],
    expectedText: "옵션 통화"
  },
  {
    label: "큰 체결 비정상 심볼 차단",
    path: "/api/large-trade-flow?symbol=NOTREAL",
    method: "GET",
    expectedStatus: [400],
    expectedText: "큰 체결 심볼"
  },
  {
    label: "언락 데이터 비정상 limit 차단",
    path: "/api/token-unlocks?limit=bad",
    method: "GET",
    expectedStatus: [400],
    expectedText: "limit"
  },
  {
    label: "관심코인 스캔 비정상 심볼 차단",
    path: "/api/watchlist-scan",
    method: "POST",
    body: { symbols: ["BTCUSDT.P", "NOTREAL"] },
    expectedStatus: [400],
    expectedText: "관심코인"
  },
  {
    label: "결제 시작 대용량 요청 차단",
    path: "/api/billing/checkout",
    method: "POST",
    rawBody: "x".repeat(8_001),
    headers: { "content-type": "text/plain" },
    expectedStatus: [413],
    expectedText: "너무 큽니다"
  },
  {
    label: "결제 승인 대용량 요청 차단",
    path: "/api/billing/confirm",
    method: "POST",
    rawBody: "x".repeat(8_001),
    headers: { "content-type": "text/plain" },
    expectedStatus: [413],
    expectedText: "너무 큽니다"
  }
];

async function fetchWithTimeout(check) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const hasJsonBody = Object.prototype.hasOwnProperty.call(check, "body");
    const body = hasJsonBody ? JSON.stringify(check.body) : check.rawBody;
    const headers = {
      ...(check.headers ?? (hasJsonBody ? { "content-type": "application/json" } : {})),
      "x-forwarded-for": smokeClientIp
    };
    const response = await fetch(`${baseUrl}${check.path}`, {
      method: check.method ?? "GET",
      headers,
      body,
      signal: controller.signal
    });
    const text = await response.text();

    const hasExpectedStatus = check.expectedStatus.includes(response.status);
    const hasExpectedText = check.expectedText ? text.includes(check.expectedText) : true;

    return {
      check,
      ok: hasExpectedStatus && hasExpectedText,
      status: response.status,
      detail: text.slice(0, 220).replace(/\s+/g, " ").trim()
    };
  } catch (error) {
    return {
      check,
      ok: false,
      status: "ERR",
      detail: error instanceof Error ? error.message : String(error)
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
    const expectedText = result.check.expectedText ? ` / expected text: ${result.check.expectedText}` : "";
    console.log(`     ${result.detail}${expectedText}`);
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length}개 API 검증 항목이 기대한 상태 코드로 막히지 않았습니다.`);
  console.error(`개발 서버가 켜져 있는지 먼저 확인해 주세요. 기준 URL은 ${baseUrl}입니다.`);
  process.exit(1);
}

console.log(`\n공개 API 입력 검증이 기대한 상태 코드로 동작합니다. 기준 URL은 ${baseUrl}입니다.`);
