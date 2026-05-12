"use client";
// 진입 전 리스크 진단 페이지를 렌더링한다.
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
          <span className="font-bold text-accent-blue">Chart Radar</span>에서 후보를 확인한 뒤,
          지금 보려는 자리가 내 리스크 기준에 맞는지 진입 전 진단으로 점검해보세요.
          포지션 크기만 빠르게 보고 싶다면 <Link href="/calculator" className="font-bold text-accent-blue underline underline-offset-2">계산기</Link>를 사용하면 됩니다.
        </div>

        <div className="rounded-lg border border-surface-line bg-surface-card p-4 text-sm leading-6 text-slate-300">
          초보자는 “롱인지 숏인지, 손절은 어디인지, 시드의 몇 퍼센트까지 잃을 수 있는지”만 입력해도 됩니다.
          익숙한 사용자는 상위 추세와 현재 위치까지 함께 넣어 더 보수적으로 확인하세요.
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
