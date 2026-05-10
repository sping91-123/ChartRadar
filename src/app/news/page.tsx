// 레이더뉴스 독립 페이지를 렌더링한다.
import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";
import { MacroTicker } from "@/components/MacroTicker";
import { RadarNewsPanel } from "@/components/RadarNewsPanel";
import { RadarTopNav } from "@/components/RadarTopNav";
import { UsageMeterPanel } from "@/components/UsageMeterPanel";

export default function NewsPage() {
  return (
    <main className="min-h-screen px-4 pb-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <Header />
        <RadarTopNav />
        <MacroTicker />
        <UsageMeterPanel compact />
        <RadarNewsPanel />
        <AppFooter />
      </div>
    </main>
  );
}
