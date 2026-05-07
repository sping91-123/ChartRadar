import { BarChart2, Brain, Calculator, History, ScanSearch, ShieldAlert } from "lucide-react";
import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";
import { LiveMarketChart } from "@/components/LiveMarketChart";
import { SetupScoutPanel } from "@/components/SetupScoutPanel";
import { TabMenu } from "@/components/TabMenu";

function HeroSection() {
  return (
    <section className="rounded-lg border border-surface-line bg-surface-card px-5 py-6 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-widest text-accent-blue">
        Chart Radar Beta
      </p>
      <h2 className="mt-2 text-2xl font-black leading-snug text-white sm:text-3xl">
        진입 전 레이더를 돌려
        <br className="hidden sm:block" />
        <span className="text-accent-blue"> 차트 구조와 리스크를 먼저 감지합니다.</span>
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
        현재 베타버전은 코인 데이터를 우선 분석합니다. 추후 해외선물까지 확대할 계획이며,
        판독 중심은 ICT 구조에 과열, 변동성, 거래량 같은 보조 필터를 더한 분석입니다.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-md border border-surface-line bg-surface-cardSoft px-3 py-2 text-xs font-bold text-slate-300">
          <ScanSearch size={13} className="text-accent-blue" aria-hidden />
          코인 우선 지원
        </div>
        <div className="flex items-center gap-2 rounded-md border border-surface-line bg-surface-cardSoft px-3 py-2 text-xs font-bold text-slate-300">
          <Brain size={13} className="text-accent-blue" aria-hidden />
          ICT 구조 중심 판독
        </div>
        <div className="flex items-center gap-2 rounded-md border border-surface-line bg-surface-cardSoft px-3 py-2 text-xs font-bold text-slate-300">
          <BarChart2 size={13} className="text-accent-blue" aria-hidden />
          보조지표는 참고값
        </div>
      </div>
    </section>
  );
}

const workflowItems = [
  {
    icon: ScanSearch,
    title: "1. 레이더로 먼저 감지한다",
    body: "차트 레이더는 검토 후보와 관찰 대기를 나눕니다. 감지된 구조가 없으면 그것도 하나의 분석 결과입니다."
  },
  {
    icon: BarChart2,
    title: "2. ICT 구조 코어를 확인한다",
    body: "MSB, CHoCH, OB, FVG, Sweep, OTE, PD, POC를 먼저 보고 RSI·MACD는 보조 도구로 참고하세요."
  },
  {
    icon: Calculator,
    title: "3. 손절폭 기준으로 수량을 계산한다",
    body: "좋아 보이는 자리라도 손절폭 대비 수량과 레버리지가 맞지 않으면 검토에서 제외합니다."
  },
  {
    icon: History,
    title: "4. 들어간 이유와 결과를 남긴다",
    body: "레이더 저장과 복기를 연결해 어떤 조건에서 손실이 반복되는지 확인합니다."
  }
] as const;

function WorkflowSection() {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {workflowItems.map((item) => (
        <div key={item.title} className="rounded-lg border border-surface-line bg-surface-card p-4">
          <div className="grid h-9 w-9 place-items-center rounded-md border border-accent-blue/25 bg-accent-blue/10 text-accent-blue">
            <item.icon size={18} aria-hidden />
          </div>
          <h3 className="mt-3 text-sm font-bold text-white">{item.title}</h3>
          <p className="mt-2 text-xs leading-5 text-slate-400">{item.body}</p>
        </div>
      ))}
    </section>
  );
}

function BetaSafetyNotice() {
  return (
    <section className="rounded-lg border border-signal-warning/25 bg-signal-warning/10 p-4">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 shrink-0 text-signal-warning" size={19} aria-hidden />
        <div>
          <h2 className="text-sm font-black text-white">베타 사용 원칙</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            이 도구는 “들어가라”가 아니라 “왜 지금 들어가면 위험한지”를 먼저 보여주는 제품입니다.
            검토 조건이 좋아 보여도 손절가, 포지션 크기, 레버리지를 확인하지 않으면 실제 손실은 커질 수 있습니다.
          </p>
        </div>
      </div>
    </section>
  );
}

export function SurvivalApp() {
  return (
    <main className="min-h-screen px-4 pb-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <Header />
        <TabMenu />
        <HeroSection />
        <WorkflowSection />
        <BetaSafetyNotice />
        <SetupScoutPanel />
        <LiveMarketChart />
        <AppFooter />
      </div>
    </main>
  );
}
