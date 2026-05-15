// 공개 경제 캘린더와 공식 통계 데이터를 합쳐 매크로 일정을 제공합니다.
import {
  macroCalendarSourceNote,
  macroCalendarUpdatedAt,
  macroCalendarUpdatedAtIso,
  macroItems,
  type MacroEventImportance,
  type MacroEventItem
} from "@/data/macroEvents";

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

type BlsPoint = {
  year: string;
  period: string;
  value: string;
};

type BlsSeries = {
  seriesID: string;
  data?: BlsPoint[];
};

type BlsApiResponse = {
  status?: string;
  Results?: {
    series?: BlsSeries[];
  };
};

type OfficialActual = {
  matcher: RegExp;
  actual: string;
  sourceUrl: string;
};

const FOREX_FACTORY_THIS_WEEK = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
const BLS_PUBLIC_API_URL = "https://api.bls.gov/publicAPI/v2/timeseries/data/";
const KST_TIME_ZONE = "Asia/Seoul";
const RECENT_RELEASE_MS = 24 * 60 * 60 * 1000;
const BLS_SERIES = {
  cpi: "CUSR0000SA0",
  coreCpi: "CUSR0000SA0L1E",
  ppi: "WPSFD4",
  corePpi: "WPSFD49116"
} as const;

const IMPORTANT_USD_EVENTS = [
  /cpi/i,
  /ppi/i,
  /retail sales/i,
  /jobless|unemployment claims/i,
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
  if (/speaks|speech|testifies/i.test(title) && event.impact !== "High") return false;
  if (event.impact === "High") return true;
  return IMPORTANT_USD_EVENTS.some((pattern) => pattern.test(title));
}

function importanceFromImpact(impact?: string): MacroEventImportance {
  if (impact === "High") return 3;
  if (impact === "Medium") return 2;
  return 1;
}

function sourceFromTitle(title: string): MacroEventItem["source"] {
  if (/jobless|unemployment claims/i.test(title)) return "DOL";
  if (/existing home sales|new home sales/i.test(title)) return "NAR";
  if (/retail|durable goods/i.test(title)) return "Census";
  if (/fomc|fed|powell/i.test(title)) return "Fed";
  if (/gdp|pce/i.test(title)) return "BEA";
  if (/cpi|ppi|nfp|payroll|unemployment rate|earnings|jolts/i.test(title)) return "BLS";
  return "ForexFactory";
}

function sourceUrlFromTitle(title: string) {
  if (/jobless|unemployment claims/i.test(title)) return "https://oui.doleta.gov/unemploy/claims.asp";
  if (/retail/i.test(title)) return "https://www.census.gov/retail";
  if (/existing home sales|new home sales/i.test(title)) return "https://www.nar.realtor/research-and-statistics";
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
  if (/jobless|unemployment claims/i.test(title)) return "미국 고용 둔화 여부를 매주 확인하는 지표입니다. 청구건수가 급증하면 경기 둔화 우려가 커질 수 있습니다.";
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
  if (/jobless|unemployment|payroll|nfp/i.test(title)) {
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

function getRefreshMs(items: MacroEventItem[]) {
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

function sortBlsPoints(data: BlsPoint[] = []) {
  return data
    .filter((point) => /^M\d{2}$/.test(point.period) && Number.isFinite(Number(point.value)))
    .sort((a, b) => {
      const yearDiff = Number(b.year) - Number(a.year);
      if (yearDiff !== 0) return yearDiff;
      return Number(b.period.replace("M", "")) - Number(a.period.replace("M", ""));
    });
}

function findYearAgoPoint(points: BlsPoint[], latest: BlsPoint) {
  return points.find((point) => point.year === String(Number(latest.year) - 1) && point.period === latest.period);
}

function pctChange(current: BlsPoint, base?: BlsPoint) {
  const currentValue = Number(current.value);
  const baseValue = Number(base?.value);
  if (!Number.isFinite(currentValue) || !Number.isFinite(baseValue) || baseValue === 0) return null;
  return ((currentValue - baseValue) / baseValue) * 100;
}

function formatPercent(value: number | null) {
  if (value === null) return "확인 중";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function buildBlsLine(points?: BlsPoint[]) {
  if (!points || points.length < 2) return null;
  const latest = points[0];
  return {
    latest,
    mom: pctChange(latest, points[1]),
    yoy: pctChange(latest, findYearAgoPoint(points, latest))
  };
}

export async function fetchOfficialBlsCalendar(): Promise<OfficialActual[]> {
  const now = new Date();
  const response = await fetch(BLS_PUBLIC_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      seriesid: Object.values(BLS_SERIES),
      startyear: String(now.getUTCFullYear() - 1),
      endyear: String(now.getUTCFullYear())
    }),
    cache: "no-store"
  });

  if (!response.ok) return [];
  const payload = (await response.json()) as BlsApiResponse;
  if (payload.status !== "REQUEST_SUCCEEDED") return [];

  const map = new Map((payload.Results?.series ?? []).map((series) => [series.seriesID, sortBlsPoints(series.data)]));
  const cpi = buildBlsLine(map.get(BLS_SERIES.cpi));
  const coreCpi = buildBlsLine(map.get(BLS_SERIES.coreCpi));
  const ppi = buildBlsLine(map.get(BLS_SERIES.ppi));
  const corePpi = buildBlsLine(map.get(BLS_SERIES.corePpi));
  const actuals: OfficialActual[] = [];

  if (cpi && coreCpi) {
    actuals.push({
      matcher: /cpi/i,
      actual: `CPI ${formatPercent(cpi.mom)} 전월비 / ${formatPercent(cpi.yoy)} 전년비, 근원 ${formatPercent(coreCpi.mom)} 전월비 / ${formatPercent(coreCpi.yoy)} 전년비`,
      sourceUrl: "https://www.bls.gov/cpi/"
    });
  }

  if (ppi && corePpi) {
    actuals.push({
      matcher: /ppi/i,
      actual: `PPI ${formatPercent(ppi.mom)} 전월비 / ${formatPercent(ppi.yoy)} 전년비, 근원 ${formatPercent(corePpi.mom)} 전월비 / ${formatPercent(corePpi.yoy)} 전년비`,
      sourceUrl: "https://www.bls.gov/ppi/"
    });
  }

  return actuals;
}

export function mergeOfficialInflationActuals(items: MacroEventItem[], actuals: OfficialActual[]) {
  return items.map((item) => {
    const actual = actuals.find((candidate) => candidate.matcher.test(item.label));
    if (!actual || Date.parse(item.releaseAt) > Date.now()) return item;
    return {
      ...item,
      state: "released" as const,
      actual: actual.actual,
      sourceUrl: actual.sourceUrl,
      summary: `${item.label}의 최신 공식 통계값을 확인했습니다. 예상치와 실제 발표값 차이를 시장 반응과 함께 확인하세요.`
    };
  });
}

export function getFallbackPayload(warning: string): MacroCalendarPayload {
  const updatedAt = macroCalendarUpdatedAtIso || new Date().toISOString();
  const items = sortItems(
    macroItems.map((item) => ({
      ...item,
      state: eventState(item.releaseAt)
    }))
  );

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
    const [events, actuals] = await Promise.all([fetchForexFactoryEvents(), fetchOfficialBlsCalendar().catch(() => [])]);
    const items = mergeOfficialInflationActuals(
      events
        .filter(isImportantUsdEvent)
        .map(toMacroItem)
        .filter((item): item is MacroEventItem => Boolean(item))
        .filter((item) => {
          const time = Date.parse(item.releaseAt);
          return time >= now || now - time <= RECENT_RELEASE_MS;
        }),
      actuals
    );
    const sorted = sortItems(items).slice(0, 18);
    const updatedAt = new Date().toISOString();
    const payload: MacroCalendarPayload = {
      updatedAt,
      updatedAtLabel: `${formatKstDateTime(updatedAt)} 자동 갱신`,
      source: actuals.length ? "automatic-mixed" : "forex-factory",
      sourceLabel: actuals.length ? "공개 캘린더 + 공식 통계" : "공개 경제 캘린더",
      sourceNote: "일정과 예상치는 공개 경제 캘린더에서 자동 확인하고, CPI/PPI 실제값은 BLS 공식 통계로 보강합니다.",
      isAutomatic: true,
      nextRefreshMs: getRefreshMs(sorted),
      items: sorted.length ? sorted : getFallbackPayload("공개 캘린더가 비어 있어 예비 일정을 표시합니다.").items,
      warning: actuals.length ? undefined : "일부 실제값은 공식 발표 반영까지 지연될 수 있습니다."
    };

    cachedPayload = { payload, expiresAt: now + payload.nextRefreshMs };
    return payload;
  } catch (error) {
    const payload = getFallbackPayload(error instanceof Error ? error.message : "매크로 자동 갱신 실패");
    cachedPayload = { payload, expiresAt: now + payload.nextRefreshMs };
    return payload;
  }
}

export function getMacroCalendarFallbackPayload() {
  return getFallbackPayload("자동 캘린더를 불러오는 중입니다.");
}
