// 결제 성공 후 서버 승인 확인 상태를 안내하는 페이지입니다.
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
    <main className="min-h-screen px-4 pb-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <Header />
        <RadarTopNav />
        <section className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-6">
          <div className="text-center">
            <CheckCircle2 className="mx-auto text-emerald-300" size={42} aria-hidden />
            <h2 className="mt-4 text-2xl font-black text-slate-950 dark:text-white">결제 요청을 확인했습니다.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-emerald-900 dark:text-emerald-100">
              지금부터 서버가 결제사 승인 여부를 다시 확인합니다. 성공 페이지 주소만으로는 Pro 권한을 열지 않기 때문에 더 안전합니다.
            </p>
          </div>

          <CheckoutConfirmationPanel
            orderId={searchParams?.orderId}
            paymentKey={searchParams?.paymentKey}
            amount={searchParams?.amount}
            planId={searchParams?.plan}
          />

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="rounded-md border border-emerald-500/20 bg-white/70 p-4 dark:border-white/10 dark:bg-black/20">
              <Crown className="text-emerald-300" size={19} aria-hidden />
              <p className="mt-3 font-black text-slate-950 dark:text-white">Pro 기능 확인</p>
              <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-emerald-100/80">
                승인과 권한 반영이 끝나면 레이더, AI 브리핑, 알림 한도가 확장됩니다.
              </p>
            </div>
            <div className="rounded-md border border-emerald-500/20 bg-white/70 p-4 dark:border-white/10 dark:bg-black/20">
              <RotateCw className="text-emerald-300" size={19} aria-hidden />
              <p className="mt-3 font-black text-slate-950 dark:text-white">반영 지연 시</p>
              <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-emerald-100/80">
                잠시 후 새로고침하거나 로그아웃 후 다시 로그인해 주세요.
              </p>
            </div>
            <div className="rounded-md border border-emerald-500/20 bg-white/70 p-4 dark:border-white/10 dark:bg-black/20">
              <ReceiptText className="text-emerald-300" size={19} aria-hidden />
              <p className="mt-3 font-black text-slate-950 dark:text-white">결제 정보</p>
              <p className="mt-2 break-all text-sm leading-6 text-slate-700 dark:text-emerald-100/80">
                {orderId ? `주문번호 ${orderId}` : amount ? `결제금액 ${amount}원` : "문의가 필요하면 결제 영수증을 함께 보관해 주세요."}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link
              href="/survival"
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-emerald-300 px-5 text-sm font-black text-slate-950"
            >
              레이더로 돌아가기
            </Link>
            <Link
              href="/pro"
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-emerald-500/30 bg-white/60 px-5 text-sm font-black text-emerald-900 dark:border-emerald-300/30 dark:bg-black/20 dark:text-emerald-100"
            >
              Pro 화면 보기
            </Link>
          </div>
        </section>
        <AppFooter />
      </div>
    </main>
  );
}
