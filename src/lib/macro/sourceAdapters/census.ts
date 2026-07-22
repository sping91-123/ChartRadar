import { type MacroSourceEnrichment } from "@/lib/macro/types";

const CENSUS_ECONOMIC_INDICATORS_URL = "https://www.census.gov/economic-indicators/calendar-listview";
const CENSUS_NEW_HOME_SALES_URL = "https://www.census.gov/construction/nrs/current/index.html";
const CENSUS_DURABLE_GOODS_URL = "https://www.census.gov/manufacturing/m3/adv/current/index.html";
const DURABLE_GOODS_HEADLINE_MATCHER = /^(?!.*(?:\bcore\b|\bex(?:cluding)?\s+(?:transp(?:ortation)?|defen[cs]e)\b|\bexcluding\b|\bnondefense\b|\bcapital goods\b)).*durable goods/i;

type CensusIndicator = {
  value?: string;
  compValue?: string;
  statPeriod?: string;
  change?: string;
  comparisonStatPeriod?: string;
  brHighlight?: string;
  relDate?: string;
  pdf_link?: string;
  title_link?: string;
  unitsOfMeasure?: string;
};

function decodeHtml(value: string) {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&plusmn;/g, "+/-")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: { "user-agent": "ChartRadarBot/1.0 (+https://chartradar.kr)" },
    cache: "no-store"
  });
  if (!response.ok) return null;
  return response.text();
}

function parseIndicators(html: string | null) {
  if (!html) return {} as Record<string, CensusIndicator>;
  const match = /g_cidrOutput\s*=\s*(\{[\s\S]*?\});\s*<\/script>/i.exec(html);
  if (!match?.[1]) return {} as Record<string, CensusIndicator>;

  try {
    return JSON.parse(decodeHtml(match[1])) as Record<string, CensusIndicator>;
  } catch {
    return {} as Record<string, CensusIndicator>;
  }
}

function formatUnits(value: string | undefined, units?: string) {
  if (!value) return undefined;
  if (units === "UNITS") return `${Math.round(Number(value) / 1000)}K`;
  if (units === "BLN$") return `$${value}B`;
  return value;
}

function formatChange(value: string | undefined) {
  if (!value) return undefined;
  return `${value.endsWith("%") ? value : `${value}%`}`;
}

export function censusDurableGoodsActual(indicator: Pick<CensusIndicator, "change"> | undefined) {
  return formatChange(indicator?.change);
}

export function parseCensusReleaseDateIso(value: string | undefined) {
  if (!value) return undefined;
  const normalized = value.replace(/(\d{1,2})(?:st|nd|rd|th)\b/gi, "$1").trim();
  const ms = Date.parse(`${normalized} 00:00:00 UTC`);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : undefined;
}

export function isCensusDurableGoodsHeadline(label: string) {
  return DURABLE_GOODS_HEADLINE_MATCHER.test(label);
}

function indicatorActual(indicator: CensusIndicator | undefined) {
  if (!indicator) return undefined;
  const level = formatUnits(indicator.value, indicator.unitsOfMeasure);
  const change = formatChange(indicator.change);
  if (!level && !change) return undefined;
  return [level, change ? `${change} m/m` : undefined].filter(Boolean).join("; ");
}

export async function getCensusOfficialEnrichments(): Promise<MacroSourceEnrichment[]> {
  const html = await fetchText(CENSUS_ECONOMIC_INDICATORS_URL).catch(() => null);
  const indicators = parseIndicators(html);
  const homeSales = indicators.RESSALES;
  const durableGoods = indicators.M3ADV;
  const homeSalesReleasedAt = parseCensusReleaseDateIso(homeSales?.relDate);
  const durableGoodsReleasedAt = parseCensusReleaseDateIso(durableGoods?.relDate);
  const homeSalesActual = homeSalesReleasedAt ? indicatorActual(homeSales) : undefined;
  const durableGoodsActual = durableGoodsReleasedAt ? censusDurableGoodsActual(durableGoods) : undefined;
  const observedAt = new Date().toISOString();

  return [
    {
      matcher: /^(?!.*\b(?:mom|m\/m|month\s*over\s*month|change)\b).*(?:new home sales|new residential sales)/i,
      eventType: "numeric_release",
      source: "Census",
      sourceType: "official_page",
      sourceUrl: CENSUS_NEW_HOME_SALES_URL,
      officialUrl: CENSUS_NEW_HOME_SALES_URL,
      isOfficial: true,
      confidence: homeSalesActual ? 0.95 : 0.7,
      actualValue: homeSalesActual,
      actualProvenance: homeSalesActual ? "official" : undefined,
      actualProvider: "Census",
      actualSourceUrl: CENSUS_NEW_HOME_SALES_URL,
      actualReportingPeriod: homeSalesActual ? homeSales?.statPeriod : undefined,
      actualObservedAt: homeSalesActual ? observedAt : undefined,
      previousValue: formatUnits(homeSales?.compValue, homeSales?.unitsOfMeasure),
      previousProvenance: homeSales?.compValue ? "official" : undefined,
      unit: homeSales?.unitsOfMeasure === "UNITS" ? "K" : undefined,
      matchReleasedAt: homeSalesReleasedAt,
      staleReason: homeSalesActual ? undefined : "Census economic indicators page was reachable, but New Home Sales release date or actual value was not parsed.",
      rawPayload: homeSales
    },
    {
      matcher: DURABLE_GOODS_HEADLINE_MATCHER,
      eventType: "numeric_release",
      source: "Census",
      sourceType: "official_page",
      sourceUrl: CENSUS_DURABLE_GOODS_URL,
      officialUrl: CENSUS_DURABLE_GOODS_URL,
      isOfficial: true,
      confidence: durableGoodsActual ? 0.93 : 0.7,
      actualValue: durableGoodsActual,
      actualProvenance: durableGoodsActual ? "official" : undefined,
      actualProvider: "Census",
      actualSourceUrl: CENSUS_DURABLE_GOODS_URL,
      actualReportingPeriod: durableGoodsActual ? durableGoods?.statPeriod : undefined,
      actualObservedAt: durableGoodsActual ? observedAt : undefined,
      unit: "%",
      matchReleasedAt: durableGoodsReleasedAt,
      staleReason: durableGoodsActual ? undefined : "Census economic indicators page was reachable, but Durable Goods release date or monthly change was not parsed.",
      rawPayload: durableGoods
    }
  ];
}
