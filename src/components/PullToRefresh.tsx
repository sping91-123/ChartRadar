"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, RefreshCw, TriangleAlert } from "lucide-react";
import {
  canStartPullToRefresh,
  isPullRefreshHandlerVersionCurrent,
  pullGestureEndAction,
  pullGestureProgress,
  pullToRefreshMaxVisualPx
} from "@/lib/pullToRefresh";

type RefreshHandler = () => Promise<void> | void;
type RegisterRefreshHandler = (handler: RefreshHandler) => () => void;
type PullRefreshPhase = "idle" | "pulling" | "armed" | "refreshing" | "success" | "error";

const PullToRefreshContext = createContext<RegisterRefreshHandler | null>(null);
const ignorePullSelector = [
  "a",
  "button",
  "input",
  "select",
  "textarea",
  "[contenteditable='true']",
  "[role='button']",
  "[role='dialog']",
  "[role='img']",
  "summary",
  "[data-pull-to-refresh-ignore]",
  "[class~='overflow-auto']",
  "[class~='overflow-scroll']",
  "[class~='overflow-x-auto']",
  "[class~='overflow-x-scroll']",
  "[class~='overflow-y-auto']",
  "[class~='overflow-y-scroll']"
].join(",");

function phaseLabel(phase: PullRefreshPhase) {
  if (phase === "armed") return "놓으면 새로고침";
  if (phase === "refreshing") return "새로고침 중…";
  if (phase === "success") return "새로고침 완료";
  if (phase === "error") return "새로고침하지 못했습니다. 다시 시도해 주세요.";
  return "당겨서 새로고침";
}

function isIgnoredTarget(target: EventTarget | null, scrollRoot: HTMLElement) {
  if (!(target instanceof Element)) return false;
  if (target.closest(ignorePullSelector)) return true;

  let candidate: Element | null = target;
  while (candidate && candidate !== scrollRoot) {
    if (candidate instanceof HTMLElement) {
      const style = window.getComputedStyle(candidate);
      const scrollsVertically = /(auto|scroll)/.test(style.overflowY)
        && candidate.scrollHeight > candidate.clientHeight;
      const scrollsHorizontally = /(auto|scroll)/.test(style.overflowX)
        && candidate.scrollWidth > candidate.clientWidth;
      if (scrollsVertically || scrollsHorizontally) return true;
    }
    candidate = candidate.parentElement;
  }
  return false;
}

function wait(delayMs: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, delayMs));
}

export function usePullToRefreshRegistration(handler: RefreshHandler, enabled = true) {
  const register = useContext(PullToRefreshContext);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!register || !enabled) return;
    return register(() => handlerRef.current());
  }, [enabled, register]);
}

export function PullToRefresh({
  children,
  enabled = true
}: {
  children: React.ReactNode;
  enabled?: boolean;
}) {
  const router = useRouter();
  const handlersRef = useRef(new Set<RefreshHandler>());
  const handlerVersionRef = useRef(0);
  const indicatorRef = useRef<HTMLDivElement | null>(null);
  const gestureRef = useRef({ active: false, armed: false, startX: 0, startY: 0 });
  const refreshingRef = useRef(false);
  const completionTimerRef = useRef<number | null>(null);
  const [phase, setPhase] = useState<PullRefreshPhase>("idle");
  const [handlerCount, setHandlerCount] = useState(0);

  const register = useCallback<RegisterRefreshHandler>((handler) => {
    handlersRef.current.add(handler);
    handlerVersionRef.current += 1;
    setHandlerCount(handlersRef.current.size);
    return () => {
      if (handlersRef.current.delete(handler)) handlerVersionRef.current += 1;
      setHandlerCount(handlersRef.current.size);
    };
  }, []);

  const setIndicatorDistance = useCallback((distance: number, dragging: boolean) => {
    const indicator = indicatorRef.current;
    if (!indicator) return;
    indicator.style.setProperty("--pull-distance", `${distance}px`);
    indicator.style.transitionDuration = dragging ? "0ms" : "180ms";
  }, []);

  const reset = useCallback(() => {
    gestureRef.current = { active: false, armed: false, startX: 0, startY: 0 };
    refreshingRef.current = false;
    setIndicatorDistance(0, false);
    setPhase("idle");
  }, [setIndicatorDistance]);

  const cancelGesture = useCallback(() => {
    if (!gestureRef.current.active) return;
    gestureRef.current = { active: false, armed: false, startX: 0, startY: 0 };
    setIndicatorDistance(0, false);
    setPhase("idle");
  }, [setIndicatorDistance]);

  const runRefresh = useCallback(async () => {
    const handlerVersion = handlerVersionRef.current;
    const handlers = Array.from(handlersRef.current);
    if (!enabled || handlers.length === 0 || refreshingRef.current) return;
    refreshingRef.current = true;
    gestureRef.current.active = false;
    gestureRef.current.armed = false;
    setIndicatorDistance(pullToRefreshMaxVisualPx, false);
    setPhase("refreshing");

    try {
      router.refresh();
      const resultsPromise = Promise.allSettled(handlers.map((handler) => Promise.resolve().then(handler)));
      const [results] = await Promise.all([resultsPromise, wait(550)]);
      if (!isPullRefreshHandlerVersionCurrent(handlerVersion, handlerVersionRef.current)) {
        reset();
        return;
      }
      const failed = results.find((result) => result.status === "rejected");
      if (failed?.status === "rejected") throw failed.reason;
      setPhase("success");
      completionTimerRef.current = window.setTimeout(reset, 850);
    } catch {
      setPhase("error");
      completionTimerRef.current = window.setTimeout(reset, 1_600);
    }
  }, [enabled, reset, router, setIndicatorDistance]);

  useEffect(() => {
    if (!enabled || handlerCount === 0) {
      reset();
      return;
    }
    const scrollRoot = document.querySelector<HTMLElement>(".app-scroll-root");
    if (!scrollRoot) return;

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        cancelGesture();
        return;
      }
      const blocked = isIgnoredTarget(event.target, scrollRoot)
        || handlersRef.current.size === 0
        || Boolean(document.querySelector("[role='dialog'][aria-modal='true']"));
      if (!canStartPullToRefresh({
        scrollTop: scrollRoot.scrollTop,
        touchCount: event.touches.length,
        refreshing: refreshingRef.current,
        blocked
      })) return;
      const touch = event.touches[0];
      gestureRef.current = {
        active: true,
        armed: false,
        startX: touch.clientX,
        startY: touch.clientY
      };
    };

    const onTouchMove = (event: TouchEvent) => {
      const gesture = gestureRef.current;
      if (!gesture.active) return;
      if (event.touches.length !== 1 || scrollRoot.scrollTop > 1) {
        cancelGesture();
        return;
      }
      const touch = event.touches[0];
      const progress = pullGestureProgress({
        startX: gesture.startX,
        startY: gesture.startY,
        currentX: touch.clientX,
        currentY: touch.clientY
      });
      if (progress.state === "cancelled") {
        cancelGesture();
        return;
      }
      if (progress.state === "pending") return;
      event.preventDefault();
      gesture.armed = progress.state === "armed";
      setIndicatorDistance(progress.visualDistance, true);
      const nextPhase = progress.state === "armed" ? "armed" : "pulling";
      setPhase((current) => current === nextPhase ? current : nextPhase);
    };

    const onTouchEnd = (event: TouchEvent) => {
      const action = pullGestureEndAction({
        active: gestureRef.current.active,
        armed: gestureRef.current.armed,
        remainingTouchCount: event.touches.length
      });
      if (action === "refresh") void runRefresh();
      else if (action === "cancel") cancelGesture();
    };

    const onTouchCancel = () => cancelGesture();
    scrollRoot.addEventListener("touchstart", onTouchStart, { passive: true });
    scrollRoot.addEventListener("touchmove", onTouchMove, { passive: false });
    scrollRoot.addEventListener("touchend", onTouchEnd, { passive: true });
    scrollRoot.addEventListener("touchcancel", onTouchCancel, { passive: true });
    return () => {
      scrollRoot.removeEventListener("touchstart", onTouchStart);
      scrollRoot.removeEventListener("touchmove", onTouchMove);
      scrollRoot.removeEventListener("touchend", onTouchEnd);
      scrollRoot.removeEventListener("touchcancel", onTouchCancel);
      if (completionTimerRef.current !== null) window.clearTimeout(completionTimerRef.current);
    };
  }, [cancelGesture, enabled, handlerCount, reset, runRefresh, setIndicatorDistance]);

  const visible = phase !== "idle";
  return (
    <PullToRefreshContext.Provider value={register}>
      <div
        ref={indicatorRef}
        data-testid="pull-to-refresh-indicator"
        data-state={phase}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-hidden={!visible}
        className={`pointer-events-none fixed left-1/2 top-[calc(env(safe-area-inset-top)+0.5rem)] z-[120] flex min-h-10 items-center gap-2 rounded-full border border-ui-line bg-ui-elevated px-3 py-2 text-xs font-black text-ui-text shadow-lg transition-[transform,opacity] duration-200 motion-reduce:transition-none ${visible ? "opacity-100" : "opacity-0"}`}
        style={{
          maxWidth: "calc(100vw - 2rem - env(safe-area-inset-left) - env(safe-area-inset-right))",
          transform: "translate(-50%, calc(-100% + var(--pull-distance, 0px)))"
        }}
      >
        {phase === "success" ? <Check size={15} className="text-ui-long" aria-hidden />
          : phase === "error" ? <TriangleAlert size={15} className="text-ui-risk" aria-hidden />
            : <RefreshCw size={15} className={phase === "refreshing" ? "animate-spin text-ui-brand motion-reduce:animate-none" : "text-ui-brand"} aria-hidden />}
        <span>{phaseLabel(phase)}</span>
      </div>
      {enabled && handlerCount > 0 ? (
        <button
          type="button"
          onClick={() => void runRefresh()}
          disabled={refreshingRef.current}
          className="sr-only fixed z-[121] min-h-11 rounded-ui-sm bg-ui-brand px-3 font-black text-white [right:calc(env(safe-area-inset-right)+0.5rem)] [top:calc(env(safe-area-inset-top)+0.5rem)] focus:not-sr-only focus:fixed focus:outline-none focus:ring-2 focus:ring-white"
        >
          핵심 분석 새로고침
        </button>
      ) : null}
      {children}
    </PullToRefreshContext.Provider>
  );
}
