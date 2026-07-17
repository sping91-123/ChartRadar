"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, LineChart, ShieldAlert } from "lucide-react";
import { CoinOptionsMarketPanel } from "@/components/coin/CoinOptionsMarketPanel";
import { CoinLargeTradeFlowPanel } from "@/components/coin/CoinLargeTradeFlowPanel";
import { CoinFuturesBrief } from "@/components/coin/CoinFuturesBrief";
import { CoinFuturesSwitch } from "@/components/coin/CoinFuturesSwitch";
import { CoinOnchainPulsePanel } from "@/components/coin/CoinOnchainPulsePanel";
import { CoinFuturesSignalPressurePanel } from "@/components/coin/CoinSignalPressurePanel";
import { CoinStablecoinLiquidityPanel } from "@/components/coin/CoinStablecoinLiquidityPanel";
import { CoinMarketEnvironmentPanel } from "@/components/coin/CoinMarketEnvironmentPanel";
import { Header } from "@/components/Header";
import { LiveMarketChart } from "@/components/LiveMarketChart";
import { RadarTopNav } from "@/components/RadarTopNav";
import { SectionHeader, StatusPill } from "@/components/ui/DesignPrimitives";
import type { MajorAssetId } from "@/lib/majorAssetRoute";

const majorAssetOptions = [
  { id: "btc", label: "비트", detail: "BTC", apiSymbol: "BTCUSDT", chartSymbol: "BTCUSDT.P" },
  { id: "eth", label: "이더", detail: "ETH", apiSymbol: "ETHUSDT", chartSymbol: "ETHUSDT.P" }
] as const;

function BackgroundEvidenceDisclosure({ children }: { children: ReactNode }) {
  return (
    <details className="group border-t border-ui-line pt-4">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 py-2 marker:hidden [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-ui-label font-semibold uppercase tracking-[0.12em] text-ui-subtle">보조 데이터</span>
          <span className="mt-1 block text-ui-heading font-semibold tracking-tight text-ui-text">시장 환경, 온체인, 옵션은 접어 둡니다</span>
          <span className="mt-1 block max-w-3xl text-ui-body text-ui-muted [word-break:keep-all]">
            매매 판단은 상단 플랜과 차트 확인을 우선하고, 이 값들은 필요할 때만 참고합니다.
          </span>
        </span>
        <ChevronDown className="mt-1 shrink-0 text-ui-subtle transition group-open:rotate-180" size={18} aria-hidden />
      </summary>
      <div className="mt-3 grid gap-3">{children}</div>
    </details>
  );
}

export function MajorsApp({ initialAsset = "btc" }: { initialAsset?: MajorAssetId }) {
  const [activeAssetId, setActiveAssetId] = useState<MajorAssetId>(initialAsset);
  const activeAsset = majorAssetOptions.find((asset) => asset.id === activeAssetId) ?? majorAssetOptions[0];
  const selectedSymbols = useMemo(
    () => [{ symbol: activeAsset.apiSymbol, label: activeAsset.detail }],
    [activeAsset.apiSymbol, activeAsset.detail]
  );
  const selectedOptionCurrencies = useMemo(() => [activeAsset.detail], [activeAsset.detail]);
  const handleAssetChange = useCallback((next: MajorAssetId) => {
    setActiveAssetId(next);
    const url = new URL(window.location.href);
    url.searchParams.set("asset", next);
    url.searchParams.delete("symbol");
    url.searchParams.delete("exchange");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  return (
    <main className="min-h-screen max-w-full overflow-x-hidden px-3 pb-28 sm:px-5 sm:pb-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 sm:gap-3">
        <Header market="crypto" />
        <RadarTopNav />
        <CoinFuturesSwitch active={activeAssetId} onAssetChange={handleAssetChange} />
        <CoinFuturesBrief mode="major" symbols={selectedSymbols} />

        <section className="space-y-3 pt-1">
          <SectionHeader
            eyebrow="실시간 수치"
            title={`${activeAsset.label} 플랜에 쓰인 쏠림과 체결입니다`}
            description={`${activeAsset.detail} 선물 상세 수치가 필요할 때만 확인합니다. 매매 방향은 상단의 롱/숏 플랜을 먼저 봅니다.`}
            action={
              <StatusPill tone="risk" icon={ShieldAlert}>
                상세
              </StatusPill>
            }
          />
          <div className="grid gap-3 xl:grid-cols-2">
            <CoinFuturesSignalPressurePanel mode="major" symbols={selectedSymbols} />
            <CoinLargeTradeFlowPanel mode="major" symbols={selectedSymbols} />
          </div>
        </section>

        <section className="space-y-3 pt-1">
          <SectionHeader
            eyebrow="가격 확인"
            title="플랜이 맞는 가격 자리만 확인합니다"
            description="롱은 돌파 유지, 숏은 이탈 유지처럼 상단 플랜의 조건이 차트에서도 이어지는지만 봅니다."
            action={
              <StatusPill tone="watch" icon={LineChart}>
                차트
              </StatusPill>
            }
          />
          <LiveMarketChart majorOnly selectedSymbol={activeAsset.chartSymbol} hideSymbolSelector />
        </section>

        <BackgroundEvidenceDisclosure>
          <CoinMarketEnvironmentPanel mode="major" />
          <CoinStablecoinLiquidityPanel />
          {activeAsset.id === "btc" ? <CoinOnchainPulsePanel /> : null}
          <CoinOptionsMarketPanel currencies={selectedOptionCurrencies} />
        </BackgroundEvidenceDisclosure>
      </div>
    </main>
  );
}
