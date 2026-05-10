// Chart Radar 알림 조건을 설정하는 독립 페이지다.
import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";
import { RadarAlertCenter } from "@/components/RadarAlertCenter";
import { RadarTopNav } from "@/components/RadarTopNav";

export default function AlertsPage() {
  return (
    <main className="min-h-screen px-4 pb-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <Header />
        <RadarTopNav />
        <RadarAlertCenter />
        <AppFooter />
      </div>
    </main>
  );
}
