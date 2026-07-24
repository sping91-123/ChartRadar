import { XMLParser } from "fast-xml-parser";
import { selectLatestMacroGenerationRows } from "@/lib/macro/generation";
import { normalizeEdgarAcceptanceDateTime } from "@/lib/officialNewsTime";
import { supabaseAdminRest } from "@/lib/server/supabaseAdmin";
import { admitOfficialNews, officialRssPayloadFailure } from "@/lib/server/news/officialNewsAdmission";
import { officialNewsCanonicalEventId, officialNewsSemanticSubject } from "@/lib/server/news/officialNewsIdentity";
import { isAllowedOfficialMacroEvent, isAllowedOfficialMacroUrl, isAllowedUrlForHosts, runtimeAllowedNewsSourcesForPolicies, type NewsSourceDefinition } from "@/lib/server/news/sourceCatalog";
import { classifyNewsSourceTimestamp, normalizeNewsSourceItem, type NormalizedNewsSourceItem } from "@/lib/server/news/normalizeNewsSourceItem";
import { readEnabledNewsSourcePolicies, readNewsSourceHealth, recordNewsSourceFailure, recordNewsSourceSuccess } from "@/lib/server/news/newsImpactStore";
import { normalizeFederalRegisterDocument, type FederalRegisterDocumentRow } from "@/lib/server/news/federalRegister";
import { readBoundedOfficialResponseText } from "@/lib/server/news/boundedOfficialResponse";

export interface NewsSourceFetchResult {
  sourceId: string;
  status: "succeeded" | "skipped" | "failed";
  fetchedCount: number;
  acceptedCount: number;
  items: NormalizedNewsSourceItem[];
  rejectedExternalIds?: string[];
  warning?: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: "text",
  trimValues: true
});

const trackedEdgarCompanies = [
  { symbol: "NVDA", cik: "0001045810", name: "NVIDIA" },
  { symbol: "TSLA", cik: "0001318605", name: "Tesla" },
  { symbol: "AAPL", cik: "0000320193", name: "Apple" },
  { symbol: "MSFT", cik: "0000789019", name: "Microsoft" },
  { symbol: "AMZN", cik: "0001018724", name: "Amazon" },
  { symbol: "META", cik: "0001326801", name: "Meta Platforms" },
  { symbol: "GOOGL", cik: "0001652044", name: "Alphabet" },
  { symbol: "AVGO", cik: "0001730168", name: "Broadcom" }
] as const;
const trackedForms = new Set(["8-K", "6-K", "10-Q", "10-K"]);
const MAX_RSS_BYTES = 2 * 1024 * 1024;
const MAX_JSON_BYTES = 5 * 1024 * 1024;
const FEDERAL_REGISTER_LOOKBACK_DAYS = 3;
let secRequestQueue: Promise<void> = Promise.resolve();
let lastSecRequestAt = 0;

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function textValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return textValue(record.text ?? record["#text"] ?? record.href ?? record.url ?? "");
  }
  return "";
}

async function waitForSecRequestSlot(url: string) {
  const hostname = new URL(url).hostname.toLowerCase();
  if (hostname !== "sec.gov" && !hostname.endsWith(".sec.gov")) return;
  let release: () => void = () => {};
  const previous = secRequestQueue;
  secRequestQueue = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try {
    const remaining = lastSecRequestAt + 550 - Date.now();
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
    lastSecRequestAt = Date.now();
  } finally {
    release();
  }
}

function retryDelayMs(response: Response) {
  const raw = response.headers.get("retry-after");
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(2_000, seconds * 1_000);
  const date = raw ? Date.parse(raw) : Number.NaN;
  return Number.isFinite(date) ? Math.max(250, Math.min(2_000, date - Date.now())) : 500;
}

async function fetchWithTimeout(url: string, source: NewsSourceDefinition, headers: HeadersInit = {}) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await waitForSecRequestSlot(url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), source.timeoutMs);
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": process.env.NEWS_OFFICIAL_USER_AGENT || "ChartRadar/1.0 (https://chartradar.kr/contact)",
          Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, application/json;q=0.9, */*;q=0.1",
          ...headers
        },
        cache: "no-store",
        signal: controller.signal
      });
      const finalUrl = response.url || url;
      if (!isAllowedUrlForHosts(finalUrl, source.allowedHosts)) {
        await response.body?.cancel().catch(() => undefined);
        throw new Error(`${source.id}:redirect_host_not_allowed`);
      }
      if (response.ok) return response;
      if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
        const delay = retryDelayMs(response);
        await response.body?.cancel().catch(() => undefined);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw new Error(`${source.id}:${response.status}`);
    } catch (error) {
      const retryableNetworkError = error instanceof TypeError || (error instanceof DOMException && error.name === "AbortError");
      if (attempt === 0 && retryableNetworkError) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`${source.id}:retry_exhausted`);
}

async function readLimitedText(response: Response, maxBytes: number, contentType: RegExp) {
  return readBoundedOfficialResponseText(response, {
    maxBytes,
    contentType,
    contentTypeError: "unexpected_content_type",
    tooLargeError: "official_source_payload_too_large"
  });
}

function rssRows(payload: unknown) {
  const root = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const rss = root.rss && typeof root.rss === "object" ? root.rss as Record<string, unknown> : {};
  const channel = rss.channel && typeof rss.channel === "object" ? rss.channel as Record<string, unknown> : {};
  const feed = root.feed && typeof root.feed === "object" ? root.feed as Record<string, unknown> : {};
  return [...asArray(channel.item), ...asArray(feed.entry)].filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
}

function withCanonicalEventIdentity(item: NormalizedNewsSourceItem) {
  const eventKind = typeof item.structuredPayload.eventKind === "string" ? item.structuredPayload.eventKind : item.eventType;
  const canonicalEventId = officialNewsCanonicalEventId({
    sourceId: item.sourceId,
    externalId: item.externalId,
    canonicalUrl: item.canonicalUrl,
    eventKind,
    publishedAt: item.publishedAt,
    structuredPayload: item.structuredPayload
  });
  return {
    ...item,
    structuredPayload: {
      ...item.structuredPayload,
      ...(canonicalEventId ? { canonicalEventId } : {})
    }
  };
}

async function fetchRssSource(source: NewsSourceDefinition, now: Date) {
  if (!source.endpoint) return { fetchedCount: 0, items: [] as NormalizedNewsSourceItem[] };
  const response = await fetchWithTimeout(source.endpoint, source);
  const xml = await readLimitedText(response, MAX_RSS_BYTES, /(?:rss|atom|xml)/i);
  const rows = rssRows(parser.parse(xml));
  const candidates = rows.slice(0, 30);
  const items: NormalizedNewsSourceItem[] = [];
  const rejectedExternalIds: string[] = [];
  let admittedCount = 0;
  let invalidAdmittedCount = 0;
  let malformedCount = 0;
  for (const row of candidates) {
    const title = textValue(row.title);
    const link = textValue(row.link);
    const publishedAt = textValue(row.pubDate ?? row.published ?? row.updated ?? row.date);
    const externalId = textValue(row.guid ?? row.id) || link;
    if (!title || !link || !publishedAt || !externalId) {
      malformedCount += 1;
      continue;
    }
    const timestampStatus = classifyNewsSourceTimestamp(publishedAt, now);
    if (timestampStatus === "expired") continue;
    const admission = admitOfficialNews({ sourceId: source.id, title });
    if (!admission.accepted || !admission.eventKind) {
      if (timestampStatus === "valid") rejectedExternalIds.push(externalId.slice(0, 180));
      continue;
    }
    admittedCount += 1;
    if (timestampStatus !== "valid") {
      invalidAdmittedCount += 1;
      continue;
    }
    try {
      const normalized = normalizeNewsSourceItem({
        sourceId: source.id,
        externalId,
        canonicalUrl: link,
        originalTitle: title,
        publishedAt,
        eventType: admission.eventKind,
        entities: (source.id === "sec_press_releases" || source.id === "cftc_releases" || source.id === "occ_news_releases") &&
          (admission.reason === "crypto_regulation" || admission.reason === "market_infrastructure")
          ? [officialNewsSemanticSubject(title)].filter(Boolean)
          : title.match(/[A-Z][A-Za-z0-9.&-]{2,}/g)?.slice(0, 8) ?? [source.name],
        action: "published",
        markets: admission.markets,
        targets: admission.targets,
        category: source.id === "fed_press_releases" ? "macro" : "regulation",
        importance: admission.importance,
        structuredPayload: {
          source: source.name,
          eventKind: admission.eventKind,
          admissionReason: admission.reason,
          admissionRuleVersion: admission.ruleVersion,
          pushEligible: admission.pushEligible
        }
      }, now);
      if (normalized) items.push(withCanonicalEventIdentity(normalized));
      else invalidAdmittedCount += 1;
    } catch {
      invalidAdmittedCount += 1;
    }
  }
  const failure = officialRssPayloadFailure({ candidateCount: candidates.length, admittedCount, invalidAdmittedCount, malformedCount });
  if (failure) throw new Error(failure);
  return {
    fetchedCount: candidates.length,
    items,
    rejectedExternalIds: Array.from(new Set(rejectedExternalIds))
  };
}

interface MacroEventRow {
  id: string;
  source: string;
  source_event_id: string;
  title: string;
  category: string;
  importance: 1 | 2 | 3;
  scheduled_at: string;
  released_at: string | null;
  status: string;
  event_type?: string | null;
  actual_value?: string | null;
  consensus_value?: string | null;
  previous_value?: string | null;
  source_url: string;
  official_url?: string | null;
  raw_payload?: Record<string, unknown> | null;
}

async function fetchMacroStore(now: Date) {
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60_000).toISOString();
  const storedRows = await supabaseAdminRest<MacroEventRow[]>(
    `macro_events?scheduled_at=gte.${encodeURIComponent(since)}&order=updated_at.desc,scheduled_at.desc&limit=160`
  );
  const rows = selectLatestMacroGenerationRows(storedRows).filter((row) => row.importance === 3);
  let invalidOfficialCount = 0;
  const items = rows.flatMap((row) => {
    if (!isAllowedOfficialMacroEvent(row)) return [];
    const publishedAt = row.released_at ?? row.scheduled_at;
    const canonicalUrl = row.official_url ?? row.source_url;
    if (!isAllowedOfficialMacroUrl(row.source, canonicalUrl)) {
      invalidOfficialCount += 1;
      return [];
    }
    const details = [
      row.actual_value ? `실제 ${row.actual_value}` : null,
      row.consensus_value ? `시장 예상 ${row.consensus_value}` : null,
      row.previous_value ? `이전 ${row.previous_value}` : null
    ].filter(Boolean).join(" · ");
    const fedAdmission = row.source === "Fed"
      ? admitOfficialNews({ sourceId: "fed_press_releases", title: row.title })
      : null;
    const eventKind = fedAdmission?.accepted && fedAdmission.eventKind ? fedAdmission.eventKind : "official_macro_release";
    try {
      const normalized = normalizeNewsSourceItem({
        sourceId: "macro_official_store",
        externalId: `${row.source}:${row.source_event_id}`,
        canonicalUrl,
        originalTitle: row.title,
        publishedAt,
        eventType: eventKind,
        entities: [row.source, row.title],
        action: row.status,
        markets: ["crypto", "global"],
        targets: ["btc", "eth", "global"],
        category: "macro",
        importance: "high",
        contentSeed: details,
        structuredPayload: {
          macroEventId: row.id,
          macroSource: row.source,
          macroSourceEventId: row.source_event_id,
          actual: row.actual_value ?? null,
          consensus: row.consensus_value ?? null,
          previous: row.previous_value ?? null,
          actualProvenance: row.raw_payload?.actualProvenance ?? null,
          consensusProvenance: row.raw_payload?.consensusProvenance ?? null,
          actualProvider: row.raw_payload?.actualProvider ?? null,
          actualSourceUrl: row.raw_payload?.actualSourceUrl ?? null,
          actualReportingPeriod: row.raw_payload?.actualReportingPeriod ?? null,
          actualObservedAt: row.raw_payload?.actualObservedAt ?? null,
          consensusProvider: row.raw_payload?.consensusProvider ?? null,
          consensusSourceUrl: row.raw_payload?.consensusSourceUrl ?? null,
          details,
          eventKind,
          admissionReason: "official_macro",
          admissionRuleVersion: "official-admission-v1",
          pushEligible: true
        }
      }, now);
      if (!normalized) {
        invalidOfficialCount += 1;
        return [];
      }
      return [withCanonicalEventIdentity(normalized)];
    } catch {
      invalidOfficialCount += 1;
      return [];
    }
  });
  if (invalidOfficialCount > 0) throw new Error("official_macro_item_invalid");
  return { fetchedCount: rows.length, items };
}

interface EdgarSubmissions {
  filings?: {
    recent?: {
      accessionNumber?: string[];
      filingDate?: string[];
      acceptanceDateTime?: string[];
      form?: string[];
      primaryDocument?: string[];
    };
  };
}

interface FederalRegisterResponse {
  count?: number;
  results?: FederalRegisterDocumentRow[];
}

function dateOnlyUtc(date: Date) {
  return date.toISOString().slice(0, 10);
}

function recentFederalRegisterDates(now: Date) {
  return Array.from({ length: FEDERAL_REGISTER_LOOKBACK_DAYS }, (_, index) => (
    dateOnlyUtc(new Date(now.getTime() - index * 24 * 60 * 60_000))
  ));
}

async function fetchFederalRegister(source: NewsSourceDefinition, now: Date) {
  if (!source.endpoint) return { fetchedCount: 0, items: [] as NormalizedNewsSourceItem[] };
  const rows: FederalRegisterDocumentRow[] = [];
  for (const availableOn of recentFederalRegisterDates(now)) {
    const url = new URL(source.endpoint);
    url.searchParams.set("conditions[available_on]", availableOn);
    url.searchParams.set("per_page", "1000");
    const response = await fetchWithTimeout(url.toString(), source, { Accept: "application/json" });
    const payload = JSON.parse(await readLimitedText(response, MAX_JSON_BYTES, /json/i)) as FederalRegisterResponse;
    rows.push(...asArray(payload.results));
    if (availableOn !== recentFederalRegisterDates(now).at(-1)) {
      await new Promise((resolve) => setTimeout(resolve, 1_050));
    }
  }

  const unique = new Map<string, FederalRegisterDocumentRow>();
  for (const row of rows) {
    const key = textValue(row.document_number);
    if (key && !unique.has(key)) unique.set(key, row);
  }
  let structurallyValidCount = 0;
  let admittedCount = 0;
  let invalidAdmittedCount = 0;
  const items: NormalizedNewsSourceItem[] = [];
  for (const row of Array.from(unique.values())) {
    const title = textValue(row.title);
    const url = textValue(row.html_url);
    const timestamp = textValue(row.filed_at) || textValue(row.publication_date);
    if (!title || !url || !timestamp) continue;
    structurallyValidCount += 1;
    const context = [
      title,
      ...(Array.isArray(row.excerpts) ? row.excerpts : [row.excerpts]),
      row.abstract
    ].filter((value): value is string => typeof value === "string").join(" ");
    if (!admitOfficialNews({ sourceId: source.id, title: context }).accepted) continue;
    admittedCount += 1;
    const normalized = normalizeFederalRegisterDocument(row, now, source);
    if (normalized) items.push(normalized);
    else invalidAdmittedCount += 1;
  }
  if (rows.length > 0 && structurallyValidCount === 0) {
    throw new Error("federal_register_schema_invalid");
  }
  if (admittedCount > 0 && invalidAdmittedCount === admittedCount) {
    throw new Error("federal_register_all_admitted_items_invalid");
  }
  return {
    fetchedCount: rows.length,
    items
  };
}

async function fetchEdgar(source: NewsSourceDefinition, now: Date) {
  const results: NormalizedNewsSourceItem[] = [];
  let fetchedCount = 0;
  let invalidTrackedCount = 0;
  for (let index = 0; index < trackedEdgarCompanies.length; index += 1) {
    const company = trackedEdgarCompanies[index];
      const response = await fetchWithTimeout(`${source.endpoint}CIK${company.cik}.json`, source, { Accept: "application/json" });
      const payload = JSON.parse(await readLimitedText(response, MAX_JSON_BYTES, /json/i)) as EdgarSubmissions;
      const recent = payload.filings?.recent;
      const recentAccessions = !recent ? [] : asArray(recent.accessionNumber).slice(0, 20);
      fetchedCount += recentAccessions.length;
      const companyItems = !recent ? [] : recentAccessions.flatMap((accession, rowIndex) => {
        const form = recent.form?.[rowIndex] ?? "";
        if (!trackedForms.has(form)) return [];
        const publishedAt = normalizeEdgarAcceptanceDateTime(recent.acceptanceDateTime?.[rowIndex], recent.filingDate?.[rowIndex]);
        const primaryDocument = recent.primaryDocument?.[rowIndex];
        if (!publishedAt) {
          invalidTrackedCount += 1;
          return [];
        }
        const timestampStatus = classifyNewsSourceTimestamp(publishedAt, now);
        if (timestampStatus === "expired") return [];
        if (timestampStatus !== "valid" || !primaryDocument) {
          invalidTrackedCount += 1;
          return [];
        }
        const canonicalUrl = `https://www.sec.gov/Archives/edgar/data/${Number(company.cik)}/${accession.replace(/-/g, "")}/${primaryDocument}`;
        const admission = admitOfficialNews({ sourceId: source.id, title: `${company.name} ${form} filing`, structuredPayload: { form } });
        if (!admission.accepted || !admission.eventKind) return [];
        const normalized = normalizeNewsSourceItem({
          sourceId: source.id,
          externalId: accession,
          canonicalUrl,
          originalTitle: `${company.name} ${form} filing`,
          publishedAt,
          eventType: admission.eventKind,
          entities: [company.symbol, company.name],
          action: "filed",
          markets: ["global"],
          targets: ["global"],
          category: "corporate_sector",
          importance: admission.importance,
          structuredPayload: {
            symbol: company.symbol,
            companyName: company.name,
            form,
            accession,
            eventKind: admission.eventKind,
            admissionReason: admission.reason,
            admissionRuleVersion: admission.ruleVersion,
            pushEligible: admission.pushEligible
          }
        }, now);
        if (!normalized) {
          invalidTrackedCount += 1;
          return [];
        }
        return [withCanonicalEventIdentity(normalized)];
      });
    results.push(...companyItems);
    if (index + 1 < trackedEdgarCompanies.length) await new Promise((resolve) => setTimeout(resolve, 550));
  }
  if (invalidTrackedCount > 0) throw new Error("official_edgar_tracked_item_invalid");
  return { fetchedCount, items: results };
}

async function fetchAllowedSource(
  source: NewsSourceDefinition,
  now: Date
): Promise<{ fetchedCount: number; items: NormalizedNewsSourceItem[]; rejectedExternalIds?: string[] }> {
  if (source.adapter === "macro_store") return fetchMacroStore(now);
  if (source.adapter === "rss") return fetchRssSource(source, now);
  if (source.adapter === "edgar") return fetchEdgar(source, now);
  if (source.adapter === "federal_register") return fetchFederalRegister(source, now);
  return { fetchedCount: 0, items: [] as NormalizedNewsSourceItem[] };
}

export async function fetchOfficialNewsSources(now = new Date()): Promise<NewsSourceFetchResult[]> {
  const sourcePolicies = await readEnabledNewsSourcePolicies();
  const runtimeSources = runtimeAllowedNewsSourcesForPolicies(sourcePolicies)
    .filter((source) => source.adapter !== "positioning");
  if (runtimeSources.length === 0) {
    return [{
      sourceId: "source_catalog",
      status: "failed",
      fetchedCount: 0,
      acceptedCount: 0,
      items: [],
      warning: "no_allowed_sources_enabled"
    }];
  }
  const results = await Promise.all(runtimeSources.map(async (source): Promise<NewsSourceFetchResult> => {
    const health = await readNewsSourceHealth(source.id).catch(() => null);
    if (health?.circuit_open_until && Date.parse(health.circuit_open_until) > now.getTime()) {
      return { sourceId: source.id, status: "skipped", fetchedCount: 0, acceptedCount: 0, items: [], warning: "circuit_open" };
    }
    try {
      const fetched = await fetchAllowedSource(source, now);
      const allowedHosts = sourcePolicies.get(source.id) ?? [];
      const admittedItems = fetched.items.filter((item) => isAllowedUrlForHosts(item.canonicalUrl, allowedHosts));
      await recordNewsSourceSuccess(source.id).catch(() => undefined);
      return {
        sourceId: source.id,
        status: "succeeded",
        fetchedCount: fetched.fetchedCount,
        acceptedCount: admittedItems.length,
        items: admittedItems,
        ...(fetched.rejectedExternalIds?.length
          ? { rejectedExternalIds: fetched.rejectedExternalIds }
          : {}),
        ...(admittedItems.length < fetched.items.length ? { warning: "runtime_source_host_policy_filtered" } : {})
      };
    } catch (error) {
      await recordNewsSourceFailure(source.id, error).catch(() => undefined);
      return {
        sourceId: source.id,
        status: "failed",
        fetchedCount: 0,
        acceptedCount: 0,
        items: [],
        warning: (error instanceof Error ? error.message : String(error)).slice(0, 180)
      };
    }
  }));
  return results;
}
