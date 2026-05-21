// BEA 지표의 공식 출처와 API 기준 상태를 보강합니다.
import { type MacroSourceEnrichment } from "@/lib/macro/types";

export function getBeaOfficialEnrichments(): MacroSourceEnrichment[] {
  return [
    {
      matcher: /gdp|gross domestic product|pce|personal income|personal spending/i,
      eventType: "numeric_release",
      source: "BEA",
      sourceType: "official_page",
      sourceUrl: "https://www.bea.gov/news/schedule",
      officialUrl: undefined,
      isOfficial: true,
      confidence: 0.72,
      staleReason: "BEA 공식 일정은 연결했지만 실제값은 이번 범위에서 자동 추출하지 않습니다."
    }
  ];
}
