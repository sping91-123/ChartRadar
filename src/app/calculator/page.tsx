"use client";

import { useMemo, useState } from "react";
import { Calculator, ShieldAlert } from "lucide-react";
import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";
import { TabMenu } from "@/components/TabMenu";
import { formatCurrency, formatPercent } from "@/lib/diagnosis";

function toNumber(value: string) {
  const parsed = Number(value.replaceAll(",", "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function Field({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-slate-200">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode="decimal"
        className="min-h-12 w-full rounded-md border border-surface-line bg-surface-cardSoft px-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-accent-blue"
      />
    </label>
  );
}

export default function CalculatorPage() {
  const [seed, setSeed] = useState("");
  const [riskPercent, setRiskPercent] = useState("1");
  const [entryPrice, setEntryPrice] = useState("");
  const [stopPrice, setStopPrice] = useState("");
  const [leverage, setLeverage] = useState("3");
  const [targetPrice, setTargetPrice] = useState("");

  const result = useMemo(() => {
    const seedValue = toNumber(seed);
    const riskValue = toNumber(riskPercent);
    const entry = toNumber(entryPrice);
    const stop = toNumber(stopPrice);
    const lev = toNumber(leverage);
    const target = toNumber(targetPrice);

    if (!seedValue || !riskValue || !entry || !stop || !lev) return null;

    const stopGapRate = Math.abs(entry - stop) / entry;
    if (stopGapRate <= 0) return null;

    const allowedLoss = (seedValue * riskValue) / 100;
    const notional = allowedLoss / stopGapRate;
    const margin = notional / lev;
    const rewardRate = target ? Math.abs(target - entry) / entry : null;
    const rr = rewardRate ? rewardRate / stopGapRate : null;

    return {
      allowedLoss,
      notional,
      margin,
      stopGapRate,
      rr
    };
  }, [entryPrice, leverage, riskPercent, seed, stopPrice, targetPrice]);

  return (
    <main className="min-h-screen px-4 pb-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <Header />
        <TabMenu />

        <section className="rounded-lg border border-surface-line bg-surface-card p-4 shadow-glow sm:p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-accent-blue/25 bg-accent-blue/10 text-accent-blue">
              <Calculator size={21} aria-hidden />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">포지션 계산</h2>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                손절 기준으로 적정 포지션 크기, 필요 증거금, 손익비 예시를 빠르게 계산합니다.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="총 시드" value={seed} onChange={setSeed} placeholder="예: 1000000" />
            <Field label="허용 손실률 (%)" value={riskPercent} onChange={setRiskPercent} placeholder="예: 1" />
            <Field label="진입가" value={entryPrice} onChange={setEntryPrice} placeholder="예: 68000" />
            <Field label="손절가" value={stopPrice} onChange={setStopPrice} placeholder="예: 66500" />
            <Field label="레버리지" value={leverage} onChange={setLeverage} placeholder="예: 3" />
            <Field label="목표가 (선택)" value={targetPrice} onChange={setTargetPrice} placeholder="예: 71000" />
          </div>

          <div className="mt-5 rounded-lg border border-white/10 bg-black/20 p-4">
            {result ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Metric label="허용 손실 금액" value={formatCurrency(result.allowedLoss)} />
                <Metric label="적정 포지션 명목가" value={formatCurrency(result.notional)} />
                <Metric label="필요 증거금" value={formatCurrency(result.margin)} />
                <Metric label="손절 폭" value={formatPercent(result.stopGapRate * 100)} />
                <Metric label="손익비 예시" value={result.rr ? `1 : ${result.rr.toFixed(2)}` : "목표가 입력 필요"} />
                <Metric
                  label="레버리지 코멘트"
                  value={Number(leverage) >= 10 ? "높음" : Number(leverage) >= 5 ? "주의" : "보통"}
                />
              </div>
            ) : (
              <div className="flex items-start gap-3 text-sm leading-6 text-slate-300">
                <ShieldAlert className="mt-0.5 shrink-0 text-accent-blue" size={18} aria-hidden />
                총 시드, 허용 손실률, 진입가, 손절가, 레버리지를 넣으면 계산값이 표시됩니다.
              </div>
            )}
          </div>
        </section>
        <AppFooter />
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-surface-line bg-surface-cardSoft p-3">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-base font-bold text-white">{value}</p>
    </div>
  );
}
