import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildFomcPolicyAssessment,
  extractFomcStatementText,
  findFomcCalendarDocuments,
  findFomcTranscriptUrl,
  fomcPolicyAssessmentFingerprint,
  hasFomcAssessmentMetadataChange,
  isAllowedFomcDocumentUrl,
  isFomcPolicyDocumentLabel,
  parseFomcPolicyAssessment,
  parseFomcSepHtml,
  parseFomcStatement,
  preserveFomcPolicyAssessments
} from "../src/lib/fomcPolicyAssessment";
import { fomcCompactFields } from "../src/lib/fomcPolicyPresentation";
import { serializeBasicNewsImpactEvent, serializeOfficialNewsImpactEvent, type NewsImpactEvent } from "../src/lib/newsImpact";

const currentStatementHtml = `<!doctype html><html><head><title>Federal Reserve issues FOMC statement</title></head><body>
<main><h3>Federal Reserve issues FOMC statement</h3><p>For release at 2:00 p.m. EDT</p>
<p>The Federal Open Market Committee approved the following statement for release by a 9 – 3 vote:</p>
<p>The Committee decided to maintain the target range for the federal funds rate at 3-1/2 to 3-3/4 percent, in support of the Federal Reserve's dual mandate.</p>
<p>Inflation remains elevated relative to the Committee's 2 percent goal. The Committee will deliver price stability.</p>
<p>Voting against the monetary policy action were three members, who preferred to raise the target range for the federal funds rate by 1/4 percentage point at this meeting.</p>
<p>For media inquiries, please contact the Board.</p></main></body></html>`;

const priorStatementHtml = `<!doctype html><html><body><h3>Federal Reserve issues FOMC statement</h3><p>For release at 2:00 p.m. EDT</p>
<p>The Federal Open Market Committee approved the following statement for release by a 12 - 0 vote:</p>
<p>The Committee decided to maintain the target range for the federal funds rate at 3-1/2 to 3-3/4 percent.</p>
<p>Inflation remains elevated relative to the Committee's 2 percent goal. The Committee will deliver price stability.</p>
<p>For media inquiries, please contact the Board.</p></body></html>`;

const namedVotingStatementHtml = `<!doctype html><html><head><title>Federal Reserve issues FOMC statement</title></head><body>
<main><h3>Federal Reserve issues FOMC statement</h3><p>For release at 2:00 p.m. EDT</p>
<p>Recent indicators suggest that economic activity has continued to expand at a solid pace. Inflation remains somewhat elevated.</p>
<p>In support of its goals, the Committee decided to maintain the target range for the federal funds rate at 4‑1/4 to 4‑1/2 percent.</p>
<p>The Committee is strongly committed to returning inflation to its 2 percent objective.</p>
<p>Voting for the monetary policy action were Jerome H. Powell, Chair; John C. Williams, Vice Chair; and Lisa D. Cook.</p>
<p>For media inquiries, please contact the Board.</p></main></body></html>`;

const sepHtml = `<!doctype html><html><body><h3>June 17, 2026: FOMC Projections materials, accessible version</h3>
<h4>Summary of Economic Projections</h4><h4>Table 1. Economic projections, June 2026</h4>
<table><tr><th>Variable</th><th>Median</th><th>Central Tendency</th><th>Range</th></tr>
<tr><th>2026</th><th>2027</th><th>Longer run</th><th>2026</th><th>2027</th><th>Longer run</th></tr>
<tr><th>Memo: Projected appropriate policy path</th></tr>
<tr><th>Federal funds rate</th><td>3.8</td><td>3.6</td><td>3.1</td></tr>
<tr><th>March projection</th><td>3.4</td><td>3.1</td><td>3.1</td></tr></table></body></html>`;

const decemberSepHtml = `<!doctype html><html><body><h3>December 10, 2025: FOMC Projections materials, accessible version</h3>
<h4>Summary of Economic Projections</h4><h4>Table 1. Economic projections, December 2025</h4>
<table><tr><th>Variable</th><th>Median</th><th>Central Tendency</th><th>Range</th></tr>
<tr><th>2025</th><th>2026</th><th>2027</th><th>Longer run</th><th>2025</th><th>2026</th><th>2027</th><th>Longer run</th></tr>
<tr><th>Memo: Projected appropriate policy path</th></tr>
<tr><th>Federal funds rate</th><td>3.6</td><td>3.4</td><td>3.1</td><td>3.0</td></tr>
<tr><th>September projection</th><td>3.6</td><td>3.4</td><td>3.1</td><td>3.0</td></tr></table></body></html>`;

const currentText = extractFomcStatementText(currentStatementHtml);
const priorText = extractFomcStatementText(priorStatementHtml);
assert.ok(currentText);
assert.ok(priorText);
const parsedStatement = parseFomcStatement(currentText);
assert.equal(parsedStatement?.decision, "hold");
assert.equal(parsedStatement?.targetLow, 3.5);
assert.equal(parsedStatement?.targetHigh, 3.75);
assert.equal(parsedStatement?.changeBps, undefined, "a dissenting hike preference must not become the committee's hold decision size");
assert.deepEqual(parsedStatement?.vote, { for: 9, against: 3, dissentBias: "hike" });

const namedVotingText = extractFomcStatementText(namedVotingStatementHtml);
assert.ok(namedVotingText, "recent named-voter statement format must pass extraction");
const namedVotingStatement = parseFomcStatement(namedVotingText);
assert.equal(namedVotingStatement?.decision, "hold");
assert.equal(namedVotingStatement?.targetLow, 4.25, "U+2011 non-breaking hyphens must parse as mixed-number separators");
assert.equal(namedVotingStatement?.targetHigh, 4.5);
assert.deepEqual(namedVotingStatement?.vote, { for: 3, against: 0, dissentBias: "unspecified" });

const namedDissentStatement = parseFomcStatement(`Federal Reserve issues FOMC statement
The Committee decided to lower the target range for the federal funds rate by 1/4 percentage point to 4-1/4 to 4-1/2 percent.
Inflation has eased and the risks to achieving its employment and inflation goals are roughly in balance.
Voting for the monetary policy action were Jerome H. Powell; and John C. Williams. Voting against the action was Beth M. Hammack, who preferred to maintain the target range.`);
assert.equal(namedDissentStatement?.decision, "cut");
assert.equal(namedDissentStatement?.changeBps, 25);
assert.deepEqual(namedDissentStatement?.vote, { for: 2, against: 1, dissentBias: "hike" });

const splitAprilDissent = parseFomcStatement(`Federal Reserve issues FOMC statement
The Committee decided to maintain the target range for the federal funds rate at 3‑1/2 to 3‑3/4 percent.
Voting for the monetary policy action were Jerome H. Powell; and John C. Williams. Voting against this action were Stephen I. Miran, who preferred to lower the target range by 1/4 percentage point; and Beth M. Hammack, Neel Kashkari, and Lorie K. Logan, who did not support inclusion of an easing bias.`);
assert.deepEqual(splitAprilDissent?.vote, { for: 2, against: 4, dissentBias: "mixed" });

const splitDecemberDissent = parseFomcStatement(`Federal Reserve issues FOMC statement
The Committee decided to lower the target range for the federal funds rate by 1/4 percentage point to 3-1/2 to 3‑3/4 percent.
Voting for the monetary policy action were Jerome H. Powell; John C. Williams; and Lisa D. Cook. Voting against this action were Stephen I. Miran, who preferred to lower the target range by 1/2 percentage point; and Austan D. Goolsbee and Jeffrey R. Schmid, who preferred no change to the target range.`);
assert.equal(splitDecemberDissent?.changeBps, 25);
assert.deepEqual(splitDecemberDissent?.vote, { for: 3, against: 3, dissentBias: "mixed" });

const twoNamedDissenters = parseFomcStatement(`Federal Reserve issues FOMC statement
The Committee decided to maintain the target range for the federal funds rate at 3‑1/2 to 3‑3/4 percent.
Voting for the monetary policy action were Jerome H. Powell; and John C. Williams. Voting against this action were Stephen I. Miran and Christopher J. Waller, who preferred to lower the target range by 1/4 percentage point.`);
assert.deepEqual(twoNamedDissenters?.vote, { for: 2, against: 2, dissentBias: "cut" });

const sep = parseFomcSepHtml(sepHtml, "https://www.federalreserve.gov/monetarypolicy/fomcprojtabl20260617.htm");
assert.deepEqual(sep, {
  publishedDate: "2026-06-17",
  projectionYear: 2026,
  medianRate: 3.8,
  previousMedianRate: 3.4,
  changeFromPreviousBps: 40
});
const decemberSep = parseFomcSepHtml(decemberSepHtml, "https://www.federalreserve.gov/monetarypolicy/fomcprojtabl20251210.htm");
assert.deepEqual(decemberSep, {
  publishedDate: "2025-12-10",
  projectionYear: 2026,
  medianRate: 3.4,
  previousMedianRate: 3.4,
  changeFromPreviousBps: 0
});

const assessment = buildFomcPolicyAssessment({
  meetingDate: "2026-07-29",
  analyzedAt: "2026-07-29T18:35:00.000Z",
  statementText: currentText,
  priorStatementText: priorText,
  statementUrl: "https://www.federalreserve.gov/newsevents/pressreleases/monetary20260729a.htm",
  priorStatementUrl: "https://www.federalreserve.gov/newsevents/pressreleases/monetary20260617a.htm",
  sep,
  sepUrl: "https://www.federalreserve.gov/monetarypolicy/fomcprojtabl20260617.htm",
  pressConferenceUrl: "https://www.federalreserve.gov/monetarypolicy/fomcpresconf20260729.htm",
  transcriptUrl: "https://www.federalreserve.gov/mediacenter/files/FOMCpresconf20260729.pdf"
});
assert.ok(assessment);
assert.equal(assessment.decision, "hold");
assert.equal(assessment.stance, "hawkish");
assert.equal(assessment.relativeShift, "more_hawkish");
assert.equal(assessment.ratePathBias, "hike_risk");
assert.equal(assessment.riskAssetImpact, "headwind");
assert.equal(assessment.confidence, "medium", "a prior-meeting SEP must not produce high confidence for a later meeting");
assert.equal(assessment.coverage.sep, "latest_available");
assert.equal(assessment.coverage.pressConference, "transcript_link_available_unparsed");
assert.match(assessment.riskAssetLabel, /악재 쪽/);
assert.match(assessment.coverageLabel, /본문 미반영/);
assert.deepEqual(fomcCompactFields(assessment), [
  ["결정", "금리 동결"],
  ["기조", "매파적"],
  ["금리경로", "인상 위험"]
]);

const analyzedLater = { ...assessment, analyzedAt: "2026-07-29T19:05:00.000Z" };
assert.equal(
  fomcPolicyAssessmentFingerprint(assessment),
  fomcPolicyAssessmentFingerprint(analyzedLater),
  "a routine refresh must not look like a changed policy assessment"
);

const cutButCautious = parseFomcStatement(`The Federal Open Market Committee approved the following statement for release by a 10-2 vote.
The Committee decided to lower the target range for the federal funds rate by 1/4 percentage point, to 3-1/4 to 3-1/2 percent.
Inflation remains elevated. The Committee is not considering additional rate cuts.`);
assert.equal(cutButCautious?.decision, "cut");
assert.equal(cutButCautious?.changeBps, 25);
assert.equal(cutButCautious?.targetLow, 3.25);
assert.equal(cutButCautious?.targetHigh, 3.5);
assert.ok((cutButCautious?.toneScore ?? -10) >= 0, "a cut with explicit resistance to more cuts must not be labeled mechanically dovish");

const dovishStatement = `Federal Open Market Committee. The Committee decided to maintain the target range for the federal funds rate at 3-1/2 to 3-3/4 percent.
Job gains have slowed and downside risks to employment have increased. The risks to achieving its employment and inflation goals are roughly in balance. by a 12-0 vote.`;
const mixed = buildFomcPolicyAssessment({
  meetingDate: "2026-06-17",
  analyzedAt: "2026-06-17T18:10:00.000Z",
  statementText: dovishStatement,
  statementUrl: "https://www.federalreserve.gov/newsevents/pressreleases/monetary20260617a.htm",
  sep,
  sepUrl: "https://www.federalreserve.gov/monetarypolicy/fomcprojtabl20260617.htm"
});
assert.equal(mixed?.stance, "mixed", "dovish statement language and a hawkish SEP revision must remain mixed");
assert.equal(mixed?.relativeShift, "unavailable");

const nonSepMeeting = buildFomcPolicyAssessment({
  meetingDate: "2026-07-29",
  analyzedAt: "2026-07-29T18:10:00.000Z",
  statementText: `Federal Open Market Committee. The Committee decided to maintain the target range for the federal funds rate at 3-1/2 to 3-3/4 percent. approved by a 12-0 vote.`,
  statementUrl: "https://www.federalreserve.gov/newsevents/pressreleases/monetary20260729a.htm",
  sep,
  sepUrl: "https://www.federalreserve.gov/monetarypolicy/fomcprojtabl20260617.htm"
});
assert.equal(nonSepMeeting?.stance, "neutral", "an older SEP revision must not be counted as current-meeting statement tone");
assert.equal(nonSepMeeting?.ratePathBias, "higher_for_longer", "the latest official SEP may still inform the separately labeled rate path");

const januaryAfterDecemberSep = buildFomcPolicyAssessment({
  meetingDate: "2026-01-28",
  analyzedAt: "2026-01-28T19:10:00.000Z",
  statementText: `Federal Open Market Committee. The Committee decided to maintain the target range for the federal funds rate at 3-1/2 to 3-3/4 percent. approved by a 12-0 vote.`,
  statementUrl: "https://www.federalreserve.gov/newsevents/pressreleases/monetary20260128a.htm",
  sep: decemberSep,
  sepUrl: "https://www.federalreserve.gov/monetarypolicy/fomcprojtabl20251210.htm"
});
assert.equal(januaryAfterDecemberSep?.stance, "neutral", "a December SEP remains context rather than January statement tone");
assert.equal(januaryAfterDecemberSep?.ratePathBias, "easing", "the December SEP must use its next-year horizon for a January rate-path view");

assert.equal(extractFomcStatementText("<p>Federal Reserve issues FOMC statement</p>"), null, "a title-only feed item cannot produce a policy classification");
assert.equal(parseFomcPolicyAssessment({ ...assessment, statementUrl: "https://evil.example/fomc.htm" }), null);
assert.equal(parseFomcPolicyAssessment({ ...assessment, meetingDate: "2026-07-30" }), null, "document dates must match the assessed meeting");
assert.equal(isAllowedFomcDocumentUrl("https://www.federalreserve.gov/newsevents/pressreleases/monetary20260729a.htm", "statement"), true);
assert.equal(isAllowedFomcDocumentUrl("https://federalreserve.gov/newsevents/pressreleases/monetary20260729a.htm", "statement"), false);
assert.equal(isAllowedFomcDocumentUrl("https://www.federalreserve.gov/files/other.pdf", "transcript"), false);
assert.equal(isAllowedFomcDocumentUrl("https://www.federalreserve.gov/newsevents/pressreleases/monetary20260729a.htm?view=1", "statement"), false);
assert.equal(isFomcPolicyDocumentLabel("FOMC Statement"), true);
assert.equal(isFomcPolicyDocumentLabel("Fed Interest Rate Decision"), true);
assert.equal(isFomcPolicyDocumentLabel("FOMC Economic Projections"), false);
assert.equal(isFomcPolicyDocumentLabel("FOMC Press Conference"), false);
assert.equal(isFomcPolicyDocumentLabel("FOMC Minutes"), false);

const calendarHtml = `<section><h4>2026 FOMC Meetings</h4>
<a href="/newsevents/pressreleases/monetary20260729a.htm">HTML</a>
<a href="/monetarypolicy/fomcpresconf20260729.htm">Press Conference</a>
<a href="/newsevents/pressreleases/monetary20260617a.htm">HTML</a>
<a href="/monetarypolicy/fomcprojtabl20260617.htm">HTML</a></section>`;
assert.deepEqual(findFomcCalendarDocuments(calendarHtml, "2026-07-29T18:00:00.000Z"), {
  meetingDate: "2026-07-29",
  statementUrl: "https://www.federalreserve.gov/newsevents/pressreleases/monetary20260729a.htm",
  priorStatementUrl: "https://www.federalreserve.gov/newsevents/pressreleases/monetary20260617a.htm",
  sepUrl: "https://www.federalreserve.gov/monetarypolicy/fomcprojtabl20260617.htm",
  pressConferenceUrl: "https://www.federalreserve.gov/monetarypolicy/fomcpresconf20260729.htm"
});
assert.equal(
  findFomcTranscriptUrl(`<a href="/mediacenter/files/FOMCpresconf20260729.pdf">Press Conference Transcript (PDF)</a>`, "2026-07-29"),
  "https://www.federalreserve.gov/mediacenter/files/FOMCpresconf20260729.pdf"
);
assert.equal(findFomcTranscriptUrl(`<a href="https://evil.example/FOMCpresconf20260729.pdf">Transcript</a>`, "2026-07-29"), undefined);

const fingerprint = fomcPolicyAssessmentFingerprint(assessment);
assert.equal(hasFomcAssessmentMetadataChange({}, {
  fomc_policy_assessment: assessment,
  fomc_policy_fingerprint: fingerprint
}), true);
assert.equal(hasFomcAssessmentMetadataChange({ fomc_policy_fingerprint: fingerprint }, {
  fomc_policy_assessment: analyzedLater,
  fomc_policy_fingerprint: fingerprint
}), false);
assert.equal(hasFomcAssessmentMetadataChange({ fomc_policy_fingerprint: fingerprint }, {}), false, "an assessment-free RSS item cannot clear the stored analysis");

const carrier = {
  source: "Fed",
  id: "fomc-statement-20260729",
  label: "FOMC Statement",
  releaseAt: "2026-07-29T18:00:00.000Z",
  fomcPolicyAssessment: undefined as typeof assessment | undefined
};
const beforeAssessment = preserveFomcPolicyAssessments([carrier], []);
assert.equal(beforeAssessment[0].fomcPolicyAssessment, undefined);
const withAssessment = preserveFomcPolicyAssessments([{ ...carrier, fomcPolicyAssessment: assessment }], beforeAssessment);
assert.equal(withAssessment[0].fomcPolicyAssessment?.stance, "hawkish");
const afterTransientFailure = preserveFomcPolicyAssessments([carrier], withAssessment);
assert.equal(afterTransientFailure[0].fomcPolicyAssessment?.stance, "hawkish", "a transient Fed fetch failure must not clear the last valid assessment");
const differentMeeting = preserveFomcPolicyAssessments([{ ...carrier, releaseAt: "2026-09-16T18:00:00.000Z" }], withAssessment);
assert.equal(differentMeeting[0].fomcPolicyAssessment, undefined, "an assessment cannot cross meeting dates even if a provider reuses an id");

const newsEvent: NewsImpactEvent = {
  id: "event-1",
  semanticKey: "semantic-1",
  market: "crypto",
  category: "macro",
  targets: ["btc", "eth"],
  importance: "high",
  version: 1,
  status: "active",
  occurredAt: "2026-07-29T18:00:00.000Z",
  firstSeenAt: "2026-07-29T18:01:00.000Z",
  updatedAt: "2026-07-29T18:35:00.000Z",
  headline: "미 연준, FOMC 통화정책 성명 공개",
  factSummary: "미 연준이 정책금리를 동결했습니다.",
  primarySource: {
    id: "source-1",
    name: "Federal Reserve",
    kind: "official",
    url: assessment.statementUrl,
    publishedAt: "2026-07-29T18:00:00.000Z"
  },
  sourceCount: 1,
  reaction: null,
  fomcPolicyAssessment: assessment,
  pro: { sources: [], reactionHistory: [], metrics: [], revisions: [] }
};
assert.equal(serializeBasicNewsImpactEvent(newsEvent).fomcPolicyAssessment?.stance, "hawkish", "Basic intentionally keeps the public official-policy assessment");
assert.equal(serializeBasicNewsImpactEvent(newsEvent).fomcPolicyAssessment?.sepUrl, assessment.sepUrl, "official FOMC evidence is public while exact market-reaction evidence remains Pro");
assert.equal(serializeBasicNewsImpactEvent(newsEvent).pro, undefined, "Basic still strips Pro evidence");
assert.equal(serializeOfficialNewsImpactEvent(newsEvent).fomcPolicyAssessment, undefined, "off/shadow official-only mode fails closed on policy interpretation");

const newsStoreSource = readFileSync("src/lib/server/news/newsImpactStore.ts", "utf8");
assert.match(newsStoreSource, /version: previous \? previous\.version \+ \(changed \? 1 : 0\) : 1/, "assessment enrichment cannot increment the official event version");
assert.match(newsStoreSource, /changed \|\| presentationChanged \|\| assessmentChanged \|\| !previous/, "a valid assessment can enrich metadata without rewriting the event clock");
const macroStoreSource = readFileSync("src/lib/macro/server/macroStore.ts", "utf8");
assert.match(macroStoreSource, /preserveFomcPolicyAssessments\(payload\.items, previousPayload\?\.items \?\? \[\]\)/, "a transient Fed fetch failure keeps the last valid macro assessment");
const sourceAdapterSource = readFileSync("src/lib/server/news/officialSourceAdapters.ts", "utf8");
assert.match(sourceAdapterSource, /contentSeed: details/, "FOMC classifier output stays out of the official source content hash");
assert.match(sourceAdapterSource, /eventKind === "fomc_policy_statement"[\s\S]*fomcPolicyAssessment/, "only the canonical FOMC policy event crosses into NEWS");
const fedAdapterSource = readFileSync("src/lib/macro/sourceAdapters/fed.ts", "utf8");
assert.doesNotMatch(fedAdapterSource, /isFomcAssessmentDisplayTitle/, "a press conference calendar row must not inherit the statement assessment");
assert.match(fedAdapterSource, /documents && isFomcPolicyDocumentLabel\(item\.label\)/, "only a policy statement or rate-decision row receives the statement assessment");
const macroTickerSource = readFileSync("src/components/MacroTicker.tsx", "utf8");
assert.match(macroTickerSource, /fomcCompactFields/, "schedule and compact macro cards expose the short FOMC contract");
assert.match(macroTickerSource, /실제 인상·인하 확률과 발표 뒤 가격 반응은 별도로/, "policy text interpretation is not presented as a probability or observed reaction");
const newsPanelSource = readFileSync("src/components/news/NewsImpactPanel.tsx", "utf8");
assert.match(newsPanelSource, /정책 문구 해석과 발표 뒤 실제 가격 반응은 별도/, "NEWS separates policy tone from observed market reaction");

console.log("FOMC policy assessment tests passed");
