import type { JournalEntry } from "@/lib/journal";
import { fetchSupabaseUser, supabaseRest } from "@/lib/supabase";

interface JournalRow {
  id: string;
  user_id: string;
  title: string;
  bias: string;
  note: string;
  source: "manual" | "chart" | "scout";
  symbol: string | null;
  timeframe: string | null;
  verdict: string | null;
  scout_snapshot?: JournalEntry["scoutSnapshot"] | null;
  outcome?: JournalEntry["outcome"] | null;
  outcome_at?: string | null;
  created_at: string;
}

function rowToEntry(row: JournalRow): JournalEntry {
  return {
    id: row.id,
    title: row.title,
    bias: row.bias,
    note: row.note,
    createdAt: row.created_at,
    market: row.verdict?.includes("글로벌") || row.verdict?.includes("해외주식") ? "stocks" : row.verdict?.includes("코인") ? "crypto" : undefined,
    source: row.source,
    symbol: row.symbol ?? undefined,
    timeframe: row.timeframe ?? undefined,
    verdict: row.verdict ?? undefined,
    scoutSnapshot: row.scout_snapshot ?? undefined,
    outcome: row.outcome ?? undefined,
    outcomeAt: row.outcome_at ?? undefined
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
      verdict: entry.verdict ?? null,
      scout_snapshot: entry.scoutSnapshot ?? null,
      outcome: entry.outcome ?? null,
      outcome_at: entry.outcomeAt ?? null
    }
  });

  return rowToEntry(rows[0]);
}

export async function deleteRemoteJournalEntry(accessToken: string, id: string) {
  const user = await fetchSupabaseUser(accessToken);
  await supabaseRest<null>(`journals?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}`, {
    accessToken,
    method: "DELETE"
  });
}

export async function updateRemoteJournalOutcome(
  accessToken: string,
  id: string,
  outcome: JournalEntry["outcome"] | null,
  outcomeAt: string | null
) {
  const user = await fetchSupabaseUser(accessToken);
  const rows = await supabaseRest<JournalRow[]>(
    `journals?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}`,
    {
      accessToken,
      method: "PATCH",
      prefer: "return=representation",
      body: {
        outcome,
        outcome_at: outcomeAt
      }
    }
  );

  return rows[0] ? rowToEntry(rows[0]) : null;
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
      scout_snapshot: entry.scoutSnapshot ?? null,
      outcome: entry.outcome ?? null,
      outcome_at: entry.outcomeAt ?? null,
      created_at: entry.createdAt
    }))
  });

  return rows.map(rowToEntry);
}
