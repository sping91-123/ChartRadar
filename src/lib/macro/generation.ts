type MacroGenerationRow = {
  raw_payload?: unknown;
};

function generationOf(row: MacroGenerationRow) {
  const payload = row.raw_payload && typeof row.raw_payload === "object" ? row.raw_payload as Record<string, unknown> : null;
  const value = payload?.syncGeneration;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return null;
  return value;
}

export function selectLatestMacroGenerationRows<T extends MacroGenerationRow>(rows: readonly T[]): T[] {
  const latestGeneration = rows
    .map(generationOf)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);

  if (!latestGeneration) return [...rows];
  return rows.filter((row) => generationOf(row) === latestGeneration);
}
