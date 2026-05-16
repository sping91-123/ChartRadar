// 레이더 뉴스와 매크로 브리핑을 보여주는 페이지입니다.
import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";
import { MacroTicker } from "@/components/MacroTicker";
import { RadarNewsPanel } from "@/components/RadarNewsPanel";
import { RadarTopNav } from "@/components/RadarTopNav";

export default function NewsPage({ searchParams }: { searchParams?: { market?: string } }) {
  const market = searchParams?.market === "stocks" || searchParams?.market === "global" ? "stocks" : "crypto";

  return (
    <main className="min-h-screen px-3 pb-10 sm:px-5">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-5">
        <Header market={market} />
        <RadarTopNav market={market} />
        <RadarNewsPanel market={market} />
        <section className="rounded-2xl border border-surface-line bg-surface-card/75 p-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-accent-blue">매크로 일정</p>
            <h2 className="mt-1 text-lg font-black text-white">다가오는 주요 이벤트</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500 [word-break:keep-all]">
              이번 주 체크할 매크로 일정은 보조 정보로 함께 확인하세요.
            </p>
          </div>
          <div className="mt-3">
            <MacroTicker compact market={market} />
          </div>
        </section>
        <AppFooter />
      </div>
    </main>
  );
}
