import { createHash } from "node:crypto";
import type { NewsImpactCategory, NewsImportance, NewsMarket } from "../../newsImpact";
import { isAllowedNewsSourceUrl } from "./sourceCatalog";

export interface NormalizedNewsSourceItem {
  sourceId: string;
  externalId: string;
  canonicalUrl: string;
  originalTitle: string;
  publishedAt: string;
  firstSeenAt: string;
  contentHash: string;
  eventType: string;
  entities: string[];
  action: string;
  markets: NewsMarket[];
  targets: Array<"btc" | "eth" | "global">;
  category: NewsImpactCategory;
  importance: NewsImportance;
  structuredPayload: Record<string, unknown>;
}

function compactText(value: string, maxLength: number) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizedToken(value: string) {
  return compactText(value, 120)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type NewsSourceTimestampStatus = "valid" | "expired" | "future" | "invalid";

export function classifyNewsSourceTimestamp(value: string, now = new Date()): NewsSourceTimestampStatus {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "invalid";
  if (parsed > now.getTime() + 5 * 60_000) return "future";
  if (parsed < now.getTime() - 30 * 24 * 60 * 60_000) return "expired";
  return "valid";
}

function validPublishedAt(value: string, nowMs: number) {
  if (classifyNewsSourceTimestamp(value, new Date(nowMs)) !== "valid") return null;
  const parsed = Date.parse(value);
  return new Date(parsed).toISOString();
}

export function canonicalizeOfficialUrl(value: string, sourceId?: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    throw new Error("news_source_url_must_be_https_without_credentials_or_port");
  }
  if (sourceId && !isAllowedNewsSourceUrl(sourceId, url.toString())) {
    throw new Error("news_source_url_domain_not_allowed");
  }
  url.hash = "";
  for (const key of Array.from(url.searchParams.keys())) {
    if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  return url.toString();
}

export function semanticNewsEventKey(input: {
  canonicalEventId?: string | null;
  officialEventId?: string | null;
  eventType: string;
  entities: string[];
  action: string;
  publishedAt: string;
}) {
  const stableId = input.canonicalEventId?.trim() || input.officialEventId?.trim();
  if (stableId) {
    return createHash("sha256").update(`news-event-v2:${normalizedToken(stableId)}`).digest("hex");
  }
  const published = Date.parse(input.publishedAt);
  const bucket = Math.floor(published / (24 * 60 * 60_000));
  const identity = [
    normalizedToken(input.eventType),
    input.entities.map(normalizedToken).filter(Boolean).sort().join(","),
    normalizedToken(input.action),
    String(bucket)
  ].join("|");
  return createHash("sha256").update(`news-event-v2:${identity}`).digest("hex");
}

export function normalizeNewsSourceItem(input: Omit<NormalizedNewsSourceItem, "canonicalUrl" | "originalTitle" | "publishedAt" | "firstSeenAt" | "contentHash"> & {
  canonicalUrl: string;
  originalTitle: string;
  publishedAt: string;
  firstSeenAt?: string;
  contentSeed?: string;
}, now = new Date()): NormalizedNewsSourceItem | null {
  const nowMs = now.getTime();
  const publishedAt = validPublishedAt(input.publishedAt, nowMs);
  if (!publishedAt) return null;
  const title = compactText(input.originalTitle, 240);
  if (!title) return null;
  const canonicalUrl = canonicalizeOfficialUrl(input.canonicalUrl, input.sourceId);
  const firstSeen = input.firstSeenAt ? validPublishedAt(input.firstSeenAt, nowMs) : null;
  const entities = Array.from(new Set(input.entities.map(normalizedToken).filter(Boolean))).slice(0, 12);
  return {
    ...input,
    externalId: compactText(input.externalId, 180),
    eventType: normalizedToken(input.eventType),
    action: normalizedToken(input.action),
    entities,
    canonicalUrl,
    originalTitle: title,
    publishedAt,
    firstSeenAt: firstSeen ?? now.toISOString(),
    contentHash: createHash("sha256").update(`${title}|${input.contentSeed ?? ""}`).digest("hex"),
    structuredPayload: input.structuredPayload
  };
}
