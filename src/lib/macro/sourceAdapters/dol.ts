// DOL 실업수당 지표의 공식 출처 상태를 보강합니다.
import { type MacroSourceEnrichment } from "@/lib/macro/types";

export function getDolOfficialEnrichments(): MacroSourceEnrichment[] {
  return [
    {
      matcher: /jobless|unemployment claims|initial claims|continuing claims/i,
      eventType: "numeric_release",
      source: "DOL",
      sourceType: "official_page",
      sourceUrl: "https://oui.doleta.gov/unemploy/claims.asp",
      officialUrl: undefined,
      isOfficial: true,
      confidence: 0.7,
      staleReason: "DOL weekly claims 공식 페이지는 연결했지만 실제값 자동 추출은 추후 과제로 남깁니다."
    }
  ];
}
