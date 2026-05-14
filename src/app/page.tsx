// 첫 진입에서 코인과 글로벌 시장을 분리해 선택하게 하는 게이트 화면.
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Coins, TrendingUp } from "lucide-react";

const marketEntries = [
  {
    title: "코인 레이더",
    href: "/survival",
    label: "BTC · ETH · 알트코인",
    action: "코인 레이더 열기",
    icon: Coins,
    accent: "from-cyan-300/22 via-blue-500/12 to-transparent",
    iconClass: "border-cyan-300/35 bg-cyan-300/12 text-cyan-200",
    buttonClass: "bg-cyan-300 text-slate-950 group-hover:bg-cyan-200"
  },
  {
    title: "글로벌 레이더",
    href: "/global",
    label: "미국주식 · 해외선물 · ETF",
    action: "글로벌 레이더 열기",
    icon: TrendingUp,
    accent: "from-emerald-300/20 via-sky-400/10 to-transparent",
    iconClass: "border-emerald-300/35 bg-emerald-300/12 text-emerald-200",
    buttonClass: "bg-emerald-300 text-slate-950 group-hover:bg-emerald-200"
  }
] as const;

export default function Home() {
  return (
    <main className="min-h-screen px-3 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-4xl flex-col items-center justify-center gap-4">
        <section className="w-full rounded-lg border border-surface-line bg-surface-card/92 p-4 shadow-[0_26px_80px_rgba(0,0,0,0.30)] backdrop-blur sm:p-8">
          <div className="flex flex-col items-center text-center">
            <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-cyan-300/25 bg-slate-950 shadow-[0_0_44px_rgba(34,211,238,0.26)] sm:h-20 sm:w-20">
              <Image
                src="/brand/chart-radar-mark.png"
                alt=""
                width={80}
                height={80}
                priority
                className="h-full w-full object-cover"
                draggable={false}
              />
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-normal text-white sm:mt-5 sm:text-5xl">Chart Radar</h1>
            <p className="mt-2 text-sm font-bold text-slate-400 sm:mt-3 sm:text-base">오늘 먼저 확인할 시장을 선택하세요.</p>
            <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">
              뉴스와 알림, 복기 기록까지 시장별로 따로 관리됩니다.
            </p>
          </div>

          <div className="mx-auto mt-6 grid max-w-3xl grid-cols-2 gap-2 sm:mt-8 sm:gap-4">
            {marketEntries.map(({ title, href, label, action, icon: Icon, accent, iconClass, buttonClass }) => (
              <Link
                key={title}
                href={href}
                className="group relative min-h-[11.5rem] overflow-hidden rounded-lg border border-surface-line bg-surface-cardSoft p-3 text-center transition hover:-translate-y-0.5 hover:border-cyan-300/55 hover:shadow-[0_22px_54px_rgba(34,211,238,0.13)] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 sm:min-h-[13rem] sm:p-5"
              >
                <div className={`absolute inset-x-0 top-0 h-28 bg-gradient-to-b ${accent}`} aria-hidden />
                <div className="relative flex h-full flex-col items-center justify-between">
                  <div>
                    <div className={`mx-auto grid h-10 w-10 place-items-center rounded-lg border sm:h-12 sm:w-12 ${iconClass}`}>
                      <Icon size={22} aria-hidden />
                    </div>
                    <h2 className="mt-4 text-xl font-black text-white sm:mt-5 sm:text-3xl">{title}</h2>
                    <p className="mt-1.5 text-xs font-bold leading-5 text-slate-400 sm:mt-2 sm:text-sm">{label}</p>
                  </div>
                  <div className={`mt-5 inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-black transition sm:mt-7 sm:min-h-11 sm:gap-2 sm:px-4 sm:text-sm ${buttonClass}`}>
                    {action}
                    <ArrowRight size={15} aria-hidden />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
