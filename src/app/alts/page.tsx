// 알트코인 관심 목록과 시장 레이더 감지를 별도 페이지로 보여준다.
import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";
import { MacroTicker } from "@/components/MacroTicker";
import { RadarTopNav } from "@/components/RadarTopNav";
import { SetupScoutPanel } from "@/components/SetupScoutPanel";
import { WatchlistPanel } from "@/components/WatchlistPanel";

export default function AltsPage() {
  return (
    <main className="min-h-screen px-4 pb-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <Header />
        <RadarTopNav />
        <MacroTicker compact />
        <WatchlistPanel />
        <SetupScoutPanel excludeMajor />
        <AppFooter />
      </div>
    </main>
  );
}
