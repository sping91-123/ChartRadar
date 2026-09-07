import { CoinFuturesSwitch } from "@/components/coin/CoinFuturesSwitch";
import { CoinFuturesBrief } from "@/components/coin/CoinFuturesBrief";
import { AltFuturesSignalSection } from "@/components/coin/AltFuturesSignalSection";
import { CoinMarketEnvironmentPanel } from "@/components/coin/CoinMarketEnvironmentPanel";
import { CoinStablecoinLiquidityPanel } from "@/components/coin/CoinStablecoinLiquidityPanel";
import { CoinUnlockPressurePanel } from "@/components/coin/CoinUnlockPressurePanel";
import { Header } from "@/components/Header";
import { AltAnalysisEntry } from "@/components/coin/AltAnalysisEntry";
import { ProgressiveDetails } from "@/components/ProgressiveDetails";
import { RadarTopNav } from "@/components/RadarTopNav";
import { SetupScoutPanel } from "@/components/SetupScoutPanel";
import { WatchlistPanel } from "@/components/WatchlistPanel";
import { isNewsImpactUiEnabled, newsImpactMode } from "@/lib/server/newsImpactMode";

const focusedAltMap = {
  sol: { symbol: "SOLUSDT", label: "SOL" },
  xrp: { symbol: "XRPUSDT", label: "XRP" },
  doge: { symbol: "DOGEUSDT", label: "DOGE" },
  bnb: { symbol: "BNBUSDT", label: "BNB" }
} as const;

export default async function CryptoPerpetualAltsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const rawFocus = Array.isArray(params.focus) ? params.focus[0] : params.focus;
  const focus = typeof rawFocus === "string" ? rawFocus.trim().toLowerCase() : "";
  const focusedAlt = focusedAltMap[focus as keyof typeof focusedAltMap];
  const rawSymbol = Array.isArray(params.symbol) ? params.symbol[0] : params.symbol;
  const requestedSymbol = typeof rawSymbol === "string" ? rawSymbol.trim().toUpperCase().replace(/USDT(?:\.P)?$/, "") : null;
  return (
    <main className="min-h-screen px-3 pb-28 sm:px-5 sm:pb-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 sm:gap-3">
        <Header market="crypto" />
        <RadarTopNav newsImpactEnabled={isNewsImpactUiEnabled(newsImpactMode())} />
        <CoinFuturesSwitch active="alts" />
        <AltAnalysisEntry initialFocus={focusedAlt?.label ?? requestedSymbol} />
        <ProgressiveDetails title="알트 전체 수급과 포지션 비교" description="선택 종목 분석과 별도로 SOL·XRP·DOGE·BNB의 흐름을 비교합니다.">
        <CoinFuturesBrief mode="alts" symbols={focusedAlt ? [focusedAlt] : undefined} />
        <AltFuturesSignalSection initialFocus={focusedAlt?.label ?? null} />
        </ProgressiveDetails>
        <ProgressiveDetails title="언락 일정과 시장 배경 확인" description="BTC 도미넌스·환율·스테이블코인 유동성을 참고합니다.">
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
        </ProgressiveDetails>
        <ProgressiveDetails title="다른 후보와 관심목록 확인">
        <section className="pt-1">
          <p className="text-ui-label font-semibold uppercase tracking-[0.12em] text-ui-subtle">세부 근거</p>
          <h2 className="mt-1 text-ui-heading font-semibold tracking-tight text-ui-text">알트 구조와 후보 흐름을 다시 확인합니다</h2>
          <p className="mt-1 text-ui-body text-ui-muted [word-break:keep-all]">
            상단에서 감지한 리스크가 차트 구조, 셋업 후보, 관심목록 흐름과 충돌하는지 하단에서 확인합니다.
          </p>
        </section>
        <SetupScoutPanel excludeMajor />
        <WatchlistPanel />
        </ProgressiveDetails>
      </div>
    </main>
  );
}
