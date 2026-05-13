// 레이더 뉴스와 매크로 브리핑을 보여주는 페이지.
import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";
import { MacroTicker } from "@/components/MacroTicker";
import { RadarNewsPanel } from "@/components/RadarNewsPanel";
import { RadarTopNav } from "@/components/RadarTopNav";

export default function NewsPage({ searchParams }: { searchParams?: { market?: string } }) {
  const market = searchParams?.market === "stocks" || searchParams?.market === "global" ? "stocks" : "crypto";

  return (
    <main className="min-h-screen px-4 pb-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <Header market={market} />
        <RadarTopNav market={market} />
        <MacroTicker market={market} />
        <RadarNewsPanel market={market} />
        <AppFooter />
      </div>
    </main>
  );
}
