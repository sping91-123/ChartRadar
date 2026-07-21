import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";
import { RadarAlertList } from "@/components/RadarAlertList";
import { RadarTopNav } from "@/components/RadarTopNav";
import { isNewsImpactUiEnabled, newsImpactMode } from "@/lib/server/newsImpactMode";

export default function CryptoAlertListPage() {
  return (
    <main className="min-h-screen px-3 pb-10 sm:px-5">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-5">
        <Header market="crypto" />
        <RadarTopNav market="crypto" newsImpactEnabled={isNewsImpactUiEnabled(newsImpactMode())} />
        <RadarAlertList market="crypto" />
        <AppFooter />
      </div>
    </main>
  );
}
