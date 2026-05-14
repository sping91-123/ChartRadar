// 사용자 화면에 남기지 않을 내부 표현과 약한 상품 문구를 검사합니다.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const targets = ["src/app", "src/components"];

const blockedPhrases = [
  "맛보는 용도",
  "샘플",
  "신호가 아니라",
  "진입 신호가 아니라",
  "매수·매도 신호가 아닙니다",
  "교육용 도구",
  "Supabase에 저장",
  "RevenueCat",
  "Gemini",
  "Groq",
  "Flash"
];

function walk(dir) {
  const full = path.join(root, dir);
  return readdirSync(full).flatMap((entry) => {
    const absolute = path.join(full, entry);
    const relative = path.relative(root, absolute).replaceAll("\\", "/");
    if (statSync(absolute).isDirectory()) return walk(relative);
    return relative.endsWith(".tsx") ? [relative] : [];
  });
}

const files = targets.flatMap((target) => walk(target));
const failures = [];

for (const file of files) {
  const source = readFileSync(path.join(root, file), "utf8");
  for (const phrase of blockedPhrases) {
    if (source.includes(phrase)) {
      failures.push({ file, phrase });
    }
  }
}

if (failures.length > 0) {
  console.error("사용자 화면에 남기지 않을 문구가 발견됐습니다.");
  for (const failure of failures) {
    console.error(`FAIL ${failure.file} - ${failure.phrase}`);
  }
  process.exit(1);
}

console.log("PASS 사용자 화면 금지 문구가 발견되지 않았습니다.");
