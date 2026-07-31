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
  "Flash",
  "이 기기에 먼저",
  "수익 보장",
  "확정 신호",
  "반드시 상승",
  "반드시 하락",
  "매수하세요",
  "매도하세요"
];
const advisoryBlockedPhrases = ["수익 보장", "확정 신호", "반드시 상승", "반드시 하락", "매수하세요", "매도하세요"];
const apiCopyFiles = ["src/app/api/radar-news/route.ts"];
const alertCopyFiles = [
  "src/lib/radarAlerts.ts",
  "src/components/RadarAlertCenter.tsx",
  "src/lib/server/push/eventBuilders.ts"
];
const alertBlockedPhrases = ["롱 우세", "숏 우세", "롱/숏 비율", "청산 압력", "추격 진입"];
const exchangeGuideFile = "src/components/ExchangeConnectionManager.tsx";
const requiredExchangeGuideSnippets = [
  "https://www.okx.com/en-gb/help/api-faq",
  "Read만 선택",
  "https://bybit-exchange.github.io/docs/v5/user/apikey-info",
  "Read-Only + Contract 조회",
  "https://www.bitget.com/api-doc/uta/guide",
  "Read-only + UTA 조회",
  "https://bingx.com/en-us/account/api/",
  "Reading만 선택",
  "IP 제한은 선택입니다",
  "IP를 등록하지 않아도 읽기 전용 API 키를 연결할 수 있습니다.",
  "쓰기·출금·이체 권한이 감지되면 저장하지 않습니다."
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

for (const file of apiCopyFiles) {
  const source = readFileSync(path.join(root, file), "utf8");
  for (const phrase of advisoryBlockedPhrases) {
    if (source.includes(phrase)) {
      failures.push({ file, phrase });
    }
  }
}

for (const file of alertCopyFiles) {
  const source = readFileSync(path.join(root, file), "utf8");
  for (const phrase of alertBlockedPhrases) {
    if (source.includes(phrase)) {
      failures.push({ file, phrase });
    }
  }
}

const exchangeGuideSource = readFileSync(path.join(root, exchangeGuideFile), "utf8");
for (const snippet of requiredExchangeGuideSnippets) {
  if (!exchangeGuideSource.includes(snippet)) {
    failures.push({ file: exchangeGuideFile, phrase: `거래소 API 안내 누락. ${snippet}` });
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
