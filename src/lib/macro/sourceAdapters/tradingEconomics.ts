// Trading Economics 공개 캘린더 HTML에서 늦게 반영되는 실제값을 보조 확인합니다.
import { type MacroEventItem } from "@/data/macroEvents";
import { hasConfirmedActualValue } from "@/lib/macro/macroStatus";
import { type MacroSourceEnrichment } from "@/lib/macro/types";

const TRADING_ECONOMICS_US_CALENDAR = "https://tradingeconomics.com/united-states/calendar/api?source=calendar";
const KST_TIME_ZONE = "Asia/Seoul";
const PMI_FALLBACK_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const TRADING_ECONOMICS_US_PMI_PAGES = [
  {
    matcher: /(?:flash\s+)?(?:s&p\s+global\s+)?manufacturing\s+pmi/i,
    url: "https://tradingeconomics.com/united-states/manufacturing-pmi",
    label: "Manufacturing PMI",
    fallbackLabel: "Flash Manufacturing PMI"
  },
  {
    matcher: /(?:flash\s+)?(?:s&p\s+global\s+)?services\s+pmi/i,
    url: "https://tradingeconomics.com/united-states/services-pmi",
    label: "Services PMI",
    fallbackLabel: "Flash Services PMI"
  },
  {
    matcher: /(?:flash\s+)?(?:s&p\s+global\s+)?composite\s+pmi/i,
    url: "https://tradingeconomics.com/united-states/composite-pmi",
    label: "Composite PMI",
    fallbackLabel: "S&P Global Composite PMI Flash"
  }
];

type TradingEconomicsPmiPage = (typeof TRADING_ECONOMICS_US_PMI_PAGES)[number];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripTags(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function formatKstShort(iso: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KST_TIME_ZONE,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function cellValue(rowHtml: string, id: "actual" | "previous" | "consensus" | "forecast") {
  const match = rowHtml.match(new RegExp(`<[^>]+id=['"]${id}['"][^>]*>([\\s\\S]*?)<\\/[^>]+>`, "i"));
  return match ? stripTags(match[1]) : undefined;
}

function parseTradingEconomicsRows(html: string) {
  return html
    .split(/<tr\b/i)
    .filter((row) => row.includes("calendar-event"))
    .map((row) => {
      const titleMatch = row.match(/<a[^>]+class=['"]calendar-event['"][^>]*href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/i);
      if (!titleMatch) return null;
      const title = stripTags(titleMatch[2]);
      const href = titleMatch[1].startsWith("http") ? titleMatch[1] : `https://tradingeconomics.com${titleMatch[1]}`;
      return {
        title,
        href,
        actualValue: cellValue(row, "actual"),
        previousValue: cellValue(row, "previous"),
        consensusValue: cellValue(row, "consensus"),
        forecastValue: cellValue(row, "forecast")
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row?.title));
}

function findCalendarRow(item: MacroEventItem, rows: ReturnType<typeof parseTradingEconomicsRows>[number][]) {
  const normalizedLabel = item.label.toLowerCase().replace(/\s+/g, " ").trim();
  return rows.find((row) => row.title.toLowerCase().replace(/\s+/g, " ").trim() === normalizedLabel) ?? null;
}

function parseLatestIndicatorValue(html: string, label: string) {
  const metaMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  const meta = metaMatch ? stripTags(metaMatch[1]) : "";
  const escapedLabel = escapeRegExp(label);
  const increasedMatch = meta.match(new RegExp(`${escapedLabel} in the United States (?:increased|rose|climbed) to\\s+([0-9]+(?:\\.[0-9]+)?)\\s+points?\\s+in\\s+([A-Za-z]+)\\s+from\\s+([0-9]+(?:\\.[0-9]+)?)`, "i"));
  const decreasedMatch = meta.match(new RegExp(`${escapedLabel} in the United States (?:decreased|fell|declined) to\\s+([0-9]+(?:\\.[0-9]+)?)\\s+points?\\s+in\\s+([A-Za-z]+)\\s+from\\s+([0-9]+(?:\\.[0-9]+)?)`, "i"));
  const match = increasedMatch ?? decreasedMatch;
  if (!match) return null;

  return {
    actualValue: Number(match[1]).toFixed(1),
    previousValue: Number(match[3]).toFixed(1)
  };
}

function parseTradingEconomicsLastUpdate(html: string) {
  const pattern = /TELastUpdate\s*=\s*['"](\d{12,14})['"]/g;
  let latest: Date | null = null;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const value = match[1].slice(0, 12);
    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(4, 6));
    const day = Number(value.slice(6, 8));
    const hour = Number(value.slice(8, 10));
    const minute = Number(value.slice(10, 12));
    const candidate = new Date(Date.UTC(year, month - 1, day, hour, minute));
    if (!Number.isFinite(candidate.getTime())) continue;
    if (!latest || candidate.getTime() > latest.getTime()) latest = candidate;
  }

  return latest?.toISOString() ?? null;
}

async function fetchPmiPageHtml(page: TradingEconomicsPmiPage) {
  const response = await fetch(page.url, {
    headers: { "user-agent": "ChartRadarBot/1.0 (+https://chartradar.kr)" },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Trading Economics ${page.label} ${response.status}`);
  return response.text();
}

async function fetchPmiPageEnrichment(item: MacroEventItem): Promise<MacroSourceEnrichment | null> {
  const page = TRADING_ECONOMICS_US_PMI_PAGES.find((candidate) => candidate.matcher.test(item.label));
  if (!page) return null;

  const values = parseLatestIndicatorValue(await fetchPmiPageHtml(page), page.label);
  if (!values || !hasConfirmedActualValue(values.actualValue)) return null;

  return {
    matcher: new RegExp(`^${escapeRegExp(item.label)}$`, "i"),
    eventType: "numeric_release",
    sourceType: "public_calendar",
    sourceUrl: page.url,
    isOfficial: false,
    confidence: 0.74,
    actualValue: values.actualValue,
    consensusValue: item.consensusValue ?? item.forecast,
    previousValue: values.previousValue ?? item.previousValue ?? item.previous,
    status: "actual_available",
    statusLabel: "실제값 확인"
  };
}

function buildPmiFallbackItem(page: TradingEconomicsPmiPage, values: NonNullable<ReturnType<typeof parseLatestIndicatorValue>>, releaseAt: string): MacroEventItem {
  return {
    label: page.fallbackLabel,
    title: page.fallbackLabel,
    country: "US",
    category: "growth",
    releaseAt,
    dateKst: formatKstShort(releaseAt),
    state: "released",
    importance: 3,
    eventType: "numeric_release",
    status: "actual_available",
    statusLabel: "실제값 확인",
    releasedAt: releaseAt,
    actual: values.actualValue,
    actualValue: values.actualValue,
    previous: values.previousValue,
    previousValue: values.previousValue,
    summary: "미국 S&P Global PMI 발표입니다. 제조업과 서비스업 경기 속도를 빠르게 확인하는 선행 지표입니다.",
    marketImpact: "예상보다 높으면 경기 탄력 신호, 낮으면 성장 둔화 우려로 해석될 수 있습니다. 발표 직후에는 달러와 금리 반응을 함께 확인해야 합니다.",
    source: "Official",
    sourceType: "public_calendar",
    sourceUrl: page.url,
    officialUrl: page.url,
    confidence: 0.74,
    isOfficial: false,
    isNumericEvent: true
  };
}

async function fetchPmiFallbackItem(page: TradingEconomicsPmiPage, now: number): Promise<MacroEventItem | null> {
  const html = await fetchPmiPageHtml(page);
  const values = parseLatestIndicatorValue(html, page.label);
  const releaseAt = parseTradingEconomicsLastUpdate(html);
  if (!values || !releaseAt || !hasConfirmedActualValue(values.actualValue)) return null;

  const releaseTime = Date.parse(releaseAt);
  if (!Number.isFinite(releaseTime) || releaseTime > now || now - releaseTime > PMI_FALLBACK_RETENTION_MS) return null;
  return buildPmiFallbackItem(page, values, releaseAt);
}

export async function fetchTradingEconomicsPmiFallbackItems(now = Date.now()): Promise<MacroEventItem[]> {
  const items = await Promise.all(
    TRADING_ECONOMICS_US_PMI_PAGES.map((page) => fetchPmiFallbackItem(page, now).catch(() => null))
  );

  return items.filter((item): item is MacroEventItem => Boolean(item));
}

export async function fetchTradingEconomicsCalendarEnrichments(items: MacroEventItem[]): Promise<MacroSourceEnrichment[]> {
  const pendingItems = items.filter((item) => {
    const releaseTime = Date.parse(item.releaseAt);
    if (!Number.isFinite(releaseTime) || releaseTime > Date.now()) return false;
    return !hasConfirmedActualValue(item.actualValue ?? item.actual);
  });
  if (pendingItems.length === 0) return [];

  const response = await fetch(TRADING_ECONOMICS_US_CALENDAR, {
    headers: { "user-agent": "ChartRadarBot/1.0 (+https://chartradar.kr)" },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Trading Economics calendar ${response.status}`);

  const rows = parseTradingEconomicsRows(await response.text());
  const enrichments: MacroSourceEnrichment[] = [];
  for (const item of pendingItems) {
    const row = findCalendarRow(item, rows);
    if (!row || !hasConfirmedActualValue(row.actualValue)) {
      const pmiEnrichment = await fetchPmiPageEnrichment(item).catch(() => null);
      if (pmiEnrichment) enrichments.push(pmiEnrichment);
      continue;
    }

    enrichments.push({
        matcher: new RegExp(`^${escapeRegExp(item.label)}$`, "i"),
        eventType: "numeric_release",
        sourceType: "public_calendar",
        sourceUrl: row.href,
        isOfficial: false,
        confidence: 0.72,
        actualValue: row.actualValue,
        consensusValue: row.consensusValue ?? row.forecastValue ?? item.consensusValue ?? item.forecast,
        previousValue: row.previousValue ?? item.previousValue ?? item.previous,
        status: "actual_available",
        statusLabel: "실제값 확인"
    });
  }

  return enrichments;
}
