import { HeaderActions } from "@/components/HeaderActions";
import { HeaderMarketSwitcher } from "@/components/HeaderMarketSwitcher";
import { AppSurface } from "@/components/ui/DesignPrimitives";

type HeaderMarket = "crypto" | "stocks";

export function Header({ market }: { market?: HeaderMarket } = {}) {
  const subtitle =
    market === "crypto"
      ? "코인 시장의 구조, 변동성, 주요 이벤트를 한 화면에서 확인하세요."
      : market === "stocks"
        ? "미국주식, 해외선물, ETF와 매크로 변화를 차분하게 점검하세요."
        : "차트 흐름과 시장 변화를 빠르게 확인하세요.";

  return (
    <header className="relative z-50 pt-2 sm:pt-4">
      <AppSurface as="div" tone="panel" variant="flat" padding="none" radius="none" className="flex items-center justify-between gap-2 border-b border-ui-line px-1 py-2 sm:gap-4 sm:px-0 sm:py-3">
        <HeaderMarketSwitcher market={market} subtitle={subtitle} />
        <HeaderActions market={market} />
      </AppSurface>
    </header>
  );
}
