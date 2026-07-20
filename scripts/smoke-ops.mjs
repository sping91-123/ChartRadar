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

function expectNotIncludes(source, needle, label, file) {
  if (!source.includes(needle)) pass(label, `${file} 확인.`);
  else fail(label, `${file}에 ${needle} 값이 남아 있습니다.`);
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

function isValidIso(iso) {
  return typeof iso === "string" && Number.isFinite(Date.parse(iso));
}

function eventTime(item) {
  const raw = item?.releaseAt ?? item?.scheduledAt ?? item?.releasedAt;
  const time = Date.parse(raw);
  return Number.isFinite(time) ? time : null;
}

const emptyActualValues = new Set(["", "발표 전", "결과 확인 중", "결과 확인중", "공식 발표 확인 중", "공식값 확인 중", "미정", "-", "확인 예정"]);

function hasActualValue(item) {
  const raw = item?.actualValue ?? item?.actual;
  return typeof raw === "string" && !emptyActualValues.has(raw.trim());
}

function hasUpcomingOrRecentRelease(items) {
  const now = Date.now();
  const recentWindowMs = 7 * 24 * 60 * 60 * 1000;
  return items.some((item) => {
    const time = eventTime(item);
    if (!time) return false;
    if (time >= now) return true;
    const status = String(item?.status ?? item?.state ?? "");
    const isReleasedLike = /released|actual_available|completed|official_check_needed|document/i.test(status);
    return isReleasedLike && now - time <= recentWindowMs;
  });
}

async function fetchMacroCalendarHealth() {
  const baseUrl = (process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(`${baseUrl}/api/macro-calendar`, {
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) {
      return { reachable: true, ok: false, detail: `HTTP ${response.status}` };
    }
    const payload = await response.json();
    return { reachable: true, ok: true, payload, cacheControl: response.headers.get("cache-control") ?? "" };
  } catch (error) {
    return {
      reachable: false,
      ok: false,
      detail: error instanceof Error ? error.message : String(error)
    };
  } finally {
    clearTimeout(timeout);
  }
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
const perpetualMonitorScanner = read("src/lib/server/perpetualMonitorScanner.ts");
const pushSendHelper = read("src/lib/server/push/sendPush.ts");
const pushPreferences = read("src/lib/server/push/preferences.ts");
const pushEntitlements = read("src/lib/server/push/entitlements.ts");
const macroPushScanner = read("src/lib/server/push/scanners/macroScanner.ts");
const optionalPushJson = read("src/lib/server/push/optionalJson.ts");
const pushTestMessages = read("src/lib/pushTestMessages.ts");
const pushTargetPath = read("src/lib/pushTargetPath.ts");
const pushPlatformGuard = read("supabase/legacy-migrations/20260519_android_push_platform_guard.sql");
const vercelConfig = read("vercel.json");
const usageMeterPanel = read("src/components/UsageMeterPanel.tsx");
const stockRadarApp = read("src/components/StockRadarApp.tsx");
const spotRadarPanel = read("src/components/spot/SpotRadarPanel.tsx");
const setupScoutPanel = read("src/components/SetupScoutPanel.tsx");
const watchlistPanel = read("src/components/WatchlistPanel.tsx");
const majorsApp = read("src/components/MajorsApp.tsx");
const homePerpetualDecisionFlow = read("src/components/coin/HomePerpetualDecisionFlow.tsx");
const perpetualDecisionExperience = read("src/components/coin/PerpetualDecisionExperience.tsx");
const perpetualMonitorManager = read("src/components/coin/PerpetualMonitorManager.tsx");
const perpetualSnapshotRoute = read("src/app/api/crypto/perpetual/snapshot/route.ts");
const perpetualAccessRoute = read("src/app/api/crypto/perpetual/access/route.ts");
const perpetualMonitorsRoute = read("src/app/api/crypto/perpetual/monitors/route.ts");
const perpetualJournalRoute = read("src/app/api/crypto/perpetual/journal/route.ts");
const perpetualMonitorStore = read("src/lib/server/perpetualMonitorStore.ts");
const productEventsRoute = read("src/app/api/product-events/route.ts");
const productEventStore = read("src/lib/server/productEventStore.ts");
const perpetualRevenueEnvCheck = read("scripts/check-perpetual-revenue-core-env.mjs");
const privacyPage = read("src/app/privacy/page.tsx");
const altsPage = read("src/app/crypto/perpetual/alts/page.tsx");
const altFuturesSignalSection = read("src/components/coin/AltFuturesSignalSection.tsx");
const coinRadarHomePanel = read("src/components/coin/CoinRadarHomePanel.tsx");
const cryptoExchangeMarketsRoute = read("src/app/api/crypto-exchange-markets/route.ts");
const cryptoHomeSnapshotRoute = read("src/app/api/crypto-home-snapshot/route.ts");
const cryptoHomeTickerRoute = read("src/app/api/crypto-home-ticker/route.ts");
const cryptoExchangeData = read("src/lib/server/cryptoExchangeData.ts");
const homeInterestCoins = read("src/lib/homeInterestCoins.ts");
const coinSignalPressurePanel = read("src/components/coin/CoinSignalPressurePanel.tsx");
const coinOptionsMarketPanel = read("src/components/coin/CoinOptionsMarketPanel.tsx");
const optionsMarketRoute = read("src/app/api/options-market/route.ts");
const coinLargeTradeFlowPanel = read("src/components/coin/CoinLargeTradeFlowPanel.tsx");
const largeTradeFlowRoute = read("src/app/api/large-trade-flow/route.ts");
const coinOnchainPulsePanel = read("src/components/coin/CoinOnchainPulsePanel.tsx");
const onchainMetricsRoute = read("src/app/api/onchain-metrics/route.ts");
const onchainMetricsLib = read("src/lib/onchainMetrics.ts");
const coinStablecoinLiquidityPanel = read("src/components/coin/CoinStablecoinLiquidityPanel.tsx");
const stablecoinLiquidityRoute = read("src/app/api/stablecoin-liquidity/route.ts");
const stablecoinLiquidityLib = read("src/lib/stablecoinLiquidity.ts");
const coinUnlockPressurePanel = read("src/components/coin/CoinUnlockPressurePanel.tsx");
const tokenUnlocksRoute = read("src/app/api/token-unlocks/route.ts");
const tokenUnlocksLib = read("src/lib/tokenUnlocks.ts");
const apiRoutes = walk("src/app/api", [".ts"]);

expectIncludes(rateLimit, "UPSTASH_REDIS_REST_URL", "Upstash rate limit URL", "src/lib/server/rateLimit.ts");
expectIncludes(rateLimit, "memoryRateLimit", "rate limit 메모리 fallback", "src/lib/server/rateLimit.ts");
expectIncludes(requestEntitlement, "getRequestEntitlement", "서버 권한 판별", "src/lib/server/requestEntitlement.ts");
expectIncludes(requestEntitlement, "hasEffectiveScope", "시장별 canonical Pro 권한 판별", "src/lib/server/requestEntitlement.ts");
expectIncludes(envExample, "UPSTASH_REDIS_REST_URL=", "운영 환경변수 예시", ".env.example");
expectIncludes(envExample, "GROQ_API_KEY=", "Groq 환경변수 예시", ".env.example");
expectIncludes(envExample, "ENABLE_GEMINI_AI_FALLBACK=", "Gemini AI fallback 명시 옵션", ".env.example");
expectIncludes(envExample, "CRON_SECRET=", "Vercel Cron 인증 환경변수 예시", ".env.example");
expectIncludes(envExample, "FIREBASE_SERVICE_ACCOUNT_JSON=", "Firebase 푸시 환경변수 예시", ".env.example");
expectIncludes(envExample, "PERPETUAL_REVENUE_CORE_V1=shadow", "Perpetual revenue core safe rollout mode", ".env.example");
expectIncludes(envExample, "PERPETUAL_REVENUE_CORE_CANARY_USER_IDS=", "Perpetual disposable canary allowlist", ".env.example");
expectIncludes(envExample, "PERPETUAL_REVENUE_CORE_CANARY_EXPIRES_AT=", "Perpetual disposable canary expiry", ".env.example");
expectIncludes(envExample, "PRODUCT_ANALYTICS_HMAC_SECRET=", "Product analytics anonymous HMAC secret", ".env.example");
expectIncludes(perpetualAccessRoute, "isPerpetualRevenueCoreUserEnabled", "Perpetual canary access remains server-authoritative", "src/app/api/crypto/perpetual/access/route.ts");
expectIncludes(perpetualJournalRoute, "isPerpetualRevenueCoreUserEnabled", "Perpetual Journal honors rollout gate", "src/app/api/crypto/perpetual/journal/route.ts");
expectIncludes(read("src/lib/server/healthStatus.ts"), "perpetualRevenueCoreReady", "Perpetual activation prerequisites affect launch health", "src/lib/server/healthStatus.ts");
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
expectIncludes(macroCalendarRoute, "no-store, no-cache, max-age=0, must-revalidate", "매크로 API no-store 헤더", "src/app/api/macro-calendar/route.ts");
expectIncludes(macroCalendarRoute, "hasPendingActualRefreshWindow", "발표 직후 actual 강제 갱신", "src/app/api/macro-calendar/route.ts");
expectIncludes(macroSyncRoute, "CRON_SECRET", "매크로 동기화 크론 인증", "src/app/api/macro-sync/route.ts");
expectIncludes(macroStatus, "document_release", "매크로 문서형 이벤트 상태", "src/lib/macro/macroStatus.ts");
expectIncludes(macroStatus, "unresolvedNumericReleaseStatus", "숫자형 지표 발표 후 상태 전환", "src/lib/macro/macroStatus.ts");
expectIncludes(macroStatus, "released_pending_actual", "발표 후 actual 대기 상태", "src/lib/macro/macroStatus.ts");
expectIncludes(macroStatus, "actual_available", "actual 확인 완료 상태", "src/lib/macro/macroStatus.ts");
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
expectIncludes(radarNewsApi, "지난 1시간 뉴스 흐름", "뉴스 기본 브리핑 문구", "src/app/api/radar-news/route.ts");
expectIncludes(radarNewsApi, "미국 물가 이슈", "뉴스 물가 표현 보강", "src/app/api/radar-news/route.ts");
expectIncludes(radarNewsApi, "correctDollarToWonDrift", "뉴스 달러 금액 원화 오역 보정", "src/app/api/radar-news/route.ts");
expectIncludes(radarNewsApi, "원문의 달러 금액", "뉴스 달러 단위 보존 프롬프트", "src/app/api/radar-news/route.ts");
expectIncludes(radarNewsLib, "originalTitle", "뉴스 원문 제목 보존", "src/lib/radarNews.ts");
expectIncludes(radarNewsLib, "displayTitle", "뉴스 한국어 표시 제목 분리", "src/lib/radarNews.ts");
expectIncludes(radarNewsLib, "marketNewsDisplayTitle", "뉴스 시장형 제목 정리", "src/lib/radarNews.ts");
expectIncludes(radarNewsApi, "PERSONAL_FINANCE_NOISE_KEYWORDS", "뉴스 개인재무 노이즈 차단", "src/app/api/radar-news/route.ts");
expectIncludes(radarNewsApi, "GLOBAL_MARKET_CONFIRMATION_KEYWORDS", "뉴스 매크로 문맥 확인", "src/app/api/radar-news/route.ts");
expectIncludes(radarNewsPanel, "뉴스 레이더", "코인 뉴스 요약 화면", "src/components/RadarNewsPanel.tsx");
expectIncludes(radarNewsPanel, "오늘의 시장 레이더", "시장 레이더 요약 카드", "src/components/RadarNewsPanel.tsx");
expectIncludes(radarNewsPanel, "compactCheckpoint", "뉴스 상단 체크포인트 압축", "src/components/RadarNewsPanel.tsx");
expectIncludes(radarNewsPanel, "다음 판단", "뉴스 상단 체크포인트 라벨", "src/components/RadarNewsPanel.tsx");
expectIncludes(radarNewsPanel, "최근 갱신", "뉴스 상단 갱신 시각 표시", "src/components/RadarNewsPanel.tsx");
expectIncludes(radarNewsPanel, "1시간 단위 자동 갱신", "뉴스 상단 갱신 주기 표시", "src/components/RadarNewsPanel.tsx");
expectIncludes(radarNewsPanel, "혼재 / 확인 필요", "뉴스 neutral 라벨 보강", "src/components/RadarNewsPanel.tsx");
expectIncludes(radarNewsPanel, "NEWS_CARD_LIMIT = 3", "뉴스 카드 노출 수 제한", "src/components/RadarNewsPanel.tsx");
expectIncludes(radarNewsPanel, "내용 보기", "뉴스 상세 브리핑 버튼", "src/components/RadarNewsPanel.tsx");
expectIncludes(radarNewsPanel, "참고 뉴스", "참고 뉴스 목록 화면", "src/components/RadarNewsPanel.tsx");
expectNotIncludes(radarNewsPanel, "mt-2 line-clamp-2 text-xs leading-5 text-ui-muted", "참고 뉴스 요약 숨김", "src/components/RadarNewsPanel.tsx");
expectIncludes(radarNewsPanel, "chart-radar.news.${market}.v17", "뉴스 캐시 버전 갱신", "src/components/RadarNewsPanel.tsx");
expectNotIncludes(newsPage, "MacroTicker", "뉴스 페이지 일정 분리", "src/app/news/page.tsx");
expectNotIncludes(newsPage, "이번 주 주요 매크로 일정", "뉴스 페이지 매크로 일정 제거", "src/app/news/page.tsx");
expectNotIncludes(radarNewsPanel, "afterBriefing", "뉴스 패널 일정 슬롯 제거", "src/components/RadarNewsPanel.tsx");
expectNotIncludes(radarNewsPanel, "뉴스 선별 기준", "뉴스 하단 선별 기준 문구 제거", "src/components/RadarNewsPanel.tsx");
expectNotIncludes(radarNewsPanel, "뉴스 레이더는 1시간 단위", "뉴스 하단 갱신 안내 문구 제거", "src/components/RadarNewsPanel.tsx");
expectIncludes(radarNewsApi, "CRYPTO_MEDICAL_NOISE_KEYWORDS", "코인 뉴스 바이오/임상 노이즈 차단", "src/app/api/radar-news/route.ts");
expectIncludes(radarNewsApi, "cryptoMarketNewsScore(record.title, record.excerpt)", "코인 뉴스 title 중심 관련성 점수", "src/app/api/radar-news/route.ts");
expectIncludes(radarNewsLib, "hasCryptoOutflowSofteningContext", "뉴스 outflow 완화 문맥 보정", "src/lib/radarNews.ts");
expectIncludes(radarNewsLib, "hasCryptoInflowWeakeningContext", "뉴스 inflow 감소 문맥 보정", "src/lib/radarNews.ts");
expectIncludes(radarNewsLib, "hasTreasuryYieldContext", "뉴스 Treasury yield 문맥 분리", "src/lib/radarNews.ts");
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
expectIncludes(pushTokensRoute, "replaceScopedRuleIds", "푸시 규칙 선호도 최신값 저장", "src/app/api/push-tokens/route.ts");
expectIncludes(pushTokensRoute, "replace_crypto_push_presets", "Crypto preset and monitor shared quota RPC", "src/app/api/push-tokens/route.ts");
expectIncludes(pushCronRoute, "CRON_SECRET", "푸시 크론 인증", "src/app/api/push-cron/route.ts");
expectIncludes(pushCronRoute, 'preferredRegion = "sin1"', "Perpetual scanner Binance-compatible region", "src/app/api/push-cron/route.ts");
expectIncludes(pushCronRoute, "resolvePushScannerOrigin(request.url)", "Protected deployment cron uses the canonical public origin for optional sources", "src/app/api/push-cron/route.ts");
expectIncludes(pushAlertScanner, "runPushAlertScan", "푸시 자동 감시 스캐너", "src/lib/server/pushAlertScanner.ts");
expectIncludes(pushAlertScanner, "runPerpetualMonitorScan", "Perpetual monitor evaluation before generic Push delivery", "src/lib/server/pushAlertScanner.ts");
expectIncludes(perpetualMonitorScanner, "claimPerpetualMonitorTrigger", "Perpetual trigger atomic claim", "src/lib/server/perpetualMonitorScanner.ts");
expectIncludes(perpetualMonitorScanner, "leasePerpetualAlertDelivery", "Perpetual Push delivery lease", "src/lib/server/perpetualMonitorScanner.ts");
expectIncludes(perpetualMonitorScanner, "purge_perpetual_revenue_core_retention", "Perpetual snapshot and product event retention", "src/lib/server/perpetualMonitorScanner.ts");
expectIncludes(perpetualMonitorScanner, "shouldRunPerpetualRevenueMaintenance", "Perpetual shadow-mode retention", "src/lib/server/perpetualMonitorScanner.ts");
expectIncludes(perpetualMonitorScanner, "blockedUsers.add(userId)", "Entitlement lookup failure blocks the current monitor scan", "src/lib/server/perpetualMonitorScanner.ts");
expectIncludes(perpetualMonitorScanner, "allowsPerpetualPushMarket", "Perpetual Push honors crypto market preferences", "src/lib/server/perpetualMonitorScanner.ts");
expectIncludes(pushSendHelper, "sendFcmMessage", "푸시 자동 FCM 발송", "src/lib/server/push/sendPush.ts");
expectIncludes(pushAlertScanner, "platform=eq.android&provider=eq.fcm", "푸시 크론 Android FCM 대상 제한", "src/lib/server/pushAlertScanner.ts");
expectIncludes(pushPreferences, "ruleIds.includes(event.ruleId)", "푸시 규칙 선호도 필터", "src/lib/server/push/preferences.ts");
expectNotIncludes(pushPreferences, "shouldBypassRulePreference", "푸시 system 규칙 선호도 우회 제거", "src/lib/server/push/preferences.ts");
expectNotIncludes(pushEntitlements, "if (event.system) return true", "푸시 system 권한 우회 제거", "src/lib/server/push/entitlements.ts");
expectIncludes(macroPushScanner, 'targetPath: "/schedule"', "Macro calendar push target route", "src/lib/server/push/scanners/macroScanner.ts");
expectIncludes(optionalPushJson, 'contentType.includes("application/json")', "Optional Push sources reject Vercel protection HTML", "src/lib/server/push/optionalJson.ts");
expectIncludes(pushTestMessages, 'targetPath: "/schedule"', "Macro test push target route", "src/lib/pushTestMessages.ts");
expectIncludes(pushTargetPath, '"/schedule"', "Android push schedule target allowlist", "src/lib/pushTargetPath.ts");
expectIncludes(pushTargetPath, "perpetualAlertContextFromPushData", "Structured Perpetual Push destination", "src/lib/pushTargetPath.ts");
expectIncludes(pushPlatformGuard, "push_tokens_provider_platform_check", "push_tokens platform/provider 제약", "supabase/legacy-migrations/20260519_android_push_platform_guard.sql");
expectIncludes(vercelConfig, '"/api/push-cron"', "Vercel 푸시 크론 경로", "vercel.json");
expectIncludes(vercelConfig, '"src/app/api/crypto/perpetual/snapshot/route.ts": {\n      "regions": ["sin1"]', "Perpetual snapshot Singapore region", "vercel.json");
expectIncludes(vercelConfig, '"src/app/api/crypto/perpetual/monitors/route.ts": {\n      "regions": ["sin1"]', "Perpetual monitor Singapore region", "vercel.json");
expectIncludes(vercelConfig, '"src/app/api/push-cron/route.ts": {\n      "regions": ["sin1"]', "Perpetual scanner Singapore region", "vercel.json");
expectIncludes(usageMeterPanel, "hasScopedEntitlement(profile?.plan, marketScope)", "사용량 패널 시장별 권한", "src/components/UsageMeterPanel.tsx");
expectIncludes(setupScoutPanel, 'hasMarketEntitlement(profile?.plan, "crypto")', "코인 스캐너 권한", "src/components/SetupScoutPanel.tsx");
expectIncludes(watchlistPanel, 'hasMarketEntitlement(profile?.plan, "crypto")', "관심코인 권한", "src/components/WatchlistPanel.tsx");
expectIncludes(scoutRoute, "entitlement.isPaid ? 120 : 20", "코인 일일 레이더 권한", "src/app/api/scout/route.ts");
expectIncludes(stockRadarApp, 'hasMarketEntitlement(profile?.plan, "stocks")', "글로벌 레이더 권한", "src/components/StockRadarApp.tsx");
expectIncludes(spotRadarPanel, "1차 확인가", "현물 1차 확인가 표시", "src/components/spot/SpotRadarPanel.tsx");
expectIncludes(spotRadarPanel, "저항까지", "현물 저항 여유 표시", "src/components/spot/SpotRadarPanel.tsx");
expectIncludes(spotRadarPanel, "무효화 기준", "현물 무효화 기준 표시", "src/components/spot/SpotRadarPanel.tsx");
expectIncludes(coinRadarHomePanel, "/api/crypto-home-snapshot?", "Home exchange snapshot API source", "src/components/coin/CoinRadarHomePanel.tsx");
expectIncludes(coinRadarHomePanel, "/api/crypto-home-ticker?", "Home live ticker API source", "src/components/coin/CoinRadarHomePanel.tsx");
expectIncludes(coinRadarHomePanel, "/api/crypto-exchange-markets?", "Home exchange market list API source", "src/components/coin/CoinRadarHomePanel.tsx");
expectIncludes(coinRadarHomePanel, "readHomeInterestCoins(isPaid)", "Home Basic/Pro interest coin loading", "src/components/coin/CoinRadarHomePanel.tsx");
expectIncludes(cryptoExchangeMarketsRoute, "getExchangeMarkets", "Home exchange market list route source", "src/app/api/crypto-exchange-markets/route.ts");
expectIncludes(cryptoHomeSnapshotRoute, "getCryptoHomeSnapshot", "Home snapshot route server source", "src/app/api/crypto-home-snapshot/route.ts");
expectIncludes(cryptoHomeTickerRoute, "getCryptoHomeTicker", "Home ticker route server source", "src/app/api/crypto-home-ticker/route.ts");
expectIncludes(cryptoExchangeData, "compositeStructureScore", "Home multi-timeframe structure score", "src/lib/server/cryptoExchangeData.ts");
expectIncludes(cryptoExchangeData, "fetchPressure", "Home futures pressure source", "src/lib/server/cryptoExchangeData.ts");
expectIncludes(cryptoExchangeData, "buildStrategyRadar", "Home strategy radar builder", "src/lib/server/cryptoExchangeData.ts");
expectIncludes(homeInterestCoins, "homeInterestMaxBasic = 1", "Home Basic interest coin limit", "src/lib/homeInterestCoins.ts");
expectIncludes(homeInterestCoins, "homeInterestMaxPro = 5", "Home Pro interest coin limit", "src/lib/homeInterestCoins.ts");
expectIncludes(majorsApp, "CoinMarketEnvironmentPanel", "Market environment panel on majors", "src/components/MajorsApp.tsx");
expectIncludes(majorsApp, "PerpetualDecisionExperience", "Single-snapshot Perpetual decision experience", "src/components/MajorsApp.tsx");
expectIncludes(majorsApp, 'revenueCoreMode === "on"', "Perpetual revenue core rollout gate", "src/components/MajorsApp.tsx");
expectIncludes(majorsApp, "CoinStablecoinLiquidityPanel", "Stablecoin liquidity panel on majors", "src/components/MajorsApp.tsx");
expectIncludes(majorsApp, "CoinOnchainPulsePanel", "On-chain pulse panel on majors", "src/components/MajorsApp.tsx");
expectIncludes(majorsApp, "CoinOptionsMarketPanel", "Options market panel on majors", "src/components/MajorsApp.tsx");
expectNotIncludes(majorsApp, "CoinFuturesSignalPressurePanel", "Independent major pressure request removed", "src/components/MajorsApp.tsx");
expectNotIncludes(majorsApp, "CoinLargeTradeFlowPanel", "Independent major flow request removed", "src/components/MajorsApp.tsx");
expectIncludes(homePerpetualDecisionFlow, "HomeDecisionHero", "Home decision hero", "src/components/coin/HomePerpetualDecisionFlow.tsx");
expectIncludes(homePerpetualDecisionFlow, "comparePerpetualShadowDecision", "Privacy-safe shadow agreement comparison", "src/components/coin/HomePerpetualDecisionFlow.tsx");
expectIncludes(homePerpetualDecisionFlow, "snapshot=${encodeURIComponent(displaySnapshot.id)}", "Home CTA snapshot continuity", "src/components/coin/HomePerpetualDecisionFlow.tsx");
expectNotIncludes(homePerpetualDecisionFlow, "current.snapshot?.id === result.snapshot.id", "Home entitlement payload refresh", "src/components/coin/HomePerpetualDecisionFlow.tsx");
expectIncludes(perpetualDecisionExperience, "PerpetualDecisionChart", "Snapshot-bound Perpetual chart", "src/components/coin/PerpetualDecisionExperience.tsx");
expectIncludes(perpetualDecisionExperience, "multiTimeframeEvidence", "Snapshot-bound multi-timeframe evidence", "src/components/coin/PerpetualDecisionExperience.tsx");
expectIncludes(perpetualDecisionExperience, 'params.set("source", "alert")', "Alert snapshot is preserved through the snapshot API", "src/components/coin/PerpetualDecisionExperience.tsx");
expectIncludes(perpetualDecisionExperience, 'url.searchParams.delete("source")', "Refreshed alert context is normalized to a current snapshot", "src/components/coin/PerpetualDecisionExperience.tsx");
expectIncludes(perpetualDecisionExperience, "JournalRouteError", "Journal 4xx does not fall back to a local success", "src/components/coin/PerpetualDecisionExperience.tsx");
expectNotIncludes(perpetualDecisionExperience, "current.snapshot?.id === nextSnapshot.id", "Perpetual entitlement payload refresh", "src/components/coin/PerpetualDecisionExperience.tsx");
expectIncludes(perpetualDecisionExperience, "PerpetualMonitorManager", "Saved monitor manager is connected", "src/components/coin/PerpetualDecisionExperience.tsx");
expectIncludes(perpetualMonitorManager, "/api/crypto/perpetual/monitors", "Saved monitor list API", "src/components/coin/PerpetualMonitorManager.tsx");
expectIncludes(perpetualMonitorManager, 'method: "PATCH"', "Saved monitor pause, resume, and cancel API", "src/components/coin/PerpetualMonitorManager.tsx");
expectIncludes(perpetualMonitorManager, "scenarioMonitorCount", "Shared monitor quota breakdown", "src/components/coin/PerpetualMonitorManager.tsx");
expectIncludes(perpetualMonitorManager, "/crypto/alertset", "Shared preset management target", "src/components/coin/PerpetualMonitorManager.tsx");
expectIncludes(perpetualSnapshotRoute, "serializeBasicPerpetualSnapshot", "Basic response omits Pro payload", "src/app/api/crypto/perpetual/snapshot/route.ts");
expectIncludes(perpetualSnapshotRoute, "isPerpetualSnapshotGenerationEnabled", "Perpetual off-mode kill switch", "src/app/api/crypto/perpetual/snapshot/route.ts");
expectIncludes(perpetualSnapshotRoute, "allowExpiredRequestedSnapshot", "Alert-time snapshot continuity", "src/app/api/crypto/perpetual/snapshot/route.ts");
expectIncludes(perpetualSnapshotRoute, "sharedCryptoConditionUsage", "Snapshot capabilities use the shared preset and scenario quota", "src/app/api/crypto/perpetual/snapshot/route.ts");
expectIncludes(perpetualSnapshotRoute, 'preferredRegion = "sin1"', "Perpetual snapshot Binance-compatible region", "src/app/api/crypto/perpetual/snapshot/route.ts");
expectIncludes(perpetualMonitorsRoute, "condition_already_met", "Already-met monitor rejection", "src/app/api/crypto/perpetual/monitors/route.ts");
expectIncludes(perpetualMonitorsRoute, 'preferredRegion = "sin1"', "Perpetual monitor Binance-compatible region", "src/app/api/crypto/perpetual/monitors/route.ts");
expectIncludes(perpetualMonitorStore, "status=in.(active,paused)&", "Shared quota counts active and user-paused monitors", "src/lib/server/perpetualMonitorStore.ts");
expectIncludes(perpetualMonitorStore, "status=in.(active,paused,paused_entitlement)", "Monitor manager fetches live rows without terminal-history starvation", "src/lib/server/perpetualMonitorStore.ts");
expectIncludes(productEventStore, "findRecentPurchaseAttribution", "Verified billing attribution lookup", "src/lib/server/productEventStore.ts");
expectIncludes(productEventsRoute, "attribution_id", "Client purchase-attribution storage", "src/app/api/product-events/route.ts");
expectIncludes(perpetualRevenueEnvCheck, "PRODUCT_ANALYTICS_HMAC_SECRET", "Revenue-core analytics activation preflight", "scripts/check-perpetual-revenue-core-env.mjs");
expectIncludes(perpetualRevenueEnvCheck, "FIREBASE_SERVICE_ACCOUNT_JSON", "Revenue-core Push activation preflight", "scripts/check-perpetual-revenue-core-env.mjs");
expectIncludes(privacyPage, "제품 이벤트는 90일 후 삭제", "Product analytics privacy retention disclosure", "src/app/privacy/page.tsx");
expectIncludes(productEventsRoute, "TextEncoder", "Product event byte-size limit", "src/app/api/product-events/route.ts");
expectIncludes(productEventsRoute, "sanitizeProductEventProperties", "Product event property allowlist", "src/app/api/product-events/route.ts");
expectIncludes(productEventsRoute, "anonymousProductRateKey", "Anonymous product events receive a privacy-safe per-device rate key", "src/app/api/product-events/route.ts");
expectIncludes(altsPage, "AltFuturesSignalSection", "Alt futures selected signal section", "src/app/crypto/perpetual/alts/page.tsx");
expectIncludes(altsPage, "CoinMarketEnvironmentPanel", "Market environment panel on alts", "src/app/crypto/perpetual/alts/page.tsx");
expectIncludes(altsPage, "CoinStablecoinLiquidityPanel", "Stablecoin liquidity panel on alts", "src/app/crypto/perpetual/alts/page.tsx");
expectIncludes(altFuturesSignalSection, "CoinFuturesSignalPressurePanel", "Futures pressure panel on alts", "src/components/coin/AltFuturesSignalSection.tsx");
expectIncludes(altFuturesSignalSection, "CoinLargeTradeFlowPanel", "Large trade flow panel on alts", "src/components/coin/AltFuturesSignalSection.tsx");
expectIncludes(altFuturesSignalSection, "chartRadar.altFuturesSymbols.v1", "Alt futures localStorage key", "src/components/coin/AltFuturesSignalSection.tsx");
expectIncludes(altsPage, "CoinUnlockPressurePanel", "Token unlock pressure panel on alts", "src/app/crypto/perpetual/alts/page.tsx");
expectIncludes(coinSignalPressurePanel, "/api/liquidation-pressure?symbol=", "Futures pressure live API source", "src/components/coin/CoinSignalPressurePanel.tsx");
expectIncludes(coinSignalPressurePanel, "Binance 공개 선물 데이터", "Futures pressure public data label", "src/components/coin/CoinSignalPressurePanel.tsx");
expectIncludes(coinSignalPressurePanel, "BTC/ETH 롱/숏 쏠림", "Major futures pressure scan copy", "src/components/coin/CoinSignalPressurePanel.tsx");
expectIncludes(coinSignalPressurePanel, "알트 롱/숏 쏠림", "Alt futures pressure scan copy", "src/components/coin/CoinSignalPressurePanel.tsx");
expectIncludes(coinSignalPressurePanel, "숏 우세 압력", "Futures downside pressure score copy", "src/components/coin/CoinSignalPressurePanel.tsx");
expectIncludes(coinSignalPressurePanel, "롱 우세 압력", "Futures upside pressure score copy", "src/components/coin/CoinSignalPressurePanel.tsx");
expectIncludes(onchainMetricsRoute, "fetchBitcoinOnchainMetricReport", "On-chain metrics API source", "src/app/api/onchain-metrics/route.ts");
expectIncludes(onchainMetricsLib, "mempoolVsizeMb", "On-chain mempool pressure field", "src/lib/onchainMetrics.ts");
expectIncludes(coinOnchainPulsePanel, "/api/onchain-metrics?network=btc", "On-chain live API source", "src/components/coin/CoinOnchainPulsePanel.tsx");
expectIncludes(coinOnchainPulsePanel, "mempool.space 공개 온체인 데이터", "On-chain public data label", "src/components/coin/CoinOnchainPulsePanel.tsx");
expectIncludes(coinOnchainPulsePanel, "BTC 온체인 체온", "On-chain panel copy", "src/components/coin/CoinOnchainPulsePanel.tsx");
expectIncludes(stablecoinLiquidityRoute, "fetchStablecoinLiquidityReport", "Stablecoin liquidity API source", "src/app/api/stablecoin-liquidity/route.ts");
expectIncludes(stablecoinLiquidityLib, "change7dPercent", "Stablecoin liquidity 7d change field", "src/lib/stablecoinLiquidity.ts");
expectIncludes(coinStablecoinLiquidityPanel, "/api/stablecoin-liquidity", "Stablecoin liquidity live API source", "src/components/coin/CoinStablecoinLiquidityPanel.tsx");
expectIncludes(coinStablecoinLiquidityPanel, "DeFiLlama 공개 스테이블코인 데이터", "Stablecoin liquidity public data label", "src/components/coin/CoinStablecoinLiquidityPanel.tsx");
expectIncludes(coinStablecoinLiquidityPanel, "스테이블코인 유동성", "Stablecoin liquidity panel copy", "src/components/coin/CoinStablecoinLiquidityPanel.tsx");
expectIncludes(optionsMarketRoute, "fetchOptionsMarketReport", "Options market API source", "src/app/api/options-market/route.ts");
expectIncludes(read("src/lib/optionsMarket.ts"), "expectedMovePercent", "Options expected move field", "src/lib/optionsMarket.ts");
expectIncludes(coinOptionsMarketPanel, "/api/options-market?currency=", "Options market live API source", "src/components/coin/CoinOptionsMarketPanel.tsx");
expectIncludes(coinOptionsMarketPanel, "Deribit 공개 옵션 데이터", "Options market public data label", "src/components/coin/CoinOptionsMarketPanel.tsx");
expectIncludes(coinOptionsMarketPanel, "옵션 시장 온도", "Options market panel copy", "src/components/coin/CoinOptionsMarketPanel.tsx");
expectIncludes(coinOptionsMarketPanel, "예상 변동", "Options expected move copy", "src/components/coin/CoinOptionsMarketPanel.tsx");
expectIncludes(largeTradeFlowRoute, "fetchLargeTradeFlowReport", "Large trade flow API source", "src/app/api/large-trade-flow/route.ts");
expectIncludes(read("src/lib/largeTradeFlow.ts"), "anomalyScore", "Large trade repeated-flow score", "src/lib/largeTradeFlow.ts");
expectIncludes(coinLargeTradeFlowPanel, "/api/large-trade-flow?symbol=", "Large trade flow live API source", "src/components/coin/CoinLargeTradeFlowPanel.tsx");
expectIncludes(coinLargeTradeFlowPanel, "Binance 공개 선물 체결", "Large trade flow public data label", "src/components/coin/CoinLargeTradeFlowPanel.tsx");
expectIncludes(coinLargeTradeFlowPanel, "BTC/ETH 큰 매수/매도 체결", "Major large trade flow copy", "src/components/coin/CoinLargeTradeFlowPanel.tsx");
expectIncludes(coinLargeTradeFlowPanel, "알트 큰 매수/매도 체결", "Alt large trade flow copy", "src/components/coin/CoinLargeTradeFlowPanel.tsx");
expectIncludes(coinLargeTradeFlowPanel, "반복 체결", "Large trade repeated-flow copy", "src/components/coin/CoinLargeTradeFlowPanel.tsx");
expectIncludes(tokenUnlocksRoute, "fetchTokenUnlockReport", "Token unlock API source", "src/app/api/token-unlocks/route.ts");
expectIncludes(tokenUnlocksLib, "percentOfMarketCap", "Token unlock market-cap pressure field", "src/lib/tokenUnlocks.ts");
expectIncludes(coinUnlockPressurePanel, "/api/token-unlocks?limit=", "Token unlock live API source", "src/components/coin/CoinUnlockPressurePanel.tsx");
expectIncludes(coinUnlockPressurePanel, "Tokenomics 공개 언락 페이지", "Token unlock public data label", "src/components/coin/CoinUnlockPressurePanel.tsx");
expectIncludes(coinUnlockPressurePanel, "알트 언락 부담", "Token unlock panel copy", "src/components/coin/CoinUnlockPressurePanel.tsx");

const macroHealth = await fetchMacroCalendarHealth();
if (macroHealth.reachable && macroHealth.ok) {
  const payload = macroHealth.payload;
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const allowedSources = new Set(["automatic-mixed", "forex-factory", "official-bls"]);

  pass("Macro calendar API response", "/api/macro-calendar returned HTTP 200.");

  if (items.length > 0) {
    pass("Macro calendar API items", `/api/macro-calendar returned ${items.length} item(s).`);
  } else {
    fail("Macro calendar API items", "/api/macro-calendar returned an empty items array.");
  }

  if (isValidIso(payload?.updatedAt) && Date.parse(payload.updatedAt) <= Date.now() + 10 * 60 * 1000) {
    pass("Macro calendar API updatedAt", `updatedAt is valid: ${payload.updatedAt}.`);
  } else {
    fail("Macro calendar API updatedAt", "updatedAt is missing, invalid, or unexpectedly in the future.");
  }

  if (/no-store/i.test(macroHealth.cacheControl)) {
    pass("Macro calendar API Cache-Control", `Cache-Control is ${macroHealth.cacheControl}.`);
  } else {
    fail("Macro calendar API Cache-Control", `Cache-Control must include no-store, got ${macroHealth.cacheControl || "missing"}.`);
  }

  if (isValidIso(payload?.fetchedAt) && Math.abs(Date.now() - Date.parse(payload.fetchedAt)) <= 10 * 60 * 1000) {
    pass("Macro calendar API fetchedAt freshness", `fetchedAt is recent: ${payload.fetchedAt}.`);
  } else {
    fail("Macro calendar API fetchedAt freshness", "fetchedAt is missing, invalid, or older than 10 minutes.");
  }

  const now = Date.now();
  const pastNumericWithoutActual = items.filter((item) => {
    const time = eventTime(item);
    if (!time || time > now) return false;
    const isDocument = item?.isDocumentEvent || /document|meeting|speech/i.test(String(item?.eventType ?? ""));
    return !isDocument && !hasActualValue(item);
  });
  const actualItems = items.filter(hasActualValue);

  if (pastNumericWithoutActual.every((item) => item.status === "released_pending_actual")) {
    pass("Macro calendar pending actual status", "Past numeric events without actual use released_pending_actual.");
  } else {
    fail("Macro calendar pending actual status", "Past numeric events without actual must use released_pending_actual.");
  }

  if (actualItems.every((item) => item.status === "actual_available")) {
    pass("Macro calendar actual status", "Events with actual values use actual_available when present.");
  } else {
    fail("Macro calendar actual status", "Events with actual values must use actual_available.");
  }

  if (allowedSources.has(payload?.source)) {
    pass("Macro calendar API source", `source is ${payload.source}.`);
  } else {
    fail("Macro calendar API source", `unexpected source: ${payload?.source ?? "missing"}.`);
  }

  if (hasUpcomingOrRecentRelease(items)) {
    pass("Macro calendar live coverage", "API includes an upcoming event or a recent released/check-needed event.");
  } else {
    fail("Macro calendar live coverage", "API has no upcoming event and no recent released/check-needed event.");
  }
} else if (macroHealth.reachable) {
  fail("Macro calendar API response", `/api/macro-calendar failed: ${macroHealth.detail}`);
} else {
  pass("Macro calendar API response", `/api/macro-calendar not reachable in this smoke context; checking static fallback shape only (${macroHealth.detail}).`);
}

const releaseMatches = [...macroEvents.matchAll(/releaseAt:\s*"([^"]+)"/g)].map((match) => Date.parse(match[1]));
if (releaseMatches.some((time) => Number.isFinite(time))) {
  pass("매크로 fallback 일정 형태", "등록된 예비 일정에 파싱 가능한 releaseAt 값이 있습니다.");
} else {
  fail("매크로 fallback 일정 형태", "등록된 매크로 예비 일정에 파싱 가능한 releaseAt 값이 없습니다.");
}

const updatedAtMatch = /macroCalendarUpdatedAtIso\s*=\s*"([^"]+)"/.exec(macroEvents);
if (updatedAtMatch && isValidIso(updatedAtMatch[1])) {
  pass("매크로 fallback 타임스탬프 형태", "macroCalendarUpdatedAtIso가 유효한 ISO 값입니다.");
} else {
  fail("매크로 fallback 타임스탬프 형태", "macroCalendarUpdatedAtIso가 없거나 유효하지 않습니다.");
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
