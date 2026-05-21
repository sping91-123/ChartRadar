"use client";
// 시장 뉴스 브리핑과 참고 뉴스 목록을 카드형 레이더로 보여주는 패널입니다.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Compass,
  ExternalLink,
  ListChecks,
  Newspaper,
  RefreshCcw,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp
} from "lucide-react";
import {
  displayNewsSource,
  fallbackKoreanNewsTitle,
  localizeNewsSourceText,
  type RadarNewsBriefing,
  type RadarNewsDirection,
  type RadarNewsItem
} from "@/lib/radarNews";

type NewsPayload = {
  updatedAt: number;
  briefing: RadarNewsBriefing;
  items: RadarNewsItem[];
  failedSources: string[];
  cached: boolean;
  refreshIntervalMs?: number;
  error?: string;
};

type RadarNewsMarket = "crypto" | "stocks";
type Mood = "up" | "down" | "mixed" | "risk" | "pending";

type BriefingCard = {
  id: string;
  title: string;
  tone: RadarNewsDirection;
  summary: string;
  tags: string[];
  issue?: RadarNewsBriefing["keyIssues"][number];
  relatedItems: RadarNewsItem[];
};

const marketCopy = {
  crypto: {
    eyebrow: "AI 시장 브리핑",
    title: "뉴스 레이더",
    description: "오늘 시장을 움직이는 이슈를 AI가 요약하고, 차트 판단에 필요한 체크포인트로 정리합니다.",
    marketLabel: "코인 시장",
    radarTitle: "오늘의 시장 레이더",
    directionLabel: "BTC 방향성",
    subMarketLabel: "알트코인 분위기",
    cadenceLine: "뉴스 레이더는 1시간 단위로 갱신되며, 짧은 제목보다 공개 뉴스의 공통 흐름을 먼저 정리합니다.",
    emptyState:
      "현재 코인 시장 전체를 흔들 만한 강한 매크로 뉴스는 잡히지 않았습니다. 개별 알트·프로젝트 뉴스는 제외하고, BTC·ETH·ETF·금리·달러·물가·고용·규제·청산 흐름에 영향을 주는 이슈가 잡히면 이곳에 표시됩니다."
  },
  stocks: {
    eyebrow: "AI 글로벌 일정 브리핑",
    title: "일정 레이더",
    description: "오늘 변동성을 만들 매크로 일정과 공개 뉴스를 차트 판단에 필요한 체크포인트로 정리합니다.",
    marketLabel: "글로벌 시장",
    radarTitle: "오늘의 글로벌 일정 레이더",
    directionLabel: "지수 방향성",
    subMarketLabel: "섹터 분위기",
    cadenceLine: "일정 레이더는 1시간 단위로 갱신되며, CPI, FOMC, 고용, 금리, 원자재와 공개 뉴스의 공통 흐름을 먼저 정리합니다.",
    emptyState:
      "현재 글로벌 시장을 흔들 만한 강한 일정·뉴스는 잡히지 않았습니다. 개별 종목성 뉴스는 제외하고, 금리·물가·고용·달러·VIX·원자재·주요 지수에 영향을 주는 일정이나 이슈가 잡히면 이곳에 표시됩니다."
  }
} satisfies Record<
  RadarNewsMarket,
  {
    eyebrow: string;
    title: string;
    description: string;
    marketLabel: string;
    radarTitle: string;
    directionLabel: string;
    subMarketLabel: string;
    cadenceLine: string;
    emptyState: string;
  }
>;

function newsCacheKey(market: RadarNewsMarket) {
  return `chart-radar.news.${market}.v14`;
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readCachedNews(market: RadarNewsMarket): NewsPayload | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(newsCacheKey(market));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NewsPayload;
    if (!parsed?.briefing || !Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedNews(market: RadarNewsMarket, payload: NewsPayload) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(newsCacheKey(market), JSON.stringify(payload));
}

function stripMarkdown(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[가-힣A-Za-z0-9,·ㆍ\s]{0,120}기사 묶음에서 확인되는 흐름입니다\.?/g, "공개 뉴스와 시장 반응을 함께 보면")
    .replace(/상방 우호 \d+개,\s*하방 주의 \d+개,\s*중립 확인 \d+개로 정리됩니다\./g, "상방과 하방 재료가 함께 정리됩니다.")
    .replace(/상방 \d+\s*[·ㆍ]\s*하방 \d+\s*[·ㆍ]\s*중립 \d+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanDisplayText(value: string | undefined, fallback = "") {
  const text = stripMarkdown(localizeNewsSourceText(value ?? ""));
  return text || fallback;
}

function timeLabel(value: string | number | undefined) {
  const date = new Date(value ?? Date.now());
  if (Number.isNaN(date.getTime())) return "업데이트 확인 중";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function reportTimeLabel(value: string | number | undefined) {
  const date = new Date(value ?? Date.now());
  if (Number.isNaN(date.getTime())) return "업데이트 확인 중";
  const pad = (next: number) => String(next).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function refreshLabel(refreshIntervalMs?: number) {
  const minutes = Math.max(1, Math.round((refreshIntervalMs ?? 60 * 60 * 1000) / 60000));
  return `${minutes}분 단위 갱신`;
}

function itemTitle(item: RadarNewsItem, market: RadarNewsMarket) {
  const title = item.translatedTitle?.trim();
  if (title && /[가-힣]/.test(title)) return cleanDisplayText(title);
  return cleanDisplayText(fallbackKoreanNewsTitle(item.title, market));
}

function sourceDomain(link: string) {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function hasValidExternalLink(link: string) {
  return /^https?:\/\//i.test(link);
}

function isPlaceholderSourceTitle(title: string) {
  const normalized = cleanDisplayText(title).toLowerCase();
  if (!normalized) return true;
  return [
    "업데이트되었습니다",
    "주요 이슈",
    "브리핑",
    "뉴스가 확인되었습니다",
    "확인해야 하는 뉴스입니다",
    "방향성보다 확인이 필요한 뉴스입니다"
  ].some((pattern) => normalized.includes(pattern));
}

function sourceReferenceTitle(item: RadarNewsItem) {
  const candidates = [item.translatedTitle, item.title].map((title) => cleanDisplayText(title)).filter(Boolean);
  return candidates.find((title) => !isPlaceholderSourceTitle(title)) ?? "";
}

function sourceReferenceItems(items: RadarNewsItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const title = sourceReferenceTitle(item);
    if (!title || !hasValidExternalLink(item.link)) return false;
    const key = `${title}|${item.link}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function directionBadge(direction: RadarNewsDirection) {
  if (direction === "bullish") {
    return {
      label: "상방 우세",
      caption: "",
      icon: TrendingUp,
      badge: "border-signal-success/30 bg-signal-success/10 text-signal-success",
      panel: "border-signal-success/20 bg-signal-success/10"
    };
  }
  if (direction === "bearish") {
    return {
      label: "하방 주의",
      caption: "",
      icon: TrendingDown,
      badge: "border-signal-danger/30 bg-signal-danger/10 text-signal-danger",
      panel: "border-signal-danger/20 bg-signal-danger/10"
    };
  }
  return {
    label: "혼조",
    caption: "",
    icon: Target,
    badge: "border-signal-warning/30 bg-signal-warning/10 text-signal-warning",
    panel: "border-signal-warning/20 bg-signal-warning/10"
  };
}

function moodCopy(mood: Mood) {
  if (mood === "up") {
    return {
      label: "상방 우세",
      caption: "",
      icon: TrendingUp,
      badge: "border-signal-success/30 bg-signal-success/10 text-signal-success",
      panel: "border-signal-success/20 bg-signal-success/10",
      risk: "위험자산 심리 개선",
      chartTone: "상방 재료 우세",
      subTone: "선별 강세"
    };
  }
  if (mood === "down") {
    return {
      label: "하방 주의",
      caption: "",
      icon: TrendingDown,
      badge: "border-signal-danger/30 bg-signal-danger/10 text-signal-danger",
      panel: "border-signal-danger/20 bg-signal-danger/10",
      risk: "위험자산 심리 약화",
      chartTone: "하방 압력 점검",
      subTone: "동반 약세 주의"
    };
  }
  if (mood === "risk") {
    return {
      label: "리스크",
      caption: "",
      icon: AlertTriangle,
      badge: "border-rose-300/30 bg-rose-300/10 text-rose-200",
      panel: "border-rose-300/20 bg-rose-300/10",
      risk: "위험자산 심리 경계",
      chartTone: "지지선 이탈 여부 점검",
      subTone: "변동성 확대 주의"
    };
  }
  if (mood === "pending") {
    return {
      label: "관망",
      caption: "",
      icon: Clock3,
      badge: "border-accent-blue/30 bg-accent-blue/10 text-accent-blue",
      panel: "border-accent-blue/20 bg-accent-blue/10",
      risk: "데이터 확인 중",
      chartTone: "방향성 확인 전",
      subTone: "분위기 집계 중"
    };
  }
  return {
    label: "혼조",
    caption: "",
    icon: Target,
    badge: "border-signal-warning/30 bg-signal-warning/10 text-signal-warning",
    panel: "border-signal-warning/20 bg-signal-warning/10",
    risk: "위험자산 심리 혼조",
    chartTone: "방향 확인 구간",
    subTone: "선별 장세"
  };
}

function inferMood(digest: { bullish: number; bearish: number; neutral: number; urgent: number }, hasBriefing: boolean): Mood {
  if (!hasBriefing) return "pending";
  if (digest.bearish > digest.bullish && digest.urgent > 0) return "risk";
  if (digest.bullish > digest.bearish) return "up";
  if (digest.bearish > digest.bullish) return "down";
  return "mixed";
}

function mergeTags(items: RadarNewsItem[], fallback: string[], market: RadarNewsMarket) {
  const tags = items.flatMap((item) => [...item.assets, ...item.tags]);
  const next = Array.from(new Set([...tags, ...fallback].map((tag) => cleanDisplayText(tag)).filter(Boolean)));
  if (next.length) return next.slice(0, 5);
  return market === "stocks" ? ["금리", "나스닥", "실적"] : ["BTC", "ETH", "금리"];
}

function sentenceParts(value: string | undefined) {
  return cleanDisplayText(value)
    .split(/(?<=[.!?。])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function sectionText(primary: string | undefined, fallback: string, maxSentences = 2) {
  const parts = sentenceParts(primary);
  const next = parts.length ? parts : sentenceParts(fallback);
  return (next.length ? next : [cleanDisplayText(fallback)]).slice(0, maxSentences).join(" ");
}

function uniqueTextItems(items: string[]) {
  const seen = new Set<string>();
  return items
    .map((item) => cleanDisplayText(item))
    .filter((item) => {
      const key = item.replace(/\s+/g, " ").toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function buildBriefingCards(briefing: RadarNewsBriefing | undefined, items: RadarNewsItem[], market: RadarNewsMarket): BriefingCard[] {
  if (!briefing) return [];
  if (items.length === 0) return [];
  const issues = briefing.keyIssues ?? [];
  if (issues.length > 0) {
    return issues.slice(0, 5).map((issue, index) => {
      const relatedItems = items.filter((item) => item.direction === issue.tone).slice(0, 3);
      return {
        id: `issue-${index}-${issue.tone}`,
        title: cleanDisplayText(issue.title, market === "stocks" ? "글로벌 시장 흐름 점검" : "코인 시장 흐름 점검"),
        tone: issue.tone,
        summary: sectionText(issue.detail, briefing.overview, 2),
        tags: mergeTags(relatedItems, [market === "stocks" ? "나스닥" : "BTC", "금리", "변동성"], market),
        issue,
        relatedItems
      };
    });
  }

  return items.slice(0, 5).map((item, index) => ({
    id: `news-${index}-${item.id}`,
    title: itemTitle(item, market),
    tone: item.direction,
    summary: cleanDisplayText(item.summary),
    tags: mergeTags([item], [], market),
    relatedItems: [item]
  }));
}

function leadSummary(briefing: RadarNewsBriefing | undefined, mood: Mood, market: RadarNewsMarket) {
  const fallback =
    market === "stocks"
      ? "글로벌 시장의 주요 뉴스와 매크로 흐름을 확인하는 중입니다. 강한 공개 이슈가 잡히면 시장 해석과 체크포인트를 정리합니다."
      : "코인 시장의 주요 뉴스와 매크로 흐름을 확인하는 중입니다. 강한 공개 이슈가 잡히면 시장 해석과 체크포인트를 정리합니다.";
  const overview = cleanDisplayText(briefing?.overview, fallback);
  if (mood === "pending") return fallback;
  return overview;
}

function MarketRadarCard({
  briefing,
  digest,
  market,
  updatedAt,
  hasBriefing
}: {
  briefing?: RadarNewsBriefing;
  digest: { bullish: number; bearish: number; neutral: number; urgent: number };
  market: RadarNewsMarket;
  updatedAt?: number;
  hasBriefing: boolean;
}) {
  const mood = inferMood(digest, hasBriefing);
  const moodStyle = moodCopy(mood);
  const MoodIcon = moodStyle.icon;
  const copy = marketCopy[market];
  const checkpoint = cleanDisplayText(
    briefing?.strategyNotes?.[0],
    market === "stocks"
      ? "금리, 달러, 지수선물과 주요 섹터 반응을 함께 확인하세요."
      : "BTC와 ETH의 지지·저항 반응, 금리와 달러 흐름을 함께 확인하세요."
  );

  return (
    <article className={`rounded-2xl border p-4 shadow-[0_18px_50px_rgba(0,0,0,0.24)] sm:p-5 ${moodStyle.panel}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-accent-blue">{copy.radarTitle}</p>
          <h3 className="mt-2 text-2xl font-black leading-8 text-white [word-break:keep-all]">{moodStyle.risk}</h3>
          <p className="mt-3 text-sm leading-6 text-slate-300 [word-break:keep-all]">{leadSummary(briefing, mood, market)}</p>
        </div>
        <div className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-black ${moodStyle.badge}`}>
          <MoodIcon size={16} aria-hidden />
          <span>{moodStyle.label}</span>
          {moodStyle.caption ? <span className="text-[11px] opacity-80">{moodStyle.caption}</span> : null}
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-[11px] font-bold text-slate-500">위험자산 심리</p>
          <p className="mt-1 text-sm font-black text-white">{moodStyle.risk}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-[11px] font-bold text-slate-500">{copy.directionLabel}</p>
          <p className="mt-1 text-sm font-black text-white">{moodStyle.chartTone}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-[11px] font-bold text-slate-500">{copy.subMarketLabel}</p>
          <p className="mt-1 text-sm font-black text-white">{moodStyle.subTone}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-[11px] font-bold text-slate-500">업데이트 시간</p>
          <p className="mt-1 text-sm font-black text-white">{reportTimeLabel(updatedAt)}</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-accent-blue/20 bg-accent-blue/10 p-3">
        <div className="flex items-center gap-2">
          <ListChecks size={15} className="text-accent-blue" aria-hidden />
          <p className="text-sm font-black text-white">오늘 체크포인트</p>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-300 [word-break:keep-all]">{checkpoint}</p>
      </div>
    </article>
  );
}

function EmptyBriefingCard({ copy }: { copy: (typeof marketCopy)[RadarNewsMarket] }) {
  return (
    <div className="rounded-2xl border border-accent-blue/20 bg-accent-blue/10 p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-accent-blue/25 bg-black/20 text-accent-blue">
          <Clock3 size={18} aria-hidden />
        </div>
        <div>
          <h3 className="text-base font-black text-white">브리핑 준비 중</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300 [word-break:keep-all]">{copy.emptyState}</p>
        </div>
      </div>
    </div>
  );
}

function BriefingDetail({
  card,
  briefing
}: {
  card: BriefingCard;
  briefing: RadarNewsBriefing;
}) {
  const keySummary = sectionText(card.summary, briefing.finalSummary, 3);
  const marketStatus = sectionText(briefing.overview, card.summary, 3);
  const issueDetail = sectionText(card.issue?.detail, card.summary, 2);
  const marketImpact = uniqueTextItems(briefing.marketImpact ?? []).filter(
    (item) => item !== keySummary && item !== marketStatus && item !== issueDetail
  );
  const checkpoints = uniqueTextItems(briefing.strategyNotes ?? []);
  const finalSummary = sectionText(briefing.finalSummary, card.summary, 1);
  const relatedItems = sourceReferenceItems(card.relatedItems);

  return (
    <div className="mt-3 space-y-3 rounded-2xl border border-accent-blue/20 bg-black/25 p-4">
      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-accent-blue" aria-hidden />
          <h4 className="text-sm font-black text-white">핵심 요약</h4>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-300 [word-break:keep-all]">{keySummary}</p>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center gap-2">
          <Activity size={15} className="text-accent-blue" aria-hidden />
          <h4 className="text-sm font-black text-white">시장 현황</h4>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-300 [word-break:keep-all]">{marketStatus}</p>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center gap-2">
          <Newspaper size={15} className="text-accent-blue" aria-hidden />
          <h4 className="text-sm font-black text-white">주요 이슈</h4>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-300 [word-break:keep-all]">
          {issueDetail}
        </p>
        {relatedItems.length ? (
          <div className="mt-3 space-y-2">
            {relatedItems.slice(0, 3).map((item) => (
              <a
                key={item.id}
                href={item.link}
                target="_blank"
                rel="noreferrer"
                className="flex items-start justify-between gap-3 rounded-lg border border-white/10 bg-black/20 p-2 text-xs leading-5 text-slate-400 transition hover:border-accent-blue/35 hover:text-slate-200"
              >
                <span className="[word-break:keep-all]">{sourceReferenceTitle(item)}</span>
                <ExternalLink size={12} className="mt-1 shrink-0 text-accent-blue" aria-hidden />
              </a>
            ))}
          </div>
        ) : null}
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center gap-2">
            <BarChart3 size={15} className="text-accent-blue" aria-hidden />
            <h4 className="text-sm font-black text-white">차트레이더 해석</h4>
          </div>
          <ul className="mt-2 space-y-2">
            {(marketImpact.length ? marketImpact : [keySummary]).slice(0, 3).map((item) => (
              <li key={item} className="flex gap-2 text-sm leading-6 text-slate-300 [word-break:keep-all]">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-blue" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-signal-warning/20 bg-signal-warning/10 p-3">
          <div className="flex items-center gap-2">
            <Target size={15} className="text-signal-warning" aria-hidden />
            <h4 className="text-sm font-black text-white">오늘 체크할 포인트</h4>
          </div>
          <ul className="mt-2 space-y-2">
            {checkpoints.slice(0, 3).map((item) => (
              <li key={item} className="flex gap-2 text-sm leading-6 text-slate-300 [word-break:keep-all]">
                <CheckCircle2 size={14} className="mt-1 shrink-0 text-signal-warning" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-xl border border-accent-blue/20 bg-accent-blue/10 p-3">
        <div className="flex items-center gap-2">
          <Compass size={15} className="text-accent-blue" aria-hidden />
          <h4 className="text-sm font-black text-white">요약</h4>
        </div>
        <p className="mt-2 text-sm font-bold leading-6 text-slate-200 [word-break:keep-all]">
          {finalSummary}
        </p>
      </section>
    </div>
  );
}

function BriefingCardView({
  card,
  briefing,
  updatedAt,
  expanded,
  onToggle
}: {
  card: BriefingCard;
  briefing: RadarNewsBriefing;
  updatedAt?: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const style = directionBadge(card.tone);
  const Icon = style.icon;

  return (
    <article className="rounded-2xl border border-white/10 bg-surface-card/90 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.18)]">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-black ${style.badge}`}>
          <Icon size={13} aria-hidden />
          {style.label}
          {style.caption ? <span className="opacity-80">{style.caption}</span> : null}
        </span>
        <span className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-[11px] font-bold text-slate-500">
          <Clock3 size={12} aria-hidden />
          {timeLabel(updatedAt)}
        </span>
      </div>

      <h3 className="mt-3 text-lg font-black leading-7 text-white [word-break:keep-all]">{card.title}</h3>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-300 [word-break:keep-all]">{card.summary}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {card.tags.slice(0, 5).map((tag) => (
          <span key={tag} className="rounded-md border border-accent-blue/20 bg-accent-blue/10 px-2 py-1 text-[11px] font-black text-accent-blue">
            {tag}
          </span>
        ))}
      </div>

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-accent-blue/30 bg-accent-blue/10 px-3 text-sm font-black text-accent-blue transition hover:border-accent-blue/50 hover:bg-accent-blue/20 sm:w-auto"
      >
        {expanded ? "상세 접기" : "자세히 보기"}
        {expanded ? <ChevronUp size={15} aria-hidden /> : <ChevronDown size={15} aria-hidden />}
      </button>

      {expanded ? <BriefingDetail card={card} briefing={briefing} /> : null}
    </article>
  );
}

function SourceReferenceList({ items }: { items: RadarNewsItem[] }) {
  const references = sourceReferenceItems(items);

  if (!references.length) {
    return (
      <div className="rounded-2xl border border-surface-line bg-surface-card/55 p-3 text-xs font-bold text-slate-500">
        확인된 원문 링크 없음
      </div>
    );
  }

  return (
    <details className="rounded-2xl border border-surface-line bg-surface-card/70 p-4">
      <summary className="cursor-pointer text-sm font-black text-white">참고 뉴스 원문 보기</summary>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {references.slice(0, 12).map((item) => {
          const style = directionBadge(item.direction);
          const sourceName = displayNewsSource(item.source) || sourceDomain(item.link);
          return (
            <article key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-slate-500">
                {sourceName ? <span>{sourceName}</span> : null}
                <span>{timeLabel(item.publishedAt)}</span>
                <span className={`rounded-md border px-1.5 py-0.5 ${style.badge}`}>{style.label}</span>
              </div>
              <a
                href={item.link}
                target="_blank"
                rel="noreferrer"
                className="mt-2 flex items-start justify-between gap-3 text-sm font-black leading-5 text-white transition hover:text-accent-blue [word-break:keep-all]"
              >
                <span className="line-clamp-3">{sourceReferenceTitle(item)}</span>
                <ExternalLink size={13} className="mt-1 shrink-0 text-accent-blue" aria-hidden />
              </a>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400 [word-break:keep-all]">{cleanDisplayText(item.summary)}</p>
            </article>
          );
        })}
      </div>
    </details>
  );
}

export function RadarNewsPanel({ market = "crypto", afterBriefing }: { market?: RadarNewsMarket; afterBriefing?: ReactNode } = {}) {
  const copy = marketCopy[market];
  const [payload, setPayload] = useState<NewsPayload | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState("");
  const [expandedCardId, setExpandedCardId] = useState<string>("");

  const fetchNewsPayload = useCallback(
    async () => {
      const response = await fetch(`/api/radar-news?market=${market}`, { cache: "no-store" });
      const data = (await response.json()) as NewsPayload;
      if (!response.ok) throw new Error(data.error ?? "뉴스 브리핑을 잠시 확인하지 못했습니다.");
      return data;
    },
    [market]
  );

  const loadNews = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const data = await fetchNewsPayload();
      setPayload(data);
      writeCachedNews(market, data);
      setStatus("ready");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "뉴스 브리핑을 잠시 확인하지 못했습니다.");
      setStatus("error");
    }
  }, [fetchNewsPayload, market]);

  useEffect(() => {
    const cached = readCachedNews(market);
    if (cached) {
      setPayload(cached);
      setStatus("ready");
    }
    setExpandedCardId("");
    void loadNews();
  }, [loadNews, market]);

  const digest = useMemo(() => {
    const items = payload?.items ?? [];
    return {
      bullish: items.filter((item) => item.direction === "bullish").length,
      bearish: items.filter((item) => item.direction === "bearish").length,
      neutral: items.filter((item) => item.direction === "neutral").length,
      urgent: items.filter((item) => item.urgency === "high").length
    };
  }, [payload]);

  const briefing = payload?.briefing;
  const cards = useMemo(() => buildBriefingCards(briefing, payload?.items ?? [], market), [briefing, market, payload?.items]);
  const isInitialLoading = status === "loading" && !payload;
  const hasBriefing = Boolean(briefing && (payload?.items ?? []).length > 0 && cards.length);

  return (
    <section className="space-y-5">
      <div className="news-radar-hero overflow-hidden rounded-2xl border border-accent-blue/20 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_32%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(2,6,23,0.96))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.32)] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent-blue/20 bg-accent-blue/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-accent-blue">
              <Sparkles size={13} aria-hidden />
              {copy.eyebrow}
            </div>
            <h2 className="mt-4 text-3xl font-black leading-9 text-white sm:text-4xl">{copy.title}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 [word-break:keep-all]">{copy.description}</p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <button
              type="button"
              onClick={loadNews}
              disabled={status === "loading"}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-accent-blue/30 bg-accent-blue/15 px-4 text-sm font-black text-accent-blue transition hover:border-accent-blue/50 hover:bg-accent-blue/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCcw className={status === "loading" ? "animate-spin" : ""} size={16} aria-hidden />
              다시 정리
            </button>
            <p className="text-[11px] font-bold text-slate-500">{payload?.cached ? "저장된 1시간 리포트" : refreshLabel(payload?.refreshIntervalMs)}</p>
          </div>
        </div>
      </div>

      {error ? <div className="rounded-xl border border-signal-danger/25 bg-signal-danger/10 p-3 text-sm font-bold text-signal-danger">{error}</div> : null}

      {isInitialLoading ? (
        <div className="rounded-2xl border border-accent-blue/20 bg-accent-blue/10 p-5 text-sm font-bold leading-6 text-accent-blue">
          브리핑 준비 중입니다. 공개 뉴스와 매크로 흐름을 읽어 시장 해석과 체크포인트를 정리하고 있습니다.
        </div>
      ) : null}

      <MarketRadarCard briefing={briefing} digest={digest} market={market} updatedAt={payload?.updatedAt} hasBriefing={hasBriefing} />

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-accent-blue">AI 브리핑</p>
            <h3 className="mt-1 text-xl font-black text-white">오늘의 AI 브리핑</h3>
          </div>
          <span className="hidden rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-[11px] font-bold text-slate-500 sm:inline-flex">
            {refreshLabel(payload?.refreshIntervalMs)}
          </span>
        </div>

        {cards.length ? (
          <div className="grid gap-3">
            {cards.map((card) => (
              <BriefingCardView
                key={card.id}
                card={card}
                briefing={briefing as RadarNewsBriefing}
                updatedAt={payload?.updatedAt}
                expanded={expandedCardId === card.id}
                onToggle={() => setExpandedCardId((current) => (current === card.id ? "" : card.id))}
              />
            ))}
          </div>
        ) : !isInitialLoading ? (
          <EmptyBriefingCard copy={copy} />
        ) : null}

        <SourceReferenceList items={payload?.items ?? []} />
      </section>

      {afterBriefing}

      <div className="rounded-2xl border border-accent-blue/20 bg-accent-blue/10 p-4">
        <div className="flex items-center gap-2">
          <ShieldAlert size={15} className="text-accent-blue" aria-hidden />
          <p className="text-sm font-black text-white">시장 해석 기준</p>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-300 [word-break:keep-all]">{copy.cadenceLine}</p>
      </div>

    </section>
  );
}
