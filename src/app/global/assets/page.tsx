// 글로벌 자산레이더 전용 페이지입니다.
import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";
import { MacroTicker } from "@/components/MacroTicker";
import { RadarTopNav } from "@/components/RadarTopNav";
import { StockRadarApp } from "@/components/StockRadarApp";

export default function GlobalAssetsPage() {
  return (
    <main className="min-h-screen px-3 pb-64 sm:px-5 sm:pb-44 lg:pb-36">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-5">
        <Header market="stocks" />
        <RadarTopNav market="stocks" />
        <MacroTicker compact market="stocks" />
        <section className="border-y border-surface-line py-5 sm:py-6">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-accent-blue">Global Asset Radar</p>
          <h1 className="mt-1 text-2xl font-black text-white">글로벌 자산레이더</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400 [word-break:keep-all]">
            지수·변동성·반도체·원자재 흐름을 자산별로 확인합니다.
          </p>
        </section>
        <StockRadarApp />
        <AppFooter />
      </div>
    </main>
  );
}
