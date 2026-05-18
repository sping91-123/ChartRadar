// 글로벌 주요 자산의 하루 변동률과 미국장 30초 체크 대시보드 데이터를 제공하는 API 라우트입니다.
import { NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import { getMacroCalendarPayload } from "@/lib/macroCalendar";
import type { MacroEventItem } from "@/data/macroEvents";
import { fetchStockCandles, findStockSymbol } from "@/lib/stockMarket";
import { rateLimit } from "@/lib/server/rateLimit";
import { entitlementRateKey, getRequestEntitlement } from "@/lib/server/requestEntitlement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MarketMode = "Risk-On" | "Neutral" | "Risk-Off";
type PressureTone = "supportive" | "burden" | "mixed";
type DashboardRole = "index_future" | "macro_proxy" | "sector" | "leader" | "core";

type BoardItem = {
  symbol: string;
  name: string;
  group: string;
  role: DashboardRole;
  label: string;
  price: number;
  changePercent: number;
  state: "strong_up" | "up" | "flat" | "down" | "strong_down";
  pressure: PressureTone;
  interpretation: string;
  proxyNote?: string;
};

type NewsFeed = {
  source: string;
  url: string;
};

type EventRiskPayload = {
  title: string;
  summary: string;
  nextEvent: MacroEventItem | null;
  items: MacroEventItem[];
  sourceNote: string;
  warning?: string;
};

const INDEX_FUTURES = ["NQ=F", "ES=F", "YM=F", "RTY=F"] as const;
const MACRO_PROXIES = ["^VIX", "VIXY", "UUP", "TLT", "ZN=F", "IEF", "SHY", "GLD", "CL=F"] as const;
const SECTOR_SYMBOLS = ["XLK", "XLY", "XLP", "XLV", "XLI", "XLU", "XLC", "XLF", "XLE", "SMH", "SOXX"] as const;
const LEADER_SYMBOLS = ["NVDA", "TSLA", "AAPL", "MSFT", "AMZN", "META", "GOOGL", "AVGO"] as const;
const CORE_SYMBOLS = ["QQQ", "SPY"] as const;
const pulseSymbols = Array.from(new Set([...INDEX_FUTURES, ...MACRO_PROXIES, ...SECTOR_SYMBOLS, ...LEADER_SYMBOLS, ...CORE_SYMBOLS]));
const MARKET_BOARD_BATCH_SIZE = 8;

const newsFeeds = [
  { source: "CNBC Markets", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html" },
  { source: "MarketWatch", url: "https://feeds.content.dowjones.io/public/rss/mw_topstories" }
] satisfies readonly NewsFeed[];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: "text"
});

function classifyChange(changePercent: number) {
  if (changePercent >= 1.2) return "strong_up";
  if (changePercent >= 0.25) return "up";
  if (changePercent <= -1.2) return "strong_down";
  if (changePercent <= -0.25) return "down";
  return "flat";
}

function signedChange(value: number) {
  if (value >= 0.25) return 1;
  if (value <= -0.25) return -1;
  return 0;
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function cleanText(value: unknown) {
  if (typeof value !== "string") return "";
  return value
    .replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function itemRole(symbol: string): DashboardRole {
  if ((INDEX_FUTURES as readonly string[]).includes(symbol)) return "index_future";
  if ((MACRO_PROXIES as readonly string[]).includes(symbol)) return "macro_proxy";
  if ((SECTOR_SYMBOLS as readonly string[]).includes(symbol)) return "sector";
  if ((LEADER_SYMBOLS as readonly string[]).includes(symbol)) return "leader";
  return "core";
}

function itemLabel(symbol: string) {
  const labels: Record<string, string> = {
    "NQ=F": "나스닥100 선물",
    "ES=F": "S&P500 선물",
    "YM=F": "다우 선물",
    "RTY=F": "러셀2000 선물",
    "^VIX": "VIX 변동성",
    VIXY: "VIX ETF 프록시",
    UUP: "DXY 달러 프록시",
    TLT: "10Y/장기금리 프록시",
    "ZN=F": "10Y 금리 프록시",
    IEF: "7-10Y 금리 프록시",
    SHY: "단기채 프록시",
    GLD: "금",
    "CL=F": "유가",
    XLK: "기술",
    XLY: "경기소비",
    XLP: "필수소비",
    XLV: "헬스케어",
    XLI: "산업재",
    XLU: "유틸리티",
    XLC: "커뮤니케이션",
    XLF: "금융",
    XLE: "에너지",
    SMH: "반도체",
    SOXX: "반도체",
    QQQ: "나스닥 ETF",
    SPY: "S&P500 ETF"
  };
  return labels[symbol] ?? symbol;
}

function proxyNote(symbol: string) {
  if (symbol === "UUP") return "DXY를 직접 쓰지 않고 UUP 달러 ETF를 프록시로 봅니다.";
  if (symbol === "TLT" || symbol === "ZN=F" || symbol === "IEF" || symbol === "SHY") {
    return "실제 10Y yield가 아니라 채권 ETF와 국채선물 프록시로 금리 압력을 봅니다.";
  }
  if (symbol === "VIXY") return "VIX 선물 ETF 프록시입니다.";
  return undefined;
}

function pressureFromItem(symbol: string, changePercent: number): PressureTone {
  const direction = signedChange(changePercent);
  if (direction === 0) return "mixed";
  if (symbol === "^VIX" || symbol === "VIXY" || symbol === "UUP" || symbol === "GLD") {
    return direction > 0 ? "burden" : "supportive";
  }
  if (symbol === "CL=F") {
    if (changePercent >= 1.2) return "burden";
    if (changePercent <= -1.2) return "supportive";
    return "mixed";
  }
  return direction > 0 ? "supportive" : "burden";
}

function interpretationForItem(symbol: string, changePercent: number, pressure: PressureTone) {
  const formatted = `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}%`;
  if (symbol === "^VIX" || symbol === "VIXY") {
    return pressure === "burden" ? `변동성 프록시가 ${formatted}로 올라 리스크 점검이 우선입니다.` : `변동성 프록시가 ${formatted}로 안정되어 위험자산에 우호적입니다.`;
  }
  if (symbol === "UUP") {
    return pressure === "burden" ? `UUP 달러 프록시가 ${formatted}로 강해 성장주에는 부담입니다.` : `UUP 달러 프록시가 ${formatted}로 약해 위험자산 부담이 줄었습니다.`;
  }
  if (symbol === "TLT" || symbol === "ZN=F" || symbol === "IEF" || symbol === "SHY") {
    return pressure === "supportive" ? `${itemLabel(symbol)}가 ${formatted}로 올라 금리 부담 완화 프록시로 봅니다.` : `${itemLabel(symbol)}가 ${formatted}로 약해 금리 부담을 점검해야 합니다.`;
  }
  if (symbol === "CL=F") {
    return pressure === "burden" ? `유가가 ${formatted}로 올라 인플레이션 부담을 남깁니다.` : pressure === "supportive" ? `유가가 ${formatted}로 내려 비용 부담은 완화 쪽입니다.` : `유가는 ${formatted}로 중립권입니다.`;
  }
  if ((INDEX_FUTURES as readonly string[]).includes(symbol)) {
    return pressure === "supportive" ? `${itemLabel(symbol)}이 ${formatted}로 위험선호를 지지합니다.` : pressure === "burden" ? `${itemLabel(symbol)}이 ${formatted}로 본장 확인이 필요합니다.` : `${itemLabel(symbol)}은 ${formatted}로 방향 확인 구간입니다.`;
  }
  if ((SECTOR_SYMBOLS as readonly string[]).includes(symbol)) {
    return pressure === "supportive" ? `${itemLabel(symbol)} 섹터가 ${formatted}로 상대적으로 강합니다.` : pressure === "burden" ? `${itemLabel(symbol)} 섹터가 ${formatted}로 약합니다.` : `${itemLabel(symbol)} 섹터는 ${formatted}로 중립권입니다.`;
  }
  if ((LEADER_SYMBOLS as readonly string[]).includes(symbol)) {
    return pressure === "supportive" ? `${symbol}가 ${formatted}로 지수 지지 쪽입니다.` : pressure === "burden" ? `${symbol}가 ${formatted}로 지수에 부담입니다.` : `${symbol}는 ${formatted}로 지수 영향이 중립입니다.`;
  }
  return pressure === "supportive" ? `${symbol} ${formatted}로 우호적입니다.` : pressure === "burden" ? `${symbol} ${formatted}로 부담입니다.` : `${symbol} ${formatted}로 중립권입니다.`;
}

async function loadBoardItem(symbol: string): Promise<BoardItem> {
  const candles = await fetchStockCandles(symbol, "1d");
  const latest = candles[candles.length - 1];
  const previous = candles[candles.length - 2];
  if (!latest || !previous) throw new Error(`${symbol} 가격 데이터가 부족합니다.`);
  const changePercent = ((latest.close - previous.close) / previous.close) * 100;
  const info = findStockSymbol(symbol);
  const pressure = pressureFromItem(symbol, changePercent);
  return {
    symbol,
    name: info?.name ?? symbol,
    group: info?.group ?? "index_etf",
    role: itemRole(symbol),
    label: itemLabel(symbol),
    price: latest.close,
    changePercent,
    state: classifyChange(changePercent),
    pressure,
    interpretation: interpretationForItem(symbol, changePercent, pressure),
    proxyNote: proxyNote(symbol)
  };
}

async function loadBoardItemsInBatches(symbols: string[]) {
  const settled: PromiseSettledResult<BoardItem>[] = [];
  for (let index = 0; index < symbols.length; index += MARKET_BOARD_BATCH_SIZE) {
    const batch = symbols.slice(index, index + MARKET_BOARD_BATCH_SIZE);
    settled.push(...(await Promise.allSettled(batch.map(loadBoardItem))));
  }
  return settled;
}

function scoreItem(item: BoardItem) {
  if (item.pressure === "mixed") return 0;
  const sign = item.pressure === "supportive" ? 1 : -1;
  const magnitude = Math.abs(item.changePercent) >= 1.2 ? 1.4 : 1;
  if (item.role === "index_future") return sign * 1.25 * magnitude;
  if (item.symbol === "^VIX" || item.symbol === "UUP") return sign * 1.3 * magnitude;
  if (item.role === "leader" || item.role === "sector") return sign * 0.75 * magnitude;
  return sign * 0.85 * magnitude;
}

function average(items: BoardItem[]) {
  if (!items.length) return 0;
  return items.reduce((sum, item) => sum + item.changePercent, 0) / items.length;
}

function modeFromScore(score: number, availableCount: number): MarketMode {
  if (availableCount < 6) return "Neutral";
  if (score >= 3.2) return "Risk-On";
  if (score <= -3.2) return "Risk-Off";
  return "Neutral";
}

function toneFromMode(mode: MarketMode): PressureTone {
  if (mode === "Risk-On") return "supportive";
  if (mode === "Risk-Off") return "burden";
  return "mixed";
}

function buildHeadline(mode: MarketMode, futuresSummary: string, macroSummary: string) {
  if (mode === "Risk-On") return `오늘 미국장은 Risk-On에 가깝습니다. ${futuresSummary} ${macroSummary}`;
  if (mode === "Risk-Off") return `오늘 미국장은 Risk-Off에 가깝습니다. ${futuresSummary} ${macroSummary}`;
  return `오늘 미국장은 Neutral에 가깝습니다. ${futuresSummary} ${macroSummary}`;
}

function buildCorePressures(items: BoardItem[]) {
  const ranked = [...items]
    .filter((item) => item.pressure !== "mixed")
    .sort((a, b) => Math.abs(scoreItem(b)) - Math.abs(scoreItem(a)));
  const selected = ranked.slice(0, 3).map((item) => ({
    title: item.label,
    detail: item.interpretation,
    tone: item.pressure
  }));

  while (selected.length < 3) {
    selected.push({
      title: "데이터 확인 제한",
      detail: "일부 데이터 확인 제한이 있어 본장 초반 반응을 함께 확인해야 합니다.",
      tone: "mixed" as const
    });
  }

  return selected;
}

function buildFuturesBlock(items: BoardItem[]) {
  const up = items.filter((item) => item.pressure === "supportive").length;
  const down = items.filter((item) => item.pressure === "burden").length;
  const nq = items.find((item) => item.symbol === "NQ=F");
  const rty = items.find((item) => item.symbol === "RTY=F");
  const isDivergent = up > 0 && down > 0;
  const riskBreadth =
    up >= 3
      ? "나스닥뿐 아니라 지수선물 전반으로 위험선호가 확산됩니다."
      : nq?.pressure === "supportive" && rty?.pressure !== "supportive"
        ? "나스닥은 버티지만 러셀 확산은 아직 제한적입니다."
        : down >= 3
          ? "주요 지수선물이 함께 약해 본장 초반 확인이 우선입니다."
          : "지수선물 방향이 완전히 모이지 않았습니다.";

  return {
    title: isDivergent ? "지수선물 엇갈림" : up > down ? "지수선물 위험선호" : down > up ? "지수선물 방어 우위" : "지수선물 중립",
    summary: riskBreadth,
    tone: up > down ? "supportive" : down > up ? "burden" : "mixed",
    isDivergent,
    items
  };
}

function buildMacroBlock(items: BoardItem[]) {
  const vix = items.find((item) => item.symbol === "^VIX" || item.symbol === "VIXY");
  const dollar = items.find((item) => item.symbol === "UUP");
  const rates = items.filter((item) => item.symbol === "TLT" || item.symbol === "ZN=F" || item.symbol === "IEF" || item.symbol === "SHY");
  const burdens = items.filter((item) => item.pressure === "burden");
  const supports = items.filter((item) => item.pressure === "supportive");
  const rateSummary = rates.some((item) => item.pressure === "burden")
    ? "금리 프록시가 부담으로 남아 성장주 추격에는 본장 확인이 필요합니다."
    : rates.some((item) => item.pressure === "supportive")
      ? "금리 프록시는 부담 완화 쪽으로 해석됩니다."
      : "금리 프록시는 중립권입니다.";
  const summary = [
    vix ? vix.interpretation : "VIX 데이터 확인이 제한됩니다.",
    dollar ? dollar.interpretation : "UUP 달러 프록시 확인이 제한됩니다.",
    rateSummary
  ].join(" ");

  return {
    title: burdens.length > supports.length ? "매크로 압력 부담" : supports.length > burdens.length ? "매크로 압력 완화" : "매크로 압력 중립",
    summary,
    tone: supports.length > burdens.length ? "supportive" : burdens.length > supports.length ? "burden" : "mixed",
    items
  };
}

function buildSectorBlock(items: BoardItem[]) {
  const sorted = [...items].sort((a, b) => b.changePercent - a.changePercent);
  const strong = sorted.filter((item) => item.changePercent > 0.25).slice(0, 3);
  const weak = [...sorted].reverse().filter((item) => item.changePercent < -0.25).slice(0, 3);
  const growthSymbols = new Set(["XLK", "XLY", "XLC", "SMH", "SOXX"]);
  const defensiveSymbols = new Set(["XLP", "XLV", "XLU"]);
  const growthScore = average(items.filter((item) => growthSymbols.has(item.symbol)));
  const defensiveScore = average(items.filter((item) => defensiveSymbols.has(item.symbol)));
  const semiconductor = items.find((item) => item.symbol === "SMH" || item.symbol === "SOXX");
  const breadth = strong.length >= 5 ? "넓음" : strong.length >= 3 ? "보통" : "좁음";
  const summary =
    growthScore > defensiveScore + 0.25
      ? `성장 섹터가 방어 섹터보다 강합니다. 시장 폭은 ${breadth}으로 봅니다.`
      : defensiveScore > growthScore + 0.25
        ? `방어 섹터가 상대적으로 강해 위험회피 성격을 점검해야 합니다. 시장 폭은 ${breadth}입니다.`
        : `성장과 방어 섹터가 엇갈립니다. 시장 폭은 ${breadth}입니다.`;

  return {
    title: "섹터 로테이션",
    summary: semiconductor?.pressure === "supportive" ? `${summary} 반도체가 지수 지지에 기여합니다.` : summary,
    tone: growthScore > defensiveScore + 0.25 ? "supportive" : defensiveScore > growthScore + 0.25 ? "burden" : "mixed",
    breadth,
    strong,
    weak,
    items
  };
}

function buildLeaderBlock(items: BoardItem[]) {
  const supportive = items.filter((item) => item.pressure === "supportive");
  const burden = items.filter((item) => item.pressure === "burden");
  const nvda = items.find((item) => item.symbol === "NVDA");
  const tsla = items.find((item) => item.symbol === "TSLA");
  const apple = items.find((item) => item.symbol === "AAPL");
  const msft = items.find((item) => item.symbol === "MSFT");
  const summary =
    supportive.length >= burden.length + 2
      ? "대장주가 지수를 지지하는 쪽입니다."
      : burden.length >= supportive.length + 2
        ? "대장주가 지수에 부담으로 작용합니다."
        : "대장주 영향이 엇갈립니다.";
  const focus = [nvda, tsla, apple, msft].filter(Boolean).map((item) => item!.interpretation).slice(0, 2);

  return {
    title: "대장주 레이더",
    summary: focus.length ? `${summary} ${focus.join(" ")}` : summary,
    tone: supportive.length > burden.length ? "supportive" : burden.length > supportive.length ? "burden" : "mixed",
    supportive: supportive.slice(0, 4),
    burden: burden.slice(0, 4),
    items
  };
}

function sortEventItems<T extends { releaseAt: string; importance: number }>(items: T[]) {
  const now = Date.now();
  return [...items].sort((a, b) => {
    const aTime = Date.parse(a.releaseAt);
    const bTime = Date.parse(b.releaseAt);
    const aDistance = Number.isFinite(aTime) ? Math.abs(aTime - now) : Number.POSITIVE_INFINITY;
    const bDistance = Number.isFinite(bTime) ? Math.abs(bTime - now) : Number.POSITIVE_INFINITY;
    const importanceDiff = b.importance - a.importance;
    return importanceDiff || aDistance - bDistance;
  });
}

async function buildEventRisk(): Promise<EventRiskPayload> {
  try {
    const payload = await getMacroCalendarPayload();
    const now = Date.now();
    const items = sortEventItems(
      payload.items
        .filter((item) => {
          const time = Date.parse(item.releaseAt);
          if (!Number.isFinite(time)) return false;
          return time >= now - 24 * 60 * 60 * 1000;
        })
        .slice(0, 6)
    );
    const next = items.find((item) => Date.parse(item.releaseAt) >= now) ?? items[0] ?? null;
    const highRisk = items.find((item) => item.importance >= 3) ?? next;
    return {
      title: highRisk ? "이벤트 전 변동성 주의" : "이벤트 리스크 제한",
      summary: highRisk
        ? `${highRisk.label} 전후에는 추격보다 본장 반응 확인이 우선입니다.`
        : "가까운 주요 이벤트가 제한적입니다. 가격 반응과 뉴스 압력을 함께 봅니다.",
      nextEvent: next,
      items,
      sourceNote: payload.sourceNote,
      warning: payload.warning
    };
  } catch {
    return {
      title: "이벤트 데이터 확인 제한",
      summary: "경제 이벤트 일부 데이터 확인 제한이 있어 본장 초반 변동성에 유의해야 합니다.",
      nextEvent: null,
      items: [],
      sourceNote: "일부 데이터 확인 제한",
      warning: "매크로 캘린더 확인 실패"
    };
  }
}

function newsDirection(title: string) {
  const lower = title.toLowerCase();
  if (/rally|record|surge|rebounds|rate cut|soft landing|dovish|beat|raised guidance|ai demand|chip demand/.test(lower)) return "supportive" as const;
  if (/sell-off|plunge|slump|higher yield|hawkish|sticky inflation|miss|cuts guidance|recession|tariff|lawsuit/.test(lower)) return "burden" as const;
  if (/fed|fomc|powell|cpi|ppi|pce|jobs|payroll|yield|dollar|vix|oil|earnings/.test(lower)) return "mixed" as const;
  return null;
}

async function loadNewsFeed(feed: NewsFeed) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(feed.url, {
      headers: { "user-agent": "ChartRadarBot/1.0" },
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) return [];
    const xml = await response.text();
    const parsed = parser.parse(xml) as { rss?: { channel?: { item?: unknown } }; feed?: { entry?: unknown } };
    const records = asArray((parsed.rss?.channel?.item ?? parsed.feed?.entry) as Record<string, unknown> | Record<string, unknown>[] | undefined);
    return records
      .map((record) => {
        const title = cleanText(record.title);
        const direction = newsDirection(title);
        if (!title || !direction) return null;
        return {
          source: feed.source,
          title,
          tone: direction,
          summary:
            direction === "supportive"
              ? "뉴스 흐름은 위험자산에 우호적인 쪽입니다."
              : direction === "burden"
                ? "뉴스 흐름은 리스크 점검 쪽입니다."
                : "뉴스는 변동성 확대 요인으로 분류됩니다."
        };
      })
      .filter((item): item is { source: string; title: string; tone: PressureTone; summary: string } => Boolean(item))
      .slice(0, 6);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function buildNewsPressure() {
  const settled = await Promise.allSettled(newsFeeds.map(loadNewsFeed));
  const items = settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  const supportive = items.filter((item) => item.tone === "supportive").length;
  const burden = items.filter((item) => item.tone === "burden").length;
  const tone: PressureTone = supportive > burden ? "supportive" : burden > supportive ? "burden" : "mixed";
  return {
    title: tone === "supportive" ? "뉴스 압력 우호" : tone === "burden" ? "뉴스 압력 부담" : "뉴스 압력 중립",
    summary:
      items.length === 0
        ? "강한 공개 뉴스 압력은 아직 제한적입니다. 이벤트와 가격 반응을 함께 확인하세요."
        : tone === "supportive"
          ? "공개 뉴스 흐름은 위험자산에 우호적인 재료가 조금 더 많습니다."
          : tone === "burden"
            ? "공개 뉴스 흐름은 리스크 점검 재료가 조금 더 많습니다."
            : "공개 뉴스 흐름은 방향보다 변동성 점검에 가깝습니다.",
    tone,
    items: items.slice(0, 3)
  };
}

function topRisk(eventRisk: Awaited<ReturnType<typeof buildEventRisk>>, macroBlock: ReturnType<typeof buildMacroBlock>, futuresBlock: ReturnType<typeof buildFuturesBlock>) {
  if (eventRisk.nextEvent && eventRisk.nextEvent.importance >= 3) return `${eventRisk.nextEvent.label} 전후 이벤트 전 변동성 주의`;
  if (macroBlock.tone === "burden") return "VIX, 달러, 금리 프록시 중 부담 축이 남아 있습니다.";
  if (futuresBlock.isDivergent) return "지수선물 엇갈림으로 본장 초반 확인이 필요합니다.";
  return "추격보다 본장 초반 확인과 무효화 조건 점검이 우선입니다.";
}

type MarketBoardPayload = {
  updatedAt: string;
  headline: string;
  marketMode: MarketMode;
  strength: number;
  confidence: number;
  tone: PressureTone;
  score: number;
  topRisk: string;
  dataWarning: string | null;
  corePressures: ReturnType<typeof buildCorePressures>;
  basicIndexSummary: {
    symbol: string;
    label: string;
    changePercent: number;
    interpretation: string;
    tone: PressureTone;
  } | null;
  counts: { up: number; down: number; flat: number };
  futures: ReturnType<typeof buildFuturesBlock>;
  macro: ReturnType<typeof buildMacroBlock>;
  sectors: ReturnType<typeof buildSectorBlock>;
  leaders: ReturnType<typeof buildLeaderBlock>;
  eventRisk: EventRiskPayload;
  newsPressure: Awaited<ReturnType<typeof buildNewsPressure>>;
  proxyDisclosure: string;
  items: BoardItem[];
};

function shapeBasicPayload(payload: MarketBoardPayload): MarketBoardPayload {
  return {
    ...payload,
    corePressures: payload.corePressures.slice(0, 3),
    futures: {
      ...payload.futures,
      items: []
    },
    macro: {
      ...payload.macro,
      items: payload.macro.items.slice(0, 2)
    },
    sectors: {
      ...payload.sectors,
      items: [],
      strong: payload.sectors.strong.slice(0, 1),
      weak: payload.sectors.weak.slice(0, 1)
    },
    leaders: {
      ...payload.leaders,
      items: [],
      supportive: payload.leaders.supportive.slice(0, 1),
      burden: payload.leaders.burden.slice(0, 1)
    },
    eventRisk: {
      ...payload.eventRisk,
      items: payload.eventRisk.nextEvent ? [payload.eventRisk.nextEvent] : payload.eventRisk.items.slice(0, 0)
    },
    newsPressure: {
      ...payload.newsPressure,
      items: payload.newsPressure.items.slice(0, 1)
    },
    items: []
  };
}

export async function GET(request: Request) {
  const entitlement = await getRequestEntitlement(request, "stocks");
  const limit = await rateLimit(request, {
    key: entitlementRateKey("stocks-market-board", entitlement),
    limit: entitlement.isPaid ? 90 : 30,
    windowMs: 5 * 60 * 1000
  });

  if (!limit.allowed) {
    return NextResponse.json(
      { error: "글로벌 시장 흐름 요청이 잠시 많습니다. 잠시 후 다시 확인해 주세요." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const [settled, eventRisk, newsPressure] = await Promise.all([
    loadBoardItemsInBatches(pulseSymbols),
    buildEventRisk(),
    buildNewsPressure()
  ]);

  const items = settled.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
  const failedSymbols = pulseSymbols.filter((_, index) => settled[index]?.status === "rejected");
  const dataWarning =
    failedSymbols.length > 0
      ? `일부 데이터 확인 제한: ${failedSymbols.slice(0, 4).join(", ")}${failedSymbols.length > 4 ? ` 외 ${failedSymbols.length - 4}개` : ""} 확인 실패`
      : null;
  if (items.length === 0) {
    return NextResponse.json(
      { error: "글로벌 시장 흐름 데이터를 잠시 확인하지 못했습니다. 잠시 뒤 다시 확인해 주세요." },
      { status: 503 }
    );
  }

  const futures = buildFuturesBlock(items.filter((item) => item.role === "index_future"));
  const macro = buildMacroBlock(items.filter((item) => item.role === "macro_proxy"));
  const sectors = buildSectorBlock(items.filter((item) => item.role === "sector"));
  const leaders = buildLeaderBlock(items.filter((item) => item.role === "leader"));
  const core = items.filter((item) => item.role === "core");
  const qqqOrNq = items.find((item) => item.symbol === "NQ=F") ?? items.find((item) => item.symbol === "QQQ") ?? null;
  const score = items.reduce((sum, item) => sum + scoreItem(item), 0);
  const marketMode = modeFromScore(score, items.length);
  const strength = Math.min(96, Math.max(35, Math.round(44 + Math.abs(score) * 6 + items.length / 3)));
  const macroSummary = macro.tone === "burden" ? "매크로 압력은 부담이 남아 있습니다." : macro.tone === "supportive" ? "매크로 압력은 완화 쪽입니다." : "매크로 압력은 중립권입니다.";
  const headline = buildHeadline(marketMode, futures.summary, macroSummary);
  const upCount = items.filter((item) => item.changePercent > 0.25).length;
  const downCount = items.filter((item) => item.changePercent < -0.25).length;
  const flatCount = Math.max(0, items.length - upCount - downCount);

  const responsePayload: MarketBoardPayload = {
    updatedAt: new Date().toISOString(),
    headline,
    marketMode,
    strength,
    confidence: strength,
    tone: toneFromMode(marketMode),
    score: Number(score.toFixed(2)),
    topRisk: topRisk(eventRisk, macro, futures),
    dataWarning,
    corePressures: buildCorePressures(items),
    basicIndexSummary: qqqOrNq
      ? {
          symbol: qqqOrNq.symbol,
          label: qqqOrNq.label,
          changePercent: qqqOrNq.changePercent,
          interpretation: qqqOrNq.interpretation,
          tone: qqqOrNq.pressure
        }
      : null,
    counts: { up: upCount, down: downCount, flat: flatCount },
    futures,
    macro,
    sectors,
    leaders,
    eventRisk,
    newsPressure,
    proxyDisclosure: "DXY는 UUP 프록시, 10Y/금리는 TLT, ZN=F, IEF, SHY 프록시로 표시합니다.",
    items
  };

  return NextResponse.json(entitlement.isPaid ? responsePayload : shapeBasicPayload(responsePayload));
}
