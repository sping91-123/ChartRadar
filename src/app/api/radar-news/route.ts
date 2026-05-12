// 공개 RSS 뉴스 제목을 수집해 레이더뉴스 카드 데이터로 변환하는 API.
import { NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import {
  createRadarNewsItem,
  type RadarNewsBriefing,
  type RadarNewsDirection,
  type RadarNewsItem,
  type RadarNewsMarket
} from "@/lib/radarNews";
import { rateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";

type NewsFeed = {
  source: string;
  url: string;
};

const CRYPTO_FEEDS = [
  {
    source: "CoinDesk",
    url: "https://www.coindesk.com/arc/outboundfeeds/rss/"
  },
  {
    source: "Cointelegraph",
    url: "https://cointelegraph.com/rss"
  }
] satisfies readonly NewsFeed[];

const STOCK_FEEDS = [
  {
    source: "CNBC Markets",
    url: "https://www.cnbc.com/id/100003114/device/rss/rss.html"
  },
  {
    source: "MarketWatch",
    url: "https://feeds.content.dowjones.io/public/rss/mw_topstories"
  }
] satisfies readonly NewsFeed[];

const CACHE_MS = 5 * 60 * 1000;
const GEMINI_MODEL = "gemini-3-flash-preview";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const GROQ_DEFAULT_MODEL = "qwen/qwen3-32b";
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

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

function cleanText(value: unknown) {
  if (typeof value !== "string") return "";
  return value
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
  return /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(value);
}

function knownCryptoTitle(title: string) {
  const normalized = title.toLowerCase();

  if (normalized.includes("kraken parent") && normalized.includes("occ charter")) {
    return "크라켄 모회사, 연방 암호화 은행 인가 신청";
  }
  if (normalized.includes("coinbase bulls") && normalized.includes("stablecoin")) {
    return "코인베이스 강세론자들, 실적 부진 뒤 암호화폐 법안과 스테이블코인에 주목";
  }
  if (normalized.includes("kelp dao exploit")) {
    return "Kelp DAO 해킹 이슈, DeFi 오라클 리스크 재점검 촉발";
  }
  if (normalized.includes("mstr stock") && normalized.includes("rally")) {
    return "스트래티지 MSTR 주가, 1분기 손실에도 랠리 가능성 부각";
  }

  return null;
}

function localTranslateTitle(title: string) {
  return title
    .replace(/\bBitcoin\b/gi, "비트코인")
    .replace(/\bBTC\b/g, "BTC")
    .replace(/\bEthereum\b/gi, "이더리움")
    .replace(/\bETH\b/g, "ETH")
    .replace(/\bSolana\b/gi, "솔라나")
    .replace(/\bXRP\b/g, "XRP")
    .replace(/\bETF\b/g, "ETF")
    .replace(/\bSEC\b/g, "SEC")
    .replace(/\bFed\b/g, "연준")
    .replace(/\binflows?\b/gi, "자금 유입")
    .replace(/\boutflows?\b/gi, "자금 유출")
    .replace(/\brally\b/gi, "랠리")
    .replace(/\bsurge\b/gi, "급등")
    .replace(/\bplunge\b/gi, "급락")
    .replace(/\bhack\b/gi, "해킹")
    .replace(/\bapproval\b/gi, "승인")
    .replace(/\blawsuit\b/gi, "소송")
    .trim();
}

function polishKoreanTitle(title: string) {
  return title
    .replace(/크라켄 부모/g, "크라켄 모회사")
    .replace(/부모는/g, "모회사는")
    .replace(/OCC 헌장/g, "OCC 인가")
    .replace(/헌장을 신청/g, "인가를 신청")
    .replace(/코인베이스 불은/g, "코인베이스 강세론자들은")
    .replace(/전략의 MSTR 재고/g, "스트래티지 MSTR 주가")
    .replace(/\b재고\b/g, "주가")
    .replace(/오라클 제공자/g, "오라클 제공업체")
    .replace(/익스플로잇/g, "해킹 이슈")
    .replace(/\s+%/g, "%")
    .replace(/\s+/g, " ")
    .trim();
}

async function translateTitleToKorean(title: string) {
  if (hasKorean(title)) return title;
  const known = knownCryptoTitle(title);
  if (known) return known;

  const cached = translationCache.get(title);
  if (cached) return cached;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    let response: Response;
    try {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(title)}&langpair=en|ko`;
      response = await fetch(url, { signal: controller.signal, next: { revalidate: 3600 } });
    } finally {
      clearTimeout(timer);
    }

    if (response.ok) {
      const payload = (await response.json()) as { responseData?: { translatedText?: string } };
      const translated = polishKoreanTitle(payload.responseData?.translatedText?.replace(/\s+/g, " ").trim() ?? "");
      if (translated && translated.toLowerCase() !== title.toLowerCase()) {
        translationCache.set(title, translated);
        return translated;
      }
    }
  } catch {
    // 무료 번역 API가 지연되면 아래의 로컬 용어 치환으로 대체한다.
  }

  const fallback = polishKoreanTitle(localTranslateTitle(title));
  translationCache.set(title, fallback);
  return fallback;
}

async function loadFeed(feed: NewsFeed, market: RadarNewsMarket) {
  const response = await fetch(feed.url, {
    headers: {
      "user-agent": "ChartRadarBot/0.1 (+https://chartradar.local)"
    },
    next: { revalidate: 300 }
  });

  if (!response.ok) {
    throw new Error(`${feed.source} RSS ${response.status}`);
  }

  const xml = await response.text();
  const parsed = parser.parse(xml);
  const rssItems = asArray(parsed?.rss?.channel?.item);
  const atomItems = asArray(parsed?.feed?.entry);
  const entries = rssItems.length ? rssItems : atomItems;

  const pickedEntries = entries.slice(0, 6);
  const items = await Promise.all(
    pickedEntries.map(async (entry) => {
      const title = pickText(entry?.title);
      const link = normalizeLink(entry?.link) || pickText(entry?.guid);
      const publishedAt =
        pickText(entry?.pubDate) ||
        pickText(entry?.published) ||
        pickText(entry?.updated) ||
        new Date().toISOString();

      if (!title || !link) return null;

      const translatedTitle = await translateTitleToKorean(title);

      return createRadarNewsItem({
        source: feed.source,
        title,
        translatedTitle,
        link,
        publishedAt: toIsoDate(publishedAt)
      }, market);
    })
  );

  return items.filter((item): item is RadarNewsItem => Boolean(item));
}

function itemTitle(item: RadarNewsItem) {
  return item.translatedTitle ?? item.title;
}

function toneLabel(tone: RadarNewsDirection) {
  if (tone === "bullish") return "상방 우호";
  if (tone === "bearish") return "하방 주의";
  return "중립 확인";
}

function mostCommonAssets(items: RadarNewsItem[]) {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const asset of item.assets) {
      counts.set(asset, (counts.get(asset) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([asset]) => asset);
}

function fallbackNewsBriefing(items: RadarNewsItem[], model = "rules", market: RadarNewsMarket = "crypto"): RadarNewsBriefing {
  const bullish = items.filter((item) => item.direction === "bullish").length;
  const bearish = items.filter((item) => item.direction === "bearish").length;
  const neutral = Math.max(0, items.length - bullish - bearish);
  const urgent = items.filter((item) => item.urgency === "high").length;
  const assets = mostCommonAssets(items);
  const leadingTone: RadarNewsDirection = bullish > bearish ? "bullish" : bearish > bullish ? "bearish" : "neutral";
  const topItems = [...items]
    .sort((a, b) => {
      const urgencyDiff = (b.urgency === "high" ? 2 : b.urgency === "medium" ? 1 : 0) - (a.urgency === "high" ? 2 : a.urgency === "medium" ? 1 : 0);
      if (urgencyDiff !== 0) return urgencyDiff;
      return Math.abs(b.score - 50) - Math.abs(a.score - 50);
    })
    .slice(0, 4);

  if (market === "stocks") {
    const overview =
      items.length === 0
        ? "현재 불러온 글로벌 뉴스가 부족합니다. 주요 지수, 금리, 실적 캘린더를 먼저 확인하는 편이 좋습니다."
        : `현재 수집된 글로벌 뉴스는 상방 우호 ${bullish}개, 하방 주의 ${bearish}개, 중립 확인 ${neutral}개로 정리됩니다. ${assets.length ? `${assets.join(", ")} 관련 이슈가 많이 잡히고 있으며, ` : ""}${urgent ? `즉시 확인할 만한 이슈가 ${urgent}개 있습니다.` : "아직은 단일 방향으로 강하게 쏠린 뉴스는 제한적입니다."}`;

    return {
      generatedAt: new Date().toISOString(),
      model,
      overview,
      keyIssues: topItems.map((item) => ({
        title: itemTitle(item),
        detail: `${item.source} 기준 ${toneLabel(item.direction)} 이슈입니다. ${item.summary}`,
        tone: item.direction
      })),
      marketImpact: [
        leadingTone === "bullish"
          ? "글로벌 뉴스 흐름은 단기적으로 위험자산에 우호적입니다. 다만 이미 오른 종목은 장중 변동성을 함께 확인해야 합니다."
          : leadingTone === "bearish"
            ? "주의 뉴스가 더 많아 지수 하락과 섹터별 차별화 가능성을 먼저 봐야 합니다."
            : "뉴스 방향성이 엇갈려 지수보다 섹터, 실적, 금리 민감도를 나눠 보는 편이 좋습니다.",
        "나스닥, S&P500, 달러, 미국 10년물 금리의 동시 흐름을 함께 확인하세요.",
        "뉴스만으로 진입하기보다 차트 레이더의 추세와 변동성 상태를 같이 확인하는 편이 안전합니다."
      ],
      strategyNotes: [
        "장 시작 전후에는 스프레드와 급변동이 커질 수 있으니 추격보다 관찰이 우선입니다.",
        "실적·가이던스 이슈가 있는 종목은 기술적 지표보다 이벤트 리스크가 더 크게 작동할 수 있습니다.",
        "ETF와 개별주는 같은 방향이라도 변동성이 다르므로 손절폭과 수량을 분리해서 계산하세요."
      ],
      finalSummary:
        leadingTone === "bullish"
          ? "정리하면, 뉴스 흐름은 다소 긍정적이지만 추격보다 지수와 섹터 확인이 먼저입니다."
          : leadingTone === "bearish"
            ? "정리하면, 방어적인 관찰이 필요한 구간입니다. 지수 지지선과 금리 반응을 먼저 보세요."
            : "정리하면, 뉴스만으로 방향을 확정하기보다 차트와 매크로 확인이 필요한 구간입니다."
    };
  }

  const overview =
    items.length === 0
      ? "현재 불러온 뉴스가 부족합니다. 차트 흐름과 주요 거래소 공지를 먼저 확인하는 편이 좋습니다."
      : `현재 수집된 코인 뉴스는 상방 우호 ${bullish}개, 하방 주의 ${bearish}개, 중립 확인 ${neutral}개로 정리됩니다. ${assets.length ? `${assets.join(", ")} 관련 이슈가 가장 많이 잡히고 있으며, ` : ""}${urgent ? `즉시 확인할 만한 이슈가 ${urgent}개 있습니다.` : "아직은 단일 방향으로 강하게 쏠린 뉴스는 제한적입니다."}`;

  return {
    generatedAt: new Date().toISOString(),
    model,
    overview,
    keyIssues: topItems.map((item) => ({
      title: itemTitle(item),
      detail: `${item.source} 기준 ${toneLabel(item.direction)} 이슈입니다. ${item.summary}`,
      tone: item.direction
    })),
    marketImpact: [
      leadingTone === "bullish"
        ? "긍정 뉴스가 더 많아 단기 심리는 우호적으로 해석될 수 있습니다. 다만 이미 오른 자리라면 추격보다 눌림과 지지 확인이 중요합니다."
        : leadingTone === "bearish"
          ? "주의 뉴스가 더 많아 변동성 확대와 지지 이탈 가능성을 먼저 봐야 합니다. 반등이 나와도 거래량과 되돌림 강도를 같이 확인해야 합니다."
          : "뉴스 방향성이 엇갈려 차트 구조 확인이 더 중요합니다. 가격이 박스 상단과 하단 중 어디를 먼저 돌파하는지 확인하는 편이 안전합니다.",
      "뉴스만으로 진입 방향을 확정하기보다 BTC와 ETH의 반응, 도미넌스 변화, 거래량 증가 여부를 함께 확인하는 것이 좋습니다.",
      "알트코인은 같은 뉴스에도 과하게 반응할 수 있으므로 손절 기준과 포지션 크기를 먼저 줄여서 보는 것이 좋습니다."
    ],
    strategyNotes: [
      "강한 호재가 나와도 이미 장대 양봉 이후라면 추격 진입보다 되돌림 지지 확인을 우선하세요.",
      "악재성 뉴스가 많을 때는 숏만 보겠다는 뜻이 아니라, 롱 진입 조건을 더 엄격하게 보겠다는 의미로 쓰는 편이 좋습니다.",
      "뉴스 브리핑은 매수·매도 신호가 아니라 오늘 차트에서 무엇을 더 조심해서 볼지 정하는 체크리스트로 활용하세요."
    ],
    finalSummary:
      leadingTone === "bullish"
        ? "정리하면, 뉴스 심리는 다소 긍정적이지만 추격 매수보다 구조 확인이 먼저입니다."
        : leadingTone === "bearish"
          ? "정리하면, 방어적인 관찰이 필요한 흐름입니다. 지지 이탈과 청산성 변동성을 우선 체크하세요."
          : "정리하면, 뉴스만으로 방향을 단정하기 어렵습니다. 차트 레이더의 구조 판독과 함께 확인하는 구간입니다."
  };
}

function buildNewsBriefingPrompt(items: RadarNewsItem[], market: RadarNewsMarket) {
  const marketLabel = market === "stocks" ? "글로벌 시장" : "코인";
  const headlines = items
    .slice(0, 10)
    .map((item, index) => {
      return `${index + 1}. [${item.source}] ${itemTitle(item)}
원문: ${item.title}
방향: ${toneLabel(item.direction)}
점수: ${item.score}
태그: ${item.tags.join(", ")}
요약: ${item.summary}`;
    })
    .join("\n\n");

  return `아래 ${marketLabel} 관련 뉴스 제목과 1차 분류를 바탕으로 한국어 시장 브리핑을 작성해 주세요.

출력은 반드시 JSON 하나만 반환하세요. 마크다운 문법은 쓰지 마세요.
스키마는 다음과 같습니다.
{
  "overview": "오늘 시장을 한 문단으로 요약",
  "keyIssues": [
    { "title": "주요 이슈 제목", "detail": "왜 중요한지와 확인할 점", "tone": "bullish|bearish|neutral" }
  ],
  "marketImpact": ["시장에 미칠 수 있는 영향 3개"],
  "strategyNotes": ["투자 판단 시 참고할 점 3개"],
  "finalSummary": "마지막 한 줄 정리"
}

규칙.
- 모든 문장은 한국어로 작성하세요.
- 직접적인 매수·매도 신호, 수익 보장, 특정 진입 지시는 금지입니다.
- 대신 오늘 시장에서 조심할 점, 확인할 조건, 리스크 관리 관점으로 정리하세요.
- keyIssues는 3개에서 5개 사이로 작성하세요.
- marketImpact와 strategyNotes는 각각 3개로 작성하세요.

뉴스 재료.
${headlines || "수집된 뉴스가 부족합니다."}`;
}

function asBriefingIssue(value: unknown): RadarNewsBriefing["keyIssues"][number] | null {
  if (!value || typeof value !== "object") return null;
  const item = value as { title?: unknown; detail?: unknown; tone?: unknown };
  const tone = item.tone === "bullish" || item.tone === "bearish" || item.tone === "neutral" ? item.tone : "neutral";
  if (typeof item.title !== "string" || typeof item.detail !== "string") return null;
  return {
    title: item.title.slice(0, 120),
    detail: item.detail.slice(0, 360),
    tone
  };
}

function asStringList(value: unknown, limit: number) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").slice(0, limit).map((item) => item.slice(0, 260));
}

function parseAIJsonBriefing(raw: string, items: RadarNewsItem[], model: string, market: RadarNewsMarket): RadarNewsBriefing {
  const fallback = fallbackNewsBriefing(items, model, market);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return { ...fallback, overview: raw.slice(0, 500) || fallback.overview };

  try {
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    const keyIssues = Array.isArray(parsed.keyIssues)
      ? parsed.keyIssues.map(asBriefingIssue).filter((item): item is RadarNewsBriefing["keyIssues"][number] => Boolean(item)).slice(0, 5)
      : [];

    return {
      generatedAt: new Date().toISOString(),
      model,
      overview: typeof parsed.overview === "string" ? parsed.overview.slice(0, 700) : fallback.overview,
      keyIssues: keyIssues.length ? keyIssues : fallback.keyIssues,
      marketImpact: asStringList(parsed.marketImpact, 3).length ? asStringList(parsed.marketImpact, 3) : fallback.marketImpact,
      strategyNotes: asStringList(parsed.strategyNotes, 3).length ? asStringList(parsed.strategyNotes, 3) : fallback.strategyNotes,
      finalSummary: typeof parsed.finalSummary === "string" ? parsed.finalSummary.slice(0, 360) : fallback.finalSummary
    };
  } catch {
    return fallback;
  }
}

async function generateNewsBriefing(items: RadarNewsItem[], market: RadarNewsMarket) {
  const groqBriefing = await generateGroqNewsBriefing(items, market);
  if (groqBriefing) return groqBriefing;

  const geminiBriefing = await generateGeminiNewsBriefing(items, market);
  if (geminiBriefing) return geminiBriefing;

  return fallbackNewsBriefing(items, "rules", market);
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
        messages: [
          {
            role: "user",
            content: buildNewsBriefingPrompt(items, market)
          }
        ],
        temperature: 0.2,
        max_tokens: 1800
      })
    });

    if (!response.ok) {
      console.warn(`Groq news briefing failed: ${response.status} ${response.statusText}`);
      return null;
    }
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
        contents: [
          {
            role: "user",
            parts: [{ text: buildNewsBriefingPrompt(items, market) }]
          }
        ],
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

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "radar-news",
    limit: 60,
    windowMs: 60_000
  });

  if (!limited.allowed) {
    return NextResponse.json(
      { error: "뉴스 레이더 요청이 잠시 많습니다.", retryAfter: limited.retryAfter },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(request.url);
  const market: RadarNewsMarket = searchParams.get("market") === "stocks" ? "stocks" : "crypto";
  const feeds = market === "stocks" ? STOCK_FEEDS : CRYPTO_FEEDS;
  const now = Date.now();
  if (cache[market] && now - cache[market]!.updatedAt < CACHE_MS) {
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
  const briefing = await generateNewsBriefing(items, market);

  cache[market] = {
    updatedAt: now,
    items,
    briefing,
    failedSources
  };

  return NextResponse.json({ ...cache[market], market, cached: false });
}
