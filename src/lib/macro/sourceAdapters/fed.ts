// Federal Reserve 공식 페이지에서 FOMC 문서와 정책 기조를 확인합니다.
import { type MacroEventItem } from "@/data/macroEvents";
import {
  buildFomcPolicyAssessment,
  extractFomcStatementText,
  findFomcCalendarDocuments,
  findFomcTranscriptUrl,
  isAllowedFomcDocumentUrl,
  isFomcPolicyDocumentLabel,
  parseFomcSepHtml,
  type FomcCalendarDocuments,
  type FomcPolicyAssessment
} from "@/lib/fomcPolicyAssessment";
import { classifyMacroEvent } from "@/lib/macro/macroStatus";
import { type MacroSourceEnrichment } from "@/lib/macro/types";
import { readBoundedOfficialResponseText } from "@/lib/server/news/boundedOfficialResponse";

const FED_FOMC_CALENDAR_URL = "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm";
const FED_BASE_URL = "https://www.federalreserve.gov";
const FED_USER_AGENT = "ChartRadarBot/1.0 (+https://chartradar.kr)";
const FED_CALENDAR_MAX_BYTES = 2 * 1024 * 1024;
const FED_STATEMENT_MAX_BYTES = 512 * 1024;
const FED_SEP_MAX_BYTES = 2 * 1024 * 1024;
const FED_PRESS_PAGE_MAX_BYTES = 512 * 1024;
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function absoluteFedUrl(value: string) {
  try {
    return new URL(value, FED_BASE_URL).toString();
  } catch {
    return undefined;
  }
}

function compactHtml(html: string) {
  return html.replace(/\s+/g, " ");
}

function releaseDateText(iso: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return `${monthNames[date.getUTCMonth()]} ${String(date.getUTCDate()).padStart(2, "0")}, ${date.getUTCFullYear()}`;
}

function isoDate(iso: string) {
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null;
}

function findHtmlLink(section: string) {
  const htmlLink = section.match(/href=["']([^"']+)["'][^>]*>\s*HTML\s*</i);
  if (htmlLink?.[1]) return absoluteFedUrl(htmlLink[1]);
  const anyLink = section.match(/href=["']([^"']+)["']/i);
  return anyLink?.[1] ? absoluteFedUrl(anyLink[1]) : undefined;
}

function findMinutesUrl(html: string, releaseAt: string) {
  const text = releaseDateText(releaseAt).replace(" 0", " ");
  if (!text) return undefined;
  const compact = compactHtml(html);
  const releaseIndex = compact.indexOf(`Released ${text}`);
  if (releaseIndex < 0) return undefined;
  const section = compact.slice(Math.max(0, releaseIndex - 900), releaseIndex + 120);
  const minutesIndex = section.lastIndexOf("Minutes:");
  if (minutesIndex < 0) return undefined;
  return findHtmlLink(section.slice(minutesIndex));
}

function meetingSection(html: string, releaseAt: string) {
  const date = new Date(releaseAt);
  if (!Number.isFinite(date.getTime())) return "";
  const compact = compactHtml(html);
  const yearHeading = `${date.getUTCFullYear()} FOMC Meetings`;
  const yearIndex = compact.indexOf(yearHeading);
  if (yearIndex < 0) return "";
  const monthIndex = compact.indexOf(monthNames[date.getUTCMonth()], yearIndex);
  if (monthIndex < 0) return "";
  return compact.slice(monthIndex, monthIndex + 4_500);
}

function findImplementationUrl(section: string) {
  const index = section.indexOf("Implementation Note");
  return index >= 0 ? findHtmlLink(section.slice(Math.max(0, index - 260), index + 260)) : undefined;
}

function exactTitleMatcher(title: string) {
  const escaped = title.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`^\\s*${escaped}\\s*$`, "i");
}

async function fetchFedHtml(url: string, options: { maxBytes: number; timeoutMs: number; allowCalendar?: boolean }) {
  if (options.allowCalendar ? url !== FED_FOMC_CALENDAR_URL : !isAllowedFomcDocumentUrl(url)) {
    throw new Error("fed_document_url_not_allowed");
  }
  const response = await fetch(url, {
    headers: { Accept: "text/html,application/xhtml+xml", "user-agent": FED_USER_AGENT },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(options.timeoutMs)
  });
  if (!response.ok) throw new Error(`fed_document_http_${response.status}`);
  if (!options.allowCalendar && !isAllowedFomcDocumentUrl(response.url || url)) throw new Error("fed_document_final_url_not_allowed");
  return readBoundedOfficialResponseText(response, {
    maxBytes: options.maxBytes,
    contentType: /(?:text\/html|application\/xhtml\+xml)/i,
    contentTypeError: "fed_document_content_type_invalid",
    tooLargeError: "fed_document_too_large"
  });
}

async function assessMeetingDocuments(documents: FomcCalendarDocuments): Promise<FomcPolicyAssessment | null> {
  if (!documents.statementUrl) return null;
  const [statementResult, priorResult, sepResult, pressResult] = await Promise.allSettled([
    fetchFedHtml(documents.statementUrl, { maxBytes: FED_STATEMENT_MAX_BYTES, timeoutMs: 8_000 }),
    documents.priorStatementUrl
      ? fetchFedHtml(documents.priorStatementUrl, { maxBytes: FED_STATEMENT_MAX_BYTES, timeoutMs: 8_000 })
      : Promise.resolve(null),
    documents.sepUrl
      ? fetchFedHtml(documents.sepUrl, { maxBytes: FED_SEP_MAX_BYTES, timeoutMs: 10_000 })
      : Promise.resolve(null),
    documents.pressConferenceUrl
      ? fetchFedHtml(documents.pressConferenceUrl, { maxBytes: FED_PRESS_PAGE_MAX_BYTES, timeoutMs: 8_000 })
      : Promise.resolve(null)
  ]);
  if (statementResult.status !== "fulfilled") return null;
  const statementText = extractFomcStatementText(statementResult.value);
  if (!statementText) return null;
  const priorStatementText = priorResult.status === "fulfilled" && priorResult.value
    ? extractFomcStatementText(priorResult.value)
    : null;
  const sep = sepResult.status === "fulfilled" && sepResult.value && documents.sepUrl
    ? parseFomcSepHtml(sepResult.value, documents.sepUrl)
    : null;
  const transcriptUrl = pressResult.status === "fulfilled" && pressResult.value
    ? findFomcTranscriptUrl(pressResult.value, documents.meetingDate)
    : undefined;
  return buildFomcPolicyAssessment({
    meetingDate: documents.meetingDate,
    analyzedAt: new Date().toISOString(),
    statementText,
    priorStatementText,
    statementUrl: documents.statementUrl,
    priorStatementUrl: priorStatementText ? documents.priorStatementUrl : undefined,
    sep,
    sepUrl: sep ? documents.sepUrl : undefined,
    pressConferenceUrl: documents.pressConferenceUrl,
    transcriptUrl
  });
}

function officialUrlForItem(html: string, item: MacroEventItem, documents: FomcCalendarDocuments | null) {
  if (/minutes/i.test(item.label)) return findMinutesUrl(html, item.releaseAt);
  if (/projection materials|economic projections/i.test(item.label)) return documents?.sepUrl;
  if (/press conference/i.test(item.label)) return documents?.pressConferenceUrl;
  if (/implementation note/i.test(item.label)) return findImplementationUrl(meetingSection(html, item.releaseAt));
  if (isFomcPolicyDocumentLabel(item.label)) return documents?.statementUrl;
  return undefined;
}

export async function fetchFedOfficialEnrichments(items: MacroEventItem[]): Promise<MacroSourceEnrichment[]> {
  const fedItems = items.filter((item) => /fomc|fed funds|federal funds|fed interest rate|powell|fed chair|beige book/i.test(item.label));
  if (fedItems.length === 0) return [];

  let html = "";
  try {
    html = await fetchFedHtml(FED_FOMC_CALENDAR_URL, { maxBytes: FED_CALENDAR_MAX_BYTES, timeoutMs: 10_000, allowCalendar: true });
  } catch {
    html = "";
  }

  const documentsByDate = new Map<string, FomcCalendarDocuments>();
  for (const item of fedItems) {
    const documents = findFomcCalendarDocuments(html, item.releaseAt);
    if (documents) documentsByDate.set(documents.meetingDate, documents);
  }
  const assessmentPromises = new Map<string, Promise<FomcPolicyAssessment | null>>();
  for (const [date, documents] of Array.from(documentsByDate.entries())) {
    const released = fedItems.some((item) => isoDate(item.releaseAt) === date && isFomcPolicyDocumentLabel(item.label) && Date.parse(item.releaseAt) <= Date.now());
    if (released && documents.statementUrl) assessmentPromises.set(date, assessMeetingDocuments(documents).catch(() => null));
  }

  return Promise.all(fedItems.map(async (item): Promise<MacroSourceEnrichment> => {
    const documents = findFomcCalendarDocuments(html, item.releaseAt);
    const officialUrl = officialUrlForItem(html, item, documents);
    const assessment = documents && isFomcPolicyDocumentLabel(item.label)
      ? await assessmentPromises.get(documents.meetingDate)
      : null;
    return {
      matcher: exactTitleMatcher(item.label),
      matchReleasedAt: item.releaseAt,
      eventType: classifyMacroEvent(item.label),
      source: "Fed",
      sourceType: "official_page",
      sourceUrl: FED_FOMC_CALENDAR_URL,
      officialUrl,
      isOfficial: true,
      confidence: officialUrl ? 0.92 : 0.74,
      releasedAt: officialUrl ? item.releaseAt : undefined,
      staleReason: officialUrl ? undefined : "Federal Reserve 공식 문서 링크가 아직 항목 기준으로 확인되지 않았습니다.",
      ...(assessment ? { fomcPolicyAssessment: assessment } : {})
    };
  }));
}
