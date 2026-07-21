import { CoinFuturesSwitch } from "@/components/coin/CoinFuturesSwitch";
import { CoinFuturesBrief } from "@/components/coin/CoinFuturesBrief";
import { AltFuturesSignalSection } from "@/components/coin/AltFuturesSignalSection";
import { CoinMarketEnvironmentPanel } from "@/components/coin/CoinMarketEnvironmentPanel";
import { CoinStablecoinLiquidityPanel } from "@/components/coin/CoinStablecoinLiquidityPanel";
import { CoinUnlockPressurePanel } from "@/components/coin/CoinUnlockPressurePanel";
import { Header } from "@/components/Header";
import { LiveMarketChart } from "@/components/LiveMarketChart";
import { RadarTopNav } from "@/components/RadarTopNav";
import { SetupScoutPanel } from "@/components/SetupScoutPanel";
import { WatchlistPanel } from "@/components/WatchlistPanel";
import { isNewsImpactUiEnabled, newsImpactMode } from "@/lib/server/newsImpactMode";

export default function CryptoPerpetualAltsPage() {
  return (
    <main className="min-h-screen px-3 pb-28 sm:px-5 sm:pb-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 sm:gap-3">
        <Header market="crypto" />
        <RadarTopNav newsImpactEnabled={isNewsImpactUiEnabled(newsImpactMode())} />
        <CoinFuturesSwitch active="alts" />
        <CoinFuturesBrief mode="alts" />
        <AltFuturesSignalSection />
        <CoinUnlockPressurePanel />
        <section className="pt-1">
          <p className="text-ui-label font-semibold uppercase tracking-[0.12em] text-ui-subtle">시장 환경 참고</p>
          <h2 className="mt-1 text-ui-heading font-semibold tracking-tight text-ui-text">알트 직접 신호와 분리해서 봅니다</h2>
          <p className="mt-1 text-ui-body text-ui-muted [word-break:keep-all]">
            BTC 도미넌스, 김치 프리미엄, 환율, 스테이블코인 유동성은 알트 선물 판단을 보조하는 시장 전체 환경 값입니다.
          </p>
        </section>
        <CoinMarketEnvironmentPanel mode="alts" />
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
