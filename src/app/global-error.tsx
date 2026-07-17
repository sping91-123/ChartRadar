"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ko">
      <body className="bg-slate-950 text-white">
        <main className="grid min-h-screen place-items-center px-4">
          <section className="w-full max-w-md text-center">
            <h1 className="text-xl font-black">앱을 시작하지 못했습니다</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">네트워크 상태를 확인한 뒤 다시 시도해 주세요.</p>
            <button type="button" onClick={reset} className="mt-5 min-h-11 w-full rounded-md bg-cyan-300 px-4 text-sm font-black text-slate-950">
              다시 시작
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
