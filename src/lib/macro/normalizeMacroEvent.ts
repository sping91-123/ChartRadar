// 기존 매크로 일정 항목을 공식 상태 모델이 포함된 응답으로 정규화합니다.
import { type MacroEventItem } from "@/data/macroEvents";
import { classifyMacroEvent, hasConfirmedActualValue, legacyStateFromStatus, resolveMacroStatus } from "@/lib/macro/macroStatus";
import { resolveMacroSourceTrust } from "@/lib/macro/sourceTrust";
import { type MacroSourceEnrichment, type MacroSourceType, type MacroValueProvenance, type MacroValueProvider } from "@/lib/macro/types";

function normalizeId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

function countryFromItem(item: MacroEventItem) {
  if (/usd|u\.s\.|us |미국/i.test(`${item.label} ${item.summary}`)) return "US";
  return "US";
}

function categoryFromTitle(title: string) {
  if (/cpi|ppi|pce|inflation|물가/i.test(title)) return "inflation";
  if (/payroll|jobless|unemployment|earnings|고용|실업/i.test(title)) return "labor";
  if (/fomc|fed|rate|powell|연준|금리/i.test(title)) return "fed";
  if (/gdp|retail|durable|pmi|ism|sales|소비|성장/i.test(title)) return "growth";
  return "macro";
}

const RELEASE_MATCH_WINDOW_MS = 18 * 60 * 60 * 1000;

function matchesReleaseWindow(item: MacroEventItem, enrichment: MacroSourceEnrichment) {
  const matchingReleaseAt = enrichment.matchReleasedAt ?? enrichment.releasedAt;
  if (!matchingReleaseAt) return true;

  const itemTime = Date.parse(item.releaseAt);
  const enrichmentTime = Date.parse(matchingReleaseAt);
  if (!Number.isFinite(itemTime) || !Number.isFinite(enrichmentTime)) return true;

  return Math.abs(itemTime - enrichmentTime) <= RELEASE_MATCH_WINDOW_MS;
}

function pickEnrichment(item: MacroEventItem, enrichments: MacroSourceEnrichment[]) {
  return enrichments.find((candidate) => candidate.matcher.test(item.label) && matchesReleaseWindow(item, candidate));
}

function valueProvenance(sourceType: MacroSourceType | undefined, isOfficial: boolean | undefined): MacroValueProvenance {
  if (isOfficial && (sourceType === "official_api" || sourceType === "official_page")) return "official";
  if (sourceType === "public_calendar") return "public_calendar";
  if (sourceType === "operator_fallback") return "operator_fallback";
  if (sourceType === "derived") return "derived";
  return "unknown";
}

function valueProvider(sourceUrl: string | undefined, fallback: MacroValueProvider | undefined) {
  if (sourceUrl) {
    try {
      const hostname = new URL(sourceUrl).hostname.toLowerCase();
      if (hostname === "tradingeconomics.com" || hostname.endsWith(".tradingeconomics.com")) return "TradingEconomics";
      if (hostname === "forexfactory.com" || hostname.endsWith(".forexfactory.com")) return "ForexFactory";
    } catch {
      // Retain the explicit provider when a legacy URL cannot be parsed.
    }
  }
  return fallback;
}

export function normalizeMacroEvent(item: MacroEventItem, enrichments: MacroSourceEnrichment[] = [], nowMs = Date.now()): MacroEventItem {
  const enrichment = pickEnrichment(item, enrichments);
  const eventType = enrichment?.eventType ?? item.eventType ?? classifyMacroEvent(item.label);
  const releaseTime = Date.parse(item.releaseAt);
  const canUseOfficialActual = !Number.isFinite(releaseTime) || releaseTime <= nowMs;
  const enrichmentHasActual = canUseOfficialActual && hasConfirmedActualValue(enrichment?.actualValue);
  const actualValue = enrichmentHasActual ? enrichment?.actualValue : (item.actualValue ?? item.actual);
  const actualProvenance = enrichmentHasActual
    ? enrichment?.actualProvenance ?? valueProvenance(enrichment?.sourceType, enrichment?.isOfficial)
    : item.actualProvenance ?? valueProvenance(item.sourceType, item.isOfficial);
  const source = enrichment?.source ?? item.source;
  const sourceUrl = enrichment?.sourceUrl ?? item.sourceUrl;
  const { isOfficial, officialUrl } = resolveMacroSourceTrust({
    source,
    sourceUrl,
    officialUrl: enrichment?.officialUrl ?? item.officialUrl,
    enrichmentOfficial: enrichment?.isOfficial,
    itemOfficial: item.isOfficial,
    sourceType: enrichment?.sourceType ?? item.sourceType
  });
  const releasedAt = enrichment?.releasedAt ?? item.releasedAt;
  const status = enrichment?.status
    ? {
        status: enrichment.status,
        statusLabel: enrichment.statusLabel ?? item.statusLabel ?? "공식 발표 확인",
        nextRefreshMs: item.nextRefreshMs ?? 30 * 60 * 1000,
        releasedAt,
        staleReason: enrichment.staleReason ?? item.staleReason
      }
    : resolveMacroStatus({
        title: item.label,
        eventType,
        scheduledAt: item.releaseAt,
        actualValue,
        officialUrl,
        releasedAt,
        nowMs
      });

  const isDocumentEvent = eventType === "document_release" || eventType === "meeting_event" || eventType === "speech_event";
  const isNumericEvent = eventType === "numeric_release";
  const consensusValue = enrichment?.consensusValue ?? item.consensusValue ?? item.forecast;
  const previousValue = enrichment?.previousValue ?? item.previousValue ?? item.previous;
  const consensusProvenance = enrichment?.consensusValue
    ? enrichment.consensusProvenance ?? valueProvenance(enrichment.sourceType, enrichment.isOfficial)
    : item.consensusProvenance ?? valueProvenance(item.sourceType, item.isOfficial);
  const previousProvenance = enrichment?.previousValue
    ? enrichment.previousProvenance ?? valueProvenance(enrichment.sourceType, enrichment.isOfficial)
    : item.previousProvenance ?? valueProvenance(item.sourceType, item.isOfficial);

  return {
    ...item,
    id: item.id ?? `${normalizeId(item.label)}-${Date.parse(item.releaseAt) || nowMs}`,
    title: item.title ?? item.label,
    country: item.country ?? countryFromItem(item),
    category: item.category ?? categoryFromTitle(item.label),
    eventType,
    status: status.status,
    statusLabel: status.statusLabel,
    scheduledAt: item.scheduledAt ?? item.releaseAt,
    releasedAt: status.releasedAt ?? releasedAt,
    actual: actualValue ?? item.actual,
    forecast: consensusValue ?? item.forecast,
    previous: previousValue ?? item.previous,
    actualValue,
    actualProvenance,
    actualProvider: enrichmentHasActual ? enrichment?.actualProvider ?? enrichment?.source : item.actualProvider,
    actualSourceUrl: enrichmentHasActual ? enrichment?.actualSourceUrl ?? enrichment?.officialUrl ?? enrichment?.sourceUrl : item.actualSourceUrl,
    actualReportingPeriod: enrichmentHasActual ? enrichment?.actualReportingPeriod : item.actualReportingPeriod,
    actualObservedAt: enrichmentHasActual ? enrichment?.actualObservedAt : item.actualObservedAt,
    consensusValue,
    consensusProvenance,
    consensusProvider: consensusValue
      ? enrichment?.consensusValue
        ? valueProvider(enrichment.consensusSourceUrl ?? enrichment.sourceUrl, enrichment.consensusProvider ?? enrichment.source)
        : valueProvider(item.consensusSourceUrl ?? item.sourceUrl, item.consensusProvider ?? item.source)
      : undefined,
    consensusSourceUrl: consensusValue
      ? enrichment?.consensusValue ? enrichment.consensusSourceUrl ?? enrichment.sourceUrl : item.consensusSourceUrl ?? item.sourceUrl
      : undefined,
    previousValue,
    previousProvenance,
    unit: enrichment?.unit ?? item.unit,
    source,
    sourceType: enrichment?.sourceType ?? item.sourceType ?? (source === "ForexFactory" ? "public_calendar" : "official_page"),
    sourceUrl,
    officialUrl,
    confidence: enrichment?.confidence ?? item.confidence ?? (enrichment?.isOfficial ? 0.9 : 0.7),
    staleReason: status.staleReason ?? enrichment?.staleReason ?? item.staleReason,
    nextRefreshMs: status.nextRefreshMs,
    isOfficial,
    isDocumentEvent,
    isNumericEvent,
    state: legacyStateFromStatus(status.status)
  };
}

export function normalizeMacroEvents(items: MacroEventItem[], enrichments: MacroSourceEnrichment[] = [], nowMs = Date.now()) {
  return items.map((item) => normalizeMacroEvent(item, enrichments, nowMs));
}
