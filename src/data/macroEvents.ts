// 자동 매크로 캘린더가 실패했을 때만 쓰는 최소 예비 데이터 타입을 정의합니다.
export type MacroEventState = "upcoming" | "released" | "watch";
export type MacroEventImportance = 1 | 2 | 3;
export type MacroEventSource = "BLS" | "BEA" | "Fed" | "Census" | "DOL" | "NAR" | "ForexFactory" | "Official";

export type MacroEventItem = {
  label: string;
  releaseAt: string;
  dateKst: string;
  state: MacroEventState;
  importance: MacroEventImportance;
  actual?: string;
  forecast?: string;
  previous?: string;
  summary: string;
  marketImpact: string;
  source: MacroEventSource;
  sourceUrl: string;
};

export const macroCalendarUpdatedAt = "자동 캘린더 대기 중";
export const macroCalendarUpdatedAtIso = "1970-01-01T00:00:00.000Z";
export const macroCalendarSourceNote =
  "일정은 공개 경제 캘린더와 공식 기관 데이터를 자동으로 확인합니다. 자동 확인이 실패하면 오래된 수동값을 보여주지 않고 재시도 상태로 표시합니다.";
export const macroItems: MacroEventItem[] = [];
