function newYorkDate(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(iso));
}

export function officialNewsSemanticSubject(title: string) {
  const stopWords = new Set([
    "a", "an", "and", "announce", "announces", "commission", "commodity", "cftc", "exchange",
    "futures", "issues", "joint", "publishes", "release", "sec", "securities", "statement", "the",
    "trading", "united", "us", "states"
  ]);
  const tokens = title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/u\.s\./g, " us ")
    .match(/[a-z0-9]+/g)
    ?.filter((token) => token.length > 1 && !stopWords.has(token)) ?? [];
  return Array.from(new Set(tokens)).sort().join("-").slice(0, 180);
}

export function officialNewsCanonicalEventId(input: {
  sourceId: string;
  externalId: string;
  canonicalUrl: string;
  eventKind: string;
  publishedAt: string;
  structuredPayload?: Record<string, unknown>;
}) {
  const explicit = input.structuredPayload?.canonicalEventId;
  if (typeof explicit === "string" && explicit.trim()) return explicit.trim();

  if (input.sourceId === "fed_press_releases" && input.eventKind.startsWith("fomc_")) {
    return `fed:${input.eventKind}:${newYorkDate(input.publishedAt)}`;
  }
  if (input.sourceId === "macro_official_store") {
    const agency = typeof input.structuredPayload?.macroSource === "string" ? input.structuredPayload.macroSource : "official";
    const sourceEventId = typeof input.structuredPayload?.macroSourceEventId === "string"
      ? input.structuredPayload.macroSourceEventId
      : input.externalId;
    if (agency.toLowerCase() === "fed" && input.eventKind.startsWith("fomc_")) {
      return `fed:${input.eventKind}:${newYorkDate(input.publishedAt)}`;
    }
    return `macro:${agency}:${sourceEventId}`;
  }
  if (input.sourceId === "sec_edgar_tracked") return `sec-accession:${input.externalId}`;
  return null;
}
