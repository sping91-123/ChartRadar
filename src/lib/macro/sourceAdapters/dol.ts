import { XMLParser } from "fast-xml-parser";

import { type MacroEventItem } from "@/data/macroEvents";
import { type MacroSourceEnrichment } from "@/lib/macro/types";

const DOL_CLAIMS_PAGE_URL = "https://oui.doleta.gov/unemploy/claims.asp";
const DOL_CLAIMS_REPORT_URL = "https://oui.doleta.gov/unemploy/wkclaims/report.asp";
const JOBLESS_CLAIMS_MATCHER =
  /신규\s*실업수당\s*청구|initial\s+jobless\s+claims|initial\s+claims|jobless\s+claims|unemployment\s+claims|unemployment\s+insurance\s+weekly\s+claims|continuing\s+claims/i;

type DolClaimsWeek = {
  weekEndedIso: string;
  weekEndedMs: number;
  initialClaimsSa: number | null;
  initialClaimsNsa: number | null;
  initialClaimsFourWeekAverage: number | null;
  continuedClaimsSa: number | null;
};

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

function formatClaimsK(value: number | null) {
  if (value === null) return undefined;
  return `${Math.round(value / 1000)}K`;
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

function expectedWeekEndedMs(releaseAt: string) {
  const releaseMs = Date.parse(releaseAt);
  if (!Number.isFinite(releaseMs)) return null;
  const date = new Date(releaseMs);
  date.setUTCDate(date.getUTCDate() - 5);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
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

function baseEnrichment(staleReason?: string): MacroSourceEnrichment {
  return {
    matcher: JOBLESS_CLAIMS_MATCHER,
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

function targetJoblessItems(items: MacroEventItem[]) {
  return items.filter((item) => JOBLESS_CLAIMS_MATCHER.test(`${item.label} ${item.title ?? ""}`));
}

function selectReleasedTarget(items: MacroEventItem[]) {
  const now = Date.now();
  return targetJoblessItems(items)
    .filter((item) => Date.parse(item.releaseAt) <= now)
    .sort((a, b) => Date.parse(b.releaseAt) - Date.parse(a.releaseAt))[0];
}

export async function fetchDolOfficialEnrichments(items: MacroEventItem[]): Promise<MacroSourceEnrichment[]> {
  const targetItems = targetJoblessItems(items);
  if (targetItems.length === 0) return [];

  const target = selectReleasedTarget(items);
  const years = new Set<number>([new Date().getUTCFullYear()]);

  for (const item of targetItems) {
    const scheduledMs = Date.parse(item.releaseAt);
    if (Number.isFinite(scheduledMs)) years.add(new Date(scheduledMs).getUTCFullYear());
  }

  try {
    const weeks = (await Promise.all(Array.from(years).map((year) => fetchDolClaimsWeeks(year)))).flat();
    const weeksWithActual = weeks.filter((week) => week.initialClaimsSa !== null);
    const latestWeek = weeksWithActual.at(-1);
    if (!latestWeek) {
      return [baseEnrichment("DOL official weekly claims data did not return a usable latest week.")];
    }

    const expectedWeek = target ? expectedWeekEndedMs(target.releaseAt) : null;
    const matchedWeek = weeksWithActual.find((week) => sameUtcDate(week.weekEndedMs, expectedWeek)) ?? latestWeek;
    const previousWeek = weeksWithActual.filter((week) => week.weekEndedMs < matchedWeek.weekEndedMs).at(-1);
    const actualValue = formatClaimsK(matchedWeek.initialClaimsSa);

    if (!actualValue) {
      return [baseEnrichment("DOL official weekly claims data was available, but the seasonally adjusted actual value was not parsed.")];
    }

    return [
      {
        ...baseEnrichment(),
        sourceType: "official_api",
        officialUrl: DOL_CLAIMS_REPORT_URL,
        actualValue,
        previousValue: formatClaimsK(previousWeek?.initialClaimsSa ?? null),
        unit: "K",
        releasedAt: target?.releaseAt,
        confidence: sameUtcDate(matchedWeek.weekEndedMs, expectedWeek) ? 0.95 : 0.86,
        rawPayload: {
          weekEndedIso: matchedWeek.weekEndedIso,
          initialClaimsSa: matchedWeek.initialClaimsSa,
          initialClaimsNsa: matchedWeek.initialClaimsNsa,
          initialClaimsFourWeekAverage: matchedWeek.initialClaimsFourWeekAverage,
          continuedClaimsSa: matchedWeek.continuedClaimsSa
        }
      }
    ];
  } catch (error) {
    return [
      baseEnrichment(
        error instanceof Error
          ? `DOL official weekly claims fetch failed: ${error.message}`
          : "DOL official weekly claims fetch failed."
      )
    ];
  }
}
