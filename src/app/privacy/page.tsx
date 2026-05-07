import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, LockKeyhole, ShieldCheck } from "lucide-react";
import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "개인정보 처리방침",
  description: "차트 레이더 Beta 개인정보 처리방침"
};

const sections = [
  {
    title: "수집하는 정보",
    items: [
      "Google 로그인 시 제공되는 이메일, 이름, 프로필 이미지",
      "사용자가 직접 작성한 복기, 원칙 점검, 수량 계산 기록",
      "서비스 이용 과정에서 생성되는 후보 저장 기록과 결과 기록",
      "서비스 안정화를 위한 기본 접속 로그와 오류 정보"
    ]
  },
  {
    title: "사용 목적",
    items: [
      "로그인, 계정 식별, 서버 복기 동기화 제공",
      "사용자가 저장한 매매 복기와 후보 기록 제공",
      "서비스 개선, 오류 분석, 부정 사용 방지"
    ]
  },
  {
    title: "보관과 삭제",
    items: [
      "사용자가 작성한 복기와 신청 기록은 계정이 유지되는 동안 보관됩니다.",
      "사용자는 운영자에게 계정 및 기록 삭제를 요청할 수 있습니다.",
      "법령상 보관이 필요한 결제·분쟁 관련 정보는 정해진 기간 동안 별도 보관될 수 있습니다."
    ]
  },
  {
    title: "제3자 서비스",
    items: [
      "인증과 데이터 저장에는 Supabase가 사용됩니다.",
      "서비스 배포에는 Vercel 또는 동등한 호스팅 서비스가 사용될 수 있습니다.",
      "향후 결제에는 토스페이먼츠, 포트원 등 결제 대행사가 연결될 수 있습니다."
    ]
  }
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen px-4 pb-10">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        <Header />
        <Link href="/survival" className="inline-flex w-fit items-center gap-2 text-sm font-bold text-slate-400 hover:text-white">
          <ArrowLeft size={16} aria-hidden />
          서비스로 돌아가기
        </Link>

        <section className="rounded-lg border border-surface-line bg-surface-card p-5 shadow-glow">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-accent-blue/25 bg-accent-blue/10 text-accent-blue">
              <LockKeyhole size={20} aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">개인정보 처리방침</h1>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                시행일: 2026년 5월 7일 · 베타 서비스 기준
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            {sections.map((section) => (
              <section key={section.title} className="rounded-lg border border-surface-line bg-surface-cardSoft p-4">
                <h2 className="text-base font-bold text-white">{section.title}</h2>
                <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-400">
                  {section.items.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-blue" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-signal-success/25 bg-signal-success/10 p-4 text-sm leading-6 text-slate-300">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 shrink-0 text-signal-success" size={18} aria-hidden />
            <p>
              이 서비스는 거래소 API 키 입력을 현재 요구하지 않습니다. 향후 거래소 연동 기능을 추가할 경우
              읽기 전용 권한, 암호화 저장, 별도 동의 절차를 우선 적용해야 합니다.
            </p>
          </div>
        </section>

        <AppFooter />
      </div>
    </main>
  );
}
