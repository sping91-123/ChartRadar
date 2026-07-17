// Chart Radar 개인정보 처리 기준을 안내하는 정책 페이지입니다.
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, LockKeyhole, ShieldCheck } from "lucide-react";
import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "개인정보 처리방침",
  description: "Chart Radar 개인정보 처리방침"
};

const sections = [
  {
    title: "1. 수집하는 정보",
    items: [
      "Google, Kakao, Apple 로그인이 제공하는 이메일, 이름, 프로필 이미지 등 계정 식별 정보",
      "사용자가 직접 저장한 매매 복기, 관심 종목, 알림 조건, 사용 설정",
      "Pro 이용 확인을 위한 결제 식별값, 상품 ID, 구매 상태, 갱신 상태",
      "서비스 안정화와 오류 분석을 위한 접속 로그, 기기 정보, 사용 환경 정보, 오류 기록"
    ]
  },
  {
    title: "2. 이용 목적",
    items: [
      "회원 식별, 로그인 유지, 계정 기반 데이터 보관",
      "시장 분석, 복기, 알림, 관심 종목 등 사용자가 요청한 기능 제공",
      "유료 구독 확인, 구매 복원, 결제 관련 문의 처리",
      "서비스 품질 안정화, 보안 점검, 부정 사용 방지, 오류 개선"
    ]
  },
  {
    title: "3. 보관과 삭제",
    items: [
      "사용자가 저장한 복기와 설정은 계정이 유지되는 동안 보관합니다.",
      "앱 또는 웹 삭제 안내에서 계정 삭제를 요청하면 7일 안에 개인 식별 정보와 사용자가 생성한 데이터를 삭제하거나 익명화합니다. 처리 시작 전에는 요청을 취소할 수 있습니다.",
      "결제, 세금, 분쟁 대응 등 법령상 보관이 필요한 기록은 필요한 기간 동안 별도로 보관될 수 있습니다.",
      "계정·데이터 삭제 요청 방법은 별도 안내 페이지에서 확인할 수 있습니다."
    ]
  },
  {
    title: "4. 외부 처리와 보안",
    items: [
      "로그인, 데이터 보관, 서비스 운영에는 안정적인 외부 인프라가 사용될 수 있습니다.",
      "앱 구독과 결제 확인은 Google Play, App Store와 RevenueCat을 통해 처리합니다. Toss 웹 결제는 현재 제공하지 않습니다.",
      "AI 요약과 브리핑 기능에는 외부 AI 처리 기능이 사용될 수 있으며, 민감한 개인정보 입력은 권장하지 않습니다.",
      "외부 처리자에게는 서비스 제공에 필요한 범위의 정보만 전달되도록 관리합니다."
    ]
  },
  {
    title: "5. 사용자의 권리",
    items: [
      "사용자는 본인 계정의 데이터 열람, 정정, 삭제를 요청할 수 있습니다.",
      "구독 해지와 환불은 결제한 스토어 또는 결제 대행사의 정책에 따라 처리됩니다.",
      "개인정보 관련 문의는 contact@staronlabs.com으로 접수할 수 있습니다."
    ]
  }
];

export default function PrivacyPage() {
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
            <div className="grid h-10 w-10 shrink-0 place-items-center text-accent-blue">
              <LockKeyhole size={20} aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">개인정보 처리방침</h1>
              <p className="mt-2 text-sm leading-6 text-slate-400">시행일 2026년 7월 16일.</p>
            </div>
          </div>

          <div className="mt-6 divide-y divide-surface-line border-y border-surface-line">
            {sections.map((section) => (
              <section key={section.title} className="py-4">
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

        <section className="grid gap-4 md:grid-cols-2">
          <Link
            href="/account/delete"
            className="border-y border-signal-success/25 py-4 text-sm leading-6 text-slate-300 hover:border-signal-success/45"
          >
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 shrink-0 text-signal-success" size={18} aria-hidden />
              <div>
                <p className="font-black text-signal-success">계정·데이터 삭제 안내</p>
                <p className="mt-1 text-slate-400">계정 삭제와 데이터 삭제 요청 방법을 확인할 수 있습니다.</p>
              </div>
            </div>
          </Link>
          <section className="border-y border-accent-blue/20 py-4 text-sm leading-6 text-slate-300">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 shrink-0 text-accent-blue" size={18} aria-hidden />
              <p>
                Chart Radar는 거래소 주문 권한을 요구하지 않습니다. 향후 거래 이력 연동 기능이 추가되는 경우에도 읽기 전용 권한과
                별도 동의 절차를 우선 적용합니다.
              </p>
            </div>
          </section>
        </section>

        <AppFooter />
      </div>
    </main>
  );
}
