// 운영 인프라와 출시 핵심 기능의 정적 연결 상태를 점검합니다.
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

function expectIncludes(source, needle, label, file) {
  if (source.includes(needle)) pass(label, `${file} 확인.`);
  else fail(label, `${file}에 ${needle} 값이 없습니다.`);
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

function isFreshIso(iso, maxAgeMs) {
  const time = Date.parse(iso);
  return Number.isFinite(time) && Date.now() - time <= maxAgeMs;
}

const envExample = read(".env.example");
const rateLimit = read("src/lib/server/rateLimit.ts");
const requestEntitlement = read("src/lib/server/requestEntitlement.ts");
const supabaseClient = read("src/lib/supabase.ts");
const billingLib = read("src/lib/billing.ts");
const healthRoute = read("src/app/api/health/route.ts");
const scoutRoute = read("src/app/api/scout/route.ts");
const macroEvents = read("src/data/macroEvents.ts");
const macroCalendar = read("src/lib/macroCalendar.ts");
const macroCalendarRoute = read("src/app/api/macro-calendar/route.ts");
const macroSyncRoute = read("src/app/api/macro-sync/route.ts");
const macroStatus = read("src/lib/macro/macroStatus.ts");
const blsAdapter = read("src/lib/macro/sourceAdapters/bls.ts");
const dolAdapter = read("src/lib/macro/sourceAdapters/dol.ts");
const fedAdapter = read("src/lib/macro/sourceAdapters/fed.ts");
const macroTicker = read("src/components/MacroTicker.tsx");
const newsPage = read("src/app/news/page.tsx");
const radarNewsApi = read("src/app/api/radar-news/route.ts");
const radarNewsLib = read("src/lib/radarNews.ts");
const radarNewsPanel = read("src/components/RadarNewsPanel.tsx");
const radarAlertCenter = read("src/components/RadarAlertCenter.tsx");
const radarAlertMonitor = read("src/components/RadarAlertMonitor.tsx");
const appPush = read("src/lib/appPush.ts");
const pushTokensRoute = read("src/app/api/push-tokens/route.ts");
const pushCronRoute = read("src/app/api/push-cron/route.ts");
const pushAlertScanner = read("src/lib/server/pushAlertScanner.ts");
const pushPlatformGuard = read("supabase/migrations/20260519_android_push_platform_guard.sql");
const vercelConfig = read("vercel.json");
const usageMeterPanel = read("src/components/UsageMeterPanel.tsx");
const stockRadarApp = read("src/components/StockRadarApp.tsx");
const setupScoutPanel = read("src/components/SetupScoutPanel.tsx");
const watchlistPanel = read("src/components/WatchlistPanel.tsx");
const apiRoutes = walk("src/app/api", [".ts"]);

expectIncludes(rateLimit, "UPSTASH_REDIS_REST_URL", "Upstash rate limit URL", "src/lib/server/rateLimit.ts");
expectIncludes(rateLimit, "memoryRateLimit", "rate limit 메모리 fallback", "src/lib/server/rateLimit.ts");
expectIncludes(requestEntitlement, "getRequestEntitlement", "서버 권한 판별", "src/lib/server/requestEntitlement.ts");
expectIncludes(requestEntitlement, "hasMarketEntitlement", "시장별 Pro 권한 판별", "src/lib/server/requestEntitlement.ts");
expectIncludes(envExample, "UPSTASH_REDIS_REST_URL=", "운영 환경변수 예시", ".env.example");
expectIncludes(envExample, "GROQ_API_KEY=", "Groq 환경변수 예시", ".env.example");
expectIncludes(envExample, "ENABLE_GEMINI_AI_FALLBACK=", "Gemini AI fallback 명시 옵션", ".env.example");
expectIncludes(envExample, "CRON_SECRET=", "Vercel Cron 인증 환경변수 예시", ".env.example");
expectIncludes(envExample, "FIREBASE_SERVICE_ACCOUNT_JSON=", "Firebase 푸시 환경변수 예시", ".env.example");
expectIncludes(read("src/lib/ai/index.ts"), "ENABLE_GEMINI_AI_FALLBACK", "Gemini AI fallback 기본 비활성화", "src/lib/ai/index.ts");
expectIncludes(supabaseClient, "NEXT_PUBLIC_ALLOW_LOCAL_REFRESH_TOKEN", "refresh token 저장 보호 옵션", "src/lib/supabase.ts");
expectIncludes(billingLib, "crypto_monthly", "코인 단독 요금제", "src/lib/billing.ts");
expectIncludes(billingLib, "global_monthly", "글로벌 단독 요금제", "src/lib/billing.ts");
expectIncludes(billingLib, "bundle_monthly", "올마켓 요금제", "src/lib/billing.ts");
expectIncludes(healthRoute, "readyForPaidLaunch", "유료 출시 상태 헬스체크", "src/app/api/health/route.ts");
expectIncludes(healthRoute, "macroAutomaticRefresh", "매크로 자동화 헬스체크", "src/app/api/health/route.ts");
expectIncludes(scoutRoute, "stale: true", "스캐너 stale 캐시 fallback", "src/app/api/scout/route.ts");
expectIncludes(macroCalendarRoute, "getMacroCalendarPayload", "매크로 API payload 연결", "src/app/api/macro-calendar/route.ts");
expectIncludes(macroCalendarRoute, "readStoredMacroCalendarPayload", "매크로 저장 캐시 우선 조회", "src/app/api/macro-calendar/route.ts");
expectIncludes(macroSyncRoute, "CRON_SECRET", "매크로 동기화 크론 인증", "src/app/api/macro-sync/route.ts");
expectIncludes(macroStatus, "document_release", "매크로 문서형 이벤트 상태", "src/lib/macro/macroStatus.ts");
expectIncludes(macroStatus, "unresolvedNumericReleaseStatus", "숫자형 지표 발표 후 상태 전환", "src/lib/macro/macroStatus.ts");
expectIncludes(blsAdapter, "fetchBlsOfficialActuals", "BLS 공식 실제값 fetch", "src/lib/macro/sourceAdapters/bls.ts");
expectIncludes(dolAdapter, "fetchDolOfficialEnrichments", "DOL 신규 실업수당 공식값 fetch", "src/lib/macro/sourceAdapters/dol.ts");
expectIncludes(dolAdapter, "unemployment\\s+insurance\\s+weekly\\s+claims", "DOL 신규 실업수당 제목 매칭", "src/lib/macro/sourceAdapters/dol.ts");
expectIncludes(dolAdapter, "actualValue", "DOL 신규 실업수당 실제값 매핑", "src/lib/macro/sourceAdapters/dol.ts");
expectIncludes(macroCalendar, "getFallbackPayload", "매크로 예비 일정 fallback", "src/lib/macroCalendar.ts");
expectIncludes(macroCalendar, "normalizeMacroEvents", "공식 매크로 상태 정규화", "src/lib/macroCalendar.ts");
expectIncludes(fedAdapter, "fomccalendars.htm", "Fed FOMC 공식 문서 확인", "src/lib/macro/sourceAdapters/fed.ts");
expectIncludes(macroTicker, "생산자물가지수(PPI)", "매크로 발표명 한글 표시", "src/components/MacroTicker.tsx");
expectIncludes(macroTicker, "BLS 공식 통계", "매크로 출처명 한글 표시", "src/components/MacroTicker.tsx");
expectIncludes(radarNewsApi, "GROQ_API_KEY", "뉴스 Groq 우선 연결", "src/app/api/radar-news/route.ts");
expectIncludes(radarNewsApi, "USE_GEMINI_NEWS_FALLBACK", "뉴스 Gemini fallback 옵션", "src/app/api/radar-news/route.ts");
expectIncludes(radarNewsApi, "ensureKoreanText", "뉴스 브리핑 한국어 보정", "src/app/api/radar-news/route.ts");
expectIncludes(radarNewsApi, "오늘 확인할 주요 시장 이슈", "뉴스 기본 브리핑 문구", "src/app/api/radar-news/route.ts");
expectIncludes(radarNewsApi, "미국 물가 이슈", "뉴스 물가 표현 보강", "src/app/api/radar-news/route.ts");
expectIncludes(radarNewsApi, "PERSONAL_FINANCE_NOISE_KEYWORDS", "뉴스 개인재무 노이즈 차단", "src/app/api/radar-news/route.ts");
expectIncludes(radarNewsApi, "GLOBAL_MARKET_CONFIRMATION_KEYWORDS", "뉴스 매크로 문맥 확인", "src/app/api/radar-news/route.ts");
expectIncludes(radarNewsPanel, "뉴스 레이더", "코인 뉴스 요약 화면", "src/components/RadarNewsPanel.tsx");
expectIncludes(radarNewsPanel, "오늘의 시장 레이더", "시장 레이더 요약 카드", "src/components/RadarNewsPanel.tsx");
expectIncludes(radarNewsPanel, "자세히 보기", "뉴스 상세 브리핑 버튼", "src/components/RadarNewsPanel.tsx");
expectIncludes(radarNewsPanel, "참고 뉴스", "참고 뉴스 목록 화면", "src/components/RadarNewsPanel.tsx");
expectIncludes(radarNewsPanel, "chart-radar.news.${market}.v14", "뉴스 캐시 버전 갱신", "src/components/RadarNewsPanel.tsx");
expectIncludes(newsPage, "이번 주 주요 매크로 일정", "매크로 일정 보조 섹션", "src/app/news/page.tsx");
{
  const reportIndex = newsPage.indexOf("<RadarNewsPanel");
  const macroIndex = newsPage.indexOf("<MacroTicker compact market={market} />");
  const briefingIndex = radarNewsPanel.indexOf("오늘의 AI 브리핑");
  const macroSlotIndex = radarNewsPanel.indexOf("{afterBriefing}");
  const criteriaIndex = radarNewsPanel.indexOf("시장 해석 기준");
  if (reportIndex >= 0 && macroIndex > reportIndex && briefingIndex >= 0 && macroSlotIndex > briefingIndex && criteriaIndex > macroSlotIndex) {
    pass("뉴스 리포트 우선 배치", "뉴스 브리핑 다음에 매크로 일정을 보조 섹션으로 표시합니다.");
  } else {
    fail("뉴스 리포트 우선 배치", "오늘의 AI 브리핑 다음에 매크로 일정, 그 다음에 시장 해석 기준이 와야 합니다.");
  }
}
expectIncludes(radarNewsLib, "미국 증시 뉴스", "뉴스 출처명 한국어 표시", "src/lib/radarNews.ts");
expectIncludes(radarNewsLib, "net loss", "뉴스 실적 손실 분류", "src/lib/radarNews.ts");
expectIncludes(radarNewsLib, "digitized finance", "뉴스 토큰화 금융 분류", "src/lib/radarNews.ts");
expectIncludes(radarNewsLib, "recover bitcoin", "뉴스 지갑 복구 분류", "src/lib/radarNews.ts");
expectIncludes(radarNewsLib, "voters crypto", "뉴스 여론조사 분류", "src/lib/radarNews.ts");
expectIncludes(radarNewsLib, "bear market resistance", "뉴스 저항 구간 분류", "src/lib/radarNews.ts");
expectIncludes(radarAlertCenter, "getMarketRuleStorageKey", "알림 조건 시장별 저장", "src/components/RadarAlertCenter.tsx");
expectIncludes(radarAlertCenter, "브라우저 알림은 현재 열린 화면", "브라우저 알림 문구 분리", "src/components/RadarAlertCenter.tsx");
expectIncludes(radarAlertMonitor, "isAndroidNativeApp()", "Android 앱에서 브라우저 Notification 미사용", "src/components/RadarAlertMonitor.tsx");
expectIncludes(appPush, "registerAndroidAppPush", "Android 앱 푸시 등록", "src/lib/appPush.ts");
expectIncludes(appPush, "presets", "앱 푸시 서버 조건 동기화", "src/lib/appPush.ts");
expectIncludes(appPush, "Capacitor.isNativePlatform()", "Capacitor 앱 환경 감지", "src/lib/appPush.ts");
expectIncludes(appPush, 'if (!isAndroidNativeApp()) return null;', "웹 환경 PushNotifications 로드 차단", "src/lib/appPush.ts");
expectIncludes(appPush, "disableAndroidAppPush", "Android 앱 푸시 토큰 해제", "src/lib/appPush.ts");
expectIncludes(pushTokensRoute, "push_alert_presets", "푸시 조건 서버 저장", "src/app/api/push-tokens/route.ts");
expectIncludes(pushTokensRoute, 'rawPlatform !== "android"', "Android 외 플랫폼 토큰 등록 차단", "src/app/api/push-tokens/route.ts");
expectIncludes(pushTokensRoute, 'provider: "fcm"', "Android FCM provider 저장", "src/app/api/push-tokens/route.ts");
expectIncludes(pushCronRoute, "CRON_SECRET", "푸시 크론 인증", "src/app/api/push-cron/route.ts");
expectIncludes(pushAlertScanner, "runPushAlertScan", "푸시 자동 감시 스캐너", "src/lib/server/pushAlertScanner.ts");
expectIncludes(pushAlertScanner, "sendFcmMessage", "푸시 자동 FCM 발송", "src/lib/server/pushAlertScanner.ts");
expectIncludes(pushAlertScanner, "platform=eq.android&provider=eq.fcm", "푸시 크론 Android FCM 대상 제한", "src/lib/server/pushAlertScanner.ts");
expectIncludes(pushPlatformGuard, "push_tokens_provider_platform_check", "push_tokens platform/provider 제약", "supabase/migrations/20260519_android_push_platform_guard.sql");
expectIncludes(vercelConfig, '"/api/push-cron"', "Vercel 푸시 크론 경로", "vercel.json");
expectIncludes(usageMeterPanel, "hasScopedEntitlement(profile?.plan, marketScope)", "사용량 패널 시장별 권한", "src/components/UsageMeterPanel.tsx");
expectIncludes(setupScoutPanel, 'hasMarketEntitlement(profile?.plan, "crypto")', "코인 스캐너 권한", "src/components/SetupScoutPanel.tsx");
expectIncludes(watchlistPanel, 'hasMarketEntitlement(profile?.plan, "crypto")', "관심코인 권한", "src/components/WatchlistPanel.tsx");
expectIncludes(scoutRoute, "entitlement.isPaid ? 120 : 20", "코인 일일 레이더 권한", "src/app/api/scout/route.ts");
expectIncludes(stockRadarApp, 'hasMarketEntitlement(profile?.plan, "stocks")', "글로벌 레이더 권한", "src/components/StockRadarApp.tsx");

const releaseMatches = [...macroEvents.matchAll(/releaseAt:\s*"([^"]+)"/g)].map((match) => Date.parse(match[1]));
if (releaseMatches.some((time) => Number.isFinite(time) && time > Date.now())) {
  pass("매크로 미래 일정 유지", "등록된 예비 일정에 미래 일정이 남아 있습니다.");
} else {
  fail("매크로 미래 일정 유지", "등록된 매크로 예비 일정이 모두 과거입니다.");
}

const updatedAtMatch = /macroCalendarUpdatedAtIso\s*=\s*"([^"]+)"/.exec(macroEvents);
if (updatedAtMatch && isFreshIso(updatedAtMatch[1], 72 * 60 * 60 * 1000)) {
  pass("매크로 갱신 신선도", "macroCalendarUpdatedAtIso가 72시간 이내입니다.");
} else {
  fail("매크로 갱신 신선도", "macroCalendarUpdatedAtIso가 없거나 72시간보다 오래되었습니다.");
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
