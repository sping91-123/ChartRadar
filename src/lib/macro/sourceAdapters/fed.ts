// Federal Reserve 공식 페이지에서 FOMC 문서 공개 상태를 확인합니다.
import { type MacroEventItem } from "@/data/macroEvents";
import { classifyMacroEvent } from "@/lib/macro/macroStatus";
import { type MacroSourceEnrichment } from "@/lib/macro/types";

const FED_FOMC_CALENDAR_URL = "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm";
const FED_BASE_URL = "https://www.federalreserve.gov";
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function absoluteFedUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  return `${FED_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

function compactHtml(html: string) {
  return html.replace(/\s+/g, " ");
}

function releaseDateText(iso: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return `${monthNames[date.getUTCMonth()]} ${String(date.getUTCDate()).padStart(2, "0")}, ${date.getUTCFullYear()}`;
}

function findHtmlLink(section: string) {
  const htmlLink = section.match(/href="([^"]+)"[^>]*>\s*HTML\s*</i);
  if (htmlLink?.[1]) return absoluteFedUrl(htmlLink[1]);
  const anyLink = section.match(/href="([^"]+)"/i);
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

function findMeetingDocumentUrl(html: string, releaseAt: string, title: string) {
  const date = new Date(releaseAt);
  if (!Number.isFinite(date.getTime())) return undefined;
  const compact = compactHtml(html);
  const yearHeading = `${date.getUTCFullYear()} FOMC Meetings`;
  const yearIndex = compact.indexOf(yearHeading);
  if (yearIndex < 0) return undefined;
  const monthIndex = compact.indexOf(monthNames[date.getUTCMonth()], yearIndex);
  if (monthIndex < 0) return undefined;
  const section = compact.slice(monthIndex, monthIndex + 4_500);

  if (/implementation note/i.test(title)) {
    const implementationIndex = section.indexOf("Implementation Note");
    if (implementationIndex >= 0) return findHtmlLink(section.slice(Math.max(0, implementationIndex - 260), implementationIndex + 260));
  }

  if (/press conference/i.test(title)) {
    const pressIndex = section.indexOf("Press Conference");
    if (pressIndex >= 0) return findHtmlLink(section.slice(Math.max(0, pressIndex - 260), pressIndex + 260));
  }

  const statementIndex = section.indexOf("Statement:");
  if (statementIndex >= 0) return findHtmlLink(section.slice(statementIndex, statementIndex + 520));
  return undefined;
}

function fedMatcher(title: string) {
  if (/minutes/i.test(title)) return /fomc.*minutes|minutes.*fomc|meeting minutes/i;
  if (/implementation note/i.test(title)) return /implementation note|fomc.*implementation/i;
  if (/press conference/i.test(title)) return /press conference|fomc.*conference/i;
  if (/statement/i.test(title)) return /fomc.*statement|statement.*fomc/i;
  return /fomc|fed funds|federal funds|fed interest rate|powell|fed chair/i;
}

export async function fetchFedOfficialEnrichments(items: MacroEventItem[]): Promise<MacroSourceEnrichment[]> {
  const fedItems = items.filter((item) => /fomc|fed funds|federal funds|fed interest rate|powell|fed chair|beige book/i.test(item.label));
  if (fedItems.length === 0) return [];

  let html = "";
  try {
    const response = await fetch(FED_FOMC_CALENDAR_URL, {
      headers: { "user-agent": "ChartRadarBot/1.0 (+https://chartradar.kr)" },
      cache: "no-store"
    });
    if (response.ok) html = await response.text();
  } catch {
    html = "";
  }

  return fedItems.map((item) => {
    const eventType = classifyMacroEvent(item.label);
    const officialUrl = /minutes/i.test(item.label)
      ? findMinutesUrl(html, item.releaseAt)
      : findMeetingDocumentUrl(html, item.releaseAt, item.label);

    return {
      matcher: fedMatcher(item.label),
      eventType,
      source: "Fed",
      sourceType: "official_page",
      sourceUrl: FED_FOMC_CALENDAR_URL,
      officialUrl,
      isOfficial: true,
      confidence: officialUrl ? 0.92 : 0.74,
      releasedAt: officialUrl ? item.releaseAt : undefined,
      staleReason: officialUrl ? undefined : "Federal Reserve 공식 문서 링크가 아직 항목 기준으로 확인되지 않았습니다."
    };
  });
}
