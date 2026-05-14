"use client";
// 시장 뉴스 브리핑과 참고 뉴스 목록을 보여주는 패널입니다.
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ExternalLink, Newspaper, Radar, RefreshCcw, Sparkles, Target, TrendingDown, TrendingUp } from "lucide-react";
import {
  displayNewsSource,
  fallbackKoreanNewsTitle,
  localizeNewsSourceText,
  type RadarNewsBriefing,
  type RadarNewsDirection,
  type RadarNewsItem
} from "@/lib/radarNews";
import { getUsageGate, recordUsageEvent } from "@/lib/usageMeter";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";
import { hasMarketEntitlement } from "@/lib/billing";

type NewsPayload = {
  updatedAt: number;
  briefing: RadarNewsBriefing;
  items: RadarNewsItem[];
  failedSources: string[];
  cached: boolean;
  error?: string;
};

type RadarNewsMarket = "crypto" | "stocks";

const marketCopy = {
  crypto: {
    eyebrow: "코인 뉴스 레이더",
    title: "코인 레이더 뉴스",
    description: "코인 시장 주요 이슈를 한국어로 정리하고, 시장 영향과 오늘 확인할 포인트를 빠르게 짚어줍니다.",
    summaryTitle: "오늘의 코인 뉴스 브리핑",
    proLine: "Pro에서는 뉴스 영향, 전략 포인트, 반복 브리핑을 더 넓게 확인할 수 있습니다.",
    proBenefits: ["장중 반복 브리핑", "시장 영향 3줄 요약", "전략 판단 포인트"]
  },
  stocks: {
    eyebrow: "글로벌 뉴스 레이더",
    title: "글로벌 레이더 뉴스",
    description: "미국주식, ETF, 금리, 실적, 매크로 이슈를 한국어로 정리하고 시장 영향까지 함께 짚어줍니다.",
    summaryTitle: "오늘의 글로벌 뉴스 브리핑",
    proLine: "Global Pro에서는 매크로와 미국장 이슈를 장중 반복해서 정리할 수 있습니다.",
    proBenefits: ["매크로 영향 정리", "미국장 이슈 반복 갱신", "관심 종목 연결"]
  }
} satisfies Record<RadarNewsMarket, { eyebrow: string; title: string; description: string; summaryTitle: string; proLine: string; proBenefits: string[] }>;

function newsCacheKey(market: RadarNewsMarket) {
  return `chart-radar.news.${market}.v6`;
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

function directionStyle(direction: RadarNewsDirection) {
  if (direction === "bullish") {
    return {
      label: "상방 우호",
      icon: TrendingUp,
      text: "text-signal-success",
      bg: "border-signal-success/25 bg-signal-success/10",
      pill: "border-signal-success/25 bg-signal-success/15 text-signal-success"
    };
  }

  if (direction === "bearish") {
    return {
      label: "하방 주의",
      icon: TrendingDown,
      text: "text-signal-danger",
      bg: "border-signal-danger/25 bg-signal-danger/10",
      pill: "border-signal-danger/25 bg-signal-danger/15 text-signal-danger"
    };
  }

  return {
    label: "중립 확인",
    icon: Target,
    text: "text-signal-warning",
    bg: "border-signal-warning/25 bg-signal-warning/10",
    pill: "border-signal-warning/25 bg-signal-warning/15 text-signal-warning"
  };
}

function timeLabel(value: string | number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "시간 확인 필요";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function hasKoreanText(value: string) {
  return /[가-힣]/.test(value);
}

function itemTitle(item: RadarNewsItem, market: RadarNewsMarket) {
  const title = item.translatedTitle?.trim();
  if (title && hasKoreanText(title)) return title;
  return fallbackKoreanNewsTitle(item.title, market);
}

function NewsSourceCard({ item, market }: { item: RadarNewsItem; market: RadarNewsMarket }) {
  const style = directionStyle(item.direction);
  const Icon = style.icon;

  return (
    <article className="rounded-md border border-surface-line bg-surface-cardSoft p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-slate-500">
            <span>{displayNewsSource(item.source)}</span>
            <span>{timeLabel(item.publishedAt)}</span>
            <span className={`rounded border px-1.5 py-0.5 ${style.pill}`}>{style.label}</span>
          </div>
          <h4 className="mt-2 line-clamp-2 text-sm font-black leading-5 text-white [word-break:keep-all]">{itemTitle(item, market)}</h4>
        </div>
        <Icon className={`mt-1 shrink-0 ${style.text}`} size={17} aria-hidden />
      </div>

      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400 [word-break:keep-all]">{item.summary}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {item.assets.slice(0, 3).map((asset) => (
          <span key={asset} className="rounded border border-accent-blue/20 bg-accent-blue/10 px-1.5 py-0.5 text-[10px] font-black text-accent-blue">
            {asset}
          </span>
        ))}
        {item.tags.slice(0, 2).map((tag) => (
          <span key={tag} className="rounded border border-white/10 bg-black/20 px-1.5 py-0.5 text-[10px] font-bold text-slate-400">
            {tag}
          </span>
        ))}
      </div>

      <a href={item.link} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-[11px] font-black text-accent-blue hover:text-sky-300">
        원문 확인
        <ExternalLink size={12} aria-hidden />
      </a>
    </article>
  );
}

function BriefingIssueCard({ issue }: { issue: RadarNewsBriefing["keyIssues"][number] }) {
  const style = directionStyle(issue.tone);
  const Icon = style.icon;

  return (
    <div className={`rounded-md border p-3 ${style.bg}`}>
      <div className="flex items-start gap-2">
        <Icon className={`mt-0.5 shrink-0 ${style.text}`} size={17} aria-hidden />
        <div>
          <p className={`text-[11px] font-black ${style.text}`}>{style.label}</p>
          <h4 className="mt-1 text-sm font-black leading-5 text-white [word-break:keep-all]">{issue.title}</h4>
          <p className="mt-2 text-xs leading-5 text-slate-300 [word-break:keep-all]">{localizeNewsSourceText(issue.detail)}</p>
        </div>
      </div>
    </div>
  );
}

function BulletList({ items, tone = "blue" }: { items: string[]; tone?: "blue" | "yellow" }) {
  const dotClass = tone === "yellow" ? "bg-signal-warning" : "bg-accent-blue";

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2 text-sm leading-6 text-slate-300 [word-break:keep-all]">
          <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function RadarNewsPanel({ market = "crypto" }: { market?: RadarNewsMarket } = {}) {
  const copy = marketCopy[market];
  const { profile } = useSupabaseAuth();
  const isPaid = hasMarketEntitlement(profile?.plan, market);
  const usageBucketId = market === "stocks" ? "stocksAiBriefing" : "cryptoAiBriefing";
  const [payload, setPayload] = useState<NewsPayload | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState("");
  const [limitNotice, setLimitNotice] = useState("");

  const fetchNewsPayload = useCallback(
    async (mode: "full" | "preview") => {
      const url = mode === "preview" ? `/api/radar-news?market=${market}&briefing=0` : `/api/radar-news?market=${market}`;
      const response = await fetch(url, { cache: "no-store" });
      const data = (await response.json()) as NewsPayload;
      if (!response.ok) throw new Error(data.error ?? "레이더 뉴스를 불러오지 못했습니다.");
      return data;
    },
    [market]
  );

  const loadNews = useCallback(async () => {
    const usageGate = getUsageGate(usageBucketId, isPaid);
    if (!usageGate.allowed) {
      const cached = readCachedNews(market);
      if (cached) {
        setPayload(cached);
        setStatus("ready");
        setError("");
        setLimitNotice(`${usageGate.message} 지금은 마지막 참고 뉴스와 간단 요약을 먼저 보여줍니다.`);
        return;
      }

      setStatus("loading");
      setError("");
      try {
        const preview = await fetchNewsPayload("preview");
        setPayload(preview);
        setStatus("ready");
        setLimitNotice(`${usageGate.message} 지금은 심층 영향 분석 대신 오늘 참고할 뉴스 제목과 간단 요약을 먼저 보여줍니다.`);
      } catch {
        setStatus("error");
        setError(`${usageGate.message} 내일 다시 확인하거나 Pro에서 반복 브리핑을 열 수 있습니다.`);
      }
      return;
    }

    setStatus("loading");
    setError("");
    setLimitNotice("");
    try {
      const data = await fetchNewsPayload("full");
      setPayload(data);
      writeCachedNews(market, data);
      setStatus("ready");
      recordUsageEvent(usageBucketId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "레이더 뉴스를 불러오지 못했습니다.");
      setStatus("error");
    }
  }, [fetchNewsPayload, isPaid, market, usageBucketId]);

  useEffect(() => {
    const cached = readCachedNews(market);
    if (cached) {
      setPayload(cached);
      setStatus("ready");
    }
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
  const showFullBriefing = Boolean(briefing && !limitNotice);
  const isInitialLoading = status === "loading" && !payload;
  const leadingTone = digest.bullish > digest.bearish ? "상방 우호" : digest.bearish > digest.bullish ? "하방 주의" : "중립 확인";
  const leadingToneClass =
    digest.bullish > digest.bearish ? "text-signal-success" : digest.bearish > digest.bullish ? "text-signal-danger" : "text-signal-warning";
  const topIssue = briefing?.keyIssues[0];

  return (
    <section className="space-y-5">
      <div className="force-dark-card rounded-lg border border-accent-blue/25 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.18),rgba(15,23,42,0.94)_42%,rgba(2,6,23,0.96))] p-4 shadow-glow sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="radar-mark grid h-11 w-11 shrink-0 place-items-center border border-accent-blue/35 text-accent-blue">
              <Newspaper size={21} aria-hidden />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-accent-blue">{copy.eyebrow}</p>
              <h2 className="mt-1 text-xl font-black text-white">{copy.title}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400 [word-break:keep-all]">{copy.description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadNews}
            disabled={status === "loading"}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-accent-blue/30 bg-accent-blue/10 px-3 text-sm font-black text-accent-blue hover:bg-accent-blue/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCcw className={status === "loading" ? "animate-spin" : ""} size={16} aria-hidden />
            다시 분석
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-signal-success/20 bg-signal-success/10 p-3">
            <p className="text-2xl font-black text-signal-success">{isInitialLoading ? "…" : digest.bullish}</p>
            <p className="text-xs font-bold text-slate-400">상방 우호</p>
          </div>
          <div className="rounded-lg border border-signal-danger/20 bg-signal-danger/10 p-3">
            <p className="text-2xl font-black text-signal-danger">{isInitialLoading ? "…" : digest.bearish}</p>
            <p className="text-xs font-bold text-slate-400">하방 주의</p>
          </div>
          <div className="rounded-lg border border-signal-warning/20 bg-signal-warning/10 p-3">
            <p className="text-2xl font-black text-signal-warning">{isInitialLoading ? "…" : digest.neutral}</p>
            <p className="text-xs font-bold text-slate-400">중립 확인</p>
          </div>
          <div className="rounded-lg border border-accent-blue/20 bg-accent-blue/10 p-3">
            <p className="text-2xl font-black text-accent-blue">{isInitialLoading ? "…" : digest.urgent}</p>
            <p className="text-xs font-bold text-slate-400">중요 이슈</p>
          </div>
        </div>

        {briefing || isInitialLoading ? (
          <div className="mt-4 grid gap-2 lg:grid-cols-3">
            <div className="rounded-md border border-white/10 bg-black/25 p-3">
              <p className="text-[11px] font-bold text-slate-500">뉴스 방향</p>
              <p className={`mt-1 text-lg font-black ${isInitialLoading ? "text-slate-300" : leadingToneClass}`}>{isInitialLoading ? "수집 중" : leadingTone}</p>
            </div>
            <div className="rounded-md border border-white/10 bg-black/25 p-3 lg:col-span-2">
              <p className="text-[11px] font-bold text-slate-500">먼저 볼 이슈</p>
              <p className="mt-1 line-clamp-2 text-sm font-black leading-5 text-white [word-break:keep-all]">
                {isInitialLoading ? "공개 뉴스와 매크로 이슈를 수집하고 있습니다." : topIssue?.title ?? "뉴스를 불러오면 핵심 이슈를 먼저 정리합니다."}
              </p>
            </div>
          </div>
        ) : null}

        {!isPaid ? (
          <div className="mt-4 rounded-md border border-accent-blue/20 bg-black/25 p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-black text-accent-blue">Pro에서 열리는 뉴스 레이더</p>
                <p className="mt-1 text-sm leading-6 text-slate-300 [word-break:keep-all]">{copy.proLine}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {copy.proBenefits.map((benefit) => (
                  <span key={benefit} className="rounded border border-accent-blue/20 bg-accent-blue/10 px-2 py-1 text-[11px] font-black text-accent-blue">
                    {benefit}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {status === "loading" && !briefing ? (
        <div className="rounded-lg border border-surface-line bg-surface-card p-6 text-center">
          <Radar className="mx-auto animate-spin text-accent-blue" size={34} aria-hidden />
          <p className="mt-3 text-sm font-black text-white">뉴스 레이더가 주요 이슈를 정리하고 있습니다.</p>
          <p className="mt-1 text-xs text-slate-500">브리핑이 늦으면 간단 요약을 먼저 보여드립니다.</p>
        </div>
      ) : null}

      {status === "error" ? (
        <div className="rounded-lg border border-signal-danger/25 bg-signal-danger/10 p-4 text-sm leading-6 text-signal-danger">
          <div className="flex items-center gap-2 font-black">
            <AlertTriangle size={17} aria-hidden />
            {error}
          </div>
        </div>
      ) : null}

      {limitNotice ? (
        <div className="rounded-lg border border-accent-blue/35 bg-white p-4 text-sm leading-6 text-slate-950 shadow-[0_14px_40px_rgba(14,165,233,0.12)]">
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 shrink-0 text-accent-blue" size={17} aria-hidden />
            <div>
              <p className="font-black text-slate-950">오늘은 주요 뉴스 먼저 보여드립니다.</p>
              <p className="mt-1 font-semibold text-slate-800">{limitNotice}</p>
              <p className="mt-2 text-xs font-bold text-slate-700">{copy.proLine}</p>
            </div>
          </div>
        </div>
      ) : null}

      {briefing && limitNotice ? (
        <div className="rounded-lg border border-accent-blue/20 bg-surface-card p-4 shadow-glow sm:p-5">
          <div className="inline-flex items-center gap-2 rounded-md border border-accent-blue/20 bg-accent-blue/10 px-2 py-1 text-[11px] font-black text-accent-blue">
            <Sparkles size={13} aria-hidden />
            간단 요약
          </div>
          <h3 className="mt-3 text-xl font-black text-white">오늘은 참고 뉴스 중심으로 정리합니다.</h3>
          <p className="mt-3 text-sm leading-7 text-slate-300 [word-break:keep-all]">{briefing.overview}</p>
          <p className="mt-4 rounded-md border border-accent-blue/20 bg-accent-blue/10 px-3 py-2 text-xs font-bold leading-5 text-accent-blue">
            Pro에서는 핵심 이슈, 시장 영향, 전략 노트, 반복 갱신 브리핑까지 열립니다.
          </p>
        </div>
      ) : null}

      {briefing && showFullBriefing ? (
        <>
          <div className="rounded-lg border border-accent-blue/25 bg-surface-card p-4 shadow-glow sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-md border border-accent-blue/20 bg-accent-blue/10 px-2 py-1 text-[11px] font-black text-accent-blue">
                  <Sparkles size={13} aria-hidden />
                  레이더 종합 브리핑
                </div>
                <h3 className="mt-3 text-2xl font-black text-white">{copy.summaryTitle}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300 [word-break:keep-all]">{briefing.overview}</p>
              </div>
              <p className="shrink-0 text-xs font-bold text-slate-500">{timeLabel(briefing.generatedAt)}</p>
            </div>
          </div>

          <div className="rounded-lg border border-surface-line bg-surface-card p-4 shadow-glow sm:p-5">
            <h3 className="text-lg font-black text-white">주요 이슈</h3>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {briefing.keyIssues.map((issue) => (
                <BriefingIssueCard key={`${issue.title}-${issue.tone}`} issue={issue} />
              ))}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-lg border border-surface-line bg-surface-card p-4 shadow-glow sm:p-5">
              <h3 className="text-lg font-black text-white">시장 영향</h3>
              <div className="mt-3">
                <BulletList items={briefing.marketImpact.map(localizeNewsSourceText)} />
              </div>
            </div>
            <div className="rounded-lg border border-surface-line bg-surface-card p-4 shadow-glow sm:p-5">
              <h3 className="text-lg font-black text-white">투자 판단 포인트</h3>
              <div className="mt-3">
                <BulletList items={briefing.strategyNotes.map(localizeNewsSourceText)} tone="yellow" />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-surface-line bg-surface-card p-4 shadow-glow sm:p-5">
            <h3 className="text-lg font-black text-white">마지막 정리</h3>
            <p className="mt-3 text-sm leading-7 text-slate-300 [word-break:keep-all]">{localizeNewsSourceText(briefing.finalSummary)}</p>
          </div>
        </>
      ) : null}

      {payload?.items.length ? (
        <div className="rounded-lg border border-surface-line bg-surface-card p-4 shadow-glow sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-white">참고 뉴스</h3>
              <p className="mt-1 text-xs text-slate-500">원문은 확인 링크로 남기고, 화면에는 한국어 제목과 해석만 우선 표시합니다.</p>
            </div>
            <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-xs font-black text-slate-400">{payload.items.length}개 수집</span>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {payload.items.slice(0, limitNotice ? 9 : 12).map((item) => (
              <NewsSourceCard key={item.id} item={item} market={market} />
            ))}
          </div>
        </div>
      ) : null}

      {payload?.failedSources.length ? (
        <p className="rounded-md border border-signal-warning/20 bg-signal-warning/10 px-3 py-2 text-xs leading-5 text-signal-warning">
          일부 참고 뉴스가 아직 늦게 들어오고 있습니다. 잠시 뒤 다시 새로고침하면 {payload.failedSources.map(displayNewsSource).join(", ")} 쪽 자료도 함께 확인할 수 있습니다.
        </p>
      ) : null}
    </section>
  );
}
