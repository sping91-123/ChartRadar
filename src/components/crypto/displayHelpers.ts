// 코인 레이더 화면 표시 문구와 클래스 helper를 모은 파일입니다.
import type { ChartTimeframe, DirectionState, MarketAnalysis, ReasonTone } from "@/lib/marketAnalysis";
import { timeframeMinutes } from "@/components/crypto/constants";

export function formatPrice(value: number) {
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: value > 100 ? 2 : 5
  }).format(value);
}

export function symbolLabel(symbol: string) {
  return symbol.replace("USDT.P", "");
}

export function biasLabel(bias?: MarketAnalysis["bias"]) {
  if (bias === "long") return "롱 우세";
  if (bias === "short") return "숏 우세";
  return "횡보 관찰";
}

export function formatUpdatedAt(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(value));
}

export function stateLabel(value: string) {
  if (value === "bullish") return "상승";
  if (value === "bearish") return "하락";
  if (value === "neutral") return "횡보";
  if (value === "above") return "위";
  if (value === "below") return "아래";
  if (value === "near") return "근처";
  if (value === "long") return "롱";
  if (value === "short") return "숏";
  if (value === "premium") return "프리미엄";
  if (value === "discount") return "디스카운트";
  if (value === "equilibrium") return "중간";
  if (value === "none") return "없음";
  return "데이터 부족";
}

export function killzoneLabel(value?: string) {
  if (value === "asia") return "아시아";
  if (value === "london") return "런던";
  if (value === "newyork") return "뉴욕";
  return "바깥";
}

export function biasClasses(bias?: string) {
  if (bias === "long") return "border-signal-success/25 bg-signal-success/10 text-signal-success";
  if (bias === "short") return "border-signal-danger/25 bg-signal-danger/10 text-signal-danger";
  return "border-signal-warning/25 bg-signal-warning/10 text-signal-warning";
}

export function biasAccentLine(bias?: string) {
  if (bias === "long") return "bg-signal-success/70";
  if (bias === "short") return "bg-signal-danger/70";
  return "bg-signal-warning/70";
}

export function directionBadge(direction: DirectionState) {
  if (direction === "bullish") return "border-signal-success/30 bg-signal-success/10 text-signal-success";
  if (direction === "bearish") return "border-signal-danger/30 bg-signal-danger/10 text-signal-danger";
  return "border-white/10 bg-black/20 text-slate-300";
}

export function reasonClasses(tone: ReasonTone) {
  if (tone === "bullish") return "border-signal-success/30 bg-signal-success/10 text-signal-success";
  if (tone === "bearish") return "border-signal-danger/30 bg-signal-danger/10 text-signal-danger";
  return "border-white/10 bg-black/25 text-slate-200";
}

export function readinessClasses(readiness?: MarketAnalysis["readiness"]) {
  if (readiness === "high") return "border-signal-success/30 bg-signal-success/10 text-signal-success";
  if (readiness === "medium") return "border-signal-warning/30 bg-signal-warning/10 text-signal-warning";
  return "border-white/10 bg-black/20 text-slate-300";
}

export function readinessLabel(readiness?: MarketAnalysis["readiness"]) {
  if (readiness === "high") return "신뢰 높음";
  if (readiness === "medium") return "신뢰 보통";
  return "신뢰 낮음";
}

export function formatIndicatorValue(value: number | null, digits = 2, suffix = "") {
  if (value === null || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString("ko-KR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })}${suffix}`;
}

export function conditionLabel(value: string) {
  if (value === "trendUp") return "상승 추세";
  if (value === "trendDown") return "하락 추세";
  if (value === "range") return "횡보";
  if (value === "compression") return "변동성 압축";
  if (value === "expansion") return "변동성 확장";
  if (value === "mixed") return "혼조";
  if (value === "bullish") return "상승 우세";
  if (value === "bearish") return "하락 우세";
  if (value === "flat") return "기울기 약함";
  if (value === "breakoutUp") return "상단 돌파";
  if (value === "breakoutDown") return "하단 이탈";
  if (value === "overbought") return "과열권";
  if (value === "oversold") return "침체권";
  if (value === "rising") return "상승 모멘텀";
  if (value === "falling") return "하락 모멘텀";
  if (value === "expanded") return "변동성 확대";
  if (value === "compressed") return "변동성 축소";
  if (value === "high") return "거래량 증가";
  if (value === "low") return "거래량 둔화";
  if (value === "upper") return "상단권";
  if (value === "middle") return "중단권";
  if (value === "lower") return "하단권";
  if (value === "outsideUpper") return "상단 이탈";
  if (value === "outsideLower") return "하단 이탈";
  if (value === "normal") return "보통";
  return "데이터 부족";
}

export function conditionTone(value: string) {
  if (value === "bullish" || value === "trendUp" || value === "breakoutUp") {
    return "border-signal-success/25 bg-signal-success/10 text-signal-success";
  }
  if (value === "bearish" || value === "trendDown" || value === "breakoutDown") {
    return "border-signal-warning/25 bg-signal-warning/10 text-signal-warning";
  }
  if (value === "compression" || value === "expansion") {
    return "border-accent-blue/25 bg-accent-blue/10 text-accent-blue";
  }
  if (value === "rising" || value === "lower" || value === "outsideLower") {
    return "border-signal-success/25 bg-signal-success/10 text-signal-success";
  }
  if (value === "falling" || value === "overbought" || value === "expanded" || value === "upper" || value === "outsideUpper") {
    return "border-signal-warning/25 bg-signal-warning/10 text-signal-warning";
  }
  if (value === "oversold" || value === "low" || value === "compressed" || value === "high") {
    return "border-accent-blue/25 bg-accent-blue/10 text-accent-blue";
  }
  return "border-white/10 bg-black/20 text-slate-300";
}

export function aiStateLabel(value?: string | null) {
  if (value === "bullish") return "상승";
  if (value === "bearish") return "하락";
  if (value === "neutral") return "횡보";
  if (value === "above") return "위";
  if (value === "below") return "아래";
  if (value === "near") return "근처";
  if (value === "long") return "롱";
  if (value === "short") return "숏";
  if (value === "premium") return "프리미엄";
  if (value === "discount") return "디스카운트";
  if (value === "equilibrium") return "중간";
  if (value === "none") return "없음";
  return "데이터 부족";
}

export function aiConditionLabel(value?: string | null) {
  if (value === "trendUp") return "상승 추세";
  if (value === "trendDown") return "하락 추세";
  if (value === "range") return "횡보";
  if (value === "compression") return "변동성 압축";
  if (value === "expansion") return "변동성 확장";
  if (value === "mixed") return "혼조";
  if (value === "bullish") return "상승 우세";
  if (value === "bearish") return "하락 우세";
  if (value === "flat") return "기울기 약함";
  if (value === "breakoutUp") return "상단 돌파";
  if (value === "breakoutDown") return "하단 이탈";
  if (value === "overbought") return "과열권";
  if (value === "oversold") return "침체권";
  if (value === "rising") return "상승 모멘텀";
  if (value === "falling") return "하락 모멘텀";
  if (value === "expanded") return "변동성 확대";
  if (value === "compressed") return "변동성 축소";
  if (value === "high") return "거래량 증가";
  if (value === "low") return "거래량 약화";
  if (value === "upper") return "상단권";
  if (value === "middle") return "중단권";
  if (value === "lower") return "하단권";
  if (value === "outsideUpper") return "상단 이탈";
  if (value === "outsideLower") return "하단 이탈";
  if (value === "normal") return "보통";
  return "데이터 부족";
}

export function formatPriceRange(low: number, high: number) {
  return `${formatPrice(low)} - ${formatPrice(high)}`;
}

export function planQualityClasses(quality?: string) {
  if (quality === "A") return "border-signal-success/30 bg-signal-success/10 text-signal-success";
  if (quality === "B") return "border-accent-blue/30 bg-accent-blue/10 text-accent-blue";
  return "border-signal-warning/30 bg-signal-warning/10 text-signal-warning";
}

export function barsAgoLabel(age: number, timeframe: ChartTimeframe = "15m") {
  if (age <= 0) return "방금";
  const minutes = age * timeframeMinutes[timeframe];
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 1440) {
    const hours = minutes / 60;
    return Number.isInteger(hours) ? `${hours}시간 전` : `${hours.toFixed(1)}시간 전`;
  }
  const days = minutes / 1440;
  return Number.isInteger(days) ? `${days}일 전` : `${days.toFixed(1)}일 전`;
}

export function eventDirectionLabel(direction: "bullish" | "bearish") {
  return direction === "bullish" ? "상승" : "하락";
}
