import { Header } from "@/components/Header";
import { RadarTopNav } from "@/components/RadarTopNav";
import { SpotRadarPanel } from "@/components/spot/SpotRadarPanel";

export default function CryptoSpotPage() {
  return (
    <main className="min-h-screen max-w-full overflow-x-hidden px-3 pb-28 sm:px-5 sm:pb-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:gap-4">
        <Header market="crypto" />
        <RadarTopNav market="crypto" />
        <SpotRadarPanel />
      </div>
    </main>
  );
}
