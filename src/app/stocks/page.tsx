// 글로벌 레이더 페이지를 렌더링한다.
import { BarChart3, Clock3, LineChart, ShieldCheck } from "lucide-react";
import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";
import { MacroTicker } from "@/components/MacroTicker";
import { RadarTopNav } from "@/components/RadarTopNav";
import { StockRadarApp } from "@/components/StockRadarApp";

const globalRoutineCards = [
  {
    icon: Clock3,
    title: "장전 5분 루틴",
    body: "매크로 일정, 프리마켓 흐름, 오늘 먼저 볼 해외선물·ETF·종목을 한 번에 정리합니다."
  },
  {
    icon: ShieldCheck,
    title: "장중 기준선 점검",
    body: "현재가가 지지·저항과 얼마나 가까운지 보고 추격보다 기다릴 구간을 먼저 잡습니다."
  },
  {
    icon: BarChart3,
    title: "분석 방식 분리",
    body: "종합, ICT, 기술지표를 따로 확인해 원하는 기준만 보고 판단할 수 있습니다."
  },
  {
    icon: LineChart,
    title: "관심종목 고정",
    body: "매일 보는 지수, ETF, 해외선물, 개별 종목을 저장하고 바로 비교합니다."
  }
];

function GlobalProRoutine() {
  return (
    <section className="rounded-xl border border-surface-line bg-surface-card p-4 shadow-[0_18px_58px_rgba(0,0,0,0.18)] sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black tracking-[0.24em] text-cyan-300">
            글로벌 레이더 루틴
          </p>
          <h2 className="mt-2 text-2xl font-black text-white">
            글로벌 레이더 사용 루틴
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400 [word-break:keep-all]">
            장전, 장중, 마감 후에 무엇을 확인해야 하는지 줄여주는 화면입니다.
            오늘 볼 시장, 뉴스 영향, 기준선, 알림까지 한 흐름으로 이어집니다.
          </p>
        </div>
        <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/8 px-3 py-2 text-xs font-bold leading-5 text-cyan-100">
          뉴스와 알림은 상단 메뉴에서 따로 확인하고, 이 화면은 차트와 분석에 집중합니다.
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {globalRoutineCards.map(({ icon: Icon, title, body }) => (
          <article key={title} className="rounded-xl border border-white/10 bg-black/20 p-4">
            <Icon className="text-cyan-300" size={20} aria-hidden />
            <h3 className="mt-3 text-sm font-black text-white">{title}</h3>
            <p className="mt-2 text-xs leading-5 text-slate-400 [word-break:keep-all]">{body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function StocksPage() {
  return (
    <main className="min-h-screen px-3 pb-10 sm:px-5">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-5">
        <Header market="stocks" />
        <RadarTopNav />
        <MacroTicker compact market="stocks" />
        <StockRadarApp />
        <GlobalProRoutine />
        <AppFooter />
      </div>
    </main>
  );
}
