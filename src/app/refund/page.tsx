// Chart Radar의 구독 해지와 환불 안내를 제공하는 정책 페이지다.
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CreditCard, ReceiptText, RotateCcw, ShieldCheck } from "lucide-react";
import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";
import { RadarTopNav } from "@/components/RadarTopNav";

export const metadata: Metadata = {
  title: "구독 해지와 환불 안내",
  description: "Chart Radar 구독 해지와 환불 안내"
};

const refundSections = [
  {
    icon: CreditCard,
    title: "웹 결제",
    body:
      "웹에서 결제한 구독은 결제 대행사 기록과 서비스 사용 이력을 확인한 뒤 처리합니다. 결제 직후 서비스 이용 이력이 거의 없는 경우에는 고객센터 확인 후 환불을 도와드립니다."
  },
  {
    icon: ReceiptText,
    title: "앱스토어 구독",
    body:
      "iOS 앱 안에서 결제한 구독은 App Store 구독 관리 화면에서 해지와 환불 요청을 진행해야 합니다. Apple 결제는 Apple 정책과 심사 절차를 따릅니다."
  },
  {
    icon: RotateCcw,
    title: "구독 해지",
    body:
      "구독을 해지하면 이미 결제된 기간이 끝날 때까지 Pro 기능을 사용할 수 있고, 다음 결제일부터 자동 갱신이 중단됩니다."
  }
];

export default function RefundPage() {
  return (
    <main className="min-h-screen px-4 pb-10">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        <Header />
        <RadarTopNav market="all" />
        <Link href="/pro" className="inline-flex w-fit items-center gap-2 text-sm font-bold text-slate-400 hover:text-white">
          <ArrowLeft size={16} aria-hidden />
          Pro 페이지로 돌아가기
        </Link>

        <section className="rounded-lg border border-surface-line bg-surface-card p-5 shadow-glow">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-cyan-300/25 bg-cyan-300/10 text-cyan-300">
              <ShieldCheck size={20} aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">구독 해지와 환불 안내</h1>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                시행일: 2026년 5월 11일 · 정식 서비스 결제 기준
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            {refundSections.map(({ icon: Icon, title, body }) => (
              <section key={title} className="rounded-lg border border-surface-line bg-surface-cardSoft p-4">
                <div className="flex items-start gap-3">
                  <Icon className="mt-0.5 shrink-0 text-cyan-300" size={18} aria-hidden />
                  <div>
                    <h2 className="text-base font-black text-white">{title}</h2>
                    <p className="mt-2 text-sm leading-7 text-slate-400 [word-break:keep-all]">{body}</p>
                  </div>
                </div>
              </section>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-amber-300/25 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">
          <p className="font-black text-amber-200">결제 전 확인 사항</p>
          <p className="mt-2 [word-break:keep-all]">
            사업자 정보, 고객센터 이메일, 결제 대행사 약관, App Store 구독 상품 정보는 실제 운영 기준에 맞춰 고지합니다.
            이 페이지는 사용자가 결제 전 해지와 환불 흐름을 이해하도록 돕는 기본 안내입니다.
          </p>
        </section>

        <AppFooter />
      </div>
    </main>
  );
}
