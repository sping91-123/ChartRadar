// Chart Radar 알림 규칙과 사용자-facing 설명을 관리합니다.
export type RadarAlertRuleId =
  | "radar-grade"
  | "rapid-price-move"
  | "liquidation-pressure"
  | "watchlist-surge"
  | "macro-news"
  | "macro-event-reminder"
  | "news-impact"
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
    id: "rapid-price-move", category: "crypto", tier: "pro",
    title: "BTC·ETH 급등·급락", shortTitle: "급등·급락",
    description: "BTC·ETH가 짧은 시간에 크게 움직이면 변화율과 확인할 가격 범위를 알려줍니다.",
    trigger: "확정 1분봉 기준 · BTC 5분 ±1% 또는 15분 ±2%, ETH 5분 ±1.5% 또는 15분 ±3%.",
    cadence: "1분마다 확인 · 같은 방향의 반복 제한",
    value: "알림 당시 차트와 변동 전 고가·저가를 확인하고 현재 분석으로 이어집니다.",
    defaultEnabled: true
  },
  {
    id: "radar-grade",
    category: "crypto",
    tier: "pro",
    title: "시장 레이더 후보 감지",
    shortTitle: "시장 후보",
    description: "관심코인 여부와 별개로 시장 전체 스캔에서 엄격 기준을 통과한 후보만 알려줍니다.",
    trigger: "메이저는 80점 이상, 알트는 더 엄격한 점수와 거래량·변동성·구조 근거를 함께 확인합니다.",
    cadence: "5분 단위 확인",
    value: "앱을 계속 켜지 않아도 먼저 봐야 할 코인을 놓치지 않게 도와줍니다.",
    defaultEnabled: true
  },
  {
    id: "liquidation-pressure",
    category: "crypto",
    tier: "pro",
    title: "포지션 압력 확대",
    shortTitle: "포지션 압력",
    description: "BTC 포지션 압력의 새 감지·증가·위험 방향 전환과 당시 확인할 가격을 알려줍니다.",
    trigger: "정상 자료로 과열을 확인하고, 직전 발송보다 10점 이상 증가하거나 매우 높음 구간 진입·위험 방향 반전이 있을 때 알립니다.",
    cadence: "최대 5분 간격 검사 · 확정 15분봉 기준 · 같은 경고 반복 제한",
    value: "알림 당시 봉, 직전 1시간 고가·저가와 다음 확인 기준을 이어봅니다.",
    defaultEnabled: true
  },
  {
    id: "watchlist-surge",
    category: "crypto",
    tier: "pro",
    title: "관심코인 조건 재감지",
    shortTitle: "관심 조건",
    description: "사용자가 저장한 코인과 조건에 가까운 흐름이 다시 나타날 때 알려줍니다.",
    trigger: "저장한 심볼, 방향, 등급, 점수 조건과 다시 가까워지는 흐름이 감지됩니다.",
    cadence: "실시간 감시에 가깝게 확장 예정",
    value: "수십 개 코인을 직접 새로고침하지 않아도 내 관심 목록만 따라갈 수 있습니다.",
    defaultEnabled: true
  },
  {
    id: "macro-event-reminder",
    category: "system",
    tier: "free",
    title: "주요 경제 일정 리마인더",
    shortTitle: "이벤트 리마인더",
    description: "CPI, FOMC, 고용 등 중요도가 높은 공식 경제 일정만 미리 알립니다.",
    trigger: "중요 공식 발표가 24시간 안에 예정됐을 때 사건당 한 번 알립니다.",
    cadence: "사건당 1회 · 하루 최대 3회",
    value: "차트만 보다가 놓치기 쉬운 공식 발표 시각을 먼저 확인하게 해줍니다.",
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
          : "아직 알림이 적습니다. 주요 경제 일정 리마인더와 필요한 감시 조건을 확인해 보세요."
  };
}
