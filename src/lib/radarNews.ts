// 공개 뉴스 제목을 한국어 시장 브리핑용 신호로 분류합니다.
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
  excerpt?: string;
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
  BLS: "미 노동통계국",
  BEA: "미 경제분석국",
  Census: "미 인구조사국",
  Fed: "연준",
  NAR: "미 부동산협회",
  CoinDesk: "코인데스크",
  Cointelegraph: "코인텔레그래프",
  "CNBC Markets": "미국 증시 뉴스",
  MarketWatch: "마켓워치"
};

type Rule = {
  keywords: string[];
  score: number;
  tag: string;
};

const cryptoAssets = [
  { asset: "BTC", keywords: ["btc", "bitcoin", "비트코인", "bitcoin etf"] },
  { asset: "ETH", keywords: ["eth", "ethereum", "이더리움", "ether"] },
  { asset: "XRP", keywords: ["xrp", "ripple", "리플"] },
  { asset: "SOL", keywords: ["sol", "solana", "솔라나"] },
  { asset: "DOGE", keywords: ["doge", "dogecoin", "도지"] },
  { asset: "알트코인", keywords: ["altcoin", "alts", "memecoin", "defi", "layer 2", "token", "tokens"] }
];

const stockAssets = [
  { asset: "SPY", keywords: ["spy", "s&p", "s&p 500", "spx"] },
  { asset: "QQQ", keywords: ["qqq", "nasdaq", "nasdaq 100", "ndx"] },
  { asset: "NVDA", keywords: ["nvda", "nvidia", "ai chip", "gpu"] },
  { asset: "TSLA", keywords: ["tsla", "tesla", "ev"] },
  { asset: "AAPL", keywords: ["aapl", "apple", "iphone"] },
  { asset: "MSFT", keywords: ["msft", "microsoft", "azure"] },
  { asset: "META", keywords: ["meta", "facebook"] },
  { asset: "AMZN", keywords: ["amzn", "amazon", "aws"] },
  { asset: "GOOGL", keywords: ["googl", "google", "alphabet"] },
  { asset: "GLD", keywords: ["gold", "gld"] },
  { asset: "USO", keywords: ["oil", "crude", "wti"] },
  { asset: "TLT", keywords: ["treasury", "yield", "bond", "tlt"] }
];

const cryptoBullishRules: Rule[] = [
  { keywords: ["etf inflow", "inflows", "approval", "approved", "accumulation"], score: 13, tag: "수요 유입" },
  { keywords: ["record high", "all-time high", "ath", "breakout", "rally", "surge", "soars"], score: 11, tag: "상승 모멘텀" },
  { keywords: ["institutional", "blackrock", "fidelity", "microstrategy", "treasury"], score: 9, tag: "기관 수요" },
  { keywords: ["rate cut", "cuts rates", "liquidity", "stimulus"], score: 8, tag: "유동성 완화" },
  { keywords: ["partnership", "mainnet", "upgrade", "launches", "digitized finance"], score: 6, tag: "프로젝트 호재" },
  { keywords: ["recover bitcoin", "recovering bitcoin", "wallet recovery"], score: 4, tag: "수급 이슈" }
];

const cryptoBearishRules: Rule[] = [
  { keywords: ["hack", "exploit", "stolen", "drain"], score: -15, tag: "보안 리스크" },
  { keywords: ["lawsuit", "sues", "charges", "sec", "cftc", "regulation"], score: -12, tag: "규제 리스크" },
  { keywords: ["outflow", "outflows", "sell-off", "liquidation", "dump", "plunge", "slump", "drops"], score: -12, tag: "매도 압력" },
  { keywords: ["bankruptcy", "insolvency", "delist", "net loss"], score: -14, tag: "신용 리스크" },
  { keywords: ["rate hike", "higher rates", "inflation", "hawkish"], score: -8, tag: "매크로 부담" },
  { keywords: ["voter crypto", "voters crypto", "poll crypto"], score: -3, tag: "정책 여론" },
  { keywords: ["bear market resistance"], score: -7, tag: "저항 구간" }
];

const stockBullishRules: Rule[] = [
  { keywords: ["earnings beat", "beats estimates", "raised guidance", "upgrade", "buyback", "record revenue"], score: 12, tag: "실적 호조" },
  { keywords: ["rate cut", "lower yields", "soft landing", "dovish"], score: 10, tag: "금리 완화" },
  { keywords: ["ai demand", "chip demand", "data center", "cloud growth", "semiconductor"], score: 9, tag: "성장 테마" },
  { keywords: ["rally", "record high", "breakout", "surge", "rebounds"], score: 8, tag: "가격 모멘텀" },
  { keywords: ["etf inflow", "inflows", "institutional"], score: 7, tag: "수급 개선" }
];

const stockBearishRules: Rule[] = [
  { keywords: ["earnings miss", "misses estimates", "cuts guidance", "downgrade", "net loss"], score: -13, tag: "실적 리스크" },
  { keywords: ["higher yields", "rate hike", "hawkish", "sticky inflation"], score: -11, tag: "금리 부담" },
  { keywords: ["sell-off", "plunge", "slumps", "correction", "bear market"], score: -10, tag: "가격 조정" },
  { keywords: ["antitrust", "lawsuit", "probe", "sec", "doj", "regulation"], score: -9, tag: "규제 리스크" },
  { keywords: ["recession", "slowdown", "weak demand", "layoffs", "tariff"], score: -9, tag: "경기 둔화" }
];

const urgencyKeywords = ["breaking", "urgent", "fed", "fomc", "sec", "binance", "coinbase", "blackrock", "hack", "liquidation", "etf"];

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function clamp(min: number, max: number, value: number) {
  return Math.min(max, Math.max(min, value));
}

function rulesForMarket(market: RadarNewsMarket) {
  return market === "stocks"
    ? { assetRules: stockAssets, bullishRules: stockBullishRules, bearishRules: stockBearishRules, defaultAsset: "글로벌 시장", defaultTag: "글로벌 뉴스" }
    : { assetRules: cryptoAssets, bullishRules: cryptoBullishRules, bearishRules: cryptoBearishRules, defaultAsset: "코인 시장", defaultTag: "코인 뉴스" };
}

export function displayNewsSource(source: string) {
  return sourceDisplayNames[source] ?? source;
}

function sanitizeNewsText(text: string) {
  return text
    .replace(/무尽한/g, "막대한")
    .replace(/[\u3400-\u4DBF\u4E00-\u9FFF]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function localizeNewsSourceText(text: string) {
  return sanitizeNewsText(
    text
      .replace(/\bBitcoin\b/gi, "비트코인")
      .replace(/\bEthereum\b/gi, "이더리움")
      .replace(/\bSolana\b/gi, "솔라나")
      .replace(/\bNasdaq\b/gi, "나스닥")
      .replace(/\bS&P\s?500\b/gi, "S&P500")
      .replace(/\bFederal Reserve\b/gi, "연준")
      .replace(/\bFed\b/gi, "연준")
      .replace(/\bTreasury yields?\b/gi, "미국채 금리")
      .replace(/\byields?\b/gi, "금리")
      .replace(/\bInflation\b/gi, "물가")
      .replace(/\bCrypto\b/gi, "코인")
      .replace(/\bStocks?\b/gi, "주식")
      .replace(/\bMarkets?\b/gi, "시장")
      .replace(/\bEarnings?\b/gi, "실적")
      .replace(/\bRevenue\b/gi, "매출")
      .replace(/\bRate cuts?\b/gi, "금리 인하")
      .replace(/\bRate hikes?\b/gi, "금리 인상")
  );
}

function hasKorean(value: string) {
  return /[가-힣]/.test(value);
}

export function fallbackKoreanNewsTitle(title: string, market: RadarNewsMarket = "crypto") {
  const localized = localizeNewsSourceText(title).trim();
  if (hasKorean(localized)) return localized;

  const text = localized.toLowerCase();
  if (market === "crypto") {
    const asset = cryptoAssets.find((rule) => rule.keywords.some((keyword) => text.includes(keyword)))?.asset ?? "코인 시장";
    if (text.includes("etf")) return `${asset} ETF 흐름이 시장에 영향을 줄 수 있는 뉴스입니다.`;
    if (text.includes("inflow") || text.includes("outflow")) return `${asset} 자금 유입과 유출 흐름을 확인해야 하는 뉴스입니다.`;
    if (text.includes("sec") || text.includes("lawsuit") || text.includes("regulation")) return `${asset} 규제 리스크를 확인해야 하는 뉴스입니다.`;
    if (text.includes("hack") || text.includes("exploit")) return `${asset} 보안 리스크가 감지된 뉴스입니다.`;
    if (text.includes("rally") || text.includes("surge") || text.includes("breakout")) return `${asset} 상승 모멘텀을 확인해야 하는 뉴스입니다.`;
    if (text.includes("liquidation") || text.includes("sell-off") || text.includes("plunge")) return `${asset} 하방 변동성을 조심해야 하는 뉴스입니다.`;
    return `${asset} 주요 이슈가 업데이트되었습니다.`;
  }

  const asset = stockAssets.find((rule) => rule.keywords.some((keyword) => text.includes(keyword)))?.asset ?? "글로벌 시장";
  if (text.includes("earnings") || text.includes("guidance")) return `${asset} 실적과 가이던스를 확인해야 하는 뉴스입니다.`;
  if (text.includes("fed") || text.includes("rate") || text.includes("yield")) return `${asset} 금리와 채권금리 영향을 확인해야 하는 뉴스입니다.`;
  if (text.includes("upgrade") || text.includes("downgrade")) return `${asset} 투자 의견 변화 관련 뉴스입니다.`;
  if (text.includes("oil") || text.includes("crude")) return "유가와 에너지 섹터 흐름을 확인해야 하는 뉴스입니다.";
  if (text.includes("gold")) return "금 가격과 안전자산 흐름을 확인해야 하는 뉴스입니다.";
  return `${asset} 주요 이슈가 업데이트되었습니다.`;
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

  const urgencyHits = urgencyKeywords.filter((keyword) => text.includes(keyword)).length;
  const score = Math.round(clamp(5, 95, rawScore));
  const direction: RadarNewsDirection = score >= 58 ? "bullish" : score <= 42 ? "bearish" : "neutral";
  const urgency: RadarNewsUrgency = urgencyHits >= 2 || score >= 72 || score <= 28 ? "high" : urgencyHits === 1 ? "medium" : "low";
  const displayAssets = assets.length ? assets : [ruleSet.defaultAsset];
  const assetLabel = displayAssets.join(", ");

  const headline =
    direction === "bullish" ? "상방에 우호적인 뉴스입니다." : direction === "bearish" ? "하방 변동성을 조심해야 하는 뉴스입니다." : "방향성보다 확인이 필요한 뉴스입니다.";

  const summary =
    direction === "bullish"
      ? `${assetLabel}에 수요, 유동성, 실적 또는 모멘텀 측면의 긍정 재료가 감지됩니다. 다만 실제 진입은 차트 구조와 거래량 반응까지 함께 확인해야 합니다.`
      : direction === "bearish"
        ? `${assetLabel}에 규제, 매도 압력, 금리 또는 실적 리스크가 감지됩니다. 추격보다 지지선 이탈과 변동성 확대 여부를 먼저 확인하는 편이 안전합니다.`
        : `${assetLabel} 관련 이슈지만 방향성은 아직 선명하지 않습니다. 같은 방향의 추가 뉴스와 가격 반응이 이어지는지 확인해야 합니다.`;

  const actionHint =
    direction === "bullish"
      ? market === "stocks"
        ? "프리마켓 과열이면 바로 추격하지 말고 지수선물, 금리, 거래량 반응이 이어지는지 확인하세요."
        : "가격이 이미 과열이면 바로 추격하지 말고 눌림과 재돌파를 확인하세요."
      : direction === "bearish"
        ? market === "stocks"
          ? "주요 지수선물 약세, VIX 상승, 금리 급등이 같이 나오는지 먼저 점검하세요."
          : "주요 지지선 이탈, 고배율 청산 위험, 거래량 급증 여부를 먼저 점검하세요."
        : market === "stocks"
          ? "뉴스만으로 판단하지 말고 지수선물, 달러, 금리, 섹터 ETF 반응을 같이 확인하세요."
          : "뉴스만으로 판단하지 말고 BTC, ETH, 주요 지수 반응을 같이 확인하세요.";

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

export function createRadarNewsItem(
  input: { source: string; title: string; translatedTitle?: string; excerpt?: string; link: string; publishedAt: string },
  market: RadarNewsMarket = "crypto"
): RadarNewsItem {
  const signal = analyzeNewsText(`${input.title} ${input.translatedTitle ?? ""} ${input.excerpt ?? ""}`, market);
  const publishedAt = input.publishedAt || new Date().toISOString();
  return {
    ...signal,
    id: `${input.source}-${publishedAt}-${input.link}`.replace(/\s+/g, "-"),
    source: input.source,
    title: input.title,
    translatedTitle: input.translatedTitle ? localizeNewsSourceText(input.translatedTitle) : undefined,
    excerpt: input.excerpt ? localizeNewsSourceText(input.excerpt) : undefined,
    link: input.link,
    publishedAt
  };
}
