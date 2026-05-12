"use client";
// 시장별 포지션 크기와 손익비를 빠르게 계산하는 페이지.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calculator, ShieldAlert } from "lucide-react";
import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";
import { RadarTopNav } from "@/components/RadarTopNav";
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-surface-line bg-surface-cardSoft p-3">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-base font-bold text-white">{value}</p>
    </div>
  );
}

export default function CalculatorPage({ searchParams }: { searchParams?: { market?: string } }) {
  const initialMarket = searchParams?.market === "stocks" || searchParams?.market === "global" ? "stocks" : "crypto";
  const [market, setMarket] = useState<"crypto" | "stocks">(initialMarket);
  const marketCopy =
    market === "stocks"
      ? {
          title: "글로벌 포지션 계산기",
          intro: "미국 주식, ETF, 해외선물 관찰 구간을 기준으로 수량, 예상 손실, 손익비를 계산해보세요.",
          leverageLabel: "증거금 배수",
          leveragePlaceholder: "예. 1"
        }
      : {
          title: "코인 포지션 계산기",
          intro: "코인 레이더에서 본 관찰 구간과 손절 기준으로 포지션 크기와 손익비를 계산해보세요.",
          leverageLabel: "레버리지",
          leveragePlaceholder: "예. 3"
        };
  const [seed, setSeed] = useState("");
  const [direction, setDirection] = useState<"long" | "short">("long");
  const [riskPercent, setRiskPercent] = useState("1");
  const [entryPrice, setEntryPrice] = useState("");
  const [stopPrice, setStopPrice] = useState("");
  const [leverage, setLeverage] = useState(market === "stocks" ? "1" : "3");
  const [targetPrice, setTargetPrice] = useState("");

  useEffect(() => {
    const marketParam = new URLSearchParams(window.location.search).get("market");
    const nextMarket = marketParam === "stocks" || marketParam === "global" ? "stocks" : "crypto";
    setMarket(nextMarket);
    if (nextMarket === "stocks") setLeverage((current) => (current === "3" ? "1" : current));
  }, []);

  const result = useMemo(() => {
    const seedValue = toNumber(seed);
    const riskValue = toNumber(riskPercent);
    const entry = toNumber(entryPrice);
    const stop = toNumber(stopPrice);
    const lev = toNumber(leverage);
    const target = toNumber(targetPrice);

    if (!seedValue || !riskValue || !entry || !stop || !lev) return null;
    const invalidStopDirection = direction === "long" ? stop >= entry : stop <= entry;
    if (invalidStopDirection) {
      return {
        error: direction === "long" ? "롱은 손절가가 진입가보다 아래에 있어야 합니다." : "숏은 손절가가 진입가보다 위에 있어야 합니다."
      };
    }

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
  }, [direction, entryPrice, leverage, riskPercent, seed, stopPrice, targetPrice]);

  return (
    <main className="min-h-screen px-4 pb-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <Header market={market} />
        <RadarTopNav market={market} />

        <div className="rounded-lg border border-accent-blue/20 bg-accent-blue/5 px-4 py-3 text-xs leading-6 text-slate-400">
          <span className="font-bold text-accent-blue">Chart Radar</span>에서 관찰 구간과 손절 기준을 확인한 뒤,
          시장별 포지션 크기와 손익비를 계산해보세요.
          진입 위험도는 <Link href="/diagnosis" className="font-bold text-accent-blue underline underline-offset-2">진입 진단</Link>에서 확인할 수 있습니다.
        </div>

        <section className="rounded-lg border border-surface-line bg-surface-card p-4 shadow-glow sm:p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-accent-blue/25 bg-accent-blue/10 text-accent-blue">
              <Calculator size={21} aria-hidden />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{marketCopy.title}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-400">{marketCopy.intro}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <span className="text-sm font-semibold text-slate-200">방향</span>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {[
                  { label: "롱", value: "long" as const },
                  { label: "숏", value: "short" as const }
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setDirection(item.value)}
                    className={`min-h-11 rounded-md border px-3 text-sm font-bold ${
                      direction === item.value
                        ? "border-accent-blue bg-accent-blue text-slate-950"
                        : "border-surface-line bg-surface-cardSoft text-slate-300"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <Field label="총 시드" value={seed} onChange={setSeed} placeholder="예. 1000000" />
            <Field label="허용 손실률 (%)" value={riskPercent} onChange={setRiskPercent} placeholder="예. 1" />
            <Field label="진입가" value={entryPrice} onChange={setEntryPrice} placeholder="예. 68000" />
            <Field label="손절가" value={stopPrice} onChange={setStopPrice} placeholder="예. 66500" />
            <Field label={marketCopy.leverageLabel} value={leverage} onChange={setLeverage} placeholder={marketCopy.leveragePlaceholder} />
            <Field label="목표가 선택" value={targetPrice} onChange={setTargetPrice} placeholder="예. 71000" />
          </div>

          <div className="mt-5 rounded-lg border border-white/10 bg-black/20 p-4">
            {result && "error" in result ? (
              <div className="flex items-start gap-3 text-sm leading-6 text-signal-warning">
                <ShieldAlert className="mt-0.5 shrink-0 text-signal-warning" size={18} aria-hidden />
                {result.error}
              </div>
            ) : result ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Metric label="허용 손실 금액" value={formatCurrency(result.allowedLoss)} />
                <Metric label="적정 포지션 명목가" value={formatCurrency(result.notional)} />
                <Metric label="필요 증거금" value={formatCurrency(result.margin)} />
                <Metric label="손절폭" value={formatPercent(result.stopGapRate * 100)} />
                <Metric label="손익비 예시" value={result.rr ? `1 : ${result.rr.toFixed(2)}` : "목표가 입력 필요"} />
                <Metric label="배율 코멘트" value={Number(leverage) >= 10 ? "높음" : Number(leverage) >= 5 ? "주의" : "보통"} />
              </div>
            ) : (
              <div className="flex items-start gap-3 text-sm leading-6 text-slate-300">
                <ShieldAlert className="mt-0.5 shrink-0 text-accent-blue" size={18} aria-hidden />
                총 시드, 허용 손실률, 진입가, 손절가, 배율을 넣으면 계산값이 표시됩니다.
              </div>
            )}
          </div>
        </section>
        <AppFooter />
      </div>
    </main>
  );
}
