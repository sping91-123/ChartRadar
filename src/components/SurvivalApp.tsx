import { AppFooter } from "@/components/AppFooter";
import { DailyRadarBrief } from "@/components/DailyRadarBrief";
import { Header } from "@/components/Header";
import { LiveMarketChart } from "@/components/LiveMarketChart";
import { MacroTicker } from "@/components/MacroTicker";
import { RadarAlertCenter } from "@/components/RadarAlertCenter";
import { RadarTopNav } from "@/components/RadarTopNav";

export function SurvivalApp() {
  return (
    <main className="min-h-screen px-4 pb-64 sm:pb-40 lg:pb-32">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <Header />
        <RadarTopNav />
        <MacroTicker compact />
        <LiveMarketChart majorOnly />
        <DailyRadarBrief scope="major" />
        <RadarAlertCenter compact />
        <AppFooter />
      </div>
    </main>
  );
}
