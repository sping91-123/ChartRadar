import type { NewsMarket, NewsSourcePolicyStatus } from "@/lib/newsImpact";

export interface NewsSourceDefinition {
  id: string;
  name: string;
  markets: NewsMarket[];
  adapter: "macro_store" | "rss" | "edgar" | "disabled_media";
  endpoint: string | null;
  policyStatus: NewsSourcePolicyStatus;
  termsUrl: string;
  reviewedAt: string;
  maxRequestsPerSecond: number;
  timeoutMs: number;
  allowedHosts: readonly string[];
}

export const newsSourceCatalog: readonly NewsSourceDefinition[] = [
  {
    id: "macro_official_store",
    name: "ChartRadar 공식 매크로 원장",
    markets: ["crypto", "global"],
    adapter: "macro_store",
    endpoint: null,
    policyStatus: "allowed",
    termsUrl: "https://www.bls.gov/developers/",
    reviewedAt: "2026-07-20",
    maxRequestsPerSecond: 1,
    timeoutMs: 8_000,
    allowedHosts: ["bls.gov", "bea.gov", "federalreserve.gov", "census.gov", "dol.gov", "doleta.gov"]
  },
  {
    id: "fed_press_releases",
    name: "Federal Reserve",
    markets: ["crypto", "global"],
    adapter: "rss",
    endpoint: "https://www.federalreserve.gov/feeds/press_all.xml",
    policyStatus: "allowed",
    termsUrl: "https://www.federalreserve.gov/feeds/feeds.htm",
    reviewedAt: "2026-07-20",
    maxRequestsPerSecond: 1,
    timeoutMs: 8_000,
    allowedHosts: ["federalreserve.gov"]
  },
  {
    id: "sec_press_releases",
    name: "U.S. SEC",
    markets: ["crypto", "global"],
    adapter: "rss",
    endpoint: "https://www.sec.gov/news/pressreleases.rss",
    policyStatus: "allowed",
    termsUrl: "https://www.sec.gov/about/developer-resources",
    reviewedAt: "2026-07-20",
    maxRequestsPerSecond: 2,
    timeoutMs: 10_000,
    allowedHosts: ["sec.gov"]
  },
  {
    id: "sec_edgar_tracked",
    name: "SEC EDGAR",
    markets: ["global"],
    adapter: "edgar",
    endpoint: "https://data.sec.gov/submissions/",
    policyStatus: "allowed",
    termsUrl: "https://www.sec.gov/search-filings/edgar-application-programming-interfaces",
    reviewedAt: "2026-07-20",
    maxRequestsPerSecond: 2,
    timeoutMs: 10_000,
    allowedHosts: ["sec.gov"]
  },
  {
    id: "cftc_releases",
    name: "U.S. CFTC",
    markets: ["crypto", "global"],
    adapter: "rss",
    endpoint: "https://www.cftc.gov/RSS/RSSGP/rssgp.xml",
    policyStatus: "allowed",
    termsUrl: "https://www.cftc.gov/RSS/index.htm",
    reviewedAt: "2026-07-20",
    maxRequestsPerSecond: 1,
    timeoutMs: 8_000,
    allowedHosts: ["cftc.gov"]
  },
  {
    id: "coindesk_rss",
    name: "CoinDesk",
    markets: ["crypto"],
    adapter: "disabled_media",
    endpoint: null,
    policyStatus: "blocked",
    termsUrl: "https://www.coindesk.com/terms",
    reviewedAt: "2026-07-20",
    maxRequestsPerSecond: 0,
    timeoutMs: 0,
    allowedHosts: []
  },
  {
    id: "cointelegraph_rss",
    name: "Cointelegraph",
    markets: ["crypto"],
    adapter: "disabled_media",
    endpoint: null,
    policyStatus: "blocked",
    termsUrl: "https://cointelegraph.com/terms-and-privacy",
    reviewedAt: "2026-07-20",
    maxRequestsPerSecond: 0,
    timeoutMs: 0,
    allowedHosts: []
  },
  {
    id: "cnbc_rss",
    name: "CNBC",
    markets: ["global"],
    adapter: "disabled_media",
    endpoint: null,
    policyStatus: "blocked",
    termsUrl: "https://www.nbcuniversal.com/terms/prohibited-actions",
    reviewedAt: "2026-07-20",
    maxRequestsPerSecond: 0,
    timeoutMs: 0,
    allowedHosts: []
  },
  {
    id: "marketwatch_rss",
    name: "MarketWatch",
    markets: ["global"],
    adapter: "disabled_media",
    endpoint: null,
    policyStatus: "blocked",
    termsUrl: "https://www.marketwatch.com/help/terms-of-use",
    reviewedAt: "2026-07-20",
    maxRequestsPerSecond: 0,
    timeoutMs: 0,
    allowedHosts: []
  }
];

export function enabledNewsSources(market?: NewsMarket) {
  return newsSourceCatalog.filter((source) => (
    source.policyStatus === "allowed" && (!market || source.markets.includes(market))
  ));
}

export function runtimeAllowedNewsSources(enabledSourceIds: ReadonlySet<string>, market?: NewsMarket) {
  return enabledNewsSources(market).filter((source) => enabledSourceIds.has(source.id));
}

export function runtimeAllowedNewsSourcesForPolicies(
  policies: ReadonlyMap<string, readonly string[]>,
  market?: NewsMarket
) {
  return runtimeAllowedNewsSources(new Set(policies.keys()), market).filter((source) => {
    const allowedHosts = policies.get(source.id) ?? [];
    return allowedHosts.length > 0 && (!source.endpoint || isAllowedUrlForHosts(source.endpoint, allowedHosts));
  });
}

export function isAllowedOfficialMacroEvent(input: {
  source: string;
  status: string;
  raw_payload?: Record<string, unknown> | null;
}) {
  return new Set(["BLS", "BEA", "Fed", "Census", "DOL"]).has(input.source) &&
    new Set(["actual_available", "released", "document_released", "meeting_completed"]).has(input.status) &&
    input.raw_payload?.isOfficial === true &&
    input.raw_payload?.sourceType !== "public_calendar";
}

export function newsSourceById(sourceId: string) {
  return newsSourceCatalog.find((source) => source.id === sourceId) ?? null;
}

export function isAllowedUrlForHosts(value: string, allowedHosts: readonly string[]) {
  if (allowedHosts.length === 0) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  return allowedHosts.some((candidate) => {
    const root = candidate.toLowerCase().replace(/\.$/, "");
    return root.length > 0 && (hostname === root || hostname.endsWith(`.${root}`));
  });
}

export function isAllowedNewsSourceUrl(sourceId: string, value: string) {
  const source = newsSourceById(sourceId);
  if (!source || source.policyStatus !== "allowed") return false;
  return isAllowedUrlForHosts(value, source.allowedHosts);
}

export function isAllowedOfficialMacroUrl(source: string, value: string) {
  const roots: Record<string, readonly string[]> = {
    BLS: ["bls.gov"],
    BEA: ["bea.gov"],
    Fed: ["federalreserve.gov"],
    Census: ["census.gov"],
    DOL: ["dol.gov", "doleta.gov"]
  };
  const allowed = roots[source];
  if (!allowed || !isAllowedNewsSourceUrl("macro_official_store", value)) return false;
  const hostname = new URL(value).hostname.toLowerCase().replace(/\.$/, "");
  return allowed.some((root) => hostname === root || hostname.endsWith(`.${root}`));
}

export function validateNewsSourceCatalog() {
  const ids = new Set<string>();
  for (const source of newsSourceCatalog) {
    if (!/^[a-z][a-z0-9_]*$/.test(source.id)) throw new Error(`Invalid news source id: ${source.id}`);
    if (ids.has(source.id)) throw new Error(`Duplicate news source id: ${source.id}`);
    ids.add(source.id);
    if (!/^https:\/\//.test(source.termsUrl)) throw new Error(`Missing HTTPS terms URL: ${source.id}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(source.reviewedAt)) throw new Error(`Invalid review date: ${source.id}`);
    if (source.policyStatus === "allowed" && source.adapter !== "macro_store" && !source.endpoint?.startsWith("https://")) {
      throw new Error(`Allowed source requires an HTTPS endpoint: ${source.id}`);
    }
    if (source.policyStatus === "allowed" && source.allowedHosts.length === 0) {
      throw new Error(`Allowed source requires an official host allowlist: ${source.id}`);
    }
    if (source.endpoint && !isAllowedNewsSourceUrl(source.id, source.endpoint)) {
      throw new Error(`Source endpoint is outside its official host allowlist: ${source.id}`);
    }
    if (source.policyStatus !== "allowed" && source.endpoint !== null) {
      throw new Error(`Non-allowed source must remain fail-closed: ${source.id}`);
    }
  }
  return true;
}
