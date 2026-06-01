import { CoinOptionsMarketPanel } from "@/components/coin/CoinOptionsMarketPanel";
import { CoinLargeTradeFlowPanel } from "@/components/coin/CoinLargeTradeFlowPanel";
import { CoinFuturesSwitch } from "@/components/coin/CoinFuturesSwitch";
import { CoinOnchainPulsePanel } from "@/components/coin/CoinOnchainPulsePanel";
import { CoinFuturesSignalPressurePanel } from "@/components/coin/CoinSignalPressurePanel";
import { CoinStablecoinLiquidityPanel } from "@/components/coin/CoinStablecoinLiquidityPanel";
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
        <CoinFuturesSignalPressurePanel mode="major" />
        <CoinStablecoinLiquidityPanel />
        <CoinOnchainPulsePanel />
        <CoinOptionsMarketPanel />
        <CoinLargeTradeFlowPanel mode="major" />
        <LiveMarketChart majorOnly />
      </div>
    </main>
  );
}
