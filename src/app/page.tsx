// 첫 진입에서 코인 레이더와 글로벌 레이더를 선택하게 하는 홈 화면입니다.
import Image from "next/image";
import Link from "next/link";
import { Coins, TrendingUp } from "lucide-react";

const marketEntries = [
  {
    title: "코인 레이더",
    description: "오늘의 구조·위험·관망/추적 포인트를 빠르게 정리합니다.",
    scope: "BTC/ETH/알트코인",
    href: "/crypto",
    icon: Coins,
    accent: "text-cyan-200",
    glow: "from-cyan-300/16"
  },
  {
    title: "글로벌 레이더",
    description: "오늘의 구조·위험·관망/추적 포인트를 빠르게 정리합니다.",
    scope: "미국주식/ETF/해외선물",
    href: "/global",
    icon: TrendingUp,
    accent: "text-emerald-200",
    glow: "from-emerald-300/16"
  }
] as const;

export default function Home() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-6 sm:px-6 sm:py-8">
      <section className="enterprise-panel w-full max-w-5xl rounded-2xl p-5 sm:p-8 lg:p-10">
        <div className="flex flex-col items-center gap-9">
          <header className="flex w-full flex-col items-center gap-4 text-center">
            <div className="flex items-center justify-center gap-3">
              <div className="relative h-14 w-14 overflow-hidden rounded-2xl border border-cyan-300/20 bg-slate-950 shadow-[0_0_34px_rgba(34,211,238,0.18)]">
                <Image
                  src="/brand/chart-radar-mark.png"
                  alt=""
                  width={56}
                  height={56}
                  priority
                  className="h-full w-full object-cover"
                  draggable={false}
                />
              </div>
              <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Chart Radar</h1>
            </div>

            <p className="max-w-2xl text-sm font-semibold leading-relaxed text-slate-200 sm:text-base">
              차트를 오래 보지 않아도 오늘의 구조·위험·관망/추적 포인트를 빠르게 정리합니다.
            </p>
          </header>

          <div className="grid w-full gap-4 md:grid-cols-2">
            {marketEntries.map(({ title, description, scope, href, icon: Icon, accent, glow }) => (
              <Link
                key={title}
                href={href}
                className="group relative grid min-h-[14rem] place-items-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] p-6 text-center transition hover:-translate-y-0.5 hover:border-cyan-300/35 hover:bg-white/[0.055] hover:shadow-[0_22px_60px_rgba(0,0,0,0.22)] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 sm:min-h-[16rem]"
              >
                <div className={`absolute inset-x-0 top-0 h-28 bg-gradient-to-b ${glow} to-transparent`} aria-hidden />
                <div className="relative flex flex-col items-center gap-4">
                  <div className={`grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-slate-950/60 ${accent}`}>
                    <Icon size={30} aria-hidden />
                  </div>
                  <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">{title}</h2>
                  <p className="max-w-xs text-sm font-semibold leading-relaxed text-slate-200">{description}</p>
                  <p className="text-xs font-bold text-slate-400">대상. {scope}</p>
                </div>
              </Link>
            ))}
          </div>

          <p className="text-center text-xs font-bold text-slate-400">
            코인. BTC/ETH/알트코인 · 글로벌. 미국주식/ETF/해외선물
          </p>
        </div>
      </section>
    </main>
  );
}
