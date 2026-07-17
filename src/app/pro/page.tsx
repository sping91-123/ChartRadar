// Chart Radar Pro 결제 모델과 구독 플랜을 보여주는 페이지입니다.
import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";
import { ProPricingPanel } from "@/components/ProPricingPanel";
import { RadarTopNav } from "@/components/RadarTopNav";
import type { BillingPageScope } from "@/lib/billing";

function normalizeBillingScope(market: string | undefined): BillingPageScope {
  if (market === "crypto" || market === "coin") return "crypto";
  if (market === "stocks" || market === "stock" || market === "global") return "stocks";
  return "all";
}

export default async function ProPage({ searchParams }: { searchParams: Promise<{ market?: string | string[] }> }) {
  const { market } = await searchParams;
  const marketScope = normalizeBillingScope(Array.isArray(market) ? market[0] : market);
  const navMarket = marketScope === "stocks" ? "stocks" : marketScope === "crypto" ? "crypto" : "all";
  const headerMarket = marketScope === "stocks" ? "stocks" : marketScope === "crypto" ? "crypto" : undefined;

  return (
    <main className="min-h-full px-3 pb-[calc(3rem+env(safe-area-inset-bottom))] sm:px-5">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-5">
        <Header market={headerMarket} />
        <RadarTopNav market={navMarket} />
        <ProPricingPanel marketScope={marketScope} />
        <AppFooter />
      </div>
    </main>
  );
}
