// Trading Economics 공개 캘린더 HTML에서 늦게 반영되는 실제값을 보조 확인합니다.
import { type MacroEventItem } from "@/data/macroEvents";
import { hasConfirmedActualValue } from "@/lib/macro/macroStatus";
import { type MacroSourceEnrichment } from "@/lib/macro/types";

const TRADING_ECONOMICS_US_CALENDAR = "https://tradingeconomics.com/united-states/calendar/api?source=calendar";

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
    if (!row || !hasConfirmedActualValue(row.actualValue)) continue;

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
