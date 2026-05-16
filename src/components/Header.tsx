// 전체 화면 상단에서 Chart Radar 브랜드와 계정 상태를 보여주는 헤더입니다.
import Image from "next/image";
import Link from "next/link";
import { HeaderActions } from "@/components/HeaderActions";

type HeaderMarket = "crypto" | "stocks";

export function Header({ market }: { market?: HeaderMarket } = {}) {
  const subtitle =
    market === "crypto"
      ? "코인 시장의 구조, 변동성, 주요 이벤트를 한 화면에서 확인하세요."
      : market === "stocks"
        ? "미국주식, 해외선물, ETF와 매크로 변화를 차분하게 점검하세요."
        : "차트 흐름과 시장 변화를 빠르게 확인하세요.";

  return (
    <header className="relative z-50 pt-5">
      <div className="flex items-center justify-between gap-4 rounded-xl border border-surface-line bg-surface-card/80 px-3 py-3 backdrop-blur sm:px-4">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-cyan-300/20 bg-slate-950 shadow-[0_0_24px_rgba(6,182,212,0.18)] sm:h-11 sm:w-11">
            <Image
              src="/brand/chart-radar-mark.png"
              alt=""
              width={44}
              height={44}
              priority
              className="h-full w-full object-cover"
              draggable={false}
            />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-black tracking-tight text-white sm:text-xl">Chart Radar</h1>
            <p className="mt-0.5 hidden text-xs leading-5 text-slate-400 sm:block">{subtitle}</p>
          </div>
        </Link>
        <HeaderActions market={market} />
      </div>
    </header>
  );
}
