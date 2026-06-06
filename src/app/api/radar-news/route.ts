// 공개 RSS 뉴스를 수집해 한국어 레이더 브리핑으로 반환합니다.
import { NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import {
  createRadarNewsItem,
  displayNewsSource,
  fallbackKoreanNewsTitle,
  type RadarNewsBriefing,
  type RadarNewsDirection,
  type RadarNewsItem,
  type RadarNewsMarket
} from "@/lib/radarNews";
import { rateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NewsFeed = {
  source: string;
  url: string;
};

const CRYPTO_FEEDS = [
  { source: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
  { source: "Cointelegraph", url: "https://cointelegraph.com/rss" },
  { source: "CNBC Markets", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html" },
  { source: "MarketWatch", url: "https://feeds.content.dowjones.io/public/rss/mw_topstories" }
] satisfies readonly NewsFeed[];

const STOCK_FEEDS = [
  { source: "CNBC Markets", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html" },
  { source: "MarketWatch", url: "https://feeds.content.dowjones.io/public/rss/mw_topstories" }
] satisfies readonly NewsFeed[];

const CACHE_MS = 60 * 60 * 1000;
const GROQ_DEFAULT_MODEL = "llama-3.1-8b-instant";
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const USE_GEMINI_NEWS_FALLBACK = process.env.USE_GEMINI_NEWS_FALLBACK === "true" || process.env.ENABLE_GEMINI_NEWS_FALLBACK === "true";

let cache: Record<
  RadarNewsMarket,
  | {
      updatedAt: number;
      items: RadarNewsItem[];
      briefing: RadarNewsBriefing;
      failedSources: string[];
    }
  | null
> = {
  crypto: null,
  stocks: null
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: "text"
});
const translationCache = new Map<string, string>();

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(parseInt(decimal, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function cleanText(value: unknown) {
  if (typeof value !== "string") return "";
  return decodeHtmlEntities(value)
    .replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickText(value: unknown): string {
  if (typeof value === "string") return cleanText(value);
  if (value && typeof value === "object" && "text" in value) return cleanText((value as { text?: unknown }).text);
  return "";
}

function normalizeLink(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const link = value as { href?: unknown; text?: unknown };
    if (typeof link.href === "string") return link.href;
    if (typeof link.text === "string") return link.text;
  }
  return "";
}

function pickExcerpt(record: Record<string, unknown>) {
  return (
    pickText(record.description) ||
    pickText(record.summary) ||
    pickText(record["content:encoded"]) ||
    pickText(record.content) ||
    ""
  ).slice(0, 900);
}

function toIsoDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

const GLOBAL_MARKET_KEYWORDS = [
  "fed",
  "fomc",
  "powell",
  "rate",
  "rates",
  "yield",
  "treasury",
  "inflation",
  "cpi",
  "ppi",
  "jobs",
  "payroll",
  "jobless claims",
  "unemployment",
  "gdp",
  "pce",
  "core pce",
  "retail sales",
  "consumer",
  "pmi",
  "ism",
  "housing",
  "existing home",
  "existing home sales",
  "new home sales",
  "durable goods",
  "dollar",
  "oil",
  "crude",
  "gold",
  "nasdaq",
  "s&p",
  "dow",
  "futures",
  "wall street",
  "recession",
  "tariff",
  "trade war",
  "sanctions",
  "earnings season",
  "semiconductor",
  "ai stocks",
  "magnificent seven"
];

const GLOBAL_MAJOR_ASSETS = ["nvidia", "apple", "microsoft", "tesla", "amazon", "meta", "google", "alphabet", "broadcom", "amd"];
const GLOBAL_MARKET_CONTEXT = ["earnings", "guidance", "forecast", "chip", "ai", "data center", "antitrust", "tariff", "index", "market", "nasdaq", "s&p"];
const GLOBAL_MARKET_CONFIRMATION_KEYWORDS = [
  "fed",
  "fomc",
  "powell",
  "treasury",
  "yield",
  "yields",
  "bond market",
  "cpi",
  "ppi",
  "pce",
  "jobs report",
  "payroll",
  "jobless claims",
  "unemployment rate",
  "dollar",
  "vix",
  "nasdaq",
  "s&p",
  "dow",
  "futures",
  "wall street",
  "stock market",
  "stocks",
  "equities",
  "earnings",
  "guidance",
  "sector",
  "semiconductor",
  "chip",
  "ai stocks",
  "oil",
  "crude",
  "brent",
  "wti",
  "gold",
  "recession",
  "tariff"
];
const GLOBAL_GEOPOLITICAL_CONTEXT = ["china", "taiwan", "trump", "trade", "export", "sanction"];
const GLOBAL_GEOPOLITICAL_MARKET_CONTEXT = ["tariff", "oil", "crude", "semiconductor", "chip", "taiwan", "trade", "export", "sanction", "treasury", "dollar"];
const GLOBAL_NOISE_KEYWORDS = ["boeing", "jury", "lawsuit", "v. altman", "nasdaq debut", "ipo", "shares pop", "buying 200"];
const PERSONAL_FINANCE_NOISE_KEYWORDS = [
  "retirement",
  "retire",
  "retired",
  "retirement plan",
  "retirement planning",
  "401(k)",
  "ira",
  "roth ira",
  "social security",
  "medicare",
  "estate",
  "inheritance",
  "heirs",
  "divorce",
  "my daughter",
  "my son",
  "my wife",
  "my husband",
  "my mother",
  "my father",
  "daughter",
  "son",
  "family",
  "drug problem",
  "addiction",
  "sell her house",
  "selling her house",
  "house sale",
  "home sale",
  "mortgage",
  "personal finance",
  "should i",
  "can i",
  "do i have to",
  "what should i",
  "your retirement",
  "we traded our",
  "smartphone",
  "smartphones",
  "flip phone",
  "flip phones",
  "ditch modern technology"
];
const CRYPTO_MAJOR_MARKET_KEYWORDS = [
  "bitcoin",
  "btc",
  "ethereum",
  "ether",
  "eth",
  "crypto market",
  "digital assets",
  "market cap",
  "dominance",
  "spot bitcoin etf",
  "bitcoin etf",
  "ether etf",
  "crypto etf",
  "stablecoin",
  "stablecoins",
  "usdt",
  "usdc",
  "liquidation",
  "liquidations"
];
const CRYPTO_MACRO_KEYWORDS = [
  "fed",
  "fomc",
  "powell",
  "rate",
  "rates",
  "yield",
  "treasury",
  "dollar",
  "inflation",
  "cpi",
  "ppi",
  "pce",
  "jobs report",
  "payroll",
  "jobless",
  "unemployment",
  "gdp",
  "pmi",
  "ism",
  "liquidity",
  "risk assets",
  "nasdaq",
  "s&p",
  "vix"
];
const CRYPTO_POLICY_KEYWORDS = [
  "sec",
  "cftc",
  "regulation",
  "regulatory",
  "congress",
  "senate",
  "house",
  "crypto bill",
  "market structure bill",
  "clarity act",
  "genius act",
  "stablecoin bill",
  "etf approval",
  "blackrock",
  "fidelity",
  "coinbase",
  "binance"
];
const CRYPTO_ALT_ONLY_KEYWORDS = [
  "thorchain",
  "rune",
  "aptos",
  "sui",
  "near",
  "celestia",
  "sei",
  "kaspa",
  "pepe",
  "bonk",
  "wif",
  "shiba",
  "dogecoin",
  "doge",
  "solana",
  "sol",
  "xrp",
  "ripple",
  "cardano",
  "ada",
  "tron",
  "trx",
  "avalanche",
  "avax",
  "polkadot",
  "dot"
];
const CRYPTO_PROJECT_NOISE_KEYWORDS = ["airdrop", "mainnet", "partnership", "gaming", "nft", "dao", "staking rewards", "token launch"];
const CRYPTO_STRONG_MACRO_KEYWORDS = [
  "fed",
  "fomc",
  "powell",
  "treasury",
  "yield",
  "yields",
  "bond market",
  "dollar",
  "inflation",
  "cpi",
  "ppi",
  "pce",
  "payroll",
  "jobless",
  "unemployment",
  "liquidity",
  "risk assets",
  "nasdaq",
  "s&p",
  "vix"
];
const CRYPTO_SYSTEMIC_CONTEXT_KEYWORDS = [
  "etf",
  "stablecoin",
  "stablecoins",
  "liquidation",
  "liquidations",
  "market cap",
  "dominance",
  "bond market",
  "treasury",
  "yield",
  "yields",
  "inflation",
  "fed",
  "fomc",
  "clarity act",
  "genius act",
  "crypto bill",
  "market structure bill"
];
const CRYPTO_EQUITY_NOISE_KEYWORDS = [
  "microsoft",
  "nvidia",
  "apple",
  "tesla",
  "ford",
  "general motors",
  "stellantis",
  "bill ackman",
  "cramer",
  "cloud growth",
  "salaried jobs"
];
const CRYPTO_DIRECT_TITLE_KEYWORDS = [
  "bitcoin",
  "btc",
  "ethereum",
  "ether",
  "eth",
  "crypto",
  "cryptocurrency",
  "digital asset",
  "digital assets",
  "blockchain",
  "stablecoin",
  "stablecoins",
  "usdt",
  "usdc",
  "defi",
  "token",
  "tokens",
  "exchange",
  "binance",
  "coinbase",
  "gemini crypto",
  "crypto exchange",
  "bitcoin etf",
  "spot bitcoin etf",
  "ether etf",
  "crypto etf",
  "mining",
  "miner",
  "miners"
];
const CRYPTO_MEDICAL_NOISE_KEYWORDS = [
  "clinical trial",
  "trial data",
  "drug",
  "medicine",
  "pharma",
  "pharmaceutical",
  "biotech",
  "fda",
  "therapy",
  "therapeutic",
  "treatment",
  "patient",
  "patients",
  "cancer cases",
  "bowel disease",
  "vaccine"
];

function keywordInText(text: string, keyword: string) {
  if (/^[a-z0-9]+$/i.test(keyword)) {
    return new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text);
  }
  return text.includes(keyword);
}

function hasKeyword(text: string, keywords: readonly string[]) {
  return keywords.some((keyword) => keywordInText(text, keyword));
}

function hasPersonalFinanceNoise(text: string) {
  return hasKeyword(text, PERSONAL_FINANCE_NOISE_KEYWORDS);
}

function hasCryptoDirectTitleContext(text: string) {
  return (
    hasKeyword(text, CRYPTO_DIRECT_TITLE_KEYWORDS) ||
    /(?:bitcoin|btc|ether|ethereum|crypto|digital asset).{0,32}treasur/.test(text) ||
    /treasur.{0,32}(?:bitcoin|btc|ether|ethereum|crypto|digital asset)/.test(text)
  );
}

function hasCryptoMacroTitleContext(text: string) {
  return hasKeyword(text, CRYPTO_STRONG_MACRO_KEYWORDS) && !hasKeyword(text, CRYPTO_EQUITY_NOISE_KEYWORDS);
}

function hasCryptoMedicalNoise(text: string) {
  return hasKeyword(text, CRYPTO_MEDICAL_NOISE_KEYWORDS);
}

function isMarketMovingGlobalNews(title: string) {
  const lower = title.toLowerCase();
  if (hasPersonalFinanceNoise(lower) || hasKeyword(lower, GLOBAL_NOISE_KEYWORDS)) return false;

  const strongHit = hasKeyword(lower, GLOBAL_MARKET_KEYWORDS);
  const marketContextHit = hasKeyword(lower, GLOBAL_MARKET_CONFIRMATION_KEYWORDS);
  if (strongHit && marketContextHit) return true;

  const hasGeopolitical = GLOBAL_GEOPOLITICAL_CONTEXT.some((keyword) => lower.includes(keyword));
  const hasGeoMarketContext = GLOBAL_GEOPOLITICAL_MARKET_CONTEXT.some((keyword) => lower.includes(keyword));
  if (hasGeopolitical && hasGeoMarketContext && !lower.includes("boeing")) return true;

  const hasMajorAsset = GLOBAL_MAJOR_ASSETS.some((keyword) => lower.includes(keyword));
  const hasContext = GLOBAL_MARKET_CONTEXT.some((keyword) => lower.includes(keyword));
  return hasMajorAsset && hasContext;
}

function cryptoMarketNewsScore(title: string, excerpt = "") {
  const titleLower = title.toLowerCase();
  const combinedLower = `${title} ${excerpt}`.toLowerCase();
  if (hasPersonalFinanceNoise(combinedLower)) return -10;
  if (hasCryptoMedicalNoise(titleLower) && !hasCryptoDirectTitleContext(titleLower)) return -20;

  const titleMajorHits = CRYPTO_MAJOR_MARKET_KEYWORDS.filter((keyword) => keywordInText(titleLower, keyword)).length;
  const titleMacroHits = CRYPTO_MACRO_KEYWORDS.filter((keyword) => keywordInText(titleLower, keyword)).length;
  const titlePolicyHits = CRYPTO_POLICY_KEYWORDS.filter((keyword) => keywordInText(titleLower, keyword)).length;
  const titleAltOnlyHits = CRYPTO_ALT_ONLY_KEYWORDS.filter((keyword) => keywordInText(titleLower, keyword)).length;
  const titleSystemicHits = titleMajorHits + titleMacroHits + titlePolicyHits;
  const directTitleHit = hasCryptoDirectTitleContext(titleLower);
  const titleRelevant = titleSystemicHits > 0 || directTitleHit || hasCryptoMacroTitleContext(titleLower);

  if (!titleRelevant) return -6 - titleAltOnlyHits;

  const majorHits = CRYPTO_MAJOR_MARKET_KEYWORDS.filter((keyword) => keywordInText(combinedLower, keyword)).length;
  const macroHits = CRYPTO_MACRO_KEYWORDS.filter((keyword) => keywordInText(combinedLower, keyword)).length;
  const policyHits = CRYPTO_POLICY_KEYWORDS.filter((keyword) => keywordInText(combinedLower, keyword)).length;
  const altOnlyHits = CRYPTO_ALT_ONLY_KEYWORDS.filter((keyword) => keywordInText(combinedLower, keyword)).length;
  const projectNoiseHits = CRYPTO_PROJECT_NOISE_KEYWORDS.filter((keyword) => keywordInText(combinedLower, keyword)).length;
  const strongMacroHit = CRYPTO_STRONG_MACRO_KEYWORDS.some((keyword) => keywordInText(combinedLower, keyword));
  const systemicContextHit = CRYPTO_SYSTEMIC_CONTEXT_KEYWORDS.some((keyword) => keywordInText(combinedLower, keyword));
  const equityNoiseHit = CRYPTO_EQUITY_NOISE_KEYWORDS.some((keyword) => keywordInText(combinedLower, keyword));
  const systemicHits = majorHits + macroHits + policyHits;

  if (systemicHits === 0) return directTitleHit ? 3 - projectNoiseHits : -6 - altOnlyHits - projectNoiseHits;
  if (equityNoiseHit && majorHits === 0 && policyHits === 0) return -5;
  if (majorHits === 0 && policyHits === 0 && !strongMacroHit) return -4 - altOnlyHits - projectNoiseHits;
  if (majorHits > 0 && policyHits === 0 && macroHits === 0 && !systemicContextHit) return -2 - altOnlyHits - projectNoiseHits;
  if (altOnlyHits > 0 && majorHits === 0 && !keywordInText(combinedLower, "crypto market") && !keywordInText(combinedLower, "stablecoin")) return -3;

  return majorHits * 4 + macroHits * 3 + policyHits * 3 - altOnlyHits * 2 - projectNoiseHits * 3;
}

function selectFeedRecords(records: Array<{ title: string; link: string; publishedAt: string; excerpt: string }>, market: RadarNewsMarket) {
  if (market !== "stocks") {
    return records
      .map((record) => ({ record, score: cryptoMarketNewsScore(record.title, record.excerpt) }))
      .filter((item) => item.score >= 2)
      .sort((a, b) => b.score - a.score || new Date(b.record.publishedAt).getTime() - new Date(a.record.publishedAt).getTime())
      .slice(0, 8)
      .map((item) => item.record);
  }
  const marketMoving = records.filter((record) => isMarketMovingGlobalNews(`${record.title} ${record.excerpt}`));
  return marketMoving.slice(0, 8);
}

function hasKorean(value: string) {
  return /[가-힣]/.test(value);
}

function ensureKoreanText(value: string | undefined, fallback: string) {
  const text = value?.trim();
  if (!text) return fallback;
  return hasKorean(text) ? text : fallback;
}

function ensureKoreanList(values: unknown, fallback: string[], maxItems: number) {
  if (!Array.isArray(values)) return fallback;
  const next = values.filter((value): value is string => typeof value === "string" && hasKorean(value)).slice(0, maxItems);
  return next.length ? next : fallback;
}

function parseStringArray(raw: string) {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]) as unknown;
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function extractUsdAmounts(text: string) {
  const amounts = new Map<number, string>();
  const dollarPrefix = /\$\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)(?:\.[0-9]+)?/g;
  const dollarSuffix = /\b([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)(?:\.[0-9]+)?\s*(?:dollars?|usd)\b/gi;

  for (const pattern of [dollarPrefix, dollarSuffix]) {
    for (const match of Array.from(text.matchAll(pattern))) {
      const value = Number(match[1].replace(/,/g, ""));
      if (Number.isFinite(value) && value >= 1_000) {
        amounts.set(value, `${Math.round(value).toLocaleString("en-US")}달러`);
      }
    }
  }

  return Array.from(amounts, ([value, label]) => ({ value, label }));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function correctDollarToWonDrift(sourceText: string, translatedText: string) {
  let next = translatedText;
  for (const amount of extractUsdAmounts(sourceText)) {
    const compact = String(Math.round(amount.value));
    const comma = Math.round(amount.value).toLocaleString("en-US");
    const wrongManwon = amount.value % 10 === 0 ? String(Math.round(amount.value / 10)) : "";
    const wrongPatterns = [
      `${compact}원`,
      `${compact} 원`,
      `${comma}원`,
      `${comma} 원`,
      wrongManwon ? `${wrongManwon}만원` : "",
      wrongManwon ? `${wrongManwon}만 원` : ""
    ].filter(Boolean);

    for (const pattern of wrongPatterns) {
      next = next.replace(new RegExp(escapeRegExp(pattern), "g"), amount.label);
    }
  }

  return next;
}

function correctBriefingCurrencyDrift(items: RadarNewsItem[], value: string) {
  const sourceText = items.map((item) => `${item.originalTitle ?? item.title} ${item.excerpt ?? ""}`).join(" ");
  return correctDollarToWonDrift(sourceText, value);
}

function polishBriefingCopy(items: RadarNewsItem[], value: string) {
  return correctBriefingCurrencyDrift(items, value)
    .replace(/기름값/g, "유가")
    .replace(/예정된?\s*(?:매크로\s*)?일정/g, "새 뉴스")
    .replace(/예정\s*발표/g, "새 뉴스")
    .replace(/예정\s*이벤트/g, "새 뉴스")
    .replace(/다음\s*이벤트/g, "다음 뉴스")
    .replace(/이벤트\s*일정/g, "새 뉴스")
    .replace(/발표\s*전후/g, "뉴스 직후")
    .replace(/투자자들은\s*이러한\s*변동성에\s*대응하기\s*위한\s*전략을\s*수립해야\s*합니다\.?/g, "시장에서는 변동성 확대 가능성을 함께 점검해야 합니다.")
    .replace(/투자자들은/g, "시장 참여자들은")
    .replace(/전략 수립/g, "변동성 대응 여부 점검")
    .replace(/큰 수익/g, "시장 관심")
    .replace(/매수해야/g, "확인해야")
    .replace(/\s+/g, " ")
    .trim();
}

async function translateTitlesWithGroq(titles: string[], market: RadarNewsMarket) {
  const apiKey = process.env.GROQ_API_KEY;
  const uniqueTitles = Array.from(new Set(titles.filter(Boolean)));
  const result = new Map<string, string>();

  for (const title of uniqueTitles) {
    const cacheKey = `${market}:${title}`;
    const cached = translationCache.get(cacheKey);
    if (cached) result.set(title, cached);
  }

  const pending = uniqueTitles.filter((title) => !result.has(title) && !hasKorean(title));
  if (!apiKey || pending.length === 0) {
    for (const title of pending) {
      const fallback = fallbackKoreanNewsTitle(title, market);
      translationCache.set(`${market}:${title}`, fallback);
      result.set(title, fallback);
    }
    return result;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6_000);
  try {
    const marketLabel = market === "stocks" ? "미국주식과 글로벌 시장" : "코인 시장";
    const response = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || GROQ_DEFAULT_MODEL,
        messages: [
          {
            role: "user",
            content: `${marketLabel} 뉴스 제목을 한국 투자자가 바로 이해하기 쉽게 자연스럽게 번역해 주세요. JSON 문자열 배열만 반환하세요.

중요 규칙.
- 원문의 달러 금액은 절대 원화, 만원, 억원으로 환산하거나 바꾸지 마세요.
- "$77,000"은 "77,000달러" 또는 "7만 7,000달러"로만 쓰고, "7700만원"처럼 쓰면 안 됩니다.
- BTC, ETH, 나스닥, S&P500 같은 가격·지수 단위는 원문 단위를 유지하세요.

${pending
              .map((title, index) => `${index + 1}. ${title}`)
              .join("\n")}`
          }
        ],
        temperature: 0.1,
        max_tokens: 1200
      })
    });

    if (response.ok) {
      const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const translated = parseStringArray(payload.choices?.[0]?.message?.content ?? "");
      pending.forEach((title, index) => {
        const candidate = translated[index]?.trim();
        const rawNext = candidate && hasKorean(candidate) ? candidate : fallbackKoreanNewsTitle(title, market);
        const next = correctDollarToWonDrift(title, rawNext);
        translationCache.set(`${market}:${title}`, next);
        result.set(title, next);
      });
      return result;
    }
  } catch {
    // 번역 실패 시 규칙 기반 제목으로 즉시 대체합니다.
  } finally {
    clearTimeout(timer);
  }

  for (const title of pending) {
    const fallback = fallbackKoreanNewsTitle(title, market);
    translationCache.set(`${market}:${title}`, fallback);
    result.set(title, fallback);
  }
  return result;
}

async function loadFeed(feed: NewsFeed, market: RadarNewsMarket) {
  const response = await fetch(feed.url, {
    headers: { "user-agent": "ChartRadarBot/1.0 (+https://chartradar.ai)" },
    cache: "no-store"
  });

  if (!response.ok) throw new Error(`${feed.source} RSS ${response.status}`);

  const parsed = parser.parse(await response.text());
  const rssItems = asArray<unknown>(parsed?.rss?.channel?.item);
  const atomItems = asArray<unknown>(parsed?.feed?.entry);
  const entries = rssItems.length ? rssItems : atomItems;
  const records = entries
    .slice(0, 30)
    .map((entry) => {
      const record = entry as Record<string, unknown>;
      const title = pickText(record.title);
      const link = normalizeLink(record.link) || pickText(record.guid);
      const publishedAt = pickText(record.pubDate) || pickText(record.published) || pickText(record.updated) || new Date().toISOString();
      const excerpt = pickExcerpt(record);
      if (!title || !link) return null;
      return { title, link, publishedAt, excerpt };
    })
    .filter((record): record is { title: string; link: string; publishedAt: string; excerpt: string } => Boolean(record));

  const selectedRecords = selectFeedRecords(records, market);
  const translations = await translateTitlesWithGroq(
    selectedRecords.map((record) => record.title),
    market
  );

  return selectedRecords.map((record) =>
    createRadarNewsItem(
      {
        source: feed.source,
        title: record.title,
        translatedTitle: translations.get(record.title) ?? fallbackKoreanNewsTitle(record.title, market),
        excerpt: record.excerpt,
        link: record.link,
        publishedAt: toIsoDate(record.publishedAt)
      },
      market
    )
  );
}

function toneLabel(tone: RadarNewsDirection) {
  if (tone === "bullish") return "상승 재료";
  if (tone === "bearish") return "하락 재료";
  return "혼재 / 확인 필요";
}

function itemTitle(item: RadarNewsItem, market: RadarNewsMarket) {
  return item.displayTitle || item.titleKo || item.translatedTitle || fallbackKoreanNewsTitle(item.originalTitle ?? item.title, market);
}

function fallbackIssueTitle(item: RadarNewsItem, market: RadarNewsMarket) {
  const tag = item.tags[0] ?? (market === "stocks" ? "글로벌 뉴스" : "코인 매크로");
  const assets = item.assets.slice(0, 2).join(", ");
  if (market === "stocks") return `${assets || "글로벌 시장"} ${tag} 점검`;
  return `${assets || "코인 시장"} ${tag} 흐름 점검`;
}

function issueTone(items: RadarNewsItem[]): RadarNewsDirection {
  const bullish = items.filter((item) => item.direction === "bullish").length;
  const bearish = items.filter((item) => item.direction === "bearish").length;
  if (bullish > bearish) return "bullish";
  if (bearish > bullish) return "bearish";
  return "neutral";
}

function matchIssueItems(items: RadarNewsItem[], patterns: RegExp[]) {
  return items.filter((item) => {
    const text = `${item.originalTitle ?? item.title} ${item.displayTitle ?? ""} ${item.titleKo ?? ""} ${item.translatedTitle ?? ""} ${item.excerpt ?? ""} ${item.tags.join(" ")}`.toLowerCase();
    return patterns.some((pattern) => pattern.test(text));
  });
}

function buildFallbackIssues(items: RadarNewsItem[], market: RadarNewsMarket): RadarNewsBriefing["keyIssues"] {
  if (items.length === 0) return [];
  const candidates =
    market === "stocks"
      ? [
          {
            title: "금리와 달러 흐름 점검",
            patterns: [/treasury|yield|bond|fed|rate|dollar|inflation|cpi|ppi|pce/i],
            detail: "금리와 달러가 지수 밸류에이션과 위험자산 선호를 흔드는 구간입니다. 지수선물과 장기금리가 같은 방향으로 움직이는지 확인해야 합니다."
          },
          {
            title: "실적과 섹터 온도 점검",
            patterns: [/earnings|guidance|revenue|semiconductor|ai|chip|data center/i],
            detail: "실적과 성장 섹터 뉴스는 지수 전체 심리에 영향을 줄 수 있습니다. 특정 종목보다 섹터 ETF와 지수 반응을 함께 보는 편이 좋습니다."
          }
        ]
      : [
          {
            title: "금리·달러·물가가 코인 베타를 누르는지 점검",
            patterns: [/treasury|yield|bond|fed|rate|dollar|inflation|cpi|ppi|pce|payroll|jobless/i],
            detail: "채권금리와 물가 기대가 올라가면 비트코인과 이더리움 같은 위험자산의 할인율 부담이 커질 수 있습니다. BTC가 지지선을 지키는지, 달러와 금리가 동시에 강해지는지 함께 봐야 합니다."
          },
          {
            title: "규제와 제도권 수급 기대 점검",
            patterns: [/clarity|genius|regulation|regulatory|sec|cftc|congress|senate|stablecoin|market structure|etf/i],
            detail: "규제 명확화와 ETF, 스테이블코인 관련 뉴스는 단기 가격보다 제도권 자금의 접근성에 영향을 줍니다. 기대감이 가격에 이미 반영됐는지와 실제 수급 반응을 확인해야 합니다."
          },
          {
            title: "BTC·ETH 주도권과 시장 체력 점검",
            patterns: [/bitcoin|btc|ethereum|ether|eth|dominance|market cap|resistance|support|breakout/i],
            detail: "전체 코인 시장은 여전히 BTC와 ETH의 방향성에 민감합니다. 알트 반등보다 BTC 도미넌스, ETH 상대강도, 거래량이 같이 움직이는지가 더 중요합니다."
          },
          {
            title: "청산·스테이블코인·유동성 흐름 점검",
            patterns: [/liquidation|liquidations|stablecoin|usdt|usdc|liquidity|inflow|outflow/i],
            detail: "청산과 스테이블코인 흐름은 단기 변동성의 연료가 될 수 있습니다. 가격 방향보다 레버리지 포지션이 한쪽으로 쏠리는지 먼저 확인해야 합니다."
          }
        ];

  const issues = candidates.flatMap((candidate) => {
    const matched = matchIssueItems(items, candidate.patterns);
    if (!matched.length) return [];
    return [
      {
        title: candidate.title,
        detail: candidate.detail,
        tone: issueTone(matched)
      }
    ];
  });

  if (issues.length) return issues.slice(0, 5);
  return items.slice(0, 4).map((item) => ({
    title: fallbackIssueTitle(item, market),
    detail: `${displayNewsSource(item.source)}의 기사 흐름을 기준으로 보면 ${toneLabel(item.direction)} 재료입니다. ${item.summary}`,
    tone: item.direction
  }));
}

function fallbackNewsBriefing(items: RadarNewsItem[], model = "rules", market: RadarNewsMarket = "crypto"): RadarNewsBriefing {
  const bullish = items.filter((item) => item.direction === "bullish").length;
  const bearish = items.filter((item) => item.direction === "bearish").length;
  const marketLabel = market === "stocks" ? "글로벌 시장" : "코인 시장";
  const newsBalance =
    bullish > bearish
      ? "상승 쪽 뉴스가 조금 더 많습니다."
      : bearish > bullish
        ? "하락 쪽 뉴스가 조금 더 많습니다."
        : "상승·하락 뉴스가 엇갈립니다.";
  const briefingFocus =
    market === "stocks"
      ? "금리, 달러, 실적, 섹터 흐름, 지수선물 중심으로 봅니다."
      : "BTC/ETH, ETF 수급, 금리, 달러, 유동성, 규제, 청산 흐름 중심으로 봅니다.";
  const followUpFocus =
    market === "stocks"
      ? "지금은 개별 종목 뉴스보다 금리, 달러, 실적, 섹터 흐름, 지수선물이 같은 방향으로 움직이는지 확인하는 편이 더 중요합니다."
      : "지금은 개별 알트 뉴스보다 금리, 달러, 규제, ETF 수급, BTC와 ETH 가격 반응이 같은 방향으로 움직이는지 확인하는 편이 더 중요합니다.";
  const emptyFocus =
    market === "stocks"
      ? "금리, 달러, VIX, 주요 지수선물의 현재 반응을 확인하세요."
      : "BTC와 ETH 가격 반응, 도미넌스, 거래량을 확인하세요.";
  const fallbackIssues = buildFallbackIssues(items, market);
  const emptyKeyIssues: RadarNewsBriefing["keyIssues"] = [
    {
      title: "현재 강한 뉴스 없음",
      detail: `${marketLabel}에 즉시 방향을 바꿀 만큼 강한 공개 뉴스는 아직 잡히지 않았습니다. ${emptyFocus}`,
      tone: "neutral"
    }
  ];

  return {
    generatedAt: new Date().toISOString(),
    model,
    overview:
      items.length === 0
        ? `${marketLabel}에 즉시 방향을 정할 만큼 강한 뉴스는 아직 확인되지 않습니다. 시장 영향이 큰 공개 뉴스만 추려 보는 중입니다. ${emptyFocus}`
        : `지난 1시간 뉴스 흐름은 ${newsBalance} ${briefingFocus} ${followUpFocus}`,
    keyIssues: items.length === 0 ? emptyKeyIssues : fallbackIssues,
    marketImpact:
      items.length === 0
        ? [
            "현재 뉴스만으로는 시장 방향을 단정하기 어렵습니다.",
            market === "stocks" ? "금리, 달러, VIX, 지수선물이 같은 방향으로 움직이는지 확인하세요." : "BTC, ETH, 도미넌스, 거래량 반응이 함께 움직이는지 확인하세요.",
            "강한 뉴스가 없을 때는 가격 반응이 더 중요한 구간입니다."
          ]
        : [
            bullish > bearish
              ? "전체 기사 흐름은 우호적인 재료가 조금 더 많지만, 가격이 이미 선반영했는지 확인해야 합니다."
              : bearish > bullish
                ? market === "stocks"
                  ? "방어적으로 볼 재료가 더 많습니다. 금리와 달러가 강하고 주요 지수가 지지선을 잃는지 확인해야 합니다."
                  : "방어적으로 볼 재료가 더 많습니다. 금리와 달러가 강하고 BTC가 지지선을 잃는지 확인해야 합니다."
                : "뉴스 방향이 엇갈립니다. 가격 반응과 거래량 확인이 우선입니다.",
            market === "stocks" ? "미국 물가 이슈, 금리, 달러, 주요 지수선물이 같은 방향으로 움직이는지 확인하세요." : "BTC, ETH, 도미넌스, ETF 수급, 거래량 반응을 함께 보면 뉴스 해석이 더 선명해집니다.",
            "뉴스 리포트는 방향의 이유를 정리하는 도구이고, 실제 판단은 가격 구조와 리스크 관리까지 함께 봐야 합니다."
          ],
    strategyNotes:
      items.length === 0
        ? [
            "새 뉴스 유입 시 가격 반응 확인",
            "거래량 동반 여부 확인",
            "알림 조건 재확인"
          ]
        : market === "stocks"
          ? [
              "지수선물·섹터 반응 확인",
              "금리·달러 부담 확인",
              "강한 반응 축 확인"
            ]
          : [
              "BTC·ETH 동반 반응 확인",
              "금리·달러 부담 확인",
              "거래량 동반 여부 확인"
            ],
    finalSummary:
      items.length === 0
        ? "현재 강한 뉴스는 없습니다. 가격 반응이 먼저입니다."
        : bullish > bearish ? "뉴스는 상승 쪽이 조금 우세합니다. 가격 반응 확인이 우선입니다." : bearish > bullish ? "뉴스는 하락 쪽이 조금 우세합니다. 리스크 확인이 우선입니다." : "뉴스 흐름은 중립입니다. 방향 확인이 먼저입니다."
  };
}

function buildNewsBriefingPrompt(items: RadarNewsItem[], market: RadarNewsMarket) {
  const marketLabel = market === "stocks" ? "글로벌 시장" : "코인 시장";
  const focusRule =
    market === "stocks"
      ? "- 글로벌 시장은 금리, 달러, 지수선물, 실적, 섹터 흐름, 원자재 중심으로 씁니다."
      : "- 코인 시장은 개별 알트코인보다 BTC/ETH, ETF 수급, 금리, 달러, 유동성, 규제, 스테이블코인, 청산, 도미넌스 중심으로 씁니다.\n- 토르체인, 밈코인, 개별 프로젝트 업데이트처럼 전체 시장 영향이 약한 뉴스는 핵심 이슈로 다루지 않습니다.";
  const headlines = items
    .slice(0, 10)
    .map(
      (item, index) =>
        `${index + 1}. [${displayNewsSource(item.source)}] ${itemTitle(item, market)}\n원문 제목: ${item.originalTitle ?? item.title}\n방향: ${toneLabel(item.direction)}\n기사 내용 일부: ${
          item.excerpt || "RSS 요약 없음"
        }\n시장 분류: ${item.summary}`
    )
    .join("\n\n");

  return `아래 ${marketLabel} 기사 묶음을 바탕으로 한국어 시장 현황 리포트를 작성해 주세요. JSON 하나만 반환하세요.
{
  "overview": "지난 1시간 뉴스 흐름을 2~3문장으로 설명",
  "keyIssues": [{ "title": "한국어 핵심 뉴스 제목", "detail": "왜 중요한지 1~2문장으로 설명", "tone": "bullish|bearish|neutral" }],
  "marketImpact": ["시장 영향 한 줄 3개"],
  "strategyNotes": ["확인할 가격 반응 한 줄 3개"],
  "finalSummary": "마지막 한 줄 정리"
}

규칙.
- 모든 문장은 한국어로 씁니다.
- 영어 기사 제목을 그대로 옮기지 말고 한국어 소제목으로 바꿉니다.
- 원문 제목은 사실 확인용으로만 참고하고, 사용자에게 보일 제목은 짧고 자연스러운 한국어 시장 뉴스 제목으로 씁니다.
- QQQ, SPY, NVDA, FOMC, CPI, PPI, VIX, Fed 같은 티커·지표·고유명사는 임의로 풀어 쓰거나 다른 의미로 바꾸지 않습니다.
- 직접적인 매수·매도 지시는 금지합니다.
- 과격한 급등락 표현, 매수 유도, 수익 암시, 단정적 신호 표현은 쓰지 않습니다.
- 과장하지 말고 시장 영향과 확인 사인을 중심으로 씁니다.
- 화면에 바로 보일 짧은 문장으로 씁니다.
- 뉴스 화면 전용입니다. 일정, 캘린더, 예정 발표, 다음 이벤트 안내는 쓰지 않습니다.
- "발표 전후", "예정 이벤트", "일정 확인" 같은 표현은 쓰지 않습니다.
- 단순 제목 요약이 아니라 여러 기사의 공통 흐름을 묶어 설명합니다.
- 원문의 달러 금액은 원화, 만원, 억원으로 환산하지 말고 달러 단위로 유지합니다. 예: "$77,000"은 "77,000달러" 또는 "7만 7,000달러"로 씁니다.
- BTC, ETH, 나스닥, S&P500 같은 가격·지수 단위는 원문 단위를 유지합니다.
${focusRule}

뉴스 자료.
${headlines || "수집된 뉴스가 부족합니다."}`;
}

function parseAIJsonBriefing(raw: string, items: RadarNewsItem[], model: string, market: RadarNewsMarket): RadarNewsBriefing {
  const fallback = fallbackNewsBriefing(items, model, market);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return fallback;

  try {
    const parsed = JSON.parse(match[0]) as Partial<RadarNewsBriefing>;
    const parsedIssues = Array.isArray(parsed.keyIssues) ? parsed.keyIssues : [];
    const keyIssues = parsedIssues
      .slice(0, 5)
      .map((issue, index) => {
        const fallbackIssue = fallback.keyIssues[index] ?? fallback.keyIssues[0];
        return {
          title: polishBriefingCopy(items, ensureKoreanText(issue?.title, fallbackIssue.title)).slice(0, 120),
          detail: polishBriefingCopy(items, ensureKoreanText(issue?.detail, fallbackIssue.detail)).slice(0, 520),
          tone: issue?.tone === "bullish" || issue?.tone === "bearish" || issue?.tone === "neutral" ? issue.tone : fallbackIssue.tone
        };
      });

    return {
      generatedAt: new Date().toISOString(),
      model,
      overview: polishBriefingCopy(items, ensureKoreanText(parsed.overview, fallback.overview)).slice(0, 700),
      keyIssues: keyIssues.length ? keyIssues : fallback.keyIssues,
      marketImpact: ensureKoreanList(parsed.marketImpact, fallback.marketImpact, 3).map((item) => polishBriefingCopy(items, item)),
      strategyNotes: ensureKoreanList(parsed.strategyNotes, fallback.strategyNotes, 3).map((item) => polishBriefingCopy(items, item)),
      finalSummary: polishBriefingCopy(items, ensureKoreanText(parsed.finalSummary, fallback.finalSummary)).slice(0, 360)
    };
  } catch {
    return fallback;
  }
}

async function generateNewsBriefing(items: RadarNewsItem[], market: RadarNewsMarket) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return fallbackNewsBriefing(items, USE_GEMINI_NEWS_FALLBACK ? "rules-gemini-ready" : "rules", market);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || GROQ_DEFAULT_MODEL,
        messages: [{ role: "user", content: buildNewsBriefingPrompt(items, market) }],
        temperature: 0.2,
        max_tokens: 1200
      })
    });

    if (!response.ok) return fallbackNewsBriefing(items, "rules", market);
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = payload.choices?.[0]?.message?.content?.trim() ?? "";
    return text ? parseAIJsonBriefing(text, items, process.env.GROQ_MODEL || GROQ_DEFAULT_MODEL, market) : fallbackNewsBriefing(items, "rules", market);
  } catch {
    return fallbackNewsBriefing(items, "rules", market);
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawMarket = searchParams.get("market") ?? "crypto";
  if (rawMarket !== "crypto" && rawMarket !== "stocks") {
    return NextResponse.json({ error: "지원하지 않는 뉴스 시장입니다." }, { status: 400 });
  }

  const market: RadarNewsMarket = rawMarket;
  const now = Date.now();
  if (cache[market] && now - cache[market]!.updatedAt < CACHE_MS) {
    return NextResponse.json({ ...cache[market], market, cached: true, refreshIntervalMs: CACHE_MS });
  }

  const limited = await rateLimit(request, {
    key: `radar-news:${market}`,
    limit: 120,
    windowMs: 60 * 60 * 1000
  });

  if (!limited.allowed) {
    return NextResponse.json({ error: "뉴스 레이더 요청이 잠시 많습니다.", retryAfter: limited.retryAfter }, { status: 429 });
  }

  const feeds = market === "stocks" ? STOCK_FEEDS : CRYPTO_FEEDS;

  const settled = await Promise.allSettled(feeds.map((feed) => loadFeed(feed, market)));
  const failedSources = settled
    .map((result, index) => (result.status === "rejected" ? feeds[index].source : null))
    .filter((source): source is string => Boolean(source));

  const deduped = new Map<string, RadarNewsItem>();
  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    for (const item of result.value) {
      const key = item.link || item.title;
      if (!deduped.has(key)) deduped.set(key, item);
    }
  }

  const items = Array.from(deduped.values())
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 24);
  const briefing = await generateNewsBriefing(items, market);
  const payload = { updatedAt: now, items, briefing, failedSources };
  cache[market] = payload;

  return NextResponse.json({ ...payload, market, cached: false, refreshIntervalMs: CACHE_MS });
}
