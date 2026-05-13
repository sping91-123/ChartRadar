// 공개 RSS 뉴스를 수집하고 차트 레이더용 시장 브리핑으로 정리하는 API입니다.
import { NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import {
  createRadarNewsItem,
  displayNewsSource,
  localizeNewsSourceText,
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
const USE_EXTERNAL_NEWS_TRANSLATION = process.env.NEWS_TRANSLATION_PROVIDER === "mymemory";
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
    .replace(/&gt;/g, " ");
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

function knownCryptoTitle(title: string) {
  const normalized = title.toLowerCase();

  if (normalized.includes("cftc") && normalized.includes("sports league") && normalized.includes("prediction market")) {
    return "미 CFTC, 예측시장 감독을 위해 주요 스포츠 리그와 논의";
  }
  if (normalized.includes("senate confirms") && normalized.includes("fed board")) {
    return "미 상원, 차기 의장 표결 앞두고 Kevin Warsh 연준 이사 인준";
  }
  if (normalized.includes("ethereum foundation") && normalized.includes("clear signing")) {
    return "이더리움 재단, 악성 거래 승인 방지를 위한 Clear Signing 표준 공개";
  }
  if (normalized.includes("stablecoin yield infrastructure")) {
    return "스테이블코인 수익 인프라 프로젝트, Sky Ecosystem 주도 투자 유치";
  }
  if (normalized.includes("bull-bear cycle indicator") && normalized.includes("turns green")) {
    return "비트코인 불·베어 사이클 지표, 2023년 3월 이후 처음으로 녹색 전환";
  }
  if (normalized.includes("live markets") && normalized.includes("bitcoin") && normalized.includes("inflation")) {
    return "비트코인, 8만 달러 일시 하회. 강한 물가 지표 여파로 주식 약세와 금리 상승";
  }
  if (normalized.includes("bitcoin briefly drops below") && normalized.includes("inflation")) {
    return "비트코인, 8만 달러 일시 하회. 강한 물가 지표 여파로 주식 약세와 금리 상승";
  }
  if (normalized.includes("bitcoin digests") && normalized.includes("cpi")) {
    return "비트코인, 예상보다 강한 미국 CPI 이후 변동성 확대";
  }
  if (normalized.includes("privacy emerges") && normalized.includes("killer app")) {
    return "프라이버시, 암호화폐의 다음 핵심 사용처로 부각";
  }
  if (normalized.includes("binance") && normalized.includes("chief marketing officer")) {
    return "바이낸스 최고마케팅책임자 Rachel Conlan, 거래소 떠날 예정";
  }
  if (normalized.includes("here") && normalized.includes("what happened in crypto today")) {
    return "오늘 코인 시장에서 확인할 주요 이슈 정리";
  }
  if (normalized.includes("lmax group") && normalized.includes("collateral solution")) {
    return "LMAX Group, 기관용 디지털자산 담보 솔루션 출시";
  }
  if (normalized.includes("exodus sells") && normalized.includes("bitcoin")) {
    return "Exodus, 1분기 손실 확대 속 1,000개 이상 비트코인 매도";
  }
  if (normalized.includes("kraken parent") && normalized.includes("occ charter")) {
    return "크라켄 모회사, 은행 라이선스 관련 이슈 부각";
  }
  if (normalized.includes("coinbase") && normalized.includes("stablecoin")) {
    return "코인베이스와 스테이블코인 이슈가 시장 관심을 받는 중";
  }
  if (normalized.includes("kelp dao exploit")) {
    return "Kelp DAO 보안 이슈, DeFi 리스크 점검 필요";
  }
  if (normalized.includes("mstr") || normalized.includes("strategy")) {
    return "Strategy 관련 뉴스, 비트코인 보유 기업 흐름 점검";
  }

  return null;
}

function knownStockTitle(title: string) {
  const normalized = title.toLowerCase();

  if (normalized.includes("ai power") && normalized.includes("new oil")) {
    return "AI 전력 수요가 새로운 원자재처럼 주목받고 있습니다";
  }
  if (normalized.includes("inflation") && normalized.includes("salary")) {
    return "물가 상승이 임금 상승보다 빨라 소비 부담이 커지고 있습니다";
  }
  if (normalized.includes("semiconductor") || normalized.includes("chip")) {
    return "반도체 대형주의 증시 영향력이 다시 커지고 있습니다";
  }
  if (normalized.includes("airfare") || normalized.includes("airlines")) {
    return "항공권과 여행 수요 흐름이 소비 지표의 변수로 떠올랐습니다";
  }
  if (normalized.includes("s&p") || normalized.includes("sp500")) {
    return "S&P500 주요 종목 흐름이 미국장 방향성을 좌우하고 있습니다";
  }
  if (normalized.includes("yield") || normalized.includes("treasury")) {
    return "미국 국채금리 흐름이 위험자산 심리에 영향을 주고 있습니다";
  }
  if (normalized.includes("fed") || normalized.includes("rate")) {
    return "연준과 금리 기대 변화가 글로벌 시장의 핵심 변수입니다";
  }
  if (normalized.includes("earnings") || normalized.includes("profit")) {
    return "기업 실적과 마진 흐름이 종목별 차별화를 만들고 있습니다";
  }

  return null;
}

function knownTitle(title: string, market: RadarNewsMarket) {
  return market === "stocks" ? knownStockTitle(title) : knownCryptoTitle(title);
}

function localTranslateTitle(title: string) {
  return title
    .replace(/\bEthereum Foundation\b/gi, "이더리움 재단")
    .replace(/\bBitcoin\b/gi, "비트코인")
    .replace(/\bEthereum\b/gi, "이더리움")
    .replace(/\bSolana\b/gi, "솔라나")
    .replace(/\bNasdaq\b/gi, "나스닥")
    .replace(/\bS&P\b/gi, "S&P")
    .replace(/\bFed\b/gi, "연준")
    .replace(/\binflows?\b/gi, "자금 유입")
    .replace(/\boutflows?\b/gi, "자금 유출")
    .replace(/\bcrypto\b/gi, "암호화폐")
    .replace(/\bdigital assets?\b/gi, "디지털자산")
    .replace(/\bstablecoins?\b/gi, "스테이블코인")
    .replace(/\betf\b/gi, "ETF")
    .replace(/\bstocks?\b/gi, "주식")
    .replace(/\bmarkets?\b/gi, "시장")
    .replace(/\binflation\b/gi, "물가")
    .replace(/\btreasury\b/gi, "미국 국채")
    .replace(/\byields?\b/gi, "금리")
    .replace(/\bearnings?\b/gi, "실적")
    .replace(/\bprofit\b/gi, "이익")
    .replace(/\brally\b/gi, "상승")
    .replace(/\bsurge\b/gi, "급등")
    .replace(/\bplunge\b/gi, "급락")
    .replace(/\bhack\b/gi, "해킹")
    .replace(/\bapproval\b/gi, "승인")
    .replace(/\blawsuit\b/gi, "소송")
    .trim();
}

function polishKoreanTitle(title: string) {
  return title
    .replace(/\s+%/g, "%")
    .replace(/\$\s+/g, "$")
    .replace(/\$\s?10억\s?달러/g, "10억 달러")
    .replace(/불베어/g, "불·베어")
    .replace(/인플레이션 인쇄물/g, "물가 지표")
    .replace(/추악한 물가 지표/g, "강한 물가 지표")
    .replace(/미국 CPI를 소화합니다/g, "미국 CPI 이후 변동성을 소화하고 있습니다")
    .replace(/\s+/g, " ")
    .trim();
}

function fallbackKoreanTitle(title: string, market: RadarNewsMarket) {
  const normalized = title.toLowerCase();
  const local = polishKoreanTitle(localTranslateTitle(title));
  if (isReadableKoreanTitle(local) && local.toLowerCase() !== title.toLowerCase()) {
    return local;
  }

  if (market === "crypto") {
    if (normalized.includes("kddi") || normalized.includes("coincheck") || normalized.includes("stake") || normalized.includes("acquire")) {
      return "일본 대기업의 Coincheck 지분 인수 이슈가 코인 시장 관심을 끌고 있습니다";
    }
    if (normalized.includes("clarity") || /\bbill\b/.test(normalized) || normalized.includes("regulation")) {
      return "미국 암호화폐 법안 수정 논의가 규제 방향의 새 변수로 떠올랐습니다";
    }
    if (normalized.includes("tokenized") || normalized.includes("tokenization")) {
      return "토큰화 자산 흐름이 기관 시장의 관심을 받고 있습니다";
    }
    if (normalized.includes("mica") || normalized.includes("license") || normalized.includes("latvia") || normalized.includes("eu")) {
      return "유럽 암호화폐 라이선스 확보 경쟁이 거래소 확장 이슈로 이어지고 있습니다";
    }
    if (normalized.includes("wallet") || normalized.includes("ledger")) {
      return "암호화폐 지갑과 보안 관련 이슈가 부각되고 있습니다";
    }
    if (normalized.includes("ipo")) {
      return "암호화폐 기업의 상장 계획과 시장 여건을 점검해야 합니다";
    }
    if (normalized.includes("openai") || normalized.includes("anthropic") || normalized.includes("ai")) {
      return "AI 관련 토큰과 비상장 지분 이슈가 변동성을 키우고 있습니다";
    }
    if (normalized.includes("exchange") || normalized.includes("coinbase") || normalized.includes("binance")) {
      return "주요 거래소 관련 뉴스가 코인 시장 심리에 영향을 주고 있습니다";
    }
    return "코인 시장 주요 이슈가 가격 반응에 어떤 영향을 주는지 확인해야 합니다";
  }

  if (normalized.includes("anduril") || normalized.includes("defense")) {
    return "방산 기술 기업 가치 상승이 AI·국방 투자 열기를 보여주고 있습니다";
  }
  if (normalized.includes("retirement") || normalized.includes("savings")) {
    return "은퇴자금과 체감 물가 부담이 개인 투자 심리에 영향을 주고 있습니다";
  }
  if (normalized.includes("valuation") || normalized.includes("funding")) {
    return "비상장 기업 가치와 자금 조달 흐름이 시장의 위험 선호를 보여주고 있습니다";
  }
  if (normalized.includes("ai")) {
    return "AI 관련 수요와 인프라 이슈가 글로벌 시장의 핵심 변수입니다";
  }
  if (normalized.includes("inflation") || normalized.includes("price")) {
    return "물가와 소비 부담 이슈가 미국장 심리에 영향을 줄 수 있습니다";
  }
  if (normalized.includes("fed") || normalized.includes("rate")) {
    return "연준과 금리 기대 변화가 지수 흐름의 핵심 변수입니다";
  }
  if (normalized.includes("semiconductor") || normalized.includes("chip")) {
    return "반도체 섹터 흐름이 글로벌 증시 방향성에 영향을 주고 있습니다";
  }
  if (normalized.includes("earnings") || normalized.includes("sales") || normalized.includes("profit")) {
    return "기업 실적과 매출 흐름이 종목별 차별화를 만들고 있습니다";
  }
  return "글로벌 시장 주요 이슈가 지수와 섹터 흐름에 미칠 영향을 확인해야 합니다";
}

function isReadableKoreanTitle(value: string) {
  if (!hasKorean(value)) return false;
  const hangulCount = value.match(/[가-힣]/g)?.length ?? 0;
  const latinWords = value.match(/\b[A-Za-z]{4,}\b/g)?.filter((word) => !["USDT", "ETF", "NAV", "MiCA"].includes(word)) ?? [];
  return hangulCount >= 10 && latinWords.length <= 3;
}

function coerceKoreanTitle(title: string, translated: string, market: RadarNewsMarket) {
  const polished = polishKoreanTitle(translated);
  if (isReadableKoreanTitle(polished) && polished.toLowerCase() !== title.toLowerCase()) return polished;
  return fallbackKoreanTitle(title, market);
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
  if (!apiKey || uniqueTitles.length === 0) return result;

  const pending = uniqueTitles.filter((title) => {
    const cacheKey = `${market}:${title}`;
    const cached = translationCache.get(cacheKey);
    if (cached) {
      result.set(title, cached);
      return false;
    }
    const known = knownTitle(title, market);
    if (known) {
      const translated = coerceKoreanTitle(title, known, market);
      translationCache.set(cacheKey, translated);
      result.set(title, translated);
      return false;
    }
    return !hasKorean(title);
  });
  if (pending.length === 0) return result;

  const model = process.env.GROQ_MODEL || GROQ_DEFAULT_MODEL;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6_000);
  try {
    const marketLabel = market === "stocks" ? "글로벌 주식/ETF/매크로" : "코인";
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
            content: `아래 영어 ${marketLabel} 뉴스 제목을 한국 투자자가 바로 이해할 수 있는 한국어 제목으로 의역해 주세요.
규칙:
- 반드시 JSON 문자열 배열만 반환합니다.
- 입력 순서와 개수를 그대로 맞춥니다.
- 영어 제목을 그대로 남기지 말고, 자연스러운 한국어 이슈 제목으로 바꿉니다.
- 과장된 매수·매도 표현은 피하고, 시장 영향이 느껴지게 씁니다.

제목:
${pending.map((title, index) => `${index + 1}. ${title}`).join("\n")}`
          }
        ],
        temperature: 0.1,
        max_tokens: 1200
      })
    });

    if (!response.ok) return result;
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const translated = parseStringArray(payload.choices?.[0]?.message?.content ?? "");
    pending.forEach((title, index) => {
      const next = coerceKoreanTitle(title, translated[index] ?? "", market);
      translationCache.set(`${market}:${title}`, next);
      result.set(title, next);
    });
  } catch {
    // Groq가 지연되면 규칙 기반 한국어 제목으로 즉시 대체합니다.
  } finally {
    clearTimeout(timer);
  }

  return result;
}

async function translateTitleToKorean(title: string, market: RadarNewsMarket) {
  if (hasKorean(title)) return title;
  const known = knownTitle(title, market);
  if (known) return known;

  const cacheKey = `${market}:${title}`;
  const cached = translationCache.get(cacheKey);
  if (cached) return cached;

  if (!USE_EXTERNAL_NEWS_TRANSLATION) {
    const fallback = fallbackKoreanTitle(title, market);
    translationCache.set(cacheKey, fallback);
    return fallback;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 900);
    let response: Response;
    try {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(title)}&langpair=en|ko`;
      response = await fetch(url, { signal: controller.signal, next: { revalidate: 3600 } });
    } finally {
      clearTimeout(timer);
    }

    if (response.ok) {
      const payload = (await response.json()) as { responseData?: { translatedText?: string } };
      const translated = coerceKoreanTitle(title, payload.responseData?.translatedText?.replace(/\s+/g, " ").trim() ?? "", market);
      if (translated && translated.toLowerCase() !== title.toLowerCase()) {
        translationCache.set(cacheKey, translated);
        return translated;
      }
    }
  } catch {
    // 무료 번역 API가 실패하면 로컬 단어 치환으로 대체합니다.
  }

  const fallback = fallbackKoreanTitle(title, market);
  translationCache.set(cacheKey, fallback);
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
  const rssItems = asArray<unknown>(parsed?.rss?.channel?.item);
  const atomItems = asArray<unknown>(parsed?.feed?.entry);
  const entries = rssItems.length ? rssItems : atomItems;

  const pickedEntries = entries.slice(0, 6);
  const records = pickedEntries
    .map((entry) => {
      const record = entry as Record<string, unknown>;
      const title = pickText(record.title);
      const link = normalizeLink(record.link) || pickText(record.guid);
      const publishedAt =
        pickText(record.pubDate) ||
        pickText(record.published) ||
        pickText(record.updated) ||
        new Date().toISOString();

      if (!title || !link) return null;
      return { title, link, publishedAt };
    })
    .filter((record): record is { title: string; link: string; publishedAt: string } => Boolean(record));

  const groqTranslations = await translateTitlesWithGroq(
    records.map((record) => record.title),
    market
  );

  const items = await Promise.all(
    records.map(async (record) => {
      const translatedTitle = groqTranslations.get(record.title) ?? (await translateTitleToKorean(record.title, market));

      return createRadarNewsItem(
        {
          source: feed.source,
          title: record.title,
          translatedTitle,
          link: record.link,
          publishedAt: toIsoDate(record.publishedAt)
        },
        market
      );
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
  const watchLabel = assets.length ? assets.join(", ") : market === "stocks" ? "지수와 주요 종목" : "BTC와 주요 코인";
  const topItems = [...items]
    .sort((a, b) => {
      const urgencyDiff = urgencyWeight(b) - urgencyWeight(a);
      if (urgencyDiff !== 0) return urgencyDiff;
      return Math.abs(b.score - 50) - Math.abs(a.score - 50);
    })
    .slice(0, 4);

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
        ? `${marketLabel} 심리는 우호적으로 기울어 있습니다. 다만 이미 가격이 먼저 움직였다면 눌림과 거래량 확인이 우선입니다.`
        : leadingTone === "bearish"
          ? `${marketLabel}에는 방어적으로 볼 뉴스가 더 많습니다. 지지 이탈과 변동성 확대를 먼저 확인해 주세요.`
          : `${marketLabel} 뉴스만으로는 방향을 단정하기 어렵습니다. 가격 반응과 후속 뉴스가 같은 방향으로 이어지는지 확인해야 합니다.`,
      market === "stocks"
        ? "SPY, QQQ, 미국 10년물 금리, 달러 흐름을 같이 보면 뉴스의 실제 영향이 더 선명해집니다."
        : "BTC, ETH, 도미넌스, 거래량 반응을 같이 보면 뉴스의 실제 영향이 더 선명해집니다.",
      "뉴스는 방향의 이유가 될 수 있지만, 진입 자체는 차트 구조와 리스크 관리가 맞을 때만 검토하는 편이 안전합니다."
    ],
    strategyNotes: [
      "큰 뉴스 직후에는 스프레드와 급변동이 커질 수 있으니 추격보다 확인을 먼저 두세요.",
      "상방 뉴스와 하방 뉴스가 섞인 날은 포지션 크기를 줄이고, 기준선 이탈 여부를 더 엄격히 보는 편이 좋습니다.",
      "브리핑은 매수·매도 지시가 아니라 오늘 무엇을 먼저 봐야 하는지 정리하는 용도입니다."
    ],
    finalSummary:
      leadingTone === "bullish"
        ? "정리하면, 뉴스 흐름은 우호적이지만 진입은 가격이 다시 구조를 확인해 줄 때가 더 안전합니다."
        : leadingTone === "bearish"
          ? "정리하면, 방어적으로 볼 필요가 있는 구간입니다. 반등보다 지지와 거래량 회복을 먼저 확인하세요."
          : "정리하면, 뉴스 방향은 아직 중립입니다. 오늘은 가격 반응과 추가 헤드라인을 같이 보세요."
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

출력은 반드시 JSON 하나만 반환해 주세요. 마크다운 문법은 쓰지 마세요.
스키마는 다음과 같습니다.
{
  "overview": "오늘 시장을 한 문단으로 요약",
  "keyIssues": [
    { "title": "주요 이슈 제목", "detail": "왜 중요한지와 확인할 점", "tone": "bullish|bearish|neutral" }
  ],
  "marketImpact": ["시장에 미칠 수 있는 영향 3개"],
  "strategyNotes": ["투자 판단 전 참고할 점 3개"],
  "finalSummary": "마지막 한 줄 정리"
}

규칙.
- 모든 문장은 한국어로 작성해 주세요.
- 원문 제목이 영어여도 사용자에게 보이는 결과에는 영어 제목을 그대로 복사하지 말고 한국어로 의역해 주세요.
- 직접적인 매수·매도 신호, 수익 보장, 특정 진입 지시는 금지입니다.
- 대신 오늘 시장에서 조심해야 할 조건, 확인할 조건, 리스크 관리 관점으로 정리해 주세요.
- keyIssues는 3개에서 5개 사이로 작성해 주세요.
- marketImpact와 strategyNotes는 각각 3개로 작성해 주세요.

뉴스 자료.
${headlines || "수집된 뉴스가 부족합니다."}`;
}

function asBriefingIssue(value: unknown): RadarNewsBriefing["keyIssues"][number] | null {
  if (!value || typeof value !== "object") return null;
  const item = value as { title?: unknown; detail?: unknown; tone?: unknown };
  const tone = item.tone === "bullish" || item.tone === "bearish" || item.tone === "neutral" ? item.tone : "neutral";
  if (typeof item.title !== "string" || typeof item.detail !== "string") return null;
  return {
    title: localizeNewsSourceText(item.title).slice(0, 120),
    detail: localizeNewsSourceText(item.detail).slice(0, 360),
    tone
  };
}

function asStringList(value: unknown, limit: number) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .slice(0, limit)
    .map((item) => localizeNewsSourceText(item).slice(0, 260));
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
    const marketImpact = asStringList(parsed.marketImpact, 3);
    const strategyNotes = asStringList(parsed.strategyNotes, 3);

    return {
      generatedAt: new Date().toISOString(),
      model,
      overview: typeof parsed.overview === "string" ? localizeNewsSourceText(parsed.overview).slice(0, 700) : fallback.overview,
      keyIssues: keyIssues.length ? keyIssues : fallback.keyIssues,
      marketImpact: marketImpact.length ? marketImpact : fallback.marketImpact,
      strategyNotes: strategyNotes.length ? strategyNotes : fallback.strategyNotes,
      finalSummary: typeof parsed.finalSummary === "string" ? localizeNewsSourceText(parsed.finalSummary).slice(0, 360) : fallback.finalSummary
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

async function generateNewsBriefing(items: RadarNewsItem[], market: RadarNewsMarket) {
  const groqBriefing = await generateGroqNewsBriefing(items, market);
  if (groqBriefing) return groqBriefing;

  if (!USE_GEMINI_NEWS_FALLBACK) {
    return fallbackNewsBriefing(items, "rules", market);
  }

  const geminiBriefing = await generateGeminiNewsBriefing(items, market);
  if (geminiBriefing) return geminiBriefing;

  return fallbackNewsBriefing(items, "rules", market);
}

export async function GET(request: Request) {
  const limited = await rateLimit(request, {
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
  const rawMarket = searchParams.get("market") ?? "crypto";
  if (rawMarket !== "crypto" && rawMarket !== "stocks") {
    return NextResponse.json({ error: "지원하지 않는 뉴스 시장입니다." }, { status: 400 });
  }
  const market: RadarNewsMarket = rawMarket;
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
