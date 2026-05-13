// 외부 경제 캘린더와 백업 일정을 합쳐 매크로 레이더 데이터를 제공합니다.
import {
  macroCalendarSourceNote,
  macroCalendarUpdatedAt,
  macroCalendarUpdatedAtIso,
  macroItems,
  type MacroEventImportance,
  type MacroEventItem,
  type MacroEventSource,
  type MacroEventState
} from "@/data/macroEvents";

export type MacroCalendarSource = "trading-economics" | "curated";

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

type TradingEconomicsCalendarItem = {
  Date?: string;
  Country?: string;
  Category?: string;
  Event?: string;
  Source?: string;
  SourceURL?: string;
  Actual?: string | number | null;
  Previous?: string | number | null;
  Forecast?: string | number | null;
  TEForecast?: string | number | null;
  Importance?: string | number | null;
  LastUpdate?: string;
  URL?: string;
  Unit?: string;
  Currency?: string;
};

const EMPTY_VALUES = new Set(["", "-", "null", "undefined"]);
const IMPORTANT_EVENT_KEYWORDS = [
  "cpi",
  "consumer price",
  "ppi",
  "producer price",
  "pce",
  "non farm",
  "nonfarm",
  "unemployment",
  "jobless",
  "payroll",
  "retail sales",
  "gdp",
  "fomc",
  "fed interest rate",
  "interest rate",
  "ism",
  "pmi",
  "existing home sales",
  "new home sales",
  "industrial production",
  "durable goods",
  "jolts"
];

let cachedPayload: { expiresAt: number; payload: MacroCalendarPayload } | null = null;

function normalizeValue(value: unknown) {
  if (value === null || value === undefined) return undefined;
  const text = String(value).replace(/\s+/g, " ").trim();
  if (EMPTY_VALUES.has(text.toLowerCase())) return undefined;
  return text;
}

function getTradingEconomicsKey() {
  return (
    process.env.TRADING_ECONOMICS_API_KEY ||
    (process.env.TRADING_ECONOMICS_CLIENT && process.env.TRADING_ECONOMICS_SECRET
      ? `${process.env.TRADING_ECONOMICS_CLIENT}:${process.env.TRADING_ECONOMICS_SECRET}`
      : "")
  ).trim();
}

function formatKstDateTime(iso: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "시간 확인 필요";

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  })
    .format(date)
    .replace(/\s/g, " ");
}

function parseTradingEconomicsDate(value?: string) {
  if (!value) return "";
  const trimmed = value.trim();
  const withTimezone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(trimmed) ? trimmed : `${trimmed}Z`;
  const date = new Date(withTimezone);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

function getState(releaseAt: string, actual?: string): MacroEventState {
  const releaseMs = Date.parse(releaseAt);
  if (!Number.isFinite(releaseMs)) return "watch";
  if (releaseMs <= Date.now()) return actual ? "released" : "upcoming";
  return "upcoming";
}

function toImportance(value: unknown): MacroEventImportance {
  const numeric = Number(value);
  if (numeric >= 3) return 3;
  if (numeric === 2) return 2;
  return 1;
}

function toSource(value: unknown): MacroEventSource {
  const text = String(value ?? "").toLowerCase();
  if (text.includes("federal reserve") || text.includes("fed")) return "Fed";
  if (text.includes("bureau of labor") || text.includes("bls") || text.includes("department of labor")) return "BLS";
  if (text.includes("bureau of economic") || text.includes("bea")) return "BEA";
  if (text.includes("census")) return "Census";
  if (text.includes("realtor") || text.includes("nar")) return "NAR";
  return "TradingEconomics";
}

function isImportantUsEvent(item: TradingEconomicsCalendarItem) {
  const country = String(item.Country ?? "").toLowerCase();
  if (country && country !== "united states") return false;

  const joined = `${item.Category ?? ""} ${item.Event ?? ""}`.toLowerCase();
  const importance = Number(item.Importance ?? 0);
  return importance >= 2 || IMPORTANT_EVENT_KEYWORDS.some((keyword) => joined.includes(keyword));
}

function buildSummary(item: TradingEconomicsCalendarItem, actual?: string, forecast?: string, previous?: string) {
  const event = normalizeValue(item.Event) ?? normalizeValue(item.Category) ?? "미국 경제지표";
  const category = normalizeValue(item.Category);

  if (actual) {
    const comparison = forecast ? `예상치 ${forecast}와 비교해 실제값 ${actual}이 확인됐습니다.` : `실제값 ${actual}이 확인됐습니다.`;
    return `${event} 발표가 나왔습니다. ${comparison} 이전값은 ${previous ?? "확인 필요"}입니다.`;
  }

  return `${event} 발표를 앞두고 있습니다. 예상치는 ${forecast ?? "확인 필요"}, 이전값은 ${previous ?? "확인 필요"}입니다.${category ? ` ${category} 흐름과 함께 확인해 주세요.` : ""}`;
}

function buildMarketImpact(item: TradingEconomicsCalendarItem, actual?: string, forecast?: string) {
  const joined = `${item.Category ?? ""} ${item.Event ?? ""}`.toLowerCase();
  const event = normalizeValue(item.Event) ?? "해당 지표";
  const hasActual = Boolean(actual);
  const action = hasActual ? "발표 직후에는" : "발표 전후에는";

  if (joined.includes("cpi") || joined.includes("price") || joined.includes("pce")) {
    return `${action} 금리 기대, 달러, 나스닥 반응이 위험자산 방향을 크게 흔들 수 있습니다. 실제값이 예상치(${forecast ?? "미정"})보다 강하면 긴축 부담으로 해석될 수 있습니다.`;
  }
  if (joined.includes("jobless") || joined.includes("unemployment") || joined.includes("payroll")) {
    return `${action} 고용이 너무 강하면 금리 부담, 너무 약하면 경기 둔화 우려가 커질 수 있습니다. 코인과 성장주는 금리와 달러 반응을 같이 봐야 합니다.`;
  }
  if (joined.includes("retail") || joined.includes("gdp") || joined.includes("ism") || joined.includes("pmi")) {
    return `${action} 경기 강도 해석이 바뀔 수 있습니다. ${event}가 예상보다 강하면 경기민감 자산에는 우호적일 수 있지만 금리 부담도 함께 확인해야 합니다.`;
  }
  if (joined.includes("home") || joined.includes("housing")) {
    return `${action} 주택과 금리 부담을 같이 확인해야 합니다. 예상보다 약하면 성장 둔화 쪽 해석이 커질 수 있습니다.`;
  }
  return `${action} 실제값과 예상치의 차이가 가격 변동성을 키울 수 있습니다. 지표 하나보다 달러, 국채금리, 지수 반응을 함께 확인하세요.`;
}

function mapTradingEconomicsItem(item: TradingEconomicsCalendarItem): MacroEventItem | null {
  const releaseAt = parseTradingEconomicsDate(item.Date);
  if (!releaseAt || !Number.isFinite(Date.parse(releaseAt))) return null;

  const actual = normalizeValue(item.Actual);
  const forecast = normalizeValue(item.Forecast) ?? normalizeValue(item.TEForecast);
  const previous = normalizeValue(item.Previous);
  const label = normalizeValue(item.Event) ?? normalizeValue(item.Category) ?? "미국 경제지표";
  const sourceUrl = normalizeValue(item.SourceURL) ?? (item.URL ? `https://tradingeconomics.com${item.URL}` : "https://tradingeconomics.com/united-states/calendar");

  return {
    label,
    releaseAt,
    dateKst: formatKstDateTime(releaseAt),
    state: getState(releaseAt, actual),
    importance: toImportance(item.Importance),
    actual: actual ?? "발표 전",
    forecast: forecast ?? "확인 필요",
    previous: previous ?? "확인 필요",
    summary: buildSummary(item, actual, forecast, previous),
    marketImpact: buildMarketImpact(item, actual, forecast),
    source: toSource(item.Source),
    sourceUrl
  };
}

function sortedItems(items: MacroEventItem[]) {
  const now = Date.now();
  return [...items].sort((a, b) => {
    const aTime = Date.parse(a.releaseAt);
    const bTime = Date.parse(b.releaseAt);
    const aRecent = aTime <= now && now - aTime <= 24 * 60 * 60 * 1000 ? 0 : 1;
    const bRecent = bTime <= now && now - bTime <= 24 * 60 * 60 * 1000 ? 0 : 1;
    if (aRecent !== bRecent) return aRecent - bRecent;
    if (aTime >= now && bTime >= now) return aTime - bTime;
    return bTime - aTime;
  });
}

function getFallbackPayload(warning?: string): MacroCalendarPayload {
  return {
    updatedAt: macroCalendarUpdatedAtIso,
    updatedAtLabel: macroCalendarUpdatedAt,
    source: "curated",
    sourceLabel: "백업 일정",
    sourceNote: macroCalendarSourceNote,
    isAutomatic: false,
    nextRefreshMs: 10 * 60 * 1000,
    items: sortedItems(macroItems),
    warning
  };
}

function getDateRange() {
  const start = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const end = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
  const toDate = (date: Date) => date.toISOString().slice(0, 10);
  return { start: toDate(start), end: toDate(end) };
}

function getRefreshMs(items: MacroEventItem[]) {
  const now = Date.now();
  const nearest = items
    .map((item) => Date.parse(item.releaseAt))
    .filter((time) => Number.isFinite(time))
    .sort((a, b) => Math.abs(a - now) - Math.abs(b - now))[0];

  if (!nearest) return 10 * 60 * 1000;
  const distance = Math.abs(nearest - now);
  if (distance <= 30 * 60 * 1000) return 60 * 1000;
  if (distance <= 3 * 60 * 60 * 1000) return 3 * 60 * 1000;
  return 10 * 60 * 1000;
}

async function fetchTradingEconomicsCalendar(): Promise<MacroCalendarPayload | null> {
  const key = getTradingEconomicsKey();
  if (!key) return null;

  const { start, end } = getDateRange();
  const url = new URL(`https://api.tradingeconomics.com/calendar/country/All/${start}/${end}`);
  url.searchParams.set("c", key);
  url.searchParams.set("f", "json");

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Trading Economics calendar ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  const rows = Array.isArray(payload) ? payload : [];
  const items = rows
    .filter((row): row is TradingEconomicsCalendarItem => Boolean(row && typeof row === "object"))
    .filter(isImportantUsEvent)
    .map(mapTradingEconomicsItem)
    .filter((item): item is MacroEventItem => Boolean(item))
    .slice(0, 24);

  if (items.length === 0) {
    throw new Error("Trading Economics calendar returned no usable US events.");
  }

  const sorted = sortedItems(items);
  const updatedAt = new Date().toISOString();

  return {
    updatedAt,
    updatedAtLabel: `${formatKstDateTime(updatedAt)} 자동 갱신`,
    source: "trading-economics",
    sourceLabel: "자동 캘린더",
    sourceNote: "Trading Economics 경제 캘린더를 기준으로 실제값, 예상치, 이전값을 자동 갱신합니다. 모든 시간은 한국시간입니다.",
    isAutomatic: true,
    nextRefreshMs: getRefreshMs(sorted),
    items: sorted
  };
}

export async function getMacroCalendarPayload(): Promise<MacroCalendarPayload> {
  const now = Date.now();
  if (cachedPayload && cachedPayload.expiresAt > now) {
    return cachedPayload.payload;
  }

  try {
    const automaticPayload = await fetchTradingEconomicsCalendar();
    if (automaticPayload) {
      cachedPayload = {
        payload: automaticPayload,
        expiresAt: now + automaticPayload.nextRefreshMs
      };
      return automaticPayload;
    }
  } catch (error) {
    console.warn("[macroCalendar] 자동 캘린더 갱신 실패. 백업 일정으로 대체합니다.", error);
    const fallback = getFallbackPayload("자동 캘린더 연결에 실패해 백업 일정을 표시합니다.");
    cachedPayload = {
      payload: fallback,
      expiresAt: now + 5 * 60 * 1000
    };
    return fallback;
  }

  const fallback = getFallbackPayload("TRADING_ECONOMICS_API_KEY가 없어 백업 일정을 표시합니다.");
  cachedPayload = {
    payload: fallback,
    expiresAt: now + fallback.nextRefreshMs
  };
  return fallback;
}

export function getMacroCalendarFallbackPayload() {
  return getFallbackPayload();
}
