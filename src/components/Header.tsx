import Link from "next/link";
import { Home, ShieldCheck } from "lucide-react";

export function Header() {
  return (
    <header className="space-y-4 pt-6">
      <div className="flex items-center justify-between gap-4">
        <Link href="/survival" className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-accent-blue/25 bg-accent-blue/10 text-accent-blue">
            <ShieldCheck size={22} aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-normal text-white sm:text-2xl">
              코털스 생존진단
            </h1>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              진입 전, 차트 구조와 리스크를 먼저 확인하세요.
            </p>
          </div>
        </Link>
        <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
          <span className="rounded-md border border-accent-blue/30 bg-accent-blue/10 px-2.5 py-1 text-xs font-semibold text-accent-blue">
            교육용 Beta
          </span>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:border-amber-300/50 hover:text-white"
          >
            <Home size={13} aria-hidden />
            코털스 홈
          </Link>
          <Link
            href="/pro"
            className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:border-accent-blue/50 hover:text-white"
          >
            PRO 보기
          </Link>
        </div>
      </div>
    </header>
  );
}
