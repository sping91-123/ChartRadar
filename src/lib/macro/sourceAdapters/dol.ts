import { XMLParser } from "fast-xml-parser";

import { type MacroEventItem } from "@/data/macroEvents";
import { type MacroSourceEnrichment } from "@/lib/macro/types";

const DOL_CLAIMS_PAGE_URL = "https://oui.doleta.gov/unemploy/claims.asp";
const DOL_CLAIMS_REPORT_URL = "https://oui.doleta.gov/unemploy/wkclaims/report.asp";
const INITIAL_CLAIMS_MATCHER =
  /^(?!.*(?:continuing|continued|계속\s*실업수당|4[-\s]?week|four[-\s]?week|4주)).*(?:신규\s*실업수당\s*청구|initial\s+jobless\s+claims|initial\s+claims|jobless\s+claims|unemployment\s+claims|unemployment\s+insurance\s+weekly\s+claims)/i;
const CONTINUING_CLAIMS_MATCHER = /continuing\s+(?:jobless\s+|unemployment\s+)?claims|continued\s+claims|계속\s*실업수당/i;
const FOUR_WEEK_AVERAGE_CLAIMS_MATCHER = /(?:4[-\s]?week|four[-\s]?week|4주).*(?:average|평균).*(?:claims|실업수당)|(?:claims|실업수당).*(?:4[-\s]?week|four[-\s]?week|4주).*(?:average|평균)/i;

export type DolClaimsKind = "initial" | "continuing" | "four_week_average";

type DolClaimsWeek = {
  weekEndedIso: string;
  weekEndedMs: number;
  initialClaimsSa: number | null;
  initialClaimsNsa: number | null;
  initialClaimsFourWeekAverage: number | null;
  continuedClaimsSa: number | null;
};

export function dolClaimsValueForKind(
  kind: DolClaimsKind,
  week: Pick<DolClaimsWeek, "initialClaimsSa" | "continuedClaimsSa" | "initialClaimsFourWeekAverage">
) {
  if (kind === "initial") return week.initialClaimsSa;
  if (kind === "continuing") return week.continuedClaimsSa;
  return week.initialClaimsFourWeekAverage;
}

const parser = new XMLParser({
  ignoreAttributes: true,
  trimValues: true
});

function toArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function parseClaimsNumber(value: unknown) {
  const normalized = String(value ?? "").replace(/,/g, "").trim();
  if (!normalized) return null;
  const numberValue = Number(normalized);
  return Number.isFinite(numberValue) ? numberValue : null;
}

export function formatDolClaimsK(value: number | null) {
  if (value === null) return undefined;
  const thousands = value / 1000;
  const precise = Number(thousands.toFixed(2));
  return `${precise.toLocaleString("en-US", { maximumFractionDigits: 2 })}K`;
}

function parseDolDate(value: unknown) {
  const text = String(value ?? "").trim();
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (!match) return null;

  const [, month, day, year] = match;
  const ms = Date.UTC(Number(year), Number(month) - 1, Number(day));
  if (!Number.isFinite(ms)) return null;

  return {
    iso: new Date(ms).toISOString(),
    ms
  };
}

function previousSaturdayMs(releaseAt: string) {
  const releaseMs = Date.parse(releaseAt);
  if (!Number.isFinite(releaseMs)) return null;
  const date = new Date(releaseMs);
  const daysSinceSaturday = (date.getUTCDay() + 1) % 7 || 7;
  date.setUTCDate(date.getUTCDate() - daysSinceSaturday);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function expectedDolWeekEndedIso(kind: DolClaimsKind, releaseAt: string) {
  const initialWeekMs = previousSaturdayMs(releaseAt);
  if (initialWeekMs === null) return null;
  const expectedMs = kind === "continuing" ? initialWeekMs - 7 * 24 * 60 * 60 * 1000 : initialWeekMs;
  return new Date(expectedMs).toISOString();
}

function sameUtcDate(a: number | null, b: number | null) {
  return a !== null && b !== null && a === b;
}

function mapDolWeek(rawWeek: Record<string, unknown>): DolClaimsWeek | null {
  const weekEnded = parseDolDate(rawWeek.weekEnded);
  const initialClaims = rawWeek.InitialClaims as Record<string, unknown> | undefined;
  const continuedClaims = rawWeek.ContinuedClaims as Record<string, unknown> | undefined;
  if (!weekEnded || !initialClaims) return null;

  return {
    weekEndedIso: weekEnded.iso,
    weekEndedMs: weekEnded.ms,
    initialClaimsSa: parseClaimsNumber(initialClaims.SA),
    initialClaimsNsa: parseClaimsNumber(initialClaims.NSA),
    initialClaimsFourWeekAverage: parseClaimsNumber(initialClaims.SA4WK),
    continuedClaimsSa: parseClaimsNumber(continuedClaims?.SA)
  };
}

async function fetchDolClaimsWeeks(year: number) {
  const body = new URLSearchParams({
    level: "us",
    strtdate: String(year),
    enddate: String(year),
    filetype: "xml",
    submit: "Submit"
  });

  const response = await fetch(DOL_CLAIMS_REPORT_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": "ChartRadarBot/1.0 (+https://chartradar.ai)"
    },
    body,
    cache: "no-store"
  });

  if (!response.ok) throw new Error(`DOL claims report ${response.status}`);

  const parsed = parser.parse(await response.text()) as {
    r539cyNational?: { week?: Record<string, unknown> | Record<string, unknown>[] };
  };
  const weeks = toArray(parsed.r539cyNational?.week)
    .map(mapDolWeek)
    .filter((week): week is DolClaimsWeek => Boolean(week))
    .sort((a, b) => a.weekEndedMs - b.weekEndedMs);

  return weeks;
}

function claimsMatcher(kind: DolClaimsKind) {
  if (kind === "initial") return INITIAL_CLAIMS_MATCHER;
  if (kind === "continuing") return CONTINUING_CLAIMS_MATCHER;
  return FOUR_WEEK_AVERAGE_CLAIMS_MATCHER;
}

function baseEnrichment(kind: DolClaimsKind, staleReason?: string): MacroSourceEnrichment {
  return {
    matcher: claimsMatcher(kind),
    eventType: "numeric_release",
    source: "DOL",
    sourceType: "official_page",
    sourceUrl: DOL_CLAIMS_PAGE_URL,
    officialUrl: DOL_CLAIMS_PAGE_URL,
    isOfficial: true,
    confidence: 0.72,
    staleReason
  };
}

function targetJoblessItems(items: MacroEventItem[], kind: DolClaimsKind) {
  const matcher = claimsMatcher(kind);
  return items.filter((item) => matcher.test(`${item.label} ${item.title ?? ""}`));
}

function selectReleasedTarget(items: MacroEventItem[], kind: DolClaimsKind, nowMs: number) {
  return targetJoblessItems(items, kind)
    .filter((item) => Date.parse(item.releaseAt) <= nowMs)
    .sort((a, b) => Date.parse(b.releaseAt) - Date.parse(a.releaseAt))[0];
}

export async function fetchDolOfficialEnrichments(
  items: MacroEventItem[],
  options: { nowMs?: number } = {}
): Promise<MacroSourceEnrichment[]> {
  const nowMs = options.nowMs ?? Date.now();
  const requestedKinds = (["initial", "continuing", "four_week_average"] as const).filter((kind) => targetJoblessItems(items, kind).length > 0);
  if (requestedKinds.length === 0) return [];
  const releasedKinds = requestedKinds.filter((kind) => Boolean(selectReleasedTarget(items, kind, nowMs)));
  // The DOL file contains the latest published week, not a forecast for a future release.
  // Without a released row to bind it to, copying that value would contaminate the next event.
  if (releasedKinds.length === 0) return [];

  const years = new Set<number>([new Date(nowMs).getUTCFullYear()]);

  for (const kind of requestedKinds) {
    for (const item of targetJoblessItems(items, kind)) {
      const scheduledMs = Date.parse(item.releaseAt);
      if (Number.isFinite(scheduledMs)) years.add(new Date(scheduledMs).getUTCFullYear());
      const reportingPeriod = expectedDolWeekEndedIso(kind, item.releaseAt);
      if (reportingPeriod) years.add(new Date(reportingPeriod).getUTCFullYear());
    }
  }

  try {
    const weeks = (await Promise.all(Array.from(years).map((year) => fetchDolClaimsWeeks(year)))).flat();
    const observedAt = new Date().toISOString();
    const enrichments = releasedKinds.map((kind) => {
      const target = selectReleasedTarget(items, kind, nowMs);
      const weeksWithActual = weeks.filter((week) => dolClaimsValueForKind(kind, week) !== null);
      const latestWeek = weeksWithActual.at(-1);
      if (!latestWeek) return null;

      const expectedWeekIso = target ? expectedDolWeekEndedIso(kind, target.releaseAt) : null;
      const expectedWeek = expectedWeekIso ? Date.parse(expectedWeekIso) : null;
      const matchedWeek = weeksWithActual.find((week) => sameUtcDate(week.weekEndedMs, expectedWeek));
      if (!matchedWeek) return null;
      const previousWeek = weeksWithActual.filter((week) => week.weekEndedMs < matchedWeek.weekEndedMs).at(-1);
      const actualValue = formatDolClaimsK(dolClaimsValueForKind(kind, matchedWeek));
      if (!actualValue) return null;
      const previousValue = formatDolClaimsK(previousWeek ? dolClaimsValueForKind(kind, previousWeek) : null);

      return {
        ...baseEnrichment(kind),
        sourceType: "official_api" as const,
        officialUrl: DOL_CLAIMS_REPORT_URL,
        actualValue,
        actualProvenance: "official" as const,
        actualProvider: "DOL" as const,
        actualSourceUrl: DOL_CLAIMS_REPORT_URL,
        actualReportingPeriod: matchedWeek.weekEndedIso,
        actualObservedAt: observedAt,
        previousValue,
        previousProvenance: previousValue ? "official" as const : undefined,
        unit: "K",
        releasedAt: target?.releaseAt,
        confidence: 0.95,
        rawPayload: {
          kind,
          weekEndedIso: matchedWeek.weekEndedIso,
          initialClaimsSa: matchedWeek.initialClaimsSa,
          initialClaimsNsa: matchedWeek.initialClaimsNsa,
          initialClaimsFourWeekAverage: matchedWeek.initialClaimsFourWeekAverage,
          continuedClaimsSa: matchedWeek.continuedClaimsSa
        }
      };
    });
    return enrichments.filter(
      (enrichment): enrichment is NonNullable<(typeof enrichments)[number]> => enrichment !== null
    );
  } catch (error) {
    void error;
    return [];
  }
}
