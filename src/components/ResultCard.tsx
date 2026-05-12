// 진입 전 리스크 진단 결과를 카드 형태로 보여준다.
import { AlertOctagon, CheckCircle2, CircleAlert, Gauge } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/diagnosis";
import type { DiagnosisResult, Verdict } from "@/types";

interface ResultCardProps {
  result: DiagnosisResult | null;
}

function verdictTone(verdict: Verdict) {
  if (verdict === "진입 금지") {
    return {
      icon: AlertOctagon,
      text: "text-signal-danger",
      border: "border-signal-danger/30",
      bg: "bg-signal-danger/10",
      bar: "bg-signal-danger"
    };
  }

  if (verdict === "관찰 필요") {
    return {
      icon: CircleAlert,
      text: "text-signal-warning",
      border: "border-signal-warning/30",
      bg: "bg-signal-warning/10",
      bar: "bg-signal-warning"
    };
  }

  return {
    icon: CheckCircle2,
    text: "text-signal-success",
    border: "border-signal-success/30",
    bg: "bg-signal-success/10",
    bar: "bg-signal-success"
  };
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-surface-line bg-surface-cardSoft p-3">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 break-words text-base font-bold text-white">{value}</p>
    </div>
  );
}

export function ResultCard({ result }: ResultCardProps) {
  if (!result) {
    return (
      <section className="rounded-lg border border-surface-line bg-surface-card p-5">
        <div className="flex items-center gap-3 text-slate-300">
          <Gauge className="text-accent-blue" size={20} aria-hidden />
          <div>
            <h2 className="text-lg font-bold text-white">진단 결과</h2>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              값을 넣으면 지금 자리가 얼마나 위험한지 바로 확인할 수 있습니다.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const tone = verdictTone(result.verdict);
  const Icon = tone.icon;

  return (
    <section className={`rounded-lg border ${tone.border} ${tone.bg} p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Icon className={`mt-1 shrink-0 ${tone.text}`} size={24} aria-hidden />
          <div>
            <p className="text-sm font-semibold text-slate-400">진입 위험 판정</p>
            <h2 className={`mt-1 text-3xl font-black ${tone.text}`}>{result.verdict}</h2>
          </div>
        </div>
        <div className="shrink-0 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-right">
          <p className="text-xs font-semibold text-slate-400">위험도</p>
          <p className="text-2xl font-black text-white">{result.riskScore}%</p>
        </div>
      </div>

      <div className="mt-5 h-3 overflow-hidden rounded-full bg-black/35">
        <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${result.riskScore}%` }} />
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-bold text-white">걸린 항목</h3>
        {result.violations.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {result.violations.map((violation) => (
              <span key={violation} className="rounded-md border border-white/10 bg-black/25 px-2.5 py-1.5 text-sm font-semibold text-slate-200">
                {violation}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm leading-6 text-slate-300">
            크게 걸린 항목은 없습니다. 그래도 손절 기준과 포지션 크기는 끝까지 지켜주세요.
          </p>
        )}
      </div>

      <div className="mt-5 rounded-md border border-white/10 bg-black/20 p-4">
        <h3 className="text-sm font-bold text-white">포지션 계산</h3>
        {result.positionSizing ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Metric label="허용 손실 금액" value={formatCurrency(result.positionSizing.allowedLossAmount)} />
            <Metric label="적정 포지션 명목가" value={formatCurrency(result.positionSizing.positionNotional)} />
            <Metric label="필요 증거금" value={formatCurrency(result.positionSizing.requiredMargin)} />
            <Metric label="손절 시 예상 손실" value={formatCurrency(result.positionSizing.expectedLossOnStop)} />
            <Metric label="시드 대비 손실률" value={formatPercent(result.positionSizing.seedLossRate)} />
            <Metric label="진입가와 손절가 차이" value={formatPercent(result.positionSizing.priceGapRate * 100)} />
          </div>
        ) : (
          <p className="mt-2 text-sm leading-6 text-slate-300">
            손절가, 진입가, 총 시드, 허용 손실률, 레버리지를 모두 넣으면 적정 포지션 크기를 계산합니다.
          </p>
        )}
      </div>

      <div className="mt-4 rounded-md border border-white/10 bg-black/20 p-4">
        <h3 className="text-sm font-bold text-white">레버리지 체크</h3>
        <p className="mt-2 text-sm leading-6 text-slate-300">{result.leverageWarning}</p>
      </div>

      {result.missingRequiredValues ? (
        <p className="mt-4 rounded-md border border-signal-warning/30 bg-signal-warning/10 p-3 text-sm leading-6 text-signal-warning">
          일부 필수 값이 비어 있어 진단과 계산값이 보수적으로 반영됐습니다.
        </p>
      ) : null}

      <p className="mt-5 border-t border-white/10 pt-4 text-xs leading-5 text-slate-500">
        이 도구는 투자 조언이나 매수·매도 신호를 제공하지 않습니다. 사용자의 매매 계획에서 리스크 요소를 점검하기 위한 교육용 도구입니다.
      </p>
    </section>
  );
}
