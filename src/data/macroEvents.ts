// 자동 매크로 캘린더가 실패했을 때 보여줄 예비 경제 일정입니다.
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

export const macroCalendarUpdatedAt = "2026년 5월 15일 예비 일정 갱신";
export const macroCalendarUpdatedAtIso = "2026-05-15T00:00:00.000Z";
export const macroCalendarSourceNote =
  "공개 경제 캘린더와 공식 통계 데이터를 우선 확인합니다. 자동 확인이 막히면 예비 일정으로 보여주고, 다음 주기에 다시 갱신을 시도합니다.";

export const macroItems: MacroEventItem[] = [
  {
    label: "Initial Jobless Claims",
    releaseAt: "2026-05-21T12:30:00.000Z",
    dateKst: "05.21 21:30",
    state: "upcoming",
    importance: 3,
    forecast: "확인 예정",
    previous: "확인 예정",
    summary: "미국 고용 둔화 여부를 매주 확인하는 지표입니다.",
    marketImpact:
      "청구건수가 예상보다 크게 늘면 경기 둔화 우려가 커질 수 있고, 예상보다 낮으면 금리 인하 기대가 약해질 수 있습니다.",
    source: "DOL",
    sourceUrl: "https://oui.doleta.gov/unemploy/claims.asp"
  },
  {
    label: "Existing Home Sales",
    releaseAt: "2026-05-21T14:00:00.000Z",
    dateKst: "05.21 23:00",
    state: "upcoming",
    importance: 2,
    forecast: "확인 예정",
    previous: "확인 예정",
    summary: "미국 주택시장 체력과 소비 심리를 함께 가늠할 수 있는 지표입니다.",
    marketImpact:
      "주택 판매가 강하면 경기 체력이 좋다는 해석이 가능하지만, 금리 부담이 다시 부각될 수도 있습니다.",
    source: "NAR",
    sourceUrl: "https://www.nar.realtor/research-and-statistics"
  },
  {
    label: "S&P Global US Manufacturing PMI Flash",
    releaseAt: "2026-05-21T13:45:00.000Z",
    dateKst: "05.21 22:45",
    state: "upcoming",
    importance: 2,
    forecast: "확인 예정",
    previous: "확인 예정",
    summary: "미국 제조업 경기의 단기 온도를 빠르게 확인하는 지표입니다.",
    marketImpact:
      "예상보다 강하면 경기 민감 자산에는 긍정적일 수 있지만, 동시에 금리 부담을 키울 수 있어 발표 직후 반응 확인이 중요합니다.",
    source: "ForexFactory",
    sourceUrl: "https://www.forexfactory.com/calendar"
  },
  {
    label: "University of Michigan Consumer Sentiment Final",
    releaseAt: "2026-05-22T14:00:00.000Z",
    dateKst: "05.22 23:00",
    state: "upcoming",
    importance: 2,
    forecast: "확인 예정",
    previous: "확인 예정",
    summary: "미국 소비자 심리와 기대 인플레이션을 같이 확인할 수 있는 지표입니다.",
    marketImpact:
      "기대 인플레이션이 높게 나오면 금리 부담이 커질 수 있고, 심리가 개선되면 소비 관련 자산에는 우호적일 수 있습니다.",
    source: "Official",
    sourceUrl: "https://www.sca.isr.umich.edu/"
  }
];
