import { Header } from "@/components/Header";
import { MacroTicker } from "@/components/MacroTicker";
import { NewsImpactPanel } from "@/components/news/NewsImpactPanel";
import { RadarTopNav } from "@/components/RadarTopNav";
import { isNewsImpactUiEnabled, newsImpactMode } from "@/lib/server/newsImpactMode";

export default async function CryptoNewsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const rawAsset = Array.isArray(params.asset) ? params.asset[0] : params.asset;
  const rawEvent = Array.isArray(params.event) ? params.event[0] : params.event;
  const rawSnapshot = Array.isArray(params.snapshot) ? params.snapshot[0] : params.snapshot;
  return (
    <main className="min-h-screen max-w-full overflow-x-hidden px-3 pb-28 sm:px-5 sm:pb-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 sm:gap-3">
        <Header market="crypto" />
        <RadarTopNav market="crypto" newsImpactEnabled={isNewsImpactUiEnabled(newsImpactMode())} />
        <h1 className="sr-only">BTC·ETH 공식 뉴스와 선물 시장 반응</h1>
        <NewsImpactPanel
          market="crypto"
          initialAsset={rawAsset === "eth" ? "eth" : "btc"}
          requestedEventId={rawEvent?.slice(0, 64) ?? null}
          requestedSnapshotId={rawSnapshot?.slice(0, 64) ?? null}
        />
        <section className="bg-ui-panel px-3 py-4 sm:px-5" aria-labelledby="crypto-news-brief-title">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-ui-brand">다음 경제 일정</p>
          <h2 id="crypto-news-brief-title" className="mt-1 text-xl font-black text-ui-text">다음 변동성 구간을 미리 준비하세요</h2>
          <p className="mt-1 text-xs leading-5 text-ui-muted">위에서 공식 발표 뒤 실제 반응을 확인했다면, 다음 일정과 예상 시각으로 다시 확인할 때를 잡아보세요.</p>
          <div className="mt-3"><MacroTicker compact market="crypto" /></div>
        </section>
      </div>
    </main>
  );
}
