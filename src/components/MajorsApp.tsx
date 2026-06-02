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
          <p className="text-ui-label font-semibold uppercase tracking-[0.12em] text-ui-subtle">앱이 감지한 선물 직접 신호</p>
          <h2 className="mt-1 text-ui-heading font-semibold tracking-tight text-ui-text">BTC/ETH 쏠림과 큰 체결을 먼저 확인합니다</h2>
          <p className="mt-1 text-ui-body text-ui-muted [word-break:keep-all]">
            메이저 선물 화면은 BTC와 ETH의 포지션 쏠림, 큰 체결 흐름, 구조·변동성 신호를 우선 분리합니다.
          </p>
        </section>
        <CoinFuturesSignalPressurePanel mode="major" />
        <CoinLargeTradeFlowPanel mode="major" />
        <section className="pt-1">
          <p className="text-ui-label font-semibold uppercase tracking-[0.12em] text-ui-subtle">시장 환경 참고</p>
          <h2 className="mt-1 text-ui-heading font-semibold tracking-tight text-ui-text">선물 방향보다 배경 리스크로 봅니다</h2>
          <p className="mt-1 text-ui-body text-ui-muted [word-break:keep-all]">
            스테이블코인 유동성, BTC 온체인 혼잡, 옵션 예상 변동은 BTC/ETH 직접 선물 신호가 아니라 시장 전체 환경을 보조 확인하는 값입니다.
          </p>
        </section>
        <CoinStablecoinLiquidityPanel />
        <CoinOnchainPulsePanel />
        <CoinOptionsMarketPanel />
        <section className="pt-1">
          <p className="text-ui-label font-semibold uppercase tracking-[0.12em] text-ui-subtle">세부 근거</p>
          <h2 className="mt-1 text-ui-heading font-semibold tracking-tight text-ui-text">BTC/ETH 구조와 변동성을 다시 확인합니다</h2>
          <p className="mt-1 text-ui-body text-ui-muted [word-break:keep-all]">
            상단에서 감지한 선물 리스크가 차트 구조와 같은 방향인지 하단 세부 근거에서 확인합니다.
          </p>
        </section>
        <LiveMarketChart majorOnly />
      </div>
    </main>
  );
}
