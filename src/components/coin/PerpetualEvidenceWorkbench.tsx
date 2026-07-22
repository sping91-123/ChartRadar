"use client";

import { ArrowDown, ArrowUp, BarChart3, ChevronDown, CircleHelp, Gauge, Layers3, Minus, Waves } from "lucide-react";
import { PerpetualSnapshotBriefing } from "@/components/coin/PerpetualSnapshotBriefing";
import { ActionButton, StatusPill } from "@/components/ui/DesignPrimitives";
import {
  beginnerTerm,
  flowDirectionLabel,
  plainDirection,
  pressureDirectionLabel,
  regimeLabel,
  structureExplanation,
  transitionExplanation
} from "@/lib/perpetualDecisionCopy";
import type { DirectionState } from "@/lib/marketAnalysis";
import type { PerpetualDecisionEvidence, PerpetualDecisionSnapshot, PerpetualTimedLevel } from "@/lib/perpetualDecisionSnapshot";

function tone(direction: DirectionState) {
  if (direction === "bullish") return "long" as const;
  if (direction === "bearish") return "short" as const;
  return "watch" as const;
}

function directionIcon(direction: DirectionState) {
  if (direction === "bullish") return ArrowUp;
  if (direction === "bearish") return ArrowDown;
  if (direction === "neutral") return Minus;
  return CircleHelp;
}

function formatPrice(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "가격 확인 중";
  return value.toLocaleString("ko-KR", { maximumFractionDigits: value >= 10_000 ? 0 : 2 });
}

function formatUsd(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "확인 중";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function formatPercent(value: number | null | undefined, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "확인 중";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function formatRatio(longPercent: number | null | undefined, shortPercent: number | null | undefined) {
  if (typeof longPercent !== "number" || typeof shortPercent !== "number") return "확인 중";
  return `롱 ${longPercent.toFixed(1)}% · 숏 ${shortPercent.toFixed(1)}%`;
}

function formatKstTime(value: string | number | null | undefined) {
  const date = typeof value === "number" ? new Date(value) : value ? new Date(value) : null;
  if (!date || !Number.isFinite(date.getTime())) return "확인 중";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function flowImbalanceLabel(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "확인 중";
  if (Math.abs(value) < 0.05) return "큰 매수·매도 비슷함";
  return `큰 ${value > 0 ? "매수" : "매도"} ${Math.abs(value).toFixed(2)}% 우세`;
}

function eventDetail(event: PerpetualTimedLevel | null | undefined) {
  if (!event) return "최근 뚜렷한 신호 없음";
  const age = event.ageBars === null ? "시점 확인 중" : event.ageBars === 0 ? "방금 끝난 봉" : `${event.ageBars}개 봉 전`;
  const occurred = event.occurredAt && Number.isFinite(Date.parse(event.occurredAt))
    ? new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).format(new Date(event.occurredAt))
    : "시각 확인 중";
  return `${formatPrice(event.level)} · ${occurred} · ${age}`;
}

function StructureCard({ kind, direction, event }: { kind: "msb" | "choch"; direction: DirectionState; event?: PerpetualTimedLevel | null }) {
  const explanation = kind === "msb" ? structureExplanation(direction) : transitionExplanation(direction);
  return (
    <article className="bg-ui-inset/55 px-3 py-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-black text-ui-text">{beginnerTerm(kind)}</p>
          <p className="mt-1 text-[10.5px] leading-4 text-ui-subtle">{kind === "msb" ? "중요한 고점·저점을 넘었는지 봅니다." : "기존 흐름이 바뀌기 시작했는지 봅니다."}</p>
        </div>
        <StatusPill tone={tone(direction)} icon={directionIcon(direction)}>{plainDirection(direction)}</StatusPill>
      </div>
      <p className="mt-2 text-xs font-semibold leading-5 text-ui-muted [word-break:keep-all]">{explanation}</p>
      <p className="mt-2 border-t border-ui-line pt-2 text-[11px] font-semibold leading-5 text-ui-muted">
        {kind === "msb" ? "최근 추세 확인" : "최근 전환 신호"} · {eventDetail(event)}
      </p>
    </article>
  );
}

function TimeframeCard({ evidence }: { evidence: PerpetualDecisionEvidence }) {
  return (
    <article className="bg-ui-inset/50 px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-black text-ui-text">{evidence.label}</p>
        <StatusPill tone={tone(evidence.structure)}>{regimeLabel(evidence.regime)}</StatusPill>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div><dt className="text-ui-subtle">추세 방향</dt><dd className="mt-1 font-black text-ui-text">{plainDirection(evidence.structure)}</dd></div>
        <div><dt className="text-ui-subtle">전환 가능성</dt><dd className="mt-1 font-black text-ui-text">{plainDirection(evidence.transition)}</dd></div>
      </dl>
      <div className="mt-3 space-y-1 border-t border-ui-line pt-2 text-[11px] leading-5 text-ui-muted">
        <p>최근 추세 확인: {eventDetail(evidence.details?.events.msb)}</p>
        <p>최근 전환 신호: {eventDetail(evidence.details?.events.choch)}</p>
      </div>
    </article>
  );
}

function IctDetails({ evidence }: { evidence?: PerpetualDecisionEvidence }) {
  const details = evidence?.details;
  if (!details) return <p className="text-xs leading-5 text-ui-muted">이전 분석에는 상세 구조가 저장되지 않았습니다. 다음 갱신부터 표시됩니다.</p>;
  const ob = details.zones.orderBlock;
  const fvg = details.zones.fvg;
  const poc = details.location.poc;
  const pd = details.location.premiumDiscount;
  const range = details.location.dealingRange;
  const ote = details.location.oteLevels;
  const indicators = details.indicators;
  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <article className="bg-ui-inset/50 px-3 py-3"><p className="text-xs font-black text-ui-text">{beginnerTerm("ob")}</p><p className="mt-1 text-xs leading-5 text-ui-muted">{ob ? `${formatPrice(ob.bottom)}~${formatPrice(ob.top)}${ob.isInside ? " · 현재 이 구간 안" : ""}` : "최근 뚜렷한 구간 없음"}</p></article>
        <article className="bg-ui-inset/50 px-3 py-3"><p className="text-xs font-black text-ui-text">{beginnerTerm("fvg")}</p><p className="mt-1 text-xs leading-5 text-ui-muted">{fvg ? `${formatPrice(fvg.bottom)}~${formatPrice(fvg.top)} · ${fvg.state === "ifvg" ? "방향이 바뀐 구간" : "재확인 가능 구간"}` : "최근 뚜렷한 구간 없음"}</p></article>
        <article className="bg-ui-inset/50 px-3 py-3"><p className="text-xs font-black text-ui-text">{beginnerTerm("sweep")}</p><p className="mt-1 text-xs leading-5 text-ui-muted">{details.events.sweep ? `${plainDirection(details.events.sweep.direction)} · ${eventDetail(details.events.sweep)}` : "최근 뚜렷한 흔들기 없음"}</p></article>
        <article className="bg-ui-inset/50 px-3 py-3"><p className="text-xs font-black text-ui-text">{beginnerTerm("cisd")}</p><p className="mt-1 text-xs leading-5 text-ui-muted">{details.events.cisd ? `${plainDirection(details.events.cisd.direction)} · ${eventDetail(details.events.cisd)}` : "최근 뚜렷한 변화 없음"}</p></article>
        <article className="bg-ui-inset/50 px-3 py-3"><p className="text-xs font-black text-ui-text">{beginnerTerm("poc")}</p><p className="mt-1 text-xs leading-5 text-ui-muted">{poc ? `${formatPrice(poc.poc)} · 현재가는 ${poc.position === "above" ? "위" : poc.position === "below" ? "아래" : "근처"}` : "거래 집중 가격 확인 중"}</p></article>
        <article className="bg-ui-inset/50 px-3 py-3"><p className="text-xs font-black text-ui-text">{beginnerTerm("pd")}</p><p className="mt-1 text-xs leading-5 text-ui-muted">{pd === "premium" ? "최근 범위의 위쪽" : pd === "discount" ? "최근 범위의 아래쪽" : pd === "equilibrium" ? "최근 범위의 가운데" : "현재 위치 확인 중"}</p></article>
        <article className="bg-ui-inset/50 px-3 py-3"><p className="text-xs font-black text-ui-text">최근 가격 범위</p><p className="mt-1 text-xs leading-5 text-ui-muted">{range.low !== null && range.high !== null ? `${formatPrice(range.low)}~${formatPrice(range.high)} · 가운데 ${formatPrice(range.equilibrium)}` : "가격 범위 확인 중"}</p></article>
        <article className="bg-ui-inset/50 px-3 py-3"><p className="text-xs font-black text-ui-text">되돌림 확인 구간(OTE)</p><p className="mt-1 text-xs leading-5 text-ui-muted">{ote ? details.location.oteZone === "long" ? `${formatPrice(ote.longLow)}~${formatPrice(ote.longHigh)} · 상방 확인 구간` : details.location.oteZone === "short" ? `${formatPrice(ote.shortLow)}~${formatPrice(ote.shortHigh)} · 하방 확인 구간` : "현재가는 주요 되돌림 구간 밖" : "구간 확인 중"}</p></article>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div className="bg-ui-inset/35 px-3 py-2"><p className="text-ui-subtle">매수·매도 과열도(RSI)</p><p className="mt-1 font-black text-ui-text">{typeof indicators.rsi14 === "number" ? indicators.rsi14.toFixed(1) : "확인 중"}</p></div>
        <div className="bg-ui-inset/35 px-3 py-2"><p className="text-ui-subtle">추세 속도(MACD)</p><p className="mt-1 font-black text-ui-text">{indicators.macdState === "rising" ? "상승" : indicators.macdState === "falling" ? "하락" : indicators.macdState === "neutral" ? "중립" : "확인 중"}</p></div>
        <div className="bg-ui-inset/35 px-3 py-2"><p className="text-ui-subtle">평균 변동 폭(ATR)</p><p className="mt-1 font-black text-ui-text">{formatPercent(indicators.atrPercent)}</p></div>
        <div className="bg-ui-inset/35 px-3 py-2"><p className="text-ui-subtle">거래량</p><p className="mt-1 font-black text-ui-text">{typeof indicators.volumeRatio === "number" ? `평균의 ${indicators.volumeRatio.toFixed(2)}배` : "확인 중"}</p></div>
      </div>
    </div>
  );
}

function BasicProValueCard({ snapshot }: { snapshot: PerpetualDecisionSnapshot }) {
  const returnTo = `/crypto/perpetual?asset=${snapshot.asset}&timeframe=15m&snapshot=${encodeURIComponent(snapshot.id)}`;
  const upgradeHref = `/pro?market=crypto&source=perpetual-evidence&returnTo=${encodeURIComponent(returnTo)}`;
  return (
    <section className="flex flex-col gap-3 border-l-2 border-ui-brand bg-ui-panel px-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-ui-brand">Coin Pro에서 이어지는 분석</p>
        <h2 className="mt-1 text-base font-black text-ui-text">수치만 더 보는 게 아니라, 놓치기 쉬운 조건을 앱이 최대 5분 간격으로 확인합니다</h2>
        <ul className="mt-2 grid gap-1 text-xs leading-5 text-ui-muted sm:grid-cols-2">
          <li>· 1시간·4시간 신호가 실제로 나온 가격·시각</li>
          <li>· 고급 가격 구간과 상세 포지션·큰 체결 수치</li>
          <li>· 같은 분석을 초보자 말로 풀어주는 AI 설명</li>
          <li>· 무료 1개 · Coin Pro 최대 20개 조건 감시·알림</li>
        </ul>
      </div>
      <ActionButton href={upgradeHref} tone="primary" className="w-full sm:w-auto">Pro 기능 모두 보기</ActionButton>
    </section>
  );
}

export function PerpetualEvidenceWorkbench({ snapshot }: { snapshot: PerpetualDecisionSnapshot }) {
  const publicEvidence = snapshot.publicEvidence;
  const pro = snapshot.pro;
  const primary = pro?.multiTimeframeEvidence.find((item) => item.timeframe === "15m");
  const structure = publicEvidence?.structure ?? primary?.structure ?? "unknown";
  const transition = publicEvidence?.transition ?? primary?.transition ?? "unknown";
  const pressure = publicEvidence?.pressure ?? pro?.pressure ?? null;
  const flow = publicEvidence?.flow ?? pro?.flow ?? null;
  const context = publicEvidence?.context ?? pro?.multiTimeframeEvidence.map((evidence) => ({
    timeframe: evidence.timeframe,
    label: evidence.label,
    structure: evidence.structure,
    transition: evidence.transition,
    regime: evidence.regime
  })) ?? [];

  return (
    <div className="space-y-3">
      <section className="bg-ui-panel px-3 py-4 sm:px-5" aria-labelledby="perpetual-evidence-title">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.12em] text-ui-brand"><CircleHelp size={12} aria-hidden /> 판단 과정</p>
            <h2 id="perpetual-evidence-title" className="mt-1 text-xl font-black text-ui-text">왜 이렇게 보나요?</h2>
            <p className="mt-1 text-xs leading-5 text-ui-muted">결론에 사용한 차트 흐름, 몰린 포지션, 큰 금액 체결을 쉬운 말로 순서대로 보여드립니다.</p>
          </div>
          <StatusPill tone="watch" icon={BarChart3}>15분 기준</StatusPill>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <StructureCard kind="msb" direction={structure} event={publicEvidence?.events?.msb ?? primary?.details?.events.msb} />
          <StructureCard kind="choch" direction={transition} event={publicEvidence?.events?.choch ?? primary?.details?.events.choch} />
        </div>
        {context.length > 0 ? (
          <div className="mt-3 grid grid-cols-3 gap-1.5" aria-label="15분, 1시간, 4시간 흐름 비교">
            {context.map((item) => (
              <article key={item.timeframe} className="min-w-0 bg-ui-inset/45 px-2 py-2.5 text-center">
                <p className="text-[10px] font-black text-ui-subtle">{item.label}</p>
                <p className={`mt-1 text-xs font-black ${item.structure === "bullish" ? "text-ui-long" : item.structure === "bearish" ? "text-ui-short" : "text-ui-text"}`}>{plainDirection(item.structure)}</p>
                <p className="mt-0.5 truncate text-[10px] text-ui-muted">전환 {plainDirection(item.transition)}</p>
              </article>
            ))}
          </div>
        ) : null}
        {!publicEvidence && !primary ? <p className="mt-3 text-xs leading-5 text-ui-watch">이전 분석이라 기본 구조 카드가 없습니다. 다음 자동 갱신부터 표시됩니다.</p> : null}
      </section>

      {pro
        ? <PerpetualSnapshotBriefing key={snapshot.id} snapshotId={snapshot.id} hasPro enabled={pro.detailVersion === 1} />
        : <BasicProValueCard snapshot={snapshot} />}

      <section className="bg-ui-panel px-3 py-4 sm:px-5" aria-labelledby="perpetual-flow-title">
        <div><p className="text-[10px] font-black uppercase tracking-[0.12em] text-ui-subtle">포지션과 체결</p><h2 id="perpetual-flow-title" className="mt-1 text-lg font-black text-ui-text">실제로 어느 쪽에 돈이 몰렸나요?</h2></div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <article className="bg-ui-inset/55 px-3 py-3">
            <p className="inline-flex items-center gap-1 text-xs font-black text-ui-text"><Gauge size={14} className="text-ui-watch" aria-hidden /> 몰린 포지션</p>
            <p className="mt-2 text-sm font-black leading-6 text-ui-text">{pressure ? pressureDirectionLabel(pressure.dominantSide) : "포지션 쏠림 확인 중"}</p>
            <p className="mt-1 text-xs leading-5 text-ui-muted">{pressure?.summary ?? "롱·숏 쏠림과 현재 열려 있는 선물 규모 데이터를 기다리고 있습니다."}</p>
          </article>
          <article className="bg-ui-inset/55 px-3 py-3">
            <p className="inline-flex items-center gap-1 text-xs font-black text-ui-text"><Waves size={14} className="text-ui-brand" aria-hidden /> 큰 금액 체결</p>
            <p className="mt-2 text-sm font-black leading-6 text-ui-text">{flow ? flowDirectionLabel(flow.dominantSide) : "큰 금액 체결 확인 중"}</p>
            <p className="mt-1 text-xs leading-5 text-ui-muted">{flow?.summary ?? "최근 선물 체결 데이터를 기다리고 있습니다."}</p>
          </article>
        </div>

        {pro ? (
          <div className="mt-3 grid gap-2 border-t border-ui-line pt-3 md:grid-cols-2">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-ui-inset/45 px-3 py-2"><p className="text-ui-subtle">숏 강제 청산 위험</p><p className="mt-1 font-black text-ui-text">{pro.pressure ? `${pro.pressure.upsideShortPressure.toFixed(0)}점` : "확인 중"}</p></div>
              <div className="bg-ui-inset/45 px-3 py-2"><p className="text-ui-subtle">롱 강제 청산 위험</p><p className="mt-1 font-black text-ui-text">{pro.pressure ? `${pro.pressure.downsideLongPressure.toFixed(0)}점` : "확인 중"}</p></div>
              <div className="bg-ui-inset/45 px-3 py-2"><p className="text-ui-subtle">열린 선물 규모 변화</p><p className="mt-1 font-black text-ui-text">{formatPercent(pro.pressure?.details?.openInterestChangePercent)}</p></div>
              <div className="bg-ui-inset/45 px-3 py-2"><p className="text-ui-subtle">롱·숏 사이 정산 비용(펀딩비)</p><p className="mt-1 font-black text-ui-text">{formatPercent(pro.pressure?.details?.fundingRatePercent, 4)}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-ui-inset/45 px-3 py-2"><p className="text-ui-subtle">큰 매수 금액</p><p className="mt-1 font-black text-ui-long">{formatUsd(pro.flow?.details?.buyNotionalUsd)}</p></div>
              <div className="bg-ui-inset/45 px-3 py-2"><p className="text-ui-subtle">큰 매도 금액</p><p className="mt-1 font-black text-ui-short">{formatUsd(pro.flow?.details?.sellNotionalUsd)}</p></div>
              <div className="bg-ui-inset/45 px-3 py-2"><p className="text-ui-subtle">큰 체결 어느 쪽 우세?</p><p className="mt-1 font-black text-ui-text">{flowImbalanceLabel(pro.flow?.imbalancePercent)}</p></div>
              <div className="bg-ui-inset/45 px-3 py-2"><p className="text-ui-subtle">큰 체결 건수</p><p className="mt-1 font-black text-ui-text">{pro.flow ? `${pro.flow.largeTradeCount}건` : "확인 중"}</p></div>
            </div>
            <details className="group border-t border-ui-line pt-2 md:col-span-2">
              <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 text-xs font-black text-ui-text marker:hidden [&::-webkit-details-marker]:hidden">
                Pro 상세 포지션·큰 체결 수치 보기
                <ChevronDown size={15} className="transition group-open:rotate-180" aria-hidden />
              </summary>
              <div className="mt-2 grid gap-3 lg:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-black text-ui-text">계정별 롱·숏 비율</p>
                  <dl className="grid gap-1.5 text-[11px] leading-5 text-ui-muted sm:grid-cols-2">
                    <div className="bg-ui-inset/35 px-3 py-2"><dt>전체 계정</dt><dd className="font-black text-ui-text">{formatRatio(pro.pressure?.details?.globalLongShort.longPercent, pro.pressure?.details?.globalLongShort.shortPercent)}</dd></div>
                    <div className="bg-ui-inset/35 px-3 py-2"><dt>상위 계정</dt><dd className="font-black text-ui-text">{formatRatio(pro.pressure?.details?.topAccountLongShort.longPercent, pro.pressure?.details?.topAccountLongShort.shortPercent)}</dd></div>
                    <div className="bg-ui-inset/35 px-3 py-2"><dt>상위 포지션</dt><dd className="font-black text-ui-text">{formatRatio(pro.pressure?.details?.topPositionLongShort.longPercent, pro.pressure?.details?.topPositionLongShort.shortPercent)}</dd></div>
                    <div className="bg-ui-inset/35 px-3 py-2"><dt>시장가 체결</dt><dd className="font-black text-ui-text">{formatRatio(pro.pressure?.details?.takerFlow.buyPercent, pro.pressure?.details?.takerFlow.sellPercent).replace("롱", "매수").replace("숏", "매도")}</dd></div>
                    <div className="bg-ui-inset/35 px-3 py-2"><dt>열린 선물 규모</dt><dd className="font-black text-ui-text">{formatUsd(pro.pressure?.details?.openInterestValue)}</dd></div>
                    <div className="bg-ui-inset/35 px-3 py-2"><dt>다음 펀딩 시각</dt><dd className="font-black text-ui-text">{formatKstTime(pro.pressure?.details?.nextFundingTime)}</dd></div>
                  </dl>
                  {pro.pressure?.details?.bands?.length ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-[11px] text-ui-muted">
                        <thead><tr><th className="py-1 pr-3">레버리지</th><th className="py-1 pr-3">롱 위험 가격</th><th className="py-1">숏 위험 가격</th></tr></thead>
                        <tbody>{pro.pressure.details.bands.map((band) => <tr key={band.leverage} className="border-t border-ui-line"><th className="py-1.5 pr-3 font-black text-ui-text">{band.leverage}배</th><td className="py-1.5 pr-3 tabular-nums">{formatPrice(band.longLiquidationPrice)}</td><td className="py-1.5 tabular-nums">{formatPrice(band.shortLiquidationPrice)}</td></tr>)}</tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-black text-ui-text">큰 체결 상세</p>
                  <dl className="grid grid-cols-2 gap-1.5 text-[11px] leading-5 text-ui-muted">
                    <div className="bg-ui-inset/35 px-3 py-2"><dt>관측 시간</dt><dd className="font-black text-ui-text">{pro.flow?.details?.windowMinutes ? `${pro.flow.details.windowMinutes}분` : "확인 중"}</dd></div>
                    <div className="bg-ui-inset/35 px-3 py-2"><dt>큰 체결 기준</dt><dd className="font-black text-ui-text">{formatUsd(pro.flow?.details?.thresholdUsd)}</dd></div>
                    <div className="bg-ui-inset/35 px-3 py-2"><dt>매수/매도 건수</dt><dd className="font-black text-ui-text">{pro.flow?.details ? `${pro.flow.details.buyCount}/${pro.flow.details.sellCount}건` : "확인 중"}</dd></div>
                    <div className="bg-ui-inset/35 px-3 py-2"><dt>반복 이상 체결</dt><dd className="font-black text-ui-text">{pro.flow?.details ? `${pro.flow.details.anomalyScore}점 · ${pro.flow.details.anomalyLevel === "high" ? "높음" : pro.flow.details.anomalyLevel === "watch" ? "관찰" : "낮음"}` : "확인 중"}</dd></div>
                  </dl>
                  <p className="bg-ui-inset/35 px-3 py-2 text-[11px] font-semibold leading-5 text-ui-muted">가장 큰 체결 · {pro.flow?.details?.trigger ?? "확인 중"}</p>
                  {pro.flow?.details?.topTrades?.length ? (
                    <ul className="space-y-1 text-[11px] leading-5 text-ui-muted">
                      {pro.flow.details.topTrades.slice(0, 3).map((trade) => (
                        <li key={`${trade.timestamp}-${trade.price}-${trade.side}`} className="flex flex-wrap justify-between gap-x-3 bg-ui-inset/35 px-3 py-1.5">
                          <span className={trade.side === "buy" ? "font-black text-ui-long" : "font-black text-ui-short"}>{trade.side === "buy" ? "큰 매수" : "큰 매도"} {formatUsd(trade.notionalUsd)}</span>
                          <span>{formatPrice(trade.price)} · {formatKstTime(trade.timestamp)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            </details>
          </div>
        ) : null}
      </section>

      {pro ? (
        <section className="bg-ui-panel px-3 py-4 sm:px-5" aria-labelledby="perpetual-mtf-title">
          <div><p className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.12em] text-ui-brand"><Layers3 size={12} aria-hidden /> Coin Pro</p><h2 id="perpetual-mtf-title" className="mt-1 text-lg font-black text-ui-text">시간을 넓혀도 같은 방향인가요?</h2><p className="mt-1 text-xs leading-5 text-ui-muted">15분만 보지 않고 1시간·4시간 흐름까지 비교해 짧은 움직임에 속을 가능성을 줄입니다.</p></div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">{pro.multiTimeframeEvidence.map((evidence) => <TimeframeCard key={evidence.timeframe} evidence={evidence} />)}</div>
          <details className="group mt-3 border-t border-ui-line pt-2">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-black text-ui-text marker:hidden [&::-webkit-details-marker]:hidden">고급 가격 구조 상세 보기 <ChevronDown size={16} className="transition group-open:rotate-180" aria-hidden /></summary>
            <div className="mt-2"><IctDetails evidence={primary ?? pro.multiTimeframeEvidence[0]} /></div>
          </details>
        </section>
      ) : null}
    </div>
  );
}
