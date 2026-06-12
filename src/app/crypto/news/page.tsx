import { Header } from "@/components/Header";
import { RadarNewsPanel } from "@/components/RadarNewsPanel";
import { RadarTopNav } from "@/components/RadarTopNav";

export default function CryptoNewsPage() {
  return (
    <main className="min-h-screen max-w-full overflow-x-hidden px-3 pb-28 sm:px-5 sm:pb-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:gap-4">
        <Header market="crypto" />
        <RadarTopNav market="crypto" />
        <RadarNewsPanel market="crypto" />
      </div>
    </main>
  );
}
