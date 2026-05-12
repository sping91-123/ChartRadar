// 앱 전체 상단에서 Chart Radar 브랜드와 상태 버튼을 보여준다.
import Link from "next/link";
import Image from "next/image";
import { AuthStatus } from "@/components/AuthStatus";
import { ThemeToggle } from "@/components/ThemeToggle";

type HeaderMarket = "crypto" | "stocks";

export function Header({ market }: { market?: HeaderMarket } = {}) {
  const proHref = market === "crypto" ? "/pro?market=crypto" : market === "stocks" ? "/pro?market=global" : "/pro";

  return (
    <header className="space-y-4 pt-6">
      <div className="flex items-center justify-between gap-4">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[1.05rem] border border-cyan-300/25 bg-slate-950 shadow-[0_0_30px_rgba(6,182,212,0.24)]">
            <Image
              src="/brand/chart-radar-mark.png"
              alt=""
              width={48}
              height={48}
              priority
              className="h-full w-full object-cover"
              draggable={false}
            />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-black tracking-normal text-white sm:text-2xl">Chart Radar</h1>
            <p className="mt-1 text-sm leading-6 text-slate-400">코인과 글로벌 시장의 차트 흐름을 빠르게 감지하세요.</p>
          </div>
        </Link>
        <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
          <span className="rounded-md border border-cyan-300/30 bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold text-cyan-300">
            Official
          </span>
          <Link
            href={proHref}
            className="rounded-md border border-cyan-300/30 bg-cyan-300 px-2.5 py-1 text-xs font-black text-slate-950 transition hover:bg-cyan-200"
          >
            Pro
          </Link>
          <ThemeToggle />
          <AuthStatus />
        </div>
      </div>
    </header>
  );
}
