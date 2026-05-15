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
import { entitlementRateKey, getRequestEntitlement } from "@/lib/server/requestEntitlement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NewsFeed = {
  source: string;
  url: string;
};

const CRYPTO_FEEDS = [
  { source: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
  { source: "Cointelegraph", url: "https://cointelegraph.com/rss" }
] satisfies readonly NewsFeed[];

const STOCK_FEEDS = [
  { source: "CNBC Markets", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html" },
  { source: "MarketWatch", url: "https://feeds.content.dowjones.io/public/rss/mw_topstories" }
] satisfies readonly NewsFeed[];

const CACHE_MS = 5 * 60 * 1000;
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

function toIsoDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function hasKorean(value: string) {
  return /[가-힣]/.test(value);
}

function ensureKoreanText(value: string | undefined, fallback: string) {
  const text = value?.trim();
  if (!text) return fallback;
  return hasKorean(text) ? text : fallback;
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
            content: `${marketLabel} 뉴스 제목을 한국 투자자가 바로 이해하기 쉽게 자연스럽게 번역해 주세요. JSON 문자열 배열만 반환하세요.\n\n${pending
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
        const next = candidate && hasKorean(candidate) ? candidate : fallbackKoreanNewsTitle(title, market);
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
    .slice(0, 10)
    .map((entry) => {
      const record = entry as Record<string, unknown>;
      const title = pickText(record.title);
      const link = normalizeLink(record.link) || pickText(record.guid);
      const publishedAt = pickText(record.pubDate) || pickText(record.published) || pickText(record.updated) || new Date().toISOString();
      if (!title || !link) return null;
      return { title, link, publishedAt };
    })
    .filter((record): record is { title: string; link: string; publishedAt: string } => Boolean(record));

  const translations = await translateTitlesWithGroq(
    records.map((record) => record.title),
    market
  );

  return records.map((record) =>
    createRadarNewsItem(
      {
        source: feed.source,
        title: record.title,
        translatedTitle: translations.get(record.title) ?? fallbackKoreanNewsTitle(record.title, market),
        link: record.link,
        publishedAt: toIsoDate(record.publishedAt)
      },
      market
    )
  );
}

function toneLabel(tone: RadarNewsDirection) {
  if (tone === "bullish") return "상방 우호";
  if (tone === "bearish") return "하방 주의";
  return "중립 확인";
}

function itemTitle(item: RadarNewsItem, market: RadarNewsMarket) {
  return item.translatedTitle || fallbackKoreanNewsTitle(item.title, market);
}

function fallbackNewsBriefing(items: RadarNewsItem[], model = "rules", market: RadarNewsMarket = "crypto"): RadarNewsBriefing {
  const bullish = items.filter((item) => item.direction === "bullish").length;
  const bearish = items.filter((item) => item.direction === "bearish").length;
  const neutral = Math.max(0, items.length - bullish - bearish);
  const marketLabel = market === "stocks" ? "글로벌 시장" : "코인 시장";
  const sorted = [...items].sort((a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50)).slice(0, 5);

  return {
    generatedAt: new Date().toISOString(),
    model,
    overview:
      items.length === 0
        ? `${marketLabel} 뉴스를 충분히 수집하지 못했습니다. 잠시 후 다시 확인해 주세요.`
        : `오늘 확인할 주요 시장 이슈는 ${marketLabel} 뉴스 기준 상방 우호 ${bullish}개, 하방 주의 ${bearish}개, 중립 확인 ${neutral}개로 정리됩니다. 뉴스만으로 진입하지 말고 차트와 거래량 반응을 함께 확인하는 편이 좋습니다.`,
    keyIssues: sorted.map((item) => ({
      title: itemTitle(item, market),
      detail: `${displayNewsSource(item.source)} 기준 ${toneLabel(item.direction)} 뉴스입니다. ${item.summary}`,
      tone: item.direction
    })),
    marketImpact: [
      bullish > bearish ? "현재 뉴스 흐름은 상방 재료가 조금 더 많습니다. 다만 가격이 이미 반영했는지 확인해야 합니다." : bearish > bullish ? "방어적으로 볼 뉴스가 더 많습니다. 지지선 반응과 변동성 확대 여부가 중요합니다." : "뉴스 방향이 엇갈립니다. 가격 반응 확인이 우선입니다.",
      market === "stocks" ? "미국 물가 이슈, 금리, 달러, 주요 지수 선물이 같은 방향으로 움직이는지 확인하세요." : "BTC, ETH, 도미넌스, 거래량 반응을 함께 보면 뉴스 해석이 더 선명해집니다.",
      "뉴스는 방향의 이유를 정리하는 도구이고, 실제 판단은 가격 구조와 리스크 관리까지 함께 봐야 합니다."
    ],
    strategyNotes: [
      "속보 직후에는 스프레드와 변동성이 커질 수 있으니 바로 추격하지 않는 편이 안전합니다.",
      "상방 뉴스와 하방 뉴스가 동시에 나오면 포지션 크기를 줄이고 확인 매매를 우선하세요.",
      "가장 강하게 반응하는 자산이 무엇인지 먼저 확인하면 시장의 실제 관심사를 파악할 수 있습니다."
    ],
    finalSummary: bullish > bearish ? "뉴스 흐름은 우호적입니다. 다만 차트가 따라붙는지 확인하세요." : bearish > bullish ? "뉴스 흐름은 방어적입니다. 반등보다 리스크 관리가 먼저입니다." : "뉴스 흐름은 중립입니다. 방향이 확인될 때까지 서두르지 않는 편이 좋습니다."
  };
}

function buildNewsBriefingPrompt(items: RadarNewsItem[], market: RadarNewsMarket) {
  const marketLabel = market === "stocks" ? "글로벌 시장" : "코인 시장";
  const headlines = items
    .slice(0, 10)
    .map((item, index) => `${index + 1}. [${displayNewsSource(item.source)}] ${itemTitle(item, market)}\n방향: ${toneLabel(item.direction)}\n요약: ${item.summary}`)
    .join("\n\n");

  return `아래 ${marketLabel} 뉴스를 바탕으로 한국어 시장 브리핑을 작성해 주세요. JSON 하나만 반환하세요.
{
  "overview": "오늘 시장을 2~4문장으로 요약",
  "keyIssues": [{ "title": "핵심 이슈", "detail": "왜 중요한지", "tone": "bullish|bearish|neutral" }],
  "marketImpact": ["시장 영향 3개"],
  "strategyNotes": ["투자자가 확인할 것 3개"],
  "finalSummary": "마지막 한 줄 정리"
}

규칙.
- 모든 문장은 한국어로 씁니다.
- 직접적인 매수·매도 지시는 금지합니다.
- 과장하지 말고 시장 영향과 확인 사인을 중심으로 씁니다.

뉴스 자료.
${headlines || "수집된 뉴스가 부족합니다."}`;
}

function parseAIJsonBriefing(raw: string, items: RadarNewsItem[], model: string, market: RadarNewsMarket): RadarNewsBriefing {
  const fallback = fallbackNewsBriefing(items, model, market);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return fallback;

  try {
    const parsed = JSON.parse(match[0]) as Partial<RadarNewsBriefing>;
    return {
      generatedAt: new Date().toISOString(),
      model,
      overview: ensureKoreanText(parsed.overview, fallback.overview).slice(0, 700),
      keyIssues: Array.isArray(parsed.keyIssues) && parsed.keyIssues.length ? parsed.keyIssues.slice(0, 5) : fallback.keyIssues,
      marketImpact: Array.isArray(parsed.marketImpact) && parsed.marketImpact.length ? parsed.marketImpact.slice(0, 3) : fallback.marketImpact,
      strategyNotes: Array.isArray(parsed.strategyNotes) && parsed.strategyNotes.length ? parsed.strategyNotes.slice(0, 3) : fallback.strategyNotes,
      finalSummary: ensureKoreanText(parsed.finalSummary, fallback.finalSummary).slice(0, 360)
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
        max_tokens: 1800
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
  const entitlement = await getRequestEntitlement(request, market);
  const limited = await rateLimit(request, {
    key: entitlementRateKey(`radar-news:${market}`, entitlement),
    limit: entitlement.isPaid ? 60 : 12,
    windowMs: entitlement.isPaid ? 60_000 : 10 * 60_000
  });

  if (!limited.allowed) {
    return NextResponse.json({ error: "뉴스 레이더 요청이 잠시 많습니다.", retryAfter: limited.retryAfter }, { status: 429 });
  }

  const requestedBriefingMode = searchParams.get("briefing") === "0" ? "preview" : "full";
  const briefingMode = entitlement.isPaid ? requestedBriefingMode : "preview";
  const feeds = market === "stocks" ? STOCK_FEEDS : CRYPTO_FEEDS;
  const now = Date.now();

  if (briefingMode === "full" && cache[market] && now - cache[market]!.updatedAt < CACHE_MS) {
    return NextResponse.json({ ...cache[market], market, cached: true });
  }

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
  const briefing = briefingMode === "preview" ? fallbackNewsBriefing(items, "preview", market) : await generateNewsBriefing(items, market);
  const payload = { updatedAt: now, items, briefing, failedSources };
  if (briefingMode === "full") cache[market] = payload;

  return NextResponse.json({ ...payload, market, cached: false });
}
