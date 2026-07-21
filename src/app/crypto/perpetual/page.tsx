import { MajorsApp } from "@/components/MajorsApp";
import { resolveMajorAsset } from "@/lib/majorAssetRoute";
import { isSnapshotId } from "@/lib/server/perpetualDecisionSource";
import { perpetualRevenueCoreMode } from "@/lib/server/perpetualRevenueCore";
import { isNewsImpactUiEnabled, newsImpactMode } from "@/lib/server/newsImpactMode";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function CryptoPerpetualPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const rawSnapshot = Array.isArray(params.snapshot) ? params.snapshot[0] : params.snapshot;
  const rawSource = Array.isArray(params.source) ? params.source[0] : params.source;
  const rawAttribution = Array.isArray(params.attribution) ? params.attribution[0] : params.attribution;
  const rawImpact = Array.isArray(params.impact) ? params.impact[0] : params.impact;
  return (
    <MajorsApp
      initialAsset={resolveMajorAsset(params)}
      initialSnapshotId={isSnapshotId(rawSnapshot) ? rawSnapshot : null}
      initialSource={rawSource === "home" || rawSource === "alert" || rawSource === "news" ? rawSource : null}
      initialAttributionId={isSnapshotId(rawAttribution) ? rawAttribution : null}
      initialImpactId={isSnapshotId(rawImpact) ? rawImpact : null}
      revenueCoreMode={perpetualRevenueCoreMode()}
      newsImpactEnabled={isNewsImpactUiEnabled(newsImpactMode())}
    />
  );
}
