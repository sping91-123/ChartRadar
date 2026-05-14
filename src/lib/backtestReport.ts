import type { TradingMode } from "@/lib/marketAnalysis";

export type BacktestRegime = "bull" | "bear" | "range";
export type BacktestSide = "long" | "short";
export type BacktestTone = "good" | "warn" | "danger" | "neutral";

export interface BacktestSummary {
  label: string;
  total: number;
  wins: number;
  losses: number;
  ambiguous: number;
  timeouts: number;
  noEntries: number;
  entryRate: number;
  winRateAll: number;
  winRateResolved: number;
  avgR: number;
  avgScore: number;
  avgMfePercent: number;
  avgMaePercent: number;
}

export interface BacktestReport {
  generatedAt: string;
  symbol: string;
  days: number;
  method: string[];
  strict: {
    /** Product-facing 검토 후보만. 관찰 카드는 별도 집계한다. */
    overall: BacktestSummary;
    watchOnly: BacktestSummary;
    byMode: BacktestSummary[];
    byRegime: BacktestSummary[];
    bySide: BacktestSummary[];
    byModeSideRegime: BacktestSummary[];
  };
  relaxed: {
    /** Research-only 완화 검토 후보만. 제품 화면 기준이 아니다. */
    overall: BacktestSummary;
    watchOnly: BacktestSummary;
    byMode: BacktestSummary[];
    byRegime: BacktestSummary[];
    bySide: BacktestSummary[];
    byModeSideRegime: BacktestSummary[];
  };
  radar: {
    overall: BacktestSummary;
    byMode: BacktestSummary[];
    bySide: BacktestSummary[];
    crossAsset: BacktestSummary[];
  };
  operatingRules: Array<{
    title: string;
    body: string;
    tone: BacktestTone;
  }>;
  crossAssetSmoke: Array<{
    symbol: string;
    days: number;
    total: number;
    wins: number;
    losses: number;
    timeouts: number;
    noEntries: number;
    avgR: number;
    note: string;
    tone: BacktestTone;
  }>;
}

function s(
  label: string,
  total: number,
  wins: number,
  losses: number,
  noEntries: number,
  winRateResolved: number,
  avgR: number,
  avgScore: number,
  avgMfePercent: number,
  avgMaePercent: number,
  extra?: Partial<BacktestSummary>
): BacktestSummary {
  return {
    label,
    total,
    wins,
    losses,
    ambiguous: 0,
    timeouts: 0,
    noEntries,
    entryRate: total ? Number((((total - noEntries) / total) * 100).toFixed(1)) : 0,
    winRateAll: total ? Number(((wins / total) * 100).toFixed(1)) : 0,
    winRateResolved,
    avgR,
    avgScore,
    avgMfePercent,
    avgMaePercent,
    ...extra
  };
}

export const latestBacktestReport: BacktestReport = {
  generatedAt: "2026-05-07T18:05:33+09:00",
  symbol: "BTCUSDT.P",
  days: 730,
  method: [
    "Binance USDT-M BTCUSDT perpetual futures candles were used.",
    "Regime was classified from the 4H trend into bull, bear, and range.",
    "Candles are cached locally in .backtest-cache so 365d/730d validation can be rerun without repeatedly hitting Binance limits.",
    "Sampling is aligned by candle timestamp, not by array position, so 365d and 730d windows evaluate the same clock times consistently.",
    "Strict mode mirrors the current scanner entry filters. Watch-only cards are reported separately and are not entry signals.",
    "Relaxed mode loosens filters for research only.",
    "The result checks whether target1/target2 or invalidation is touched first within a fixed forward window.",
    "This is mechanical validation, not a full exchange fill, fee, slippage, funding, or intrabar execution simulation."
  ],
  strict: {
    overall: s("검토 후보", 4, 3, 0, 1, 100, 1.13, 75, 1.36, 0.77),
    watchOnly: s("관찰 카드(진입 아님)", 4713, 1423, 1503, 632, 48.6, -0.04, 44.3, 0.56, 0.73, {
      ambiguous: 183,
      timeouts: 972,
      entryRate: 86.6,
      winRateAll: 30.2
    }),
    byMode: [s("1h·4h·1d", 4, 3, 0, 1, 100, 1.13, 75, 1.36, 0.77)],
    byRegime: [
      s("횡보장", 3, 2, 0, 1, 100, 1, 75, 0.99, 0.31),
      s("하락장", 1, 1, 0, 0, 100, 1.5, 75, 2.45, 2.15)
    ],
    bySide: [s("숏", 4, 3, 0, 1, 100, 1.13, 75, 1.36, 0.77)],
    byModeSideRegime: [
      s("스윙 숏 횡보장", 3, 2, 0, 1, 100, 1, 75, 0.99, 0.31),
      s("스윙 숏 하락장", 1, 1, 0, 0, 100, 1.5, 75, 2.45, 2.15)
    ]
  },
  relaxed: {
    overall: s("완화 검토 후보", 48, 9, 14, 15, 39.1, -0.01, 66.7, 0.87, 1.37, {
      timeouts: 10,
      entryRate: 68.8,
      winRateAll: 18.8
    }),
    watchOnly: s("완화 관찰 카드(진입 아님)", 4669, 1417, 1489, 618, 48.8, -0.03, 44.1, 0.55, 0.72, {
      ambiguous: 183,
      timeouts: 962,
      entryRate: 86.8,
      winRateAll: 30.3
    }),
    byMode: [
      s("완화 스윙", 48, 9, 14, 15, 39.1, -0.01, 66.7, 0.87, 1.37, {
        timeouts: 10,
        entryRate: 68.8,
        winRateAll: 18.8
      })
    ],
    byRegime: [
      s("완화 하락장", 9, 2, 2, 3, 50, 0.11, 65, 1.46, 1.37, {
        timeouts: 2,
        entryRate: 66.7,
        winRateAll: 22.2
      }),
      s("완화 상승장", 10, 1, 2, 4, 33.3, -0.05, 68, 1.18, 1.17, {
        timeouts: 3,
        entryRate: 60,
        winRateAll: 10
      }),
      s("완화 횡보장", 29, 6, 10, 8, 37.5, -0.03, 66.8, 0.57, 1.44, {
        timeouts: 5,
        entryRate: 72.4,
        winRateAll: 20.7
      })
    ],
    bySide: [
      s("완화 숏", 27, 7, 8, 9, 46.7, 0.09, 66.4, 0.52, 1.5, {
        timeouts: 3,
        entryRate: 66.7,
        winRateAll: 25.9
      }),
      s("완화 롱", 21, 2, 6, 6, 25, -0.14, 67.1, 1.31, 1.21, {
        timeouts: 7,
        entryRate: 71.4,
        winRateAll: 9.5
      })
    ],
    byModeSideRegime: [
      s("완화 스윙 숏 하락장", 7, 2, 2, 2, 50, 0.14, 66.4, 0.87, 1.69, {
        timeouts: 1,
        entryRate: 71.4,
        winRateAll: 28.6
      }),
      s("완화 스윙 숏 횡보장", 20, 5, 6, 7, 45.5, 0.07, 66.4, 0.4, 1.43, {
        timeouts: 2,
        entryRate: 65,
        winRateAll: 25
      }),
      s("완화 스윙 롱 상승장", 10, 1, 2, 4, 33.3, -0.05, 68, 1.18, 1.17, {
        timeouts: 3,
        entryRate: 60,
        winRateAll: 10
      }),
      s("완화 스윙 롱 횡보장", 9, 1, 4, 1, 20, -0.28, 67.7, 0.96, 1.47, {
        timeouts: 3,
        entryRate: 88.9,
        winRateAll: 11.1
      })
    ]
  },
  radar: {
    overall: s("공격적 분석 전체(비용 차감)", 228, 111, 31, 32, 78.2, 0.233, 47.1, 0.779, 0.661, {
      ambiguous: 14,
      timeouts: 40,
      entryRate: 86,
      winRateAll: 48.7
    }),
    byMode: [
      s("5m·15m 레이더", 179, 88, 22, 23, 80, 0.142, 43.4, 0.398, 0.517, {
        timeouts: 32,
        ambiguous: 14,
        entryRate: 87.2,
        winRateAll: 49.2
      }),
      s("1h·4h·1d 레이더", 49, 23, 9, 9, 71.9, 0.567, 60.8, 2.17, 1.19, {
        timeouts: 8,
        entryRate: 81.6,
        winRateAll: 46.9
      })
    ],
    bySide: [
      s("롱 레이더", 131, 64, 17, 19, 79, 0.3, 47.6, 0.96, 0.67, {
        timeouts: 23,
        ambiguous: 8,
        entryRate: 85.5,
        winRateAll: 48.9
      }),
      s("숏 레이더", 97, 47, 14, 13, 77, 0.143, 46.4, 0.55, 0.65, {
        timeouts: 17,
        ambiguous: 6,
        entryRate: 86.6,
        winRateAll: 48.5
      })
    ],
    crossAsset: [
      s("BTC 레이더", 88, 41, 14, 12, 74.5, 0.14, 46.6, 0.5, 0.547, {
        timeouts: 19,
        ambiguous: 2,
        entryRate: 86.4,
        winRateAll: 46.6
      }),
      s("ETH 레이더", 22, 12, 5, 2, 70.6, 0.632, 62.6, 3.125, 1.118, {
        timeouts: 3,
        entryRate: 90.9,
        winRateAll: 54.5
      }),
      s("SOL 레이더", 25, 13, 3, 7, 81.3, 0.227, 45.6, 0.495, 0.89, {
        timeouts: 2,
        entryRate: 72,
        winRateAll: 52
      }),
      s("XRP 레이더", 21, 8, 1, 5, 88.9, 0.4, 48.2, 0.753, 0.619, {
        timeouts: 4,
        ambiguous: 3,
        entryRate: 76.2,
        winRateAll: 38.1
      }),
      s("DOGE 레이더", 45, 22, 5, 6, 81.5, 0.187, 43.5, 0.569, 0.672, {
        timeouts: 3,
        ambiguous: 9,
        entryRate: 86.7,
        winRateAll: 48.9
      }),
      s("BNB 레이더", 27, 15, 3, 0, 83.3, 0.165, 42.1, 0.409, 0.462, {
        timeouts: 9,
        entryRate: 100,
        winRateAll: 55.6
      })
    ]
  },
  operatingRules: [
    {
      title: "엄격 기준은 추천 엔진이 아니라 위험 차단 장치다",
      body: "730일 검증에서 엄격 기준 후보는 4개뿐입니다. 표본은 작지만 손실 후보를 걸러냈습니다. 이 판독은 많은 진입을 보여주기보다, 들어가면 안 되는 자리를 줄이는 데 더 강점이 있습니다.",
      tone: "good"
    },
    {
      title: "스윙 4H는 구조 방향만으로 통과시키지 않는다",
      body: "검증 중 4H 후보에서 OB/FVG 내부도 아니고 OTE도 아닌 숏 후보 4개가 전부 손절로 확인됐습니다. 그래서 4H 스윙 후보는 실제 반응 구간 또는 OTE가 없으면 차단하도록 수정했습니다.",
      tone: "danger"
    },
    {
      title: "완화 조건은 제품 화면에 추천처럼 노출하지 않는다",
      body: "완화 기준은 후보가 48개로 늘었지만 평균 R이 -0.01까지 내려갔습니다. 후보 수를 늘리는 것은 사용자 체류에는 좋아 보여도 실제 매매 보호에는 해롭습니다.",
      tone: "warn"
    },
    {
      title: "현재 유효한 축은 스윙 1H 숏 중심이다",
      body: "현 기준에서 살아남은 후보는 대부분 1H 숏 구조에 몰려 있습니다. 다른 타임프레임과 롱 구조는 별도 기준을 더 검증하기 전까지 강하게 보수적으로 운용해야 합니다.",
      tone: "neutral"
    },
    {
      title: "POC와 킬존 바깥 후보는 계속 위험 신호로 둔다",
      body: "완화 손실 후보의 상당수가 킬존 바깥 또는 POC 균형 구간과 겹쳤습니다. 특히 레버리지 사용자는 방향보다 흔들림에 먼저 털릴 수 있으므로 이 조건은 계속 경고로 유지합니다.",
      tone: "danger"
    }
  ],
  crossAssetSmoke: [
    {
      symbol: "ETHUSDT.P",
      days: 365,
      total: 1,
      wins: 0,
      losses: 1,
      timeouts: 0,
      noEntries: 0,
      avgR: -1,
      note: "롱 후보 1개가 손절. ETH는 현재 기준을 그대로 확장하면 안 됩니다.",
      tone: "danger"
    },
    {
      symbol: "SOLUSDT.P",
      days: 365,
      total: 1,
      wins: 0,
      losses: 1,
      timeouts: 0,
      noEntries: 0,
      avgR: -1,
      note: "롱 후보 1개가 손절. SOL도 별도 필터 검증 전까지 추천성 노출 금지.",
      tone: "danger"
    },
    {
      symbol: "XRPUSDT.P",
      days: 365,
      total: 5,
      wins: 2,
      losses: 0,
      timeouts: 3,
      noEntries: 0,
      avgR: 0.6,
      note: "숏 후보만 발생했고 손실은 없었습니다. 다만 시간초과가 많아 보수적 표기 필요.",
      tone: "good"
    }
  ]
};

export function modeLabel(mode: TradingMode) {
  return mode === "scalp" ? "5m·15m" : "1h·4h·1d";
}
