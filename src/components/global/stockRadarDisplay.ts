// 글로벌 자산레이더의 가격, 시간, 방향, 그룹 안내 문구를 포맷한다.
import type { Time } from "lightweight-charts";
import type { ChartTimeframe, DirectionState } from "@/lib/marketAnalysis";
import type { StockSymbolInfo } from "@/lib/stockMarket";
import type { TechnicalRadarReport } from "@/lib/technicalRadar";
import { timeframeMinutes } from "@/components/global/stockRadarConfig";

export function formatPrice(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "미확인";
  return value.toLocaleString("ko-KR", { maximumFractionDigits: value >= 100 ? 2 : 4 });
}

export function symbolName(symbol: string, universe: StockSymbolInfo[]) {
  const found = universe.find((item) => item.symbol === symbol);
  return found ? found.name : symbol;
}

export function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "미확인";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function directionLabel(value: DirectionState) {
  if (value === "bullish") return "상승";
  if (value === "bearish") return "하락";
  if (value === "neutral") return "횡보";
  return "미확인";
}

export function directionClass(value: DirectionState) {
  if (value === "bullish") return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
  if (value === "bearish") return "border-rose-300/25 bg-rose-400/10 text-rose-100";
  return "border-transparent bg-ui-elevated text-slate-200";
}

export function formatAgeByTimeframe(age: number | undefined, timeframe: ChartTimeframe) {
  if (age === undefined || age < 0) return "시간 미확인";
  if (age === 0) return "현재 캔들";
  const minutes = age * timeframeMinutes[timeframe];
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours}시간 ${rest}분 전` : `${hours}시간 전`;
  }
  const days = Math.floor(minutes / 1440);
  const restHours = Math.floor((minutes % 1440) / 60);
  return restHours ? `${days}일 ${restHours}시간 전` : `${days}일 전`;
}

export function formatIndexAge(index: number | undefined, candlesLength: number, timeframe: ChartTimeframe) {
  if (index === undefined) return "시간 미확인";
  return formatAgeByTimeframe(Math.max(0, candlesLength - 1 - index), timeframe);
}

export function formatKstChartTime(time: Time, timeframe: ChartTimeframe) {
  const seconds =
    typeof time === "number"
      ? time
      : typeof time === "string"
        ? Date.parse(`${time}T00:00:00Z`) / 1000
        : Date.UTC(time.year, time.month - 1, time.day) / 1000;
  const date = new Date(seconds * 1000 + 9 * 60 * 60 * 1000);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  if (timeframe === "1d") return `${month}/${day}`;
  return `${month}/${day} ${hour}:${minute}`;
}

export function formatZonePrice(low: number | null | undefined, high: number | null | undefined) {
  if (typeof low !== "number" || typeof high !== "number") return "미확인";
  return `${formatPrice(low)} - ${formatPrice(high)}`;
}

export function directionTone(report: TechnicalRadarReport | null) {
  if (!report) return "neutral";
  if (report.bullishCount >= report.bearishCount + 3) return "bullish";
  if (report.bearishCount >= report.bullishCount + 3) return "bearish";
  return "neutral";
}

export function toneBadgeClass(tone: "bullish" | "bearish" | "neutral") {
  if (tone === "bullish") return "border-emerald-400/25 bg-emerald-500/10 text-emerald-200";
  if (tone === "bearish") return "border-rose-400/25 bg-rose-500/10 text-rose-200";
  return "border-sky-300/25 bg-sky-400/10 text-sky-100";
}

function isOvernightRange(minutes: number, start: number, end: number) {
  return start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

export function getGlobalSessionState(now = new Date()) {
  const kstMinutes = ((now.getUTCHours() + 9) % 24) * 60 + now.getUTCMinutes();
  const isUsDst = now.getUTCMonth() >= 2 && now.getUTCMonth() <= 10;
  const regularStart = isUsDst ? 22 * 60 + 30 : 23 * 60 + 30;
  const regularEnd = isUsDst ? 5 * 60 : 6 * 60;
  const preStart = isUsDst ? 17 * 60 : 18 * 60;
  const afterEnd = isUsDst ? 9 * 60 : 10 * 60;

  if (isOvernightRange(kstMinutes, regularStart, regularEnd)) {
    return {
      title: "미국 정규장 진행 중",
      detail: "가격 반응과 거래량이 가장 잘 살아나는 구간입니다. 돌파 후 지지 전환과 장중 변동성을 함께 보세요.",
      tone: "bullish" as const
    };
  }

  if (kstMinutes >= preStart && kstMinutes < regularStart) {
    return {
      title: "프리마켓 관찰 구간",
      detail: "정규장 전에 갭 방향과 주요 뉴스 반응을 먼저 확인하는 시간입니다. 확정은 정규장 초반 거래량까지 보는 편이 좋습니다.",
      tone: "neutral" as const
    };
  }

  if (isOvernightRange(kstMinutes, regularEnd, afterEnd)) {
    return {
      title: "애프터마켓 확인 구간",
      detail: "실적과 장마감 뉴스가 가격에 반영되는 구간입니다. 다음 정규장 기준선을 미리 정리하기 좋습니다.",
      tone: "neutral" as const
    };
  }

  return {
    title: "장 마감·장전 점검 구간",
    detail: "새 캔들이 적은 시간대입니다. 지금은 후보 선별과 지지·저항 기준선 정리에 더 적합합니다.",
    tone: "neutral" as const
  };
}

export function groupPlaybook(group: StockSymbolInfo["group"] | undefined) {
  if (group === "futures") return "해외선물은 본장 전후에도 민감하게 움직입니다. 지수와 달러, 금리, 원자재 뉴스를 함께 보며 과한 레버리지 추격을 조심하세요.";
  if (group === "index_etf") return "지수 ETF는 전체 시장 방향의 기준선입니다. SPY와 QQQ가 같은 방향이면 개별 종목 신뢰도가 올라갑니다.";
  if (group === "macro_proxy") return "매크로 프록시는 실제 DXY나 10Y yield 대신 달러, 채권, 변동성 압력을 간접 확인하는 기준입니다. 방향보다 본장 반응과 함께 해석하세요.";
  if (group === "sector_etf") return "섹터 ETF는 시장 폭과 로테이션을 확인하는 기준입니다. 기술주만 강한지, 방어주가 앞서는지부터 확인하세요.";
  if (group === "mega_cap") return "빅테크는 실적, 금리, 나스닥 흐름에 민감합니다. 지수보다 강한지 약한지를 먼저 비교하세요.";
  if (group === "ai_chip") return "AI·반도체는 변동성이 큽니다. 강한 추세에서는 좋지만 과열 구간 추격은 위험도가 빠르게 올라갑니다.";
  if (group === "growth") return "성장주는 금리와 리스크온 심리에 민감합니다. 반등이 빨라도 지수와 거래량 확인이 중요합니다.";
  if (group === "finance") return "금융·섹터주는 금리와 경기 기대를 같이 봐야 합니다. 지수와 다른 움직임이면 섹터 이슈를 확인하세요.";
  if (group === "commodity") return "원자재 ETF는 달러, 금리, 지정학 이슈 영향을 크게 받습니다. 차트와 매크로 캘린더를 같이 보세요.";
  return "선택한 자산의 그룹 특성을 확인하고, 지수 흐름과 비교해 상대 강도를 판단하세요.";
}

export function groupChecklist(group: StockSymbolInfo["group"] | undefined) {
  if (group === "futures") {
    return {
      compare: "같이 볼 시장. 달러, 금리, VIX, 관련 ETF",
      risk: "위험 포인트. 지표 발표 직후 급반전과 장 초반 휩쏘",
      action: "확인 순서. 1분 방향보다 15분과 1시간 기준선 안착을 먼저 봅니다."
    };
  }

  if (group === "index_etf") {
    return {
      compare: "같이 볼 시장. QQQ, SPY, VIX, TLT, 섹터 ETF",
      risk: "위험 포인트. 지수는 강한데 폭이 좁은 상승이면 추격 신뢰도가 낮아집니다.",
      action: "확인 순서. 지수 ETF와 선물이 같은 방향인지 먼저 맞춥니다."
    };
  }

  if (group === "macro_proxy") {
    return {
      compare: "같이 볼 시장. NQ, ES, QQQ, SPY, VIX, UUP",
      risk: "위험 포인트. 프록시는 실제 DXY와 10Y yield가 아니므로 방향 확인용으로만 봅니다.",
      action: "확인 순서. 프록시 방향과 지수선물 반응이 같은지 먼저 맞춥니다."
    };
  }

  if (group === "sector_etf") {
    return {
      compare: "같이 볼 시장. QQQ, SPY, SMH, 방어 섹터",
      risk: "위험 포인트. 지수는 강한데 섹터 확산이 좁으면 추격 신뢰도가 낮아집니다.",
      action: "확인 순서. 성장, 방어, 금융, 에너지 중 어느 축이 강한지 봅니다."
    };
  }

  if (group === "mega_cap") {
    return {
      compare: "같이 볼 시장. QQQ, XLK, 실적 일정, 옵션 만기 구간",
      risk: "위험 포인트. 개별 호재보다 지수와 섹터가 약하면 상승이 오래 버티기 어렵습니다.",
      action: "확인 순서. 선택 종목이 QQQ보다 강한지 상대 강도를 봅니다."
    };
  }

  if (group === "ai_chip") {
    return {
      compare: "같이 볼 시장. SMH, SOXX, NVDA, 금리, 달러",
      risk: "위험 포인트. 반도체는 좋은 자리도 변동폭이 커서 손절 기준이 좁으면 흔들립니다.",
      action: "확인 순서. SMH와 선택 종목이 같은 방향이면 후보 신뢰도가 올라갑니다."
    };
  }

  if (group === "growth") {
    return {
      compare: "같이 볼 시장. QQQ, ARKK, TLT, VIX",
      risk: "위험 포인트. 금리 상승과 위험회피 구간에서는 반등이 짧게 끝날 수 있습니다.",
      action: "확인 순서. 기술지표 과열보다 거래량과 지지선 회복을 먼저 봅니다."
    };
  }

  if (group === "finance") {
    return {
      compare: "같이 볼 시장. XLF, 금리, 은행주, 달러",
      risk: "위험 포인트. 금리 반응과 경기 우려가 엇갈리면 방향성이 갑자기 흐려집니다.",
      action: "확인 순서. XLF와 대형 금융주가 같은 방향인지 확인합니다."
    };
  }

  if (group === "commodity") {
    return {
      compare: "같이 볼 시장. 달러, 금리, 원자재 선물, 관련 ETF",
      risk: "위험 포인트. 원자재는 뉴스 한 줄에 갭과 긴 꼬리가 자주 나옵니다.",
      action: "확인 순서. 차트 기준선과 매크로 이벤트 시간을 함께 확인합니다."
    };
  }

  return {
    compare: "같이 볼 시장. QQQ, SPY, VIX, 금리",
    risk: "위험 포인트. 단독 종목보다 시장 전체 방향을 먼저 확인해야 합니다.",
    action: "확인 순서. 지수, 섹터, 선택 종목 순서로 좁혀갑니다."
  };
}
