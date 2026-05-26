// 코인 레이더 화면에서 쓰는 고정 옵션과 저장 키를 모은 파일입니다.
import type { ChartTimeframe } from "@/lib/marketAnalysis";
import type { AnalysisMode, MsbMode, OverlaySettings, RadarProfile, StructureSensitivity } from "@/components/crypto/types";

export const symbols = [
  "BTCUSDT.P",
  "ETHUSDT.P",
  "XRPUSDT.P",
  "SOLUSDT.P",
  "DOGEUSDT.P",
  "ADAUSDT.P",
  "LINKUSDT.P",
  "AVAXUSDT.P",
  "SUIUSDT.P",
  "LTCUSDT.P"
];

export const majorSymbols = symbols.slice(0, 2);
export const altSymbols = symbols.slice(2);
export const altAnalysisFreeLimit = 3;
export const timeframeScoreLimit = 6.25;
export const storagePrefix = "chartRadar";
export const altAnalysisUsageStorageKey = `${storagePrefix}.altAnalysisUsage.v1`;
export const legacyPreviousBrandStoragePrefix = "position" + "guard";
export const legacyChannelStoragePrefix = "co" + "ters";
export const overlaySettingsStorageKey = `${storagePrefix}.overlaySettings.v1`;
export const legacyOverlaySettingsStorageKeys = [
  `${legacyPreviousBrandStoragePrefix}.overlaySettings.v1`,
  `${legacyChannelStoragePrefix}.overlaySettings.v1`
];
export const showPineParityTools = process.env.NEXT_PUBLIC_SHOW_PINE_PARITY_TOOLS === "1";

export const cryptoMajorChartHeightClass = "h-[260px] w-full sm:h-[520px]";
export const cryptoDefaultChartHeightClass = "h-[420px] w-full sm:h-[520px]";

// 기본은 캔들만 보이게 둔다. 구조 판독은 차트 아래 카드에서 분리해 보여준다.
export const defaultOverlaySettings: OverlaySettings = {
  ema200: false,
  poc: false,
  orderBlocks: false,
  fvgs: false,
  ote: false,
  msb: false,
  choch: false,
  sweep: false,
  cisd: false
};

export const overlayPresets = {
  all: {
    ema200: true,
    poc: true,
    orderBlocks: true,
    fvgs: true,
    ote: true,
    msb: true,
    choch: true,
    sweep: true,
    cisd: true
  } satisfies OverlaySettings,
  structure: {
    ema200: true,
    poc: true,
    orderBlocks: false,
    fvgs: false,
    ote: false,
    msb: true,
    choch: true,
    sweep: true,
    cisd: true
  } satisfies OverlaySettings,
  zones: {
    ema200: false,
    poc: true,
    orderBlocks: true,
    fvgs: true,
    ote: true,
    msb: false,
    choch: false,
    sweep: false,
    cisd: false
  } satisfies OverlaySettings,
  minimal: {
    ema200: false,
    poc: false,
    orderBlocks: false,
    fvgs: false,
    ote: false,
    msb: false,
    choch: false,
    sweep: false,
    cisd: false
  } satisfies OverlaySettings
};

export const radarProfileOptions: Array<{
  key: RadarProfile;
  label: string;
  description: string;
}> = [
  { key: "combined", label: "종합", description: "구조와 지표를 함께 요약" },
  { key: "ict", label: "ICT 구조", description: "MSB, CHoCH, OB, FVG 중심" },
  { key: "technical", label: "기술지표", description: "RSI, MACD, 거래량 중심" }
];

export const structureSensitivityOptions: Array<{
  value: StructureSensitivity;
  label: string;
  description: string;
  analysisMode: AnalysisMode;
  msbMode: MsbMode;
  detail: string;
}> = [
  {
    value: 5,
    label: "빠른 변화 감지",
    description: "짧은 흐름을 더 빨리 잡습니다.",
    analysisMode: "aggressive",
    msbMode: "wick",
    detail: "빠른 반응, 감지 범위 넓음, 변동성 민감"
  },
  {
    value: 7,
    label: "균형 감지",
    description: "기본값으로 쓰기 좋습니다.",
    analysisMode: "confirmed",
    msbMode: "wick",
    detail: "균형 반응, 기본 기준, 노이즈 완화"
  },
  {
    value: 9,
    label: "큰 구조 위주",
    description: "큰 추세 전환을 봅니다.",
    analysisMode: "confirmed",
    msbMode: "close",
    detail: "큰 흐름 중심, 신호 적음, 확인 우선"
  }
];

export const MAJOR_STRENGTH_HELP = [
  "판단 강도는 현재 레이더가 한쪽 방향으로 얼마나 뚜렷하게 기울었는지를 나타냅니다.",
  "높을수록 조건이 더 선명하지만, 진입을 보장하지는 않습니다.",
  "낮을수록 신호가 약하거나 관망 성격이 강합니다."
];

export const timeframeMinutes: Record<ChartTimeframe, number> = {
  "5m": 5,
  "15m": 15,
  "1h": 60,
  "4h": 240,
  "1d": 1440
};
