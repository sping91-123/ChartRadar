// 계정과 사용 데이터 삭제 요청 방법을 안내하는 페이지입니다.
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mail, ShieldCheck, Trash2 } from "lucide-react";
import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "계정·데이터 삭제 안내",
  description: "Chart Radar 계정과 사용 데이터 삭제 요청 방법"
};

const deleteScope = [
  "Chart Radar 계정 프로필과 로그인 연결 정보",
  "사용자가 저장한 복기 기록, 관심 종목, 알림 조건, 사용 설정",
  "AI 브리핑과 Pro 이용 상태를 확인하기 위한 일반 사용 기록",
  "개인과 연결되어 있는 문의 처리 기록"
];

const retainedScope = [
  "결제, 환불, 세금, 분쟁 대응을 위해 법령상 보관이 필요한 최소 기록",
  "개인과 연결되지 않도록 익명화된 서비스 안정성 로그",
  "진행 중인 구독 상태 확인에 필요한 스토어 또는 결제 대행 정보"
];

export default function AccountDeletePage() {
  return (
    <main className="min-h-screen px-4 pb-10">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        <Header />
        <Link href="/" className="inline-flex w-fit items-center gap-2 text-sm font-bold text-slate-400 hover:text-white">
          <ArrowLeft size={16} aria-hidden />
          홈으로 돌아가기
        </Link>

        <section className="border-y border-surface-line py-5">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center text-rose-200">
              <Trash2 size={20} aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">계정·데이터 삭제 안내</h1>
              <p className="mt-2 text-sm leading-6 text-slate-400 [word-break:keep-all]">
                Chart Radar 계정과 저장된 사용 데이터를 삭제하려면 아래 절차에 따라 요청해 주세요.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            <section className="border-y border-surface-line py-4">
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 shrink-0 text-accent-blue" size={18} aria-hidden />
                <div>
                  <h2 className="text-base font-black text-white">삭제 요청 방법</h2>
                  <p className="mt-2 text-sm leading-7 text-slate-400 [word-break:keep-all]">
                    Chart Radar에 로그인한 Google 계정 이메일에서 <span className="font-bold text-white">staronlabs@gmail.com</span>로
                    “Chart Radar 계정 삭제 요청”이라고 보내 주세요. 본인 확인 후 영업일 기준 7일 이내에 삭제 처리 또는 추가 확인 절차를 안내합니다.
                  </p>
                </div>
              </div>
            </section>

            <section className="border-y border-surface-line py-4">
              <h2 className="text-base font-black text-white">삭제되는 데이터</h2>
              <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-400">
                {deleteScope.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-300" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="border-y border-surface-line py-4">
              <h2 className="text-base font-black text-white">일부 보관될 수 있는 데이터</h2>
              <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-400">
                {retainedScope.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </section>

        <section className="border-y border-signal-success/25 py-4 text-sm leading-6 text-slate-300">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 shrink-0 text-signal-success" size={18} aria-hidden />
            <p>
              유료 구독을 사용 중이라면 계정 삭제 전에 Google Play 또는 결제 화면에서 구독 해지 상태를 먼저 확인해 주세요.
              계정 삭제와 스토어 구독 해지는 별개의 절차입니다.
            </p>
          </div>
        </section>

        <AppFooter />
      </div>
    </main>
  );
}
