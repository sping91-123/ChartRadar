// 레이더 뉴스와 매크로 브리핑을 보여주는 페이지입니다.
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
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-5">
        <Header market={market} />
        <RadarTopNav market={market} />
        <RadarNewsPanel
          market={market}
          afterBriefing={
            <PanelCard variant="flat" padding="none" className="space-y-3 border-t border-ui-line py-5">
              <SectionHeader
                eyebrow="매크로 일정"
                title={market === "stocks" ? "이번 주 주요 이벤트" : "이번 주 주요 매크로 일정"}
                description="금리·물가·고용처럼 시장 변동성을 키울 수 있는 일정과 공식 발표 상태를 보조 정보로 점검합니다."
              />
              <div className="mt-3">
                <MacroTicker compact market={market} />
              </div>
            </PanelCard>
          }
        />
        <AppFooter />
      </div>
    </main>
  );
}
