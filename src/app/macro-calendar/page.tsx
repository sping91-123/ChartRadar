import { ArrowLeft } from "lucide-react";
import { MacroTicker } from "@/components/MacroTicker";
import { ActionButton, PanelCard } from "@/components/ui/DesignPrimitives";

export default function MacroCalendarPage({ searchParams }: { searchParams?: { market?: string } }) {
  const market = searchParams?.market === "stocks" || searchParams?.market === "global" ? "stocks" : "crypto";
  const backHref = market === "stocks" ? "/global" : "/coin";

  return (
    <main className="macro-calendar-page min-h-screen px-3 pb-28 pt-[calc(env(safe-area-inset-top)+0.35rem)] sm:px-5 sm:pb-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2">
        <div className="grid min-h-9 grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center">
          <ActionButton href={backHref} tone="ghost" className="min-h-8 px-0" aria-label="이전 화면으로 이동">
            <ArrowLeft size={14} aria-hidden />
          </ActionButton>
          <div className="min-w-0 text-center">
            <p className="text-xs font-black text-white">매크로 일정</p>
            <p className="truncate text-[11px] font-bold text-slate-500">공식 발표 전후 자동 확인</p>
          </div>
        </div>
        <PanelCard variant="flat" padding="none" className="py-0">
          <MacroTicker market={market} />
        </PanelCard>
      </div>
    </main>
  );
}
