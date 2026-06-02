import { CoinFuturesSwitch } from "@/components/coin/CoinFuturesSwitch";
import { CoinFuturesBrief } from "@/components/coin/CoinFuturesBrief";
import { CoinLargeTradeFlowPanel } from "@/components/coin/CoinLargeTradeFlowPanel";
import { CoinFuturesSignalPressurePanel } from "@/components/coin/CoinSignalPressurePanel";
import { CoinStablecoinLiquidityPanel } from "@/components/coin/CoinStablecoinLiquidityPanel";
import { CoinUnlockPressurePanel } from "@/components/coin/CoinUnlockPressurePanel";
import { Header } from "@/components/Header";
import { LiveMarketChart } from "@/components/LiveMarketChart";
import { RadarTopNav } from "@/components/RadarTopNav";
import { SetupScoutPanel } from "@/components/SetupScoutPanel";
import { WatchlistPanel } from "@/components/WatchlistPanel";

export default function CryptoPerpetualAltsPage() {
  return (
    <main className="min-h-screen px-3 pb-28 sm:px-5 sm:pb-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:gap-4">
        <Header market="crypto" />
        <RadarTopNav />
        <CoinFuturesSwitch active="alts" />
        <CoinFuturesBrief mode="alts" />
        <section className="pt-1">
          <p className="text-ui-label font-semibold uppercase tracking-[0.12em] text-ui-subtle">세부 근거</p>
          <h2 className="mt-1 text-ui-heading font-semibold tracking-tight text-ui-text">알트 선물 리스크를 나눠서 확인합니다</h2>
          <p className="mt-1 text-ui-body text-ui-muted [word-break:keep-all]">
            상단 결론을 먼저 보고, 아래 패널에서 알트 포지션 쏠림·큰 체결·유동성·언락·차트·후보 흐름을 순서대로 확인합니다.
          </p>
        </section>
        <CoinFuturesSignalPressurePanel mode="alts" />
        <CoinLargeTradeFlowPanel mode="alts" />
        <CoinStablecoinLiquidityPanel />
        <CoinUnlockPressurePanel />
        <LiveMarketChart altOnly />
        <SetupScoutPanel excludeMajor />
        <WatchlistPanel />
      </div>
    </main>
  );
}
