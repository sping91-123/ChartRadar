// 자동 매크로 캘린더가 실패했을 때 보여줄 예비 경제 일정입니다.
import { type MacroEventStatus, type MacroEventType, type MacroSourceType } from "@/lib/macro/types";

export type MacroEventState = "upcoming" | "released" | "watch";
export type MacroEventImportance = 1 | 2 | 3;
export type MacroEventSource = "BLS" | "BEA" | "Fed" | "Census" | "DOL" | "NAR" | "ForexFactory" | "Official";

export type MacroEventItem = {
  id?: string;
  label: string;
  title?: string;
  country?: string;
  category?: string;
  releaseAt: string;
  dateKst: string;
  state: MacroEventState;
  importance: MacroEventImportance;
  eventType?: MacroEventType;
  status?: MacroEventStatus;
  statusLabel?: string;
  scheduledAt?: string;
  releasedAt?: string;
  actual?: string;
  forecast?: string;
  previous?: string;
  actualValue?: string;
  consensusValue?: string;
  previousValue?: string;
  unit?: string;
  summary: string;
  marketImpact: string;
  source: MacroEventSource;
  sourceType?: MacroSourceType;
  sourceUrl: string;
  officialUrl?: string;
  confidence?: number;
  staleReason?: string;
  nextRefreshMs?: number;
  isOfficial?: boolean;
  isDocumentEvent?: boolean;
  isNumericEvent?: boolean;
};

export const macroCalendarUpdatedAt = "2026년 5월 25일 예비 일정 갱신";
export const macroCalendarUpdatedAtIso = "2026-05-25T00:00:00.000Z";
export const macroCalendarSourceNote =
  "공개 경제 캘린더와 공식 통계 데이터를 우선 확인합니다. 문서형 이벤트는 실제값 대신 공식 문서 공개 상태로 표시하고, 자동 확인이 막히면 예비 일정으로 보여줍니다.";

export const macroItems: MacroEventItem[] = [
  {
    label: "Initial Jobless Claims",
    releaseAt: "2026-05-21T12:30:00.000Z",
    dateKst: "05.21 21:30",
    state: "released",
    importance: 3,
    eventType: "numeric_release",
    status: "official_check_needed",
    statusLabel: "공식 발표 확인 필요",
    actual: "공식 발표 확인 필요",
    forecast: "확인 예정",
    previous: "확인 예정",
    summary: "미국 고용 둔화 여부를 매주 확인하는 신규 실업수당 청구 지표입니다.",
    marketImpact:
      "청구 건수가 예상보다 크게 늘면 경기 둔화 우려가 커질 수 있고, 예상보다 낮으면 고용 견조 해석이 강화될 수 있습니다.",
    source: "DOL",
    sourceType: "official_page",
    sourceUrl: "https://oui.doleta.gov/unemploy/claims.asp",
    officialUrl: "https://oui.doleta.gov/unemploy/claims.asp",
    isOfficial: true,
    isNumericEvent: true
  },
  {
    label: "New Home Sales",
    releaseAt: "2026-05-28T14:00:00.000Z",
    dateKst: "05.28 23:00",
    state: "upcoming",
    importance: 2,
    forecast: "확인 예정",
    previous: "확인 예정",
    summary: "미국 신규 주택 판매 흐름과 주택 수요의 탄력을 확인하는 지표입니다.",
    marketImpact:
      "판매가 예상보다 강하면 경기 체력에는 우호적일 수 있지만, 금리 부담과 주택시장 과열 우려도 함께 확인해야 합니다.",
    source: "Census",
    sourceUrl: "https://www.census.gov/construction/nrs/"
  },
  {
    label: "GDP Second Estimate and Corporate Profits",
    releaseAt: "2026-05-28T12:30:00.000Z",
    dateKst: "05.28 21:30",
    state: "upcoming",
    importance: 3,
    forecast: "확인 예정",
    previous: "확인 예정",
    summary: "미국 1분기 성장률 수정치와 기업이익을 함께 확인하는 핵심 성장 지표입니다.",
    marketImpact:
      "성장률과 이익이 예상보다 강하면 경기 체력 해석은 좋아질 수 있지만, 금리 인하 기대가 약해지는지도 같이 봐야 합니다.",
    source: "BEA",
    sourceUrl: "https://www.bea.gov/news/schedule/full"
  },
  {
    label: "Personal Income and Outlays",
    releaseAt: "2026-05-28T12:30:00.000Z",
    dateKst: "05.28 21:30",
    state: "upcoming",
    importance: 3,
    forecast: "확인 예정",
    previous: "확인 예정",
    summary: "미국 소비와 소득 흐름, PCE 물가 압력을 함께 확인하는 핵심 지표입니다.",
    marketImpact:
      "소비와 물가 압력이 강하면 위험자산에는 금리 부담이 커질 수 있고, 둔화되면 경기 우려와 금리 기대를 함께 해석해야 합니다.",
    source: "BEA",
    sourceUrl: "https://www.bea.gov/news/schedule/full"
  },
  {
    label: "Durable Goods Orders",
    releaseAt: "2026-05-28T12:30:00.000Z",
    dateKst: "05.28 21:30",
    state: "upcoming",
    importance: 2,
    forecast: "확인 예정",
    previous: "확인 예정",
    summary: "미국 제조업 주문과 기업 투자 흐름을 빠르게 확인하는 지표입니다.",
    marketImpact:
      "주문이 강하면 경기 체력 해석은 좋아질 수 있지만, 금리 부담과 달러 반응까지 같이 확인해야 합니다.",
    source: "Census",
    sourceUrl: "https://www.census.gov/economic-indicators/"
  }
];
