import { CoinOptionsMarketPanel } from "@/components/coin/CoinOptionsMarketPanel";
import { CoinLargeTradeFlowPanel } from "@/components/coin/CoinLargeTradeFlowPanel";
import { CoinFuturesBrief } from "@/components/coin/CoinFuturesBrief";
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
        <CoinFuturesBrief mode="major" />
        <section className="pt-1">
          <p className="text-ui-label font-semibold uppercase tracking-[0.12em] text-ui-subtle">세부 근거</p>
          <h2 className="mt-1 text-ui-heading font-semibold tracking-tight text-ui-text">선물 리스크를 나눠서 확인합니다</h2>
          <p className="mt-1 text-ui-body text-ui-muted [word-break:keep-all]">
            상단 결론을 먼저 보고, 아래 패널에서 포지션 쏠림·큰 체결·유동성·온체인·옵션·차트 근거를 순서대로 확인합니다.
          </p>
        </section>
        <CoinFuturesSignalPressurePanel mode="major" />
        <CoinLargeTradeFlowPanel mode="major" />
        <CoinStablecoinLiquidityPanel />
        <CoinOnchainPulsePanel />
        <CoinOptionsMarketPanel />
        <LiveMarketChart majorOnly />
      </div>
    </main>
  );
}
