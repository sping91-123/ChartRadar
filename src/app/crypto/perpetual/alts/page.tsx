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
          <p className="text-ui-label font-semibold uppercase tracking-[0.12em] text-ui-subtle">앱이 감지한 알트 직접 신호</p>
          <h2 className="mt-1 text-ui-heading font-semibold tracking-tight text-ui-text">알트 쏠림, 큰 체결, 언락 부담을 먼저 확인합니다</h2>
          <p className="mt-1 text-ui-body text-ui-muted [word-break:keep-all]">
            알트 선물 화면은 SOL, XRP, DOGE, BNB의 포지션 쏠림, 큰 체결 흐름, 언락·변동성 부담을 우선 분리합니다.
          </p>
        </section>
        <CoinFuturesSignalPressurePanel mode="alts" />
        <CoinLargeTradeFlowPanel mode="alts" />
        <CoinUnlockPressurePanel />
        <section className="pt-1">
          <p className="text-ui-label font-semibold uppercase tracking-[0.12em] text-ui-subtle">시장 환경 참고</p>
          <h2 className="mt-1 text-ui-heading font-semibold tracking-tight text-ui-text">알트 직접 신호와 분리해서 봅니다</h2>
          <p className="mt-1 text-ui-body text-ui-muted [word-break:keep-all]">
            스테이블코인 유동성은 알트 선물의 직접 신호가 아니라 시장 전체 환경을 보조 확인하는 값입니다.
          </p>
        </section>
        <CoinStablecoinLiquidityPanel />
        <section className="pt-1">
          <p className="text-ui-label font-semibold uppercase tracking-[0.12em] text-ui-subtle">세부 근거</p>
          <h2 className="mt-1 text-ui-heading font-semibold tracking-tight text-ui-text">알트 구조와 후보 흐름을 다시 확인합니다</h2>
          <p className="mt-1 text-ui-body text-ui-muted [word-break:keep-all]">
            상단에서 감지한 리스크가 차트 구조, 셋업 후보, 관심목록 흐름과 충돌하는지 하단에서 확인합니다.
          </p>
        </section>
        <LiveMarketChart altOnly />
        <SetupScoutPanel excludeMajor />
        <WatchlistPanel />
      </div>
    </main>
  );
}
