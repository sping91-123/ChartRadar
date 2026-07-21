import { JournalApp } from "@/components/JournalApp";
import { isNewsImpactUiEnabled, newsImpactMode } from "@/lib/server/newsImpactMode";

export default function CryptoReviewPage() {
  return <JournalApp initialMarket="crypto" newsImpactEnabled={isNewsImpactUiEnabled(newsImpactMode())} />;
}
