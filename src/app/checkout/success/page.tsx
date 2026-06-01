// 결제 완료 후 서버 승인 상태와 다음 행동을 안내하는 페이지입니다.
import Link from "next/link";
import { CheckCircle2, Crown, ReceiptText, RotateCw } from "lucide-react";
import { AppFooter } from "@/components/AppFooter";
import { CheckoutConfirmationPanel } from "@/components/CheckoutConfirmationPanel";
import { Header } from "@/components/Header";
import { RadarTopNav } from "@/components/RadarTopNav";

interface CheckoutSuccessPageProps {
  searchParams?: {
    orderId?: string;
    paymentKey?: string;
    amount?: string;
    plan?: string;
  };
}

export default function CheckoutSuccessPage({ searchParams }: CheckoutSuccessPageProps) {
  const orderId = searchParams?.orderId;
  const amount = searchParams?.amount;

  return (
    <main className="min-h-screen px-3 pb-10 sm:px-5">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-5">
        <Header />
        <RadarTopNav market="all" />
        <section className="border-y border-surface-line py-6">
          <div className="text-center">
            <CheckCircle2 className="mx-auto text-signal-success" size={42} aria-hidden />
            <h2 className="mt-4 text-2xl font-black text-slate-950 dark:text-white">결제 확인을 진행하고 있습니다.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              결제 승인 정보를 확인한 뒤 계정에 Pro 권한을 반영합니다.
            </p>
          </div>

          <CheckoutConfirmationPanel
            orderId={searchParams?.orderId}
            paymentKey={searchParams?.paymentKey}
            amount={searchParams?.amount}
            planId={searchParams?.plan}
          />

          <div className="mt-6 grid gap-3 border-y border-surface-line md:grid-cols-3 md:divide-x md:divide-surface-line">
            <div className="py-4 md:px-4 md:first:pl-0">
              <Crown className="text-signal-success" size={19} aria-hidden />
              <p className="mt-3 font-black text-slate-950 dark:text-white">Pro 권한 반영</p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                승인 확인 후 레이더 분석, AI 브리핑, 알림 한도가 결제 상품 기준으로 적용됩니다.
              </p>
            </div>
            <div className="border-t border-surface-line py-4 md:border-t-0 md:px-4">
              <RotateCw className="text-accent-blue" size={19} aria-hidden />
              <p className="mt-3 font-black text-slate-950 dark:text-white">권한 새로고침</p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                화면이 그대로라면 새로고침하거나 다시 로그인하면 최신 권한을 불러옵니다.
              </p>
            </div>
            <div className="border-t border-surface-line py-4 md:border-t-0 md:px-4 md:last:pr-0">
              <ReceiptText className="text-slate-500 dark:text-slate-300" size={19} aria-hidden />
              <p className="mt-3 font-black text-slate-950 dark:text-white">결제 정보</p>
              <p className="mt-2 break-all text-sm leading-6 text-slate-600 dark:text-slate-300">
                {orderId ? `주문번호 ${orderId}` : amount ? `결제금액 ${amount}원` : "문의가 필요하면 결제 영수증을 함께 보관해 주세요."}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link href="/crypto/home" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent-blue px-5 text-sm font-black text-slate-950">
              코인 레이더로 이동
            </Link>
            <Link
              href="/pro"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-surface-line bg-white/60 px-5 text-sm font-black text-slate-700 hover:border-accent-blue/40 dark:bg-black/20 dark:text-slate-200"
            >
              Pro 상품 다시 보기
            </Link>
          </div>
        </section>
        <AppFooter />
      </div>
    </main>
  );
}
