// 존재하지 않는 주소에서 사용자를 주요 레이더 화면으로 안내한다.
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <section className="w-full max-w-md rounded-2xl border border-surface-line bg-surface-card p-6 text-center shadow-glow">
        <h1 className="text-2xl font-black text-white">찾는 페이지가 없습니다.</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          링크가 바뀌었거나 잘못 입력되었을 수 있습니다. 코인 레이더나 글로벌 레이더로 다시 이동해 주세요.
        </p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <Link href="/crypto" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent-blue px-4 text-sm font-black text-slate-950">
            코인 레이더
          </Link>
          <Link
            href="/global"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-surface-line bg-surface-cardSoft px-4 text-sm font-black text-slate-200"
          >
            글로벌 레이더
          </Link>
        </div>
      </section>
    </main>
  );
}
