import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";
import { RadarAlertList } from "@/components/RadarAlertList";
import { RadarTopNav } from "@/components/RadarTopNav";
import { isNewsImpactUiEnabled, newsImpactMode } from "@/lib/server/newsImpactMode";

export default function GlobalAlertListPage() {
  return (
    <main className="min-h-screen px-3 pb-24 sm:px-5 sm:pb-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-5">
        <Header market="stocks" />
        <RadarTopNav market="stocks" newsImpactEnabled={isNewsImpactUiEnabled(newsImpactMode())} />
        <RadarAlertList market="stocks" />
        <AppFooter />
      </div>
    </main>
  );
}
