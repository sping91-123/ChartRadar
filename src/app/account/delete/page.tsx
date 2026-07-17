import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Trash2 } from "lucide-react";
import { AccountDeletionPanel } from "@/components/AccountDeletionPanel";
import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "계정·데이터 삭제",
  description: "ChartRadar 계정과 사용자 데이터 삭제를 요청하는 공식 경로"
};

export default function AccountDeletePage() {
  return (
    <main className="min-h-screen px-4 pb-10">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        <Header />
        <Link href="/account" className="inline-flex w-fit items-center gap-2 text-sm font-bold text-slate-400 hover:text-white">
          <ArrowLeft size={16} aria-hidden />
          계정으로 돌아가기
        </Link>

        <section className="border-y border-surface-line py-5">
          <div className="flex items-start gap-3">
            <Trash2 className="mt-1 shrink-0 text-rose-200" size={22} aria-hidden />
            <div>
              <h1 className="text-2xl font-black text-white">계정·데이터 삭제</h1>
              <p className="mt-2 text-sm leading-6 text-slate-400 [word-break:keep-all]">
                Google, Kakao, Apple 등 로그인 제공자와 관계없이 앱 안에서 삭제를 요청할 수 있습니다. 요청은 7일 안에 처리되며 처리 시작 전에는 취소할 수 있습니다.
              </p>
            </div>
          </div>
        </section>

        <AccountDeletionPanel />

        <section className="border-y border-surface-line py-5 text-sm leading-7 text-slate-400">
          <h2 className="font-black text-white">삭제·보관 범위</h2>
          <p className="mt-2">프로필, 복기, 관심 종목, 알림 설정, 구독 권한 연결 등 계정 기반 데이터는 삭제하거나 익명화합니다.</p>
          <p className="mt-2">법령상 보관이 필요한 결제·환불·분쟁 기록은 필요한 기간 동안 분리 보관될 수 있습니다.</p>
          <div className="mt-4 flex items-start gap-3 border-t border-surface-line pt-4">
            <ShieldCheck className="mt-1 shrink-0 text-signal-success" size={18} aria-hidden />
            <p>웹에서 요청하기 어렵다면 support@staronlabs.com으로 문의할 수 있습니다. 이메일 문의는 보조 경로이며 앱 내부 요청 경로도 계속 제공됩니다.</p>
          </div>
        </section>

        <AppFooter />
      </div>
    </main>
  );
}
