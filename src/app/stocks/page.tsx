// 글로벌 레이더 페이지를 렌더링한다.
import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";
import { GlobalMarketPulse } from "@/components/GlobalMarketPulse";
import { MacroTicker } from "@/components/MacroTicker";
import { RadarTopNav } from "@/components/RadarTopNav";
import { StockRadarApp } from "@/components/StockRadarApp";
import { isNewsImpactUiEnabled, newsImpactMode } from "@/lib/server/newsImpactMode";

export default function StocksPage() {
  return (
    <main className="min-h-screen px-3 pb-64 sm:px-5 sm:pb-44 lg:pb-36">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-5">
        <Header market="stocks" />
        <RadarTopNav market="stocks" newsImpactEnabled={isNewsImpactUiEnabled(newsImpactMode())} />
        <MacroTicker compact market="stocks" />
        <GlobalMarketPulse />
        <StockRadarApp />
        <AppFooter />
      </div>
    </main>
  );
}
