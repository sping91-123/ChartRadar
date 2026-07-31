import { Activity, Clock3, LogOut, Target } from "lucide-react";
import { AppSurface, StatusPill } from "@/components/ui/DesignPrimitives";

export interface ExchangeTradeAssessmentView {
  status: "ready" | "insufficient_data" | "market_data_unavailable";
  marketProvider: "okx" | "bybit" | "bitget" | "bingx";
  primaryTimeframe: "1m" | "5m" | "15m" | "1h" | "4h";
  contextTimeframe: "5m" | "15m" | "1h" | "4h" | "1d";
  coverageRatio: number;
  confidence: "high" | "medium" | "low" | "unavailable";
  entryScore: number | null;
  entryGrade: "a" | "b" | "c" | "d" | null;
  exitScore: number | null;
  exitGrade: "a" | "b" | "c" | "d" | null;
  holdingSeconds: number;
  durationClass: "ultra_short" | "short" | "intraday" | "swing" | "position";
  significance: "meaningful" | "limited" | "noise" | null;
  postExitConfirmation: "reversal_after_exit" | "continued_after_exit" | "mixed" | "unavailable";
  metrics: {
    atrAtEntry: number | null;
    entryRangePosition: number | null;
    entryExtensionAtr: number | null;
    mfePricePct: number | null;
    maePricePct: number | null;
    mfeAtr: number | null;
    maeAtr: number | null;
    captureRatio: number | null;
    givebackRatio: number | null;
    costShare: number | null;
  };
  entryReasons: string[];
  exitReasons: string[];
  significanceReasons: string[];
  warnings: string[];
  evaluatedAt: string;
}

const reasonLabels: Record<string, string> = {
  trend_aligned: "진입 방향과 단기 추세가 정렬됐습니다.",
  trend_counter: "단기 추세를 거슬러 진입했습니다.",
  trend_neutral: "단기 추세 방향은 뚜렷하지 않았습니다.",
  higher_timeframe_aligned: "상위 구조도 진입 방향과 정렬됐습니다.",
  higher_timeframe_counter: "상위 구조와 진입 방향이 엇갈렸습니다.",
  support_proximity: "확정 지지 구간과 가까운 롱 진입이었습니다.",
  resistance_proximity: "확정 저항 구간과 가까운 숏 진입이었습니다.",
  unfavorable_range_location: "거래 범위의 불리한 끝에서 진입했습니다.",
  neutral_range_location: "거래 범위의 중간 구간에서 진입했습니다.",
  controlled_breakout: "과도하게 이격되지 않은 돌파 진입이었습니다.",
  entry_beyond_invalidated_range: "진입 방향과 반대로 기존 범위를 벗어난 뒤 들어가 위치 근거가 약합니다.",
  chasing_extension: "EMA20에서 1.5 ATR 넘게 이격된 추격 진입이었습니다.",
  entry_extended: "단기 평균에서 다소 이격된 진입이었습니다.",
  ema20_proximity: "단기 평균 근처에서 진입했습니다.",
  high_move_capture: "거래 중 유리했던 움직임의 대부분을 반영해 청산했습니다.",
  moderate_move_capture: "유리했던 움직임을 일부 반영해 청산했습니다.",
  low_move_capture: "유리했던 움직임 대비 실제 청산 반영 폭이 작았습니다.",
  limited_giveback: "최대 유리 구간 이후 되돌림을 크게 허용하지 않았습니다.",
  large_giveback: "최대 유리 구간 이후 되돌림을 많이 허용했습니다.",
  resistance_exit: "확정 저항에 가까운 롱 청산이었습니다.",
  support_exit: "확정 지지에 가까운 숏 청산이었습니다.",
  structure_invalidation_exit: "확정 구조 이탈 부근에서 손실을 제한한 청산으로 보입니다.",
  loss_exit_requires_plan_context: "손실 청산의 적절성은 당시 손절 계획을 함께 확인해야 합니다.",
  forced_exit_not_scored: "강제 종료 거래라 일반 청산 점수를 매기지 않았습니다.",
  intrabar_exit_not_scored: "같은 기준봉 안에서 끝나 청산 순서를 확정할 수 없습니다.",
  meaningful_excursion: "거래 중 1 ATR 이상의 유효 변동이 있었습니다.",
  structure_evidence_present: "진입 당시 확인 가능한 구조 근거가 복수로 잡혔습니다.",
  structure_evidence_weak: "진입 당시 확인 가능한 구조 근거가 약했습니다.",
  excursion_below_noise_band: "거래 중 변동이 0.5 ATR보다 작았습니다.",
  cost_share_high: "가격 이동 대비 수수료·비용 비중이 컸습니다.",
  mixed_trade_significance: "구조 근거와 실제 변동 강도가 엇갈렸습니다.",
  risk_event_review_priority: "강제 종료 위험 사건이라 우선 복기가 필요합니다."
};

const durationLabels: Record<ExchangeTradeAssessmentView["durationClass"], string> = {
  ultra_short: "초단기",
  short: "단기",
  intraday: "당일",
  swing: "스윙",
  position: "포지션"
};

const significanceLabels: Record<NonNullable<ExchangeTradeAssessmentView["significance"]>, string> = {
  meaningful: "의미 있는 거래",
  limited: "제한적 의미",
  noise: "노이즈 가능성"
};

function gradeLabel(grade: ExchangeTradeAssessmentView["entryGrade"], score: number | null) {
  if (!grade || score === null) return "판단 보류";
  return `${grade.toUpperCase()} · ${score}점`;
}

function gradeTone(grade: ExchangeTradeAssessmentView["entryGrade"]) {
  if (grade === "a" || grade === "b") return "long" as const;
  if (grade === "c") return "watch" as const;
  return grade === "d" ? "risk" as const : "info" as const;
}

function formatHolding(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "확인 중";
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (days > 0) return `${days}일 ${hours}시간`;
  if (hours > 0) return `${hours}시간 ${minutes}분`;
  return `${Math.max(1, minutes)}분`;
}

function firstReasons(reasons: string[], fallback: string) {
  const labels = reasons.map((reason) => reasonLabels[reason]).filter(Boolean).slice(0, 2);
  return labels.length ? labels.join(" ") : fallback;
}

function metric(value: number | null, suffix: string, sign = false) {
  if (value === null || !Number.isFinite(value)) return "판단 보류";
  const prefix = sign && value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}${suffix}`;
}

export function TradeQualityAssessmentCard({
  assessment
}: {
  assessment: ExchangeTradeAssessmentView | null;
}) {
  if (!assessment) {
    return (
      <AppSurface tone="inset" variant="report" padding="sm" className="mt-3">
        <p className="text-xs font-semibold text-ui-text">시장 위치 평가 대기</p>
        <p className="mt-1 text-xs leading-5 text-ui-muted">
          원장 저장은 끝났고, 진입·청산 시점의 동일 거래소 캔들을 순서대로 확인하고 있습니다.
        </p>
      </AppSurface>
    );
  }

  if (assessment.status !== "ready") {
    const unavailable = assessment.status === "market_data_unavailable";
    return (
      <AppSurface tone="inset" variant="report" padding="sm" className="mt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-ui-text">
            {unavailable ? "시장 데이터 재확인 대기" : "시장 위치 평가 보류"}
          </p>
          <StatusPill tone="watch">
            {unavailable ? "자동 재시도" : `캔들 확보 ${Math.round(assessment.coverageRatio * 100)}%`}
          </StatusPill>
        </div>
        <p className="mt-1 text-xs leading-5 text-ui-muted">
          {unavailable
            ? "체결 원장은 정상 저장됐습니다. 공개 캔들 장애는 거래소 연결 상태에 영향을 주지 않습니다."
            : "동일 거래소의 진입 전 캔들이 충분하지 않아 점수를 숨겼습니다."}
        </p>
      </AppSurface>
    );
  }

  const confidenceLabel = assessment.confidence === "high"
    ? "신뢰도 높음"
    : assessment.confidence === "medium"
      ? "신뢰도 보통"
      : "신뢰도 낮음";
  const entryGrade = assessment.confidence === "low" ? null : assessment.entryGrade;
  const exitGrade = assessment.confidence === "low" ? null : assessment.exitGrade;
  return (
    <AppSurface tone="inset" variant="report" padding="md" className="mt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-black text-ui-text">ChartRadar 시장 위치 평가</p>
          <p className="mt-1 text-[11px] text-ui-subtle">
            {assessment.primaryTimeframe} 실행봉 · {assessment.contextTimeframe} 구조봉
          </p>
        </div>
        <StatusPill tone={assessment.confidence === "low" ? "watch" : "info"}>{confidenceLabel}</StatusPill>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <AppSurface tone="elevated" variant="report" padding="sm">
          <div className="flex items-center justify-between gap-2">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-ui-muted">
              <Target size={14} aria-hidden /> 진입 위치
            </p>
            <StatusPill tone={gradeTone(entryGrade)}>
              {gradeLabel(entryGrade, entryGrade ? assessment.entryScore : null)}
            </StatusPill>
          </div>
          <p className="mt-2 text-xs leading-5 text-ui-muted">
            {firstReasons(assessment.entryReasons, "진입 전 확정 구조만으로 평가했습니다.")}
          </p>
        </AppSurface>

        <AppSurface tone="elevated" variant="report" padding="sm">
          <div className="flex items-center justify-between gap-2">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-ui-muted">
              <LogOut size={14} aria-hidden /> 청산 대응
            </p>
            <StatusPill tone={gradeTone(exitGrade)}>
              {gradeLabel(exitGrade, exitGrade ? assessment.exitScore : null)}
            </StatusPill>
          </div>
          <p className="mt-2 text-xs leading-5 text-ui-muted">
            {firstReasons(assessment.exitReasons, "청산 시점까지 확인된 구조로 평가했습니다.")}
          </p>
        </AppSurface>

        <AppSurface tone="elevated" variant="report" padding="sm">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-ui-muted">
            <Clock3 size={14} aria-hidden /> 보유 유형
          </p>
          <p className="mt-2 text-sm font-black text-ui-text">
            {durationLabels[assessment.durationClass]} · {formatHolding(assessment.holdingSeconds)}
          </p>
          <p className="mt-1 text-[11px] leading-4 text-ui-subtle">보유시간은 사실 분류이며, 너무 짧거나 길다고 단정하지 않습니다.</p>
        </AppSurface>

        <AppSurface tone="elevated" variant="report" padding="sm">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-ui-muted">
            <Activity size={14} aria-hidden /> 거래 근거 강도
          </p>
          <p className="mt-2 text-sm font-black text-ui-text">
            {assessment.significance ? significanceLabels[assessment.significance] : "판단 보류"}
          </p>
          <p className="mt-1 text-[11px] leading-4 text-ui-subtle">
            {firstReasons(assessment.significanceReasons, "손익이 아니라 구조와 실제 변동 폭을 기준으로 분류합니다.")}
          </p>
        </AppSurface>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <StatusPill tone="info">MFE {metric(assessment.metrics.mfeAtr, " ATR", true)}</StatusPill>
        <StatusPill tone="info">MAE {metric(assessment.metrics.maeAtr, " ATR")}</StatusPill>
        <StatusPill tone="info">
          움직임 포착 {assessment.metrics.captureRatio === null ? "판단 보류" : `${Math.round(assessment.metrics.captureRatio * 100)}%`}
        </StatusPill>
      </div>

      {assessment.postExitConfirmation !== "unavailable" ? (
        <p className="mt-3 text-[11px] leading-5 text-ui-subtle">
          청산 후 제한 구간은 점수에 넣지 않았습니다. 사후 확인:{" "}
          {assessment.postExitConfirmation === "reversal_after_exit"
            ? "청산 뒤 반대 움직임이 우세했습니다."
            : assessment.postExitConfirmation === "continued_after_exit"
              ? "청산 뒤 기존 방향 움직임이 더 이어졌습니다."
              : "한쪽으로 뚜렷하게 이어지지 않았습니다."}
        </p>
      ) : null}
      <p className="mt-2 text-[10px] leading-4 text-ui-subtle">
        가격 구조 기반 사후 평가입니다. 당시 손절·목표·전략 의도는 직접 복기 내용과 함께 확인하세요.
      </p>
    </AppSurface>
  );
}
