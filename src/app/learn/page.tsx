import { BookOpen, CheckCircle2 } from "lucide-react";
import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";
import { TabMenu } from "@/components/TabMenu";

const lessons = [
  {
    title: "MSB와 CHoCH",
    body: "MSB는 구조가 실제로 바뀐 큰 기준이고, CHoCH는 그보다 빠른 상태 변화 신호입니다. 둘이 같은 방향일수록 판단이 더 단순해집니다."
  },
  {
    title: "OB / BB / FVG",
    body: "OB와 FVG는 반응을 확인할 구간입니다. 가격이 그 안에 있다는 사실보다, 그 안에서 어떤 반응이 나오는지가 더 중요합니다."
  },
  {
    title: "프리미엄 / 디스카운트",
    body: "롱은 디스카운트에서 유리하고, 숏은 프리미엄에서 유리합니다. 반대 구간에서는 추격 위험을 먼저 의심합니다."
  },
  {
    title: "킬존",
    body: "코털스 기준 킬존은 뉴욕 시간 Asia 20:00-22:00, London 02:00-05:00, New York 07:00-12:00입니다."
  }
];

const checklist = [
  "상위 시간대 MSB가 내가 보는 방향과 맞는가",
  "현재 TF CHoCH가 반대로 먼저 꺾이지 않았는가",
  "OB/FVG/iFVG 같은 반응 구간에 가까운가",
  "프리미엄/디스카운트 위치가 추격 구간은 아닌가",
  "손절가와 포지션 크기가 먼저 정해졌는가"
];

export default function LearnPage() {
  return (
    <main className="min-h-screen px-4 pb-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <Header />
        <TabMenu />

        <section className="rounded-lg border border-surface-line bg-surface-card p-4 shadow-glow sm:p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-accent-blue/25 bg-accent-blue/10 text-accent-blue">
              <BookOpen size={21} aria-hidden />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">학습 노트</h2>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                차트 판독 결과를 어떻게 읽어야 하는지 최소 기준만 정리했습니다.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {lessons.map((lesson) => (
              <article key={lesson.title} className="rounded-lg border border-surface-line bg-surface-cardSoft p-4">
                <h3 className="text-base font-bold text-white">{lesson.title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-300">{lesson.body}</p>
              </article>
            ))}
          </div>

          <div className="mt-5 rounded-lg border border-accent-blue/25 bg-accent-blue/10 p-4">
            <h3 className="text-base font-bold text-white">진입 전 최소 체크리스트</h3>
            <div className="mt-3 grid gap-2">
              {checklist.map((item) => (
                <p key={item} className="flex items-start gap-2 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm leading-6 text-slate-200">
                  <CheckCircle2 className="mt-1 shrink-0 text-accent-blue" size={15} aria-hidden />
                  {item}
                </p>
              ))}
            </div>
          </div>

          <p className="mt-5 rounded-md border border-white/10 bg-black/20 p-4 text-xs leading-6 text-slate-500">
            이 학습 노트와 판독 결과는 교육용입니다. 특정 코인의 매수·매도 신호나 수익률 예측을 제공하지 않습니다.
          </p>
        </section>
        <AppFooter />
      </div>
    </main>
  );
}
