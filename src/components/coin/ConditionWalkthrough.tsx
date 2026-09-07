"use client";

import { useState } from "react";

const steps = [
  { label: "1 · 기다릴 조건", title: "방향이 엇갈리면, 확인할 변화부터 정합니다.", body: "예: 큰 흐름과 단기 방향이 다시 같아지는지 기다립니다. 조건이 충족되지 않으면 관망을 유지합니다.", result: "사용자: 확인할 조건을 선택해 감시로 저장" },
  { label: "2 · 다시 확인", title: "조건이 충족됐을 때, 그 시점의 분석을 봅니다.", body: "앱은 저장한 조건을 최대 5분 간격으로 평가합니다. 앱 알림을 연결하면 다시 확인할 시점을 알 수 있습니다.", result: "사용자: 알림을 열어 위험과 판단 변경 기준을 재확인" },
  { label: "3 · 판단 기록", title: "당시 판단을 남겨 다음 판단과 비교합니다.", body: "좋은 결과뿐 아니라 관망·해석 변경도 기록합니다. 당시 조건과 내가 내린 판단을 함께 돌아봅니다.", result: "사용자: 당시 분석을 저장하고 다음에 확인할 기준 한 줄 기록" }
];

export function ConditionWalkthrough() {
  const [step, setStep] = useState(0);
  const [unmet, setUnmet] = useState(false);
  const current = steps[step];
  return (
    <section aria-labelledby="condition-demo-title" className="border border-ui-brand/25 bg-ui-brand/5 p-3 sm:p-4">
      <p className="text-[10px] font-semibold text-ui-muted">조작 가능한 이용 예시 · 가상 상황 · 실제 시장·성과 기록 아님</p>
      <h2 id="condition-demo-title" className="mt-1 text-base font-bold text-ui-text">차트를 떠난 뒤에도 이어지는 판단</h2>
      <div className="mt-3 grid grid-cols-3 gap-1" role="group" aria-label="이용 예시 단계">
        {steps.map((item, index) => <button type="button" key={item.label} aria-pressed={step === index} onClick={() => { setStep(index); setUnmet(false); }} className={`min-h-11 rounded-ui-sm px-1 text-xs font-semibold ${step === index ? "bg-ui-brand text-white" : "bg-ui-inset text-ui-muted"}`}>{item.label}</button>)}
      </div>
      <div className="mt-3 min-h-32" aria-live="polite" aria-atomic="true">
        <p className="text-sm font-bold leading-6 text-ui-text">{unmet ? "조건이 오지 않으면, 계속 기다립니다." : current.title}</p>
        <p className="mt-1 text-xs leading-5 text-ui-muted">{unmet ? "감시를 저장해도 조건이 충족돼야 알림이 옵니다. 만료되면 최신 분석을 확인해 필요한 조건만 다시 저장합니다." : current.body}</p>
        <p className="mt-2 text-xs font-semibold leading-5 text-ui-brand">{unmet ? "사용자: 감시 상태와 만료 시각 확인" : current.result}</p>
      </div>
      <button type="button" aria-pressed={unmet} onClick={() => setUnmet((value) => !value)} className="min-h-10 text-xs font-semibold text-ui-muted underline underline-offset-4">{unmet ? "이용 단계로 돌아가기" : "조건이 오지 않는 경우도 보기"}</button>
    </section>
  );
}
