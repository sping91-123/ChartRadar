// 사용자 화면에 숨기지 말아야 할 약한 상품 문구와 깨진 문자를 검사합니다.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const targets = ["src/app", "src/components"];
const excludedFiles = new Set(["src/app/terms/page.tsx", "src/app/privacy/page.tsx", "src/app/refund/page.tsx"]);
const extraUserFacingFiles = [
  "src/lib/ai/fallback.ts",
  "src/lib/billing.ts",
  "src/lib/liquidationPressure.ts",
  "src/lib/marketAnalysis.ts",
  "src/lib/setupScout.ts",
  "src/lib/usageMeter.ts"
];

const blockedPhrases = [
  "맛보기 용도",
  "샘플",
  "신호가 아니",
  "진입 신호",
  "매수·매도 신호가 아닙니다",
  "매수나 매도 지시가 아닙니다",
  "교육용 도구",
  "교육·분석 보조 도구",
  "참고용으로만",
  "참고용입니다",
  "준비하는 중",
  "투자를 결정하는 서비스가 아닙니다",
  "Supabase에 저장",
  "RevenueCat",
  "Gemini",
  "Groq",
  "Flash"
];

const brokenPatterns = ["�", "媛", "肄", "湲", "덉", "쒖", "뺤", "釉", "諛", "留", "寃", "怨", "臾", "濡"];

function walk(dir) {
  const full = path.join(root, dir);
  return readdirSync(full).flatMap((entry) => {
    const absolute = path.join(full, entry);
    const relative = path.relative(root, absolute).replaceAll("\\", "/");
    if (excludedFiles.has(relative)) return [];
    if (relative.startsWith("src/app/api/")) return [];
    if (statSync(absolute).isDirectory()) return walk(relative);
    return relative.endsWith(".tsx") || relative.endsWith(".ts") ? [relative] : [];
  });
}

const files = Array.from(
  new Set([
    ...targets.flatMap((target) => walk(target)),
    ...extraUserFacingFiles.filter((file) => existsSync(path.join(root, file)))
  ])
);
const failures = [];

for (const file of files) {
  const source = readFileSync(path.join(root, file), "utf8");
  for (const phrase of blockedPhrases) {
    if (source.includes(phrase)) {
      failures.push({ file, phrase });
    }
  }
  for (const phrase of brokenPatterns) {
    if (source.includes(phrase)) {
      failures.push({ file, phrase: `깨진 문자 의심. ${phrase}` });
    }
  }
}

if (failures.length > 0) {
  console.error("사용자 화면에 숨겨야 할 문구나 깨진 문자가 발견되었습니다.");
  for (const failure of failures) {
    console.error(`FAIL ${failure.file} - ${failure.phrase}`);
  }
  process.exit(1);
}

console.log("PASS 사용자 화면 금지 문구와 깨진 문자가 발견되지 않았습니다.");
