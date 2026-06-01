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
  originalTitle: string;
  title: string;
  titleKo?: string;
  displayTitle: string;
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
  Official: "공식 자료",
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
const forbiddenCopyPatterns = [
  /폭등/g,
  /폭락/g,
  /매수\s*기회/g,
  /수익\s*찬스/g,
  /확정\s*신호/g,
  /시장\s*충격\s*확정/g
];

function keywordInText(text: string, keyword: string) {
  const normalized = keyword.toLowerCase();
  if (/^[a-z0-9.]+$/i.test(normalized)) {
    return new RegExp(`\\b${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text);
  }
  return text.includes(normalized);
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => keywordInText(text, keyword));
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

function sanitizeMarketCopy(text: string) {
  let next = sanitizeNewsText(text);
  for (const pattern of forbiddenCopyPatterns) {
    next = next.replace(pattern, (match) => {
      if (match.includes("폭등")) return "강세";
      if (match.includes("폭락")) return "약세";
      if (match.includes("매수")) return "확인 구간";
      if (match.includes("수익")) return "시장 관심";
      if (match.includes("확정")) return "확인 필요";
      return "확인 필요";
    });
  }
  return next.replace(/\s+/g, " ").trim();
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

function hasMeaningfulKoreanTitle(value: string) {
  const text = sanitizeMarketCopy(value);
  if (!hasKorean(text)) return false;
  if (text.length < 6) return false;
  const koreanCount = text.match(/[가-힣]/g)?.length ?? 0;
  const latinCount = text.match(/[A-Za-z]/g)?.length ?? 0;
  if (latinCount > Math.max(12, koreanCount * 1.2)) return false;
  return !/주요 이슈가 업데이트되었습니다|확인해야 하는 뉴스입니다|관련 뉴스입니다|뉴스입니다/.test(text);
}

function companyOrAssetLabel(text: string, market: RadarNewsMarket) {
  if (market === "crypto") {
    if (/\bbitcoin\b|\bbtc\b/i.test(text)) return "BTC";
    if (/\beth\b|\bether\b|ethereum/i.test(text)) return "ETH";
    if (/stablecoin|usdt|usdc/i.test(text)) return "스테이블코인";
    if (/crypto|digital asset/i.test(text)) return "코인 시장";
    return "코인 시장";
  }

  if (/nvidia|\bnvda\b/i.test(text)) return "엔비디아";
  if (/semiconductor|chip|broadcom|amd|\bsmh\b/i.test(text)) return "반도체주";
  if (/tesla|\btsla\b/i.test(text)) return "테슬라";
  if (/apple|\baapl\b/i.test(text)) return "애플";
  if (/microsoft|\bmsft\b/i.test(text)) return "마이크로소프트";
  if (/nasdaq|\bqqq\b|ndx/i.test(text)) return "나스닥";
  if (/s&p|spy|spx/i.test(text)) return "S&P500";
  if (/dow/i.test(text)) return "다우";
  return "미국 증시";
}

function compactDollarPrice(text: string) {
  const match = text.match(/\$\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)(?:\.[0-9]+)?/);
  if (!match) return "";
  return `${match[1]}달러`;
}

function contextualFallbackTitle(originalTitle: string, market: RadarNewsMarket) {
  const raw = originalTitle.trim();
  const text = raw.toLowerCase();
  const asset = companyOrAssetLabel(raw, market);
  const dollarPrice = compactDollarPrice(raw);

  if (market === "crypto") {
    if (/bitcoin|btc/.test(text) && dollarPrice) return `BTC ${dollarPrice} 부근 흐름 점검`;
    if (/ethereum|ether|eth/.test(text) && dollarPrice) return `ETH ${dollarPrice} 부근 흐름 점검`;
    if (/etf/.test(text) && /inflow|outflow|flow/.test(text)) return `${asset} ETF 수급 흐름 점검`;
    if (/stablecoin|usdt|usdc/.test(text)) return "스테이블코인 수급과 규제 흐름 점검";
    if (/fed|fomc|rate|yield|treasury|dollar/.test(text)) return "금리·달러 부담에 코인 시장 방향성 점검";
    if (/cpi|ppi|pce|inflation/.test(text)) return "물가 뉴스에 코인 시장 변동성 점검";
    if (/jobless|payroll|jobs|unemployment/.test(text)) return "고용 뉴스에 위험자산 흐름 점검";
    if (/liquidation|sell-off|correction|slump|drop/.test(text)) return "청산과 변동성 확대 가능성 점검";
    if (/regulation|sec|cftc|congress|stablecoin bill|clarity act|genius act/.test(text)) return "규제 이슈가 코인 시장 심리에 미치는 영향 점검";
    return `${asset} 주요 시장 이슈 점검`;
  }

  if (/fomc|minutes/.test(text)) return "연준 의사록 뉴스에 금리 경계감 유지";
  if (/fed|powell|rate|yield|treasury/.test(text)) return "미국 금리 경계감에 지수 방향성 점검";
  if (/cpi|ppi|pce|inflation/.test(text)) return "물가 뉴스에 인플레 부담 재점검";
  if (/jobless|payroll|jobs|employment|unemployment/.test(text)) return "고용 뉴스에 미국 지수선물 흐름 점검";
  if (/oil|crude|brent|wti|gas prices|energy/.test(text)) return "유가 흐름에 인플레 부담 재점검";
  if (/dollar|dxy/.test(text)) return "달러 강세 여부에 위험자산 부담 점검";
  if (/vix|volatility/.test(text)) return "변동성 확대 가능성에 위험자산 경계";
  if (/nvidia|\bnvda\b|semiconductor|chip|ai demand|data center/.test(text)) return `${asset} 기대감에 반도체주 주목`;
  if (/earnings|guidance|revenue|profit/.test(text)) return `${asset} 실적과 가이던스에 시장 반응 점검`;
  if (/futures|nasdaq|s&p|dow|wall street/.test(text)) return `${asset} 흐름에 미국장 방향성 점검`;
  return `${asset} 주요 시장 이슈 점검`;
}

export function marketNewsDisplayTitle(originalTitle: string, candidateTitle: string | undefined, market: RadarNewsMarket = "crypto") {
  const candidate = sanitizeMarketCopy(candidateTitle ?? "");
  const fallback = contextualFallbackTitle(originalTitle, market);
  const title = hasMeaningfulKoreanTitle(candidate) ? candidate : fallback;
  return sanitizeMarketCopy(title).replace(/[.!?。]+$/g, "").slice(0, 72);
}

export function fallbackKoreanNewsTitle(title: string, market: RadarNewsMarket = "crypto") {
  const localized = localizeNewsSourceText(title).trim();
  if (hasMeaningfulKoreanTitle(localized)) return marketNewsDisplayTitle(title, localized, market);

  const text = localized.toLowerCase();
  if (market === "crypto") {
    const asset = cryptoAssets.find((rule) => rule.keywords.some((keyword) => text.includes(keyword)))?.asset ?? "코인 시장";
    if (text.includes("etf")) return `${asset} ETF 수급 흐름 점검`;
    if (text.includes("inflow") || text.includes("outflow")) return `${asset} 자금 유입·유출 흐름 점검`;
    if (text.includes("sec") || text.includes("lawsuit") || text.includes("regulation")) return `${asset} 규제 리스크 점검`;
    if (text.includes("hack") || text.includes("exploit")) return `${asset} 보안 리스크 점검`;
    if (text.includes("rally") || text.includes("surge") || text.includes("breakout")) return `${asset} 강세 흐름 지속 여부 점검`;
    if (text.includes("liquidation") || text.includes("sell-off") || text.includes("plunge")) return `${asset} 하락 변동성 확대 여부 점검`;
    return contextualFallbackTitle(title, market);
  }

  const asset = stockAssets.find((rule) => rule.keywords.some((keyword) => text.includes(keyword)))?.asset ?? "글로벌 시장";
  if (text.includes("earnings") || text.includes("guidance")) return `${asset} 실적과 가이던스에 시장 반응 점검`;
  if (text.includes("fed") || text.includes("rate") || text.includes("yield")) return `${asset} 금리 부담에 시장 방향성 점검`;
  if (text.includes("upgrade") || text.includes("downgrade")) return `${asset} 투자 의견 변화에 주가 반응 점검`;
  if (text.includes("oil") || text.includes("crude")) return "유가 흐름에 인플레 부담 재점검";
  if (text.includes("gold")) return "금 가격과 안전자산 선호 흐름 점검";
  return contextualFallbackTitle(title, market);
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

  if (market === "stocks" && /(treasury|yield|yields|bond)/i.test(raw) && /(surge|higher|rise|rises|jump|jumps)/i.test(raw)) {
    rawScore -= 16;
    tags.push("금리 부담");
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
  const uniqueTags = unique(tags).slice(0, 5);
  const hasRateBurden = uniqueTags.includes("금리 부담");

  const headline =
    direction === "bullish" ? "상승에 도움이 되는 뉴스입니다." : direction === "bearish" ? "하락 변동성을 조심해야 하는 뉴스입니다." : "방향성보다 확인이 필요한 뉴스입니다.";

  const summary =
    direction === "bullish"
      ? `${assetLabel}에 수요, 유동성, 실적 또는 모멘텀 측면의 긍정 재료가 감지됩니다. 다만 실제 판단은 차트 구조와 거래량 반응까지 함께 확인해야 합니다.`
      : direction === "bearish"
        ? hasRateBurden
          ? `${assetLabel}에 금리 상승 부담이 감지됩니다. 지수선물과 성장주가 같은 방향으로 약해지는지 확인해야 합니다.`
          : `${assetLabel}에 규제, 매도 압력, 금리 또는 실적 리스크가 감지됩니다. 추격보다 지지선 이탈과 변동성 확대 여부를 먼저 확인해야 합니다.`
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
    tags: uniqueTags.length ? uniqueTags : [ruleSet.defaultTag],
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
  const titleKo = marketNewsDisplayTitle(input.title, input.translatedTitle, market);
  const displayTitle = titleKo || input.title;
  return {
    ...signal,
    id: `${input.source}-${publishedAt}-${input.link}`.replace(/\s+/g, "-"),
    source: input.source,
    originalTitle: input.title,
    title: input.title,
    titleKo,
    displayTitle,
    translatedTitle: titleKo,
    excerpt: input.excerpt ? localizeNewsSourceText(input.excerpt) : undefined,
    link: input.link,
    publishedAt
  };
}
