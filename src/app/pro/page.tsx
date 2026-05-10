// Chart Radar Pro 결제 모델과 구독 플랜을 보여주는 페이지.
import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";
import { ProPricingPanel } from "@/components/ProPricingPanel";
import { RadarTopNav } from "@/components/RadarTopNav";

export default function ProPage() {
  return (
    <main className="min-h-screen px-4 pb-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <Header />
        <RadarTopNav />
        <ProPricingPanel />
        <AppFooter />
      </div>
    </main>
  );
}
