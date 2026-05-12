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
const macroEvents = read("src/data/macroEvents.ts");
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
expectIncludes(macroEvents, "macroCalendarUpdatedAt", "매크로 갱신 기준 표시", "src/data/macroEvents.ts");

const releaseMatches = [...macroEvents.matchAll(/releaseAt:\s*"([^"]+)"/g)].map((match) => Date.parse(match[1]));
if (releaseMatches.some((time) => Number.isFinite(time) && time > Date.now())) {
  pass("매크로 미래 일정 유지", "적어도 하나 이상의 다가오는 일정이 남아 있습니다.");
} else {
  fail("매크로 미래 일정 유지", "등록된 매크로 일정이 모두 과거입니다. src/data/macroEvents.ts를 갱신해 주세요.");
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
