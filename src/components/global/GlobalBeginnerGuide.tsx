import { BeginnerActionGuide, type BeginnerGuideStep, type BeginnerGuideTone } from "@/components/BeginnerActionGuide";
import { directionTone, getGlobalSessionState, groupChecklist } from "@/components/global/stockRadarDisplay";
import type { DirectionState } from "@/lib/marketAnalysis";
import type { StockSymbolInfo } from "@/lib/stockMarket";
import type { TechnicalRadarReport } from "@/lib/technicalRadar";

function beginnerToneFromTechnical(tone: DirectionState): BeginnerGuideTone {
  if (tone === "bullish") return "success";
  if (tone === "bearish") return "danger";
  if (tone === "neutral") return "warning";
  return "neutral";
}

function buildGlobalBeginnerSteps(
  report: TechnicalRadarReport | null,
  selectedInfo: StockSymbolInfo | null,
  sessionState: ReturnType<typeof getGlobalSessionState> | null
): BeginnerGuideStep[] {
  const tone = directionTone(report);
  const checklist = groupChecklist(selectedInfo?.group);
  const selectedLabel = selectedInfo ? `${selectedInfo.symbol} ${selectedInfo.name}` : "선택 자산";
  const supportDistance = report?.supportResistance.supportDistancePercent ?? null;
  const resistanceDistance = report?.supportResistance.resistanceDistancePercent ?? null;
  const distanceMemo =
    resistanceDistance !== null && resistanceDistance <= 1.2
      ? "저항선이 가까우면 돌파 후 안착 여부를 먼저 봅니다."
      : supportDistance !== null && supportDistance <= 1.2
        ? "지지선이 가까우면 반등과 거래량 회복이 같이 나오는지 확인합니다."
        : "지지와 저항 사이 중간 구간이면 기준선까지 기다리는 편이 더 명확합니다.";

  return [
    {
      label: "1. 시장 시간",
      title: sessionState?.title ?? "미국장 시간 확인",
      body: sessionState?.detail ?? "현재 한국 시간 기준 미국장 구간을 확인하고 있습니다.",
      tone: "info"
    },
    {
      label: "2. 방향 압축",
      title: tone === "bullish" ? "상승 우위 유지 확인" : tone === "bearish" ? "하락 압력 방어 확인" : "방향 확정 대기",
      body: report?.summary ?? `${selectedLabel} 캔들이 충분히 쌓이면 추세, 모멘텀, 변동성을 요약합니다.`,
      tone: beginnerToneFromTechnical(tone)
    },
    {
      label: "3. 실행 전 차단",
      title: "지수, 섹터, 종목 순서",
      body: `${checklist.action} ${distanceMemo}`,
      tone: "warning"
    }
  ];
}

export function GlobalBeginnerGuide({
  report,
  selectedInfo,
  sessionState
}: {
  report: TechnicalRadarReport | null;
  selectedInfo: StockSymbolInfo | null;
  sessionState: ReturnType<typeof getGlobalSessionState> | null;
}) {
  return (
    <div className="mt-5">
      <BeginnerActionGuide
        eyebrow="글로벌 초보자용"
        title="글로벌은 이 순서로 좁혀가면 됩니다"
        summary="해외 종목은 단독 차트보다 시장 시간, 지수 방향, 섹터 흐름을 같이 봐야 판단이 단순해집니다. 아래 3단계를 먼저 보고 세부 지표로 내려가세요."
        steps={buildGlobalBeginnerSteps(report, selectedInfo, sessionState)}
        checklist={[
          "지수와 선택 종목 방향이 같은지 확인",
          "가까운 지지·저항까지 남은 폭 확인",
          "지표 발표나 개장 직후 급변 구간인지 확인"
        ]}
        help="글로벌 레이더는 미국장 시간대, 기술지표 방향, 선택 자산의 그룹 특성을 합쳐 확인 순서를 정리합니다. 종목만 강하고 지수나 섹터가 약하면 판단 신뢰도가 낮아집니다."
      />
    </div>
  );
}
