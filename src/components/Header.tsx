import { HeaderActions } from "@/components/HeaderActions";
import { HeaderMarketSwitcher } from "@/components/HeaderMarketSwitcher";
import { AppSurface } from "@/components/ui/DesignPrimitives";

type HeaderMarket = "crypto" | "stocks";

export function Header({ market }: { market?: HeaderMarket } = {}) {
  const subtitle =
    market === "crypto"
      ? ""
      : market === "stocks"
        ? "미국장, 해외선물, ETF와 매크로 변화를 차분하게 점검하세요."
        : "차트 흐름과 시장 변화를 빠르게 확인하세요.";

  return (
    <header className="relative z-50 pt-0">
      <AppSurface
        as="div"
        tone="panel"
        variant="flat"
        padding="none"
        radius="none"
        className="flex min-h-12 items-center justify-between gap-2 px-1 py-2 sm:min-h-14 sm:gap-3 sm:px-0 sm:py-2.5"
      >
        <HeaderMarketSwitcher market={market} subtitle={subtitle} />
        <HeaderActions market={market} />
      </AppSurface>
    </header>
  );
}
