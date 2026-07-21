// Chart Radar 알림 조건을 설정하는 알림 페이지입니다.
import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";
import { RadarAlertCenter } from "@/components/RadarAlertCenter";
import { RadarTopNav } from "@/components/RadarTopNav";
import { redirect } from "next/navigation";
import { isNewsImpactUiEnabled, newsImpactMode } from "@/lib/server/newsImpactMode";

export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ market?: string | string[] }> }) {
  const { market: requestedMarket } = await searchParams;
  const market = requestedMarket === "stocks" || requestedMarket === "global" ? "stocks" : "crypto";
  if (market === "crypto") redirect("/crypto/alertlist");

  return (
    <main className="min-h-screen px-3 pb-10 sm:px-5">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-5">
        <Header market={market} />
        <RadarTopNav market={market} newsImpactEnabled={isNewsImpactUiEnabled(newsImpactMode())} />
        <RadarAlertCenter market={market} newsImpactEnabled={isNewsImpactUiEnabled(newsImpactMode())} />
        <AppFooter />
      </div>
    </main>
  );
}
