import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";
import { MacroTicker } from "@/components/MacroTicker";
import { RadarNewsPanel } from "@/components/RadarNewsPanel";
import { RadarTopNav } from "@/components/RadarTopNav";

export default function NewsPage({ searchParams }: { searchParams?: { market?: string } }) {
  const market = searchParams?.market === "stocks" || searchParams?.market === "global" ? "stocks" : "crypto";

  return (
    <main className="min-h-screen px-3 pb-28 sm:px-5 sm:pb-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:gap-4">
        <Header market={market} />
        <RadarTopNav market={market} />
        <RadarNewsPanel
          market={market}
          afterBriefing={
            <section className="border-t border-ui-line py-4">
              <p className="text-sm font-semibold text-ui-text">이번 주 주요 매크로 일정</p>
              <p className="mt-1 text-xs leading-5 text-ui-muted [word-break:keep-all]">뉴스 브리핑 뒤에 실제 발표 일정과 확인 상태를 함께 봅니다.</p>
              <div className="mt-3">
                <MacroTicker compact market={market} />
              </div>
            </section>
          }
        />
        <AppFooter />
      </div>
    </main>
  );
}
