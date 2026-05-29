import { type MacroSourceEnrichment } from "@/lib/macro/types";

const BEA_GDP_RELEASE_URL = "https://www.bea.gov/news/2026/gdp-second-estimate-and-corporate-profits-1st-quarter-2026";
const BEA_PIO_RELEASE_URL = "https://www.bea.gov/news/2026/personal-income-and-outlays-april-2026";

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

function buildPersonalIncomeEnrichments(text: string | null): MacroSourceEnrichment[] {
  const personalIncome = text ? matchPercent(text, /Current-dollar personal income\s+[+-]?\d+(?:\.\d+)?\s+([+-]?\d+(?:\.\d+)?)/i) : undefined;
  const pce = text ? matchPercent(text, /Current-dollar PCE\s+[+-]?\d+(?:\.\d+)?\s+([+-]?\d+(?:\.\d+)?)/i) : undefined;
  const pcePrice = text ? matchPercent(text, /PCE price index for April increased ([+-]?\d+(?:\.\d+)?) percent/i) : undefined;
  const corePce = text ? matchPercent(text, /Excluding food and energy, the PCE price index increased ([+-]?\d+(?:\.\d+)?) percent/i) : undefined;
  const corePceYoy = text ? matchPercent(text, /Excluding food and energy, the PCE price index increased ([+-]?\d+(?:\.\d+)?) percent from one year ago/i) : undefined;

  const base = {
    eventType: "numeric_release" as const,
    source: "BEA" as const,
    sourceType: "official_page" as const,
    sourceUrl: BEA_PIO_RELEASE_URL,
    officialUrl: BEA_PIO_RELEASE_URL,
    isOfficial: true,
    confidence: text ? 0.96 : 0.72,
    unit: "%"
  };

  return [
    {
      ...base,
      matcher: /core pce|pce price index/i,
      actualValue: corePce ? `Core PCE ${corePce} m/m${corePceYoy ? `, ${corePceYoy} y/y` : ""}${pcePrice ? `; PCE ${pcePrice} m/m` : ""}` : undefined,
      staleReason: corePce ? undefined : "BEA Personal Income and Outlays release page was reachable, but core PCE was not parsed."
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
  const [gdpText, pioText] = await Promise.all([
    fetchOfficialText(BEA_GDP_RELEASE_URL).catch(() => null),
    fetchOfficialText(BEA_PIO_RELEASE_URL).catch(() => null)
  ]);

  const enrichments = [...buildGdpEnrichments(gdpText), ...buildPersonalIncomeEnrichments(pioText)];
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
