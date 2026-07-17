export type MajorAssetId = "btc" | "eth";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function resolveMajorAsset(searchParams: SearchParams): MajorAssetId {
  const asset = first(searchParams.asset)?.toLowerCase();
  if (asset === "btc" || asset === "eth") return asset;

  const legacySymbol = first(searchParams.symbol)?.toUpperCase() ?? "";
  return legacySymbol.startsWith("ETH") ? "eth" : "btc";
}
