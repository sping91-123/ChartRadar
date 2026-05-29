import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";
import { MacroTicker } from "@/components/MacroTicker";
import { RadarNewsPanel } from "@/components/RadarNewsPanel";
import { RadarTopNav } from "@/components/RadarTopNav";
import { PanelCard, SectionHeader } from "@/components/ui/DesignPrimitives";

export default function NewsPage({ searchParams }: { searchParams?: { market?: string } }) {
  const market = searchParams?.market === "stocks" || searchParams?.market === "global" ? "stocks" : "crypto";

  return (
    <main className="min-h-screen px-3 pb-10 sm:px-5">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:gap-4">
        <Header market={market} />
        <RadarTopNav market={market} />
        <RadarNewsPanel
          market={market}
          afterBriefing={
            <div id="macro-calendar" className="scroll-mt-16 sm:scroll-mt-20">
              <PanelCard variant="flat" padding="none" className="space-y-2 py-3">
                <SectionHeader
                  eyebrow="매크로 일정"
                  title={market === "stocks" ? "이번 주 주요 이벤트" : "이번 주 주요 매크로 일정"}
                  description="금리, 물가, 고용처럼 시장 변동성을 키울 수 있는 일정과 공식 발표 상태를 점검합니다."
                />
                <div className="mt-2">
                  <MacroTicker compact market={market} />
                </div>
              </PanelCard>
            </div>
          }
        />
        <AppFooter />
      </div>
    </main>
  );
}
