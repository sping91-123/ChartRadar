// 미국 주요 매크로 발표 일정을 한국시간 기준으로 관리하는 데이터입니다.
export type MacroEventState = "upcoming" | "released" | "watch";
export type MacroEventImportance = 1 | 2 | 3;
export type MacroEventSource = "BLS" | "BEA" | "Fed" | "Census" | "NAR" | "TradingEconomics" | "Official";

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

export const macroCalendarUpdatedAt = "2026년 5월 13일 02:00 기준";
export const macroCalendarUpdatedAtIso = "2026-05-13T02:00:00+09:00";

export const macroCalendarSourceNote =
  "화면 시간은 모두 한국시간입니다. 자동 캘린더가 연결되면 실제 발표값과 예상·이전 수치가 주기적으로 갱신되고, 장애 시에는 백업 일정으로 표시됩니다.";

export const macroItems: MacroEventItem[] = [
  {
    label: "CPI / Core CPI",
    releaseAt: "2026-05-12T21:30:00+09:00",
    dateKst: "5월 12일 21:30",
    state: "released",
    importance: 3,
    actual: "CPI +0.6% MoM / +3.8% YoY, Core +0.4% MoM / +2.8% YoY",
    forecast: "CPI +0.6% MoM / +3.7% YoY, Core +0.3% MoM / +2.7% YoY",
    previous: "CPI +0.9% MoM / +3.3% YoY, Core +0.2% MoM / +2.6% YoY",
    summary: "4월 CPI는 전월비 상승폭은 둔화됐지만, 전년비와 근원 물가가 예상보다 강하게 확인된 발표입니다.",
    marketImpact:
      "물가가 예상보다 끈적하면 금리 인하 기대가 약해질 수 있습니다. 코인과 성장주는 발표 직후 달러, 국채금리, 나스닥 반응을 함께 확인해야 합니다.",
    source: "BLS",
    sourceUrl: "https://www.bls.gov/news.release/archives/cpi_05122026.htm"
  },
  {
    label: "PPI / Core PPI",
    releaseAt: "2026-05-13T21:30:00+09:00",
    dateKst: "5월 13일 21:30",
    state: "released",
    importance: 3,
    actual: "PPI +1.4% MoM / +6.0% YoY, Core +1.0% MoM / +5.2% YoY",
    forecast: "PPI +0.5% MoM / +4.9% YoY, Core +0.3% MoM / +4.3% YoY",
    previous: "PPI +0.5% MoM / +4.0% YoY, Core +0.2% MoM / +3.8% YoY",
    summary: "4월 생산자물가는 예상보다 강하게 확인됐습니다. CPI 이후 비용 압력 우려가 다시 커진 발표입니다.",
    marketImpact:
      "PPI가 예상보다 강하게 나오면 금리 인하 기대가 약해지고 달러와 국채금리 반응이 커질 수 있습니다. 코인과 성장주는 발표 후 변동성 확대를 조심해야 합니다.",
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
    previous: "+1.7% MoM",
    summary: "미국 소비가 얼마나 버티는지 확인하는 지표입니다. 물가 부담 속에서도 소비가 강한지 보는 일정입니다.",
    marketImpact:
      "소비가 강하면 경기 우려는 줄지만 금리 인하 기대는 약해질 수 있습니다. 소비가 약하면 경기 둔화 우려와 금리 완화 기대가 동시에 움직일 수 있습니다.",
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
    forecast: "206K",
    previous: "200K",
    summary: "고용 둔화 여부를 매주 확인하는 지표입니다. 노동시장이 빠르게 식는지 보는 일정입니다.",
    marketImpact:
      "청구건수가 예상보다 크게 늘면 경기 둔화 우려가 커질 수 있습니다. 너무 낮게 나오면 고용이 여전히 강하다는 해석으로 금리 부담이 다시 살아날 수 있습니다.",
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
    previous: "-0.5% MoM",
    summary: "제조업과 산업 활동의 회복 여부를 확인하는 참고 지표입니다.",
    marketImpact:
      "예상보다 강하면 경기민감 섹터에는 우호적이고, 약하면 안전자산 선호가 커질 수 있습니다. 코인에는 단독보다 금리와 달러 반응이 더 중요합니다.",
    source: "Fed",
    sourceUrl: "https://www.federalreserve.gov/releases/g17/current/default.htm"
  },
  {
    label: "Existing Home Sales",
    releaseAt: "2026-05-11T23:00:00+09:00",
    dateKst: "5월 11일 23:00",
    state: "released",
    importance: 2,
    actual: "4.02M",
    forecast: "4.05M",
    previous: "4.01M",
    summary: "4월 기존주택판매는 전월보다 소폭 늘었지만 예상에는 못 미쳤습니다. 주택 수요가 여전히 금리 부담을 받고 있습니다.",
    marketImpact:
      "예상보다 약한 주택지표는 성장 둔화 쪽 해석을 키울 수 있습니다. 다만 발표 후 24시간이 지나 메인 최근 발표 영역에서는 제외될 수 있습니다.",
    source: "NAR",
    sourceUrl: "https://www.nar.realtor/research-and-statistics/housing-statistics/existing-home-sales"
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
    summary: "금리 결정, 성명서, 기자회견을 함께 확인하는 가장 큰 매크로 이벤트입니다.",
    marketImpact:
      "예상보다 매파적이면 코인과 성장주가 급락할 수 있고, 비둘기파적이면 위험자산 반등이 나올 수 있습니다.",
    source: "Fed",
    sourceUrl: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"
  }
];
