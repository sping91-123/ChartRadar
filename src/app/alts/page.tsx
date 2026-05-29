// 알트코인 관심 목록과 시장 레이더 감지를 별도 페이지로 보여줍니다.
import { AppFooter } from "@/components/AppFooter";
import { CoinFuturesSwitch } from "@/components/coin/CoinFuturesSwitch";
import { Header } from "@/components/Header";
import { LiveMarketChart } from "@/components/LiveMarketChart";
import { MacroTicker } from "@/components/MacroTicker";
import { RadarTopNav } from "@/components/RadarTopNav";
import { SetupScoutPanel } from "@/components/SetupScoutPanel";
import { WatchlistPanel } from "@/components/WatchlistPanel";

export default function AltsPage() {
  return (
    <main className="min-h-screen px-3 pb-64 sm:px-5 sm:pb-44 lg:pb-36">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:gap-4">
        <Header market="crypto" />
        <RadarTopNav />
        <MacroTicker compact />
        <CoinFuturesSwitch active="alts" />
        <SetupScoutPanel excludeMajor />
        <WatchlistPanel />
        <LiveMarketChart altOnly />
        <AppFooter />
      </div>
    </main>
  );
}
