// 공개 RSS 뉴스를 수집해 한국어 레이더 브리핑으로 정리하는 API입니다.
import { NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import {
  createRadarNewsItem,
  displayNewsSource,
  fallbackKoreanNewsTitle,
  localizeNewsSourceText,
  type RadarNewsBriefing,
  type RadarNewsDirection,
  type RadarNewsItem,
  type RadarNewsMarket
} from "@/lib/radarNews";
import { rateLimit } from "@/lib/server/rateLimit";
import { entitlementRateKey, getRequestEntitlement } from "@/lib/server/requestEntitlement";

export const runtime = "nodejs";

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
const GEMINI_MODEL = "gemini-3-flash-preview";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const GROQ_DEFAULT_MODEL = "llama-3.1-8b-instant";
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const USE_GEMINI_NEWS_FALLBACK = process.env.ENABLE_GEMINI_NEWS_FALLBACK === "true";

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
  if (value && typeof value === "object" && "text" in value) {
    return cleanText((value as { text?: unknown }).text);
  }
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

function ensureKoreanText(value: string, fallback: string) {
  const localized = localizeNewsSourceText(value).replace(/\s+/g, " ").trim();
  return hasKorean(localized) ? localized : fallback;
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

function isUsefulKoreanTitle(value: string) {
  const trimmed = value.trim();
  if (!hasKorean(trimmed)) return false;
  const longEnglishWords = trimmed.match(/\b[A-Za-z]{4,}\b/g) ?? [];
  return trimmed.length >= 8 && longEnglishWords.length <= 3;
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

  const model = process.env.GROQ_MODEL || GROQ_DEFAULT_MODEL;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6_000);
  try {
    const marketLabel = market === "stocks" ? "미국주식, ETF, 매크로" : "코인";
    const response = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: `아래 영어 ${marketLabel} 뉴스 제목을 한국 투자자가 바로 이해할 수 있는 자연스러운 한국어 제목으로 번역해 주세요.

규칙.
- 반드시 JSON 문자열 배열만 반환합니다.
- 입력 순서와 개수를 그대로 맞춥니다.
- 영어 제목을 그대로 복사하지 말고 의미를 한국어로 바꿉니다.
- 과장된 매수, 매도 표현은 쓰지 않습니다.

제목.
${pending.map((title, index) => `${index + 1}. ${title}`).join("\n")}`
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
        const candidate = translated[index] ?? "";
        const next = isUsefulKoreanTitle(candidate) ? candidate.trim() : fallbackKoreanNewsTitle(title, market);
        translationCache.set(`${market}:${title}`, next);
        result.set(title, next);
      });
      return result;
    }
  } catch {
    // AI 번역이 지연되면 규칙 기반 한국어 제목으로 즉시 대체합니다.
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
    headers: {
      "user-agent": "ChartRadarBot/0.1 (+https://chartradar.ai)"
    },
    next: { revalidate: 300 }
  });

  if (!response.ok) throw new Error(`${feed.source} RSS ${response.status}`);

  const xml = await response.text();
  const parsed = parser.parse(xml);
  const rssItems = asArray<unknown>(parsed?.rss?.channel?.item);
  const atomItems = asArray<unknown>(parsed?.feed?.entry);
  const entries = rssItems.length ? rssItems : atomItems;
  const records = entries
    .slice(0, 8)
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

function itemTitle(item: RadarNewsItem) {
  return item.translatedTitle || fallbackKoreanNewsTitle(item.title);
}

function toneLabel(tone: RadarNewsDirection) {
  if (tone === "bullish") return "상방 우호";
  if (tone === "bearish") return "하방 주의";
  return "중립 확인";
}

function mostCommonAssets(items: RadarNewsItem[]) {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const asset of item.assets) counts.set(asset, (counts.get(asset) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([asset]) => asset);
}

function urgencyWeight(item: RadarNewsItem) {
  if (item.urgency === "high") return 2;
  if (item.urgency === "medium") return 1;
  return 0;
}

function fallbackNewsBriefing(items: RadarNewsItem[], model = "rules", market: RadarNewsMarket = "crypto"): RadarNewsBriefing {
  const bullish = items.filter((item) => item.direction === "bullish").length;
  const bearish = items.filter((item) => item.direction === "bearish").length;
  const neutral = Math.max(0, items.length - bullish - bearish);
  const urgent = items.filter((item) => item.urgency === "high").length;
  const assets = mostCommonAssets(items);
  const leadingTone: RadarNewsDirection = bullish > bearish ? "bullish" : bearish > bullish ? "bearish" : "neutral";
  const marketLabel = market === "stocks" ? "글로벌 시장" : "코인 시장";
  const watchLabel = assets.length ? assets.join(", ") : market === "stocks" ? "주요 지수와 대형주" : "BTC와 주요 코인";
  const topItems = [...items]
    .sort((a, b) => {
      const urgencyDiff = urgencyWeight(b) - urgencyWeight(a);
      if (urgencyDiff !== 0) return urgencyDiff;
      return Math.abs(b.score - 50) - Math.abs(a.score - 50);
    })
    .slice(0, 5);

  const overview =
    items.length === 0
      ? `${marketLabel} 관련 뉴스가 충분히 수집되지 않았습니다. 가격 반응과 공식 발표를 먼저 확인해 주세요.`
      : `${marketLabel} 뉴스는 상방 우호 ${bullish}개, 하방 주의 ${bearish}개, 중립 확인 ${neutral}개로 정리됩니다. ${watchLabel} 관련 이슈가 많이 잡혔고, 즉시 확인할 만한 이슈는 ${urgent}개입니다.`;

  return {
    generatedAt: new Date().toISOString(),
    model,
    overview,
    keyIssues: topItems.map((item) => ({
      title: itemTitle(item),
      detail: `${displayNewsSource(item.source)} 기준 ${toneLabel(item.direction)} 이슈입니다. ${item.summary}`,
      tone: item.direction
    })),
    marketImpact: [
      leadingTone === "bullish"
        ? `${marketLabel} 심리는 우호적으로 기울어 있습니다. 다만 가격이 먼저 움직였다면 눌림과 거래량 확인이 필요합니다.`
        : leadingTone === "bearish"
          ? `${marketLabel}에는 방어적으로 볼 뉴스가 더 많습니다. 지지선 이탈과 변동성 확대 여부를 우선 확인하세요.`
          : `${marketLabel} 뉴스만으로는 방향을 단정하기 어렵습니다. 가격 반응과 후속 뉴스가 같은 방향으로 이어지는지 확인해야 합니다.`,
      market === "stocks"
        ? "SPY, QQQ, 미국 10년물 금리, 달러 흐름을 함께 보면 실제 시장 영향이 더 선명해집니다."
        : "BTC, ETH, 도미넌스, 거래량 반응을 함께 보면 실제 시장 영향이 더 선명해집니다.",
      "뉴스는 방향의 이유가 될 수 있으므로 차트 구조와 리스크 관리가 함께 맞는지 확인하세요."
    ],
    strategyNotes: [
      "뉴스 직후에는 스프레드와 급등락이 커질 수 있으니 바로 추격하기보다 첫 반응 이후의 유지력을 보세요.",
      "상방 뉴스와 하방 뉴스가 섞인 날에는 포지션 크기를 줄이고 주요 지지와 저항을 먼저 확인하세요.",
      "이 브리핑은 오늘 먼저 볼 이슈와 가격 반응 확인 순서를 정리합니다."
    ],
    finalSummary:
      leadingTone === "bullish"
        ? "정리하면, 뉴스 흐름은 우호적입니다. 다만 진입은 가격이 다시 구조를 확인해 줄 때가 더 안전합니다."
        : leadingTone === "bearish"
          ? "정리하면, 방어적으로 볼 필요가 있는 구간입니다. 반등보다 지지선과 거래량을 먼저 확인하세요."
          : "정리하면, 뉴스 방향은 아직 중립입니다. 가격 반응과 추가 헤드라인을 함께 보세요."
  };
}

function buildNewsBriefingPrompt(items: RadarNewsItem[], market: RadarNewsMarket) {
  const marketLabel = market === "stocks" ? "글로벌 시장" : "코인 시장";
  const headlines = items
    .slice(0, 10)
    .map((item, index) => {
      return `${index + 1}. [${displayNewsSource(item.source)}] ${itemTitle(item)}
방향: ${toneLabel(item.direction)}
점수: ${item.score}
태그: ${item.tags.join(", ")}
요약: ${item.summary}`;
    })
    .join("\n\n");

  return `아래 ${marketLabel} 관련 뉴스 제목과 1차 분류를 바탕으로 한국어 시장 브리핑을 작성해 주세요.

출력은 반드시 JSON 하나만 반환합니다.
{
  "overview": "오늘 시장을 2~4문장으로 요약",
  "keyIssues": [
    { "title": "주요 이슈 제목", "detail": "왜 중요한지와 확인할 점", "tone": "bullish|bearish|neutral" }
  ],
  "marketImpact": ["시장에 미칠 수 있는 영향 3개"],
  "strategyNotes": ["투자 판단 전 참고할 점 3개"],
  "finalSummary": "마지막 한 줄 정리"
}

규칙.
- 모든 문장은 한국어로 작성합니다.
- 영어 원문 제목을 그대로 복사하지 않습니다.
- CPI, PPI, inflation, price pressure는 "미국 물가 이슈"처럼 한국어 투자자가 바로 이해할 표현으로 바꿉니다.
- 직접적인 매수, 매도 지시나 수익 보장은 금지합니다.
- keyIssues는 3개에서 5개 사이로 작성합니다.
- marketImpact와 strategyNotes는 각각 정확히 3개로 작성합니다.

뉴스 자료.
${headlines || "수집된 뉴스가 부족합니다."}`;
}

function asBriefingIssue(value: unknown): RadarNewsBriefing["keyIssues"][number] | null {
  if (!value || typeof value !== "object") return null;
  const item = value as { title?: unknown; detail?: unknown; tone?: unknown };
  const tone = item.tone === "bullish" || item.tone === "bearish" || item.tone === "neutral" ? item.tone : "neutral";
  if (typeof item.title !== "string" || typeof item.detail !== "string") return null;
  return {
    title: ensureKoreanText(item.title, "오늘 확인할 주요 시장 이슈").slice(0, 120),
    detail: ensureKoreanText(item.detail, "공개 뉴스 기준으로 가격 반응과 변동성을 함께 확인해야 하는 이슈입니다.").slice(0, 360),
    tone
  };
}

function asStringList(value: unknown, limit: number) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .slice(0, limit)
    .map((item) => ensureKoreanText(item, "시장 반응과 가격 구조를 함께 확인해야 합니다.").slice(0, 260));
}

function parseAIJsonBriefing(raw: string, items: RadarNewsItem[], model: string, market: RadarNewsMarket): RadarNewsBriefing {
  const fallback = fallbackNewsBriefing(items, model, market);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return fallback;

  try {
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    const keyIssues = Array.isArray(parsed.keyIssues)
      ? parsed.keyIssues.map(asBriefingIssue).filter((item): item is RadarNewsBriefing["keyIssues"][number] => Boolean(item)).slice(0, 5)
      : [];
    const marketImpact = asStringList(parsed.marketImpact, 3);
    const strategyNotes = asStringList(parsed.strategyNotes, 3);

    return {
      generatedAt: new Date().toISOString(),
      model,
      overview: typeof parsed.overview === "string" ? ensureKoreanText(parsed.overview, fallback.overview).slice(0, 700) : fallback.overview,
      keyIssues: keyIssues.length ? keyIssues : fallback.keyIssues,
      marketImpact: marketImpact.length ? marketImpact : fallback.marketImpact,
      strategyNotes: strategyNotes.length ? strategyNotes : fallback.strategyNotes,
      finalSummary: typeof parsed.finalSummary === "string" ? ensureKoreanText(parsed.finalSummary, fallback.finalSummary).slice(0, 360) : fallback.finalSummary
    };
  } catch {
    return fallback;
  }
}

async function generateGroqNewsBriefing(items: RadarNewsItem[], market: RadarNewsMarket) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const model = process.env.GROQ_MODEL || GROQ_DEFAULT_MODEL;
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
        model,
        messages: [{ role: "user", content: buildNewsBriefingPrompt(items, market) }],
        temperature: 0.2,
        max_tokens: 1800
      })
    });

    if (!response.ok) return null;
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = payload.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) return null;
    return parseAIJsonBriefing(text, items, model, market);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function generateGeminiNewsBriefing(items: RadarNewsItem[], market: RadarNewsMarket) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18_000);
  try {
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildNewsBriefingPrompt(items, market) }] }],
        generationConfig: {
          temperature: 0.25,
          topP: 0.85,
          maxOutputTokens: 2048,
          candidateCount: 1
        }
      })
    });

    if (!response.ok) return null;
    const payload = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? "";
    if (!text) return null;
    return parseAIJsonBriefing(text, items, GEMINI_MODEL, market);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function generateNewsBriefing(items: RadarNewsItem[], market: RadarNewsMarket) {
  const groqBriefing = await generateGroqNewsBriefing(items, market);
  if (groqBriefing) return groqBriefing;

  if (!USE_GEMINI_NEWS_FALLBACK) return fallbackNewsBriefing(items, "rules", market);

  const geminiBriefing = await generateGeminiNewsBriefing(items, market);
  if (geminiBriefing) return geminiBriefing;

  return fallbackNewsBriefing(items, "rules", market);
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
