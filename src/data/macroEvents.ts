// 미국 주요 매크로 발표 일정을 한국시간 기준으로 관리하는 데이터입니다.
export type MacroEventState = "upcoming" | "released" | "watch";
export type MacroEventImportance = 1 | 2 | 3;
export type MacroEventSource = "BLS" | "BEA" | "Fed" | "Census" | "NAR";

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

export const macroCalendarUpdatedAt = "2026년 5월 11일 기준";

export const macroCalendarSourceNote =
  "화면 시간은 모두 한국시간입니다. 실제 발표값은 공식 발표 후 24시간 동안 최근 발표 영역에 남기고, 정식 자동 캘린더 연동 전까지 주요 일정은 수동으로 갱신합니다.";

export const macroItems: MacroEventItem[] = [
  {
    label: "Existing Home Sales",
    releaseAt: "2026-05-11T23:00:00+09:00",
    dateKst: "5월 11일 23:00",
    state: "upcoming",
    importance: 2,
    actual: "발표 전",
    forecast: "4.05M",
    previous: "3.98M",
    summary: "미국 기존주택 판매 흐름을 확인하는 지표입니다. 금리 부담 속에서도 주택 수요가 버티는지 보는 일정입니다.",
    marketImpact: "예상보다 강하면 경기 둔화 우려가 줄어 주식에는 우호적일 수 있지만, 금리 부담이 커지면 성장주와 코인에는 변동성이 생길 수 있습니다.",
    source: "NAR",
    sourceUrl: "https://www.nar.realtor/research-and-statistics/housing-statistics/existing-home-sales"
  },
  {
    label: "CPI / Core CPI",
    releaseAt: "2026-05-12T21:30:00+09:00",
    dateKst: "5월 12일 21:30",
    state: "upcoming",
    importance: 3,
    actual: "발표 전",
    forecast: "컨센서스 확인 필요",
    previous: "이전 물가 흐름 확인",
    summary: "미국 소비자물가가 다시 둔화되는지 확인하는 핵심 발표입니다.",
    marketImpact: "예상보다 높으면 금리 부담과 달러 강세가 커질 수 있어 코인과 성장주 변동성이 커질 수 있습니다.",
    source: "BLS",
    sourceUrl: "https://www.bls.gov/schedule/news_release/cpi.htm"
  },
  {
    label: "PPI",
    releaseAt: "2026-05-13T21:30:00+09:00",
    dateKst: "5월 13일 21:30",
    state: "upcoming",
    importance: 2,
    actual: "발표 전",
    forecast: "컨센서스 확인 필요",
    previous: "이전 생산자물가 확인",
    summary: "생산자물가가 소비자물가로 이어질 가능성을 보는 발표입니다.",
    marketImpact: "CPI 직후 인플레이션 기대를 다시 흔들 수 있어 단기 추격 진입은 주의가 필요합니다.",
    source: "BLS",
    sourceUrl: "https://www.bls.gov/schedule/news_release/ppi.htm"
  },
  {
    label: "Retail Sales",
    releaseAt: "2026-05-14T21:30:00+09:00",
    dateKst: "5월 14일 21:30",
    state: "upcoming",
    importance: 2,
    actual: "발표 전",
    forecast: "컨센서스 확인 필요",
    previous: "이전 소매판매 확인",
    summary: "미국 소비가 얼마나 강한지 확인하는 지표입니다.",
    marketImpact: "소비가 강하면 경기 우려는 줄지만 금리 인하 기대가 약해질 수 있어 주식과 코인 모두 발표 직후 흔들릴 수 있습니다.",
    source: "Census",
    sourceUrl: "https://www.census.gov/retail/index.html"
  },
  {
    label: "Initial Jobless Claims",
    releaseAt: "2026-05-14T21:30:00+09:00",
    dateKst: "5월 14일 21:30",
    state: "upcoming",
    importance: 2,
    actual: "발표 전",
    forecast: "컨센서스 확인 필요",
    previous: "이전 실업수당 청구 확인",
    summary: "고용 둔화 여부를 매주 확인하는 지표입니다.",
    marketImpact: "청구건수가 급증하면 경기 둔화 우려가 커지고, 너무 낮으면 금리 부담이 다시 살아날 수 있습니다.",
    source: "BLS",
    sourceUrl: "https://www.dol.gov/ui/data.pdf"
  },
  {
    label: "Industrial Production",
    releaseAt: "2026-05-15T22:15:00+09:00",
    dateKst: "5월 15일 22:15",
    state: "upcoming",
    importance: 1,
    actual: "발표 전",
    forecast: "컨센서스 확인 필요",
    previous: "이전 산업생산 확인",
    summary: "제조업과 산업 활동의 회복 여부를 확인하는 참고 지표입니다.",
    marketImpact: "예상보다 강하면 경기민감 섹터에는 우호적이고, 약하면 안전자산 선호가 커질 수 있습니다.",
    source: "Fed",
    sourceUrl: "https://www.federalreserve.gov/releases/g17/current/default.htm"
  },
  {
    label: "FOMC",
    releaseAt: "2026-06-18T03:00:00+09:00",
    dateKst: "6월 18일 03:00",
    state: "watch",
    importance: 3,
    actual: "회의 전",
    forecast: "금리 경로와 성명서 문구 확인",
    previous: "이전 회의 이후 다음 정책 회의",
    summary: "금리 결정, 성명서, 기자회견이 함께 나오는 가장 큰 매크로 이벤트입니다.",
    marketImpact: "예상보다 매파적이면 코인과 성장주가 급락할 수 있고, 비둘기파적이면 위험자산 반등이 나올 수 있습니다.",
    source: "Fed",
    sourceUrl: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"
  }
];
