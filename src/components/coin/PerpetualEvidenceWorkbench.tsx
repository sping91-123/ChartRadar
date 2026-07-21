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

function StructureCard({ kind, direction }: { kind: "msb" | "choch"; direction: DirectionState }) {
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
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      <article className="bg-ui-inset/50 px-3 py-3"><p className="text-xs font-black text-ui-text">{beginnerTerm("ob")}</p><p className="mt-1 text-xs leading-5 text-ui-muted">{ob ? `${formatPrice(ob.bottom)}~${formatPrice(ob.top)}${ob.isInside ? " · 현재 이 구간 안" : ""}` : "최근 뚜렷한 구간 없음"}</p></article>
      <article className="bg-ui-inset/50 px-3 py-3"><p className="text-xs font-black text-ui-text">{beginnerTerm("fvg")}</p><p className="mt-1 text-xs leading-5 text-ui-muted">{fvg ? `${formatPrice(fvg.bottom)}~${formatPrice(fvg.top)} · ${fvg.state === "ifvg" ? "방향이 바뀐 구간" : "재확인 가능 구간"}` : "최근 뚜렷한 구간 없음"}</p></article>
      <article className="bg-ui-inset/50 px-3 py-3"><p className="text-xs font-black text-ui-text">{beginnerTerm("sweep")}</p><p className="mt-1 text-xs leading-5 text-ui-muted">{details.events.sweep ? `${plainDirection(details.events.sweep.direction)} · ${eventDetail(details.events.sweep)}` : "최근 뚜렷한 흔들기 없음"}</p></article>
      <article className="bg-ui-inset/50 px-3 py-3"><p className="text-xs font-black text-ui-text">{beginnerTerm("cisd")}</p><p className="mt-1 text-xs leading-5 text-ui-muted">{details.events.cisd ? `${plainDirection(details.events.cisd.direction)} · ${eventDetail(details.events.cisd)}` : "최근 뚜렷한 변화 없음"}</p></article>
      <article className="bg-ui-inset/50 px-3 py-3"><p className="text-xs font-black text-ui-text">{beginnerTerm("poc")}</p><p className="mt-1 text-xs leading-5 text-ui-muted">{poc ? `${formatPrice(poc.poc)} · 현재가는 ${poc.position === "above" ? "위" : poc.position === "below" ? "아래" : "근처"}` : "거래 집중 가격 확인 중"}</p></article>
      <article className="bg-ui-inset/50 px-3 py-3"><p className="text-xs font-black text-ui-text">{beginnerTerm("pd")}</p><p className="mt-1 text-xs leading-5 text-ui-muted">{pd === "premium" ? "최근 범위의 위쪽" : pd === "discount" ? "최근 범위의 아래쪽" : pd === "equilibrium" ? "최근 범위의 가운데" : "현재 위치 확인 중"}</p></article>
    </div>
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
          <StructureCard kind="msb" direction={structure} />
          <StructureCard kind="choch" direction={transition} />
        </div>
        {!publicEvidence && !primary ? <p className="mt-3 text-xs leading-5 text-ui-watch">이전 분석이라 기본 구조 카드가 없습니다. 다음 자동 갱신부터 표시됩니다.</p> : null}
      </section>

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
      ) : (
        <section className="flex flex-col gap-3 bg-ui-panel px-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-ui-brand">Coin Pro</p>
            <h2 className="mt-1 text-base font-black text-ui-text">더 깊게 확인하고, 중요한 가격은 앱이 대신 지켜봅니다</h2>
            <ul className="mt-2 grid gap-1 text-xs leading-5 text-ui-muted sm:grid-cols-2">
              <li>· 1시간·4시간 흐름과 정확한 신호 발생 가격</li>
              <li>· 고급 가격 구간, 상세 포지션·큰 체결 수치</li>
              <li>· 같은 분석을 초보자 말로 풀어주는 AI 설명</li>
              <li>· 전체 확인 가격 감시·알림과 당시 판단 기록</li>
            </ul>
          </div>
          <ActionButton href="/pro?market=crypto&source=perpetual-evidence" tone="primary" className="w-full sm:w-auto">Pro 기능 모두 보기</ActionButton>
        </section>
      )}

      {pro ? <PerpetualSnapshotBriefing key={snapshot.id} snapshotId={snapshot.id} hasPro enabled={pro.detailVersion === 1} /> : null}
    </div>
  );
}
