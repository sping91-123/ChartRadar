import { ArrowLeft } from "lucide-react";
import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";
import { MacroTicker } from "@/components/MacroTicker";
import { RadarTopNav } from "@/components/RadarTopNav";
import { ActionButton, PanelCard, SectionHeader } from "@/components/ui/DesignPrimitives";

export default function MacroCalendarPage({ searchParams }: { searchParams?: { market?: string } }) {
  const market = searchParams?.market === "stocks" || searchParams?.market === "global" ? "stocks" : "crypto";
  const backHref = market === "stocks" ? "/global" : "/coin";

  return (
    <main className="min-h-screen px-3 pb-28 sm:px-5 sm:pb-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:gap-4">
        <Header market={market} />
        <RadarTopNav market={market} />
        <div>
          <ActionButton href={backHref} tone="ghost" className="px-0">
            <ArrowLeft size={14} aria-hidden />
            뒤로가기
          </ActionButton>
        </div>
        <PanelCard variant="flat" padding="none" className="space-y-3 py-2">
          <SectionHeader
            eyebrow="매크로 일정"
            title={market === "stocks" ? "글로벌 주요 일정" : "코인 시장 주요 일정"}
            description="금리, 물가, 고용, 연준 이벤트처럼 변동성을 키울 수 있는 일정을 공식 발표 상태와 함께 정리합니다."
          />
          <MacroTicker market={market} />
        </PanelCard>
        <AppFooter />
      </div>
    </main>
  );
}
