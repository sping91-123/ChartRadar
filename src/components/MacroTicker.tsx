"use client";
// 레이더뉴스 상단에 주요 미국 매크로 체크 항목을 전광판 형태로 보여준다.
import { CalendarClock, Radio, ShieldAlert, TimerReset } from "lucide-react";

type MacroTickerItem = {
  label: string;
  status: "예정" | "발표됨" | "관찰";
  detail: string;
  impact: "high" | "medium" | "low";
};

const macroItems: MacroTickerItem[] = [
  {
    label: "CPI / Core CPI",
    status: "예정",
    detail: "물가 둔화 여부 확인. BTC와 나스닥 변동성 확대 구간.",
    impact: "high"
  },
  {
    label: "PPI",
    status: "예정",
    detail: "생산자 물가. CPI 전후 인플레이션 기대를 다시 흔들 수 있음.",
    impact: "medium"
  },
  {
    label: "FOMC / 파월 발언",
    status: "관찰",
    detail: "금리 경로와 달러 방향성 확인. 알트 변동성에 직접 영향.",
    impact: "high"
  },
  {
    label: "비농업 고용",
    status: "예정",
    detail: "고용 강도 확인. 강한 고용은 금리 부담, 약한 고용은 경기 우려.",
    impact: "high"
  },
  {
    label: "실업수당 청구",
    status: "관찰",
    detail: "매주 목요일 발표. 단기 달러와 위험자산 심리에 영향.",
    impact: "medium"
  },
  {
    label: "미 10년물 금리",
    status: "관찰",
    detail: "금리 급등 시 코인 반등 탄력 둔화 가능성 체크.",
    impact: "high"
  },
  {
    label: "DXY 달러지수",
    status: "관찰",
    detail: "달러 강세는 코인 상방을 눌러주는 경우가 많음.",
    impact: "medium"
  }
];

function statusClass(status: MacroTickerItem["status"]) {
  if (status === "예정") return "border-accent-blue/25 bg-accent-blue/10 text-accent-blue";
  if (status === "발표됨") return "border-signal-success/25 bg-signal-success/10 text-signal-success";
  return "border-signal-warning/25 bg-signal-warning/10 text-signal-warning";
}

function impactLabel(impact: MacroTickerItem["impact"]) {
  if (impact === "high") return "중요";
  if (impact === "medium") return "주의";
  return "참고";
}

export function MacroTicker() {
  const repeatedItems = [...macroItems, ...macroItems];

  return (
    <section className="overflow-hidden rounded-lg border border-accent-blue/20 bg-surface-card shadow-glow">
      <div className="flex items-center gap-3 border-b border-white/10 bg-black/20 px-3 py-2">
        <div className="radar-mark grid h-8 w-8 shrink-0 place-items-center border border-accent-blue/30 text-accent-blue">
          <Radio size={15} aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black text-white">매크로 레이더</p>
          <p className="truncate text-[11px] font-bold text-slate-500">미국 주요 발표와 금리·달러 흐름을 먼저 체크합니다.</p>
        </div>
        <div className="ml-auto hidden items-center gap-1 rounded border border-signal-warning/20 bg-signal-warning/10 px-2 py-1 text-[11px] font-black text-signal-warning sm:flex">
          <ShieldAlert size={12} aria-hidden />
          발표 전후 변동성 주의
        </div>
      </div>

      <div className="macro-marquee py-2">
        <div className="macro-marquee-track">
          {repeatedItems.map((item, index) => (
            <div
              key={`${item.label}-${index}`}
              className="mx-1 inline-flex min-w-[280px] max-w-[360px] items-center gap-2 rounded-md border border-white/10 bg-black/25 px-3 py-2 align-top"
            >
              <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-black ${statusClass(item.status)}`}>{item.status}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-xs font-black text-white">{item.label}</p>
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-black text-slate-300">{impactLabel(item.impact)}</span>
                </div>
                <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-white/10 px-3 py-2 text-[11px] leading-5 text-slate-500">
        <TimerReset size={13} className="shrink-0 text-accent-blue" aria-hidden />
        <span className="[word-break:keep-all]">정확한 발표 시각과 실제 수치는 경제 캘린더 API 연결 전까지 별도 확인이 필요합니다.</span>
        <CalendarClock size={13} className="ml-auto hidden shrink-0 text-slate-600 sm:block" aria-hidden />
      </div>
    </section>
  );
}
