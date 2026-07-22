"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { HighlightedBriefing } from "@/components/crypto/HighlightedBriefing";
import { ActionButton, StatusPill } from "@/components/ui/DesignPrimitives";
import { withSupabaseAuth } from "@/lib/authFetch";

type BriefingState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; text: string; cached: boolean; mode: "ai" | "rules" }
  | { status: "error"; message: string };

export function PerpetualSnapshotBriefing({
  snapshotId,
  hasPro,
  enabled
}: {
  snapshotId: string;
  hasPro: boolean;
  enabled: boolean;
}) {
  const [state, setState] = useState<BriefingState>({ status: "idle" });
  const generationRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    generationRef.current += 1;
    controllerRef.current?.abort();
    setState({ status: "idle" });
    return () => controllerRef.current?.abort();
  }, [snapshotId]);

  const load = useCallback(async () => {
    const generation = ++generationRef.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 20_000);
    setState({ status: "loading" });
    try {
      const response = await fetch(
        "/api/crypto/perpetual/briefing",
        await withSupabaseAuth({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snapshotId }),
          signal: controller.signal
        })
      );
      const payload = (await response.json().catch(() => ({}))) as {
        snapshotId?: string;
        briefing?: string;
        cached?: boolean;
        providerSkipped?: boolean;
        error?: string;
      };
      if (!response.ok || !payload.briefing) throw new Error(payload.error ?? "쉬운 설명을 불러오지 못했습니다.");
      if (controller.signal.aborted || generation !== generationRef.current || payload.snapshotId !== snapshotId) return;
      setState({
        status: "ready",
        text: payload.briefing,
        cached: Boolean(payload.cached),
        mode: payload.providerSkipped ? "rules" : "ai"
      });
    } catch (error) {
      if (generation !== generationRef.current || (controller.signal.aborted && !timedOut)) return;
      setState({ status: "error", message: timedOut ? "쉬운 설명이 늦어지고 있습니다. 잠시 뒤 다시 시도해 주세요." : error instanceof Error ? error.message : "쉬운 설명을 불러오지 못했습니다." });
    } finally {
      window.clearTimeout(timeout);
    }
  }, [snapshotId]);

  return (
    <section className="bg-ui-panel px-3 py-4 sm:px-5" aria-labelledby="perpetual-ai-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.12em] text-ui-brand"><Sparkles size={12} aria-hidden /> Coin Pro</p>
          <h2 id="perpetual-ai-title" className="mt-1 text-lg font-black text-ui-text">지금 분석을 쉬운 말로 풀어드려요</h2>
          <p className="mt-1 text-xs leading-5 text-ui-muted">같은 분석 시각의 차트·포지션 쏠림·큰 체결만 읽습니다. AI를 쓸 수 없을 때는 검증된 규칙 설명으로 바꾸며, 매매 지시는 만들지 않습니다.</p>
        </div>
        {enabled ? (
          <ActionButton tone="primary" onClick={() => void load()} disabled={state.status === "loading"} className="w-full sm:w-auto">
            {state.status === "loading" ? <Loader2 size={15} className="animate-spin" aria-hidden /> : state.status === "ready" ? <RefreshCw size={15} aria-hidden /> : <Bot size={15} aria-hidden />}
            {state.status === "loading" ? "쉽게 설명하는 중" : state.status === "ready" ? "다시 설명하기" : "쉬운 설명 보기"}
          </ActionButton>
        ) : !hasPro ? (
          <ActionButton href="/pro?market=crypto&source=perpetual-ai" tone="primary" className="w-full sm:w-auto">Pro에서 쉬운 설명 보기</ActionButton>
        ) : (
          <StatusPill tone="watch">다음 분석부터 제공</StatusPill>
        )}
      </div>

      {enabled && state.status === "idle" ? <p className="mt-4 bg-ui-inset/55 px-3 py-3 text-sm leading-6 text-ui-muted">버튼을 누르면 어려운 구조 용어를 풀어 현재 흐름, 가장 큰 위험, 지금 확인할 가격 순서로 설명합니다.</p> : null}
      {hasPro && !enabled ? <p className="mt-4 bg-ui-inset/55 px-3 py-3 text-sm leading-6 text-ui-muted">이전 분석에는 AI가 읽을 상세 근거가 저장되지 않았습니다. 다음 자동 분석부터 쉬운 설명을 이용할 수 있습니다.</p> : null}
      {state.status === "ready" ? (
        <div className="mt-4 border-t border-ui-line pt-4">
          <StatusPill tone={state.mode === "ai" ? "info" : "watch"}>
            {state.mode === "ai" ? "AI 생성 설명" : "규칙 기반 자동 설명"}
          </StatusPill>
          <HighlightedBriefing text={state.text} />
          {state.cached ? <p className="mt-2 text-[11px] text-ui-subtle">이 분석 기준으로 앞서 만든 설명을 다시 불러왔습니다.</p> : null}
        </div>
      ) : null}
      {state.status === "error" ? <p role="alert" className="mt-3 text-xs font-semibold leading-5 text-ui-risk">{state.message}</p> : null}
    </section>
  );
}
