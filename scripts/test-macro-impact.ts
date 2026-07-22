import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { type MacroEventItem } from "../src/data/macroEvents";
import { assessMacroImpact } from "../src/lib/macro/macroImpact";

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
assert.match(tickerSource, /homePreviousImpact/, "Home must retain the previous release interpretation while the primary card shows an upcoming event");
assert.match(tickerSource, /잠정 해석/, "public-calendar results must be clearly distinguished from confirmed official results");
assert.match(tickerSource, /코인 단기 금리·달러 기준/, "the UI must disclose the interpretation lens instead of promising a price direction");
assert.match(tickerSource, /mergedMacroProvenance/, "combined MoM and YoY values must not inherit only the first row's provenance");
assert.match(tickerSource, /data-testid="home-macro-compact"/, "Home must keep the macro summary in a dedicated compact surface");
assert.match(tickerSource, /<details[\s\S]*data-testid="home-macro-detail"/, "Home macro details must remain expandable instead of deleting source and prior-release context");
assert.match(tickerSource, /macroSurpriseLabel/, "Home must explain whether the result was above, below, or equal to the forecast");
assert.match(tickerSource, /공식 발표값 출처/, "Home macro details must distinguish a confirmed official-value source");
assert.match(tickerSource, /item\.officialUrl \? "공식 일정 출처" : "출처"/, "Home must not label a public fallback URL as an official source");

console.log("macro impact classification matrix passed");
