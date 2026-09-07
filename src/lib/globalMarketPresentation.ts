export type GlobalPressureTone = "supportive" | "burden" | "mixed";

export function globalPressureForChange(symbol: string, changePercent: number): GlobalPressureTone {
  if (!Number.isFinite(changePercent) || Math.abs(changePercent) < 0.25) return "mixed";
  if (["^VIX", "VIXY", "UUP", "GLD"].includes(symbol)) {
    return changePercent > 0 ? "burden" : "supportive";
  }
  if (symbol === "CL=F") {
    return changePercent >= 1.2 ? "burden" : changePercent <= -1.2 ? "supportive" : "mixed";
  }
  return changePercent > 0 ? "supportive" : "burden";
}

export function globalProxyInterpretation(symbol: string, changePercent: number, label: string): string | null {
  const isVolatility = symbol === "^VIX" || symbol === "VIXY";
  const isDollar = symbol === "UUP";
  const isBond = ["TLT", "ZN=F", "IEF", "SHY"].includes(symbol);
  if (!isVolatility && !isDollar && !isBond) return null;
  if (!Number.isFinite(changePercent)) return `${label} 변동률을 확인하지 못해 해석을 보류합니다.`;
  const formatted = `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}%`;
  const tone = globalPressureForChange(symbol, changePercent);
  if (tone === "mixed") {
    return `${label}는 ${formatted}로 소폭 변동 중입니다. 반올림 전 ±0.25% 미만으로 뚜렷한 압력 변화는 없습니다.`;
  }
  if (isVolatility) return tone === "burden"
    ? `변동성 프록시가 ${formatted}로 올라 리스크 점검이 우선입니다.`
    : `변동성 프록시가 ${formatted}로 내려 위험자산 부담이 줄었습니다.`;
  if (isDollar) return tone === "burden"
    ? `UUP 달러 프록시가 ${formatted}로 강해 성장주에는 부담입니다.`
    : `UUP 달러 프록시가 ${formatted}로 약해 위험자산 부담이 줄었습니다.`;
  return tone === "supportive"
    ? `${label}가 ${formatted}로 올라 금리 부담 완화 프록시로 봅니다.`
    : `${label}가 ${formatted}로 약해 금리 부담을 점검해야 합니다.`;
}

export interface GlobalDataAsOf {
  oldestCandleAt: string;
  newestCandleAt: string;
}

export function globalDataAsOf(candleTimes: readonly number[]): GlobalDataAsOf | null {
  const valid = candleTimes.filter((time) => Number.isFinite(time) && time > 0 && time * 1_000 <= 8.64e15);
  if (valid.length === 0) return null;
  return {
    oldestCandleAt: new Date(Math.min(...valid) * 1_000).toISOString(),
    newestCandleAt: new Date(Math.max(...valid) * 1_000).toISOString()
  };
}

export function globalDataReferenceLabel(asOf: GlobalDataAsOf | null | undefined) {
  if (!asOf || !Number.isFinite(Date.parse(asOf.oldestCandleAt)) || !Number.isFinite(Date.parse(asOf.newestCandleAt))) {
    return "거래 데이터 기준일 확인 필요";
  }
  const format = (value: string) => new Intl.DateTimeFormat("ko-KR", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date(value));
  const first = format(asOf.oldestCandleAt);
  const last = format(asOf.newestCandleAt);
  return `${first === last ? first : `${first} ~ ${last}`} 일봉 데이터 기준 · 미국 동부 날짜`;
}
