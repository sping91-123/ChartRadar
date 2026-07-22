// 운영 인프라와 출시 핵심 기능의 정적 연결 상태를 점검합니다.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const checks = [];

function read(file) {
  return readFileSync(path.join(root, file), "utf8").replace(/\r\n?/g, "\n");
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
const macroStore = read("src/lib/macro/server/macroStore.ts");
const macroCalendarRoute = read("src/app/api/macro-calendar/route.ts");
const macroSyncRoute = read("src/app/api/macro-sync/route.ts");
const macroStatus = read("src/lib/macro/macroStatus.ts");
const macroNormalizer = read("src/lib/macro/normalizeMacroEvent.ts");
const macroDedupe = read("src/lib/macro/dedupeMacroCalendar.ts");
const blsAdapter = read("src/lib/macro/sourceAdapters/bls.ts");
const dolAdapter = read("src/lib/macro/sourceAdapters/dol.ts");
const censusAdapter = read("src/lib/macro/sourceAdapters/census.ts");
const fedAdapter = read("src/lib/macro/sourceAdapters/fed.ts");
const macroTicker = read("src/components/MacroTicker.tsx");
const newsPage = read("src/app/news/page.tsx");
const radarNewsApi = read("src/app/api/radar-news/route.ts");
const newsImpactApi = read("src/app/api/news-impact/route.ts");
const newsImpactApiHelpers = read("src/lib/server/news/newsImpactApi.ts");
const newsImpactDetailApi = read("src/app/api/news-impact/[id]/route.ts");
const newsImpactPreferencesApi = read("src/app/api/news-impact/preferences/route.ts");
const newsSyncRoute = read("src/app/api/news-sync/route.ts");
const newsImpactPanel = read("src/components/news/NewsImpactPanel.tsx");
const newsSourceCatalog = read("src/lib/server/news/sourceCatalog.ts");
const officialNewsAdapters = read("src/lib/server/news/officialSourceAdapters.ts");
const newsImpactStore = read("src/lib/server/news/newsImpactStore.ts");
const newsImpactOutbox = read("src/lib/server/news/newsImpactAlertOutbox.ts");
const newsImpactMigration = read("supabase/migrations/20260720141318_news_impact_v1.sql");
const newsImpactHardeningMigration = read("supabase/migrations/20260720165116_harden_news_impact_v1.sql");
const firebaseMessaging = read("src/lib/server/firebaseMessaging.ts");
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
const perpetualEvidenceWorkbench = read("src/components/coin/PerpetualEvidenceWorkbench.tsx");
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
expectIncludes(envExample, "NEWS_IMPACT_V1=shadow", "News Impact safe rollout mode", ".env.example");
expectIncludes(envExample, "NEWS_IMPACT_PUSH_ENABLED=false", "News Impact Push default off", ".env.example");
expectIncludes(envExample, "NEWS_OFFICIAL_USER_AGENT=", "공식 출처 식별 User-Agent", ".env.example");
expectIncludes(perpetualAccessRoute, "isPerpetualRevenueCoreUserEnabled", "Perpetual canary access remains server-authoritative", "src/app/api/crypto/perpetual/access/route.ts");
expectIncludes(perpetualJournalRoute, "isPerpetualRevenueCoreUserEnabled", "Perpetual Journal honors rollout gate", "src/app/api/crypto/perpetual/journal/route.ts");
expectIncludes(read("src/lib/server/healthStatus.ts"), "perpetualRevenueCoreReady", "Perpetual activation prerequisites affect launch health", "src/lib/server/healthStatus.ts");
expectIncludes(read("src/lib/server/healthStatus.ts"), "hasSharedAiCostGuard", "Perpetual paid-launch health requires a shared AI cost ceiling", "src/lib/server/healthStatus.ts");
expectIncludes(read("src/lib/server/healthStatus.ts"), "hasSharedAiCostGuard && hasAIProvider", "Perpetual paid-launch health requires an enabled AI provider", "src/lib/server/healthStatus.ts");
expectIncludes(read("scripts/check-perpetual-revenue-core-env.mjs"), "AI explanation provider", "Perpetual activation gate requires an enabled AI provider", "scripts/check-perpetual-revenue-core-env.mjs");
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
expectIncludes(macroCalendarRoute, "allowStale: true", "오래된 저장 일정도 갱신 실패 fallback으로 보존", "src/app/api/macro-calendar/route.ts");
expectIncludes(macroCalendarRoute, "lastKnown: storedPayload", "수동 갱신도 마지막 정상 일정을 보존", "src/app/api/macro-calendar/route.ts");
expectIncludes(macroCalendarRoute, "MACRO_ROUTE_FALLBACK_TIMEOUT_MS", "매크로 API 지연 시 예비 일정 반환", "src/app/api/macro-calendar/route.ts");
expectIncludes(macroCalendarRoute, "no-store, no-cache, max-age=0, must-revalidate", "매크로 API no-store 헤더", "src/app/api/macro-calendar/route.ts");
expectIncludes(macroCalendarRoute, "hasPendingActualRefreshWindow", "발표 직후 actual 강제 갱신", "src/app/api/macro-calendar/route.ts");
expectIncludes(macroCalendarRoute, "마지막 정상 일정을 유지합니다", "actual 갱신 timeout 시 최신 저장 일정 유지", "src/app/api/macro-calendar/route.ts");
expectIncludes(macroSyncRoute, 'result.status === "degraded" ? 503 : 200', "예비 일정 동기화는 degraded HTTP 상태", "src/app/api/macro-sync/route.ts");
expectIncludes(macroSyncRoute, "CRON_SECRET", "매크로 동기화 크론 인증", "src/app/api/macro-sync/route.ts");
expectIncludes(macroStatus, "document_release", "매크로 문서형 이벤트 상태", "src/lib/macro/macroStatus.ts");
expectIncludes(macroStatus, "unresolvedNumericReleaseStatus", "숫자형 지표 발표 후 상태 전환", "src/lib/macro/macroStatus.ts");
expectIncludes(macroStatus, "released_pending_actual", "발표 후 actual 대기 상태", "src/lib/macro/macroStatus.ts");
expectIncludes(macroStatus, "actual_available", "actual 확인 완료 상태", "src/lib/macro/macroStatus.ts");
expectIncludes(blsAdapter, "fetchBlsOfficialActuals", "BLS 공식 실제값 fetch", "src/lib/macro/sourceAdapters/bls.ts");
expectIncludes(dolAdapter, "fetchDolOfficialEnrichments", "DOL 신규 실업수당 공식값 fetch", "src/lib/macro/sourceAdapters/dol.ts");
expectIncludes(dolAdapter, "unemployment\\s+insurance\\s+weekly\\s+claims", "DOL 신규 실업수당 제목 매칭", "src/lib/macro/sourceAdapters/dol.ts");
expectIncludes(dolAdapter, "actualValue", "DOL 신규 실업수당 실제값 매핑", "src/lib/macro/sourceAdapters/dol.ts");
expectIncludes(dolAdapter, "initialClaimsFourWeekAverage", "DOL 4주 평균 별도 값 매핑", "src/lib/macro/sourceAdapters/dol.ts");
expectIncludes(dolAdapter, "expectedDolWeekEndedIso", "DOL 지표별 보고 주차 고정", "src/lib/macro/sourceAdapters/dol.ts");
expectIncludes(dolAdapter, "formatDolClaimsK", "DOL 4주 평균 소수 K 정밀도 보존", "src/lib/macro/sourceAdapters/dol.ts");
expectNotIncludes(dolAdapter, "matchedWeek ?? latestWeek", "DOL 정확한 주차가 없을 때 최신값 오염 차단", "src/lib/macro/sourceAdapters/dol.ts");
expectIncludes(censusAdapter, "censusDurableGoodsActual", "내구재 actual과 전망의 퍼센트 단위 정렬", "src/lib/macro/sourceAdapters/census.ts");
expectIncludes(censusAdapter, "censusRetailSalesActual", "소매판매 actual과 전망의 퍼센트 단위 정렬", "src/lib/macro/sourceAdapters/census.ts");
expectIncludes(censusAdapter, "indicators.MARTS", "Census 공식 MARTS 소매판매 actual 연결", "src/lib/macro/sourceAdapters/census.ts");
expectIncludes(censusAdapter, "parseCensusReleaseDateIso", "Census actual을 해당 공식 발표일에만 연결", "src/lib/macro/sourceAdapters/census.ts");
expectIncludes(censusAdapter, "isCensusDurableGoodsHeadline", "Census headline과 세부 내구재 지표 분리", "src/lib/macro/sourceAdapters/census.ts");
expectIncludes(censusAdapter, "transp(?:ortation)?", "Census Ex Transp 약어도 headline actual에서 제외", "src/lib/macro/sourceAdapters/census.ts");
expectIncludes(censusAdapter, "matchReleasedAt", "Census 날짜는 매칭에만 쓰고 사건 시각을 덮지 않음", "src/lib/macro/sourceAdapters/census.ts");
expectIncludes(macroNormalizer, "actualProvenance", "매크로 실제값 출처를 행 출처와 분리", "src/lib/macro/normalizeMacroEvent.ts");
expectIncludes(macroDedupe, "jobless-claims-four-week-average", "신규 청구와 4주 평균 비병합", "src/lib/macro/dedupeMacroCalendar.ts");
expectIncludes(macroCalendar, "getFallbackPayload", "매크로 예비 일정 fallback", "src/lib/macroCalendar.ts");
expectIncludes(macroCalendar, "normalizeMacroEvents", "공식 매크로 상태 정규화", "src/lib/macroCalendar.ts");
expectIncludes(macroCalendar, "if (sorted.length === 0) throw", "빈 live 결과의 fallback 정상 원장 승격 차단", "src/lib/macroCalendar.ts");
expectIncludes(macroStore, "isLegacyFutureClaimsContamination", "오염된 미래 DOL 저장 캐시 우회", "src/lib/macro/server/macroStore.ts");
expectIncludes(macroStore, 'payload.cacheMode === "fallback"', "예비 일정의 정상 원장 덮어쓰기 차단", "src/lib/macro/server/macroStore.ts");
expectIncludes(macroStore, "scheduled_at=gte.", "저장 일정 최근·향후 시간창 조회", "src/lib/macro/server/macroStore.ts");
expectIncludes(macroStore, "syncGeneration", "매크로 원장 세대 단위 저장", "src/lib/macro/server/macroStore.ts");
expectIncludes(fedAdapter, "fomccalendars.htm", "Fed FOMC 공식 문서 확인", "src/lib/macro/sourceAdapters/fed.ts");
expectIncludes(macroTicker, "생산자물가지수(PPI)", "매크로 발표명 한글 표시", "src/components/MacroTicker.tsx");
expectIncludes(macroTicker, "BLS 공식 통계", "매크로 출처명 한글 표시", "src/components/MacroTicker.tsx");
expectIncludes(macroTicker, "MACRO_CALENDAR_REQUEST_TIMEOUT_MS", "Home 매크로 일정 요청 timeout", "src/components/MacroTicker.tsx");
expectIncludes(macroTicker, "assessMacroImpact", "Home 호재·악재 판정은 출처 인식 공용 판정기를 사용", "src/components/MacroTicker.tsx");
expectIncludes(macroTicker, "마지막 정상", "매크로 지연 상태를 사용자에게 표시", "src/components/MacroTicker.tsx");
expectIncludes(macroTicker, "isFallbackCalendar", "예비 일정과 마지막 정상 일정을 구분", "src/components/MacroTicker.tsx");
expectNotIncludes(macroTicker, "&ts=${Date.now()}", "Home 매크로 저장 캐시 우회 제거", "src/components/MacroTicker.tsx");
expectIncludes(radarNewsApi, "readNewsImpactEvents", "구형 뉴스 API 저장 원장 호환", "src/app/api/radar-news/route.ts");
expectNotIncludes(radarNewsApi, "GROQ_API_KEY", "구형 뉴스 API LLM 전달 종료", "src/app/api/radar-news/route.ts");
expectNotIncludes(radarNewsApi, "CoinDesk", "구형 뉴스 API 미허가 매체 차단", "src/app/api/radar-news/route.ts");
expectIncludes(newsImpactApi, "getRequestEntitlement", "News Impact 시장별 서버 권한", "src/app/api/news-impact/route.ts");
expectIncludes(newsImpactApi, "serializeNewsEvents", "Basic/Pro 서버 직렬화", "src/app/api/news-impact/route.ts");
expectIncludes(newsImpactApi, "newsImpactCapabilitiesForMode", "shadow NEWS 알림·복기 capability 차단", "src/app/api/news-impact/route.ts");
expectIncludes(newsImpactApi, "ignored_official_only", "shadow snapshot context is explicitly non-matching", "src/app/api/news-impact/route.ts");
expectIncludes(newsImpactApiHelpers, "repairLegacyMacroPresentation", "legacy generic macro headlines and frozen reaction context share one repair rule", "src/lib/server/news/newsImpactApi.ts");
expectIncludes(newsImpactApi, "serializeOfficialNewsEvents", "shadow 공식 사실 피드와 검증 반응 분리", "src/app/api/news-impact/route.ts");
expectIncludes(newsImpactDetailApi, "newsImpactCapabilitiesForMode", "NEWS 상세 capability도 rollout mode 적용", "src/app/api/news-impact/[id]/route.ts");
expectIncludes(newsImpactDetailApi, 'key: "news-impact-detail-lookup"', "News Impact 상세 조회 prelookup rate limit", "src/app/api/news-impact/[id]/route.ts");
expectIncludes(newsImpactPreferencesApi, "!disabling && !capabilities.canEnableImpactAlerts", "권한 종료 후 News Impact 알림 비활성화 허용", "src/app/api/news-impact/preferences/route.ts");
expectIncludes(newsSyncRoute, "CRON_SECRET", "News Impact 5분 크론 인증", "src/app/api/news-sync/route.ts");
expectIncludes(newsSourceCatalog, 'policyStatus: "blocked"', "미허가 뉴스 출처 fail-closed", "src/lib/server/news/sourceCatalog.ts");
expectIncludes(newsSourceCatalog, "isAllowedUrlForHosts", "운영 출처 host allowlist 검증 공통화", "src/lib/server/news/sourceCatalog.ts");
expectIncludes(newsSourceCatalog, 'input.status === "actual_available"', "NEWS 숫자 사건은 실제값 확정 상태만 허용", "src/lib/server/news/sourceCatalog.ts");
expectIncludes(newsSourceCatalog, "normalizedMacroActual(input.actual_value)", "NEWS DB actual과 공식 원본 actual 일치 검증", "src/lib/server/news/sourceCatalog.ts");
expectIncludes(newsSourceCatalog, "RSS/RSSGP/rssgp.xml", "CFTC 공식 General Press Releases 피드", "src/lib/server/news/sourceCatalog.ts");
expectIncludes(officialNewsAdapters, "trackedEdgarCompanies", "SEC EDGAR 추적 종목 제한", "src/lib/server/news/officialSourceAdapters.ts");
expectIncludes(officialNewsAdapters, "setTimeout(resolve, 550)", "SEC 초당 2회 이하 제한", "src/lib/server/news/officialSourceAdapters.ts");
expectIncludes(officialNewsAdapters, "readEnabledNewsSourcePolicies", "운영 출처 host policy fail-closed", "src/lib/server/news/officialSourceAdapters.ts");
expectIncludes(officialNewsAdapters, "actualReportingPeriod", "NEWS에 공식 실제값 보고 기간 provenance 동결", "src/lib/server/news/officialSourceAdapters.ts");
expectIncludes(officialNewsAdapters, "시장 예상", "NEWS의 public consensus를 공식 실제값과 분리", "src/lib/server/news/officialSourceAdapters.ts");
expectIncludes(officialNewsAdapters, "consensusSourceUrl", "NEWS에 시장 예상 출처 URL 동결", "src/lib/server/news/officialSourceAdapters.ts");
expectIncludes(officialNewsAdapters, "selectLatestMacroGenerationRows", "NEWS에서 변경 전 매크로 일정 세대 제외", "src/lib/server/news/officialSourceAdapters.ts");
expectNotIncludes(officialNewsAdapters, "importance=eq.3", "NEWS 중요도 필터 전 최신 매크로 세대 선택", "src/lib/server/news/officialSourceAdapters.ts");
expectIncludes(officialNewsAdapters, "row.importance === 3", "NEWS 최신 세대 내부에서만 중요도 필터", "src/lib/server/news/officialSourceAdapters.ts");
expectIncludes(newsImpactPanel, "실제 시장 반응", "공식 사건과 관측 반응 분리", "src/components/news/NewsImpactPanel.tsx");
expectIncludes(newsImpactPanel, "왜 확인해야 하나", "shadow 공식 뉴스도 초보자가 중요성을 이해", "src/components/news/NewsImpactPanel.tsx");
expectIncludes(newsImpactPanel, 'payload.mode === "off"', "shadow NEWS가 준비 화면으로 사라지지 않음", "src/components/news/NewsImpactPanel.tsx");
expectIncludes(newsImpactPanel, "지금 시장 판단을 바꿀 새 공식 이슈는 없습니다", "News Impact 정상 empty 상태", "src/components/news/NewsImpactPanel.tsx");
expectIncludes(newsImpactPanel, "payload.capabilities.canEnableImpactAlerts || alertEnabled", "권한 종료 사용자 기존 뉴스 알림 해제 UI", "src/components/news/NewsImpactPanel.tsx");
expectNotIncludes(newsImpactPanel, "뉴스 알림 준비 중", "shadow NEWS 미완성 알림 CTA 비노출", "src/components/news/NewsImpactPanel.tsx");
expectIncludes(newsImpactPanel, 'params.set("snapshot", requestedSnapshot)', "News Impact pagination snapshot 고정", "src/components/news/NewsImpactPanel.tsx");
expectNotIncludes(newsImpactPanel, "localStorage", "News Pro payload 영속 캐시 차단", "src/components/news/NewsImpactPanel.tsx");
expectIncludes(newsImpactStore, "select=source_id,allowed_hosts", "News Impact 조회 시 현재 host allowlist 재검증", "src/lib/server/news/newsImpactStore.ts");
expectIncludes(newsImpactOutbox, "claim_news_impact_alert", "뉴스 Push 원자적 선점", "src/lib/server/news/newsImpactAlertOutbox.ts");
expectIncludes(newsImpactOutbox, '"in_app_only"', "FCM 없는 앱 내 뉴스 기록", "src/lib/server/news/newsImpactAlertOutbox.ts");
expectIncludes(newsImpactOutbox, "validateDeliveryLease", "지연 Push 발송 직전 권한·출처 재검증", "src/lib/server/news/newsImpactAlertOutbox.ts");
expectIncludes(newsImpactOutbox, "select=source_id,policy_status,canonical_url", "뉴스 Push 발송 전 현재 source URL 재검증", "src/lib/server/news/newsImpactAlertOutbox.ts");
expectIncludes(newsImpactMigration, "blocked_pending_license", "출처 라이선스 보류 상태 기록", "supabase/migrations/20260720141318_news_impact_v1.sql");
expectIncludes(newsImpactMigration, "interval '24 hours'", "뉴스 semantic 중복 24시간 차단", "supabase/migrations/20260720141318_news_impact_v1.sql");
expectIncludes(newsImpactMigration, "interval '6 hours'", "일반 뉴스 알림 6시간 cooldown", "supabase/migrations/20260720141318_news_impact_v1.sql");
expectIncludes(newsImpactHardeningMigration, "block_news_source_items_after_catalog_change", "운영 host 철회 시 과거 source item 즉시 차단", "supabase/migrations/20260720165116_harden_news_impact_v1.sql");
expectIncludes(newsImpactHardeningMigration, "expired_after_partial_delivery", "부분 Push 성공 원장 만료 보존", "supabase/migrations/20260720165116_harden_news_impact_v1.sql");
expectIncludes(firebaseMessaging, "accessTokenRequest", "FCM OAuth token 동시 요청 단일화", "src/lib/server/firebaseMessaging.ts");
expectIncludes(firebaseMessaging, "AbortSignal.timeout", "FCM OAuth/전송 timeout", "src/lib/server/firebaseMessaging.ts");
expectIncludes(newsPage, "다음 변동성 구간을 미리 준비하세요", "뉴스 페이지 공식 반응 이후 다음 일정", "src/app/news/page.tsx");
expectNotIncludes(newsPage, "이번 주 주요 매크로 일정", "뉴스 페이지 구형 일정 제목 제거", "src/app/news/page.tsx");
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
expectIncludes(spotRadarPanel, "이 가격이면 해석을 다시 확인", "현물 해석 재확인 가격 표시", "src/components/spot/SpotRadarPanel.tsx");
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
expectIncludes(homePerpetualDecisionFlow, "PERPETUAL_SNAPSHOT_REQUEST_TIMEOUT_MS", "Home snapshot request watchdog", "src/components/coin/HomePerpetualDecisionFlow.tsx");
expectIncludes(homePerpetualDecisionFlow, "comparePerpetualShadowDecision", "Privacy-safe shadow agreement comparison", "src/components/coin/HomePerpetualDecisionFlow.tsx");
expectIncludes(homePerpetualDecisionFlow, "snapshot=${encodeURIComponent(displaySnapshot.id)}", "Home CTA snapshot continuity", "src/components/coin/HomePerpetualDecisionFlow.tsx");
expectIncludes(homePerpetualDecisionFlow, "/api/crypto/perpetual/monitors?status=active", "Home shows live saved-condition usage", "src/components/coin/HomePerpetualDecisionFlow.tsx");
expectIncludes(homePerpetualDecisionFlow, "runningMonitorCount", "Home distinguishes active monitoring from paused quota usage", "src/components/coin/HomePerpetualDecisionFlow.tsx");
expectIncludes(homePerpetualDecisionFlow, "개 감시 중", "Home monitor action communicates active monitoring", "src/components/coin/HomePerpetualDecisionFlow.tsx");
expectNotIncludes(homePerpetualDecisionFlow, "current.snapshot?.id === result.snapshot.id", "Home entitlement payload refresh", "src/components/coin/HomePerpetualDecisionFlow.tsx");
expectIncludes(perpetualDecisionExperience, "PerpetualDecisionChart", "Snapshot-bound Perpetual chart", "src/components/coin/PerpetualDecisionExperience.tsx");
expectIncludes(perpetualDecisionExperience, "PERPETUAL_SNAPSHOT_REQUEST_TIMEOUT_MS", "Perpetual snapshot request watchdog", "src/components/coin/PerpetualDecisionExperience.tsx");
expectIncludes(perpetualDecisionExperience, "shouldContinuePerpetualSnapshotRefresh", "Expired alert snapshot polling stop", "src/components/coin/PerpetualDecisionExperience.tsx");
expectIncludes(perpetualDecisionExperience, "currentJournalState", "Journal completion state stays bound to its snapshot", "src/components/coin/PerpetualDecisionExperience.tsx");
expectIncludes(perpetualDecisionExperience, "currentMonitorState", "Monitor completion state stays bound to its snapshot", "src/components/coin/PerpetualDecisionExperience.tsx");
expectIncludes(perpetualDecisionExperience, "PerpetualEvidenceWorkbench", "Snapshot-bound evidence workbench", "src/components/coin/PerpetualDecisionExperience.tsx");
expectIncludes(perpetualEvidenceWorkbench, "multiTimeframeEvidence", "Snapshot-bound multi-timeframe evidence", "src/components/coin/PerpetualEvidenceWorkbench.tsx");
expectIncludes(perpetualDecisionExperience, 'params.set("source", requestSource)', "Alert and News snapshots are preserved through the snapshot API", "src/components/coin/PerpetualDecisionExperience.tsx");
expectIncludes(perpetualDecisionExperience, 'url.searchParams.delete("source")', "Refreshed alert context is normalized to a current snapshot", "src/components/coin/PerpetualDecisionExperience.tsx");
expectIncludes(perpetualDecisionExperience, "JournalRouteError", "Journal 4xx does not fall back to a local success", "src/components/coin/PerpetualDecisionExperience.tsx");
expectIncludes(perpetualDecisionExperience, "canSaveExactNewsContext", "shadow NEWS 연결 Journal 실패 방지", "src/components/coin/PerpetualDecisionExperience.tsx");
expectNotIncludes(perpetualDecisionExperience, "current.snapshot?.id === nextSnapshot.id", "Perpetual entitlement payload refresh", "src/components/coin/PerpetualDecisionExperience.tsx");
expectIncludes(perpetualDecisionExperience, "PerpetualMonitorManager", "Saved monitor manager is connected", "src/components/coin/PerpetualDecisionExperience.tsx");
expectIncludes(perpetualMonitorManager, "/api/crypto/perpetual/monitors", "Saved monitor list API", "src/components/coin/PerpetualMonitorManager.tsx");
expectIncludes(perpetualMonitorManager, 'method: "PATCH"', "Saved monitor pause, resume, and cancel API", "src/components/coin/PerpetualMonitorManager.tsx");
expectIncludes(perpetualMonitorManager, "scenarioMonitorCount", "Shared monitor quota breakdown", "src/components/coin/PerpetualMonitorManager.tsx");
expectIncludes(perpetualMonitorManager, "/crypto/alertset", "Shared preset management target", "src/components/coin/PerpetualMonitorManager.tsx");
expectIncludes(perpetualMonitorManager, "최근 조건 확인 기록", "User-visible scenario condition history", "src/components/coin/PerpetualMonitorManager.tsx");
expectIncludes(perpetualMonitorManager, "&monitor=${encodeURIComponent(monitor.id)}", "Monitor history preserves server-validated review context", "src/components/coin/PerpetualMonitorManager.tsx");
expectIncludes(perpetualMonitorManager, "조건 확인 때 분석", "Triggered monitor history compares the saved and evaluated analyses", "src/components/coin/PerpetualMonitorManager.tsx");
expectIncludes(perpetualMonitorManager, "적중률·수익률을 뜻하지 않습니다", "Monitor history avoids performance claims", "src/components/coin/PerpetualMonitorManager.tsx");
expectIncludes(perpetualSnapshotRoute, "serializeBasicPerpetualSnapshot", "Basic response omits Pro payload", "src/app/api/crypto/perpetual/snapshot/route.ts");
expectIncludes(perpetualSnapshotRoute, "isPerpetualSnapshotGenerationEnabled", "Perpetual off-mode kill switch", "src/app/api/crypto/perpetual/snapshot/route.ts");
expectIncludes(perpetualSnapshotRoute, "allowExpiredRequestedSnapshot", "Alert-time snapshot continuity", "src/app/api/crypto/perpetual/snapshot/route.ts");
expectIncludes(perpetualSnapshotRoute, "sharedCryptoConditionUsage", "Snapshot capabilities use the shared preset and scenario quota", "src/app/api/crypto/perpetual/snapshot/route.ts");
expectIncludes(perpetualSnapshotRoute, "canSaveNewsJournal", "NEWS 연결 Journal capability 서버 판정", "src/app/api/crypto/perpetual/snapshot/route.ts");
expectIncludes(perpetualSnapshotRoute, 'preferredRegion = "sin1"', "Perpetual snapshot Binance-compatible region", "src/app/api/crypto/perpetual/snapshot/route.ts");
expectIncludes(perpetualMonitorsRoute, "condition_already_met", "Already-met monitor rejection", "src/app/api/crypto/perpetual/monitors/route.ts");
expectIncludes(perpetualMonitorsRoute, 'preferredRegion = "sin1"', "Perpetual monitor Binance-compatible region", "src/app/api/crypto/perpetual/monitors/route.ts");
expectIncludes(perpetualMonitorStore, "status=in.(active,paused)&", "Shared quota counts active and user-paused monitors", "src/lib/server/perpetualMonitorStore.ts");
expectIncludes(perpetualMonitorStore, "status=in.(active,paused,paused_entitlement)", "Monitor manager fetches live rows without terminal-history starvation", "src/lib/server/perpetualMonitorStore.ts");
expectIncludes(perpetualMonitorStore, "status=in.(triggered,expired,canceled)", "Monitor manager fetches recent terminal history separately", "src/lib/server/perpetualMonitorStore.ts");
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
