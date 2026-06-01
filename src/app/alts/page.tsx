// 알트코인 관심 목록과 시장 레이더 감지를 별도 페이지로 보여줍니다.
import { CoinFuturesSwitch } from "@/components/coin/CoinFuturesSwitch";
import { CoinLargeTradeFlowPanel } from "@/components/coin/CoinLargeTradeFlowPanel";
import { CoinFuturesSignalPressurePanel } from "@/components/coin/CoinSignalPressurePanel";
import { CoinStablecoinLiquidityPanel } from "@/components/coin/CoinStablecoinLiquidityPanel";
import { CoinUnlockPressurePanel } from "@/components/coin/CoinUnlockPressurePanel";
import { Header } from "@/components/Header";
import { LiveMarketChart } from "@/components/LiveMarketChart";
import { RadarTopNav } from "@/components/RadarTopNav";
import { SetupScoutPanel } from "@/components/SetupScoutPanel";
import { WatchlistPanel } from "@/components/WatchlistPanel";

export default function AltsPage() {
  return (
    <main className="min-h-screen px-3 pb-28 sm:px-5 sm:pb-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:gap-4">
        <Header market="crypto" />
        <RadarTopNav />
        <CoinFuturesSwitch active="alts" />
        <CoinFuturesSignalPressurePanel mode="alts" />
        <CoinStablecoinLiquidityPanel />
        <CoinLargeTradeFlowPanel mode="alts" />
        <CoinUnlockPressurePanel />
        <LiveMarketChart altOnly />
        <SetupScoutPanel excludeMajor />
        <WatchlistPanel />
      </div>
    </main>
  );
}
