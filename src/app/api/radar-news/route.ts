// 한 릴리스 동안 구형 클라이언트에 저장된 News Impact 데이터를 제공하는 호환 경로입니다.
import { NextResponse } from "next/server";
import type { NewsImpactEvent } from "@/lib/newsImpact";
import type { RadarNewsBriefing, RadarNewsItem, RadarNewsMarket } from "@/lib/radarNews";
import { readNewsImpactEvents, readNewsSourceStatusSummary } from "@/lib/server/news/newsImpactStore";
import { isNewsImpactUiEnabled, newsImpactMode } from "@/lib/server/newsImpactMode";
import { rateLimit } from "@/lib/server/rateLimit";
import { isSupabaseAdminConfigured } from "@/lib/server/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function legacyItem(event: NewsImpactEvent): RadarNewsItem {
  return {
    id: event.id,
    direction: "neutral",
    urgency: event.importance === "critical" ? "high" : event.importance === "high" ? "medium" : "low",
    score: 50,
    assets: event.targets.map((target) => target.toUpperCase()),
    tags: ["공식 출처", event.category],
    headline: event.headline,
    summary: event.reaction?.reactionSummary ?? event.factSummary,
    actionHint: event.reaction?.nextCheckAt ? "시장 반응 확인 중" : "공식 발표와 관측 반응 확인",
    source: event.primarySource.name,
    originalTitle: event.headline,
    title: event.headline,
    titleKo: event.headline,
    displayTitle: event.headline,
    translatedTitle: event.headline,
    excerpt: event.factSummary,
    link: event.primarySource.url,
    publishedAt: event.occurredAt
  };
}

function legacyBriefing(events: NewsImpactEvent[], generatedAt: string): RadarNewsBriefing {
  const lead = events[0];
  return {
    generatedAt,
    model: "news-impact-v1",
    overview: lead ? lead.factSummary : "현재 판단을 바꿀 공식 이슈가 없습니다.",
    keyIssues: events.slice(0, 3).map((event) => ({
      title: event.headline,
      detail: event.reaction?.reactionSummary ?? "발표 이후 시장 반응을 확인 중입니다.",
      tone: "neutral"
    })),
    marketImpact: events.slice(0, 3).map((event) => event.reaction?.reactionSummary ?? event.factSummary),
    strategyNotes: ["공식 사실과 발표 이후 관측 반응을 분리해서 확인하세요."],
    finalSummary: lead?.reaction?.reactionSummary ?? "단순 헤드라인만으로 판단 방향을 바꾸지 않습니다."
  };
}

export async function GET(request: Request) {
  const rawMarket = new URL(request.url).searchParams.get("market") ?? "crypto";
  if (rawMarket !== "crypto" && rawMarket !== "stocks") {
    return NextResponse.json({ error: "지원하지 않는 뉴스 시장입니다." }, { status: 400 });
  }
  const market = rawMarket as RadarNewsMarket;
  const limited = await rateLimit(request, { key: `radar-news-compat:${market}`, limit: 120, windowMs: 60 * 60_000 });
  if (!limited.allowed) return NextResponse.json({ error: "뉴스 레이더 요청이 잠시 많습니다." }, { status: 429 });
  const mode = newsImpactMode();
  const generatedAt = new Date().toISOString();
  if (!isNewsImpactUiEnabled(mode) || !isSupabaseAdminConfigured()) {
    return NextResponse.json({
      updatedAt: Date.now(),
      items: [],
      briefing: legacyBriefing([], generatedAt),
      failedSources: [],
      market,
      cached: false,
      refreshIntervalMs: 5 * 60_000,
      compatibility: "news-impact-v1",
      mode
    }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  }
  try {
    const [events, health] = await Promise.all([
      readNewsImpactEvents({
        market: market === "stocks" ? "global" : "crypto",
        asset: market === "crypto" ? "btc" : null,
        since: new Date(Date.now() - 24 * 60 * 60_000).toISOString(),
        limit: 3
      }),
      readNewsSourceStatusSummary()
    ]);
    return NextResponse.json({
      updatedAt: Date.parse(health.latestRunAt ?? generatedAt),
      items: events.map(legacyItem),
      briefing: legacyBriefing(events, health.latestRunAt ?? generatedAt),
      failedSources: health.degraded > 0 ? ["공식 출처 갱신 지연"] : [],
      market,
      cached: false,
      refreshIntervalMs: 5 * 60_000,
      compatibility: "news-impact-v1"
    }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    console.error("[api/radar-news] compatibility error:", error);
    return NextResponse.json({ error: "저장된 뉴스 임팩트를 불러오지 못했습니다." }, { status: 503 });
  }
}
