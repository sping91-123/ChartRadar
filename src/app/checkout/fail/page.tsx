// 결제 실패나 취소 후 사용자가 돌아오는 안내 페이지.
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";
import { RadarTopNav } from "@/components/RadarTopNav";

export default function CheckoutFailPage() {
  return (
    <main className="min-h-screen px-4 pb-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <Header />
        <RadarTopNav />
        <section className="rounded-lg border border-amber-400/25 bg-amber-500/10 p-6 text-center">
          <AlertTriangle className="mx-auto text-amber-300" size={42} aria-hidden />
          <h2 className="mt-4 text-2xl font-black text-white">결제가 완료되지 않았습니다.</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-amber-100">
            결제를 취소했거나 결제창에서 오류가 발생했습니다. 다시 시도해도 반복되면 고객센터 안내와 결제 로그 확인이 필요합니다.
          </p>
          <Link
            href="/pro"
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-md bg-amber-300 px-5 text-sm font-black text-slate-950"
          >
            Pro 페이지로 돌아가기
          </Link>
        </section>
        <AppFooter />
      </div>
    </main>
  );
}
