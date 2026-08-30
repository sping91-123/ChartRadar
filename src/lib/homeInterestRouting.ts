import type { PerpetualAsset } from "@/lib/perpetualDecisionSnapshot";
import type { HomeInterestCoin } from "@/lib/homeInterestCoins";

const supportedAltBases = new Set(["SOL", "XRP", "DOGE", "BNB"]);
type HomeInterestRouteSelection = Pick<HomeInterestCoin, "exchangeId" | "marketId" | "base">;

export function canonicalAssetForHomeCoin(coin: HomeInterestRouteSelection): PerpetualAsset | null {
  if (coin.exchangeId !== "binance") return null;
  if (coin.marketId.toUpperCase() === "BTCUSDT") return "btc";
  if (coin.marketId.toUpperCase() === "ETHUSDT") return "eth";
  return null;
}

export function homeInterestDetailTarget(coin: HomeInterestRouteSelection) {
  const canonical = canonicalAssetForHomeCoin(coin);
  if (canonical) {
    return {
      href: `/crypto/perpetual?asset=${canonical}&source=home-interest`,
      label: "전체 선물 분석 보기",
      exact: true,
      support: "selected-symbol" as const,
      continuity: "latest-reanalysis" as const,
      notice: "같은 종목을 최신 데이터로 다시 분석합니다. 홈과 상세 시각은 다를 수 있습니다."
    };
  }

  const base = coin.base.toUpperCase();
  if (coin.exchangeId === "binance" && supportedAltBases.has(base)) {
    return {
      href: `/crypto/perpetual/alts?focus=${base.toLowerCase()}&source=home-interest`,
      label: `${base} 알트 분석 보기`,
      exact: true,
      support: "selected-symbol" as const,
      continuity: "latest-reanalysis" as const,
      notice: `같은 ${base} 종목을 최신 데이터로 다시 분석합니다. 홈과 상세 시각은 다를 수 있습니다.`
    };
  }

  return {
    href: "/crypto/perpetual/alts?source=home-interest",
    label: "알트 레이더 열기",
    exact: false,
    support: "radar-directory" as const,
    continuity: "latest-reanalysis" as const,
    notice: "이 거래소·종목은 전용 상세 연결을 아직 지원하지 않아 지원 중인 알트 레이더 전체를 엽니다."
  };
}
