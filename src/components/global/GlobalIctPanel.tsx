import { directionClass, directionLabel, formatAgeByTimeframe, formatIndexAge, formatPrice, formatZonePrice } from "@/components/global/stockRadarDisplay";
import type { ChartTimeframe, DirectionState, TimeframeAnalysis } from "@/lib/marketAnalysis";

function ictDirectionLabel(direction: "bullish" | "bearish") {
  return direction === "bullish" ? "상승" : "하락";
}

function premiumDiscountLabel(value: TimeframeAnalysis["premiumDiscount"]) {
  if (value === "premium") return "프리미엄";
  if (value === "discount") return "디스카운트";
  if (value === "equilibrium") return "균형가";
  return "미확인";
}

function oteZoneLabel(value: TimeframeAnalysis["oteZone"]) {
  if (value === "long") return "롱 OTE";
  if (value === "short") return "숏 OTE";
  return "OTE 밖";
}

function pocPositionLabel(value: TimeframeAnalysis["volumeProfile"]) {
  if (!value) return "POC 미확인";
  if (value.position === "above") return "POC 위";
  if (value.position === "below") return "POC 아래";
  return "POC 근처";
}

function IctStatusCard({
  title,
  value,
  detail
}: {
  title: string;
  value: string;
  detail: string;
  tone?: DirectionState;
}) {
  return (
    <article className="rounded-ui-sm bg-ui-inset/25 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ui-subtle">{title}</p>
      <h4 className="mt-2 text-base font-semibold text-ui-text">{value}</h4>
      <p className="mt-2 text-xs leading-5 text-ui-muted">{detail}</p>
    </article>
  );
}

export function GlobalIctPanel({ analysis, timeframe, candlesLength }: { analysis: TimeframeAnalysis; timeframe: ChartTimeframe; candlesLength: number }) {
  const scoreTone: DirectionState = analysis.score >= 1.2 ? "bullish" : analysis.score <= -1.2 ? "bearish" : "neutral";
  const scoreLabel = analysis.score >= 1.2 ? "상승 구조 우세" : analysis.score <= -1.2 ? "하락 구조 우세" : "구조 관찰";
  const latestOb = analysis.latestOb;
  const latestFvg = analysis.latestFvg;
  const latestSweep = analysis.latestSweep;
  const latestCisd = analysis.latestCisd;
  const latestDisplacement = analysis.latestDisplacement;

  return (
    <section className="rounded-ui-lg border border-ui-line/25 bg-ui-panel/35 p-3 sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ui-brand">ICT Radar</p>
          <h3 className="mt-1 text-xl font-semibold text-ui-text">{timeframe} 구조 판독</h3>
        </div>
        <span className={`inline-flex min-h-8 items-center text-xs font-semibold ${directionClass(scoreTone).replace(/bg-[^ ]+/g, "").replace(/border-[^ ]+/g, "")}`}>
          {scoreLabel} · {analysis.score > 0 ? "+" : ""}
          {analysis.score.toFixed(2)}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <IctStatusCard
          title="MSB"
          value={directionLabel(analysis.msb)}
          detail={
            analysis.latestMsbEvent
              ? `${formatPrice(analysis.latestMsbEvent.level)} 기준 · ${formatIndexAge(analysis.latestMsbEvent.index, candlesLength, timeframe)}`
              : "현재 구조 방향을 기준으로 표시합니다."
          }
          tone={analysis.msb}
        />
        <IctStatusCard
          title="CHoCH"
          value={directionLabel(analysis.choch)}
          detail={
            analysis.latestChochEvent
              ? `${formatPrice(analysis.latestChochEvent.level)} 기준 · ${formatIndexAge(analysis.latestChochEvent.index, candlesLength, timeframe)}`
              : "최근 단기 구조 전환을 기준으로 표시합니다."
          }
          tone={analysis.choch}
        />
        <IctStatusCard
          title="OB"
          value={latestOb ? `${ictDirectionLabel(latestOb.direction)} OB ${analysis.inOb ? "내부" : "외부"}` : "최근 OB 미확인"}
          detail={latestOb ? `${formatZonePrice(latestOb.bottom, latestOb.top)} · ${formatAgeByTimeframe(latestOb.age, timeframe)}` : "유효한 오더블록이 아직 선명하지 않습니다."}
          tone={latestOb?.direction ?? "neutral"}
        />
        <IctStatusCard
          title="FVG"
          value={latestFvg ? `${ictDirectionLabel(latestFvg.direction)} ${latestFvg.state === "ifvg" ? "iFVG" : "FVG"} ${analysis.inFvg ? "내부" : "외부"}` : "최근 FVG 미확인"}
          detail={latestFvg ? `${formatZonePrice(latestFvg.bottom, latestFvg.top)} · ${formatAgeByTimeframe(latestFvg.age, timeframe)}` : "강한 가격 불균형 구간이 아직 선명하지 않습니다."}
          tone={latestFvg?.direction ?? "neutral"}
        />
        <IctStatusCard
          title="Sweep"
          value={latestSweep ? `${latestSweep.direction === "bullish" ? "저점 스윕" : "고점 스윕"}` : "스윕 미확인"}
          detail={latestSweep ? `${formatPrice(latestSweep.level)} · ${formatAgeByTimeframe(latestSweep.age, timeframe)}` : "최근 유동성 스윕이 뚜렷하지 않습니다."}
          tone={latestSweep?.direction ?? "neutral"}
        />
        <IctStatusCard
          title="CISD"
          value={latestCisd ? `${ictDirectionLabel(latestCisd.direction)} CISD` : "CISD 미확인"}
          detail={latestCisd ? `${formatPrice(latestCisd.level)} · ${formatAgeByTimeframe(latestCisd.age, timeframe)}` : "OB 반응 이후 상태 변화가 아직 확인되지 않았습니다."}
          tone={latestCisd?.direction ?? "neutral"}
        />
        <IctStatusCard
          title="PD / OTE"
          value={`${premiumDiscountLabel(analysis.premiumDiscount)} · ${oteZoneLabel(analysis.oteZone)}`}
          detail={
            analysis.oteLevels
              ? `롱 ${formatZonePrice(analysis.oteLevels.longLow, analysis.oteLevels.longHigh)} · 숏 ${formatZonePrice(analysis.oteLevels.shortLow, analysis.oteLevels.shortHigh)}`
              : "최근 딜링레인지 기준을 확인 중입니다."
          }
          tone={analysis.oteZone === "long" ? "bullish" : analysis.oteZone === "short" ? "bearish" : "neutral"}
        />
        <IctStatusCard
          title="POC / EMA"
          value={`${pocPositionLabel(analysis.volumeProfile)} · EMA200 ${analysis.ema200Side === "above" ? "위" : analysis.ema200Side === "below" ? "아래" : "미확인"}`}
          detail={`POC ${analysis.volumeProfile ? formatPrice(analysis.volumeProfile.poc) : "미확인"} · EMA200 ${formatPrice(analysis.ema200Value)}`}
          tone={analysis.ema200Side === "above" ? "bullish" : analysis.ema200Side === "below" ? "bearish" : "neutral"}
        />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <IctStatusCard
          title="Displacement"
          value={latestDisplacement ? `${ictDirectionLabel(latestDisplacement.direction)} 변위` : "변위 미확인"}
          detail={latestDisplacement ? `강도 ${latestDisplacement.strength}점 · ${formatAgeByTimeframe(latestDisplacement.age, timeframe)}` : "강한 몸통 변위 캔들이 최근 구간에 뚜렷하지 않습니다."}
          tone={latestDisplacement?.direction ?? "neutral"}
        />
        <IctStatusCard
          title="Buy-side"
          value={analysis.buySideLiquidity ? formatPrice(analysis.buySideLiquidity.level) : "미확인"}
          detail={analysis.buySideLiquidity ? `${formatAgeByTimeframe(analysis.buySideLiquidity.age, timeframe)} · 거리 ${analysis.buySideLiquidity.distancePercent.toFixed(2)}%` : "가까운 매수 유동성 풀을 찾지 못했습니다."}
          tone="neutral"
        />
        <IctStatusCard
          title="Sell-side"
          value={analysis.sellSideLiquidity ? formatPrice(analysis.sellSideLiquidity.level) : "미확인"}
          detail={analysis.sellSideLiquidity ? `${formatAgeByTimeframe(analysis.sellSideLiquidity.age, timeframe)} · 거리 ${analysis.sellSideLiquidity.distancePercent.toFixed(2)}%` : "가까운 매도 유동성 풀을 찾지 못했습니다."}
          tone="neutral"
        />
      </div>
    </section>
  );
}
