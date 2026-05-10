// 결제 성공 후 사용자가 돌아오는 안내 페이지.
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";
import { RadarTopNav } from "@/components/RadarTopNav";

export default function CheckoutSuccessPage() {
  return (
    <main className="min-h-screen px-4 pb-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <Header />
        <RadarTopNav />
        <section className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 p-6 text-center">
          <CheckCircle2 className="mx-auto text-emerald-300" size={42} aria-hidden />
          <h2 className="mt-4 text-2xl font-black text-white">결제 요청이 완료되었습니다.</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-emerald-100">
            토스페이먼츠 승인 API와 구독 상태 저장이 연결되면 이 화면에서 Pro 권한을 바로 활성화합니다.
            지금은 결제 연결 테스트를 위한 완료 화면입니다.
          </p>
          <Link
            href="/survival"
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-md bg-emerald-300 px-5 text-sm font-black text-slate-950"
          >
            레이더로 돌아가기
          </Link>
        </section>
        <AppFooter />
      </div>
    </main>
  );
}
