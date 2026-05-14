// 공식 매크로 데이터와 보조 일정을 합쳐 레이더 캘린더를 제공합니다.
import {
  macroCalendarSourceNote,
  macroCalendarUpdatedAt,
  macroCalendarUpdatedAtIso,
  macroItems,
  type MacroEventItem
} from "@/data/macroEvents";

export type MacroCalendarSource = "official-bls" | "curated";

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

type BlsPoint = {
  year: string;
  period: string;
  periodName?: string;
  value: string;
};

type BlsSeries = {
  seriesID: string;
  data?: BlsPoint[];
};

type BlsApiResponse = {
  status?: string;
  message?: string[];
  Results?: {
    series?: BlsSeries[];
  };
};

type OfficialInflationActual = {
  label: "CPI / Core CPI" | "PPI / Core PPI";
  actual: string;
  summary: string;
  marketImpact: string;
  sourceUrl: string;
};

const BLS_PUBLIC_API_URL = "https://api.bls.gov/publicAPI/v2/timeseries/data/";
const BLS_SERIES = {
  cpi: "CUSR0000SA0",
  coreCpi: "CUSR0000SA0L1E",
  ppi: "WPSFD4",
  corePpi: "WPSFD49116"
} as const;

let cachedPayload: { expiresAt: number; payload: MacroCalendarPayload } | null = null;

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
    sourceLabel: "보조 일정",
    sourceNote: macroCalendarSourceNote,
    isAutomatic: false,
    nextRefreshMs: 10 * 60 * 1000,
    items: sortedItems(macroItems),
    warning
  };
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

function getBlsPeriodNumber(point: BlsPoint) {
  return Number(point.period.replace("M", ""));
}

function sortBlsPoints(data: BlsPoint[] = []) {
  return data
    .filter((point) => /^M\d{2}$/.test(point.period) && Number.isFinite(Number(point.value)))
    .sort((a, b) => {
      const yearDiff = Number(b.year) - Number(a.year);
      if (yearDiff !== 0) return yearDiff;
      return getBlsPeriodNumber(b) - getBlsPeriodNumber(a);
    });
}

function findYearAgoPoint(points: BlsPoint[], latest: BlsPoint) {
  const targetYear = String(Number(latest.year) - 1);
  return points.find((point) => point.year === targetYear && point.period === latest.period);
}

function pctChange(current: BlsPoint, base?: BlsPoint) {
  const currentValue = Number(current.value);
  const baseValue = Number(base?.value);
  if (!Number.isFinite(currentValue) || !Number.isFinite(baseValue) || baseValue === 0) return null;
  return ((currentValue - baseValue) / baseValue) * 100;
}

function formatPercent(value: number | null) {
  if (value === null) return "확인 필요";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function getSeriesPointMap(series: BlsSeries[]) {
  return new Map(series.map((item) => [item.seriesID, sortBlsPoints(item.data)]));
}

function buildInflationLine(points: BlsPoint[] | undefined) {
  if (!points || points.length < 2) return null;
  const latest = points[0];
  const previous = points[1];
  const yearAgo = findYearAgoPoint(points, latest);
  return {
    latest,
    mom: pctChange(latest, previous),
    yoy: pctChange(latest, yearAgo)
  };
}

function buildOfficialInflationActuals(series: BlsSeries[]): OfficialInflationActual[] {
  const seriesMap = getSeriesPointMap(series);
  const cpi = buildInflationLine(seriesMap.get(BLS_SERIES.cpi));
  const coreCpi = buildInflationLine(seriesMap.get(BLS_SERIES.coreCpi));
  const ppi = buildInflationLine(seriesMap.get(BLS_SERIES.ppi));
  const corePpi = buildInflationLine(seriesMap.get(BLS_SERIES.corePpi));
  const results: OfficialInflationActual[] = [];

  if (cpi && coreCpi) {
    results.push({
      label: "CPI / Core CPI",
      actual: `CPI ${formatPercent(cpi.mom)} MoM / ${formatPercent(cpi.yoy)} YoY, Core ${formatPercent(coreCpi.mom)} MoM / ${formatPercent(coreCpi.yoy)} YoY`,
      summary: `${cpi.latest.periodName ?? "최근"} CPI 실제값이 미국 노동통계국 공식 데이터 기준으로 확인됐습니다. 헤드라인과 근원 물가의 전월비, 전년비를 함께 보며 금리 기대 변화를 확인해야 합니다.`,
      marketImpact:
        "물가가 예상보다 강하게 나오면 달러와 국채금리 상승 압력이 커질 수 있고, 코인과 성장주에는 단기 부담이 될 수 있습니다. 반대로 둔화가 확인되면 위험자산 반등 재료가 될 수 있습니다.",
      sourceUrl: "https://www.bls.gov/cpi/"
    });
  }

  if (ppi && corePpi) {
    results.push({
      label: "PPI / Core PPI",
      actual: `PPI ${formatPercent(ppi.mom)} MoM / ${formatPercent(ppi.yoy)} YoY, Core ${formatPercent(corePpi.mom)} MoM / ${formatPercent(corePpi.yoy)} YoY`,
      summary: `${ppi.latest.periodName ?? "최근"} PPI 실제값이 미국 노동통계국 공식 데이터 기준으로 확인됐습니다. 생산자 비용 압력이 소비자 물가와 금리 기대로 이어지는지 봐야 합니다.`,
      marketImpact:
        "PPI가 강하면 인플레이션 재가속 우려가 커질 수 있어 발표 직후 변동성이 확대될 수 있습니다. 수치 자체보다 달러, 국채금리, 나스닥의 동시 반응을 우선 확인하세요.",
      sourceUrl: "https://www.bls.gov/ppi/"
    });
  }

  return results;
}

function mergeOfficialInflationActuals(items: MacroEventItem[], actuals: OfficialInflationActual[]) {
  const actualByLabel = new Map(actuals.map((item) => [item.label, item]));

  return items.map((item) => {
    const official = actualByLabel.get(item.label as OfficialInflationActual["label"]);
    if (!official) return item;

    return {
      ...item,
      state: "released" as const,
      actual: official.actual,
      summary: official.summary,
      marketImpact: official.marketImpact,
      source: "BLS" as const,
      sourceUrl: official.sourceUrl
    };
  });
}

async function fetchOfficialBlsCalendar(): Promise<MacroCalendarPayload | null> {
  const now = new Date();
  const response = await fetch(BLS_PUBLIC_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      seriesid: Object.values(BLS_SERIES),
      startyear: String(now.getUTCFullYear() - 1),
      endyear: String(now.getUTCFullYear()),
      calculations: false
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`BLS public API ${response.status}`);
  }

  const payload = (await response.json()) as BlsApiResponse;
  if (payload.status !== "REQUEST_SUCCEEDED") {
    throw new Error(payload.message?.join(", ") || "BLS public API request failed.");
  }

  const actuals = buildOfficialInflationActuals(payload.Results?.series ?? []);
  if (actuals.length === 0) return null;

  const updatedAt = new Date().toISOString();
  const items = sortedItems(mergeOfficialInflationActuals(macroItems, actuals));

  return {
    updatedAt,
    updatedAtLabel: `${formatKstDateTime(updatedAt)} 자동 갱신`,
    source: "official-bls",
    sourceLabel: "공식 자동 갱신",
    sourceNote:
      "CPI와 PPI는 공식 발표값을 자동 반영합니다. 소매판매, 주택, FOMC 등 나머지 일정도 발표 전후로 순차 갱신되며, 모든 시간은 한국시간입니다.",
    isAutomatic: true,
    nextRefreshMs: getRefreshMs(items),
    items
  };
}

export async function getMacroCalendarPayload(): Promise<MacroCalendarPayload> {
  const now = Date.now();
  if (cachedPayload && cachedPayload.expiresAt > now) {
    return cachedPayload.payload;
  }

  try {
    const officialPayload = await fetchOfficialBlsCalendar();
    if (officialPayload) {
      cachedPayload = {
        payload: officialPayload,
        expiresAt: now + officialPayload.nextRefreshMs
      };
      return officialPayload;
    }
  } catch (error) {
    console.warn("[macroCalendar] 공식 매크로 데이터 갱신 지연. 보조 일정으로 대체합니다.", error);
  }

  const fallback = getFallbackPayload("공식 매크로 데이터 연결이 지연되어 보조 일정을 표시합니다.");
  cachedPayload = {
    payload: fallback,
    expiresAt: now + fallback.nextRefreshMs
  };
  return fallback;
}

export function getMacroCalendarFallbackPayload() {
  return getFallbackPayload();
}
