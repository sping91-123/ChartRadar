// Census 경제지표의 공식 출처와 API 기준 상태를 보강합니다.
import { type MacroSourceEnrichment } from "@/lib/macro/types";

export function getCensusOfficialEnrichments(): MacroSourceEnrichment[] {
  return [
    {
      matcher: /retail sales|durable goods|new home sales|construction spending|factory orders/i,
      eventType: "numeric_release",
      source: "Census",
      sourceType: "official_page",
      sourceUrl: "https://www.census.gov/data/developers/data-sets/economic-indicators.html",
      officialUrl: undefined,
      isOfficial: true,
      confidence: 0.7,
      staleReason: "Census Economic Indicators API 구조는 연결했지만 실제값 추출은 추후 매핑 과제로 남깁니다."
    }
  ];
}
