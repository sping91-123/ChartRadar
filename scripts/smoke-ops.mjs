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
const macroEvents = read("src/data/macroEvents.ts");
const radarNewsApi = read("src/app/api/radar-news/route.ts");
const radarNewsPanel = read("src/components/RadarNewsPanel.tsx");
const radarAlertCenter = read("src/components/RadarAlertCenter.tsx");
const usageMeterPanel = read("src/components/UsageMeterPanel.tsx");
const radarAlerts = read("src/lib/radarAlerts.ts");
const supabaseClient = read("src/lib/supabase.ts");
const launchCopyFiles = [
  "src/components/UsageMeterPanel.tsx",
  "src/components/RadarAlertCenter.tsx",
  "src/app/journal/page.tsx",
  "src/app/stocks/page.tsx",
  "src/app/survival/page.tsx",
  "src/app/alts/page.tsx",
  "src/app/global/page.tsx",
  "src/app/pro/page.tsx"
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
expectIncludes(restartDev, "Get-NetTCPConnection -LocalPort $port", "3000번 포트 정리", "scripts/restart-dev.ps1");
expectIncludes(macroEvents, "macroCalendarUpdatedAt", "매크로 갱신 기준 표시", "src/data/macroEvents.ts");
expectIncludes(macroEvents, "macroCalendarUpdatedAtIso", "매크로 갱신 ISO 기준", "src/data/macroEvents.ts");
expectIncludes(radarNewsApi, "fallbackNewsBriefing", "레이더뉴스 fallback 브리핑", "src/app/api/radar-news/route.ts");
expectIncludes(radarNewsApi, "GROQ_API_KEY", "레이더뉴스 Groq 우선 호출", "src/app/api/radar-news/route.ts");
expectIncludes(radarNewsApi, "불·베어 사이클 지표", "레이더뉴스 번역 품질 보강", "src/app/api/radar-news/route.ts");
expectIncludes(radarNewsApi, "강한 물가 지표", "레이더뉴스 물가 표현 보강", "src/app/api/radar-news/route.ts");
expectIncludes(radarNewsApi, "USE_EXTERNAL_NEWS_TRANSLATION", "레이더뉴스 외부 번역 옵션화", "src/app/api/radar-news/route.ts");
expectIncludes(radarNewsApi, "USE_GEMINI_NEWS_FALLBACK", "레이더뉴스 Gemini fallback 옵션화", "src/app/api/radar-news/route.ts");
expectIncludes(radarNewsPanel, "오늘의 코인 이슈 요약", "코인 뉴스 요약 화면", "src/components/RadarNewsPanel.tsx");
expectIncludes(radarNewsPanel, "참고 뉴스", "참고 뉴스 목록 화면", "src/components/RadarNewsPanel.tsx");
expectIncludes(radarAlertCenter, "getMarketRuleStorageKey", "알림 규칙 시장별 저장 키", "src/components/RadarAlertCenter.tsx");
expectIncludes(radarAlertCenter, "`${baseStorageKey}.${market}`", "알림 규칙 시장별 localStorage", "src/components/RadarAlertCenter.tsx");
expectIncludes(radarAlertCenter, "useState<RadarAlertRuleId[]>(() => getMarketDefaultRuleIds(market))", "알림 hydration 안정화", "첫 렌더에서 localStorage 알림 값을 직접 읽지 않습니다.");
expectIncludes(radarAlertCenter, "if (!hasLoadedStoredRules) return;", "알림 저장 시점 보호", "저장된 알림을 읽기 전 기본값으로 localStorage를 덮어쓰지 않습니다.");
expectIncludes(usageMeterPanel, "const initialUsageSnapshot", "사용량 hydration 안정화", "첫 렌더에서 localStorage 사용량 값을 직접 읽지 않습니다.");
expectIncludes(usageMeterPanel, "const refresh = () => setSnapshot(readUsageSnapshot());", "사용량 마운트 후 갱신", "브라우저 마운트 뒤 실제 사용량을 반영합니다.");
expectIncludes(radarAlerts, 'id: "stock-momentum"', "글로벌 모멘텀 알림 규칙", "src/lib/radarAlerts.ts");
expectIncludes(radarAlerts, "글로벌 모멘텀 전환", "글로벌 모멘텀 알림 문구", "src/lib/radarAlerts.ts");
expectIncludes(radarAlerts, "defaultEnabled: true", "기본 알림 활성화 유지", "src/lib/radarAlerts.ts");
expectIncludes(supabaseClient, 'process.env.NEXT_PUBLIC_ALLOW_LOCAL_REFRESH_TOKEN === "true"', "refresh token 저장 명시 허용", "src/lib/supabase.ts");
expectIncludes(supabaseClient, "allowLocalRefreshToken", "refresh token 보호 분기", "src/lib/supabase.ts");
expectIncludes(supabaseClient, "delete session.refreshToken", "저장된 refresh token 정리", "src/lib/supabase.ts");
expectIncludes(supabaseClient, "clearSupabaseSession();", "만료 세션 정리", "src/lib/supabase.ts");

const launchRiskTerms = [
  "출시 단계",
  "출시 후",
  "정식 서비스 오픈 전",
  "보존되지 않을 수",
  "알림 준비 완료",
  "서버 권한과 결제 상태가 연결된 뒤",
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
