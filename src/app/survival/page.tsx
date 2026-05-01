import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";
import { LiveMarketChart } from "@/components/LiveMarketChart";
import { TabMenu } from "@/components/TabMenu";

export default function SurvivalPage() {
  return (
    <main className="min-h-screen px-4 pb-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <Header />
        <TabMenu />
        <LiveMarketChart />
        <AppFooter />
      </div>
    </main>
  );
}
