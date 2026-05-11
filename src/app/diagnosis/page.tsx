"use client";

import { useState } from "react";
import Link from "next/link";
import { AdviceCard } from "@/components/AdviceCard";
import { AppFooter } from "@/components/AppFooter";
import { DiagnosisForm } from "@/components/DiagnosisForm";
import { Header } from "@/components/Header";
import { RadarTopNav } from "@/components/RadarTopNav";
import { ResultCard } from "@/components/ResultCard";
import { diagnoseTrade } from "@/lib/diagnosis";
import type { DiagnosisFormValues, DiagnosisResult } from "@/types";

const initialValues: DiagnosisFormValues = {
  coin: "BTC",
  customCoin: "",
  direction: "롱",
  timeFrame: "15m",
  higherTrend: "모르겠음",
  currentLocation: "모르겠음",
  stopLossStatus: "있음",
  entryPrice: "",
  stopLossPrice: "",
  totalSeed: "",
  riskPercentPreset: "1",
  customRiskPercent: "",
  leverage: ""
};

export default function DiagnosisPage() {
  const [values, setValues] = useState<DiagnosisFormValues>(initialValues);
  const [result, setResult] = useState<DiagnosisResult | null>(null);

  function updateValue<K extends keyof DiagnosisFormValues>(key: K, value: DiagnosisFormValues[K]) {
    setValues((current) => {
      if (key === "stopLossStatus" && value === "없음") {
        return {
          ...current,
          [key]: value,
          stopLossPrice: ""
        };
      }

      return {
        ...current,
        [key]: value
      };
    });
  }

  function handleSubmit() {
    setResult(diagnoseTrade(values));
  }

  return (
    <main className="min-h-screen px-4 pb-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <Header />
        <RadarTopNav />

        <div className="rounded-lg border border-accent-blue/20 bg-accent-blue/5 px-4 py-3 text-xs leading-6 text-slate-400">
          <span className="font-bold text-accent-blue">차트 레이더</span>에서 후보를 확인한 뒤,
          지금 보려는 자리가 원칙에 맞는지 이 진입 점검으로 검토해보세요.
          점검 후 포지션 크기는 <Link href="/calculator" className="font-bold text-accent-blue underline underline-offset-2">계산기</Link>에서 확인할 수 있습니다.
        </div>

        <div className="rounded-lg border border-surface-line bg-surface-card p-4 text-sm leading-6 text-slate-300">
          최대한 빠르게 판단할 수 있게 입력 항목을 줄였습니다. 지금 손대려는 자리가 위험한지,
          아니면 그래도 볼 만한 자리인지에 집중합니다.
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)] lg:items-start">
          <DiagnosisForm values={values} onChange={updateValue} onSubmit={handleSubmit} />

          <div className="space-y-5">
            <ResultCard result={result} />
            <AdviceCard result={result} />
          </div>
        </div>
        <AppFooter />
      </div>
    </main>
  );
}
