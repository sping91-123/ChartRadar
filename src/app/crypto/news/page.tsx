import { Header } from "@/components/Header";
import { NewsImpactPanel } from "@/components/news/NewsImpactPanel";
import { RadarTopNav } from "@/components/RadarTopNav";
import { isNewsImpactUiEnabled, newsImpactMode } from "@/lib/server/newsImpactMode";
import { redirect } from "next/navigation";

export default async function CryptoNewsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const rawAsset = Array.isArray(params.asset) ? params.asset[0] : params.asset;
  const rawEvent = Array.isArray(params.event) ? params.event[0] : params.event;
  const rawSnapshot = Array.isArray(params.snapshot) ? params.snapshot[0] : params.snapshot;
  const mode = newsImpactMode();
  if (!isNewsImpactUiEnabled(mode)) redirect("/crypto/home");
  return (
    <main className="min-h-screen max-w-full overflow-x-hidden px-3 pb-28 sm:px-5 sm:pb-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 sm:gap-3">
        <Header market="crypto" />
        <RadarTopNav market="crypto" newsImpactEnabled />
        {isNewsImpactUiEnabled(mode) ? (
          <NewsImpactPanel
            market="crypto"
            initialAsset={rawAsset === "eth" ? "eth" : "btc"}
            requestedEventId={rawEvent?.slice(0, 64) ?? null}
            requestedSnapshotId={rawSnapshot?.slice(0, 64) ?? null}
          />
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
