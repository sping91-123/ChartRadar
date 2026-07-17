// 결제가 완료되지 않았을 때 재시도 방법을 안내하는 페이지입니다.
import Link from "next/link";
import { AlertTriangle, CreditCard, HelpCircle, RotateCw } from "lucide-react";
import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";
import { RadarTopNav } from "@/components/RadarTopNav";

interface CheckoutFailPageProps {
  searchParams: Promise<{
    code?: string | string[];
    message?: string | string[];
  }>;
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CheckoutFailPage({ searchParams }: CheckoutFailPageProps) {
  const resolvedSearchParams = await searchParams;
  const errorMessage = firstValue(resolvedSearchParams.message);
  const errorCode = firstValue(resolvedSearchParams.code);

  return (
    <main className="min-h-screen px-3 pb-10 sm:px-5">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-5">
        <Header />
        <RadarTopNav market="all" />
        <section className="border-y border-surface-line py-6">
          <div className="text-center">
            <AlertTriangle className="mx-auto text-signal-warning" size={42} aria-hidden />
            <h2 className="mt-4 text-2xl font-black text-slate-950 dark:text-white">결제가 완료되지 않았습니다.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              결제창을 닫았거나 카드, 간편결제, 네트워크 상태 때문에 승인되지 않았을 수 있습니다.
            </p>
          </div>

          <div className="mt-6 grid gap-3 border-y border-surface-line md:grid-cols-3 md:divide-x md:divide-surface-line">
            <div className="py-4 md:px-4 md:first:pl-0">
              <RotateCw className="text-signal-warning" size={19} aria-hidden />
              <p className="mt-3 font-black text-slate-950 dark:text-white">다시 시도</p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">같은 상품을 다시 선택하면 새 결제창을 열 수 있습니다.</p>
            </div>
            <div className="border-t border-surface-line py-4 md:border-t-0 md:px-4">
              <CreditCard className="text-accent-blue" size={19} aria-hidden />
              <p className="mt-3 font-black text-slate-950 dark:text-white">결제 수단 확인</p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">카드 한도, 해외 결제 제한, 간편결제 인증 상태를 확인해 주세요.</p>
            </div>
            <div className="border-t border-surface-line py-4 md:border-t-0 md:px-4 md:last:pr-0">
              <HelpCircle className="text-slate-500 dark:text-slate-300" size={19} aria-hidden />
              <p className="mt-3 font-black text-slate-950 dark:text-white">오류 정보</p>
              <p className="mt-2 break-all text-sm leading-6 text-slate-600 dark:text-slate-300">
                {errorMessage ?? errorCode ?? "반복되면 화면에 표시된 문구를 고객센터에 알려 주세요."}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link href="/pro" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent-blue px-5 text-sm font-black text-slate-950">
              Pro 상품으로 이동
            </Link>
            <Link
              href="/crypto/home"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-surface-line bg-white/60 px-5 text-sm font-black text-slate-700 hover:border-accent-blue/40 dark:bg-black/20 dark:text-slate-200"
            >
              레이더 계속 보기
            </Link>
          </div>
        </section>
        <AppFooter />
      </div>
    </main>
  );
}
