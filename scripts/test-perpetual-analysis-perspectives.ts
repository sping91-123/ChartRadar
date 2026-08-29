import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { MarketCondition } from "../src/lib/marketAnalysis";
import {
  buildPublicTechnicalEvidence,
  hasCompletePerpetualTechnicalDetails,
  perpetualAnalysisPerspectives
} from "../src/lib/perpetualAnalysisPerspective";

const condition: MarketCondition = {
  regime: "trendUp",
  regimeScore: 3,
  rsi14: 61.2,
  rsiState: "neutral",
  macdLine: 12,
  macdSignal: 8,
  macdHistogram: 4,
  macdState: "rising",
  ema20: 60_100,
  ema50: 59_800,
  ema200: 58_000,
  emaStack: "bullish",
  emaSlope: "rising",
  adx14: 27.4,
  plusDi14: 31,
  minusDi14: 18,
  dmiState: "bullish",
  supertrendDirection: "bullish",
  supertrendValue: 59_500,
  donchianHigh: 61_000,
  donchianLow: 58_500,
  donchianPosition: "upper",
  keltnerMiddle: 60_000,
  keltnerUpper: 61_200,
  keltnerLower: 58_800,
  keltnerPosition: "upper",
  atr14: 480,
  atrPercent: 0.8,
  volatilityState: "normal",
  volumeRatio: 1.35,
  volumeState: "high",
  bollingerMiddle: 60_000,
  bollingerUpper: 61_500,
  bollingerLower: 58_500,
  bollingerPosition: "upper",
  bollingerWidthPercentile: 68
};

assert.deepEqual(perpetualAnalysisPerspectives.map((item) => item.id), ["combined", "ict", "technical"]);
assert.equal(perpetualAnalysisPerspectives[0].label, "통합 판단", "the saved operational decision must stay the default reading perspective");

const publicTechnical = buildPublicTechnicalEvidence(condition, "2026-08-29T00:00:00.000Z", 60_500);
assert.equal(publicTechnical.timeframe, "15m");
assert.equal(publicTechnical.role, "cross_check");
assert.equal(publicTechnical.observedAt, "2026-08-29T00:00:00.000Z");
assert.equal(publicTechnical.closedPrice, 60_500);
assert.equal(publicTechnical.regime, "trendUp");
assert.equal(publicTechnical.rsi14, 61.2);
assert.equal(publicTechnical.emaStack, "bullish");
assert.equal(publicTechnical.adx14, 27.4);
assert.equal(publicTechnical.volumeRatio, 1.35);
assert.equal("ema20" in publicTechnical, false, "Basic evidence must not expose exact moving-average price levels");
assert.equal("macdLine" in publicTechnical, false, "Basic evidence must keep exact oscillator values in the Pro detail contract");
assert.equal(hasCompletePerpetualTechnicalDetails({ technicalDetailVersion: 1 }), true);
assert.equal(hasCompletePerpetualTechnicalDetails({}), false, "older partial Pro snapshots must not be treated as the complete indicator contract");
assert.equal(hasCompletePerpetualTechnicalDetails(undefined), false);

const workspaceSource = readFileSync(join(process.cwd(), "src/components/coin/PerpetualAnalysisWorkspace.tsx"), "utf8");
assert.match(workspaceSource, /useState<PerpetualAnalysisPerspective>\("combined"\)/, "new entries must always start on the combined decision");
assert.doesNotMatch(workspaceSource, /localStorage|sessionStorage/, "a previous visit must not hide the operational decision on a deep link");
assert.doesNotMatch(workspaceSource, /aligned|conflicting|같은 방향|서로 엇갈림/, "technical evidence must not become a second client-side vote");
assert.match(workspaceSource, /between=\{chart\}/, "the perspective selector must remain discoverable before the shared price chart");

const tabsSource = readFileSync(join(process.cwd(), "src/components/coin/PerpetualAnalysisTabs.tsx"), "utf8");
assert.match(tabsSource, /role="tablist"/);
assert.match(tabsSource, /role="tab"/);
assert.match(tabsSource, /role="tabpanel"/);
assert.match(tabsSource, /ArrowRight/);
assert.match(tabsSource, /ArrowLeft/);
assert.doesNotMatch(tabsSource, /ArrowDown|ArrowUp/, "a horizontal tablist must leave vertical arrow keys available for page scrolling");
assert.match(tabsSource, /event\.key === "Home"/);
assert.match(tabsSource, /event\.key === "End"/);
assert.match(tabsSource, /aria-orientation="horizontal"/);
assert.match(tabsSource, /min-h-11/, "mobile tabs must keep a 44px minimum touch target");
assert.match(tabsSource, /aria-controls=\{`\$\{instanceId\}-panel`\}/, "all dynamically loaded tabs must reference the panel that exists in the DOM");
assert.match(tabsSource, /aria-describedby=\{`\$\{instanceId\}-description \$\{instanceId\}-boundary`\}/, "the visible perspective explanation and decision boundary must be announced with each tab");
assert.match(tabsSource, /sticky top-0/, "the 44px perspective rail must remain reachable while reading long evidence");
assert.match(tabsSource, /text-ui-activeText/, "selected tab labels must retain readable contrast on the panel surface");
assert.ok(tabsSource.indexOf("{between}") > tabsSource.indexOf('role="tabpanel"'), "the shared chart must remain inside the active tabpanel reading order");
assert.match(tabsSource, /한 신호만으로 상단의 최종 방향이나 감시 조건을 바꾸지 않습니다/);

const technicalSource = readFileSync(join(process.cwd(), "src/components/coin/PerpetualTechnicalEvidencePanel.tsx"), "utf8");
assert.match(technicalSource, /find\(\(item\) => item\.timeframe === activeTimeframe\)/, "each Pro timeframe must use an exact match");
assert.doesNotMatch(technicalSource, /TechnicalRadarPanel|analyzeTechnicalRadar/, "BTC and ETH must not start a second candle calculation path");
assert.match(technicalSource, /상단 통합 방향과 감시 조건을 만들거나 바꾸지 않습니다/);
assert.match(technicalSource, /publicTechnical\?\.observedAt/);
assert.match(technicalSource, /publicTechnical\?\.closedPrice/);
assert.match(technicalSource, /동일한 저장 분석에서 15분·1시간·4시간의 마지막 확정봉을 비교합니다/);
assert.match(technicalSource, /히스토그램 증가/);
assert.match(technicalSource, /폭 백분위/);
assert.match(technicalSource, /hasCompletePerpetualTechnicalDetails\(pro\)/, "older partial Pro evidence must not be presented as the complete detail contract");

const workbenchSource = readFileSync(join(process.cwd(), "src/components/coin/PerpetualEvidenceWorkbench.tsx"), "utf8");
assert.match(workbenchSource, /mode\?: "combined" \| "ict"/);
assert.match(workbenchSource, /<IctDetails evidence=\{primary\} \/>/, "missing 15m detail must not silently fall back to another timeframe");
assert.doesNotMatch(workbenchSource, /primary \?\? pro\.multiTimeframeEvidence\[0\]/);
assert.doesNotMatch(workbenchSource, /매수·매도 과열도\(RSI\)/, "technical indicators must not remain inside the ICT details grid");
assert.match(workbenchSource, /15분 기술 레짐은/);
assert.match(workbenchSource, /mode === "ict" && pro/, "precise ICT timeframe evidence must stay in the ICT perspective");

const experienceSource = readFileSync(join(process.cwd(), "src/components/coin/PerpetualDecisionExperience.tsx"), "utf8");
assert.match(experienceSource, /<PerpetualAnalysisWorkspace[\s\S]*snapshot=\{displaySnapshot\}[\s\S]*chart=\{/);
assert.doesNotMatch(experienceSource, /<PerpetualEvidenceWorkbench snapshot=\{displaySnapshot\} \/>/);

const majorsSource = readFileSync(join(process.cwd(), "src/components/MajorsApp.tsx"), "utf8");
assert.match(majorsSource, /overflow-x-clip/, "horizontal clipping must not create an intermediate vertical scroll container that breaks sticky tabs");
assert.doesNotMatch(majorsSource, /<main className="[^"]*overflow-x-hidden/, "the main analysis ancestor must not trap sticky positioning with overflow-x-hidden");

const briefingClientSource = readFileSync(join(process.cwd(), "src/components/coin/PerpetualSnapshotBriefing.tsx"), "utf8");
assert.match(briefingClientSource, /if \(!available\)/, "stale data must abort and clear any previous AI explanation");
assert.match(briefingClientSource, /\[available, snapshotId\]/, "quality changes with the same snapshot id must reset explanation state");
assert.match(briefingClientSource, /최신 데이터 갱신에 실패해 이전 AI 설명을 현재 설명처럼 보여주지 않습니다/);

console.log("Perpetual analysis perspective contract passed.");
