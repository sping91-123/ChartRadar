// Chart Radar에서 사용하는 주요 지표와 구조 판독 기준을 안내합니다.
import type { Metadata } from "next";
import Link from "next/link";
import { Activity, ArrowLeft, BarChart3, BookOpen, Layers, ShieldAlert, Waves } from "lucide-react";
import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "지표 안내",
  description: "Chart Radar 주요 지표와 구조 판독 기준 안내"
};

const guideSections = [
  {
    title: "추세와 평균",
    icon: Activity,
    items: [
      {
        name: "EMA",
        body: "최근 가격에 더 높은 비중을 두는 이동평균입니다. 가격이 EMA 위에 오래 머물수록 상승 추세 유지 가능성을, 아래에 머물수록 하락 압력을 봅니다."
      },
      {
        name: "Supertrend",
        body: "추세 방향과 변동성을 함께 보는 지표입니다. 방향 확인에는 유용하지만 횡보장에서는 신호가 잦게 바뀔 수 있습니다."
      }
    ]
  },
  {
    title: "모멘텀",
    icon: Waves,
    items: [
      {
        name: "RSI",
        body: "상승과 하락 압력의 상대 강도를 봅니다. 과매수와 과매도 자체보다, 가격 구조와 함께 모멘텀이 꺾이는지를 확인하는 용도로 씁니다."
      },
      {
        name: "MACD",
        body: "빠른 평균과 느린 평균의 차이를 통해 추세 전환과 힘의 변화를 봅니다. 늦게 반응할 수 있어 단독 진입 기준으로 쓰지 않습니다."
      }
    ]
  },
  {
    title: "거래량과 가격대",
    icon: BarChart3,
    items: [
      {
        name: "POC",
        body: "선택 구간에서 거래가 가장 많이 쌓인 가격대입니다. 가격이 POC 위인지 아래인지에 따라 시장의 중심 가격 회복 여부를 확인합니다."
      },
      {
        name: "VAH / VAL",
        body: "거래가 많이 몰린 가치 영역의 위쪽과 아래쪽 경계입니다. 이탈과 재진입은 추세 지속 또는 평균 회귀를 판단할 때 참고합니다."
      }
    ]
  },
  {
    title: "ICT 구조",
    icon: Layers,
    items: [
      {
        name: "MSB / CHoCH",
        body: "고점과 저점의 깨짐을 통해 시장 구조가 이어지는지, 성격이 바뀌는지를 봅니다. 큰 타임프레임 기준과 함께 확인해야 합니다."
      },
      {
        name: "OB / FVG / OTE",
        body: "주문블록, 비효율 구간, 되돌림 영역을 뜻합니다. Chart Radar는 이 값들을 진입 확정이 아니라 대기 구간과 리스크 확인 기준으로 표시합니다."
      }
    ]
  }
];

export default function LearnPage() {
  return (
    <main className="min-h-screen px-4 pb-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <Header />
        <Link href="/" className="inline-flex w-fit items-center gap-2 text-sm font-bold text-slate-400 hover:text-white">
          <ArrowLeft size={16} aria-hidden />
          홈으로 돌아가기
        </Link>

        <section className="enterprise-panel p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200">
              <BookOpen size={20} aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">지표 안내</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                Chart Radar가 화면에서 보여주는 주요 지표의 의미를 정리합니다. 지표는 방향을 단정하기보다, 구조와 리스크를
                확인하는 보조 기준입니다.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {guideSections.map(({ title, icon: Icon, items }) => (
              <section key={title} className="rounded-xl border border-surface-line bg-surface-cardSoft p-4">
                <div className="flex items-center gap-2">
                  <Icon className="text-cyan-300" size={18} aria-hidden />
                  <h2 className="text-base font-black text-white">{title}</h2>
                </div>
                <div className="mt-4 grid gap-3">
                  {items.map((item) => (
                    <article key={item.name} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                      <h3 className="text-sm font-black text-cyan-100">{item.name}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-400 [word-break:keep-all]">{item.body}</p>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-signal-warning/25 bg-signal-warning/10 p-4 text-sm leading-6 text-signal-warning">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 shrink-0" size={18} aria-hidden />
            <p>
              지표가 여러 개 같은 방향을 가리켜도 실제 진입 전에는 손절 기준, 포지션 크기, 발표 일정, 거래량을 따로 확인해야 합니다.
            </p>
          </div>
        </section>

        <AppFooter />
      </div>
    </main>
  );
}
