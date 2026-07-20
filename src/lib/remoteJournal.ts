// Supabase 저널 행과 클라이언트 복기 모델을 변환하는 유틸리티.
import type { JournalEntry } from "@/lib/journal";
import { fetchSupabaseUser, supabaseRest } from "@/lib/supabase";

interface JournalRow {
  id: string;
  user_id: string;
  title: string;
  bias: string;
  note: string;
  market?: JournalEntry["market"] | null;
  source: "manual" | "chart" | "scout" | "snapshot" | "alert";
  symbol: string | null;
  timeframe: string | null;
  verdict: string | null;
  scout_snapshot?: JournalEntry["scoutSnapshot"] | null;
  outcome?: JournalEntry["outcome"] | null;
  outcome_at?: string | null;
  decision_snapshot_id?: string | null;
  monitor_id?: string | null;
  decision_context?: JournalEntry["decisionContext"] | null;
  created_at: string;
}

function inferMarket(verdictValue: string | null): JournalEntry["market"] {
  const verdict = verdictValue?.toLowerCase() ?? "";
  if (
    verdict.includes("global") ||
    verdict.includes("글로벌") ||
    verdict.includes("해외주식") ||
    verdict.includes("湲濡쒕쾶") ||
    verdict.includes("?댁쇅二쇱떇")
  ) {
    return "stocks";
  }
  if (verdict.includes("crypto") || verdict.includes("코인") || verdict.includes("肄붿씤")) {
    return "crypto";
  }
  return undefined;
}

function rowToEntry(row: JournalRow): JournalEntry {
  return {
    id: row.id,
    title: row.title,
    bias: row.bias,
    note: row.note,
    createdAt: row.created_at,
    market: row.market ?? inferMarket(row.verdict),
    source: row.source,
    symbol: row.symbol ?? undefined,
    timeframe: row.timeframe ?? undefined,
    verdict: row.verdict ?? undefined,
    scoutSnapshot: row.scout_snapshot ?? undefined,
    outcome: row.outcome ?? undefined,
    outcomeAt: row.outcome_at ?? undefined,
    decisionSnapshotId: row.decision_snapshot_id ?? undefined,
    monitorId: row.monitor_id ?? undefined,
    decisionContext: row.decision_context ?? undefined
  };
}

export async function loadRemoteJournalEntries(accessToken: string) {
  const user = await fetchSupabaseUser(accessToken);
  const rows = await supabaseRest<JournalRow[]>(
    `journals?select=*&user_id=eq.${encodeURIComponent(user.id)}&order=created_at.desc`,
    {
      accessToken
    }
  );
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
      market: entry.market ?? inferMarket(entry.verdict ?? null) ?? null,
      source: entry.source ?? "manual",
      symbol: entry.symbol ?? null,
      timeframe: entry.timeframe ?? null,
      verdict: entry.verdict ?? null,
      scout_snapshot: entry.scoutSnapshot ?? null,
      outcome: entry.outcome ?? null,
      outcome_at: entry.outcomeAt ?? null,
      decision_snapshot_id: entry.decisionSnapshotId ?? null,
      monitor_id: entry.monitorId ?? null,
      decision_context: entry.decisionContext ?? null
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
  if (!entries.length) return [];

  const user = await fetchSupabaseUser(accessToken);
  const rows = await supabaseRest<JournalRow[]>("journals?on_conflict=id", {
    accessToken,
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: entries.map((entry) => ({
      id: entry.id,
      user_id: user.id,
      title: entry.title,
      bias: entry.bias,
      note: entry.note,
      market: entry.market ?? inferMarket(entry.verdict ?? null) ?? null,
      source: entry.source ?? "manual",
      symbol: entry.symbol ?? null,
      timeframe: entry.timeframe ?? null,
      verdict: entry.verdict ?? null,
      scout_snapshot: entry.scoutSnapshot ?? null,
      outcome: entry.outcome ?? null,
      outcome_at: entry.outcomeAt ?? null,
      decision_snapshot_id: entry.decisionSnapshotId ?? null,
      monitor_id: entry.monitorId ?? null,
      decision_context: entry.decisionContext ?? null,
      created_at: entry.createdAt
    }))
  });

  return rows.map(rowToEntry);
}
