// 전체 화면 상단에서 Chart Radar 브랜드와 계정 상태를 보여주는 헤더입니다.
import Link from "next/link";
import { HeaderActions } from "@/components/HeaderActions";
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
        <Link href="/" className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3" aria-label="Chart Radar 홈으로 이동">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-ui-sm border border-ui-line bg-ui-panel text-sm font-semibold text-ui-brand sm:h-9 sm:w-9">
            C
          </div>
          <div className="min-w-0">
            <h1 className="whitespace-nowrap text-[15px] font-semibold leading-tight tracking-tight text-ui-text min-[360px]:text-base sm:text-xl">
              <span className="sm:hidden">ChartRadar</span>
              <span className="hidden sm:inline">Chart Radar</span>
            </h1>
            <p className="mt-0.5 hidden max-w-[34rem] text-xs leading-5 text-ui-muted sm:block">{subtitle}</p>
          </div>
        </Link>
        <HeaderActions market={market} />
      </AppSurface>
    </header>
  );
}
