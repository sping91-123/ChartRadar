export async function collectPaginatedRows<T>(
  fetchPage: (offset: number, limit: number) => Promise<T[]>,
  pageSize = 500
): Promise<T[]> {
  const size = Math.min(Math.max(Math.trunc(pageSize), 1), 1_000);
  const rows: T[] = [];
  for (let offset = 0; ; offset += size) {
    const page = await fetchPage(offset, size);
    rows.push(...page);
    if (page.length < size) return rows;
  }
}
