import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen px-4 py-10">
      <div className="mx-auto flex max-w-xl flex-col gap-5 rounded-lg border border-surface-line bg-surface-card p-6 text-center shadow-glow">
        <p className="text-sm font-semibold text-accent-blue">404</p>
        <h1 className="text-2xl font-black text-white">찾는 페이지가 없습니다.</h1>
        <p className="text-sm leading-6 text-slate-400">
          링크가 바뀌었거나 잘못 들어왔을 수 있습니다. 코인 레이더나 글로벌 레이더로 다시 이동해보세요.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Link
            href="/majors"
            className="flex min-h-11 items-center justify-center rounded-md bg-accent-blue px-4 text-sm font-bold text-slate-950"
          >
            차트 판독으로
          </Link>
          <Link
            href="/global"
            className="flex min-h-11 items-center justify-center rounded-md border border-surface-line bg-surface-cardSoft px-4 text-sm font-bold text-slate-200"
          >
            글로벌 레이더로
          </Link>
        </div>
      </div>
    </main>
  );
}
