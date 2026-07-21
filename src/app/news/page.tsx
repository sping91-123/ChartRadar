import { Header } from "@/components/Header";
import { NewsImpactPanel } from "@/components/news/NewsImpactPanel";
import { RadarTopNav } from "@/components/RadarTopNav";
import { redirect } from "next/navigation";
import { isNewsImpactUiEnabled, newsImpactMode } from "@/lib/server/newsImpactMode";

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
  const mode = newsImpactMode();
  if (!isNewsImpactUiEnabled(mode)) redirect("/global");

  return (
    <main className="min-h-screen px-3 pb-28 sm:px-5 sm:pb-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:gap-4">
        <Header market={market} />
        <RadarTopNav market={market} newsImpactEnabled />
        {isNewsImpactUiEnabled(mode) ? (
          <NewsImpactPanel market="global" requestedEventId={requestedEvent?.slice(0, 64) ?? null} />
        ) : (
          <section className="bg-ui-panel px-4 py-8 text-center" role="status">
            <h1 className="text-lg font-black text-ui-text">공식 뉴스 임팩트를 검증 중입니다</h1>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-ui-muted">검증이 끝나기 전에는 뉴스 사건·반응·알림을 사용자 판단에 노출하지 않습니다.</p>
          </section>
        )}
      </div>
    </main>
  );
}
