// 뉴스 원문을 Chart Radar용 한국어 시장 이슈로 분류합니다.
export type RadarNewsDirection = "bullish" | "bearish" | "neutral";
export type RadarNewsUrgency = "high" | "medium" | "low";
export type RadarNewsMarket = "crypto" | "stocks";

export type RadarNewsSignal = {
  direction: RadarNewsDirection;
  urgency: RadarNewsUrgency;
  score: number;
  assets: string[];
  tags: string[];
  headline: string;
  summary: string;
  actionHint: string;
};

export type RadarNewsItem = RadarNewsSignal & {
  id: string;
  source: string;
  title: string;
  translatedTitle?: string;
  link: string;
  publishedAt: string;
};

export type RadarNewsBriefingIssue = {
  title: string;
  detail: string;
  tone: RadarNewsDirection;
};

export type RadarNewsBriefing = {
  generatedAt: string;
  model: string;
  overview: string;
  keyIssues: RadarNewsBriefingIssue[];
  marketImpact: string[];
  strategyNotes: string[];
  finalSummary: string;
};

const sourceDisplayNames: Record<string, string> = {
  Official: "공식 일정",
  BLS: "미국 노동통계국",
  BEA: "미국 경제분석국",
  Census: "미국 인구조사국",
  Fed: "연준",
  NAR: "미국 부동산중개인협회",
  "Yahoo Finance": "야후 파이낸스",
  CoinDesk: "코인 전문 뉴스",
  Cointelegraph: "글로벌 코인 뉴스",
  CryptoPanic: "크립토패닉",
  "CNBC Markets": "미국 증시 뉴스",
  MarketWatch: "미국 시장 뉴스"
};

const cryptoAssetRules = [
  { asset: "BTC", keywords: ["btc", "bitcoin", "비트코인", "spot bitcoin", "bitcoin etf"] },
  { asset: "ETH", keywords: ["eth", "ethereum", "이더리움", "ether", "ethereum etf"] },
  { asset: "XRP", keywords: ["xrp", "ripple", "리플"] },
  { asset: "SOL", keywords: ["sol", "solana", "솔라나"] },
  { asset: "DOGE", keywords: ["doge", "dogecoin", "도지"] },
  { asset: "알트코인", keywords: ["altcoin", "알트코인", "alts", "memecoin", "defi", "layer 2"] }
];

const stockAssetRules = [
  { asset: "SPY", keywords: ["spy", "s&p", "s&p 500", "spx", "index"] },
  { asset: "QQQ", keywords: ["qqq", "nasdaq", "nasdaq 100", "ndx", "tech"] },
  { asset: "NVDA", keywords: ["nvda", "nvidia", "ai chip", "gpu", "엔비디아"] },
  { asset: "TSLA", keywords: ["tsla", "tesla", "테슬라", "ev"] },
  { asset: "AAPL", keywords: ["aapl", "apple", "애플", "iphone"] },
  { asset: "MSFT", keywords: ["msft", "microsoft", "azure", "마이크로소프트"] },
  { asset: "META", keywords: ["meta", "facebook", "메타"] },
  { asset: "AMZN", keywords: ["amzn", "amazon", "aws", "아마존"] },
  { asset: "GOOGL", keywords: ["googl", "google", "alphabet", "구글"] },
  { asset: "AMD", keywords: ["amd", "advanced micro devices"] },
  { asset: "GLD", keywords: ["gold", "gld", "precious metal", "금"] },
  { asset: "USO", keywords: ["oil", "crude", "wti", "uso", "원유"] },
  { asset: "TLT", keywords: ["treasury", "yield", "bond", "tlt", "국채", "금리"] }
];

type Rule = {
  keywords: string[];
  score: number;
  tag: string;
};

const cryptoBullishRules: Rule[] = [
  { keywords: ["etf inflow", "inflows", "approval", "approved", "승인", "유입", "accumulation"], score: 13, tag: "수요 유입" },
  { keywords: ["record high", "all-time high", "ath", "breakout", "rally", "surge", "soars", "급등", "돌파"], score: 11, tag: "상승 모멘텀" },
  { keywords: ["institutional", "blackrock", "fidelity", "microstrategy", "treasury", "기관"], score: 9, tag: "기관 수요" },
  { keywords: ["rate cut", "cuts rates", "liquidity", "stimulus", "금리 인하", "유동성"], score: 8, tag: "매크로 완화" },
  { keywords: ["partnership", "launches", "mainnet", "upgrade", "출시", "업그레이드"], score: 6, tag: "프로젝트 호재" }
];

const cryptoBearishRules: Rule[] = [
  { keywords: ["hack", "exploit", "drain", "stolen", "해킹", "취약점", "도난"], score: -15, tag: "보안 리스크" },
  { keywords: ["lawsuit", "sues", "charges", "sec", "cftc", "소송", "기소", "제재", "규제"], score: -12, tag: "규제 리스크" },
  { keywords: ["outflows", "sell-off", "liquidation", "dump", "plunge", "급락", "청산", "매도", "유출"], score: -12, tag: "매도 압력" },
  { keywords: ["bankruptcy", "insolvency", "파산", "delist", "상장폐지"], score: -14, tag: "신용 리스크" },
  { keywords: ["rate hike", "higher rates", "inflation", "hawkish", "금리 인상", "물가"], score: -8, tag: "매크로 부담" }
];

const stockBullishRules: Rule[] = [
  { keywords: ["earnings beat", "beats estimates", "raised guidance", "raises guidance", "upgrade", "buyback", "record revenue"], score: 12, tag: "실적 호조" },
  { keywords: ["rate cut", "lower yields", "soft landing", "dovish", "liquidity"], score: 10, tag: "금리 완화" },
  { keywords: ["ai demand", "chip demand", "data center", "cloud growth", "semiconductor"], score: 9, tag: "성장 테마" },
  { keywords: ["rally", "record high", "breakout", "surge", "rebounds"], score: 8, tag: "가격 모멘텀" },
  { keywords: ["etf inflow", "inflows", "institutional", "fund flows"], score: 7, tag: "수급 개선" }
];

const stockBearishRules: Rule[] = [
  { keywords: ["earnings miss", "misses estimates", "cuts guidance", "lowered guidance", "downgrade"], score: -13, tag: "실적 리스크" },
  { keywords: ["higher yields", "rate hike", "hawkish", "inflation", "sticky inflation"], score: -11, tag: "금리 부담" },
  { keywords: ["sell-off", "plunge", "slumps", "correction", "bear market"], score: -10, tag: "가격 조정" },
  { keywords: ["antitrust", "lawsuit", "probe", "sec", "doj", "regulation"], score: -9, tag: "규제 리스크" },
  { keywords: ["recession", "slowdown", "weak demand", "layoffs", "tariff"], score: -9, tag: "경기 둔화" }
];

const urgencyRules: Rule[] = [
  { keywords: ["breaking", "urgent", "sec", "cftc", "fed", "fomc", "binance", "coinbase", "blackrock", "hack", "liquidation", "etf"], score: 1, tag: "즉시 확인" },
  { keywords: ["속보", "긴급", "청산", "해킹", "금리", "FOMC"], score: 1, tag: "속보성" }
];

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function clamp(min: number, max: number, value: number) {
  return Math.min(max, Math.max(min, value));
}

function hasKorean(value: string) {
  return /[가-힣]/.test(value);
}

function rulesForMarket(market: RadarNewsMarket) {
  return market === "stocks"
    ? {
        assetRules: stockAssetRules,
        bullishRules: stockBullishRules,
        bearishRules: stockBearishRules,
        defaultAsset: "글로벌 시장",
        defaultTag: "글로벌 뉴스"
      }
    : {
        assetRules: cryptoAssetRules,
        bullishRules: cryptoBullishRules,
        bearishRules: cryptoBearishRules,
        defaultAsset: "코인 시장",
        defaultTag: "코인 뉴스"
      };
}

export function displayNewsSource(source: string) {
  return sourceDisplayNames[source] ?? source;
}

export function localizeNewsSourceText(text: string) {
  return Object.entries(sourceDisplayNames)
    .reduce((current, [source, label]) => current.replace(new RegExp(source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), label), text)
    .replace(/\bBitcoin\b/gi, "비트코인")
    .replace(/\bEthereum\b/gi, "이더리움")
    .replace(/\bSolana\b/gi, "솔라나")
    .replace(/\bRipple\b/gi, "리플")
    .replace(/\bNasdaq\b/gi, "나스닥")
    .replace(/\bS&P\s?500\b/gi, "S&P500")
    .replace(/\bDow Jones\b/gi, "다우존스")
    .replace(/\bTreasury yields?\b/gi, "미국 국채금리")
    .replace(/\byields?\b/gi, "금리")
    .replace(/\bFederal Reserve\b/gi, "연준")
    .replace(/\bFed\b/gi, "연준")
    .replace(/\bRetail Sales\b/gi, "소매판매")
    .replace(/\bExisting Home Sales\b/gi, "기존주택판매")
    .replace(/\bInitial Jobless Claims\b/gi, "신규 실업수당 청구")
    .replace(/\bCPI\b/g, "소비자물가지수")
    .replace(/\bPPI\b/g, "생산자물가지수")
    .replace(/\bInflation\b/gi, "물가")
    .replace(/\bCrypto\b/gi, "코인")
    .replace(/\bStocks?\b/gi, "주식")
    .replace(/\bMarkets?\b/gi, "시장")
    .replace(/\bEarnings?\b/gi, "실적")
    .replace(/\bRevenue\b/gi, "매출")
    .replace(/\bGuidance\b/gi, "가이던스")
    .replace(/\bRate cuts?\b/gi, "금리 인하")
    .replace(/\bRate hikes?\b/gi, "금리 인상")
    .replace(/\bBullish\b/gi, "상방 우호")
    .replace(/\bBearish\b/gi, "하방 주의");
}

export function analyzeNewsText(input: string, market: RadarNewsMarket = "crypto"): RadarNewsSignal {
  const raw = input.trim().replace(/\s+/g, " ");
  const text = raw.toLowerCase();
  const ruleSet = rulesForMarket(market);
  const assets = unique(ruleSet.assetRules.filter((rule) => includesAny(text, rule.keywords)).map((rule) => rule.asset));
  const tags: string[] = [];
  let rawScore = 50;

  for (const rule of ruleSet.bullishRules) {
    if (includesAny(text, rule.keywords)) {
      rawScore += rule.score;
      tags.push(rule.tag);
    }
  }

  for (const rule of ruleSet.bearishRules) {
    if (includesAny(text, rule.keywords)) {
      rawScore += rule.score;
      tags.push(rule.tag);
    }
  }

  let urgencyScore = 0;
  for (const rule of urgencyRules) {
    if (includesAny(text, rule.keywords)) {
      urgencyScore += rule.score;
      tags.push(rule.tag);
    }
  }

  const score = Math.round(clamp(5, 95, rawScore));
  const direction: RadarNewsDirection = score >= 58 ? "bullish" : score <= 42 ? "bearish" : "neutral";
  const urgency: RadarNewsUrgency = urgencyScore >= 2 || score >= 72 || score <= 28 ? "high" : urgencyScore === 1 ? "medium" : "low";
  const displayAssets = assets.length ? assets : [ruleSet.defaultAsset];
  const assetLabel = displayAssets.join(", ");

  const headline =
    direction === "bullish"
      ? "상방에 우호적인 뉴스입니다."
      : direction === "bearish"
        ? "하방 변동성에 주의할 뉴스입니다."
        : "방향성보다 확인이 필요한 뉴스입니다.";

  const summary =
    direction === "bullish"
      ? `${assetLabel}에 수요, 유동성, 실적 또는 모멘텀 측면의 우호 재료가 감지됩니다. 다만 실제 진입은 차트 구조와 거래량 반응을 함께 확인해야 합니다.`
      : direction === "bearish"
        ? `${assetLabel}에 규제, 매도 압력, 보안, 금리 또는 실적 리스크가 감지됩니다. 추격보다 지지와 변동성 확대 여부를 먼저 확인하는 편이 안전합니다.`
        : `${assetLabel} 관련 이슈지만 방향성은 아직 혼재되어 있습니다. 같은 방향의 후속 뉴스와 가격 반응이 함께 나오는지 확인해야 합니다.`;

  const actionHint =
    direction === "bullish"
      ? "가격이 이미 과열되어 있으면 바로 추격하기보다 눌림과 재돌파 여부를 확인하세요."
      : direction === "bearish"
        ? "주요 지지선, 고배율 포지션 청산 위험, 거래량 급증 여부를 먼저 점검하세요."
        : "뉴스만으로 판단하지 말고 BTC·ETH 또는 주요 지수 반응과 함께 확인하세요.";

  return {
    direction,
    urgency,
    score,
    assets: displayAssets,
    tags: unique(tags).slice(0, 5).length ? unique(tags).slice(0, 5) : [ruleSet.defaultTag],
    headline,
    summary,
    actionHint
  };
}

export function fallbackKoreanNewsTitle(title: string, market: RadarNewsMarket = "crypto") {
  if (hasKorean(title)) return title;

  const signal = analyzeNewsText(title, market);
  const asset = signal.assets.slice(0, 2).join(", ");
  const tone = signal.direction === "bullish" ? "상방 재료" : signal.direction === "bearish" ? "하방 리스크" : "중립 이슈";

  if (market === "stocks") {
    if (/inflation|cpi|ppi|price/i.test(title)) return "미국 물가 이슈가 글로벌 시장 변동성에 영향을 주고 있습니다.";
    if (/fed|rate|treasury|yield/i.test(title)) return "연준과 금리 기대 변화가 글로벌 자산 흐름을 흔들고 있습니다.";
    if (/earnings|revenue|guidance|profit/i.test(title)) return "주요 기업 실적과 가이던스가 종목별 흐름을 가르고 있습니다.";
    if (/ai|chip|semiconductor|data center/i.test(title)) return "AI와 반도체 수요가 성장주 흐름의 핵심 변수로 떠오르고 있습니다.";
    return `${asset} 관련 ${tone}가 글로벌 시장에서 확인되고 있습니다.`;
  }

  if (/bitcoin|btc/i.test(title)) return `비트코인 관련 ${tone}가 시장 심리에 영향을 주고 있습니다.`;
  if (/ethereum|eth/i.test(title)) return `이더리움 관련 ${tone}가 알트코인 흐름에 영향을 주고 있습니다.`;
  if (/etf|inflow|outflow/i.test(title)) return `ETF와 자금 흐름 이슈가 코인 시장 수급에 영향을 주고 있습니다.`;
  if (/sec|cftc|lawsuit|regulation/i.test(title)) return `규제 이슈가 코인 시장 변동성 확대 요인으로 떠오르고 있습니다.`;
  if (/hack|exploit|security/i.test(title)) return `보안 이슈가 코인 시장 위험 심리를 자극하고 있습니다.`;
  return `${asset} 관련 ${tone}가 코인 시장에서 확인되고 있습니다.`;
}

export function createRadarNewsItem(
  input: {
    source: string;
    title: string;
    translatedTitle?: string;
    link: string;
    publishedAt: string;
  },
  market: RadarNewsMarket = "crypto"
): RadarNewsItem {
  const translatedTitle = input.translatedTitle?.trim() || fallbackKoreanNewsTitle(input.title, market);
  const signal = analyzeNewsText(`${input.title} ${translatedTitle}`, market);
  const idBase = `${input.source}:${input.link || input.title}`;

  return {
    id: idBase.replace(/\s+/g, "-").slice(0, 180),
    source: input.source,
    title: input.title,
    translatedTitle,
    link: input.link,
    publishedAt: input.publishedAt,
    ...signal
  };
}
