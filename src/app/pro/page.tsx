// Chart Radar Pro 결제 모델과 구독 플랜을 보여주는 페이지입니다.
import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";
import { ProPricingPanel } from "@/components/ProPricingPanel";
import { RadarTopNav } from "@/components/RadarTopNav";
import { safeReturnTo } from "@/lib/authRedirect";
import type { BillingPageScope } from "@/lib/billing";
import {
  normalizeCoinProPlacement,
  normalizeCoinProRouteKey,
  normalizeCoinProSource,
  normalizeCoinSymbol,
  returnToFromRouteKey,
  routeKeyFromReturnTo
} from "@/lib/coinProConversion";
import { isNewsImpactUiEnabled, newsImpactMode } from "@/lib/server/newsImpactMode";

function normalizeBillingScope(market: string | undefined): BillingPageScope {
  if (market === "crypto" || market === "coin") return "crypto";
  if (market === "stocks" || market === "stock" || market === "global") return "stocks";
  return "all";
}

export default async function ProPage({ searchParams }: { searchParams: Promise<{
  market?: string | string[];
  source?: string | string[];
  placement?: string | string[];
  route?: string | string[];
  returnTo?: string | string[];
  symbol?: string | string[];
  funnel?: string | string[];
}> }) {
  const { market, source, placement, route, returnTo: rawReturnTo, symbol, funnel } = await searchParams;
  const marketScope = normalizeBillingScope(Array.isArray(market) ? market[0] : market);
  const attributionSource = normalizeCoinProSource(Array.isArray(source) ? source[0] : source);
  const attributionPlacement = normalizeCoinProPlacement(Array.isArray(placement) ? placement[0] : placement);
  const rawRoute = Array.isArray(route) ? route[0] : route;
  const rawReturn = Array.isArray(rawReturnTo) ? rawReturnTo[0] : rawReturnTo;
  const routeKey = rawRoute ? normalizeCoinProRouteKey(rawRoute) : routeKeyFromReturnTo(rawReturn);
  const fallbackReturnTo = marketScope === "stocks"
    ? "/global"
    : marketScope === "crypto"
      ? returnToFromRouteKey(routeKey)
      : "/";
  const returnTo = safeReturnTo(rawReturn, fallbackReturnTo);
  const attributionSymbol = normalizeCoinSymbol(Array.isArray(symbol) ? symbol[0] : symbol);
  const rawFunnel = Array.isArray(funnel) ? funnel[0] : funnel;
  const incomingFunnelSessionId = rawFunnel && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawFunnel)
    ? rawFunnel
    : null;
  const navMarket = marketScope === "stocks" ? "stocks" : marketScope === "crypto" ? "crypto" : "all";
  const headerMarket = marketScope === "stocks" ? "stocks" : marketScope === "crypto" ? "crypto" : undefined;

  return (
    <main className="min-h-full px-3 pb-[calc(3rem+env(safe-area-inset-bottom))] sm:px-5">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-5">
        <Header market={headerMarket} />
        <RadarTopNav market={navMarket} newsImpactEnabled={isNewsImpactUiEnabled(newsImpactMode())} />
        <ProPricingPanel
          marketScope={marketScope}
          attributionSource={attributionSource}
          attributionPlacement={attributionPlacement}
          routeKey={routeKey}
          symbol={attributionSymbol}
          incomingFunnelSessionId={incomingFunnelSessionId}
          returnTo={returnTo}
        />
        <AppFooter />
      </div>
    </main>
  );
}
