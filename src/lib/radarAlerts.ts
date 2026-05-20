// Chart Radar 알림 규칙과 사용자-facing 설명을 관리합니다.
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
    description: "여러 코인 중 구조 점수가 높은 후보가 새로 올라오면 알려줍니다.",
    trigger: "A급 또는 80점 이상 후보가 새로 감지되고, 같은 코인의 중복 후보는 정리합니다.",
    cadence: "5분 단위 확인",
    value: "앱을 계속 켜지 않아도 먼저 봐야 할 코인을 놓치지 않게 도와줍니다.",
    defaultEnabled: true
  },
  {
    id: "liquidation-pressure",
    category: "crypto",
    tier: "pro",
    title: "청산 압력 급등",
    shortTitle: "청산 압력",
    description: "롱/숏 비율, OI 변화, 체결 쏠림이 함께 과열될 때 알려줍니다.",
    trigger: "청산 압력 레이더가 과열 또는 극단 구간에 진입합니다.",
    cadence: "15분 단위 확인",
    value: "추격 진입과 고배율 구간을 피해야 할 때를 더 빨리 알아차릴 수 있습니다.",
    defaultEnabled: true
  },
  {
    id: "watchlist-surge",
    category: "crypto",
    tier: "pro",
    title: "관심코인 급변",
    shortTitle: "관심 급변",
    description: "저장한 코인에서 변동성, 거래대금, 구조 변화가 커지면 알려줍니다.",
    trigger: "관심코인의 변동률, 거래대금, MSB/CHoCH 변화가 감지됩니다.",
    cadence: "실시간 감시에 가깝게 확장 예정",
    value: "수십 개 코인을 직접 새로고침하지 않아도 내 관심 목록만 따라갈 수 있습니다.",
    defaultEnabled: true
  },
  {
    id: "macro-news",
    category: "news",
    tier: "free",
    title: "뉴스와 시장 이벤트 리마인더",
    shortTitle: "이벤트 리마인더",
    description: "시장에 영향을 줄 수 있는 뉴스와 CPI, FOMC, 고용 등 주요 이벤트를 요약합니다.",
    trigger: "주요 뉴스 묶음이 갱신되거나 시장 이벤트 리스크가 커집니다.",
    cadence: "하루 여러 번 확인",
    value: "차트만 보다가 놓치기 쉬운 변동성 이벤트를 먼저 확인하게 해줍니다.",
    defaultEnabled: true
  },
  {
    id: "stock-momentum",
    category: "stocks",
    tier: "pro",
    title: "글로벌 모멘텀 전환",
    shortTitle: "글로벌 모멘텀",
    description: "지수, 변동성, 반도체 주도력, 방어 자산 흐름 변화를 알려줍니다.",
    trigger: "QQQ/SPY/NQ/ES 흐름 전환, VIX 급등·완화, NVDA/SMH 주도력 변화, 리스크오프 조합이 감지됩니다.",
    cadence: "미장 정규장 중심 확인",
    value: "지수만 보는 것보다 변동성, 반도체, 달러·금 흐름까지 묶어서 시장 분위기를 확인할 수 있습니다.",
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
        ? "주요 변화 대부분을 놓치지 않도록 넓게 감시하는 설정입니다."
        : enabledRules.length >= 2
          ? "기본 감시가 켜져 있습니다. Pro 알림을 더 켜면 중요한 변화만 더 촘촘하게 받을 수 있습니다."
          : "아직 알림이 적습니다. 최소 뉴스 브리핑과 레이더 감지는 켜두는 편이 좋습니다."
  };
}
