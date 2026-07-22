// Supabase에 저장된 매크로 동기화 결과를 읽고 쓰는 서버 전용 저장소입니다.
import { type MacroCalendarPayload } from "@/lib/macroCalendar";
import { isSupabaseAdminConfigured, supabaseAdminRest } from "@/lib/server/supabaseAdmin";
import { type MacroEventItem } from "@/data/macroEvents";
import { dedupeMacroCalendarItems } from "@/lib/macro/dedupeMacroCalendar";
import { selectLatestMacroGenerationRows } from "@/lib/macro/generation";
import { normalizeMacroEvents } from "@/lib/macro/normalizeMacroEvent";
import { resolveMacroSourceTrust } from "@/lib/macro/sourceTrust";
import { isStoredMacroPayloadStale } from "@/lib/macro/staleness";

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

function isLegacyFutureClaimsContamination(row: MacroEventRow, now = Date.now()) {
  if (row.source !== "DOL" || !/claims|실업수당/i.test(row.title)) return false;
  if (Date.parse(row.scheduled_at) <= now || row.released_at) return false;
  const rawPayload = row.raw_payload && typeof row.raw_payload === "object" ? (row.raw_payload as Partial<MacroEventItem>) : {};
  return rawPayload.sourceType === "official_api" || rawPayload.sourceType === "official_page";
}

function rowToItem(row: MacroEventRow): MacroEventItem {
  const rawPayload = row.raw_payload && typeof row.raw_payload === "object" ? (row.raw_payload as Partial<MacroEventItem>) : {};
  const source = rowSource(row);
  const sourceType = rawPayload.sourceType ?? "official_page";
  const sourceUrl = row.source_url ?? rawPayload.sourceUrl ?? "";
  const trust = resolveMacroSourceTrust({
    source,
    sourceUrl,
    officialUrl: row.official_url ?? rawPayload.officialUrl,
    itemOfficial: rawPayload.isOfficial,
    sourceType
  });
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
    source,
    sourceType,
    sourceUrl,
    officialUrl: trust.officialUrl,
    confidence: row.confidence ?? undefined,
    staleReason: row.stale_reason ?? undefined,
    isOfficial: trust.isOfficial,
    isDocumentEvent: rawPayload.isDocumentEvent,
    isNumericEvent: rawPayload.isNumericEvent,
    nextRefreshMs: rawPayload.nextRefreshMs
  };
}

function itemToRow(item: MacroEventItem, syncGeneration: string): MacroEventRow {
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
    raw_payload: { ...item, syncGeneration }
  };
}

export async function readStoredMacroCalendarPayload(options: { allowStale?: boolean } = {}): Promise<MacroCalendarPayload | null> {
  if (!isSupabaseAdminConfigured()) return null;

  const now = Date.now();
  const since = new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString();
  const until = new Date(now + 60 * 24 * 60 * 60 * 1000).toISOString();
  const rows = await supabaseAdminRest<MacroEventRow[]>(
    `macro_events?select=*&scheduled_at=gte.${encodeURIComponent(since)}&scheduled_at=lte.${encodeURIComponent(until)}&order=updated_at.desc,scheduled_at.asc&limit=240`,
    { timeoutMs: 2_500 }
  ).catch(() => null);
  if (!rows?.length) return null;
  const currentRows = selectLatestMacroGenerationRows(rows)
    .sort((a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at));
  if (currentRows.length === 0) return null;
  if (currentRows.some((row) => isLegacyFutureClaimsContamination(row))) return null;

  const updatedAt = currentRows
    .map((row) => row.updated_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  if (!updatedAt) return null;
  const isStale = isStoredMacroPayloadStale(updatedAt);
  if (isStale && !options.allowStale) return null;

  const baseItems = currentRows.map(rowToItem);
  const items = dedupeMacroCalendarItems(normalizeMacroEvents(baseItems, [], now));
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
    items,
    isStale,
    ...(isStale ? { warning: "공식 일정 갱신이 지연되어 마지막 정상 일정을 표시합니다." } : {})
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

  if (payload.cacheMode === "fallback") {
    return {
      stored: false,
      updatedCount: 0,
      reason: "예비 일정은 마지막 정상 원장을 덮어쓰지 않습니다."
    };
  }

  const syncGeneration = Number.isFinite(Date.parse(payload.updatedAt)) ? payload.updatedAt : new Date().toISOString();
  const rows = payload.items.map((item) => itemToRow(item, syncGeneration));
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

  const retentionCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  await supabaseAdminRest(`macro_events?scheduled_at=lt.${encodeURIComponent(retentionCutoff)}`, {
    method: "DELETE",
    prefer: "return=minimal",
    timeoutMs: 2_500
  }).catch(() => undefined);

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
