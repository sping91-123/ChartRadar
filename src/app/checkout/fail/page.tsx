// 결제 실패나 취소 후 사용자가 돌아오는 안내 페이지.
import Link from "next/link";
import { AlertTriangle, CreditCard, HelpCircle, RotateCw } from "lucide-react";
import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";
import { RadarTopNav } from "@/components/RadarTopNav";

interface CheckoutFailPageProps {
  searchParams?: {
    code?: string;
    message?: string;
    orderId?: string;
  };
}

export default function CheckoutFailPage({ searchParams }: CheckoutFailPageProps) {
  const errorMessage = searchParams?.message;
  const errorCode = searchParams?.code;

  return (
    <main className="min-h-screen px-4 pb-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <Header />
        <RadarTopNav market="all" />
        <section className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-6">
          <div className="text-center">
          <AlertTriangle className="mx-auto text-amber-300" size={42} aria-hidden />
          <h2 className="mt-4 text-2xl font-black text-slate-950 dark:text-white">결제가 완료되지 않았습니다.</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-amber-900 dark:text-amber-100">
            결제창을 닫았거나 카드사, 네트워크, 결제 한도 문제로 승인되지 않았을 수 있습니다. 결제는 아직 완료되지 않았으니 안심하셔도 됩니다.
          </p>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="rounded-md border border-amber-500/20 bg-white/70 p-4 dark:border-white/10 dark:bg-black/20">
              <RotateCw className="text-amber-300" size={19} aria-hidden />
              <p className="mt-3 font-black text-slate-950 dark:text-white">다시 시도</p>
              <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-amber-100/80">잠시 후 같은 플랜을 다시 선택하면 결제창을 새로 열 수 있습니다.</p>
            </div>
            <div className="rounded-md border border-amber-500/20 bg-white/70 p-4 dark:border-white/10 dark:bg-black/20">
              <CreditCard className="text-amber-300" size={19} aria-hidden />
              <p className="mt-3 font-black text-slate-950 dark:text-white">카드 확인</p>
              <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-amber-100/80">해외 결제, 한도, 간편결제 인증 상태를 확인하면 해결되는 경우가 많습니다.</p>
            </div>
            <div className="rounded-md border border-amber-500/20 bg-white/70 p-4 dark:border-white/10 dark:bg-black/20">
              <HelpCircle className="text-amber-300" size={19} aria-hidden />
              <p className="mt-3 font-black text-slate-950 dark:text-white">오류 정보</p>
              <p className="mt-2 break-all text-sm leading-6 text-slate-700 dark:text-amber-100/80">
                {errorMessage ?? errorCode ?? "반복되면 화면에 표시된 결제 오류 문구를 보관해 주세요."}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link
              href="/pro"
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-amber-300 px-5 text-sm font-black text-slate-950"
            >
              Pro 페이지로 돌아가기
            </Link>
            <Link
              href="/survival"
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-amber-500/30 bg-white/60 px-5 text-sm font-black text-amber-900 dark:border-amber-300/30 dark:bg-black/20 dark:text-amber-100"
            >
              무료 레이더 계속 보기
            </Link>
          </div>
        </section>
        <AppFooter />
      </div>
    </main>
  );
}
