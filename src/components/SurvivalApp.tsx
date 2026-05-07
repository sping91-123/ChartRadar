import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";
import { LiveMarketChart } from "@/components/LiveMarketChart";
import { MarketBoardPanel } from "@/components/MarketBoardPanel";
import { RadarCommandCenter } from "@/components/RadarCommandCenter";
import { RadarDigestPanel } from "@/components/RadarDigestPanel";
import { SetupScoutPanel } from "@/components/SetupScoutPanel";
import { WatchlistPanel } from "@/components/WatchlistPanel";

export function SurvivalApp() {
  return (
    <main className="min-h-screen px-4 pb-32 sm:pb-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <Header />
        <RadarCommandCenter />
        <MarketBoardPanel />
        <RadarDigestPanel />
        <LiveMarketChart />
        <section id="watchlist" className="scroll-mt-24">
          <WatchlistPanel />
        </section>
        <SetupScoutPanel />
        <AppFooter />
      </div>
    </main>
  );
}
