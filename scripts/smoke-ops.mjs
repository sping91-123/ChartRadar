// 운영 인프라 안전장치가 코드와 환경변수 예시에 연결되어 있는지 확인합니다.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const checks = [];

function read(file) {
  return readFileSync(path.join(root, file), "utf8");
}

function pass(label, detail) {
  checks.push({ ok: true, label, detail });
}

function fail(label, detail) {
  checks.push({ ok: false, label, detail });
}

function expectIncludes(source, needle, label, detail) {
  if (source.includes(needle)) pass(label, detail);
  else fail(label, `${detail} 값이 없습니다.`);
}

function walk(dir, extensions = [".ts"]) {
  const full = path.join(root, dir);
  if (!existsSync(full)) return [];

  return readdirSync(full).flatMap((entry) => {
    const entryPath = path.join(full, entry);
    const relative = path.relative(root, entryPath).replaceAll("\\", "/");
    if (statSync(entryPath).isDirectory()) return walk(relative, extensions);
    return extensions.some((extension) => relative.endsWith(extension)) ? [relative] : [];
  });
}

function hasMojibake(source) {
  return Array.from(source).some((char) => {
    const code = char.codePointAt(0);
    return code === 0xfffd || (code >= 0x4e00 && code <= 0x9fff);
  });
}

const rateLimit = read("src/lib/server/rateLimit.ts");
const envExample = read(".env.example");
const packageJson = read("package.json");
const restartDev = read("scripts/restart-dev.ps1");
const smokeAll = read("scripts/smoke-all.mjs");
const macroEvents = read("src/data/macroEvents.ts");
const macroCalendar = read("src/lib/macroCalendar.ts");
const macroCalendarRoute = read("src/app/api/macro-calendar/route.ts");
const radarNewsApi = read("src/app/api/radar-news/route.ts");
const radarNewsLib = read("src/lib/radarNews.ts");
const radarNewsPanel = read("src/components/RadarNewsPanel.tsx");
const radarAlertCenter = read("src/components/RadarAlertCenter.tsx");
const usageMeterPanel = read("src/components/UsageMeterPanel.tsx");
const macroTicker = read("src/components/MacroTicker.tsx");
const stockRadarApp = read("src/components/StockRadarApp.tsx");
const setupScoutPanel = read("src/components/SetupScoutPanel.tsx");
const watchlistPanel = read("src/components/WatchlistPanel.tsx");
const dailyRadarBrief = read("src/components/DailyRadarBrief.tsx");
const newsPage = read("src/app/news/page.tsx");
const billingLib = read("src/lib/billing.ts");
const rootLayout = read("src/app/layout.tsx");
const robotsRoute = read("src/app/robots.ts");
const sitemapRoute = read("src/app/sitemap.ts");
const themeToggle = read("src/components/ThemeToggle.tsx");
const radarAlerts = read("src/lib/radarAlerts.ts");
const technicalRadar = read("src/lib/technicalRadar.ts");
const stockMarket = read("src/lib/stockMarket.ts");
const supabaseClient = read("src/lib/supabase.ts");
const siteUrlUtil = read("src/lib/siteUrl.ts");
const aiProviderIndex = read("src/lib/ai/index.ts");
const aiCommentaryRoute = read("src/app/api/ai/commentary/route.ts");
const aiMarketBriefingRoute = read("src/app/api/ai/market-briefing/route.ts");
const healthRoute = read("src/app/api/health/route.ts");
const scoutRoute = read("src/app/api/scout/route.ts");
const launchCopyFiles = [
  "src/components/AuthStatus.tsx",
  "src/components/UsageMeterPanel.tsx",
  "src/components/RadarAlertCenter.tsx",
  "src/app/journal/page.tsx",
  "src/app/stocks/page.tsx",
  "src/app/survival/page.tsx",
  "src/app/alts/page.tsx",
  "src/app/global/page.tsx",
  "src/app/pro/page.tsx",
  "src/lib/billing.ts"
];
const apiRoutes = walk("src/app/api", [".ts"]);
const userFacingSources = [
  ...walk("src/app", [".ts", ".tsx"]),
  ...walk("src/components", [".ts", ".tsx"]),
  ...walk("src/lib", [".ts", ".tsx"]),
  ...walk("src/data", [".ts", ".tsx"]),
  ...walk("scripts", [".js", ".mjs"])
];

expectIncludes(rateLimit, "UPSTASH_REDIS_REST_URL", "Upstash URL 연결", "src/lib/server/rateLimit.ts");
expectIncludes(rateLimit, "UPSTASH_REDIS_REST_TOKEN", "Upstash 토큰 연결", "src/lib/server/rateLimit.ts");
expectIncludes(rateLimit, "memoryRateLimit", "메모리 fallback 유지", "src/lib/server/rateLimit.ts");
expectIncludes(rateLimit, "export async function rateLimit", "비동기 rateLimit export", "src/lib/server/rateLimit.ts");
expectIncludes(envExample, "UPSTASH_REDIS_REST_URL=", "환경변수 예시 URL", ".env.example");
expectIncludes(envExample, "UPSTASH_REDIS_REST_TOKEN=", "환경변수 예시 토큰", ".env.example");
expectIncludes(envExample, "NEXT_PUBLIC_ALLOW_LOCAL_REFRESH_TOKEN=", "로컬 refresh token 보호 옵션", ".env.example");
expectIncludes(envExample, "SUPABASE_SERVICE_ROLE_KEY=", "서버 권한 반영 키 예시", ".env.example");
expectIncludes(envExample, "NEWS_TRANSLATION_PROVIDER=", "뉴스 번역 속도 옵션", ".env.example");
expectIncludes(envExample, "ENABLE_GEMINI_NEWS_FALLBACK=", "뉴스 AI fallback 옵션", ".env.example");
expectIncludes(packageJson, '"dev:clean"', "개발 서버 복구 명령", "package.json");
expectIncludes(restartDev, "Refusing to delete outside repo", "개발 캐시 삭제 보호", "scripts/restart-dev.ps1");
expectIncludes(restartDev, "Remove-DirectoryWithRetry", "개발 캐시 삭제 재시도", "scripts/restart-dev.ps1");
expectIncludes(restartDev, "Get-NetTCPConnection -LocalPort $port", "3000번 포트 정리", "scripts/restart-dev.ps1");
expectIncludes(smokeAll, '"dev:clean"', "통합 스모크 서버 자동 복구", "scripts/smoke-all.mjs");
expectIncludes(smokeAll, "waitForDevServer", "통합 스모크 서버 준비 대기", "scripts/smoke-all.mjs");
expectIncludes(smokeAll, "/api/health", "통합 스모크 서버 헬스체크 대기", "scripts/smoke-all.mjs");
expectIncludes(macroEvents, "macroCalendarUpdatedAt", "매크로 갱신 기준 표시", "src/data/macroEvents.ts");
expectIncludes(macroEvents, "macroCalendarUpdatedAtIso", "매크로 갱신 ISO 기준", "src/data/macroEvents.ts");
expectIncludes(macroCalendar, "BLS_PUBLIC_API_URL", "매크로 공식 데이터 연결", "src/lib/macroCalendar.ts");
expectIncludes(macroCalendar, "fetchOfficialBlsCalendar", "매크로 BLS 자동 실제값 fetch", "src/lib/macroCalendar.ts");
expectIncludes(macroCalendar, "getFallbackPayload", "매크로 보조 일정 fallback", "src/lib/macroCalendar.ts");
expectIncludes(macroCalendar, "mergeOfficialInflationActuals", "매크로 공식 실제값 병합", "src/lib/macroCalendar.ts");
expectIncludes(macroCalendarRoute, "getMacroCalendarPayload", "매크로 캘린더 API payload", "src/app/api/macro-calendar/route.ts");
expectIncludes(macroCalendarRoute, 'key: "macro-calendar"', "매크로 캘린더 API rate limit", "src/app/api/macro-calendar/route.ts");
expectIncludes(radarNewsApi, "fallbackNewsBriefing", "레이더뉴스 fallback 브리핑", "src/app/api/radar-news/route.ts");
expectIncludes(radarNewsApi, "GROQ_API_KEY", "레이더뉴스 Groq 우선 호출", "src/app/api/radar-news/route.ts");
expectIncludes(radarNewsApi, "fallbackKoreanNewsTitle", "레이더뉴스 번역 품질 보강", "src/app/api/radar-news/route.ts");
expectIncludes(radarNewsApi, "미국 물가 이슈", "레이더뉴스 물가 표현 보강", "src/app/api/radar-news/route.ts");
expectIncludes(radarNewsApi, "GROQ_MODEL", "레이더뉴스 AI 모델 옵션화", "src/app/api/radar-news/route.ts");
expectIncludes(radarNewsApi, "USE_GEMINI_NEWS_FALLBACK", "레이더뉴스 Gemini fallback 옵션화", "src/app/api/radar-news/route.ts");
expectIncludes(radarNewsPanel, "오늘의 코인 뉴스 브리핑", "코인 뉴스 요약 화면", "src/components/RadarNewsPanel.tsx");
expectIncludes(radarNewsPanel, "참고 뉴스", "참고 뉴스 목록 화면", "src/components/RadarNewsPanel.tsx");
expectIncludes(radarNewsPanel, "chart-radar.news.${market}.v6", "뉴스 캐시 버전 갱신", "src/components/RadarNewsPanel.tsx");
expectIncludes(radarNewsLib, "미국 증시 뉴스", "뉴스 출처명 한국어 표시", "src/lib/radarNews.ts");
expectIncludes(radarNewsPanel, 'hasMarketEntitlement(profile?.plan, market)', "뉴스 시장별 Pro 권한", "src/components/RadarNewsPanel.tsx");
expectIncludes(radarNewsPanel, "briefing=0", "기본 한도 초과 시 뉴스 제목 preview", "src/components/RadarNewsPanel.tsx");
expectIncludes(radarNewsApi, "ensureKoreanText", "뉴스 브리핑 한국어 보정", "src/app/api/radar-news/route.ts");
expectIncludes(radarNewsApi, "오늘 확인할 주요 시장 이슈", "뉴스 영어 제목 fallback", "src/app/api/radar-news/route.ts");
expectIncludes(radarNewsApi, 'fallbackNewsBriefing(items, "preview"', "AI 비용 없는 뉴스 preview 브리핑", "src/app/api/radar-news/route.ts");
expectIncludes(macroTicker, "생산자물가지수(PPI)", "매크로 발표명 한글 표시", "src/components/MacroTicker.tsx");
expectIncludes(macroTicker, "미 노동통계국", "매크로 출처명 한글 표시", "src/components/MacroTicker.tsx");
expectIncludes(macroTicker, 'replace(/\\bCore\\b/g, "근원")', "매크로 수치 핵심 용어 한글화", "src/components/MacroTicker.tsx");
expectIncludes(radarAlertCenter, "글로벌 레이더 알림", "글로벌 알림 한글 라벨", "src/components/RadarAlertCenter.tsx");
expectIncludes(radarAlertCenter, "hasMarketEntitlement(profile?.plan, market)", "알림 시장별 Pro 권한", "src/components/RadarAlertCenter.tsx");
expectIncludes(radarAlertCenter, "getMarketRuleStorageKey", "알림 규칙 시장별 저장 키", "src/components/RadarAlertCenter.tsx");
expectIncludes(radarAlertCenter, "`${baseStorageKey}.${market}`", "알림 규칙 시장별 localStorage", "src/components/RadarAlertCenter.tsx");
expectIncludes(radarAlertCenter, "useState<RadarAlertRuleId[]>(() => getMarketDefaultRuleIds(market))", "알림 hydration 안정화", "첫 렌더에서 localStorage 알림 값을 직접 읽지 않습니다.");
expectIncludes(radarAlertCenter, "if (!hasLoadedStoredRules) return;", "알림 저장 시점 보호", "저장된 알림을 읽기 전 기본값으로 localStorage를 덮어쓰지 않습니다.");
expectIncludes(usageMeterPanel, "const initialUsageSnapshot", "사용량 hydration 안정화", "첫 렌더에서 localStorage 사용량 값을 직접 읽지 않습니다.");
expectIncludes(usageMeterPanel, "const refresh = () => setSnapshot(readUsageSnapshot());", "사용량 마운트 후 갱신", "브라우저 마운트 뒤 실제 사용량을 반영합니다.");
expectIncludes(billingLib, "hasScopedEntitlement", "시장 범위별 Pro 권한 helper", "src/lib/billing.ts");
expectIncludes(usageMeterPanel, "hasScopedEntitlement(profile?.plan, marketScope)", "사용량 패널 시장별 권한", "src/components/UsageMeterPanel.tsx");
expectIncludes(setupScoutPanel, 'hasMarketEntitlement(profile?.plan, "crypto")', "코인 스캐너 Coin Pro 권한", "src/components/SetupScoutPanel.tsx");
expectIncludes(watchlistPanel, 'hasMarketEntitlement(profile?.plan, "crypto")', "관심코인 Coin Pro 권한", "src/components/WatchlistPanel.tsx");
expectIncludes(dailyRadarBrief, 'hasMarketEntitlement(profile?.plan, "crypto")', "오늘의 코인 레이더 Coin Pro 권한", "src/components/DailyRadarBrief.tsx");
expectIncludes(stockRadarApp, 'hasMarketEntitlement(profile?.plan, "stocks")', "글로벌 레이더 Global Pro 권한", "src/components/StockRadarApp.tsx");
expectIncludes(rootLayout, "localStorage.getItem('chart-radar.theme')", "테마 부트스트랩 저장 키", "src/app/layout.tsx");
expectIncludes(rootLayout, "getSiteUrlWithLocalFallback", "메타데이터 URL fallback", "src/app/layout.tsx");
expectIncludes(robotsRoute, "getConfiguredSiteUrl", "robots URL fallback", "src/app/robots.ts");
expectIncludes(sitemapRoute, "getSiteUrlWithLocalFallback", "sitemap URL fallback", "src/app/sitemap.ts");
expectIncludes(sitemapRoute, '"/global"', "사이트맵 글로벌 핵심 경로", "src/app/sitemap.ts");
expectIncludes(sitemapRoute, "dailyCoreRoutes", "사이트맵 핵심 경로 일간 갱신", "src/app/sitemap.ts");
expectIncludes(siteUrlUtil, "process.env.VERCEL_URL", "Vercel URL fallback", "src/lib/siteUrl.ts");
expectIncludes(themeToggle, 'const storageKey = "chart-radar.theme"', "테마 토글 저장 키", "src/components/ThemeToggle.tsx");
expectIncludes(themeToggle, 'aria-label={isLight ? "다크 모드로 전환" : "라이트 모드로 전환"}', "테마 토글 접근성 라벨", "src/components/ThemeToggle.tsx");
expectIncludes(radarAlerts, 'id: "stock-momentum"', "글로벌 모멘텀 알림 규칙", "src/lib/radarAlerts.ts");
expectIncludes(radarAlerts, "글로벌 모멘텀 전환", "글로벌 모멘텀 알림 문구", "src/lib/radarAlerts.ts");
expectIncludes(radarAlerts, "defaultEnabled: true", "기본 알림 활성화 유지", "src/lib/radarAlerts.ts");
expectIncludes(supabaseClient, 'process.env.NEXT_PUBLIC_ALLOW_LOCAL_REFRESH_TOKEN === "true"', "refresh token 저장 명시 허용", "src/lib/supabase.ts");
expectIncludes(supabaseClient, "allowLocalRefreshToken", "refresh token 보호 분기", "src/lib/supabase.ts");
expectIncludes(supabaseClient, "delete session.refreshToken", "저장된 refresh token 정리", "src/lib/supabase.ts");
expectIncludes(supabaseClient, "clearSupabaseSession();", "만료 세션 정리", "src/lib/supabase.ts");
expectIncludes(aiProviderIndex, "getAIProviderCandidates", "AI Provider 후보 목록", "src/lib/ai/index.ts");
expectIncludes(aiProviderIndex, "providers.push(new GroqProvider", "Groq 우선 AI 후보", "src/lib/ai/index.ts");
expectIncludes(aiProviderIndex, "providers.push(new GeminiProvider", "Gemini 예비 AI 후보", "src/lib/ai/index.ts");
expectIncludes(aiCommentaryRoute, "다음 후보 확인", "AI 코멘트 후보 장애 대응", "src/app/api/ai/commentary/route.ts");
expectIncludes(aiMarketBriefingRoute, "다음 후보 확인", "AI 브리핑 후보 장애 대응", "src/app/api/ai/market-briefing/route.ts");
expectIncludes(healthRoute, "TOSS_PAYMENTS_SECRET_KEY", "헬스체크 결제 secret 기준", "src/app/api/health/route.ts");
expectIncludes(healthRoute, "NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY", "헬스체크 결제 client 기준", "src/app/api/health/route.ts");
expectIncludes(healthRoute, "macroStaleAfterHours", "헬스체크 매크로 신선도 기준", "src/app/api/health/route.ts");
expectIncludes(healthRoute, "hasFreeOfficialMacroProvider", "헬스체크 공식 매크로 제공자", "src/app/api/health/route.ts");
expectIncludes(healthRoute, "macroProvider", "헬스체크 매크로 제공자 상태", "src/app/api/health/route.ts");
expectIncludes(healthRoute, "readyForPaidLaunch", "헬스체크 유료 출시 준비 상태", "src/app/api/health/route.ts");
expectIncludes(healthRoute, "warnings", "헬스체크 운영 경고 목록", "src/app/api/health/route.ts");
expectIncludes(healthRoute, 'status: readyForPaidLaunch ? "ready"', "헬스체크 ready/degraded 상태", "src/app/api/health/route.ts");
expectIncludes(healthRoute, "paymentLinksReady", "헬스체크 플랜 결제 링크 상태", "src/app/api/health/route.ts");
expectIncludes(healthRoute, "planPaymentLinks", "헬스체크 플랜별 결제 링크 목록", "src/app/api/health/route.ts");
expectIncludes(healthRoute, "missingPlanPaymentLinks", "헬스체크 누락 결제 링크 경고", "src/app/api/health/route.ts");
expectIncludes(scoutRoute, "stale: true", "스캐너 stale fallback", "src/app/api/scout/route.ts");
expectIncludes(scoutRoute, "if (cache)", "스캐너 만료 캐시 fallback", "src/app/api/scout/route.ts");

if (!stockRadarApp.includes("비공식 지연 데이터") && !stockRadarApp.includes("보조 데이터입니다")) {
  pass("글로벌 화면 데이터 문구", "글로벌 정상 화면에 약한 데이터 출처 문구가 노출되지 않습니다.");
} else {
  fail("글로벌 화면 데이터 문구", "src/components/StockRadarApp.tsx에 비공식 또는 보조 데이터 문구가 남아 있습니다.");
}

if (!stockMarket.includes("Yahoo Finance")) {
  pass("글로벌 데이터 에러 문구", "글로벌 데이터 실패 시 내부 제공자명이 노출되지 않습니다.");
} else {
  fail("글로벌 데이터 에러 문구", "src/lib/stockMarket.ts에 내부 제공자명이 남아 있습니다.");
}

if (!technicalRadar.includes("ICT 구조와 별도로")) {
  pass("기술지표 화면 분리 문구", "기술지표 요약이 ICT 기준을 직접 언급하지 않습니다.");
} else {
  fail("기술지표 화면 분리 문구", "src/lib/technicalRadar.ts의 기술지표 요약에 ICT 혼입 문구가 남아 있습니다.");
}

if (newsPage.includes("<MacroTicker market={market} />")) {
  pass("뉴스 매크로 시장 범위", "뉴스 페이지의 매크로 전광판이 현재 시장 범위를 전달합니다.");
} else {
  fail("뉴스 매크로 시장 범위", "src/app/news/page.tsx에서 MacroTicker에 market 값을 전달해야 합니다.");
}

const launchRiskTerms = [
  "출시 단계",
  "출시 후",
  "정식 서비스 오픈 전",
  "보존되지 않을 수",
  "알림 준비 완료",
  "서버 권한과 결제 상태가 연결된 뒤",
  "무료 체험",
  "Beta",
  "베타"
];
const launchCopyOffenders = launchCopyFiles.flatMap((file) => {
  const source = read(file);
  return launchRiskTerms
    .filter((term) => source.includes(term))
    .map((term) => `${file}: ${term}`);
});

if (launchCopyOffenders.length === 0) {
  pass("정식 출시 문구 회귀 방지", "핵심 사용자 화면에 베타/개발 단계 문구가 남아 있지 않습니다.");
} else {
  fail("정식 출시 문구 회귀 방지", launchCopyOffenders.join(", "));
}

const releaseMatches = [...macroEvents.matchAll(/releaseAt:\s*"([^"]+)"/g)].map((match) => Date.parse(match[1]));
if (releaseMatches.some((time) => Number.isFinite(time) && time > Date.now())) {
  pass("매크로 미래 일정 유지", "적어도 하나 이상의 다가오는 일정이 남아 있습니다.");
} else {
  fail("매크로 미래 일정 유지", "등록된 매크로 일정이 모두 과거입니다. src/data/macroEvents.ts를 갱신해 주세요.");
}

const updatedAtMatch = /macroCalendarUpdatedAtIso\s*=\s*"([^"]+)"/.exec(macroEvents);
const updatedAtMs = updatedAtMatch ? Date.parse(updatedAtMatch[1]) : NaN;
const maxMacroAgeMs = 72 * 60 * 60 * 1000;
if (Number.isFinite(updatedAtMs) && Date.now() - updatedAtMs <= maxMacroAgeMs) {
  pass("매크로 갱신 신선도", "macroCalendarUpdatedAtIso가 72시간 이내입니다.");
} else {
  fail("매크로 갱신 신선도", "macroCalendarUpdatedAtIso가 없거나 72시간보다 오래되었습니다.");
}

const releasedBlocks = [...macroEvents.matchAll(/\{\s*\n\s*label:\s*"([^"]+)"[\s\S]*?\n\s*\}/g)]
  .filter((match) => /state:\s*"released"/.test(match[0]));
const releasedWithoutActual = releasedBlocks
  .map((match) => {
    const block = match[0];
    const actual = /actual:\s*"([^"]+)"/.exec(block)?.[1]?.trim();
    return actual && !["발표 전", "결과 확인 중", "회의 전", "미정", "-"].includes(actual) ? null : match[1];
  })
  .filter(Boolean);

if (releasedWithoutActual.length === 0) {
  pass("매크로 발표 완료 실제값", "released 항목에는 실제 발표값이 있습니다.");
} else {
  fail("매크로 발표 완료 실제값", `${releasedWithoutActual.join(", ")} 항목에 실제 발표값이 없습니다.`);
}

const macroBlocks = [...macroEvents.matchAll(/\{\s*\n\s*label:\s*"([^"]+)"[\s\S]*?\n\s*\}/g)];
const unresolvedPastMacroEvents = macroBlocks
  .map((match) => {
    const block = match[0];
    const label = match[1];
    const releaseAt = /releaseAt:\s*"([^"]+)"/.exec(block)?.[1];
    const actual = /actual:\s*"([^"]+)"/.exec(block)?.[1]?.trim();
    const releaseMs = releaseAt ? Date.parse(releaseAt) : NaN;
    const graceMs = 2 * 60 * 60 * 1000;
    if (!Number.isFinite(releaseMs) || Date.now() - releaseMs < graceMs) return null;
    return actual && !["발표 전", "결과 확인 중", "회의 전", "미정", "-"].includes(actual) ? null : label;
  })
  .filter(Boolean);

if (unresolvedPastMacroEvents.length === 0) {
  pass("매크로 지난 발표 실제값", "발표 후 2시간이 지난 항목에는 실제값이 있습니다.");
} else {
  fail("매크로 지난 발표 실제값", `${unresolvedPastMacroEvents.join(", ")} 항목이 발표 후에도 실제값 없이 남아 있습니다.`);
}

const rateLimitOffenders = [];
for (const route of apiRoutes) {
  const source = read(route);
  if (source.includes("rateLimit(") && !source.includes("await rateLimit(")) {
    rateLimitOffenders.push(route);
  }
}

if (rateLimitOffenders.length === 0) {
  pass("API route await rateLimit", "모든 API route가 비동기 제한 결과를 기다립니다.");
} else {
  fail("API route await rateLimit", rateLimitOffenders.join(", "));
}

const mojibakeFiles = userFacingSources.filter((file) => hasMojibake(read(file)));
if (mojibakeFiles.length === 0) {
  pass("소스 한글 인코딩", "사용자 화면과 API 소스에 깨진 한글 문자열이 남아 있지 않습니다.");
} else {
  fail("소스 한글 인코딩", mojibakeFiles.join(", "));
}

let failed = 0;
for (const check of checks) {
  if (check.ok) {
    console.log(`PASS ${check.label} - ${check.detail}`);
  } else {
    failed += 1;
    console.error(`FAIL ${check.label} - ${check.detail}`);
  }
}

if (failed > 0) {
  process.exitCode = 1;
} else {
  console.log("\n운영 인프라 스모크 테스트가 통과했습니다.");
}
