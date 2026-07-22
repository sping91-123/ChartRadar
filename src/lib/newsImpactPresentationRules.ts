import { officialMacroHeadline } from "./newsImpact";

const legacyGenericMacroHeadline = /미국 (?:주요 )?경제지표 (?:공식 )?발표/;

export function repairLegacyMacroPresentation(input: {
  category: string;
  macroEventKey?: string | null;
  headline: string;
  factSummary: string;
}) {
  const genericHeadline = input.category === "macro" && legacyGenericMacroHeadline.test(input.headline);
  const genericFactSummary = input.category === "macro" && input.factSummary.includes("미국 공식 기관이 공식 경제지표를 발표했습니다.");
  if ((!genericHeadline && !genericFactSummary) || !input.macroEventKey) {
    return { headline: input.headline, factSummary: input.factSummary };
  }
  const headline = genericHeadline ? officialMacroHeadline(input.macroEventKey) : input.headline;
  const factSummary = input.factSummary
    .replace("미국 공식 기관이 공식 경제지표를 발표했습니다.", `${headline} 내용이 공식 자료에 반영됐습니다.`)
    .replace(legacyGenericMacroHeadline, headline);
  return { headline, factSummary };
}

export function publicNewsReactionSummary(input: {
  eventStatus: string;
  stage: string;
  reactionSummary: string;
}) {
  if (input.eventStatus === "revised" && input.stage === "detected") {
    return "공식 발표 내용이 수정되어 수정 시점 이후 15분 시장 반응을 다시 확인 중입니다.";
  }
  return input.reactionSummary;
}
