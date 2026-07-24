import { Header } from "@/components/Header";
import { MacroTicker } from "@/components/MacroTicker";
import { NewsImpactPanel } from "@/components/news/NewsImpactPanel";
import { RadarTopNav } from "@/components/RadarTopNav";
import { isNewsImpactUiEnabled, newsImpactMode } from "@/lib/server/newsImpactMode";
import { redirect } from "next/navigation";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const requestedMarket = first(params.market);
  const requestedEvent = first(params.event);
  const market = requestedMarket === "stocks" || requestedMarket === "global" ? "stocks" : "crypto";
  if (market === "crypto") {
    const target = new URLSearchParams();
    for (const key of ["asset", "event", "snapshot", "source"] as const) {
      const value = first(params[key]);
      if (value) target.set(key, value.slice(0, 256));
    }
    redirect(`/crypto/news${target.size > 0 ? `?${target.toString()}` : ""}`);
  }
  return (
    <main className="min-h-screen px-3 pb-28 sm:px-5 sm:pb-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:gap-4">
        <Header market={market} />
        <RadarTopNav market={market} newsImpactEnabled={isNewsImpactUiEnabled(newsImpactMode())} />
        <h1 className="sr-only">글로벌 공식 뉴스와 시장 반응</h1>
        <NewsImpactPanel market="global" requestedEventId={requestedEvent?.slice(0, 64) ?? null} />
        <section className="bg-ui-panel px-3 py-4 sm:px-5" aria-labelledby="global-news-brief-title">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-ui-brand">다음 경제 일정</p>
          <h2 id="global-news-brief-title" className="mt-1 text-xl font-black text-ui-text">다음 변동성 구간을 미리 준비하세요</h2>
          <p className="mt-1 text-xs leading-5 text-ui-muted">위에서 공식 발표 뒤 글로벌 반응을 확인했다면, 다음 일정과 예상 시각으로 다시 확인할 때를 잡아보세요.</p>
          <div className="mt-3"><MacroTicker compact market="stocks" homePriorityAware /></div>
        </section>
      </div>
    </main>
  );
}
