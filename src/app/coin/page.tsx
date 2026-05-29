import { AppFooter } from "@/components/AppFooter";
import { CoinRadarHomePanel } from "@/components/coin/CoinRadarHomePanel";
import { Header } from "@/components/Header";
import { MacroTicker } from "@/components/MacroTicker";
import { RadarTopNav } from "@/components/RadarTopNav";

export default function CoinHomePage() {
  return (
    <main className="min-h-screen px-3 pb-28 sm:px-5 sm:pb-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:gap-4">
        <Header market="crypto" />
        <RadarTopNav market="crypto" />
        <MacroTicker compact />
        <CoinRadarHomePanel />
        <AppFooter />
      </div>
    </main>
  );
}
