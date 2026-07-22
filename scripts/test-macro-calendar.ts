import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { type MacroEventItem } from "../src/data/macroEvents";
import { dedupeMacroCalendarItems, semanticMacroEventFamily } from "../src/lib/macro/dedupeMacroCalendar";
import { selectLatestMacroGenerationRows } from "../src/lib/macro/generation";
import { censusDurableGoodsActual, censusRetailSalesActual, isCensusDurableGoodsHeadline, isCensusRetailSalesHeadline, parseCensusReleaseDateIso } from "../src/lib/macro/sourceAdapters/census";
import { dolClaimsValueForKind, expectedDolWeekEndedIso, fetchDolOfficialEnrichments, formatDolClaimsK } from "../src/lib/macro/sourceAdapters/dol";
import { resolveMacroSourceTrust } from "../src/lib/macro/sourceTrust";
import { isStoredMacroPayloadStale } from "../src/lib/macro/staleness";

const base: MacroEventItem = {
  label: "Initial Jobless Claims",
  releaseAt: "2026-07-23T12:30:00.000Z",
  dateKst: "07.23 21:30",
  state: "upcoming",
  importance: 3,
  eventType: "numeric_release",
  status: "scheduled",
  forecast: "212K",
  consensusProvenance: "public_calendar",
  previous: "208K",
  previousProvenance: "public_calendar",
  summary: "미국 고용 둔화 여부를 확인합니다.",
  marketImpact: "발표 뒤 가격과 거래량을 확인합니다.",
  source: "DOL",
  sourceType: "public_calendar",
  sourceUrl: "https://tradingeconomics.com/united-states/jobless-claims",
  isOfficial: false
};

const duplicate: MacroEventItem = {
  ...base,
  label: "Unemployment Claims",
  importance: 2,
  forecast: "211K",
  sourceUrl: "https://www.forexfactory.com/calendar"
};

assert.equal(semanticMacroEventFamily(base.label), "initial-jobless-claims");
assert.equal(semanticMacroEventFamily(duplicate.label), "initial-jobless-claims");
assert.equal(semanticMacroEventFamily("Continuing Jobless Claims"), "continuing-jobless-claims");
assert.equal(semanticMacroEventFamily("4-Week Average Jobless Claims"), "jobless-claims-four-week-average");
assert.equal(semanticMacroEventFamily("Jobless Claims 4-week Average"), "jobless-claims-four-week-average");

const deduped = dedupeMacroCalendarItems([base, duplicate]);
assert.equal(deduped.length, 1, "the same scheduled release from two public calendars is shown once");
assert.equal(deduped[0].label, "Initial Jobless Claims");
assert.equal(deduped[0].forecast, "출처별 전망 상이", "conflicting public forecasts are disclosed instead of silently choosing one");
assert.equal(deduped[0].previous, "208K");

const continuing = dedupeMacroCalendarItems([base, { ...duplicate, label: "Continuing Jobless Claims" }]);
assert.equal(continuing.length, 2, "initial and continuing claims remain separate indicators");
assert.equal(
  dolClaimsValueForKind("initial", { initialClaimsSa: 216_000, continuedClaimsSa: 1_960_000, initialClaimsFourWeekAverage: 214_500 }),
  216_000
);
assert.equal(
  dolClaimsValueForKind("continuing", { initialClaimsSa: 216_000, continuedClaimsSa: 1_960_000, initialClaimsFourWeekAverage: 214_500 }),
  1_960_000,
  "continuing claims must never reuse the initial-claims value"
);
assert.equal(
  dolClaimsValueForKind("four_week_average", { initialClaimsSa: 216_000, continuedClaimsSa: 1_960_000, initialClaimsFourWeekAverage: 214_500 }),
  214_500,
  "the four-week average must use DOL's SA4WK field"
);
assert.equal(expectedDolWeekEndedIso("initial", "2026-06-25T12:30:00.000Z"), "2026-06-20T00:00:00.000Z");
assert.equal(expectedDolWeekEndedIso("four_week_average", "2026-06-25T12:30:00.000Z"), "2026-06-20T00:00:00.000Z");
assert.equal(expectedDolWeekEndedIso("continuing", "2026-06-25T12:30:00.000Z"), "2026-06-13T00:00:00.000Z");
assert.equal(expectedDolWeekEndedIso("initial", "2026-06-24T12:30:00.000Z"), "2026-06-20T00:00:00.000Z", "a holiday-shifted Wednesday release still maps to the prior reporting Saturday");
assert.equal(expectedDolWeekEndedIso("initial", "2026-01-01T12:30:00.000Z"), "2025-12-27T00:00:00.000Z");
assert.equal(expectedDolWeekEndedIso("continuing", "2026-01-01T12:30:00.000Z"), "2025-12-20T00:00:00.000Z");
assert.equal(formatDolClaimsK(214_250), "214.25K", "quarter-thousand precision must not be rounded away");
assert.equal(formatDolClaimsK(214_500), "214.5K");
assert.equal(formatDolClaimsK(1_821_000), "1,821K");
const claimsVariants = dedupeMacroCalendarItems([
  base,
  { ...duplicate, label: "4-Week Average Jobless Claims" }
]);
assert.equal(claimsVariants.length, 2, "initial claims and their four-week average must never merge");

const officialActual: MacroEventItem = {
  ...base,
  state: "released",
  status: "actual_available",
  sourceType: "official_api",
  sourceUrl: "https://oui.doleta.gov/unemploy/wkclaims/report.asp",
  officialUrl: "https://oui.doleta.gov/unemploy/wkclaims/report.asp",
  isOfficial: true,
  actual: "216K",
  actualValue: "216K",
  actualProvenance: "official"
};
const publicActual = {
  ...duplicate,
  state: "released" as const,
  actual: "215K",
  actualValue: "215K",
  actualProvenance: "public_calendar" as const
};
const officialPreferred = dedupeMacroCalendarItems([publicActual, officialActual]);
assert.equal(officialPreferred.length, 1);
assert.equal(officialPreferred[0].actual, "216K", "an official actual value wins over an aggregator value");
assert.equal(officialPreferred[0].forecast, "출처별 전망 상이", "official actual provenance must not make a public forecast authoritative");
assert.equal(officialPreferred[0].sourceType, "official_api");
assert.equal(officialPreferred[0].actualProvenance, "official");
assert.equal(officialPreferred[0].consensusProvenance, "mixed");

assert.equal(censusDurableGoodsActual({ change: "-1.2" }), "-1.2%", "Durable Goods actual must stay in the forecast's percentage dimension");
assert.equal(censusDurableGoodsActual(undefined), undefined);
assert.equal(censusRetailSalesActual({ change: "0.2" }), "0.2%", "Retail Sales actual must stay in the forecast's monthly percentage dimension");
assert.equal(censusRetailSalesActual(undefined), undefined);
assert.equal(parseCensusReleaseDateIso("June 25th, 2026"), "2026-06-25T00:00:00.000Z");
assert.equal(parseCensusReleaseDateIso("not a release date"), undefined);
assert.equal(isCensusDurableGoodsHeadline("Durable Goods Orders"), true);
assert.equal(isCensusDurableGoodsHeadline("Core Durable Goods Orders"), false);
assert.equal(isCensusDurableGoodsHeadline("Durable Goods Orders Ex Transportation"), false);
assert.equal(isCensusDurableGoodsHeadline("Durable Goods Orders Ex Transp MoM"), false);
assert.equal(isCensusDurableGoodsHeadline("Nondefense Capital Goods Orders"), false);
assert.equal(isCensusRetailSalesHeadline("Retail Sales MoM"), true);
assert.equal(isCensusRetailSalesHeadline("Core Retail Sales MoM"), false);
assert.equal(isCensusRetailSalesHeadline("Retail Sales Control Group MoM"), false);
assert.equal(isCensusRetailSalesHeadline("Retail Sales Ex Autos MoM"), false);

const stalenessNow = Date.parse("2026-07-22T12:00:00.000Z");
assert.equal(isStoredMacroPayloadStale("2026-07-22T11:01:00.000Z", stalenessNow), false);
assert.equal(isStoredMacroPayloadStale("2026-07-22T10:59:00.000Z", stalenessNow), true);
assert.deepEqual(
  selectLatestMacroGenerationRows([
    { id: "old", raw_payload: { syncGeneration: "2026-07-22T10:00:00.000Z" } },
    { id: "new-a", raw_payload: { syncGeneration: "2026-07-22T11:00:00.000Z" } },
    { id: "new-b", raw_payload: { syncGeneration: "2026-07-22T11:00:00.000Z" } }
  ]).map((row) => row.id),
  ["new-a", "new-b"],
  "a moved or canceled future event from an older sync generation cannot remain visible"
);
assert.equal(selectLatestMacroGenerationRows([{ id: "legacy", raw_payload: {} }]).length, 1, "legacy rows remain readable until the first generation-aware sync");

assert.equal(
  resolveMacroSourceTrust({
    source: "DOL",
    sourceUrl: "https://tradingeconomics.com/united-states/jobless-claims",
    itemOfficial: true,
    sourceType: "public_calendar"
  }).isOfficial,
  false,
  "a producer label cannot turn an aggregator calendar into an official source"
);
assert.equal(
  resolveMacroSourceTrust({
    source: "DOL",
    sourceUrl: "https://oui.doleta.gov/unemploy/claims.asp",
    itemOfficial: true,
    sourceType: "official_page"
  }).isOfficial,
  true
);
assert.equal(
  resolveMacroSourceTrust({
    source: "ForexFactory",
    sourceUrl: "https://www.forexfactory.com/calendar",
    sourceType: "public_calendar"
  }).isOfficial,
  false
);

const macroRouteSource = readFileSync("src/app/api/macro-calendar/route.ts", "utf8");
assert.match(macroRouteSource, /readStoredMacroCalendarPayload\(\{ allowStale: true \}\)/, "stale storage remains available as a refresh timeout fallback");
assert.match(macroRouteSource, /lastKnown: storedPayload/, "manual refresh also retains the last known calendar");
assert.match(
  macroRouteSource,
  /lastKnown[\s\S]*마지막 정상 일정을 유지합니다/,
  "an actual-refresh timeout must keep the latest stored calendar instead of replacing it with an old static fallback"
);
const macroTickerSource = readFileSync("src/components/MacroTicker.tsx", "utf8");
assert.match(macroTickerSource, /assessMacroImpact/, "Home and schedule use the provenance-aware tested impact assessment");
assert.match(macroTickerSource, /마지막 정상/, "stale calendar state is visible to the user");
assert.match(macroTickerSource, /isFallbackCalendar/, "fallback and stale calendars use different user-facing states");
assert.match(macroTickerSource, /!homePriorityAware && calendarWarningText/, "compact non-Home surfaces also disclose calendar warnings");
const censusSource = readFileSync("src/lib/macro/sourceAdapters/census.ts", "utf8");
assert.match(censusSource, /matchReleasedAt: homeSalesReleasedAt/, "Census release dates constrain matching without replacing the scheduled event time");
assert.match(censusSource, /indicators\.MARTS/, "Census MARTS is the official headline Retail Sales actual");
assert.match(censusSource, /matchReleasedAt: retailSalesReleasedAt/, "Retail Sales official actual is constrained to the matching Census release date");
assert.doesNotMatch(censusSource, /^\s*releasedAt: homeSalesReleasedAt/m, "Census date-only metadata must not become the market event timestamp");
const macroStoreSource = readFileSync("src/lib/macro/server/macroStore.ts", "utf8");
assert.match(macroStoreSource, /scheduled_at=gte\./, "stored calendar reads use an explicit recent window");
assert.match(macroStoreSource, /scheduled_at=lte\./, "stored calendar reads retain upcoming events without selecting the oldest rows forever");
assert.match(macroStoreSource, /payload\.cacheMode === "fallback"/, "operator fallback rows cannot overwrite the normal macro ledger");
assert.match(macroStoreSource, /syncGeneration/, "normal snapshots are stored as one logical generation");
assert.match(macroStoreSource, /method: "DELETE"/, "old macro rows receive bounded retention cleanup after a successful normal write");
const macroSyncSource = readFileSync("src/lib/macro/macroSync.ts", "utf8");
assert.match(macroSyncSource, /isFallback \? "degraded"/, "fallback sync runs are recorded as degraded rather than stored");
const macroCalendarSource = readFileSync("src/lib/macroCalendar.ts", "utf8");
assert.match(macroCalendarSource, /if \(sorted\.length === 0\) throw/, "an empty live result is degraded instead of storing static fallback rows as live data");
const normalizeSource = readFileSync("src/lib/macro/normalizeMacroEvent.ts", "utf8");
assert.match(
  normalizeSource,
  /enrichmentHasActual[\s\S]*item\.actualProvenance \?\? valueProvenance\(item\.sourceType, item\.isOfficial\)/,
  "an official schedule link must not promote a retained public-calendar actual to an official value"
);
assert.match(normalizeSource, /TradingEconomics/, "public consensus provider remains distinguishable from the official actual provider");
assert.match(normalizeSource, /consensusSourceUrl/, "public consensus source URL survives normalization");

fetchDolOfficialEnrichments([base], { nowMs: Date.parse("2026-07-22T00:00:00.000Z") })
  .then((futureOnlyEnrichments) => {
    assert.deepEqual(
      futureOnlyEnrichments,
      [],
      "the latest official DOL actual must not be copied onto a future claims release when no released row is present"
    );
    console.log("macro calendar semantic dedupe tests passed");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
