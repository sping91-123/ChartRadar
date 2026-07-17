import { MajorsApp } from "@/components/MajorsApp";
import { resolveMajorAsset } from "@/lib/majorAssetRoute";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function CryptoPerpetualPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <MajorsApp initialAsset={resolveMajorAsset(await searchParams)} />;
}
