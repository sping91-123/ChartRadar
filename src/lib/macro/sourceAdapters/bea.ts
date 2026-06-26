import { type MacroSourceEnrichment } from "@/lib/macro/types";

const BEA_GDP_RELEASE_URL = "https://www.bea.gov/news/2026/gdp-second-estimate-and-corporate-profits-1st-quarter-2026";
const BEA_PIO_RELEASE_SCHEDULE_URL = "https://www.bea.gov/news/schedule";
const BEA_MONTH_SLUGS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december"
] as const;

type OfficialRelease = {
  url: string;
  text: string;
};

function compactText(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchOfficialText(url: string) {
  const response = await fetch(url, {
    headers: { "user-agent": "ChartRadarBot/1.0 (+https://chartradar.kr)" },
    cache: "no-store"
  });
  if (!response.ok) return null;
  return compactText(await response.text());
}

async function fetchFirstOfficialRelease(urls: string[]): Promise<OfficialRelease | null> {
  for (const url of urls) {
    const text = await fetchOfficialText(url).catch(() => null);
    if (text && /Personal Income and Outlays,/i.test(text)) return { url, text };
  }
  return null;
}

function personalIncomeReleaseCandidates(now = new Date()) {
  return Array.from({ length: 4 }, (_, offset) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    const year = date.getUTCFullYear();
    const month = BEA_MONTH_SLUGS[date.getUTCMonth()];
    return `https://www.bea.gov/news/${year}/personal-income-and-outlays-${month}-${year}`;
  });
}

function parseBeaReleaseAt(text: string | null) {
  if (!text) return undefined;
  const match = /RELEASE AT 8:30 a\.m\. (EDT|EST), [A-Za-z]+, ([A-Za-z]+) (\d{1,2}), (\d{4})/i.exec(text);
  if (!match) return undefined;

  const monthIndex = BEA_MONTH_SLUGS.findIndex((month) => month.toLowerCase() === match[2].toLowerCase());
  const day = Number(match[3]);
  const year = Number(match[4]);
  if (monthIndex < 0 || !Number.isFinite(day) || !Number.isFinite(year)) return undefined;

  const utcHour = match[1].toUpperCase() === "EST" ? 13 : 12;
  return new Date(Date.UTC(year, monthIndex, day, utcHour, 30)).toISOString();
}

function matchPercent(text: string, pattern: RegExp) {
  const match = pattern.exec(text);
  return match?.[1] ? `${match[1]}%` : undefined;
}

function buildGdpEnrichments(text: string | null): MacroSourceEnrichment[] {
  const realGdp = text ? matchPercent(text, /Real gross domestic product \(GDP\) increased at an annual rate of ([+-]?\d+(?:\.\d+)?) percent/i) : undefined;
  const purchasePriceIndex = text ? matchPercent(text, /gross domestic purchases increased ([+-]?\d+(?:\.\d+)?) percent/i) : undefined;
  const corporateProfits = text ? /\$([+-]?\d+(?:\.\d+)?) billion in the first quarter/i.exec(text)?.[1] : undefined;

  const base = {
    eventType: "numeric_release" as const,
    source: "BEA" as const,
    sourceType: "official_page" as const,
    sourceUrl: BEA_GDP_RELEASE_URL,
    officialUrl: BEA_GDP_RELEASE_URL,
    isOfficial: true,
    confidence: realGdp ? 0.96 : 0.72
  };

  return [
    {
      ...base,
      matcher: /gdp price index|gross domestic purchases price index/i,
      actualValue: purchasePriceIndex ? `GDP price index ${purchasePriceIndex}` : undefined,
      unit: "%",
      staleReason: purchasePriceIndex ? undefined : "BEA GDP release page was reachable, but GDP price index was not parsed."
    },
    {
      ...base,
      matcher: /gdp|gross domestic product|corporate profits|prelim gdp/i,
      actualValue: realGdp ? `Real GDP ${realGdp} SAAR${corporateProfits ? `; corporate profits +$${corporateProfits}B` : ""}` : undefined,
      unit: "%",
      staleReason: realGdp ? undefined : "BEA GDP release page was reachable, but the real GDP actual value was not parsed."
    }
  ];
}

function buildPersonalIncomeEnrichments(release: OfficialRelease | null): MacroSourceEnrichment[] {
  const text = release?.text ?? null;
  const personalIncome = text ? matchPercent(text, /Current-dollar personal income\s+[+-]?\d+(?:\.\d+)?\s+([+-]?\d+(?:\.\d+)?)/i) : undefined;
  const pce = text ? matchPercent(text, /Current-dollar PCE\s+[+-]?\d+(?:\.\d+)?\s+([+-]?\d+(?:\.\d+)?)/i) : undefined;
  const pcePrice = text ? matchPercent(text, /PCE price index for [A-Za-z]+ increased ([+-]?\d+(?:\.\d+)?) percent/i) : undefined;
  const pcePriceYoy = text ? matchPercent(text, /From the same month one year ago, the PCE price index for [A-Za-z]+ increased ([+-]?\d+(?:\.\d+)?) percent/i) : undefined;
  const corePce = text ? matchPercent(text, /Excluding food and energy, the PCE price index increased ([+-]?\d+(?:\.\d+)?) percent/i) : undefined;
  const corePceYoy = text ? matchPercent(text, /Excluding food and energy, the PCE price index increased ([+-]?\d+(?:\.\d+)?) percent from one year ago/i) : undefined;
  const releaseAt = parseBeaReleaseAt(text);

  const base = {
    eventType: "numeric_release" as const,
    source: "BEA" as const,
    sourceType: "official_page" as const,
    sourceUrl: release?.url ?? BEA_PIO_RELEASE_SCHEDULE_URL,
    officialUrl: release?.url,
    isOfficial: true,
    confidence: text ? 0.96 : 0.72,
    unit: "%",
    releasedAt: releaseAt
  };

  return [
    {
      ...base,
      matcher: /core pce.*(?:m\/m|mom|month)|(?:m\/m|mom|month).*core pce|pce price index excluding food and energy.*(?:m\/m|mom|month)/i,
      actualValue: corePce ? `Core PCE ${corePce} m/m` : undefined,
      staleReason: corePce ? undefined : "BEA Personal Income and Outlays release page was reachable, but core PCE was not parsed."
    },
    {
      ...base,
      matcher: /core pce.*(?:y\/y|yoy|year)|(?:y\/y|yoy|year).*core pce|pce price index excluding food and energy.*(?:y\/y|yoy|year)/i,
      actualValue: corePceYoy ? `Core PCE ${corePceYoy} y/y` : undefined,
      staleReason: corePceYoy ? undefined : "BEA Personal Income and Outlays release page was reachable, but core PCE year-over-year value was not parsed."
    },
    {
      ...base,
      matcher: /core pce|pce price index excluding food and energy/i,
      actualValue: corePce ? `Core PCE ${corePce} m/m${corePceYoy ? `, ${corePceYoy} y/y` : ""}` : undefined,
      staleReason: corePce ? undefined : "BEA Personal Income and Outlays release page was reachable, but core PCE was not parsed."
    },
    {
      ...base,
      matcher: /pce price index.*(?:m\/m|mom|month)|(?:m\/m|mom|month).*pce price index|pce prices.*(?:m\/m|mom|month)|pce deflator.*(?:m\/m|mom|month)/i,
      actualValue: pcePrice ? `PCE ${pcePrice} m/m` : undefined,
      staleReason: pcePrice ? undefined : "BEA Personal Income and Outlays release page was reachable, but PCE price index was not parsed."
    },
    {
      ...base,
      matcher: /pce price index.*(?:y\/y|yoy|year)|(?:y\/y|yoy|year).*pce price index|pce prices.*(?:y\/y|yoy|year)|pce deflator.*(?:y\/y|yoy|year)/i,
      actualValue: pcePriceYoy ? `PCE ${pcePriceYoy} y/y` : undefined,
      staleReason: pcePriceYoy ? undefined : "BEA Personal Income and Outlays release page was reachable, but PCE price index year-over-year value was not parsed."
    },
    {
      ...base,
      matcher: /pce price index|pce prices|pce deflator/i,
      actualValue: pcePrice ? `PCE ${pcePrice} m/m${pcePriceYoy ? `, ${pcePriceYoy} y/y` : ""}` : undefined,
      staleReason: pcePrice ? undefined : "BEA Personal Income and Outlays release page was reachable, but PCE price index was not parsed."
    },
    {
      ...base,
      matcher: /personal income/i,
      actualValue: personalIncome ? `Personal income ${personalIncome} m/m` : undefined,
      staleReason: personalIncome ? undefined : "BEA Personal Income and Outlays release page was reachable, but personal income was not parsed."
    },
    {
      ...base,
      matcher: /personal spending|personal outlays|consumer spending/i,
      actualValue: pce ? `Personal spending ${pce} m/m` : undefined,
      staleReason: pce ? undefined : "BEA Personal Income and Outlays release page was reachable, but personal spending was not parsed."
    }
  ];
}

export async function getBeaOfficialEnrichments(): Promise<MacroSourceEnrichment[]> {
  const [gdpText, pioRelease] = await Promise.all([
    fetchOfficialText(BEA_GDP_RELEASE_URL).catch(() => null),
    fetchFirstOfficialRelease(personalIncomeReleaseCandidates()).catch(() => null)
  ]);

  const enrichments = [...buildGdpEnrichments(gdpText), ...buildPersonalIncomeEnrichments(pioRelease)];
  if (enrichments.some((item) => item.actualValue)) return enrichments;

  return [
    {
      matcher: /gdp|gross domestic product|pce|personal income|personal spending/i,
      eventType: "numeric_release",
      source: "BEA",
      sourceType: "official_page",
      sourceUrl: "https://www.bea.gov/news/schedule",
      officialUrl: undefined,
      isOfficial: true,
      confidence: 0.72,
      staleReason: "BEA official release pages were checked, but actual values were not parsed."
    }
  ];
}
