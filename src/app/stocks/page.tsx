// 해외주식 레이더 페이지를 렌더링한다.
import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";
import { MacroTicker } from "@/components/MacroTicker";
import { RadarTopNav } from "@/components/RadarTopNav";
import { StockRadarApp } from "@/components/StockRadarApp";

export default function StocksPage() {
  return (
    <main className="min-h-screen px-4 pb-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <Header />
        <RadarTopNav />
        <MacroTicker compact />
        <StockRadarApp />
        <AppFooter />
      </div>
    </main>
  );
}
