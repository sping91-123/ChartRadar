export type PerpetualChartTimeValue = number | string | { year: number; month: number; day: number };

const kstDateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
});

function chartTimeDate(value: PerpetualChartTimeValue) {
  if (typeof value === "number") return new Date(value * 1000);
  if (typeof value === "string") return new Date(`${value}T00:00:00Z`);
  return new Date(Date.UTC(value.year, value.month - 1, value.day));
}

function kstParts(value: PerpetualChartTimeValue) {
  const date = chartTimeDate(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = Object.fromEntries(
    kstDateTimeFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute
  };
}

export function formatPerpetualChartTime(value: PerpetualChartTimeValue) {
  const parts = kstParts(value);
  if (!parts) return "시각 확인 필요";
  return `${parts.month}/${parts.day} ${parts.hour}:${parts.minute} KST`;
}

export function formatPerpetualChartTick(value: PerpetualChartTimeValue, tickMarkType: number) {
  const parts = kstParts(value);
  if (!parts) return "";
  if (tickMarkType === 0) return parts.year;
  if (tickMarkType === 1) return `${Number(parts.month)}월`;
  if (tickMarkType === 2) return `${parts.month}/${parts.day}`;
  return `${parts.hour}:${parts.minute}`;
}
