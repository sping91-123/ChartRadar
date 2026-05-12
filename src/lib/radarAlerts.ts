// Chart Radar 알림 규칙과 결제 가치를 한곳에서 관리한다.
export type RadarAlertRuleId =
  | "radar-grade"
  | "liquidation-pressure"
  | "watchlist-surge"
  | "macro-news"
  | "stock-momentum";

export type RadarAlertCategory = "crypto" | "stocks" | "news" | "system";

export interface RadarAlertRule {
  id: RadarAlertRuleId;
  category: RadarAlertCategory;
  tier: "free" | "pro";
  title: string;
  shortTitle: string;
  description: string;
  trigger: string;
  cadence: string;
  value: string;
  defaultEnabled: boolean;
}

export const radarAlertRules: RadarAlertRule[] = [
  {
    id: "radar-grade",
    category: "crypto",
    tier: "pro",
    title: "A급 레이더 감지",
    shortTitle: "A급 감지",
    description: "전체 코인 중 구조 점수가 높은 후보가 새로 올라오면 알려줍니다.",
    trigger: "A급 또는 80점 이상 감지, 같은 코인 중복 제거 후 새 후보 발생",
    cadence: "5분 단위 확인",
    value: "앱을 켜지 않아도 먼저 봐야 할 종목을 놓치지 않게 만듭니다.",
    defaultEnabled: true
  },
  {
    id: "liquidation-pressure",
    category: "crypto",
    tier: "pro",
    title: "청산 압력 급등",
    shortTitle: "청산 압력",
    description: "펀딩비, OI 변화, 롱숏 쏠림이 동시에 과열될 때 알려줍니다.",
    trigger: "청산 압력 레이더 과열 또는 극단 단계 진입",
    cadence: "15분 단위 확인",
    value: "추격 진입과 고배율 구간을 피하는 데 가장 직접적으로 도움이 됩니다.",
    defaultEnabled: true
  },
  {
    id: "watchlist-surge",
    category: "crypto",
    tier: "pro",
    title: "관심코인 급변동",
    shortTitle: "관심 급변",
    description: "내가 저장한 코인이 큰 변동이나 구조 변화를 만들 때 알려줍니다.",
    trigger: "관심코인 변동률, 거래대금, MSB/CHoCH 변화 감지",
    cadence: "실시간 감시에 가깝게 확장 예정",
    value: "수십 개 코인을 직접 새로고침하지 않아도 내 관심 목록만 따라갈 수 있습니다.",
    defaultEnabled: true
  },
  {
    id: "macro-news",
    category: "news",
    tier: "free",
    title: "뉴스·매크로 브리핑",
    shortTitle: "뉴스 브리핑",
    description: "시장에 영향을 줄 수 있는 뉴스와 미국 주요 발표 일정을 요약해 알려줍니다.",
    trigger: "주요 뉴스 묶음 갱신 또는 매크로 이벤트 전광판 갱신",
    cadence: "하루 여러 번",
    value: "차트만 보다가 놓치기 쉬운 변동성 이벤트를 먼저 확인하게 합니다.",
    defaultEnabled: true
  },
  {
    id: "stock-momentum",
    category: "stocks",
    tier: "pro",
    title: "글로벌 모멘텀 전환",
    shortTitle: "글로벌 모멘텀",
    description: "미국 주요 종목, ETF, 지수·원자재 흐름의 추세·모멘텀 전환을 알려줍니다.",
    trigger: "주요 종목 기술지표 점수 급변, 섹터 강도 변화",
    cadence: "미장 정규장 중심",
    value: "여러 글로벌 자산군을 따로 새로고침하지 않고 한 화면에서 감시하게 돕습니다.",
    defaultEnabled: true
  }
];

export function getDefaultRadarAlertRuleIds() {
  return radarAlertRules.filter((rule) => rule.defaultEnabled).map((rule) => rule.id);
}

export function summarizeRadarAlerts(enabledIds: RadarAlertRuleId[]) {
  const enabledRules = radarAlertRules.filter((rule) => enabledIds.includes(rule.id));
  const proCount = enabledRules.filter((rule) => rule.tier === "pro").length;
  const freeCount = enabledRules.length - proCount;

  return {
    enabledRules,
    enabledCount: enabledRules.length,
    proCount,
    freeCount,
    headline:
      enabledRules.length >= 4
        ? "시장을 켜두지 않아도 핵심 변화는 대부분 잡히는 설정입니다."
        : enabledRules.length >= 2
          ? "기본 감시는 켜졌지만, Pro 알림을 더 켜면 앱을 여는 이유가 더 강해집니다."
          : "아직 알림이 적습니다. 최소 뉴스 브리핑과 레이더 감지는 켜두는 편이 좋습니다."
  };
}
