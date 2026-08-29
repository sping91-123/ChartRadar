import type { MarketBriefingInput } from "@/lib/ai";
import { decisionStateLabel, flowDirectionLabel, plainDirection, pressureDirectionLabel, regimeLabel } from "../perpetualDecisionCopy";
import { hasQualifiedMssSemantics, type PerpetualDecisionSnapshot } from "../perpetualDecisionSnapshot";

function detailText(snapshot: PerpetualDecisionSnapshot, key: "orderBlock" | "fvg") {
  const detail = snapshot.pro?.multiTimeframeEvidence.find((item) => item.timeframe === "15m")?.details;
  const zone = detail?.zones[key];
  if (!zone) return "뚜렷한 구간 없음";
  const name = key === "orderBlock" ? "큰 주문 반응 구간" : "가격이 빠르게 지나간 구간";
  return `${name} ${zone.bottom.toLocaleString("ko-KR")}~${zone.top.toLocaleString("ko-KR")}${zone.isInside ? " 안에 있음" : " 밖에 있음"}`;
}

function locationText(snapshot: PerpetualDecisionSnapshot) {
  const detail = snapshot.pro?.multiTimeframeEvidence.find((item) => item.timeframe === "15m")?.details;
  const position = detail?.location.premiumDiscount;
  if (position === "premium") return "최근 가격 범위의 위쪽";
  if (position === "discount") return "최근 가격 범위의 아래쪽";
  if (position === "equilibrium") return "최근 가격 범위의 가운데";
  return "현재 위치 확인 중";
}

function directionSummary(snapshot: PerpetualDecisionSnapshot) {
  if (!hasQualifiedMssSemantics(snapshot)) {
    const frames = snapshot.pro?.multiTimeframeEvidence ?? [];
    return frames.map((item) => `${item.label} 구조 ${plainDirection(item.structure)}`).join(" · ") || snapshot.summary.reasons[0];
  }
  const frames = snapshot.publicEvidence?.context ?? [];
  return frames.map((item) => `${item.label} ${plainDirection(item.trend)}`).join(" · ") || snapshot.summary.reasons[0];
}

function formatBriefingTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "분석 시각 확인 필요";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

export function buildPerpetualBriefingInput(snapshot: PerpetualDecisionSnapshot): MarketBriefingInput {
  const qualifiedMssSemantics = hasQualifiedMssSemantics(snapshot);
  const frames = snapshot.pro?.multiTimeframeEvidence ?? [];
  const active = frames.find((item) => item.timeframe === "15m") ?? frames[0];
  const activeDetails = active?.details;
  const pressure = snapshot.pro?.pressure;
  const flow = snapshot.pro?.flow;
  const consensus = snapshot.summary.analysisConsensus;
  const bias = snapshot.summary.state === "upside_watch" ? "long" : snapshot.summary.state === "downside_watch" ? "short" : "neutral";
  const score = consensus?.normalizedScore ?? (frames.length ? frames.reduce((sum, item) => sum + item.score, 0) / frames.length : 0);
  const aligned = consensus?.finalDirection === "bullish" || consensus?.finalDirection === "bearish";

  return {
    symbol: snapshot.symbol,
    analysisScope: qualifiedMssSemantics
      ? `${formatBriefingTime(snapshot.generatedAt)}에 저장한 1분·5분·15분·1시간·4시간·1일 확정 구조 종합 분석. 제한 이력의 앱 근사 재현이며 초보자도 이해할 수 있는 쉬운 말로 설명`
      : `${formatBriefingTime(snapshot.generatedAt)}에 저장한 기존 15분·1시간·4시간 MSB·CHoCH 분석. 새 MSS 의미로 재해석하지 말고 저장 당시 의미로 설명`,
    hideNumericScores: true,
    activeTimeframe: "15m",
    tradingMode: "scalp",
    price: snapshot.price,
    verdict: decisionStateLabel(snapshot.summary.state),
    bias,
    biasScore: score,
    scoreRange: "시간대별 구조 비교",
    readiness: snapshot.quality === "ready" ? "high" : snapshot.quality === "unavailable" ? "low" : "medium",
    summaryLine: snapshot.summary.headline,
    actionGuide: snapshot.summary.primaryCondition.label,
    currentLocationLabel: locationText(snapshot),
    killzone: "off",
    opportunityFlags: [directionSummary(snapshot), flow ? flowDirectionLabel(flow.dominantSide) : "큰 금액 체결 확인 중"],
    riskFlags: [snapshot.summary.topRisk],
    reasons: snapshot.summary.reasons.map((text) => ({ text, tone: "neutral" })),
    active: {
      timeframe: "15m",
      msb: plainDirection(active?.structure ?? "unknown"),
      choch: plainDirection(active?.transition ?? "unknown"),
      ob: detailText(snapshot, "orderBlock"),
      fvg: detailText(snapshot, "fvg"),
      sweep: activeDetails?.events.sweep ? `${plainDirection(activeDetails.events.sweep.direction)} ${activeDetails.events.sweep.level.toLocaleString("ko-KR")}` : "없음",
      cisd: activeDetails?.events.cisd ? `${plainDirection(activeDetails.events.cisd.direction)} ${activeDetails.events.cisd.level.toLocaleString("ko-KR")}` : "없음",
      pd: locationText(snapshot),
      poc: activeDetails?.location.poc ? activeDetails.location.poc.poc.toLocaleString("ko-KR") : "확인 중",
      rsi: activeDetails?.indicators.rsi14?.toFixed(1) ?? "확인 중",
      macd: activeDetails?.indicators.macdState ?? "확인 중",
      volatility: activeDetails?.indicators.volatilityState ?? "확인 중",
      volume: activeDetails?.indicators.volumeState ?? "확인 중",
      bollinger: activeDetails?.indicators.bollingerPosition ?? "확인 중"
    },
    aggregate: {
      directionLabel: decisionStateLabel(snapshot.summary.state),
      compositeScore: score,
      alignment: aligned ? "큰 흐름과 현재 구조가 같은 방향입니다." : "큰 흐름과 현재 구조가 아직 정렬되지 않았습니다.",
      shortTimeframeSummary: consensus?.layers[2].detail ?? (active ? `${qualifiedMssSemantics ? "15분 확정 구조" : "15분 구조 흐름"} ${plainDirection(active.structure)}, ${qualifiedMssSemantics ? "전환 경고" : "전환 신호"} ${plainDirection(active.transition)}` : "단기 반응 확인 중"),
      higherTimeframeSummary: consensus ? `${consensus.layers[0].detail} ${consensus.layers[1].detail}` : "상위 시간대 확인 중",
      volatility: activeDetails?.indicators.volatilityState ?? "확인 중",
      volume: activeDetails?.indicators.volumeState ?? "확인 중",
      keySignals: qualifiedMssSemantics
        ? snapshot.publicEvidence?.context?.map((item) => `${item.label}: MSS ${plainDirection(item.trend)}, MSB ${plainDirection(item.continuation)}, CHoCH ${plainDirection(item.warning)}`)
          ?? frames.map((item) => `${item.label}: 구조 ${plainDirection(item.structure)}, 전환 경고 ${plainDirection(item.transition)}, ${regimeLabel(item.regime)}`)
        : frames.map((item) => `${item.label}: MSB 구조 ${plainDirection(item.structure)}, CHoCH 전환 ${plainDirection(item.transition)}, ${regimeLabel(item.regime)}`)
    },
    pressure: pressure
      ? {
          dominant: pressure.dominantSide === "upsideShorts" ? "long" : pressure.dominantSide === "downsideLongs" ? "short" : "balanced",
          dominantLabel: pressureDirectionLabel(pressure.dominantSide),
          longScore: pressure.upsideShortPressure,
          shortScore: pressure.downsideLongPressure,
          summary: pressure.summary,
          structurePressureRead: flow ? flowDirectionLabel(flow.dominantSide) : "큰 금액 체결 확인 중",
          evidence: [
            `펀딩 ${pressure.details?.fundingRatePercent ?? "확인 중"}`,
            `미결제약정 변화 ${pressure.details?.openInterestChangePercent ?? "확인 중"}`
          ]
        }
      : undefined,
    timeframes: frames.map((item) => ({
      timeframe: item.timeframe,
      msb: plainDirection(item.structure),
      choch: plainDirection(item.transition),
      score: item.score,
      summary: regimeLabel(item.regime)
    })),
    scenario: null
  };
}

export function fallbackPerpetualBriefing(snapshot: PerpetualDecisionSnapshot) {
  const qualifiedMssSemantics = hasQualifiedMssSemantics(snapshot);
  const structure = qualifiedMssSemantics
    ? (snapshot.publicEvidence?.context ?? []).map((item) => `${item.label}은 ${plainDirection(item.trend)}`).join(", ")
    : (snapshot.pro?.multiTimeframeEvidence ?? []).map((item) => `${item.label} 구조는 ${plainDirection(item.structure)}`).join(", ");
  const pressure = snapshot.pro?.pressure ? pressureDirectionLabel(snapshot.pro.pressure.dominantSide) : "포지션 쏠림은 확인 중입니다";
  const flow = snapshot.pro?.flow ? flowDirectionLabel(snapshot.pro.flow.dominantSide) : "큰 금액 체결은 확인 중입니다";
  return `${snapshot.symbol.replace("USDT", "")}는 현재 ${decisionStateLabel(snapshot.summary.state)} 상태입니다. ${structure || snapshot.summary.reasons[0]}. ${pressure}, ${flow}입니다. 이 설명은 ${formatBriefingTime(snapshot.generatedAt)} 기준으로 저장된 같은 분석 결과만 읽었습니다.\n\n가장 조심할 점은 ${snapshot.summary.topRisk} 지금은 ${snapshot.summary.primaryCondition.label}를 확인하세요. 이 조건이 나오기 전에는 한 번의 움직임만 보고 방향을 확정하지 않는 편이 좋습니다.`;
}

const technicalTerms = "(?:RSI|MACD|기술지표|보조지표|EMA|ADX|DMI|Supertrend|슈퍼트렌드|Bollinger|볼린저|거래량)";
const technicalTermPattern = new RegExp(technicalTerms, "i");
const technicalCausalReversal = new RegExp(
  `${technicalTerms}[^.!?\\n]{0,40}(?:때문에|근거로|따라)[^.!?\\n]{0,40}(?:판단|판정|결론|방향)[^.!?\\n]{0,24}(?:바뀌|뒤집|결정|확정)|` +
  `(?:판단|판정|결론|방향)[^.!?\\n]{0,30}(?:바뀌|뒤집|결정|확정)[^.!?\\n]{0,40}${technicalTerms}`,
  "i"
);
const explicitUpsideDecision = /(?:현재|최종|종합)\s*(?:판단|판정|결론|방향)(?:은|이|:)?[^.!?\n]{0,16}(?:상승|롱)\s*(?:우세|관찰|쪽|입니다|이다)|(?:현재는|지금은)[^.!?\n]{0,24}(?:상승|롱)\s*(?:쪽\s*)?(?:힘|압력)[^.!?\n]{0,12}(?:더\s*)?강/;
const explicitDownsideDecision = /(?:현재|최종|종합)\s*(?:판단|판정|결론|방향)(?:은|이|:)?[^.!?\n]{0,16}(?:하락|숏)\s*(?:우세|관찰|쪽|입니다|이다)|(?:현재는|지금은)[^.!?\n]{0,24}(?:하락|숏)\s*(?:쪽\s*)?(?:힘|압력)[^.!?\n]{0,12}(?:더\s*)?강/;
const upsideSubject = /(?:상승|상방|위쪽|오름|오르|오를|반등|강세|롱|매수\s*(?:세|압력|쪽|우위))/i;
const downsideSubject = /(?:하락|하방|아래쪽|내림|내리|내릴|약세|숏|매도\s*(?:세|압력|쪽|우위))/i;
const directionalAssertion = /(?:우세|우위|유리|관찰|유력|예상|전망|신호|무게(?:를|가)?\s*(?:두|둡|둬)|더\s*낫|(?:근거|힘|압력)(?:이|가|은|는)?\s*(?:더\s*)?(?:많|크|커|큽|강)|(?:가능성|확률)(?:이|은|도)?\s*(?:더\s*)?(?:높|크|커|큰|큽)|(?:기울|쏠)(?:어|었|린|림))/;
const operationalScope = /(?:현재|지금|최종|결론|종합|전체|전반|관점|시장)/;
const timeframeScope = /(?:1분|5분|15분|1시간|4시간|1일)(?:봉)?/;
const flowScope = /흐름/;
const directionalCopula = /(?:입니다|이다|이에요|예요)/;
const directionalInference = /(?:(?:쪽)?(?:으로|로)?\s*(?:봅|보입니다|판단|해석))/;
const tradeIntent = /(?:매수|매도|롱|숏|진입|청산|손절|익절)/i;
const actionRecommendation = /(?:하세요|십시오|해야|해라|가세요|보세요|잡으|여세요|열어|타세요|들어가|취하세요|권장(?:합니다|해요|드립니다)?|권합니다|권해요|추천(?:합니다|해요|드립니다)?|고려(?:하세요|하십시오|해야)|(?:편|게|것)(?:이|은|가)?\s*(?:좋|유리|낫)|괜찮(?:습니다|아요)|적합(?:합니다|해요)|필요(?:합니다|해요)|가능(?:합니다|해요|하다)|해도\s*(?:됩니다|돼요|괜찮)|해\s*보세요)/;
const colloquialTradeInstruction = /(?:사세요|파세요|사야\s*(?:합니다|해요)|팔아야\s*(?:합니다|해요)|(?:사는|파는)\s*(?:편|게|것)(?:이|은|가)?\s*(?:좋|유리|낫))/;

function sentences(text: string) {
  return text.split(/[.!?\n]+/).map((sentence) => sentence.trim()).filter(Boolean);
}

function isDirectionalAssertionSentence(sentence: string, subject: RegExp) {
  if (!subject.test(sentence)) return false;
  if (directionalAssertion.test(sentence) || directionalInference.test(sentence)) return true;
  const scopedConclusion = operationalScope.test(sentence) || (flowScope.test(sentence) && !timeframeScope.test(sentence));
  return scopedConclusion && directionalCopula.test(sentence);
}

function hasDirectionalAssertion(text: string, subject: RegExp) {
  return sentences(text).some((sentence) => isDirectionalAssertionSentence(sentence, subject));
}

function technicalCreatesDirection(text: string) {
  return sentences(text).some((sentence) => (
    technicalTermPattern.test(sentence) &&
    (
      isDirectionalAssertionSentence(sentence, upsideSubject) ||
      isDirectionalAssertionSentence(sentence, downsideSubject) ||
      ((upsideSubject.test(sentence) || downsideSubject.test(sentence)) && directionalCopula.test(sentence))
    )
  ));
}

function hasTradeInstruction(text: string) {
  return sentences(text).some((sentence) => (
    colloquialTradeInstruction.test(sentence) || (tradeIntent.test(sentence) && actionRecommendation.test(sentence))
  ));
}

export function isPerpetualBriefingOutputSafe(snapshot: PerpetualDecisionSnapshot, text: string) {
  const normalized = text.replace(/[ \t]+/g, " ").trim();
  if (
    !normalized ||
    hasTradeInstruction(normalized) ||
    technicalCausalReversal.test(normalized) ||
    technicalCreatesDirection(normalized)
  ) return false;

  const saysUpside = explicitUpsideDecision.test(normalized) || hasDirectionalAssertion(normalized, upsideSubject);
  const saysDownside = explicitDownsideDecision.test(normalized) || hasDirectionalAssertion(normalized, downsideSubject);
  if (snapshot.summary.state === "upside_watch" && saysDownside) return false;
  if (snapshot.summary.state === "downside_watch" && saysUpside) return false;
  if ((snapshot.summary.state === "neutral" || snapshot.summary.state === "risk") && (saysUpside || saysDownside)) return false;
  return true;
}
