import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";
import { LiveMarketChart } from "@/components/LiveMarketChart";
import { MacroTicker } from "@/components/MacroTicker";
import { RadarTopNav } from "@/components/RadarTopNav";

export function MajorsApp() {
  return (
    <main className="min-h-screen px-3 pb-64 sm:px-5 sm:pb-40 lg:pb-32">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-5">
        <Header market="crypto" />
        <RadarTopNav />
        <MacroTicker compact />
        <LiveMarketChart majorOnly />
        <AppFooter />
      </div>
    </main>
  );
}
