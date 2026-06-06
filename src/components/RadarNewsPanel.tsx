"use client";
// 시장 뉴스 브리핑과 참고 뉴스 목록을 카드형 레이더로 보여주는 패널입니다.
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { ActionButton, AppSurface, MetricRow, PanelCard, SectionHeader, StatusPill } from "@/components/ui/DesignPrimitives";

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

const NEWS_CARD_LIMIT = 3;

const marketCopy = {
  crypto: {
    eyebrow: "시장 뉴스 리포트",
    title: "뉴스 레이더",
    marketLabel: "코인 시장",
    radarTitle: "오늘의 시장 레이더",
    directionLabel: "BTC 방향성",
    subMarketLabel: "알트코인 분위기",
    emptyState:
      "현재 코인 시장 전체를 흔들 만한 강한 공개 뉴스는 잡히지 않았습니다. 개별 알트·프로젝트 뉴스는 제외하고, BTC·ETH·ETF·금리·달러·규제·청산 흐름에 영향을 주는 뉴스가 잡히면 이곳에 표시됩니다."
  },
  stocks: {
    eyebrow: "글로벌 뉴스 리포트",
    title: "뉴스 레이더",
    marketLabel: "글로벌 시장",
    radarTitle: "오늘의 시장 레이더",
    directionLabel: "지수 방향성",
    subMarketLabel: "섹터 분위기",
    emptyState:
      "현재 글로벌 시장을 흔들 만한 강한 공개 뉴스는 잡히지 않았습니다. 개별 종목성 뉴스는 제외하고, 금리·물가·고용·달러·VIX·원자재·주요 지수에 영향을 주는 뉴스가 잡히면 이곳에 표시됩니다."
  }
} satisfies Record<
  RadarNewsMarket,
  {
    eyebrow: string;
    title: string;
    marketLabel: string;
    radarTitle: string;
    directionLabel: string;
    subMarketLabel: string;
    emptyState: string;
  }
>;

function newsCacheKey(market: RadarNewsMarket) {
  return `chart-radar.news.${market}.v17`;
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
    .replace(/[가-힣A-Za-z0-9,·ㆍ\s]{0,120}기사 묶음에서 확인되는 흐름입니다\.?/g, "")
    .replace(/상방 우호 \d+개,\s*하방 주의 \d+개,\s*중립 확인 \d+개로 정리됩니다\./g, "상승 재료와 하락 재료가 함께 정리됩니다.")
    .replace(/상방 \d+\s*[·ㆍ]\s*하방 \d+\s*[·ㆍ]\s*중립 \d+/g, "")
    .replace(/상방/g, "상승")
    .replace(/하방/g, "하락")
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

function updatedAtLabel(value: string | number | undefined) {
  if (!value) return "최근 갱신 확인 중";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "최근 갱신 확인 중";
  const label = new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
  return `최근 갱신 ${label}`;
}

function refreshIntervalLabel(value: number | undefined) {
  if (!value) return "";
  const minutes = Math.max(1, Math.round(value / 60_000));
  if (minutes === 60) return "1시간 단위 자동 갱신";
  if (minutes > 60 && minutes % 60 === 0) return `${minutes / 60}시간 단위 자동 갱신`;
  return `${minutes}분 단위 자동 갱신`;
}

function itemTitle(item: RadarNewsItem, market: RadarNewsMarket) {
  const title = item.displayTitle?.trim() || item.titleKo?.trim() || item.translatedTitle?.trim();
  if (title && /[가-힣]/.test(title)) return cleanDisplayText(title);
  return cleanDisplayText(fallbackKoreanNewsTitle(item.originalTitle ?? item.title, market));
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
  const candidates = [item.displayTitle, item.titleKo, item.translatedTitle, item.originalTitle, item.title].map((title) => cleanDisplayText(title)).filter(Boolean);
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
      label: "상승 재료",
      caption: "",
      icon: TrendingUp,
      badge: "border-signal-success/30 bg-signal-success/10 text-signal-success",
      panel: "border-signal-success/20 bg-signal-success/10"
    };
  }
  if (direction === "bearish") {
    return {
      label: "하락 재료",
      caption: "",
      icon: TrendingDown,
      badge: "border-signal-danger/30 bg-signal-danger/10 text-signal-danger",
      panel: "border-signal-danger/20 bg-signal-danger/10"
    };
  }
  return {
    label: "혼재 / 확인 필요",
    caption: "",
    icon: Target,
    badge: "border-signal-warning/30 bg-signal-warning/10 text-signal-warning",
    panel: "border-signal-warning/20 bg-signal-warning/10"
  };
}

function directionTone(direction: RadarNewsDirection): "long" | "short" | "watch" {
  if (direction === "bullish") return "long";
  if (direction === "bearish") return "short";
  return "watch";
}

function moodTone(mood: Mood): "long" | "short" | "watch" | "risk" {
  if (mood === "up") return "long";
  if (mood === "down") return "short";
  if (mood === "risk") return "risk";
  return "watch";
}

function moodCopy(mood: Mood) {
  if (mood === "up") {
    return {
      label: "상승 재료 우세",
      caption: "",
      icon: TrendingUp,
      badge: "border-signal-success/30 bg-signal-success/10 text-signal-success",
      panel: "border-signal-success/20 bg-signal-success/10",
      risk: "위험자산 심리 개선",
      chartTone: "상승 재료 우세",
      subTone: "선별 강세"
    };
  }
  if (mood === "down") {
    return {
      label: "하락 재료 주의",
      caption: "",
      icon: TrendingDown,
      badge: "border-signal-danger/30 bg-signal-danger/10 text-signal-danger",
      panel: "border-signal-danger/20 bg-signal-danger/10",
      risk: "위험자산 심리 약화",
      chartTone: "하락 압력 점검",
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
  if (next.length) return next.slice(0, 4);
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
    return issues.slice(0, NEWS_CARD_LIMIT).map((issue, index) => {
      const relatedItems = items.filter((item) => item.direction === issue.tone).slice(0, 2);
      return {
        id: `issue-${index}-${issue.tone}`,
        title: cleanDisplayText(issue.title, market === "stocks" ? "글로벌 시장 흐름 점검" : "코인 시장 흐름 점검"),
        tone: issue.tone,
        summary: sectionText(issue.detail, briefing.overview, 1),
        tags: mergeTags(relatedItems, [market === "stocks" ? "나스닥" : "BTC", "금리", "변동성"], market),
        issue,
        relatedItems
      };
    });
  }

  return items.slice(0, NEWS_CARD_LIMIT).map((item, index) => ({
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
      ? "글로벌 시장의 주요 뉴스 흐름을 확인하는 중입니다. 강한 공개 이슈가 잡히면 시장 해석과 체크포인트를 정리합니다."
      : "코인 시장의 주요 뉴스 흐름을 확인하는 중입니다. 강한 공개 이슈가 잡히면 시장 해석과 체크포인트를 정리합니다.";
  const overview = cleanDisplayText(briefing?.overview, fallback);
  if (mood === "pending") return fallback;
  return sectionText(overview, fallback, 1);
}

function compactCheckpoint(value: string | undefined, mood: Mood, market: RadarNewsMarket) {
  const text = cleanDisplayText(value);
  if (mood === "pending") return "새 뉴스 유입 대기";

  if (market === "stocks") {
    if (mood === "up") return "지수선물·섹터 반응 확인";
    if (mood === "down" || mood === "risk") return "금리·달러 부담 확인";
    return "지수선물·달러 방향 확인";
  }

  if (mood === "up") return "BTC·ETH 동반 반응 확인";
  if (mood === "down" || mood === "risk") return "BTC 지지선 이탈 확인";
  if (/거래량|volume/i.test(text)) return "거래량 동반 여부 확인";
  return "BTC·ETH 방향 확인";
}

function MarketRadarCard({
  briefing,
  digest,
  market,
  hasBriefing
}: {
  briefing?: RadarNewsBriefing;
  digest: { bullish: number; bearish: number; neutral: number; urgent: number };
  market: RadarNewsMarket;
  hasBriefing: boolean;
}) {
  const mood = inferMood(digest, hasBriefing);
  const moodStyle = moodCopy(mood);
  const MoodIcon = moodStyle.icon;
  const copy = marketCopy[market];
  const summary = leadSummary(briefing, mood, market);
  const checkpoint = compactCheckpoint(
    briefing?.strategyNotes?.[0],
    mood,
    market
  );

  return (
    <PanelCard variant="report" className="space-y-4">
      <SectionHeader
        eyebrow={copy.radarTitle}
        title={moodStyle.risk}
        description={summary}
        action={
          <StatusPill tone={moodTone(mood)} icon={MoodIcon}>
            {moodStyle.label}
          </StatusPill>
        }
      />

      <div className="grid gap-x-5 sm:grid-cols-2">
        <MetricRow label="위험자산 심리" value={moodStyle.risk} />
        <MetricRow label={copy.directionLabel} value={moodStyle.chartTone} />
        <MetricRow label={copy.subMarketLabel} value={moodStyle.subTone} />
      </div>

      <AppSurface tone="inset" variant="flat" padding="none" className="border-t border-ui-line pt-3">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div className="flex items-center gap-2">
            <ListChecks size={15} className="shrink-0 text-ui-brand" aria-hidden />
            <p className="text-sm font-semibold text-ui-muted">다음 확인</p>
          </div>
          <p className="text-sm font-semibold leading-5 text-ui-text [word-break:keep-all]">{checkpoint}</p>
        </div>
      </AppSurface>
    </PanelCard>
  );
}

function EmptyBriefingCard({ copy }: { copy: (typeof marketCopy)[RadarNewsMarket] }) {
  return (
    <PanelCard variant="report">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-ui-sm border border-ui-line bg-ui-inset text-ui-brand">
          <Clock3 size={18} aria-hidden />
        </div>
        <div>
          <h3 className="text-base font-semibold text-ui-text">리포트 준비 중</h3>
          <p className="mt-2 text-sm leading-6 text-ui-muted [word-break:keep-all]">{copy.emptyState}</p>
        </div>
      </div>
    </PanelCard>
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
    <AppSurface tone="inset" variant="flat" padding="none" className="mt-3 space-y-4 border-t border-ui-line pt-3">
      <section>
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-ui-brand" aria-hidden />
          <h4 className="text-sm font-semibold text-ui-text">핵심 요약</h4>
        </div>
        <p className="mt-2 text-sm leading-6 text-ui-muted [word-break:keep-all]">{keySummary}</p>
      </section>

      <section className="border-t border-ui-line pt-4">
        <div className="flex items-center gap-2">
          <Activity size={15} className="text-ui-brand" aria-hidden />
          <h4 className="text-sm font-semibold text-ui-text">시장 현황</h4>
        </div>
        <p className="mt-2 text-sm leading-6 text-ui-muted [word-break:keep-all]">{marketStatus}</p>
      </section>

      <section className="border-t border-ui-line pt-4">
        <div className="flex items-center gap-2">
          <Newspaper size={15} className="text-ui-brand" aria-hidden />
          <h4 className="text-sm font-semibold text-ui-text">주요 이슈</h4>
        </div>
        <p className="mt-2 text-sm leading-6 text-ui-muted [word-break:keep-all]">
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
                className="flex items-start justify-between gap-3 border-t border-ui-line py-2 text-xs leading-5 text-ui-muted transition first:border-t-0 first:pt-0 hover:text-ui-text"
              >
                <span className="[word-break:keep-all]">{sourceReferenceTitle(item)}</span>
                <ExternalLink size={12} className="mt-1 shrink-0 text-ui-brand" aria-hidden />
              </a>
            ))}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 border-t border-ui-line pt-4 md:grid-cols-2">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 size={15} className="text-ui-brand" aria-hidden />
            <h4 className="text-sm font-semibold text-ui-text">차트레이더 해석</h4>
          </div>
          <ul className="mt-2 space-y-2">
            {(marketImpact.length ? marketImpact : [keySummary]).slice(0, 3).map((item) => (
              <li key={item} className="flex gap-2 text-sm leading-6 text-ui-muted [word-break:keep-all]">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ui-brand" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <Target size={15} className="text-ui-risk" aria-hidden />
            <h4 className="text-sm font-semibold text-ui-text">오늘 체크할 포인트</h4>
          </div>
          <ul className="mt-2 space-y-2">
            {checkpoints.slice(0, 3).map((item) => (
              <li key={item} className="flex gap-2 text-sm leading-6 text-ui-muted [word-break:keep-all]">
                <CheckCircle2 size={14} className="mt-1 shrink-0 text-ui-risk" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-ui-line pt-4">
        <div className="flex items-center gap-2">
          <Compass size={15} className="text-ui-brand" aria-hidden />
          <h4 className="text-sm font-semibold text-ui-text">요약</h4>
        </div>
        <p className="mt-2 text-sm font-semibold leading-6 text-ui-text [word-break:keep-all]">
          {finalSummary}
        </p>
      </section>
    </AppSurface>
  );
}

function BriefingCardView({
  card,
  briefing,
  expanded,
  onToggle
}: {
  card: BriefingCard;
  briefing: RadarNewsBriefing;
  expanded: boolean;
  onToggle: () => void;
}) {
  const style = directionBadge(card.tone);
  const Icon = style.icon;

  return (
    <PanelCard variant="flat" padding="none" className="space-y-2.5 border-t border-ui-line py-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone={directionTone(card.tone)} icon={Icon}>
          {style.label}
        </StatusPill>
      </div>

      <h3 className="text-base font-semibold leading-6 text-ui-text [word-break:keep-all] sm:text-lg">{card.title}</h3>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {card.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="rounded-ui-sm border border-ui-line bg-ui-inset px-2 py-1 text-[11px] font-semibold text-ui-muted">
              {tag}
            </span>
          ))}
        </div>

        <ActionButton tone={expanded ? "ghost" : "secondary"} onClick={onToggle} aria-expanded={expanded} className="w-fit">
          {expanded ? "접기" : "내용 보기"}
          {expanded ? <ChevronUp size={15} aria-hidden /> : <ChevronDown size={15} aria-hidden />}
        </ActionButton>
      </div>

      {expanded ? <BriefingDetail card={card} briefing={briefing} /> : null}
    </PanelCard>
  );
}

function SourceReferenceList({ items }: { items: RadarNewsItem[] }) {
  const references = sourceReferenceItems(items);

  if (!references.length) {
    return (
      <AppSurface tone="inset" variant="flat" padding="none" className="text-xs font-semibold text-ui-muted">
        확인된 원문 링크 없음
      </AppSurface>
    );
  }

  return (
    <AppSurface as="details" tone="panel" variant="list" padding="md" className="border-t border-ui-line">
      <summary className="cursor-pointer text-sm font-semibold text-ui-text">참고 뉴스 원문 보기</summary>
      <div className="mt-3 grid gap-2">
        {references.slice(0, 12).map((item) => {
          const style = directionBadge(item.direction);
          const sourceName = displayNewsSource(item.source) || sourceDomain(item.link);
          const title = sourceReferenceTitle(item);
          return (
            <article key={item.id} className="border-t border-ui-line pt-3 first:border-t-0 first:pt-0">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-ui-subtle">
                {sourceName ? <span>{sourceName}</span> : null}
                <span>{timeLabel(item.publishedAt)}</span>
                <StatusPill tone={directionTone(item.direction)} className="min-h-5 px-1.5 py-0 text-[10px]">
                  {style.label}
                </StatusPill>
              </div>
              <a
                href={item.link}
                target="_blank"
                rel="noreferrer"
                className="mt-2 flex items-start justify-between gap-3 text-sm font-semibold leading-5 text-ui-text transition hover:text-ui-brand [word-break:keep-all]"
              >
                <span className="line-clamp-2">{title}</span>
                <ExternalLink size={13} className="mt-1 shrink-0 text-ui-brand" aria-hidden />
              </a>
              {item.originalTitle && item.originalTitle !== title ? (
                <p className="mt-1 line-clamp-1 text-[11px] leading-4 text-ui-subtle [word-break:break-word]">원문: {item.originalTitle}</p>
              ) : null}
            </article>
          );
        })}
      </div>
    </AppSurface>
  );
}

export function RadarNewsPanel({ market = "crypto" }: { market?: RadarNewsMarket } = {}) {
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
  const refreshLabel = refreshIntervalLabel(payload?.refreshIntervalMs);

  return (
    <section className="space-y-4">
      <PanelCard variant="report" padding="none" className="border-b border-ui-line pb-3">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-ui-label font-semibold uppercase tracking-[0.12em] text-ui-subtle">{copy.eyebrow}</p>
            <h2 className="text-ui-heading font-semibold tracking-tight text-ui-text">{copy.title}</h2>
            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px] font-semibold text-ui-muted">
              <span>{updatedAtLabel(payload?.updatedAt)}</span>
              {refreshLabel ? <span>{refreshLabel}</span> : null}
            </div>
          </div>
          <ActionButton tone="secondary" onClick={loadNews} disabled={status === "loading"} className="shrink-0 px-2 sm:px-3">
            <RefreshCcw className={status === "loading" ? "animate-spin" : ""} size={16} aria-hidden />
            다시 정리
          </ActionButton>
        </div>
      </PanelCard>

      {error ? (
        <AppSurface variant="flat" tone="critical" padding="none" className="border-t border-rose-400/24 py-3 text-sm font-semibold text-ui-short shadow-none">
          {error}
        </AppSurface>
      ) : null}

      {isInitialLoading ? (
        <AppSurface variant="flat" tone="inset" padding="none" className="border-t border-ui-line py-3 text-sm font-semibold leading-6 text-ui-brand shadow-none">
          리포트 준비 중입니다. 공개 뉴스를 읽어 시장 해석과 체크포인트를 정리하고 있습니다.
        </AppSurface>
      ) : null}

      <MarketRadarCard briefing={briefing} digest={digest} market={market} hasBriefing={hasBriefing} />

      <section className="space-y-3">
        <SectionHeader
          eyebrow="뉴스 브리핑"
          title="오늘 볼 뉴스"
        />

        {cards.length ? (
          <div className="grid gap-3">
            {cards.map((card) => (
              <BriefingCardView
                key={card.id}
                card={card}
                briefing={briefing as RadarNewsBriefing}
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
    </section>
  );
}
