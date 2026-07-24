import { admitOfficialNews } from "./officialNewsAdmission";
import { officialNewsSemanticSubject } from "./officialNewsIdentity";
import { classifyNewsSourceTimestamp, normalizeNewsSourceItem, type NormalizedNewsSourceItem } from "./normalizeNewsSourceItem";
import type { NewsSourceDefinition } from "./sourceCatalog";

interface FederalRegisterAgency {
  name?: string | null;
}

export interface FederalRegisterDocumentRow {
  document_number?: string | null;
  title?: string | null;
  filed_at?: string | null;
  publication_date?: string | null;
  html_url?: string | null;
  type?: string | null;
  excerpts?: string | string[] | null;
  abstract?: string | null;
  agencies?: FederalRegisterAgency[] | null;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function excerpt(row: FederalRegisterDocumentRow) {
  if (Array.isArray(row.excerpts)) return row.excerpts.filter((value): value is string => typeof value === "string").join(" ");
  if (typeof row.excerpts === "string") return row.excerpts;
  return typeof row.abstract === "string" ? row.abstract : "";
}

function agencyNames(row: FederalRegisterDocumentRow) {
  return (Array.isArray(row.agencies) ? row.agencies : [])
    .map((agency) => text(agency?.name))
    .filter(Boolean)
    .slice(0, 6);
}

export function normalizeFederalRegisterDocument(
  row: FederalRegisterDocumentRow,
  now: Date,
  source: NewsSourceDefinition
): NormalizedNewsSourceItem | null {
  const documentNumber = text(row.document_number);
  const title = text(row.title);
  const url = text(row.html_url);
  const filedAt = text(row.filed_at);
  const publicationDate = text(row.publication_date);
  if (!documentNumber || !title || !url) return null;

  const admission = admitOfficialNews({
    sourceId: source.id,
    title: `${title} ${excerpt(row)}`.replace(/\s+/g, " ").trim(),
    structuredPayload: { documentNumber, documentType: text(row.type) }
  });
  if (!admission.accepted || !admission.eventKind) return null;

  const filedAtStatus = filedAt ? classifyNewsSourceTimestamp(filedAt, now) : null;
  if (filedAt && filedAtStatus !== "valid") return null;
  const hasPreciseFiledAt = filedAtStatus === "valid";
  const publishedAt = hasPreciseFiledAt
    ? filedAt
    : publicationDate
      ? `${publicationDate}T00:00:00.000Z`
      : "";
  if (classifyNewsSourceTimestamp(publishedAt, now) !== "valid") return null;

  const agencies = agencyNames(row);
  try {
    return normalizeNewsSourceItem({
      sourceId: source.id,
      externalId: `${hasPreciseFiledAt ? "inspection" : "document"}:${documentNumber}`,
      canonicalUrl: url,
      originalTitle: title,
      publishedAt,
      eventType: admission.eventKind,
      entities: [documentNumber, ...agencies, officialNewsSemanticSubject(title)].filter(Boolean),
      action: hasPreciseFiledAt ? "filed_for_public_inspection" : "published",
      markets: admission.markets,
      targets: admission.targets,
      category: admission.reason === "crypto_regulation" ? "regulation" : "market_infrastructure",
      importance: admission.importance,
      contentSeed: `${text(row.type)}|${agencies.join("|")}|${publicationDate}`,
      structuredPayload: {
        source: source.name,
        documentNumber,
        documentType: text(row.type) || null,
        agencies,
        publicationDate: publicationDate || null,
        eventKind: admission.eventKind,
        admissionReason: admission.reason,
        admissionRuleVersion: admission.ruleVersion,
        reactionEligible: hasPreciseFiledAt,
        reactionAnchorPolicy: hasPreciseFiledAt ? "occurred_at" : "none",
        timeLabel: hasPreciseFiledAt ? "공개 열람 등록" : "연방 관보 발행일",
        canonicalEventId: `federal-register:${documentNumber}`,
        pushEligible: false
      }
    }, now);
  } catch {
    return null;
  }
}
