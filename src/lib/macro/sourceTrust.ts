import { type MacroSourceType } from "@/lib/macro/types";

const officialMacroSources = new Set(["BLS", "BEA", "Fed", "Census", "DOL", "NAR", "Official"]);
const officialMacroHosts = [
  "bls.gov",
  "bea.gov",
  "federalreserve.gov",
  "census.gov",
  "dol.gov",
  "doleta.gov",
  "nar.realtor"
];

function officialUrl(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return undefined;
    const host = url.hostname.toLowerCase();
    return officialMacroHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`)) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function resolveMacroSourceTrust(input: {
  source: string;
  sourceUrl?: string;
  officialUrl?: string;
  enrichmentOfficial?: boolean;
  itemOfficial?: boolean;
  sourceType?: MacroSourceType;
}) {
  const trustedUrl = officialUrl(input.officialUrl) ?? officialUrl(input.sourceUrl);
  const declaredOfficial = input.enrichmentOfficial ?? input.itemOfficial ?? officialMacroSources.has(input.source);
  const typeAllowsOfficial = !input.sourceType || input.sourceType === "official_api" || input.sourceType === "official_page";
  const isOfficial = Boolean(declaredOfficial && typeAllowsOfficial && trustedUrl);
  return {
    isOfficial,
    officialUrl: isOfficial ? trustedUrl : undefined
  };
}
