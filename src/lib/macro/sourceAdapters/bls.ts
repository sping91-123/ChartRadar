// BLS 공개 API에서 숫자형 매크로 지표 실제값을 보강합니다.
import { type MacroSourceEnrichment } from "@/lib/macro/types";

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

const BLS_PUBLIC_API_URL = "https://api.bls.gov/publicAPI/v2/timeseries/data/";
const BLS_SERIES = {
  cpi: "CUSR0000SA0",
  coreCpi: "CUSR0000SA0L1E",
  ppi: "WPSFD4",
  corePpi: "WPSFD49116",
  unemploymentRate: "LNS14000000",
  nonfarmPayrolls: "CES0000000001",
  averageHourlyEarnings: "CES0500000003"
} as const;

function sortBlsPoints(data: BlsPoint[] = []) {
  return data
    .filter((point) => /^M\d{2}$/.test(point.period) && Number.isFinite(Number(point.value)))
    .sort((firstPoint, secondPoint) => {
      const yearDiff = Number(secondPoint.year) - Number(firstPoint.year);
      if (yearDiff !== 0) return yearDiff;
      return Number(secondPoint.period.replace("M", "")) - Number(firstPoint.period.replace("M", ""));
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

function numericDiff(current: BlsPoint, previous?: BlsPoint) {
  const currentValue = Number(current.value);
  const previousValue = Number(previous?.value);
  if (!Number.isFinite(currentValue) || !Number.isFinite(previousValue)) return null;
  return currentValue - previousValue;
}

function formatPercent(value: number | null) {
  if (value === null) return "확인 중";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatPayrollChange(value: number | null) {
  if (value === null) return "확인 중";
  return `${value > 0 ? "+" : ""}${value.toFixed(0)}K`;
}

function buildBlsLine(points?: BlsPoint[]) {
  if (!points || points.length < 2) return null;
  const latest = points[0];
  return {
    latest,
    previous: points[1],
    mom: pctChange(latest, points[1]),
    yoy: pctChange(latest, findYearAgoPoint(points, latest)),
    diff: numericDiff(latest, points[1])
  };
}

export async function fetchBlsOfficialActuals(): Promise<MacroSourceEnrichment[]> {
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

  const seriesMap = new Map((payload.Results?.series ?? []).map((series) => [series.seriesID, sortBlsPoints(series.data)]));
  const cpi = buildBlsLine(seriesMap.get(BLS_SERIES.cpi));
  const coreCpi = buildBlsLine(seriesMap.get(BLS_SERIES.coreCpi));
  const ppi = buildBlsLine(seriesMap.get(BLS_SERIES.ppi));
  const corePpi = buildBlsLine(seriesMap.get(BLS_SERIES.corePpi));
  const unemploymentRate = buildBlsLine(seriesMap.get(BLS_SERIES.unemploymentRate));
  const nonfarmPayrolls = buildBlsLine(seriesMap.get(BLS_SERIES.nonfarmPayrolls));
  const averageHourlyEarnings = buildBlsLine(seriesMap.get(BLS_SERIES.averageHourlyEarnings));
  const enrichments: MacroSourceEnrichment[] = [];

  if (cpi && coreCpi) {
    enrichments.push({
      matcher: /cpi/i,
      eventType: "numeric_release",
      source: "BLS",
      sourceType: "official_api",
      sourceUrl: "https://www.bls.gov/cpi/",
      officialUrl: "https://www.bls.gov/cpi/",
      isOfficial: true,
      confidence: 0.95,
      actualValue: `CPI ${formatPercent(cpi.mom)} 전월비 / ${formatPercent(cpi.yoy)} 전년비, 근원 ${formatPercent(coreCpi.mom)} 전월비 / ${formatPercent(coreCpi.yoy)} 전년비`,
      unit: "%"
    });
  }

  if (ppi && corePpi) {
    enrichments.push({
      matcher: /ppi/i,
      eventType: "numeric_release",
      source: "BLS",
      sourceType: "official_api",
      sourceUrl: "https://www.bls.gov/ppi/",
      officialUrl: "https://www.bls.gov/ppi/",
      isOfficial: true,
      confidence: 0.95,
      actualValue: `PPI ${formatPercent(ppi.mom)} 전월비 / ${formatPercent(ppi.yoy)} 전년비, 근원 ${formatPercent(corePpi.mom)} 전월비 / ${formatPercent(corePpi.yoy)} 전년비`,
      unit: "%"
    });
  }

  if (unemploymentRate) {
    enrichments.push({
      matcher: /unemployment rate/i,
      eventType: "numeric_release",
      source: "BLS",
      sourceType: "official_api",
      sourceUrl: "https://www.bls.gov/cps/",
      officialUrl: "https://www.bls.gov/cps/",
      isOfficial: true,
      confidence: 0.85,
      actualValue: `실업률 ${Number(unemploymentRate.latest.value).toFixed(1)}%`,
      unit: "%"
    });
  }

  if (nonfarmPayrolls) {
    enrichments.push({
      matcher: /non-farm|nonfarm|nfp|payroll/i,
      eventType: "numeric_release",
      source: "BLS",
      sourceType: "official_api",
      sourceUrl: "https://www.bls.gov/ces/",
      officialUrl: "https://www.bls.gov/ces/",
      isOfficial: true,
      confidence: 0.82,
      actualValue: `비농업 고용 ${formatPayrollChange(nonfarmPayrolls.diff)}`,
      unit: "K"
    });
  }

  if (averageHourlyEarnings) {
    enrichments.push({
      matcher: /average hourly earnings|wages/i,
      eventType: "numeric_release",
      source: "BLS",
      sourceType: "official_api",
      sourceUrl: "https://www.bls.gov/ces/",
      officialUrl: "https://www.bls.gov/ces/",
      isOfficial: true,
      confidence: 0.82,
      actualValue: `평균시급 ${formatPercent(averageHourlyEarnings.mom)} 전월비`,
      unit: "%"
    });
  }

  return enrichments;
}
