// 운영 인프라 안전장치가 코드와 환경변수 예시에 연결되어 있는지 확인합니다.
import { readFileSync, readdirSync, statSync } from "node:fs";
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

function walk(dir) {
  const full = path.join(root, dir);
  return readdirSync(full).flatMap((entry) => {
    const entryPath = path.join(full, entry);
    const relative = path.relative(root, entryPath).replaceAll("\\", "/");
    if (statSync(entryPath).isDirectory()) return walk(relative);
    return relative.endsWith(".ts") ? [relative] : [];
  });
}

const rateLimit = read("src/lib/server/rateLimit.ts");
const envExample = read(".env.example");
const apiRoutes = walk("src/app/api");

expectIncludes(rateLimit, "UPSTASH_REDIS_REST_URL", "Upstash URL 연결", "src/lib/server/rateLimit.ts");
expectIncludes(rateLimit, "UPSTASH_REDIS_REST_TOKEN", "Upstash 토큰 연결", "src/lib/server/rateLimit.ts");
expectIncludes(rateLimit, "memoryRateLimit", "메모리 fallback 유지", "src/lib/server/rateLimit.ts");
expectIncludes(rateLimit, "export async function rateLimit", "비동기 rateLimit export", "src/lib/server/rateLimit.ts");
expectIncludes(envExample, "UPSTASH_REDIS_REST_URL=", "환경변수 예시 URL", ".env.example");
expectIncludes(envExample, "UPSTASH_REDIS_REST_TOKEN=", "환경변수 예시 토큰", ".env.example");

const offenders = [];
for (const route of apiRoutes) {
  const source = read(route);
  if (source.includes("rateLimit(") && !source.includes("await rateLimit(")) {
    offenders.push(route);
  }
}

if (offenders.length === 0) {
  pass("API route await rateLimit", "모든 API route가 비동기 제한 결과를 기다립니다.");
} else {
  fail("API route await rateLimit", offenders.join(", "));
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
