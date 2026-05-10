// 차트 레이더의 코인과 해외주식 진입 경로를 분리해서 보여준다.
import Link from "next/link";
import { BarChart3, BellRing, Coins, Radar, TrendingUp } from "lucide-react";
import { AppFooter } from "@/components/AppFooter";
import { DailyRadarBrief } from "@/components/DailyRadarBrief";
import { Header } from "@/components/Header";
import { MacroTicker } from "@/components/MacroTicker";
import { RadarTopNav } from "@/components/RadarTopNav";
import { UsageMeterPanel } from "@/components/UsageMeterPanel";

const entryCards = [
  {
    title: "코인 레이더",
    href: "/survival",
    icon: Radar,
    eyebrow: "Crypto Radar",
    description: "BTC와 ETH를 먼저 보고, 알트코인은 별도 화면에서 넓게 탐색합니다.",
    points: ["Binance USDT-M 데이터", "ICT 구조 + 기술지표", "5m부터 1d까지"]
  },
  {
    title: "해외주식 레이더",
    href: "/stocks",
    icon: TrendingUp,
    eyebrow: "Global Stocks",
    description: "미국 주요 주식과 ETF를 기술지표 중심으로 확인합니다.",
    points: ["SPY, QQQ, NVDA, AAPL", "ETF와 빅테크", "지연 데이터"]
  }
] as const;

export default function Home() {
  return (
    <main className="min-h-screen px-4 pb-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <Header />
        <RadarTopNav />
        <MacroTicker />
        <DailyRadarBrief />
        <UsageMeterPanel compact />

        <section className="rounded-lg border border-accent-blue/25 bg-surface-card p-5 shadow-glow sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-accent-blue">Chart Radar</p>
              <h1 className="mt-3 text-3xl font-black text-white sm:text-4xl">어떤 시장을 먼저 볼까요?</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                차트 레이더는 코인에서 시작해 해외주식까지 확장하는 분석 앱입니다. 시장을 섞지 않고, 진입 경로부터 분리해서 더 빠르게 확인할 수 있게 만들었습니다.
              </p>
            </div>
            <Link
              href="/alerts"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-surface-line bg-surface-cardSoft px-4 text-sm font-black text-slate-200 transition hover:border-accent-blue/60 hover:text-white"
            >
              <BellRing size={16} aria-hidden />
              알림 조건 켜기
            </Link>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {entryCards.map(({ title, href, icon: Icon, eyebrow, description, points }) => (
              <Link
                key={title}
                href={href}
                className="group rounded-lg border border-surface-line bg-surface-cardSoft p-5 transition hover:-translate-y-0.5 hover:border-accent-blue/60 hover:shadow-[0_18px_44px_rgba(56,189,248,0.12)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="grid h-12 w-12 place-items-center rounded-lg border border-accent-blue/30 bg-accent-blue/15 text-accent-blue">
                    <Icon size={24} aria-hidden />
                  </div>
                  <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-[11px] font-black text-slate-400">
                    열기
                  </span>
                </div>
                <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-accent-blue">{eyebrow}</p>
                <h2 className="mt-2 text-2xl font-black text-white">{title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>
                <div className="mt-5 grid gap-2">
                  {points.map((point) => (
                    <span key={point} className="inline-flex items-center gap-2 text-xs font-bold text-slate-300">
                      <BarChart3 size={13} className="text-accent-blue" aria-hidden />
                      {point}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="flex items-start gap-3">
              <Coins className="mt-0.5 shrink-0 text-accent-blue" size={18} aria-hidden />
              <p className="text-xs leading-5 text-slate-500">
                코인은 바이낸스에서 거래 중인 주요 종목을 자동으로 불러옵니다. 해외주식은 주요 미국 종목과 ETF부터 제공하며, 정식 실시간 데이터 계약 전까지 지연될 수 있습니다.
              </p>
            </div>
          </div>
        </section>

        <AppFooter />
      </div>
    </main>
  );
}
