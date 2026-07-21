import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";
import { RadarAlertCenter } from "@/components/RadarAlertCenter";
import { RadarTopNav } from "@/components/RadarTopNav";
import { isNewsImpactUiEnabled, newsImpactMode } from "@/lib/server/newsImpactMode";

export default function CryptoAlertSetPage() {
  return (
    <main className="min-h-screen px-3 pb-10 sm:px-5">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-5">
        <Header market="crypto" />
        <RadarTopNav market="crypto" newsImpactEnabled={isNewsImpactUiEnabled(newsImpactMode())} />
        <RadarAlertCenter market="crypto" newsImpactEnabled={isNewsImpactUiEnabled(newsImpactMode())} />
        <AppFooter />
      </div>
    </main>
  );
}
