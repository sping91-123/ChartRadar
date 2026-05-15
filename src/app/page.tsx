// 첫 진입에서 코인과 글로벌 시장 레이더를 분리해 선택하는 홈 화면입니다.
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Coins, LineChart, ShieldCheck, TrendingUp } from "lucide-react";

const marketEntries = [
  {
    title: "코인 레이더",
    href: "/majors",
    label: "BTC, ETH, 알트코인",
    description: "실시간 구조, 청산 압력, 코인 뉴스와 알림을 코인 시장에 맞춰 확인합니다.",
    action: "코인 시장 열기",
    icon: Coins,
    metric: "24H 시장 구조",
    accent: "text-cyan-200",
    buttonClass: "bg-cyan-300 text-slate-950 hover:bg-cyan-200"
  },
  {
    title: "글로벌 레이더",
    href: "/global",
    label: "미국주식, 해외선물, ETF",
    description: "매크로 일정, 주요 지수, 종목 흐름과 기술지표를 글로벌 시장 기준으로 점검합니다.",
    action: "글로벌 시장 열기",
    icon: TrendingUp,
    metric: "Macro Watch",
    accent: "text-emerald-200",
    buttonClass: "bg-emerald-300 text-slate-950 hover:bg-emerald-200"
  }
] as const;

export default function Home() {
  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl flex-col justify-center">
        <section className="enterprise-panel overflow-hidden rounded-2xl p-5 sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
            <div>
              <div className="flex items-center gap-3">
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
                <div>
                  <p className="text-xs font-black tracking-[0.24em] text-cyan-300">MARKET INTELLIGENCE</p>
                  <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl">Chart Radar</h1>
                </div>
              </div>
              <p className="mt-6 max-w-xl text-lg font-semibold leading-8 text-slate-100 [word-break:keep-all]">
                오늘 볼 시장을 먼저 선택하세요. 코인과 글로벌 시장은 뉴스, 알림, 복기, 요금제를 분리해서 운영합니다.
              </p>
              <div className="mt-6 grid gap-3 text-sm text-slate-400 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
                  <LineChart size={17} className="text-cyan-300" aria-hidden />
                  <p className="mt-2 font-bold text-slate-200">시장별 판독</p>
                  <p className="mt-1 text-xs leading-5">코인과 글로벌을 다른 앱처럼 분리합니다.</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
                  <ShieldCheck size={17} className="text-cyan-300" aria-hidden />
                  <p className="mt-2 font-bold text-slate-200">위험 점검</p>
                  <p className="mt-1 text-xs leading-5">진입 전 구조와 변동성을 먼저 봅니다.</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
                  <ArrowRight size={17} className="text-cyan-300" aria-hidden />
                  <p className="mt-2 font-bold text-slate-200">빠른 루틴</p>
                  <p className="mt-1 text-xs leading-5">뉴스, 알림, 복기까지 이어집니다.</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {marketEntries.map(({ title, href, label, description, action, icon: Icon, metric, accent, buttonClass }) => (
                <Link
                  key={title}
                  href={href}
                  className="group relative min-h-[22rem] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition hover:-translate-y-0.5 hover:border-cyan-300/35 hover:bg-white/[0.055] hover:shadow-[0_22px_60px_rgba(0,0,0,0.22)] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                >
                  <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-cyan-300/10 to-transparent" aria-hidden />
                  <div className="relative flex h-full flex-col">
                    <div className="flex items-center justify-between gap-3">
                      <div className={`grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-slate-950/60 ${accent}`}>
                        <Icon size={22} aria-hidden />
                      </div>
                      <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[11px] font-black text-slate-300">
                        {metric}
                      </span>
                    </div>
                    <div className="mt-8">
                      <h2 className="text-2xl font-black tracking-tight text-white">{title}</h2>
                      <p className="mt-2 text-sm font-bold text-slate-300">{label}</p>
                      <p className="mt-5 text-sm leading-6 text-slate-400 [word-break:keep-all]">{description}</p>
                    </div>
                    <div className="mt-auto pt-8">
                      <div className={`enterprise-button inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-black transition ${buttonClass}`}>
                        {action}
                        <ArrowRight size={16} aria-hidden />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
