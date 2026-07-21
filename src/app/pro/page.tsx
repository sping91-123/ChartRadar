// Chart Radar Pro 결제 모델과 구독 플랜을 보여주는 페이지입니다.
import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";
import { ProPricingPanel } from "@/components/ProPricingPanel";
import { RadarTopNav } from "@/components/RadarTopNav";
import type { BillingPageScope } from "@/lib/billing";
import { isNewsImpactUiEnabled, newsImpactMode } from "@/lib/server/newsImpactMode";

function normalizeBillingScope(market: string | undefined): BillingPageScope {
  if (market === "crypto" || market === "coin") return "crypto";
  if (market === "stocks" || market === "stock" || market === "global") return "stocks";
  return "all";
}

function normalizeAttributionSource(source: string | undefined) {
  return source && /^[a-z0-9_-]{1,60}$/i.test(source) ? source : null;
}

export default async function ProPage({ searchParams }: { searchParams: Promise<{ market?: string | string[]; source?: string | string[] }> }) {
  const { market, source } = await searchParams;
  const marketScope = normalizeBillingScope(Array.isArray(market) ? market[0] : market);
  const attributionSource = normalizeAttributionSource(Array.isArray(source) ? source[0] : source);
  const navMarket = marketScope === "stocks" ? "stocks" : marketScope === "crypto" ? "crypto" : "all";
  const headerMarket = marketScope === "stocks" ? "stocks" : marketScope === "crypto" ? "crypto" : undefined;

  return (
    <main className="min-h-full px-3 pb-[calc(3rem+env(safe-area-inset-bottom))] sm:px-5">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-5">
        <Header market={headerMarket} />
        <RadarTopNav market={navMarket} newsImpactEnabled={isNewsImpactUiEnabled(newsImpactMode())} />
        <ProPricingPanel marketScope={marketScope} attributionSource={attributionSource} />
        <AppFooter />
      </div>
    </main>
  );
}
