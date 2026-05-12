"use client";
// 레이더뉴스 브리핑과 참고 뉴스 목록을 보여주는 패널.
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ExternalLink, Newspaper, Radar, RefreshCcw, ShieldAlert, Sparkles, Target, TrendingDown, TrendingUp } from "lucide-react";
import type { RadarNewsBriefing, RadarNewsDirection, RadarNewsItem } from "@/lib/radarNews";
import { recordUsageEvent } from "@/lib/usageMeter";

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
    eyebrow: "Coin Radar News",
    title: "코인 레이더뉴스",
    description: "코인 시장 주요 뉴스와 공개 이슈를 모아 시장 영향, 위험 요인, 오늘 확인할 포인트를 한국어로 정리합니다.",
    summaryTitle: "오늘의 코인 이슈 요약"
  },
  stocks: {
    eyebrow: "Global Radar News",
    title: "글로벌 레이더뉴스",
    description: "미국주식, ETF, 금리, 실적, 지수, 원자재 이슈를 중심으로 시장 영향과 오늘 확인할 포인트를 한국어로 정리합니다.",
    summaryTitle: "오늘의 글로벌 이슈 요약"
  }
} satisfies Record<RadarNewsMarket, { eyebrow: string; title: string; description: string; summaryTitle: string }>;

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

function itemTitle(item: RadarNewsItem) {
  return item.translatedTitle ?? item.title;
}

function NewsSourceCard({ item }: { item: RadarNewsItem }) {
  const style = directionStyle(item.direction);
  const Icon = style.icon;

  return (
    <article className="rounded-md border border-surface-line bg-surface-cardSoft p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-slate-500">
            <span>{item.source}</span>
            <span>{timeLabel(item.publishedAt)}</span>
            <span className={`rounded border px-1.5 py-0.5 ${style.pill}`}>{style.label}</span>
          </div>
          <h4 className="mt-2 line-clamp-2 text-sm font-black leading-5 text-white [word-break:keep-all]">{itemTitle(item)}</h4>
          {item.translatedTitle ? <p className="mt-1 line-clamp-1 text-[11px] text-slate-600">{item.title}</p> : null}
        </div>
        <Icon className={`mt-1 shrink-0 ${style.text}`} size={17} aria-hidden />
      </div>
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
      <a
        href={item.link}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex items-center gap-1 text-[11px] font-black text-accent-blue hover:text-sky-300"
      >
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
          <p className="mt-2 text-xs leading-5 text-slate-300 [word-break:keep-all]">{issue.detail}</p>
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
  const [payload, setPayload] = useState<NewsPayload | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState("");

  const loadNews = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const response = await fetch(`/api/radar-news?market=${market}`, { cache: "no-store" });
      const data = (await response.json()) as NewsPayload;
      if (!response.ok) throw new Error(data.error ?? "레이더뉴스를 불러오지 못했습니다.");
      setPayload(data);
      setStatus("ready");
      recordUsageEvent("aiBriefing");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "레이더뉴스를 불러오지 못했습니다.");
      setStatus("error");
    }
  }, [market]);

  useEffect(() => {
    void loadNews();
  }, [loadNews]);

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
  const isInitialLoading = status === "loading" && !payload;
  const leadingTone =
    digest.bullish > digest.bearish ? "상방 우호" : digest.bearish > digest.bullish ? "하방 주의" : "중립 확인";
  const leadingToneClass =
    digest.bullish > digest.bearish
      ? "text-signal-success"
      : digest.bearish > digest.bullish
        ? "text-signal-danger"
        : "text-signal-warning";
  const topIssue = briefing?.keyIssues[0];

  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-accent-blue/25 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.18),rgba(15,23,42,0.94)_42%,rgba(2,6,23,0.96))] p-4 shadow-glow sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="radar-mark grid h-11 w-11 shrink-0 place-items-center border border-accent-blue/35 text-accent-blue">
              <Newspaper size={21} aria-hidden />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-accent-blue">{copy.eyebrow}</p>
              <h2 className="mt-1 text-xl font-black text-white">{copy.title}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400 [word-break:keep-all]">
                {copy.description}
              </p>
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
            <p className={isInitialLoading ? "text-base font-black text-signal-success" : "text-2xl font-black text-signal-success"}>
              {isInitialLoading ? "확인 중" : digest.bullish}
            </p>
            <p className="text-xs font-bold text-slate-400">상방 우호</p>
          </div>
          <div className="rounded-lg border border-signal-danger/20 bg-signal-danger/10 p-3">
            <p className={isInitialLoading ? "text-base font-black text-signal-danger" : "text-2xl font-black text-signal-danger"}>
              {isInitialLoading ? "확인 중" : digest.bearish}
            </p>
            <p className="text-xs font-bold text-slate-400">하방 주의</p>
          </div>
          <div className="rounded-lg border border-signal-warning/20 bg-signal-warning/10 p-3">
            <p className={isInitialLoading ? "text-base font-black text-signal-warning" : "text-2xl font-black text-signal-warning"}>
              {isInitialLoading ? "확인 중" : digest.neutral}
            </p>
            <p className="text-xs font-bold text-slate-400">중립 확인</p>
          </div>
          <div className="rounded-lg border border-accent-blue/20 bg-accent-blue/10 p-3">
            <p className={isInitialLoading ? "text-base font-black text-accent-blue" : "text-2xl font-black text-accent-blue"}>
              {isInitialLoading ? "확인 중" : digest.urgent}
            </p>
            <p className="text-xs font-bold text-slate-400">중요 이슈</p>
          </div>
        </div>

        {briefing || isInitialLoading ? (
          <div className="mt-4 grid gap-2 lg:grid-cols-3">
            <div className="rounded-md border border-white/10 bg-black/25 p-3">
              <p className="text-[11px] font-bold text-slate-500">뉴스 톤</p>
              <p className={`mt-1 text-lg font-black ${isInitialLoading ? "text-slate-300" : leadingToneClass}`}>
                {isInitialLoading ? "수집 중" : leadingTone}
              </p>
            </div>
            <div className="rounded-md border border-white/10 bg-black/25 p-3 lg:col-span-2">
              <p className="text-[11px] font-bold text-slate-500">먼저 볼 이슈</p>
              <p className="mt-1 line-clamp-2 text-sm font-black leading-5 text-white [word-break:keep-all]">
                {isInitialLoading ? "공개 뉴스와 매크로 이슈를 수집하고 있습니다." : topIssue?.title ?? "뉴스를 불러오면 핵심 이슈를 먼저 정리합니다."}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {status === "loading" && !briefing ? (
        <div className="rounded-lg border border-surface-line bg-surface-card p-6 text-center">
          <Radar className="mx-auto animate-spin text-accent-blue" size={34} aria-hidden />
          <p className="mt-3 text-sm font-black text-white">뉴스 레이더가 주요 이슈를 정리하고 있습니다.</p>
          <p className="mt-1 text-xs text-slate-500">AI 응답이 늦으면 규칙 기반 요약으로 먼저 보여드립니다.</p>
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

      {briefing ? (
        <>
          <div className="rounded-lg border border-accent-blue/25 bg-surface-card p-4 shadow-glow sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-md border border-accent-blue/20 bg-accent-blue/10 px-2 py-1 text-[11px] font-black text-accent-blue">
                  <Sparkles size={13} aria-hidden />
                  {briefing.model === "rules" ? "규칙 기반 브리핑" : "AI 종합 브리핑"}
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
              <h3 className="flex items-center gap-2 text-lg font-black text-white">
                <Target className="text-accent-blue" size={19} aria-hidden />
                시장에 미칠 수 있는 영향
              </h3>
              <div className="mt-3">
                <BulletList items={briefing.marketImpact} />
              </div>
            </div>
            <div className="rounded-lg border border-surface-line bg-surface-card p-4 shadow-glow sm:p-5">
              <h3 className="flex items-center gap-2 text-lg font-black text-white">
                <ShieldAlert className="text-signal-warning" size={19} aria-hidden />
                투자 판단 포인트
              </h3>
              <div className="mt-3">
                <BulletList items={briefing.strategyNotes} tone="yellow" />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-black/25 p-4 text-sm leading-6 text-slate-300">
            <p className="font-black text-white">마지막 뉴스 정리</p>
            <p className="mt-2 [word-break:keep-all]">{briefing.finalSummary}</p>
          </div>
        </>
      ) : null}

      {payload?.failedSources.length ? (
        <div className="rounded-lg border border-signal-warning/20 bg-signal-warning/10 p-3 text-xs leading-5 text-signal-warning">
          일부 뉴스 소스 연결이 지연되었습니다. 실패 소스는 {payload.failedSources.join(", ")}입니다.
        </div>
      ) : null}

      <div className="rounded-lg border border-surface-line bg-surface-card p-4 shadow-glow sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-lg font-black text-white">참고 뉴스</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">브리핑에 사용한 공개 뉴스 제목과 원문 링크입니다.</p>
          </div>
          <p className="text-xs font-bold text-slate-500">{payload ? `${payload.items.length}개 수집` : "수집 대기"}</p>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {isInitialLoading ? (
            <div className="rounded-md border border-dashed border-accent-blue/25 bg-accent-blue/5 p-4 text-sm font-bold text-slate-400 lg:col-span-2">
              참고 뉴스 목록을 정리하는 중입니다. 잠시만 기다려 주세요.
            </div>
          ) : (
            (payload?.items ?? []).slice(0, 10).map((item) => (
              <NewsSourceCard key={item.id} item={item} />
            ))
          )}
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-xs leading-5 text-slate-500">
        레이더뉴스는 투자 조언이나 매수·매도 신호가 아닙니다. 공개 뉴스 제목과 시장 반응을 바탕으로 한 교육용 정리이며, 실제 판단은 차트 구조와 리스크 관리 기준을 함께 확인해 주세요.
      </div>
    </section>
  );
}
