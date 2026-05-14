// 출시 전 상품 완성도를 기능 축별로 빠르게 점검하는 리뷰 스크립트입니다.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function exists(relativePath) {
  return existsSync(path.join(root, relativePath));
}

function includes(relativePath, text) {
  return exists(relativePath) && read(relativePath).includes(text);
}

function daysSince(iso) {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return Number.POSITIVE_INFINITY;
  return Math.floor((Date.now() - then) / 86_400_000);
}

const sourceFiles = [
  "src/app/page.tsx",
  "src/components/RadarTopNav.tsx",
  "src/components/UsageMeterPanel.tsx",
  "src/components/ProPricingPanel.tsx",
  "src/components/RadarNewsPanel.tsx",
  "src/components/StockRadarApp.tsx",
  "src/components/LiveMarketChart.tsx"
].filter(exists);
const sourceText = sourceFiles.map(read).join("\n");

const macroText = read("src/data/macroEvents.ts");
const macroUpdatedAt = macroText.match(/macroCalendarUpdatedAtIso = "([^"]+)"/)?.[1] ?? "";

const checks = [
  {
    area: "Brand",
    weight: 8,
    pass: !/코털스|Coters/i.test(sourceText),
    detail: "메인 UI에서 개인 채널 브랜딩을 분리합니다."
  },
  {
    area: "Market Split",
    weight: 10,
    pass: exists("src/app/survival/page.tsx") && exists("src/app/global/page.tsx") && exists("src/app/alts/page.tsx"),
    detail: "코인, 알트코인, 글로벌 진입 경로가 분리되어 있습니다."
  },
  {
    area: "Billing",
    weight: 12,
    pass:
      includes("src/lib/billing.ts", "crypto_monthly") &&
      includes("src/lib/billing.ts", "stocks_monthly") &&
      includes("src/lib/billing.ts", "bundle_monthly") &&
      exists("src/app/api/billing/confirm/route.ts"),
    detail: "코인, 글로벌, 올마켓 결제 구조와 승인 API가 있습니다."
  },
  {
    area: "Paid Value",
    weight: 10,
    pass:
      includes("src/lib/usageMeter.ts", "proDailyLimit") &&
      includes("src/components/UsageMeterPanel.tsx", "장중") &&
      includes("src/components/RadarAlertCenter.tsx", "Pro"),
    detail: "무료와 Pro의 차이가 반복 확인, 알림, 관심종목으로 분리됩니다."
  },
  {
    area: "API Guard",
    weight: 8,
    pass: exists("scripts/smoke-api.mjs") && includes("src/lib/server/rateLimit.ts", "Upstash"),
    detail: "공개 API 입력 검증과 rate limit 안전장치가 있습니다."
  },
  {
    area: "Copy Quality",
    weight: 8,
    pass: exists("scripts/smoke-copy.mjs") && !/맛보는 용도|샘플|신호가 아니/.test(sourceText),
    detail: "주요 화면에서 약한 상품 문구를 자동 검사합니다."
  },
  {
    area: "Macro",
    weight: 8,
    pass: daysSince(macroUpdatedAt) <= 7 && includes("src/app/api/macro-calendar/route.ts", "macro"),
    detail: "매크로 일정은 한국시간 기준으로 관리되고 API로 노출됩니다."
  },
  {
    area: "News",
    weight: 8,
    pass: includes("src/app/api/radar-news/route.ts", "translateTitlesWithGroq") && includes("src/components/RadarNewsPanel.tsx", "레이더"),
    detail: "뉴스는 번역과 시장 영향 브리핑 흐름을 갖추고 있습니다."
  },
  {
    area: "Alerts",
    weight: 8,
    pass: exists("src/app/alerts/page.tsx") && exists("src/components/RadarAlertMonitor.tsx"),
    detail: "레이더 알림 화면과 감시 컴포넌트가 있습니다."
  },
  {
    area: "Mobile",
    weight: 8,
    pass: exists("capacitor.config.ts") && exists("src/app/manifest.ts") && exists("public/brand/chart-radar-icon.png"),
    detail: "PWA, 앱 아이콘, Capacitor 기반 앱 준비가 있습니다."
  },
  {
    area: "Visual System",
    weight: 6,
    pass: includes("src/app/globals.css", "theme") && includes("src/components/ThemeToggle.tsx", "theme"),
    detail: "다크와 라이트 테마 기반이 있습니다."
  },
  {
    area: "Operations",
    weight: 6,
    pass: exists("scripts/smoke-all.mjs") && exists("scripts/smoke-ops.mjs") && exists("src/app/api/health/route.ts"),
    detail: "운영 점검, 통합 스모크, 헬스 체크가 있습니다."
  }
];

const total = checks.reduce((sum, check) => sum + check.weight, 0);
const score = checks.reduce((sum, check) => sum + (check.pass ? check.weight : 0), 0);
const percent = Math.round((score / total) * 100);

console.log(`Chart Radar Launch Review: ${percent}/100`);
for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "WARN"} ${check.area} (${check.weight}) - ${check.detail}`);
}

if (percent < 90) {
  console.log("WARN Launch score is below 90. Prioritize WARN areas before paid release.");
} else {
  console.log("PASS Launch score is at or above 90 by static readiness checks.");
}
