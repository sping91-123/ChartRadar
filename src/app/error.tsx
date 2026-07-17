"use client";

import Link from "next/link";

export default function ErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <section className="w-full max-w-md rounded-ui-lg border border-ui-line bg-ui-panel p-5 text-center">
        <h1 className="text-lg font-black text-ui-text">화면을 불러오지 못했습니다</h1>
        <p className="mt-2 text-sm leading-6 text-ui-muted">잠시 후 다시 시도하거나 홈으로 돌아가 주세요.</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={reset} className="min-h-11 rounded-ui-sm bg-ui-brand px-4 text-sm font-black text-slate-950">
            다시 시도
          </button>
          <Link href="/" className="grid min-h-11 place-items-center rounded-ui-sm border border-ui-line text-sm font-black text-ui-text">
            홈으로
          </Link>
        </div>
      </section>
    </main>
  );
}
