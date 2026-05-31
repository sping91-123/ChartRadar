import { AppFooter } from "@/components/AppFooter";
import { CoinFuturesBrief } from "@/components/coin/CoinFuturesBrief";
import { CoinFuturesSwitch } from "@/components/coin/CoinFuturesSwitch";
import { Header } from "@/components/Header";
import { LiveMarketChart } from "@/components/LiveMarketChart";
import { RadarTopNav } from "@/components/RadarTopNav";

export function MajorsApp() {
  return (
    <main className="min-h-screen px-3 pb-28 sm:px-5 sm:pb-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:gap-4">
        <Header market="crypto" />
        <RadarTopNav />
        <CoinFuturesSwitch active="major" />
        <CoinFuturesBrief mode="major" />
        <LiveMarketChart majorOnly />
        <AppFooter />
      </div>
    </main>
  );
}
