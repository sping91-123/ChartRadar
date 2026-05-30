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
            market === "crypto" ? (
              <section className="rounded-ui border border-ui-line bg-ui-panel p-4 shadow-ui-panel sm:p-5">
                <p className="text-ui-label font-semibold uppercase tracking-[0.12em] text-ui-subtle">Macro Calendar</p>
                <h2 className="mt-1 text-ui-heading font-semibold tracking-tight text-ui-text">이번 주 주요 매크로 일정</h2>
                <div className="mt-3">
                  <MacroTicker compact market={market} />
                </div>
              </section>
            ) : undefined
          }
        />
        <AppFooter />
      </div>
    </main>
  );
}
