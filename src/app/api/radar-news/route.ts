// 怨듦컻 RSS ?댁뒪 ?쒕ぉ???섏쭛???덉씠?붾돱??移대뱶 ?곗씠?곕줈 蹂?섑븯??API.
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
  return /[가-힣]/.test(value);
}

function knownCryptoTitle(title: string) {
  const normalized = title.toLowerCase();

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

function localTranslateTitle(title: string) {
  return title
    .replace(/\bBitcoin\b/gi, "비트코인")
    .replace(/\bEthereum\b/gi, "이더리움")
    .replace(/\bSolana\b/gi, "솔라나")
    .replace(/\bFed\b/gi, "연준")
    .replace(/\binflows?\b/gi, "자금 유입")
    .replace(/\boutflows?\b/gi, "자금 유출")
    .replace(/\brally\b/gi, "상승")
    .replace(/\bsurge\b/gi, "급등")
    .replace(/\bplunge\b/gi, "급락")
    .replace(/\bhack\b/gi, "해킹")
    .replace(/\bapproval\b/gi, "승인")
    .replace(/\blawsuit\b/gi, "소송")
    .trim();
}

function polishKoreanTitle(title: string) {
  return title.replace(/\s+%/g, "%").replace(/\s+/g, " ").trim();
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
    // 臾대즺 踰덉뿭 API媛 吏?곕릺硫??꾨옒??濡쒖뺄 ?⑹뼱 移섑솚?쇰줈 ?泥댄븳??
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
  if (tone === "bullish") return "?곷갑 ?고샇";
  if (tone === "bearish") return "?섎갑 二쇱쓽";
  return "以묐┰ ?뺤씤";
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
        ? "?꾩옱 遺덈윭??湲濡쒕쾶 ?댁뒪媛 遺議깊빀?덈떎. 二쇱슂 吏?? 湲덈━, ?ㅼ쟻 罹섎┛?붾? 癒쇱? ?뺤씤?섎뒗 ?몄씠 醫뗭뒿?덈떎."
        : `?꾩옱 ?섏쭛??湲濡쒕쾶 ?댁뒪???곷갑 ?고샇 ${bullish}媛? ?섎갑 二쇱쓽 ${bearish}媛? 以묐┰ ?뺤씤 ${neutral}媛쒕줈 ?뺣━?⑸땲?? ${assets.length ? `${assets.join(", ")} 愿???댁뒋媛 留롮씠 ?≫엳怨??덉쑝硫? ` : ""}${urgent ? `利됱떆 ?뺤씤??留뚰븳 ?댁뒋媛 ${urgent}媛??덉뒿?덈떎.` : "?꾩쭅? ?⑥씪 諛⑺뼢?쇰줈 媛뺥븯寃??좊┛ ?댁뒪???쒗븳?곸엯?덈떎."}`;

    return {
      generatedAt: new Date().toISOString(),
      model,
      overview,
      keyIssues: topItems.map((item) => ({
        title: itemTitle(item),
        detail: `${item.source} 湲곗? ${toneLabel(item.direction)} ?댁뒋?낅땲?? ${item.summary}`,
        tone: item.direction
      })),
      marketImpact: [
        leadingTone === "bullish"
          ? "湲濡쒕쾶 ?댁뒪 ?먮쫫? ?④린?곸쑝濡??꾪뿕?먯궛???고샇?곸엯?덈떎. ?ㅻ쭔 ?대? ?ㅻⅨ 醫낅ぉ? ?μ쨷 蹂?숈꽦???④퍡 ?뺤씤?댁빞 ?⑸땲??"
          : leadingTone === "bearish"
            ? "二쇱쓽 ?댁뒪媛 ??留롮븘 吏???섎씫怨??뱁꽣蹂?李⑤퀎??媛?μ꽦??癒쇱? 遊먯빞 ?⑸땲??"
            : "?댁뒪 諛⑺뼢?깆씠 ?뉕컝??吏?섎낫???뱁꽣, ?ㅼ쟻, 湲덈━ 誘쇨컧?꾨? ?섎닠 蹂대뒗 ?몄씠 醫뗭뒿?덈떎.",
        "?섏뒪?? S&P500, ?щ윭, 誘멸뎅 10?꾨Ъ 湲덈━???숈떆 ?먮쫫???④퍡 ?뺤씤?섏꽭??",
        "?댁뒪留뚯쑝濡?吏꾩엯?섍린蹂대떎 李⑦듃 ?덉씠?붿쓽 異붿꽭? 蹂?숈꽦 ?곹깭瑜?媛숈씠 ?뺤씤?섎뒗 ?몄씠 ?덉쟾?⑸땲??"
      ],
      strategyNotes: [
        "???쒖옉 ?꾪썑?먮뒗 ?ㅽ봽?덈뱶? 湲됰??숈씠 而ㅼ쭏 ???덉쑝??異붽꺽蹂대떎 愿李곗씠 ?곗꽑?낅땲??",
        "?ㅼ쟻쨌媛?대뜕???댁뒋媛 ?덈뒗 醫낅ぉ? 湲곗닠??吏?쒕낫???대깽??由ъ뒪?ш? ???ш쾶 ?묐룞?????덉뒿?덈떎.",
        "ETF? 媛쒕퀎二쇰뒗 媛숈? 諛⑺뼢?대씪??蹂?숈꽦???ㅻⅤ誘濡??먯젅??낵 ?섎웾??遺꾨━?댁꽌 怨꾩궛?섏꽭??"
      ],
      finalSummary:
        leadingTone === "bullish"
          ? "?뺣━?섎㈃, ?댁뒪 ?먮쫫? ?ㅼ냼 湲띿젙?곸씠吏留?異붽꺽蹂대떎 吏?섏? ?뱁꽣 ?뺤씤??癒쇱??낅땲??"
          : leadingTone === "bearish"
            ? "?뺣━?섎㈃, 諛⑹뼱?곸씤 愿李곗씠 ?꾩슂??援ш컙?낅땲?? 吏??吏吏?좉낵 湲덈━ 諛섏쓳??癒쇱? 蹂댁꽭??"
            : "?뺣━?섎㈃, ?댁뒪留뚯쑝濡?諛⑺뼢???뺤젙?섍린蹂대떎 李⑦듃? 留ㅽ겕濡??뺤씤???꾩슂??援ш컙?낅땲??"
    };
  }

  const overview =
    items.length === 0
      ? "?꾩옱 遺덈윭???댁뒪媛 遺議깊빀?덈떎. 李⑦듃 ?먮쫫怨?二쇱슂 嫄곕옒??怨듭?瑜?癒쇱? ?뺤씤?섎뒗 ?몄씠 醫뗭뒿?덈떎."
      : `?꾩옱 ?섏쭛??肄붿씤 ?댁뒪???곷갑 ?고샇 ${bullish}媛? ?섎갑 二쇱쓽 ${bearish}媛? 以묐┰ ?뺤씤 ${neutral}媛쒕줈 ?뺣━?⑸땲?? ${assets.length ? `${assets.join(", ")} 愿???댁뒋媛 媛??留롮씠 ?≫엳怨??덉쑝硫? ` : ""}${urgent ? `利됱떆 ?뺤씤??留뚰븳 ?댁뒋媛 ${urgent}媛??덉뒿?덈떎.` : "?꾩쭅? ?⑥씪 諛⑺뼢?쇰줈 媛뺥븯寃??좊┛ ?댁뒪???쒗븳?곸엯?덈떎."}`;

  return {
    generatedAt: new Date().toISOString(),
    model,
    overview,
    keyIssues: topItems.map((item) => ({
      title: itemTitle(item),
      detail: `${item.source} 湲곗? ${toneLabel(item.direction)} ?댁뒋?낅땲?? ${item.summary}`,
      tone: item.direction
    })),
    marketImpact: [
      leadingTone === "bullish"
        ? "湲띿젙 ?댁뒪媛 ??留롮븘 ?④린 ?щ━???고샇?곸쑝濡??댁꽍?????덉뒿?덈떎. ?ㅻ쭔 ?대? ?ㅻⅨ ?먮━?쇰㈃ 異붽꺽蹂대떎 ?뚮┝怨?吏吏 ?뺤씤??以묒슂?⑸땲??"
        : leadingTone === "bearish"
          ? "二쇱쓽 ?댁뒪媛 ??留롮븘 蹂?숈꽦 ?뺣?? 吏吏 ?댄깉 媛?μ꽦??癒쇱? 遊먯빞 ?⑸땲?? 諛섎벑???섏???嫄곕옒?됯낵 ?섎룎由?媛뺣룄瑜?媛숈씠 ?뺤씤?댁빞 ?⑸땲??"
          : "?댁뒪 諛⑺뼢?깆씠 ?뉕컝??李⑦듃 援ъ“ ?뺤씤????以묒슂?⑸땲?? 媛寃⑹씠 諛뺤뒪 ?곷떒怨??섎떒 以??대뵒瑜?癒쇱? ?뚰뙆?섎뒗吏 ?뺤씤?섎뒗 ?몄씠 ?덉쟾?⑸땲??",
      "?댁뒪留뚯쑝濡?吏꾩엯 諛⑺뼢???뺤젙?섍린蹂대떎 BTC? ETH??諛섏쓳, ?꾨??뚯뒪 蹂?? 嫄곕옒??利앷? ?щ?瑜??④퍡 ?뺤씤?섎뒗 寃껋씠 醫뗭뒿?덈떎.",
      "?뚰듃肄붿씤? 媛숈? ?댁뒪?먮룄 怨쇳븯寃?諛섏쓳?????덉쑝誘濡??먯젅 湲곗?怨??ъ????ш린瑜?癒쇱? 以꾩뿬??蹂대뒗 寃껋씠 醫뗭뒿?덈떎."
    ],
    strategyNotes: [
      "媛뺥븳 ?몄옱媛 ?섏????대? ?λ? ?묐큺 ?댄썑?쇰㈃ 異붽꺽 吏꾩엯蹂대떎 ?섎룎由?吏吏 ?뺤씤???곗꽑?섏꽭??",
      "?낆옱???댁뒪媛 留롮쓣 ?뚮뒗 ?뤿쭔 蹂닿쿋?ㅻ뒗 ?살씠 ?꾨땲?? 濡?吏꾩엯 議곌굔?????꾧꺽?섍쾶 蹂닿쿋?ㅻ뒗 ?섎?濡??곕뒗 ?몄씠 醫뗭뒿?덈떎.",
      "?댁뒪 釉뚮━?묒? 留ㅼ닔쨌留ㅻ룄 ?좏샇媛 ?꾨땲???ㅻ뒛 李⑦듃?먯꽌 臾댁뾿????議곗떖?댁꽌 蹂쇱? ?뺥븯??泥댄겕由ъ뒪?몃줈 ?쒖슜?섏꽭??"
    ],
    finalSummary:
      leadingTone === "bullish"
        ? "?뺣━?섎㈃, ?댁뒪 ?щ━???ㅼ냼 湲띿젙?곸씠吏留?異붽꺽 留ㅼ닔蹂대떎 援ъ“ ?뺤씤??癒쇱??낅땲??"
        : leadingTone === "bearish"
          ? "?뺣━?섎㈃, 諛⑹뼱?곸씤 愿李곗씠 ?꾩슂???먮쫫?낅땲?? 吏吏 ?댄깉怨?泥?궛??蹂?숈꽦???곗꽑 泥댄겕?섏꽭??"
          : "?뺣━?섎㈃, ?댁뒪留뚯쑝濡?諛⑺뼢???⑥젙?섍린 ?대졄?듬땲?? 李⑦듃 ?덉씠?붿쓽 援ъ“ ?먮룆怨??④퍡 ?뺤씤?섎뒗 援ш컙?낅땲??"
  };
}

function buildNewsBriefingPrompt(items: RadarNewsItem[], market: RadarNewsMarket) {
  const marketLabel = market === "stocks" ? "湲濡쒕쾶 ?쒖옣" : "肄붿씤";
  const headlines = items
    .slice(0, 10)
    .map((item, index) => {
      return `${index + 1}. [${item.source}] ${itemTitle(item)}
?먮Ц: ${item.title}
諛⑺뼢: ${toneLabel(item.direction)}
?먯닔: ${item.score}
?쒓렇: ${item.tags.join(", ")}
?붿빟: ${item.summary}`;
    })
    .join("\n\n");

  return `?꾨옒 ${marketLabel} 愿???댁뒪 ?쒕ぉ怨?1李?遺꾨쪟瑜?諛뷀깢?쇰줈 ?쒓뎅???쒖옣 釉뚮━?묒쓣 ?묒꽦??二쇱꽭??

異쒕젰? 諛섎뱶??JSON ?섎굹留?諛섑솚?섏꽭?? 留덊겕?ㅼ슫 臾몃쾿? ?곗? 留덉꽭??
?ㅽ궎留덈뒗 ?ㅼ쓬怨?媛숈뒿?덈떎.
{
  "overview": "?ㅻ뒛 ?쒖옣????臾몃떒?쇰줈 ?붿빟",
  "keyIssues": [
    { "title": "二쇱슂 ?댁뒋 ?쒕ぉ", "detail": "??以묒슂?쒖?? ?뺤씤????, "tone": "bullish|bearish|neutral" }
  ],
  "marketImpact": ["?쒖옣??誘몄튌 ???덈뒗 ?곹뼢 3媛?],
  "strategyNotes": ["?ъ옄 ?먮떒 ??李멸퀬????3媛?],
  "finalSummary": "留덉?留???以??뺣━"
}

洹쒖튃.
- 紐⑤뱺 臾몄옣? ?쒓뎅?대줈 ?묒꽦?섏꽭??
- 吏곸젒?곸씤 留ㅼ닔쨌留ㅻ룄 ?좏샇, ?섏씡 蹂댁옣, ?뱀젙 吏꾩엯 吏?쒕뒗 湲덉??낅땲??
- ????ㅻ뒛 ?쒖옣?먯꽌 議곗떖???? ?뺤씤??議곌굔, 由ъ뒪??愿由?愿?먯쑝濡??뺣━?섏꽭??
- keyIssues??3媛쒖뿉??5媛??ъ씠濡??묒꽦?섏꽭??
- marketImpact? strategyNotes??媛곴컖 3媛쒕줈 ?묒꽦?섏꽭??

?댁뒪 ?щ즺.
${headlines || "?섏쭛???댁뒪媛 遺議깊빀?덈떎."}`;
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
  const limited = await rateLimit(request, {
    key: "radar-news",
    limit: 60,
    windowMs: 60_000
  });

  if (!limited.allowed) {
    return NextResponse.json(
      { error: "?댁뒪 ?덉씠???붿껌???좎떆 留롮뒿?덈떎.", retryAfter: limited.retryAfter },
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
