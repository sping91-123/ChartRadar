function newYorkPartsAt(utcMs: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date(utcMs));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );
}

export function normalizeEdgarAcceptanceDateTime(value: string | null | undefined, filingDate?: string | null) {
  const compact = value?.trim().match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (compact) {
    const desiredLocalAsUtc = Date.UTC(
      Number(compact[1]),
      Number(compact[2]) - 1,
      Number(compact[3]),
      Number(compact[4]),
      Number(compact[5]),
      Number(compact[6])
    );
    let utcMs = desiredLocalAsUtc + (desiredLocalAsUtc - newYorkPartsAt(desiredLocalAsUtc));
    utcMs += desiredLocalAsUtc - newYorkPartsAt(utcMs);
    return new Date(utcMs).toISOString();
  }
  if (value && Number.isFinite(Date.parse(value))) return new Date(value).toISOString();
  if (filingDate && /^\d{4}-\d{2}-\d{2}$/.test(filingDate)) return `${filingDate}T00:00:00.000Z`;
  return null;
}
