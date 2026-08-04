import type { PerpetualAsset } from "@/lib/perpetualDecisionSnapshot";
import type { HomeInterestCoin } from "@/lib/homeInterestCoins";

const supportedAltBases = new Set(["SOL", "XRP", "DOGE", "BNB"]);

export function canonicalAssetForHomeCoin(coin: HomeInterestCoin): PerpetualAsset | null {
  if (coin.exchangeId !== "binance") return null;
  if (coin.marketId.toUpperCase() === "BTCUSDT") return "btc";
  if (coin.marketId.toUpperCase() === "ETHUSDT") return "eth";
  return null;
}

export function homeInterestDetailTarget(coin: HomeInterestCoin) {
  const canonical = canonicalAssetForHomeCoin(coin);
  if (canonical) {
    return {
      href: `/crypto/perpetual?asset=${canonical}&source=home-interest`,
      label: "전체 선물 분석 보기",
      exact: true
    };
  }

  const base = coin.base.toUpperCase();
  if (coin.exchangeId === "binance" && supportedAltBases.has(base)) {
    return {
      href: `/crypto/perpetual/alts?focus=${base.toLowerCase()}&source=home-interest`,
      label: `${base} 알트 분석 보기`,
      exact: true
    };
  }

  return {
    href: "/crypto/perpetual/alts?source=home-interest",
    label: "알트 레이더 열기",
    exact: false
  };
}
