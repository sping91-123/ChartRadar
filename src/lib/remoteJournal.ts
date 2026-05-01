import type { JournalEntry } from "@/lib/journal";
import { fetchSupabaseUser, supabaseRest } from "@/lib/supabase";

interface JournalRow {
  id: string;
  user_id: string;
  title: string;
  bias: string;
  note: string;
  source: "manual" | "chart";
  symbol: string | null;
  timeframe: string | null;
  verdict: string | null;
  created_at: string;
}

function rowToEntry(row: JournalRow): JournalEntry {
  return {
    id: row.id,
    title: row.title,
    bias: row.bias,
    note: row.note,
    createdAt: row.created_at,
    source: row.source,
    symbol: row.symbol ?? undefined,
    timeframe: row.timeframe ?? undefined,
    verdict: row.verdict ?? undefined
  };
}

export async function loadRemoteJournalEntries(accessToken: string) {
  const rows = await supabaseRest<JournalRow[]>("journals?select=*&order=created_at.desc", {
    accessToken
  });
  return rows.map(rowToEntry);
}

export async function createRemoteJournalEntry(
  accessToken: string,
  entry: Omit<JournalEntry, "id" | "createdAt">
) {
  const user = await fetchSupabaseUser(accessToken);
  const rows = await supabaseRest<JournalRow[]>("journals", {
    accessToken,
    method: "POST",
    prefer: "return=representation",
    body: {
      user_id: user.id,
      title: entry.title,
      bias: entry.bias,
      note: entry.note,
      source: entry.source ?? "manual",
      symbol: entry.symbol ?? null,
      timeframe: entry.timeframe ?? null,
      verdict: entry.verdict ?? null
    }
  });

  return rowToEntry(rows[0]);
}

export async function deleteRemoteJournalEntry(accessToken: string, id: string) {
  await supabaseRest<null>(`journals?id=eq.${encodeURIComponent(id)}`, {
    accessToken,
    method: "DELETE"
  });
}

export async function migrateLocalJournalEntries(accessToken: string, entries: JournalEntry[]) {
  const user = await fetchSupabaseUser(accessToken);
  const rows = await supabaseRest<JournalRow[]>("journals", {
    accessToken,
    method: "POST",
    prefer: "return=representation",
    body: entries.map((entry) => ({
      id: entry.id,
      user_id: user.id,
      title: entry.title,
      bias: entry.bias,
      note: entry.note,
      source: entry.source ?? "manual",
      symbol: entry.symbol ?? null,
      timeframe: entry.timeframe ?? null,
      verdict: entry.verdict ?? null,
      created_at: entry.createdAt
    }))
  });

  return rows.map(rowToEntry);
}
