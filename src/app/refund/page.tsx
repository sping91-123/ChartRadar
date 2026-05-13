// Chart Radar 구독 해지와 환불 기준을 안내하는 정책 페이지입니다.
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CreditCard, ReceiptText, RotateCcw, ShieldCheck } from "lucide-react";
import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";
import { RadarTopNav } from "@/components/RadarTopNav";

export const metadata: Metadata = {
  title: "구독 해지·환불 안내",
  description: "Chart Radar 구독 해지와 환불 안내"
};

const refundSections = [
  {
    icon: CreditCard,
    title: "앱 구독 결제",
    body:
      "Android 앱에서 결제한 구독은 Google Play 계정의 구독 관리 화면에서 해지하거나 환불을 요청할 수 있습니다. Google Play 결제는 Google의 구독·환불 정책과 심사 절차를 따릅니다."
  },
  {
    icon: ReceiptText,
    title: "웹 결제",
    body:
      "웹에서 결제한 구독은 결제 대행사의 결제 기록과 서비스 사용 이력을 확인한 뒤 처리합니다. 결제 직후 사용 이력이 거의 없는 경우에는 고객센터 확인 후 환불이 가능할 수 있습니다."
  },
  {
    icon: RotateCcw,
    title: "구독 해지",
    body:
      "구독을 해지하면 이미 결제된 이용 기간이 끝날 때까지 Pro 기능을 사용할 수 있고, 다음 결제일부터 자동 갱신이 중단됩니다. 앱 삭제만으로는 구독이 해지되지 않을 수 있으므로 반드시 스토어 또는 결제 화면에서 해지 상태를 확인해 주세요."
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
              <h1 className="text-2xl font-black text-white">구독 해지·환불 안내</h1>
              <p className="mt-2 text-sm leading-6 text-slate-400">시행일 2026년 5월 13일</p>
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
          <p className="font-black text-amber-200">문의 전 확인해 주세요.</p>
          <p className="mt-2 [word-break:keep-all]">
            환불 가능 여부는 결제 수단, 스토어 정책, 서비스 사용 이력, 법령상 제한에 따라 달라질 수 있습니다. 문의 시에는
            결제한 이메일, 주문 번호, 결제 일시, 사용 중인 기기를 함께 알려주시면 더 빠르게 확인할 수 있습니다.
          </p>
        </section>

        <AppFooter />
      </div>
    </main>
  );
}
