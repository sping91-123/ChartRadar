import { HomePerpetualDecisionFlow } from "@/components/coin/HomePerpetualDecisionFlow";
import { Header } from "@/components/Header";
import { RadarTopNav } from "@/components/RadarTopNav";
import { perpetualRevenueCoreMode } from "@/lib/server/perpetualRevenueCore";
import { isNewsImpactUiEnabled, newsImpactMode } from "@/lib/server/newsImpactMode";

export default function CryptoHomePage() {
  const mode = perpetualRevenueCoreMode();
  return (
    <main className="min-h-screen max-w-full overflow-x-hidden px-3 pb-0 sm:px-5">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-0">
        <Header market="crypto" />
        <RadarTopNav market="crypto" newsImpactEnabled={isNewsImpactUiEnabled(newsImpactMode())} />
        <HomePerpetualDecisionFlow mode={mode} newsImpactEnabled={isNewsImpactUiEnabled(newsImpactMode())} />
      </div>
    </main>
  );
}
