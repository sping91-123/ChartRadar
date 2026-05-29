// Supabase에 저장된 매크로 동기화 결과를 읽고 쓰는 서버 전용 저장소입니다.
import { type MacroCalendarPayload } from "@/lib/macroCalendar";
import { isSupabaseAdminConfigured, supabaseAdminRest } from "@/lib/server/supabaseAdmin";
import { type MacroEventItem } from "@/data/macroEvents";
import { normalizeMacroEvents } from "@/lib/macro/normalizeMacroEvent";
import { getBeaOfficialEnrichments } from "@/lib/macro/sourceAdapters/bea";
import { getCensusOfficialEnrichments } from "@/lib/macro/sourceAdapters/census";
import { fetchDolOfficialEnrichments } from "@/lib/macro/sourceAdapters/dol";

type MacroEventRow = {
  id?: string;
  source: string;
  source_event_id: string;
  event_type: string;
  title: string;
  country: string;
  category: string;
  importance: number;
  scheduled_at: string;
  released_at?: string | null;
  status: string;
  status_label: string;
  actual_value?: string | null;
  consensus_value?: string | null;
  previous_value?: string | null;
  unit?: string | null;
  source_url?: string | null;
  official_url?: string | null;
  confidence?: number | null;
  stale_reason?: string | null;
  raw_payload?: unknown;
  created_at?: string;
  updated_at?: string;
};

function rowSource(row: MacroEventRow): MacroEventItem["source"] {
  if (row.source === "BLS" || row.source === "BEA" || row.source === "Fed" || row.source === "Census" || row.source === "DOL" || row.source === "NAR") {
    return row.source;
  }
  if (row.source === "ForexFactory") return "ForexFactory";
  return "Official";
}

function legacyState(row: MacroEventRow): MacroEventItem["state"] {
  if (row.status === "scheduled" || row.status === "imminent" || row.status === "in_progress") return "upcoming";
  if (row.status === "released_pending_actual" || row.status === "checking" || row.status === "official_check_needed" || row.status === "delayed" || row.status === "stale") return "watch";
  return "released";
}

function formatKstShort(iso: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "시간 확인 필요";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function rowToItem(row: MacroEventRow): MacroEventItem {
  const rawPayload = row.raw_payload && typeof row.raw_payload === "object" ? (row.raw_payload as Partial<MacroEventItem>) : {};
  return {
    ...rawPayload,
    id: row.source_event_id,
    label: row.title,
    title: row.title,
    country: row.country,
    category: row.category,
    releaseAt: row.scheduled_at,
    scheduledAt: row.scheduled_at,
    releasedAt: row.released_at ?? undefined,
    dateKst: rawPayload.dateKst ?? formatKstShort(row.scheduled_at),
    state: legacyState(row),
    importance: row.importance === 3 || row.importance === 2 ? row.importance : 1,
    eventType: row.event_type as MacroEventItem["eventType"],
    status: row.status as MacroEventItem["status"],
    statusLabel: row.status_label,
    actual: row.actual_value ?? rawPayload.actual,
    actualValue: row.actual_value ?? undefined,
    forecast: row.consensus_value ?? rawPayload.forecast,
    consensusValue: row.consensus_value ?? undefined,
    previous: row.previous_value ?? rawPayload.previous,
    previousValue: row.previous_value ?? undefined,
    unit: row.unit ?? undefined,
    summary: rawPayload.summary ?? "공식 출처 기준으로 확인한 매크로 일정입니다.",
    marketImpact: rawPayload.marketImpact ?? "발표 전후에는 가격 반응과 거래량 변화를 함께 확인하세요.",
    source: rowSource(row),
    sourceType: rawPayload.sourceType ?? "official_page",
    sourceUrl: row.source_url ?? rawPayload.sourceUrl ?? "",
    officialUrl: row.official_url ?? undefined,
    confidence: row.confidence ?? undefined,
    staleReason: row.stale_reason ?? undefined,
    isOfficial: rawPayload.isOfficial ?? row.source !== "ForexFactory",
    isDocumentEvent: rawPayload.isDocumentEvent,
    isNumericEvent: rawPayload.isNumericEvent,
    nextRefreshMs: rawPayload.nextRefreshMs
  };
}

function itemToRow(item: MacroEventItem): MacroEventRow {
  return {
    source: item.source,
    source_event_id: item.id ?? `${item.label}-${item.releaseAt}`,
    event_type: item.eventType ?? "calendar_event",
    title: item.title ?? item.label,
    country: item.country ?? "US",
    category: item.category ?? "macro",
    importance: item.importance,
    scheduled_at: item.scheduledAt ?? item.releaseAt,
    released_at: item.releasedAt ?? null,
    status: item.status ?? "scheduled",
    status_label: item.statusLabel ?? "예정",
    actual_value: item.actualValue ?? item.actual ?? null,
    consensus_value: item.consensusValue ?? item.forecast ?? null,
    previous_value: item.previousValue ?? item.previous ?? null,
    unit: item.unit ?? null,
    source_url: item.sourceUrl,
    official_url: item.officialUrl ?? null,
    confidence: item.confidence ?? null,
    stale_reason: item.staleReason ?? null,
    raw_payload: item
  };
}

export async function readStoredMacroCalendarPayload(): Promise<MacroCalendarPayload | null> {
  if (!isSupabaseAdminConfigured()) return null;

  const rows = await supabaseAdminRest<MacroEventRow[]>(
    "macro_events?select=*&order=scheduled_at.asc&limit=60",
    {}
  ).catch(() => null);
  if (!rows?.length) return null;

  const updatedAt = rows
    .map((row) => row.updated_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  if (!updatedAt || Date.now() - Date.parse(updatedAt) > 60 * 60 * 1000) return null;

  const baseItems = rows.map(rowToItem);
  const [beaEnrichments, censusEnrichments, dolEnrichments] = await Promise.all([
    getBeaOfficialEnrichments().catch(() => []),
    getCensusOfficialEnrichments().catch(() => []),
    fetchDolOfficialEnrichments(baseItems).catch(() => [])
  ]);
  const items = normalizeMacroEvents(baseItems, [...beaEnrichments, ...censusEnrichments, ...dolEnrichments], Date.now());
  return {
    updatedAt,
    updatedAtLabel: "저장된 공식 확인 결과",
    fetchedAt: new Date().toISOString(),
    serverTime: new Date().toISOString(),
    sourceName: "stored_macro_events",
    sourceUpdatedAt: updatedAt,
    cacheMode: "stored-cache",
    source: "automatic-mixed",
    sourceLabel: "공식 소스 동기화 캐시",
    sourceNote: "공식 소스 동기화 결과를 우선 표시합니다. 일부 실제값은 공식 발표 확인 중으로 남을 수 있습니다.",
    isAutomatic: true,
    nextRefreshMs: Math.max(60_000, Math.min(...items.map((item) => item.nextRefreshMs ?? 30 * 60_000))),
    items
  };
}

export async function writeStoredMacroCalendarPayload(payload: MacroCalendarPayload) {
  if (!isSupabaseAdminConfigured()) {
    return {
      stored: false,
      updatedCount: 0,
      reason: "Supabase 관리자 환경변수가 없어 저장하지 않았습니다."
    };
  }

  const rows = payload.items.map(itemToRow);
  if (rows.length === 0) {
    return {
      stored: false,
      updatedCount: 0,
      reason: "저장할 매크로 일정이 없습니다."
    };
  }

  await supabaseAdminRest("macro_events?on_conflict=source,source_event_id", {
    method: "POST",
    body: rows,
    prefer: "resolution=merge-duplicates"
  });

  return {
    stored: true,
    updatedCount: rows.length
  };
}

export async function writeMacroSyncRun(input: {
  source: string;
  startedAt: string;
  finishedAt: string;
  status: string;
  fetchedCount: number;
  updatedCount: number;
  error?: string;
}) {
  if (!isSupabaseAdminConfigured()) return;
  await supabaseAdminRest("macro_sync_runs", {
    method: "POST",
    body: {
      source: input.source,
      started_at: input.startedAt,
      finished_at: input.finishedAt,
      status: input.status,
      fetched_count: input.fetchedCount,
      updated_count: input.updatedCount,
      error: input.error ?? null
    }
  }).catch(() => undefined);
}
