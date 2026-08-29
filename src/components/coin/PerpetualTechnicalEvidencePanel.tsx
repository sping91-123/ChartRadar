"use client";

import { useState } from "react";
import { Activity, BarChart3, ChevronDown, Gauge, LineChart, Waves } from "lucide-react";
import { CoinProConversionLink } from "@/components/CoinProConversionLink";
import { StatusPill } from "@/components/ui/DesignPrimitives";
import { regimeLabel } from "@/lib/perpetualDecisionCopy";
import { hasCompletePerpetualTechnicalDetails } from "@/lib/perpetualAnalysisPerspective";
import type { MarketCondition } from "@/lib/marketAnalysis";
import type { PerpetualDecisionSnapshot } from "@/lib/perpetualDecisionSnapshot";

type TechnicalTimeframe = "15m" | "1h" | "4h";
type TechnicalValues = Partial<MarketCondition>;

const timeframeOptions: Array<{ id: TechnicalTimeframe; label: string }> = [
  { id: "15m", label: "15분" },
  { id: "1h", label: "1시간" },
  { id: "4h", label: "4시간" }
];

function formatNumber(value: number | null | undefined, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "확인 중";
  return value.toLocaleString("ko-KR", { maximumFractionDigits: digits });
}

function formatPrice(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "확인 중";
  return value.toLocaleString("ko-KR", { maximumFractionDigits: value >= 10_000 ? 0 : 2 });
}

function formatPercent(value: number | null | undefined, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "확인 중";
  return `${value.toFixed(digits)}%`;
}

function formatKstTime(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return "시각 확인 중";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function directionLabel(value: string | null | undefined) {
  if (value === "bullish") return "상승 쪽";
  if (value === "bearish") return "하락 쪽";
  if (value === "rising") return "상승";
  if (value === "falling") return "하락";
  if (value === "flat") return "평탄";
  if (value === "mixed") return "엇갈림";
  if (value === "neutral") return "중립";
  return "확인 중";
}

function macdChangeLabel(value: MarketCondition["macdState"] | undefined) {
  if (value === "rising") return "히스토그램 증가";
  if (value === "falling") return "히스토그램 감소";
  if (value === "neutral") return "히스토그램 변화 작음";
  return "변화 확인 중";
}

function rsiLabel(value: MarketCondition["rsiState"] | undefined) {
  if (value === "overbought") return "과열 구간";
  if (value === "oversold") return "침체 구간";
  if (value === "neutral") return "중립 구간";
  return "상태 확인 중";
}

function volatilityLabel(value: MarketCondition["volatilityState"] | undefined) {
  if (value === "expanded") return "변동 폭 확대";
  if (value === "compressed") return "변동 폭 압축";
  if (value === "normal") return "평균 범위";
  return "상태 확인 중";
}

function volumeLabel(value: MarketCondition["volumeState"] | undefined) {
  if (value === "high") return "평균보다 활발";
  if (value === "low") return "평균보다 적음";
  if (value === "normal") return "평균 수준";
  return "상태 확인 중";
}

function bandPositionLabel(value: string | null | undefined) {
  if (value === "outsideUpper") return "윗선 밖";
  if (value === "outsideLower") return "아랫선 밖";
  if (value === "upper") return "위쪽";
  if (value === "lower") return "아래쪽";
  if (value === "middle") return "가운데";
  return "위치 확인 중";
}

function donchianLabel(value: MarketCondition["donchianPosition"] | undefined) {
  if (value === "breakoutUp") return "상단 돌파";
  if (value === "breakoutDown") return "하단 이탈";
  return bandPositionLabel(value);
}

function SummaryCard({
  title,
  primary,
  detail,
  icon: Icon
}: {
  title: string;
  primary: string;
  detail: string;
  icon: typeof Activity;
}) {
  return (
    <article className="bg-ui-inset/55 px-3 py-3">
      <p className="inline-flex items-center gap-1 text-xs font-black text-ui-text"><Icon size={14} className="text-ui-brand" aria-hidden /> {title}</p>
      <p className="mt-2 text-sm font-black leading-6 text-ui-text">{primary}</p>
      <p className="mt-1 text-[11px] leading-5 text-ui-muted [word-break:keep-all]">{detail}</p>
    </article>
  );
}

function DetailedMetrics({ condition }: { condition: TechnicalValues }) {
  return (
    <details className="group mt-3 border-t border-ui-line pt-2">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-black text-ui-text marker:hidden [&::-webkit-details-marker]:hidden">
        정확한 기술지표 수치 보기
        <ChevronDown size={16} className="transition group-open:rotate-180" aria-hidden />
      </summary>
      <div className="mt-2 grid gap-3 lg:grid-cols-2">
        <section className="bg-ui-inset/35 px-3 py-3" aria-labelledby="technical-trend-detail-title">
          <h3 id="technical-trend-detail-title" className="text-xs font-black text-ui-text">추세·레짐 상세</h3>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-[11px] leading-5 text-ui-muted">
            <div><dt>EMA 20 / 50</dt><dd className="font-black text-ui-text">{formatPrice(condition.ema20)} / {formatPrice(condition.ema50)}</dd></div>
            <div><dt>EMA 200</dt><dd className="font-black text-ui-text">{formatPrice(condition.ema200)}</dd></div>
            <div><dt>EMA 배열 / 기울기</dt><dd className="font-black text-ui-text">{directionLabel(condition.emaStack)} / {directionLabel(condition.emaSlope)}</dd></div>
            <div><dt>ADX</dt><dd className="font-black text-ui-text">{formatNumber(condition.adx14, 1)}</dd></div>
            <div><dt>+DI / -DI</dt><dd className="font-black text-ui-text">{formatNumber(condition.plusDi14, 1)} / {formatNumber(condition.minusDi14, 1)}</dd></div>
            <div><dt>Supertrend</dt><dd className="font-black text-ui-text">{directionLabel(condition.supertrendDirection)} · {formatPrice(condition.supertrendValue)}</dd></div>
            <div><dt>Donchian 상단 / 하단</dt><dd className="font-black text-ui-text">{formatPrice(condition.donchianHigh)} / {formatPrice(condition.donchianLow)}</dd></div>
            <div><dt>Donchian 위치</dt><dd className="font-black text-ui-text">{donchianLabel(condition.donchianPosition)}</dd></div>
          </dl>
        </section>

        <section className="bg-ui-inset/35 px-3 py-3" aria-labelledby="technical-momentum-detail-title">
          <h3 id="technical-momentum-detail-title" className="text-xs font-black text-ui-text">모멘텀·참여 상세</h3>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-[11px] leading-5 text-ui-muted">
            <div><dt>RSI 14</dt><dd className="font-black text-ui-text">{formatNumber(condition.rsi14, 1)} · {rsiLabel(condition.rsiState)}</dd></div>
            <div><dt>MACD 변화</dt><dd className="font-black text-ui-text">{macdChangeLabel(condition.macdState)}</dd></div>
            <div><dt>MACD / Signal</dt><dd className="font-black text-ui-text">{formatNumber(condition.macdLine)} / {formatNumber(condition.macdSignal)}</dd></div>
            <div><dt>MACD Histogram</dt><dd className="font-black text-ui-text">{formatNumber(condition.macdHistogram)}</dd></div>
            <div><dt>거래량 비율</dt><dd className="font-black text-ui-text">{typeof condition.volumeRatio === "number" ? `평균의 ${condition.volumeRatio.toFixed(2)}배` : "확인 중"}</dd></div>
            <div><dt>거래량 상태</dt><dd className="font-black text-ui-text">{volumeLabel(condition.volumeState)}</dd></div>
          </dl>
        </section>

        <section className="bg-ui-inset/35 px-3 py-3 lg:col-span-2" aria-labelledby="technical-volatility-detail-title">
          <h3 id="technical-volatility-detail-title" className="text-xs font-black text-ui-text">변동성·밴드 상세</h3>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-[11px] leading-5 text-ui-muted sm:grid-cols-4">
            <div><dt>ATR 14 / 비율</dt><dd className="font-black text-ui-text">{formatNumber(condition.atr14)} / {formatPercent(condition.atrPercent)}</dd></div>
            <div><dt>Bollinger 하단 / 중단 / 상단</dt><dd className="font-black text-ui-text">{formatPrice(condition.bollingerLower)} / {formatPrice(condition.bollingerMiddle)} / {formatPrice(condition.bollingerUpper)}</dd></div>
            <div><dt>Bollinger 위치 / 폭 백분위</dt><dd className="font-black text-ui-text">{bandPositionLabel(condition.bollingerPosition)} / {formatPercent(condition.bollingerWidthPercentile, 1)}</dd></div>
            <div><dt>Keltner 하단 / 중단 / 상단</dt><dd className="font-black text-ui-text">{formatPrice(condition.keltnerLower)} / {formatPrice(condition.keltnerMiddle)} / {formatPrice(condition.keltnerUpper)}</dd></div>
          </dl>
        </section>
      </div>
    </details>
  );
}

export function PerpetualTechnicalEvidencePanel({ snapshot }: { snapshot: PerpetualDecisionSnapshot }) {
  const [selectedTimeframe, setSelectedTimeframe] = useState<TechnicalTimeframe>("15m");
  const pro = snapshot.pro;
  const activeTimeframe = pro ? selectedTimeframe : "15m";
  const exactEvidence = pro?.multiTimeframeEvidence.find((item) => item.timeframe === activeTimeframe);
  const publicTechnical = snapshot.publicEvidence?.technical;
  const condition: TechnicalValues | undefined = pro
    ? exactEvidence?.details?.indicators
    : publicTechnical;
  const analysisTime = exactEvidence?.observedAt ?? (activeTimeframe === "15m" ? publicTechnical?.observedAt ?? null : null);
  const exactPrice = exactEvidence?.closedPrice ?? (activeTimeframe === "15m" ? publicTechnical?.closedPrice ?? null : null);

  return (
    <section className="bg-ui-panel px-3 py-4 sm:px-5" aria-labelledby="perpetual-technical-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.12em] text-ui-brand"><BarChart3 size={12} aria-hidden /> 기술지표 교차 확인</p>
          <h2 id="perpetual-technical-title" className="mt-1 text-xl font-black text-ui-text">추세·속도·변동성·참여를 따로 확인하세요</h2>
          <p className="mt-1 text-xs leading-5 text-ui-muted [word-break:keep-all]">기술지표는 상단 통합 방향과 감시 조건을 만들거나 바꾸지 않습니다. 동일한 저장 분석에서 각 시간대의 마지막 확정봉을 따로 확인합니다.</p>
        </div>
        <StatusPill tone="watch">{activeTimeframe === "15m" ? "15분 지표" : activeTimeframe === "1h" ? "1시간 지표" : "4시간 지표"}</StatusPill>
      </div>

      {pro ? (
        <>
          <div role="group" aria-label="기술지표 시간대" className="mt-3 grid grid-cols-3 gap-1 rounded-ui-sm bg-ui-inset/60 p-1">
            {timeframeOptions.map((option) => {
              const active = option.id === activeTimeframe;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelectedTimeframe(option.id)}
                  className={`min-h-11 rounded-ui-sm px-2 text-xs font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ui-inset ${active ? "bg-ui-panel text-ui-activeText shadow-ui-card" : "text-ui-muted hover:bg-ui-panel/60 hover:text-ui-text"}`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] leading-5 text-ui-subtle">이 선택은 아래 기술지표 카드에만 적용됩니다. 위 가격 차트의 시간대는 차트 안에서 별도로 선택합니다.</p>
        </>
      ) : null}

      {condition ? (
        <>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-y border-ui-line py-2 text-[11px] leading-5 text-ui-muted">
            <span>{formatKstTime(analysisTime)} 기준 · 확정 종가 {formatPrice(exactPrice)}</span>
            <span>시장 상태 {condition.regime ? regimeLabel(condition.regime) : "확인 중"}</span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              title="추세"
              icon={LineChart}
              primary={condition.regime ? regimeLabel(condition.regime) : "상태 확인 중"}
              detail={`EMA 배열 ${directionLabel(condition.emaStack)} · 기울기 ${directionLabel(condition.emaSlope)} · ADX ${formatNumber(condition.adx14, 1)}`}
            />
            <SummaryCard
              title="모멘텀"
              icon={Activity}
              primary={`RSI ${formatNumber(condition.rsi14, 1)} · ${rsiLabel(condition.rsiState)}`}
              detail={`MACD ${macdChangeLabel(condition.macdState)} · DMI ${directionLabel(condition.dmiState)}`}
            />
            <SummaryCard
              title="변동성"
              icon={Gauge}
              primary={volatilityLabel(condition.volatilityState)}
              detail={`ATR ${formatPercent(condition.atrPercent)} · 볼린저 ${bandPositionLabel(condition.bollingerPosition)}`}
            />
            <SummaryCard
              title="시장 참여"
              icon={Waves}
              primary={volumeLabel(condition.volumeState)}
              detail={typeof condition.volumeRatio === "number" ? `최근 거래량은 평균의 ${condition.volumeRatio.toFixed(2)}배입니다.` : "거래량 비율을 확인 중입니다."}
            />
          </div>
          {hasCompletePerpetualTechnicalDetails(pro) ? <DetailedMetrics condition={condition} /> : pro ? <p className="mt-3 bg-ui-inset/55 px-3 py-3 text-xs leading-5 text-ui-muted">이전 저장 분석에는 전체 EMA·DMI·밴드 수치가 포함되지 않았습니다. 저장되어 있는 핵심 값만 위에 표시합니다.</p> : null}
        </>
      ) : (
        <p className="mt-3 bg-ui-inset/55 px-3 py-4 text-sm leading-6 text-ui-muted">{pro ? "이 저장 분석에는 선택한 시간대의 기술지표 근거가 없습니다. 다른 시간대를 확인해 주세요." : "이전 저장 분석에는 15분 기술지표 근거가 포함되지 않아 이 화면에서 표시할 수 없습니다."}</p>
      )}

      {!pro ? (
        <div className="mt-3 flex flex-col gap-3 border-l-2 border-ui-brand bg-ui-brand/5 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black text-ui-text">Coin Pro에서는 동일한 저장 분석에서 15분·1시간·4시간의 마지막 확정봉을 비교합니다</p>
            <p className="mt-1 text-[11px] leading-5 text-ui-muted">EMA·DMI·Supertrend·Donchian·Keltner·Bollinger의 정확한 수치까지 열립니다.</p>
          </div>
          <CoinProConversionLink
            source="perpetual-evidence"
            placement="perpetual_evidence_lock"
            routeKey={snapshot.asset === "eth" ? "perpetual_eth" : "perpetual_btc"}
            returnTo={`/crypto/perpetual?asset=${snapshot.asset}&timeframe=15m&snapshot=${encodeURIComponent(snapshot.id)}`}
            symbol={snapshot.asset.toUpperCase()}
            surface="perpetual"
            className="inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-ui-sm bg-ui-brand px-3 text-sm font-semibold text-white transition hover:brightness-110 sm:w-auto"
          >
            시간대별 상세 보기
          </CoinProConversionLink>
        </div>
      ) : null}
    </section>
  );
}
