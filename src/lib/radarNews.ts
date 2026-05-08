// 뉴스 제목과 사용자가 붙여넣은 문장을 차트 레이더식 시장 영향으로 분류한다.
export type RadarNewsDirection = "bullish" | "bearish" | "neutral";
export type RadarNewsUrgency = "high" | "medium" | "low";

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

type KeywordRule = {
  keywords: string[];
  score: number;
  tag: string;
};

const assetRules: { asset: string; keywords: string[] }[] = [
  { asset: "BTC", keywords: ["btc", "bitcoin", "비트코인", "비트", "spot bitcoin", "bitcoin etf"] },
  { asset: "ETH", keywords: ["eth", "ethereum", "이더리움", "이더", "ether", "ethereum etf"] },
  { asset: "XRP", keywords: ["xrp", "ripple", "리플"] },
  { asset: "SOL", keywords: ["sol", "solana", "솔라나"] },
  { asset: "DOGE", keywords: ["doge", "dogecoin", "도지"] },
  { asset: "BNB", keywords: ["bnb", "binance coin"] },
  { asset: "ALT", keywords: ["altcoin", "알트", "alts", "memecoin", "meme coin", "defi", "layer 2"] }
];

const bullishRules: KeywordRule[] = [
  { keywords: ["etf inflow", "inflows", "approval", "approved", "승인", "유입", "매수", "축적", "accumulation"], score: 13, tag: "수요 유입" },
  { keywords: ["record high", "all-time high", "ath", "breakout", "rally", "surge", "soars", "급등", "돌파", "랠리"], score: 11, tag: "상승 모멘텀" },
  { keywords: ["institutional", "기관", "blackrock", "fidelity", "microstrategy", "treasury", "매입"], score: 9, tag: "기관 수요" },
  { keywords: ["rate cut", "cuts rates", "금리 인하", "liquidity", "유동성", "stimulus"], score: 8, tag: "매크로 완화" },
  { keywords: ["partnership", "launches", "mainnet", "upgrade", "파트너십", "출시", "업그레이드"], score: 6, tag: "프로젝트 호재" }
];

const bearishRules: KeywordRule[] = [
  { keywords: ["hack", "exploit", "drain", "stolen", "해킹", "취약점", "도난", "탈취"], score: -15, tag: "보안 리스크" },
  { keywords: ["lawsuit", "sues", "charges", "sec", "cftc", "소송", "기소", "제재", "규제"], score: -12, tag: "규제 리스크" },
  { keywords: ["outflows", "sell-off", "liquidation", "dump", "plunge", "급락", "청산", "매도", "유출"], score: -12, tag: "매도 압력" },
  { keywords: ["bankruptcy", "insolvency", "파산", "지급불능", "상장폐지", "delist"], score: -14, tag: "신용 리스크" },
  { keywords: ["rate hike", "higher rates", "금리 인상", "inflation", "인플레", "hawkish"], score: -8, tag: "매크로 긴축" }
];

const urgencyRules: KeywordRule[] = [
  { keywords: ["sec", "cftc", "fed", "fomc", "binance", "coinbase", "blackrock", "해킹", "청산", "etf", "금리", "긴급"], score: 1, tag: "즉시 확인" },
  { keywords: ["breaking", "urgent", "속보", "단독", "just in"], score: 1, tag: "속보" }
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

export function analyzeNewsText(input: string): RadarNewsSignal {
  const raw = input.trim().replace(/\s+/g, " ");
  const text = raw.toLowerCase();
  const assets = unique(
    assetRules.filter((rule) => includesAny(text, rule.keywords)).map((rule) => rule.asset)
  );

  const matchedTags: string[] = [];
  let rawScore = 50;

  for (const rule of bullishRules) {
    if (includesAny(text, rule.keywords)) {
      rawScore += rule.score;
      matchedTags.push(rule.tag);
    }
  }

  for (const rule of bearishRules) {
    if (includesAny(text, rule.keywords)) {
      rawScore += rule.score;
      matchedTags.push(rule.tag);
    }
  }

  let urgencyScore = 0;
  for (const rule of urgencyRules) {
    if (includesAny(text, rule.keywords)) {
      urgencyScore += rule.score;
      matchedTags.push(rule.tag);
    }
  }

  const score = Math.round(clamp(5, 95, rawScore));
  const direction: RadarNewsDirection = score >= 58 ? "bullish" : score <= 42 ? "bearish" : "neutral";
  const urgency: RadarNewsUrgency =
    urgencyScore >= 2 || score >= 72 || score <= 28 ? "high" : urgencyScore === 1 ? "medium" : "low";
  const displayAssets = assets.length ? assets : ["시장 전체"];
  const tags = unique(matchedTags).slice(0, 5);
  const headline =
    direction === "bullish"
      ? "상방 심리에 우호적인 뉴스입니다."
      : direction === "bearish"
        ? "하방 변동성에 주의할 뉴스입니다."
        : "방향성보다 확인이 필요한 뉴스입니다.";
  const assetLabel = displayAssets.join(", ");
  const summary =
    direction === "bullish"
      ? `${assetLabel}에 수요, 유동성, 모멘텀 측면의 긍정 재료가 감지됩니다. 다만 실제 진입은 차트 구조와 거래량 확인이 우선입니다.`
      : direction === "bearish"
        ? `${assetLabel}에 규제, 매도 압력, 보안 또는 매크로 리스크가 감지됩니다. 추격보다 변동성 확대와 지지 이탈 여부를 먼저 확인하세요.`
        : `${assetLabel} 관련 이슈지만 단독 방향성은 약합니다. 같은 방향의 후속 뉴스와 차트 반응이 같이 나오는지 확인하는 편이 좋습니다.`;
  const actionHint =
    direction === "bullish"
      ? "차트가 이미 과열이면 눌림과 구조 재확인을 기다리는 쪽이 안전합니다."
      : direction === "bearish"
        ? "주요 지지와 고배율 포지션 청산 위험을 먼저 점검하세요."
        : "뉴스만으로 판단하지 말고 BTC·ETH 반응과 도미넌스 변화를 같이 보세요.";

  return {
    direction,
    urgency,
    score,
    assets: displayAssets,
    tags: tags.length ? tags : ["일반 뉴스"],
    headline,
    summary,
    actionHint
  };
}

export function createRadarNewsItem(input: {
  source: string;
  title: string;
  translatedTitle?: string;
  link: string;
  publishedAt?: string;
}): RadarNewsItem {
  const signal = analyzeNewsText(input.title);
  const idBase = `${input.source}-${input.link || input.title}`;
  let hash = 0;
  for (let i = 0; i < idBase.length; i += 1) {
    hash = (hash * 31 + idBase.charCodeAt(i)) >>> 0;
  }
  return {
    ...signal,
    id: `${input.source.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${hash.toString(36)}`,
    source: input.source,
    title: input.title.trim(),
    translatedTitle: input.translatedTitle?.trim() || undefined,
    link: input.link,
    publishedAt: input.publishedAt ?? new Date().toISOString()
  };
}
