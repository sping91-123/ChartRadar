// 글로벌 시장흐름 대시보드 전용 페이지입니다.
import { AppFooter } from "@/components/AppFooter";
import { GlobalAssetHashRedirect } from "@/components/GlobalAssetHashRedirect";
import { GlobalMarketPulse } from "@/components/GlobalMarketPulse";
import { Header } from "@/components/Header";
import { MacroTicker } from "@/components/MacroTicker";
import { RadarTopNav } from "@/components/RadarTopNav";
import { isNewsImpactUiEnabled, newsImpactMode } from "@/lib/server/newsImpactMode";

export default async function GlobalMarketPage({ searchParams }: { searchParams: Promise<{ event?: string | string[] }> }) {
  const { event } = await searchParams;
  const requestedEvent = (Array.isArray(event) ? event[0] : event)?.slice(0, 64) ?? null;
  return (
    <main className="min-h-screen max-w-full overflow-x-hidden px-3 pb-24 sm:px-5 sm:pb-28">
      <GlobalAssetHashRedirect />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:gap-4">
        <Header market="stocks" />
        <RadarTopNav market="stocks" newsImpactEnabled={isNewsImpactUiEnabled(newsImpactMode())} />
        <MacroTicker compact market="stocks" />
        <GlobalMarketPulse requestedEventId={requestedEvent} />
        <AppFooter />
      </div>
    </main>
  );
}
