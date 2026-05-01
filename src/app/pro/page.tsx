import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Crown,
  FileCheck2,
  LockKeyhole,
  ShieldAlert,
  Sparkles
} from "lucide-react";
import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";
import { TabMenu } from "@/components/TabMenu";

const proBenefits = [
  {
    title: "무제한 차트 판독",
    description: "무료판의 하루 판독권 제한 없이 코인과 타임프레임 조합을 계속 바꿔가며 확인합니다."
  },
  {
    title: "PRO 매매계획서",
    description: "롱/숏 우세만 보여주는 것이 아니라 관찰 구간, 무효화 기준, 목표 후보, 손익비를 한 장으로 정리합니다."
  },
  {
    title: "원칙 위반 차단",
    description: "추격 진입, 프리미엄 롱, 디스카운트 숏, 상위 추세 역행 같은 위험 신호를 매매 전에 먼저 막습니다."
  },
  {
    title: "복기까지 연결",
    description: "진입 전 판독과 실제 결과를 비교해서 기법 문제가 아니라 리스크 문제였는지 남길 수 있게 설계합니다."
  }
];

const comparisonRows = [
  ["실시간 차트", "BTCUSDT.P 외 주요 코인", "동일"],
  ["기본 판독", "롱/숏 우세, MSB/CHoCH, OB/FVG, 위험 신호", "동일"],
  ["사용량", "하루 5개 새 조합", "무제한"],
  ["진입/손절/익절 후보", "미리보기 또는 제한", "전체 제공"],
  ["손익비", "계산기에서 직접 입력", "판독 기준으로 자동 예시"],
  ["복기 연결", "수동 기록", "판독값과 계획서 저장 구조"]
];

export default function ProPage() {
  return (
    <main className="min-h-screen px-4 pb-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <Header />
        <TabMenu />

        <section className="overflow-hidden rounded-lg border border-accent-blue/25 bg-surface-card shadow-glow">
          <div className="border-b border-surface-line bg-accent-blue/10 p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-md border border-accent-blue/30 bg-black/20 px-3 py-1 text-xs font-bold text-accent-blue">
                  <Crown size={14} aria-hidden />
                  PRO 설계안
                </div>
                <h2 className="mt-4 text-2xl font-black tracking-normal text-white sm:text-3xl">
                  돈 내고 쓰고 싶은 수준의 매매 계획서
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-300 sm:text-base">
                  무료판은 “지금 롱/숏이 더 유리한가”를 빠르게 보여주고, PRO는 그 판독을 실제 매매 전에
                  확인할 수 있는 관찰 구간, 무효화 기준, 목표 후보, 손익비, 복기 기록으로 확장합니다.
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/25 p-4 text-right">
                <p className="text-xs font-semibold text-slate-500">목표 가격</p>
                <p className="mt-1 text-2xl font-black text-white">월 20,000원</p>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  결제 기능은 아직 열지 않고, 상품 구조와 사용 가치를 먼저 검증합니다.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Link
                href="/survival"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent-blue px-4 text-sm font-black text-slate-950 hover:bg-sky-300"
              >
                무료 판독 해보기
                <ArrowRight size={16} aria-hidden />
              </Link>
              <Link
                href="/calculator"
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-surface-line bg-black/20 px-4 text-sm font-bold text-slate-200 hover:border-accent-blue/60 hover:text-white"
              >
                손익비 계산 보기
              </Link>
            </div>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
            {proBenefits.map((item) => (
              <div key={item.title} className="rounded-lg border border-surface-line bg-surface-cardSoft p-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-accent-blue/25 bg-accent-blue/10 text-accent-blue">
                    <CheckCircle2 size={18} aria-hidden />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-surface-line bg-surface-card p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-accent-blue/25 bg-accent-blue/10 text-accent-blue">
              <FileCheck2 size={20} aria-hidden />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">무료판과 PRO의 차이</h2>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                무료판은 방향 판독과 위험 회피에 집중하고, PRO는 매매 실행 전 체크리스트까지 확장합니다.
              </p>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-lg border border-surface-line">
            <div className="grid grid-cols-[0.8fr_1fr_1fr] bg-black/30 px-3 py-3 text-xs font-bold text-slate-400">
              <span>항목</span>
              <span>무료</span>
              <span>PRO</span>
            </div>
            {comparisonRows.map(([label, free, pro]) => (
              <div
                key={label}
                className="grid grid-cols-[0.8fr_1fr_1fr] border-t border-surface-line px-3 py-3 text-sm leading-6 text-slate-300"
              >
                <span className="font-bold text-white">{label}</span>
                <span>{free}</span>
                <span className="font-semibold text-accent-blue">{pro}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-[1fr_0.9fr]">
          <div className="rounded-lg border border-signal-success/25 bg-signal-success/10 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 shrink-0 text-signal-success" size={20} aria-hidden />
              <div>
                <h2 className="text-lg font-bold text-white">20,000원을 받으려면 더 강해야 하는 부분</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  단순 추천은 오래 못 갑니다. 사용자가 돈을 내는 지점은 “내가 왜 들어가면 안 되는지”와
                  “들어간다면 어디가 무효화인지”를 빠르게 정리해주는 데 있습니다. 그래서 최종판은 차트
                  판독, 계산, 복기, 학습이 한 흐름으로 이어지게 설계했습니다.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-signal-warning/25 bg-signal-warning/10 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <LockKeyhole className="mt-0.5 shrink-0 text-signal-warning" size={20} aria-hidden />
              <div>
                <h2 className="text-lg font-bold text-white">결제는 아직 잠금</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  실제 결제, 로그인, 저장 DB는 다음 단계입니다. 지금 공개판은 상품 가치를 검증하기 위한
                  프론트엔드 MVP로 두고, 유료 기능은 잠금 상태로 보여줍니다.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-surface-line bg-surface-card p-4 text-sm leading-6 text-slate-400 sm:p-5">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 shrink-0 text-accent-blue" size={18} aria-hidden />
            <p>
              PRO 화면은 상품 구조 안내용입니다. 이 앱은 투자 조언, 매수·매도 신호, 수익률 예측을 제공하지
              않으며, 모든 판단과 책임은 사용자 본인에게 있습니다.
            </p>
          </div>
        </section>

        <AppFooter />
      </div>
    </main>
  );
}
