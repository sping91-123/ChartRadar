// 진입 진단 폼과 결과에서 사용하는 공통 타입을 정의한다.
export type CoinOption = "BTC" | "ETH" | "SOL" | "XRP" | "DOGE" | "직접입력";
export type Direction = "롱" | "숏";
export type TimeFrame = "5m" | "15m" | "1h" | "4h" | "1d";
export type HigherTrend = "상승" | "하락" | "횡보" | "모르겠음";
export type CurrentLocation =
  | "지지 근처"
  | "저항 근처"
  | "중간값"
  | "고점 추격"
  | "저점 추격"
  | "모르겠음";
export type StopLossStatus = "있음" | "없음";
export type RiskPercentPreset = "0.5" | "1" | "2" | "3" | "직접입력";
export type Verdict = "진입 금지" | "관찰 필요" | "검토 가능";

export interface DiagnosisFormValues {
  coin: CoinOption;
  customCoin: string;
  direction: Direction;
  timeFrame: TimeFrame;
  higherTrend: HigherTrend;
  currentLocation: CurrentLocation;
  stopLossStatus: StopLossStatus;
  entryPrice: string;
  stopLossPrice: string;
  totalSeed: string;
  riskPercentPreset: RiskPercentPreset;
  customRiskPercent: string;
  leverage: string;
}

export interface PositionSizing {
  allowedLossAmount: number;
  positionNotional: number;
  requiredMargin: number;
  expectedLossOnStop: number;
  seedLossRate: number;
  priceGapRate: number;
}

export interface DiagnosisResult {
  riskScore: number;
  verdict: Verdict;
  violations: string[];
  advice: string;
  leverageWarning: string;
  positionSizing: PositionSizing | null;
  missingRequiredValues: boolean;
}
