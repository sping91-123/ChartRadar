// 공개 경제 캘린더와 공식 통계 데이터를 합쳐 매크로 일정을 제공합니다.
import {
  macroCalendarSourceNote,
  macroCalendarUpdatedAt,
  macroCalendarUpdatedAtIso,
  macroItems,
  type MacroEventImportance,
  type MacroEventItem
} from "@/data/macroEvents";
import { hasConfirmedActualValue } from "@/lib/macro/macroStatus";
import { normalizeMacroEvents } from "@/lib/macro/normalizeMacroEvent";
import { getBeaOfficialEnrichments } from "@/lib/macro/sourceAdapters/bea";
import { fetchBlsOfficialActuals } from "@/lib/macro/sourceAdapters/bls";
import { getCensusOfficialEnrichments } from "@/lib/macro/sourceAdapters/census";
import { fetchDolOfficialEnrichments } from "@/lib/macro/sourceAdapters/dol";
import { fetchFedOfficialEnrichments } from "@/lib/macro/sourceAdapters/fed";
import { type MacroSourceEnrichment } from "@/lib/macro/types";

export type MacroCalendarSource = "forex-factory" | "official-bls" | "automatic-mixed";

export type MacroCalendarPayload = {
  updatedAt: string;
  updatedAtLabel: string;
  source: MacroCalendarSource;
  sourceLabel: string;
  sourceNote: string;
  isAutomatic: boolean;
  nextRefreshMs: number;
  items: MacroEventItem[];
  warning?: string;
};

type ForexFactoryEvent = {
  title?: string;
  country?: string;
  date?: string;
  impact?: "High" | "Medium" | "Low" | string;
  forecast?: string;
  previous?: string;
  actual?: string;
};

const FOREX_FACTORY_THIS_WEEK = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
const KST_TIME_ZONE = "Asia/Seoul";
const RECENT_RELEASE_MS = 24 * 60 * 60 * 1000;
const PREVIOUS_RELEASE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const JOBLESS_CLAIMS_PATTERN =
  /신규\s*실업수당\s*청구|initial\s+jobless\s+claims|initial\s+claims|jobless\s+claims|unemployment\s+claims|unemployment\s+insurance\s+weekly\s+claims|continuing\s+claims/i;

const IMPORTANT_USD_EVENTS = [
  /cpi/i,
  /ppi/i,
  /retail sales/i,
  JOBLESS_CLAIMS_PATTERN,
  /non-farm|nonfarm|nfp/i,
  /unemployment rate/i,
  /average hourly earnings/i,
  /pce/i,
  /gdp/i,
  /ism/i,
  /pmi/i,
  /fomc|fed funds|federal funds/i,
  /powell|fed chair/i,
  /existing home sales/i,
  /new home sales/i,
  /consumer confidence/i,
  /durable goods/i,
  /jolts/i
];

const FED_DECISION_EVENTS = [
  /fomc statement/i,
  /fomc press conference/i,
  /fomc economic projections/i,
  /federal funds rate/i,
  /fed interest rate decision/i,
  /fed rate decision/i
];

let cachedPayload: { expiresAt: number; payload: MacroCalendarPayload } | null = null;

function formatKstDateTime(iso: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "시간 확인 필요";

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KST_TIME_ZONE,
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function formatKstShort(iso: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "시간 확인 필요";

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KST_TIME_ZONE,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function normalizeTitle(title: string) {
  return title.replace(/\s+/g, " ").trim();
}

function isImportantUsdEvent(event: ForexFactoryEvent) {
  if (event.country !== "USD") return false;
  const title = normalizeTitle(event.title ?? "");
  if (!title) return false;
  if (/speaks|speech|testifies|testimony|member/i.test(title) && !FED_DECISION_EVENTS.some((pattern) => pattern.test(title))) {
    return false;
  }
  if (event.impact === "High") return true;
  return IMPORTANT_USD_EVENTS.some((pattern) => pattern.test(title));
}

function importanceFromImpact(impact?: string): MacroEventImportance {
  if (impact === "High") return 3;
  if (impact === "Medium") return 2;
  return 1;
}

function sourceFromTitle(title: string): MacroEventItem["source"] {
  if (JOBLESS_CLAIMS_PATTERN.test(title)) return "DOL";
  if (/new home sales/i.test(title)) return "Census";
  if (/existing home sales/i.test(title)) return "NAR";
  if (/retail|durable goods/i.test(title)) return "Census";
  if (/fomc|fed|powell/i.test(title)) return "Fed";
  if (/gdp|pce/i.test(title)) return "BEA";
  if (/cpi|ppi|nfp|payroll|unemployment rate|earnings|jolts/i.test(title)) return "BLS";
  return "ForexFactory";
}

function sourceUrlFromTitle(title: string) {
  if (JOBLESS_CLAIMS_PATTERN.test(title)) return "https://oui.doleta.gov/unemploy/claims.asp";
  if (/retail/i.test(title)) return "https://www.census.gov/retail";
  if (/new home sales/i.test(title)) return "https://www.census.gov/construction/nrs/";
  if (/existing home sales/i.test(title)) return "https://www.nar.realtor/research-and-statistics";
  if (/fomc|fed|powell/i.test(title)) return "https://www.federalreserve.gov/monetarypolicy.htm";
  if (/gdp|pce/i.test(title)) return "https://www.bea.gov/news/schedule";
  if (/cpi/i.test(title)) return "https://www.bls.gov/cpi/";
  if (/ppi/i.test(title)) return "https://www.bls.gov/ppi/";
  return "https://www.forexfactory.com/calendar";
}

function eventState(releaseAt: string): MacroEventItem["state"] {
  const time = Date.parse(releaseAt);
  if (!Number.isFinite(time)) return "watch";
  return time <= Date.now() ? "released" : "upcoming";
}

function eventSummary(title: string) {
  if (/cpi/i.test(title)) return "미국 소비자물가 발표입니다. 예상보다 높으면 금리 부담이 커지고, 예상보다 낮으면 위험자산 반등 명분이 생길 수 있습니다.";
  if (/ppi/i.test(title)) return "미국 생산자물가 발표입니다. 기업 비용 압력과 향후 소비자물가 흐름을 가늠하는 자료입니다.";
  if (/retail sales/i.test(title)) return "미국 소비 흐름을 확인하는 발표입니다. 소비가 강하면 경기 체력은 좋지만 금리 부담도 다시 커질 수 있습니다.";
  if (JOBLESS_CLAIMS_PATTERN.test(title)) return "미국 고용 둔화 여부를 매주 확인하는 지표입니다. 청구건수가 급증하면 경기 둔화 우려가 커질 수 있습니다.";
  if (/fomc|fed|powell/i.test(title)) return "연준의 금리 경로와 유동성 기대가 바뀔 수 있는 이벤트입니다.";
  if (/gdp/i.test(title)) return "미국 성장률을 확인하는 지표입니다. 성장 둔화와 물가 압력을 함께 해석해야 합니다.";
  if (/pce/i.test(title)) return "연준이 중요하게 보는 물가 지표입니다. 금리 기대에 직접적인 영향을 줄 수 있습니다.";
  if (/home sales/i.test(title)) return "주택시장 체력을 확인하는 지표입니다. 금리 부담과 소비 심리를 함께 볼 수 있습니다.";
  return "미국 시장에 영향을 줄 수 있는 주요 매크로 일정입니다. 발표 직후 가격 반응과 거래량 변화를 함께 확인해야 합니다.";
}

function marketImpact(title: string) {
  if (/cpi|ppi|pce/i.test(title)) {
    return "예상보다 높으면 금리 부담이 커져 코인과 성장주에는 단기 부담이 될 수 있습니다. 예상보다 낮으면 위험자산 반등 명분이 생길 수 있습니다.";
  }
  if (/retail sales|gdp/i.test(title)) {
    return "강한 수치는 경기 자신감에는 긍정적이지만 금리 인하 기대를 늦출 수 있습니다. 약한 수치는 경기 둔화 우려와 금리 완화 기대가 동시에 나올 수 있습니다.";
  }
  if (JOBLESS_CLAIMS_PATTERN.test(title) || /unemployment|payroll|nfp/i.test(title)) {
    return "고용이 너무 강하면 금리 부담, 너무 약하면 경기 둔화 우려가 커집니다. 발표 직후에는 방향보다 변동성 관리가 먼저입니다.";
  }
  if (/fomc|fed|powell/i.test(title)) {
    return "매파적인 표현은 위험자산에 부담이고, 비둘기파적인 표현은 유동성 기대를 살릴 수 있습니다. 달러와 미국채 금리를 같이 봐야 합니다.";
  }
  return "결과가 예상치에서 크게 벗어나면 단기 변동성이 커질 수 있습니다. 차트 방향과 거래량 반응을 함께 확인하세요.";
}

function sortItems(items: MacroEventItem[]) {
  const now = Date.now();
  return [...items].sort((a, b) => {
    const aTime = Date.parse(a.releaseAt);
    const bTime = Date.parse(b.releaseAt);
    const aRecent = aTime <= now && now - aTime <= RECENT_RELEASE_MS ? 0 : 1;
    const bRecent = bTime <= now && now - bTime <= RECENT_RELEASE_MS ? 0 : 1;
    if (aRecent !== bRecent) return aRecent - bRecent;
    if (aTime >= now && bTime >= now) return aTime - bTime;
    return bTime - aTime;
  });
}

function eventDedupeKey(item: MacroEventItem) {
  const dateKey = Number.isFinite(Date.parse(item.releaseAt)) ? new Date(item.releaseAt).toISOString().slice(0, 10) : item.releaseAt;
  return `${normalizeTitle(item.label).toLowerCase()}|${dateKey}|${item.source}`;
}

function isRecentReleasedMacroFallback(item: MacroEventItem, now: number) {
  const releaseTime = Date.parse(item.releaseAt);
  if (!Number.isFinite(releaseTime)) return false;
  if (releaseTime > now || now - releaseTime > PREVIOUS_RELEASE_RETENTION_MS) return false;
  if (item.importance === 3) return true;
  return IMPORTANT_USD_EVENTS.some((pattern) => pattern.test(item.label));
}

function normalizeRecentReleasedFallback(item: MacroEventItem): MacroEventItem {
  const hasActual = hasConfirmedActualValue(item.actualValue ?? item.actual);
  const isDocumentEvent = item.eventType === "document_release" || item.eventType === "meeting_event" || item.eventType === "speech_event" || item.isDocumentEvent;

  return {
    ...item,
    state: "released",
    status: hasActual ? "released" : isDocumentEvent ? "official_check_needed" : "official_check_needed",
    statusLabel: hasActual ? "결과 공개" : isDocumentEvent ? "공식 문서 확인 필요" : "공식 발표 확인 필요",
    actual: hasActual ? item.actual : undefined,
    actualValue: hasActual ? item.actualValue : undefined
  };
}

function getRecentReleasedMacroFallbacks(now: number) {
  return macroItems.filter((item) => isRecentReleasedMacroFallback(item, now)).map(normalizeRecentReleasedFallback);
}

function mergeRecentReleasedEvents(baseItems: MacroEventItem[], now: number) {
  const seen = new Set(baseItems.map(eventDedupeKey));
  const merged = [...baseItems];

  for (const item of getRecentReleasedMacroFallbacks(now)) {
    const key = eventDedupeKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  return merged;
}

function getRefreshMs(items: MacroEventItem[]) {
  const itemRefreshMs = items
    .map((item) => item.nextRefreshMs)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
  if (itemRefreshMs.length > 0) return Math.max(60 * 1000, Math.min(...itemRefreshMs));

  const now = Date.now();
  const nearest = items
    .map((item) => Date.parse(item.releaseAt))
    .filter((time) => Number.isFinite(time))
    .sort((a, b) => Math.abs(a - now) - Math.abs(b - now))[0];

  if (!nearest) return 5 * 60 * 1000;
  const distance = Math.abs(nearest - now);
  if (distance <= 30 * 60 * 1000) return 60 * 1000;
  if (distance <= 3 * 60 * 60 * 1000) return 3 * 60 * 1000;
  return 10 * 60 * 1000;
}

async function fetchForexFactoryEvents() {
  const response = await fetch(FOREX_FACTORY_THIS_WEEK, {
    headers: { "user-agent": "ChartRadarBot/1.0 (+https://chartradar.ai)" },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`ForexFactory calendar ${response.status}`);
  return (await response.json()) as ForexFactoryEvent[];
}

function toMacroItem(event: ForexFactoryEvent): MacroEventItem | null {
  const title = normalizeTitle(event.title ?? "");
  const releaseAt = event.date ? new Date(event.date).toISOString() : "";
  if (!title || !releaseAt || !Number.isFinite(Date.parse(releaseAt))) return null;

  return {
    label: title,
    releaseAt,
    dateKst: formatKstShort(releaseAt),
    state: eventState(releaseAt),
    importance: importanceFromImpact(event.impact),
    forecast: event.forecast || undefined,
    previous: event.previous || undefined,
    actual: event.actual || undefined,
    summary: eventSummary(title),
    marketImpact: marketImpact(title),
    source: sourceFromTitle(title),
    sourceUrl: sourceUrlFromTitle(title)
  };
}

async function getOfficialEnrichments(items: MacroEventItem[]) {
  const [blsEnrichments, fedEnrichments, dolEnrichments] = await Promise.all([
    fetchBlsOfficialActuals().catch(() => [] as MacroSourceEnrichment[]),
    fetchFedOfficialEnrichments(items).catch(() => [] as MacroSourceEnrichment[]),
    fetchDolOfficialEnrichments(items).catch(() => [] as MacroSourceEnrichment[])
  ]);

  return [
    ...blsEnrichments,
    ...fedEnrichments,
    ...getBeaOfficialEnrichments(),
    ...getCensusOfficialEnrichments(),
    ...dolEnrichments
  ];
}

export function getFallbackPayload(warning: string): MacroCalendarPayload {
  const updatedAt = macroCalendarUpdatedAtIso || new Date().toISOString();
  const items = sortItems(normalizeMacroEvents(macroItems.map((item) => ({ ...item, state: eventState(item.releaseAt) }))));

  return {
    updatedAt,
    updatedAtLabel: macroCalendarUpdatedAt,
    source: "automatic-mixed",
    sourceLabel: "예비 일정 + 자동 재시도",
    sourceNote: macroCalendarSourceNote,
    isAutomatic: true,
    nextRefreshMs: getRefreshMs(items),
    items,
    warning
  };
}

export async function getMacroCalendarPayload(): Promise<MacroCalendarPayload> {
  const now = Date.now();
  if (cachedPayload && cachedPayload.expiresAt > now) return cachedPayload.payload;

  try {
    const events = await fetchForexFactoryEvents();
    const baseItems = events
      .filter(isImportantUsdEvent)
      .map(toMacroItem)
      .filter((item): item is MacroEventItem => Boolean(item))
      .filter((item) => {
        const time = Date.parse(item.releaseAt);
        return time >= now || now - time <= PREVIOUS_RELEASE_RETENTION_MS;
      });
    const mergedBaseItems = mergeRecentReleasedEvents(baseItems, now);
    const enrichments = await getOfficialEnrichments(mergedBaseItems);
    const items = normalizeMacroEvents(mergedBaseItems, enrichments, now);
    const sorted = sortItems(items).slice(0, 18);
    const updatedAt = new Date().toISOString();
    const payload: MacroCalendarPayload = {
      updatedAt,
      updatedAtLabel: `${formatKstDateTime(updatedAt)} 자동 갱신`,
      source: enrichments.length ? "automatic-mixed" : "forex-factory",
      sourceLabel: enrichments.length ? "공개 캘린더 + 공식 발표 확인" : "공개 경제 캘린더",
      sourceNote: "일정은 공개 캘린더로 자동 확인하고, 숫자형 지표는 가능한 공식 통계로 보강합니다. 문서형 이벤트는 실제값 대신 공식 문서 공개 상태로 표시합니다.",
      isAutomatic: true,
      nextRefreshMs: getRefreshMs(sorted),
      items: sorted.length ? sorted : getFallbackPayload("공개 캘린더가 비어 있어 예비 일정을 표시합니다.").items,
      warning: enrichments.length ? undefined : "일부 공식 발표 확인이 지연될 수 있습니다."
    };

    cachedPayload = { payload, expiresAt: now + payload.nextRefreshMs };
    return payload;
  } catch (error) {
    const fallback = getFallbackPayload(error instanceof Error ? error.message : "매크로 자동 갱신 실패");
    const enrichments = await getOfficialEnrichments(fallback.items).catch(() => [] as MacroSourceEnrichment[]);
    const items = enrichments.length ? sortItems(normalizeMacroEvents(fallback.items, enrichments, now)) : fallback.items;
    const payload = {
      ...fallback,
      sourceLabel: enrichments.length ? "예비 일정 + 공식 발표 확인" : fallback.sourceLabel,
      nextRefreshMs: getRefreshMs(items),
      items
    };
    cachedPayload = { payload, expiresAt: now + payload.nextRefreshMs };
    return payload;
  }
}

export function getMacroCalendarFallbackPayload() {
  return getFallbackPayload("자동 캘린더를 불러오는 중입니다.");
}
