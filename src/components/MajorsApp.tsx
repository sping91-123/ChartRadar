"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { CoinFuturesBrief } from "@/components/coin/CoinFuturesBrief";
import { CoinFuturesSwitch } from "@/components/coin/CoinFuturesSwitch";
import { CoinMarketEnvironmentPanel } from "@/components/coin/CoinMarketEnvironmentPanel";
import { CoinOnchainPulsePanel } from "@/components/coin/CoinOnchainPulsePanel";
import { CoinOptionsMarketPanel } from "@/components/coin/CoinOptionsMarketPanel";
import { PerpetualDecisionExperience } from "@/components/coin/PerpetualDecisionExperience";
import { CoinStablecoinLiquidityPanel } from "@/components/coin/CoinStablecoinLiquidityPanel";
import { Header } from "@/components/Header";
import { RadarTopNav } from "@/components/RadarTopNav";
import { withSupabaseAuth } from "@/lib/authFetch";
import type { MajorAssetId } from "@/lib/majorAssetRoute";
import type { PerpetualRevenueCoreMode } from "@/lib/server/perpetualRevenueCore";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";

const majorAssetOptions = [
  { id: "btc", label: "비트", detail: "BTC", apiSymbol: "BTCUSDT" },
  { id: "eth", label: "이더", detail: "ETH", apiSymbol: "ETHUSDT" }
] as const;

function BackgroundEvidenceDisclosure({ children }: { children: ReactNode }) {
  const [opened, setOpened] = useState(false);
  return (
    <details className="group border-t border-ui-line pt-4" onToggle={(event) => setOpened(event.currentTarget.open)}>
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 py-2 marker:hidden [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-ui-label font-semibold uppercase tracking-[0.12em] text-ui-subtle">배경 정보</span>
          <span className="mt-1 block text-ui-heading font-semibold tracking-tight text-ui-text">시장 환경, 온체인, 옵션은 접어 둡니다</span>
          <span className="mt-1 block max-w-3xl text-ui-body text-ui-muted [word-break:keep-all]">
            판단은 상단 리스크 스냅샷과 조건 확인을 우선하고, 이 값들은 필요할 때만 참고합니다.
          </span>
        </span>
        <ChevronDown className="mt-1 shrink-0 text-ui-subtle transition group-open:rotate-180" size={18} aria-hidden />
      </summary>
      {opened ? <div className="mt-3 grid gap-3">{children}</div> : null}
    </details>
  );
}

function ShadowPerpetualCanaryGate({
  asset,
  selectedSymbols,
  requestedSnapshotId,
  source,
  attributionId
}: {
  asset: MajorAssetId;
  selectedSymbols: Array<{ symbol: string; label: string }>;
  requestedSnapshotId: string | null;
  source: "home" | "alert" | null;
  attributionId: string | null;
}) {
  const { session, isLoading } = useSupabaseAuth();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    if (isLoading || !session?.accessToken) {
      setEnabled(false);
      return () => controller.abort();
    }
    void (async () => {
      try {
        const response = await fetch(
          "/api/crypto/perpetual/access",
          await withSupabaseAuth({ cache: "no-store", signal: controller.signal })
        );
        const payload = (await response.json().catch(() => ({}))) as { enabled?: boolean };
        if (!controller.signal.aborted) setEnabled(response.ok && payload.enabled === true);
      } catch {
        if (!controller.signal.aborted) setEnabled(false);
      }
    })();
    return () => controller.abort();
  }, [asset, isLoading, session?.accessToken]);

  if (!enabled) return <CoinFuturesBrief mode="major" symbols={selectedSymbols} />;
  return (
    <PerpetualDecisionExperience
      key={asset}
      asset={asset}
      requestedSnapshotId={requestedSnapshotId}
      source={source}
      attributionId={attributionId}
    />
  );
}

export function MajorsApp({
  initialAsset = "btc",
  initialSnapshotId = null,
  initialSource = null,
  initialAttributionId = null,
  revenueCoreMode = "off"
}: {
  initialAsset?: MajorAssetId;
  initialSnapshotId?: string | null;
  initialSource?: "home" | "alert" | null;
  initialAttributionId?: string | null;
  revenueCoreMode?: PerpetualRevenueCoreMode;
}) {
  const [activeAssetId, setActiveAssetId] = useState<MajorAssetId>(initialAsset);
  const [initialContinuityAvailable, setInitialContinuityAvailable] = useState(true);
  const activeAsset = majorAssetOptions.find((asset) => asset.id === activeAssetId) ?? majorAssetOptions[0];
  const selectedSymbols = useMemo(
    () => [{ symbol: activeAsset.apiSymbol, label: activeAsset.detail }],
    [activeAsset.apiSymbol, activeAsset.detail]
  );
  const selectedOptionCurrencies = useMemo(() => [activeAsset.detail], [activeAsset.detail]);
  const handleAssetChange = useCallback((next: MajorAssetId) => {
    setInitialContinuityAvailable(false);
    setActiveAssetId(next);
    const url = new URL(window.location.href);
    url.searchParams.set("asset", next);
    url.searchParams.set("timeframe", "15m");
    url.searchParams.delete("symbol");
    url.searchParams.delete("exchange");
    url.searchParams.delete("snapshot");
    url.searchParams.delete("source");
    url.searchParams.delete("attribution");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  return (
    <main className="min-h-screen max-w-full overflow-x-hidden px-3 pb-28 sm:px-5 sm:pb-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 sm:gap-3">
        <Header market="crypto" />
        <RadarTopNav />
        <CoinFuturesSwitch active={activeAssetId} onAssetChange={handleAssetChange} />
        {revenueCoreMode === "on" ? (
          <PerpetualDecisionExperience
            key={activeAssetId}
            asset={activeAssetId}
            requestedSnapshotId={initialContinuityAvailable && activeAssetId === initialAsset ? initialSnapshotId : null}
            source={initialContinuityAvailable && activeAssetId === initialAsset ? initialSource : null}
            attributionId={initialContinuityAvailable && activeAssetId === initialAsset ? initialAttributionId : null}
          />
        ) : revenueCoreMode === "shadow" ? (
          <ShadowPerpetualCanaryGate
            asset={activeAssetId}
            selectedSymbols={selectedSymbols}
            requestedSnapshotId={initialContinuityAvailable && activeAssetId === initialAsset ? initialSnapshotId : null}
            source={initialContinuityAvailable && activeAssetId === initialAsset ? initialSource : null}
            attributionId={initialContinuityAvailable && activeAssetId === initialAsset ? initialAttributionId : null}
          />
        ) : (
          <CoinFuturesBrief mode="major" symbols={selectedSymbols} />
        )}

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
