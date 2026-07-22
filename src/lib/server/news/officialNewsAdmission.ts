import type { NewsImportance, NewsMarket } from "../../newsImpact";

export type OfficialAdmissionReason =
  | "official_macro"
  | "monetary_policy"
  | "crypto_regulation"
  | "tracked_company"
  | "market_infrastructure"
  | "out_of_scope";

export interface OfficialNewsAdmission {
  accepted: boolean;
  reason: OfficialAdmissionReason;
  eventKind: string | null;
  markets: NewsMarket[];
  targets: Array<"btc" | "eth" | "global">;
  importance: NewsImportance;
  pushEligible: boolean;
  ruleVersion: "official-admission-v1";
}

export function officialRssPayloadFailure(input: {
  candidateCount: number;
  admittedCount: number;
  invalidAdmittedCount: number;
  malformedCount?: number;
}) {
  if (input.candidateCount === 0) return "official_rss_payload_empty";
  if ((input.malformedCount ?? 0) === input.candidateCount) return "official_rss_rows_invalid";
  if (input.admittedCount > 0 && input.invalidAdmittedCount === input.admittedCount) {
    return "official_rss_all_admitted_items_invalid";
  }
  if (input.invalidAdmittedCount > 0) return "official_rss_admitted_item_invalid";
  return null;
}

const cryptoTerms = /\b(bitcoin|btc|ether|ethereum|eth|crypto|digital asset|stablecoin|blockchain|virtual currenc(?:y|ies)|tokenized?|spot (?:bitcoin|ether) etf)\b/i;
const trackedCompanyTerms = /\b(nvidia|tesla|apple|microsoft|amazon|meta platforms|alphabet|google|broadcom|nvda|tsla|aapl|msft|amzn|meta|googl|avgo)\b/i;
const marketInfrastructureTerms = /\b(market structure|securities exchange|national market system|clearing|clearinghouse|central counterparty|margin requirement|position limit|trading halt|market disruption|systemic risk|swap dealer|derivatives market|futures market|short sale)\b/i;
const criticalTerms = /\b(emergency|systemic|market disruption|trading halt|extraordinary|financial stability)\b/i;

function rejected(): OfficialNewsAdmission {
  return {
    accepted: false,
    reason: "out_of_scope",
    eventKind: null,
    markets: [],
    targets: [],
    importance: "normal",
    pushEligible: false,
    ruleVersion: "official-admission-v1"
  };
}

function accepted(input: Omit<OfficialNewsAdmission, "accepted" | "ruleVersion">): OfficialNewsAdmission {
  return { accepted: true, ruleVersion: "official-admission-v1", ...input };
}

function fedEventKind(text: string) {
  if (/\bminutes\b.*\bdiscount rate\b|\bdiscount rate\b.*\bminutes\b/i.test(text)) return "fed_discount_rate_minutes";
  if (/\b(fomc|federal open market committee)\b.*\bminutes\b|\bminutes\b.*\b(fomc|federal open market committee)\b/i.test(text)) return "fomc_minutes";
  if (/\bimplementation note\b/i.test(text)) return "fomc_implementation_note";
  if (/\b(fomc statement|monetary policy statement|federal funds rate|interest rate decision|target range|discount rate|balance sheet|open market operation|quantitative (?:tightening|easing))\b/i.test(text)) return "fomc_policy_statement";
  if (/\b(emergency facility|liquidity facility|market functioning|financial stability|stress test|systemic risk)\b/i.test(text)) return "financial_stability_action";
  return null;
}

export function admitOfficialNews(input: {
  sourceId: string;
  title: string;
  structuredPayload?: Record<string, unknown>;
}): OfficialNewsAdmission {
  const text = input.title.replace(/\s+/g, " ").trim();
  if (!text) return rejected();

  if (input.sourceId === "macro_official_store") {
    return accepted({
      reason: "official_macro",
      eventKind: "official_macro_release",
      markets: ["crypto", "global"],
      targets: ["btc", "eth", "global"],
      importance: "high",
      pushEligible: true
    });
  }

  if (input.sourceId === "fed_press_releases") {
    const eventKind = fedEventKind(text);
    if (!eventKind) return rejected();
    return accepted({
      reason: "monetary_policy",
      eventKind,
      markets: ["crypto", "global"],
      targets: ["btc", "eth", "global"],
      importance: criticalTerms.test(text) ? "critical" : "high",
      pushEligible: true
    });
  }

  if (input.sourceId === "sec_edgar_tracked") {
    const form = typeof input.structuredPayload?.form === "string" ? input.structuredPayload.form : "filing";
    return accepted({
      reason: "tracked_company",
      eventKind: `sec_filing_${form.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
      markets: ["global"],
      targets: ["global"],
      importance: form === "8-K" || form === "6-K" ? "high" : "normal",
      pushEligible: false
    });
  }

  if (input.sourceId === "sec_press_releases") {
    const isCrypto = cryptoTerms.test(text);
    const isTracked = trackedCompanyTerms.test(text);
    const isInfrastructure = marketInfrastructureTerms.test(text);
    if (!isCrypto && !isTracked && !isInfrastructure) return rejected();
    const markets: NewsMarket[] = [...(isCrypto ? ["crypto" as const] : []), ...(isTracked || isInfrastructure ? ["global" as const] : [])];
    return accepted({
      reason: isCrypto ? "crypto_regulation" : isInfrastructure ? "market_infrastructure" : "tracked_company",
      eventKind: isCrypto ? "us_crypto_regulation" : isInfrastructure ? "us_market_infrastructure" : "sec_tracked_company",
      markets,
      targets: [...(isCrypto ? ["btc" as const, "eth" as const] : []), ...(isTracked || isInfrastructure ? ["global" as const] : [])],
      importance: criticalTerms.test(text) ? "critical" : isTracked && !isInfrastructure ? "normal" : "high",
      pushEligible: isCrypto || isInfrastructure
    });
  }

  if (input.sourceId === "cftc_releases") {
    const isCrypto = cryptoTerms.test(text);
    const isInfrastructure = marketInfrastructureTerms.test(text);
    if (!isCrypto && !isInfrastructure) return rejected();
    return accepted({
      reason: isCrypto ? "crypto_regulation" : "market_infrastructure",
      eventKind: isCrypto ? "us_crypto_regulation" : "us_market_infrastructure",
      markets: [...(isCrypto ? ["crypto" as const] : []), ...(isInfrastructure ? ["global" as const] : [])],
      targets: [...(isCrypto ? ["btc" as const, "eth" as const] : []), ...(isInfrastructure ? ["global" as const] : [])],
      importance: criticalTerms.test(text) ? "critical" : "high",
      pushEligible: true
    });
  }

  return rejected();
}

export function isPushEligibleOfficialAdmission(value: unknown) {
  return value === true;
}
