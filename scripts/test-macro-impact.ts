import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { type MacroEventItem } from "../src/data/macroEvents";
import { assessMacroImpact, supportsMacroImpactAssessment } from "../src/lib/macro/macroImpact";

const nowMs = Date.parse("2026-07-22T06:30:00.000Z");
const base: MacroEventItem = {
  label: "Core PPI MoM",
  releaseAt: "2026-07-15T12:30:00.000Z",
  dateKst: "07.15 21:30",
  state: "released",
  importance: 3,
  eventType: "numeric_release",
  status: "actual_available",
  actual: "+0.1%",
  actualValue: "+0.1%",
  actualProvenance: "official",
  consensusValue: "0.4%",
  forecast: "0.4%",
  consensusProvenance: "public_calendar",
  summary: "생산자 물가를 확인합니다.",
  marketImpact: "발표 뒤 금리와 달러 반응을 확인합니다.",
  source: "BLS",
  sourceType: "official_api",
  sourceUrl: "https://www.bls.gov/ppi/",
  isOfficial: true,
  isNumericEvent: true
};

const coolerPpi = assessMacroImpact(base, nowMs);
assert.equal(coolerPpi?.verdict, "호재");
assert.equal(coolerPpi?.confidence, "confirmed");
assert.equal(coolerPpi?.badgeLabel, "호재");
assert.match(coolerPpi?.reason ?? "", /물가 압력/);

const hotterCpi = assessMacroImpact({ ...base, label: "CPI MoM", actualValue: "0.5%", actual: "0.5%" }, nowMs);
assert.equal(hotterCpi?.verdict, "악재");

const equalRetail = assessMacroImpact({
  ...base,
  label: "Retail Sales MoM",
  actualValue: "0.2%",
  actual: "0.2%",
  actualProvenance: "public_calendar",
  consensusValue: "0.2%",
  forecast: "0.2%",
  consensusProvenance: "public_calendar",
  sourceType: "public_calendar",
  isOfficial: false
}, nowMs);
assert.equal(equalRetail?.verdict, "중립");
assert.equal(equalRetail?.confidence, "provisional");
assert.equal(equalRetail?.badgeLabel, "잠정 중립");

const strongerSentiment = assessMacroImpact({
  ...base,
  label: "Michigan Consumer Sentiment Prel",
  actualValue: "54.4",
  actual: "54.4",
  actualProvenance: "public_calendar",
  consensusValue: "51",
  forecast: "51",
  consensusProvenance: "public_calendar",
  source: "ForexFactory",
  sourceType: "public_calendar",
  isOfficial: false
}, nowMs);
assert.equal(strongerSentiment?.verdict, "악재");
assert.equal(strongerSentiment?.badgeLabel, "잠정 악재");

const claimsBase: MacroEventItem = {
  ...base,
  label: "Initial Jobless Claims",
  actualValue: "208K",
  actual: "208K",
  actualProvenance: "public_calendar",
  consensusValue: "217K",
  forecast: "217K",
  consensusProvenance: "public_calendar",
  source: "DOL",
  sourceType: "public_calendar",
  isOfficial: false
};
assert.equal(assessMacroImpact(claimsBase, nowMs)?.verdict, "악재", "lower claims imply firmer labor and more rate pressure");
assert.equal(assessMacroImpact({ ...claimsBase, actualValue: "220K", actual: "220K" }, nowMs)?.verdict, "호재");

const weakerPayroll = assessMacroImpact({ ...claimsBase, label: "Nonfarm Payrolls", actualValue: "120K", actual: "120K", consensusValue: "180K", forecast: "180K" }, nowMs);
assert.equal(weakerPayroll?.verdict, "호재");

const officialHomeSales = assessMacroImpact({
  ...base,
  label: "New Home Sales",
  actualValue: "607K; -10.5% m/m",
  actual: "607K; -10.5% m/m",
  consensusValue: "0.62M",
  forecast: "0.62M"
}, nowMs);
assert.equal(officialHomeSales?.verdict, "호재", "the comparable official level should restore the released Home verdict");
assert.equal(officialHomeSales?.confidence, "confirmed");
assert.equal(officialHomeSales?.surprise, "lower");
assert.equal(officialHomeSales?.actual, 607_000);
assert.equal(officialHomeSales?.expected, 620_000);
assert.equal(supportsMacroImpactAssessment({ ...base, label: "New Home Sales" }), true);
assert.equal(supportsMacroImpactAssessment({ ...base, label: "Trade Balance" }), false, "unsupported high-impact events must not promise a good-or-bad verdict");
assert.equal(supportsMacroImpactAssessment({ ...base, label: "Fed Chair Testimony", eventType: "speech_event" }), false);
assert.equal(assessMacroImpact({
  ...base,
  label: "New Home Sales",
  actualValue: "-10.5% m/m; 607K",
  actual: "-10.5% m/m; 607K",
  consensusValue: "0.62M",
  forecast: "0.62M"
}, nowMs)?.verdict, "호재", "component order must not decide which actual is compared");
assert.equal(assessMacroImpact({
  ...base,
  label: "New Home Sales",
  actualValue: "620K; -10.5% m/m",
  actual: "620K; -10.5% m/m",
  consensusValue: "0.62M",
  forecast: "0.62M"
}, nowMs)?.verdict, "중립", "K and M values must be normalized before comparison");
assert.equal(assessMacroImpact({ ...base, label: "New Home Sales", actualValue: "607K; 608K", consensusValue: "0.62M" }, nowMs), null, "duplicate comparable components must fail closed");
assert.equal(assessMacroImpact({ ...base, label: "New Home Sales", actualValue: "607K; preliminary", consensusValue: "0.62M" }, nowMs), null, "an invalid composite component must fail closed");
assert.equal(assessMacroImpact({ ...base, label: "New Home Sales", actualValue: "607K; -10.5% m/m", consensusValue: "-1.3%" }, nowMs), null, "an unlabeled forecast must not be forced onto a period-specific actual");

assert.equal(assessMacroImpact({ ...base, releaseAt: "2026-07-23T12:30:00.000Z" }, nowMs), null, "upcoming events have no result interpretation");
assert.equal(assessMacroImpact({ ...base, eventType: "document_release", isDocumentEvent: true }, nowMs), null);
assert.equal(assessMacroImpact({ ...base, actualProvenance: "unknown" }, nowMs), null, "unknown actual provenance must fail closed");
assert.equal(assessMacroImpact({ ...base, consensusProvenance: "mixed", consensusValue: "출처별 전망 상이" }, nowMs), null);
assert.equal(assessMacroImpact({ ...base, actualValue: "208K", consensusValue: "0.4%" }, nowMs), null, "different value dimensions cannot be compared");
assert.equal(
  assessMacroImpact({ ...base, label: "PPI", actualValue: "0.1% / 2.7%", actual: "0.1% / 2.7%", consensusValue: "0.2% / 2.6%", forecast: "0.2% / 2.6%" }, nowMs),
  null,
  "unlabeled combined values must not be classified from only their first number"
);
assert.equal(
  assessMacroImpact({ ...base, label: "PPI", actualValue: "0.1%/2.7%", actual: "0.1%/2.7%", consensusValue: "0.2%/2.6%", forecast: "0.2%/2.6%" }, nowMs),
  null,
  "unlabeled combined values without separator spaces must also fail closed"
);
assert.equal(
  assessMacroImpact({ ...base, label: "New Home Sales", actualValue: "607K (-10.5% m/m)", actual: "607K (-10.5% m/m)", consensusValue: "-1.3% m/m", forecast: "-1.3% m/m" }, nowMs),
  null,
  "multiple measurements inside one unstructured segment must not be reduced to the first number"
);
const conflictingPpi = assessMacroImpact({
  ...base,
  label: "PPI",
  actualValue: "전월비 0.1% / 전년비 2.7%",
  actual: "전월비 0.1% / 전년비 2.7%",
  consensusValue: "전월비 0.2% / 전년비 2.6%",
  forecast: "전월비 0.2% / 전년비 2.6%"
}, nowMs);
assert.equal(conflictingPpi?.verdict, "중립");
assert.equal(conflictingPpi?.surprise, "mixed");
assert.match(conflictingPpi?.reason ?? "", /엇갈려/);
assert.equal(assessMacroImpact({
  ...base,
  label: "PPI",
  actualValue: "전월비 0.1% / 전년비 2.5%",
  actual: "전월비 0.1% / 전년비 2.5%",
  consensusValue: "전월비 0.2% / 전년비 2.6%",
  forecast: "전월비 0.2% / 전년비 2.6%"
}, nowMs)?.verdict, "호재", "matching monthly and yearly surprises may share one direction");
assert.equal(assessMacroImpact({ ...base, label: "Fed Chair Testimony" }, nowMs), null, "unmapped events must not receive a forced direction");

const tickerSource = readFileSync("src/components/MacroTicker.tsx", "utf8");
assert.match(tickerSource, /assessMacroImpact/, "all macro surfaces must use the tested impact assessment");
assert.match(tickerSource, /homePreviousImpact/, "the full schedule card must retain the previous release interpretation while showing an upcoming event");
assert.match(tickerSource, /잠정 해석/, "public-calendar results must be clearly distinguished from confirmed official results");
assert.match(tickerSource, /코인 단기 금리·달러 기준/, "the UI must disclose the interpretation lens instead of promising a price direction");
assert.match(tickerSource, /mergedMacroProvenance/, "combined MoM and YoY values must not inherit only the first row's provenance");
assert.match(tickerSource, /data-testid="home-macro-compact"/, "Home must keep the macro summary in a dedicated compact surface");
assert.match(tickerSource, /<details[\s\S]*data-testid="home-macro-compact"/, "Home macro values must use a native disclosure");
assert.match(tickerSource, /<summary/, "Home macro summary remains keyboard-toggleable");
const homeDetailsMarker = tickerSource.indexOf('data-testid="home-macro-compact"');
const homeDetailsStart = tickerSource.lastIndexOf("<details", homeDetailsMarker);
const homeDetailsTagEnd = tickerSource.indexOf(">", homeDetailsMarker);
const homeSummaryStart = tickerSource.indexOf("<summary", homeDetailsTagEnd);
const homeSummaryEnd = tickerSource.indexOf("</summary>", homeSummaryStart);
const homeDetailsEnd = tickerSource.indexOf("</details>", homeSummaryEnd);
assert.ok(homeDetailsStart >= 0 && homeDetailsTagEnd > homeDetailsStart && homeSummaryEnd > homeSummaryStart && homeDetailsEnd > homeSummaryEnd, "Home macro disclosure structure is present");
const homeDetailsOpeningTag = tickerSource.slice(homeDetailsStart, homeDetailsTagEnd + 1);
const homeSummarySource = tickerSource.slice(homeSummaryStart, homeSummaryEnd);
assert.doesNotMatch(homeDetailsOpeningTag, /\bopen(?:=|\s|>)/, "Home macro disclosure is closed by default");
assert.doesNotMatch(homeSummarySource, /<dl|displayConsensusValue|displayPreviousValue|homePrimaryValue/, "actual, forecast, and previous values stay outside the collapsed summary");
assert.match(homeSummarySource, /impactAssessment\.badgeLabel|fomcAssessment\.stanceLabel/, "released-event verdict remains visible in the collapsed summary");
assert.match(homeSummarySource, /pendingImpactLabel/, "the collapsed Home card must explain that unreleased events are judged after release");
assert.match(homeSummarySource, /isCryptoHome \? \([\s\S]*pendingImpactLabel/, "the new pending verdict cue must stay scoped to the actual crypto Home route");
assert.match(homeSummarySource, /eventKind[\s\S]*compactStatusLabel\(item\)/, "collapsed Home macro shows both event status and remaining-time state");
assert.ok(tickerSource.indexOf("{calendarWarningText", homeDetailsEnd) > homeDetailsEnd, "calendar warnings stay visible outside the disclosure");
assert.ok(tickerSource.indexOf("{previousReleaseSummary}", homeDetailsEnd) > homeDetailsEnd, "Home must keep the previous released verdict visible below an upcoming event");
assert.match(tickerSource, /home-previous-macro-release/, "the previous released verdict needs a stable Home regression hook");
assert.match(tickerSource, /!isCryptoHome \|\| Boolean\(homePreviousImpact\)/, "Home must omit an untrusted previous-release verdict while news routes keep their prior compact layout");
assert.match(tickerSource, /발표 후 호재·악재/, "the collapsed Home card must retain a neutral pre-release verdict cue");
assert.match(tickerSource, /발표 후 결과 해석/, "unsupported numeric events must not promise a good-or-bad verdict");
assert.match(tickerSource, /공식 내용 확인 후 분석/, "document and speech events must not promise a numeric good-or-bad verdict");
assert.match(tickerSource, /displayItems\.filter\(isHighImpactMacro\)/, "Home must never fall back to a medium-impact event");
assert.match(tickerSource, /오늘 발표/, "same-KST-date events must have a visible non-color label");
assert.match(tickerSource, /border-signal-warning\/45 bg-signal-warning/, "today's Home macro event uses the actual gold warning token rather than a neutral watch color");
assert.match(tickerSource, /전체 일정 <ChevronRight/, "Home must link directly to the full schedule for sources and prior-release context");
assert.match(tickerSource, /macroSurpriseLabel/, "Home must explain whether the result was above, below, or equal to the forecast");
assert.match(tickerSource, /impactAssessment\.reason/, "expanded Home details must retain the reason behind the impact verdict");
assert.match(tickerSource, /공식 발표값 출처/, "the full macro surface must distinguish a confirmed official-value source");
assert.match(tickerSource, /item\.officialUrl \? "공식 일정 출처" : "출처"/, "the full macro surface must not label a public fallback URL as an official source");

console.log("macro impact classification matrix passed");
