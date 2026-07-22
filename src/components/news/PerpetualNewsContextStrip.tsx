"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Newspaper } from "lucide-react";
import { StatusPill } from "@/components/ui/DesignPrimitives";
import { withSupabaseAuth } from "@/lib/authFetch";
import type { NewsImpactListResponse } from "@/lib/newsImpact";
import { newsImpactClassificationLabel, newsImpactTone } from "@/lib/newsImpactPresentation";
import type { PerpetualAsset } from "@/lib/perpetualDecisionSnapshot";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";

type NewsState =
  | { status: "loading" }
  | { status: "ready"; payload: NewsImpactListResponse; exact: boolean }
  | { status: "unavailable" };

async function requestNews(asset: PerpetualAsset, snapshotId: string | null, signal: AbortSignal) {
  const params = new URLSearchParams({ market: "crypto", asset, limit: "1" });
  if (snapshotId) params.set("snapshot", snapshotId);
  const response = await fetch(`/api/news-impact?${params.toString()}`, await withSupabaseAuth({ cache: "no-store", signal }));
  const payload = (await response.json().catch(() => ({}))) as NewsImpactListResponse;
  if (!response.ok || payload.mode === "off") return null;
  return payload;
}

export function PerpetualNewsContextStrip({ asset, snapshotId }: { asset: PerpetualAsset; snapshotId: string }) {
  const { session } = useSupabaseAuth();
  const [state, setState] = useState<NewsState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    void (async () => {
      try {
        const exact = await requestNews(asset, snapshotId, controller.signal);
        if (controller.signal.aborted) return;
        if (exact?.events.length && exact.mode === "on") {
          setState({ status: "ready", payload: exact, exact: true });
          return;
        }
        if (exact?.events.length) {
          setState({ status: "ready", payload: exact, exact: false });
          return;
        }
        const recent = await requestNews(asset, null, controller.signal);
        if (controller.signal.aborted) return;
        setState(recent ? { status: "ready", payload: recent, exact: false } : { status: "unavailable" });
      } catch {
        if (!controller.signal.aborted) setState({ status: "unavailable" });
      }
    })();
    return () => controller.abort();
  }, [asset, session?.accessToken, snapshotId]);

  if (state.status === "loading") {
    return <div className="h-12 animate-pulse bg-ui-panel" aria-label="관련 공식 뉴스 확인 중" />;
  }
  if (state.status === "unavailable") return null;

  const event = state.payload.events[0];
  const href = event
    ? `/crypto/news?asset=${asset}&event=${event.id}&source=perpetual${state.exact ? `&snapshot=${encodeURIComponent(snapshotId)}` : ""}`
    : `/crypto/news?asset=${asset}&source=perpetual`;
  if (!event) {
    const delayed = state.payload.quality !== "ready";
    return (
      <Link href={href} className="flex min-h-12 items-center gap-2 bg-ui-panel px-3 py-2.5 text-xs font-semibold text-ui-muted transition hover:bg-ui-elevated">
        <Newspaper className="shrink-0 text-ui-brand" size={16} aria-hidden />
        <span className="min-w-0 flex-1"><strong className="text-ui-text">공식 뉴스 확인</strong> · {delayed ? "공식 출처 갱신이 지연되어 새 사건이 없다고 단정하지 않습니다." : "현재 판단을 바꿀 새 공식 사건은 없습니다."}</span>
        <ArrowRight className="shrink-0 text-ui-brand" size={14} aria-hidden />
      </Link>
    );
  }
  const classification = event.reaction?.classification ?? "pending";
  const officialFactsOnly = state.payload.mode === "shadow";
  return (
    <Link href={href} className="block bg-ui-panel px-3 py-3 transition hover:bg-ui-elevated" aria-label={`${event.headline} 공식 뉴스 분석 보기`}>
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex min-w-0 items-center gap-1.5 text-[10.5px] font-black text-ui-text"><Newspaper className="shrink-0 text-ui-brand" size={14} aria-hidden /> {state.exact ? "이 분석 시점의 공식 뉴스" : "최근 공식 뉴스"}</p>
        <StatusPill tone={officialFactsOnly ? "watch" : newsImpactTone(classification)} className="shrink-0">{officialFactsOnly ? "공식 발표" : newsImpactClassificationLabel(classification)}</StatusPill>
      </div>
      <p className="mt-1.5 line-clamp-2 text-sm font-black leading-5 text-ui-text [word-break:keep-all]">{event.headline}</p>
      <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-ui-muted [word-break:keep-all]">{officialFactsOnly ? event.factSummary : state.exact ? event.reaction?.reactionSummary ?? "발표 뒤 실제 시장 반응을 확인 중입니다." : "현재 분석과 같은 시점 자료는 아닙니다. 최근 발표 뒤 실제 반응을 별도로 확인하세요."}</p>
    </Link>
  );
}
