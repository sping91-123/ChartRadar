// 글로벌 레이더 페이지를 렌더링한다.
import Link from "next/link";
import { BellRing, Clock3, Newspaper, ShieldCheck } from "lucide-react";
import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";
import { MacroTicker } from "@/components/MacroTicker";
import { RadarAlertCenter } from "@/components/RadarAlertCenter";
import { RadarNewsPanel } from "@/components/RadarNewsPanel";
import { RadarTopNav } from "@/components/RadarTopNav";
import { StockRadarApp } from "@/components/StockRadarApp";

const globalRoutineCards = [
  {
    icon: Clock3,
    title: "장전 5분 루틴",
    body: "매크로 일정, 프리마켓 흐름, 오늘 먼저 볼 ETF와 종목을 한 번에 정리합니다."
  },
  {
    icon: ShieldCheck,
    title: "장중 기준선 점검",
    body: "현재가가 지지·저항과 얼마나 가까운지 보고 추격보다 기다릴 구간을 먼저 잡습니다."
  },
  {
    icon: Newspaper,
    title: "뉴스 영향 정리",
    body: "영어권 뉴스와 매크로 이슈를 한국어로 다시 묶어 오늘 시장에 미칠 영향을 확인합니다."
  },
  {
    icon: BellRing,
    title: "관심 자산 알림",
    body: "저장한 조건과 관심 자산 변화가 다시 맞아떨어질 때 놓치지 않도록 알림 흐름을 관리합니다."
  }
];

function GlobalProRoutine() {
  return (
    <section className="rounded-lg border border-cyan-300/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_36%),rgba(15,23,42,0.72)] p-4 shadow-glow sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
            Global Radar Workflow
          </p>
          <h2 className="mt-2 text-2xl font-black text-white">
            글로벌 레이더 사용 루틴.
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400 [word-break:keep-all]">
            장전, 장중, 마감 후에 무엇을 확인해야 하는지 줄여주는 화면입니다.
            오늘 볼 시장, 뉴스 영향, 기준선, 알림까지 한 흐름으로 이어집니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/alerts?market=global"
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-cyan-300/25 bg-cyan-300/10 px-3 text-xs font-black text-cyan-200 transition hover:bg-cyan-300 hover:text-slate-950"
          >
            글로벌 알림 설정
          </Link>
          <Link
            href="/pro?market=stocks"
            className="inline-flex min-h-10 items-center justify-center rounded-md bg-cyan-300 px-3 text-xs font-black text-slate-950 transition hover:bg-cyan-200"
          >
            글로벌 Pro 보기
          </Link>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {globalRoutineCards.map(({ icon: Icon, title, body }) => (
          <article key={title} className="rounded-lg border border-white/10 bg-black/25 p-4">
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
    <main className="min-h-screen px-4 pb-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <Header market="stocks" />
        <RadarTopNav />
        <MacroTicker compact market="stocks" />
        <StockRadarApp />
        <GlobalProRoutine />
        <RadarNewsPanel market="stocks" />
        <RadarAlertCenter compact market="stocks" />
        <AppFooter />
      </div>
    </main>
  );
}
