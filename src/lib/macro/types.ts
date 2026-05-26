// 매크로 일정의 이벤트 종류와 공식 발표 상태를 정의합니다.
export type MacroEventType = "numeric_release" | "document_release" | "meeting_event" | "speech_event" | "calendar_event";

export type MacroEventStatus =
  | "scheduled"
  | "imminent"
  | "in_progress"
  | "checking"
  | "released_pending_actual"
  | "actual_available"
  | "released"
  | "document_released"
  | "meeting_completed"
  | "official_check_needed"
  | "delayed"
  | "stale"
  | "past";

export type MacroSourceType = "official_api" | "official_page" | "public_calendar" | "operator_fallback" | "derived";

export type MacroOfficialSource = "BLS" | "BEA" | "Fed" | "Census" | "DOL" | "NAR" | "ForexFactory" | "Official";

export type MacroSourceEnrichment = {
  matcher: RegExp;
  eventType?: MacroEventType;
  source?: MacroOfficialSource;
  sourceType?: MacroSourceType;
  sourceUrl?: string;
  officialUrl?: string;
  isOfficial?: boolean;
  confidence?: number;
  actualValue?: string;
  consensusValue?: string;
  previousValue?: string;
  unit?: string;
  releasedAt?: string;
  status?: MacroEventStatus;
  statusLabel?: string;
  staleReason?: string;
  rawPayload?: unknown;
};

export type MacroStatusDecision = {
  status: MacroEventStatus;
  statusLabel: string;
  nextRefreshMs: number;
  releasedAt?: string;
  staleReason?: string;
};
