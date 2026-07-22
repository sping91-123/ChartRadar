"use client";

import { useEffect, useRef, useState } from "react";

const TRADINGVIEW_SINGLE_TICKER_SCRIPT = "https://widgets.tradingview-widget.com/w/kr/tv-single-ticker.js";
const SCRIPT_MARKER = "data-chartradar-tradingview-single-ticker";
const WIDGET_LOAD_TIMEOUT_MS = 8_000;

let widgetLoader: Promise<void> | null = null;

function waitForWidgetDefinition() {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error("TradingView 위젯 로딩 시간 초과")),
      WIDGET_LOAD_TIMEOUT_MS
    );
    void customElements.whenDefined("tv-single-ticker").then(() => {
      window.clearTimeout(timer);
      resolve();
    });
  });
}

function loadTradingViewSingleTicker() {
  if (customElements.get("tv-single-ticker")) return Promise.resolve();
  if (widgetLoader) return widgetLoader;

  widgetLoader = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[${SCRIPT_MARKER}]`);
    if (existing) {
      void waitForWidgetDefinition().then(resolve, reject);
      return;
    }

    const script = document.createElement("script");

    const handleLoad = () => {
      void waitForWidgetDefinition().then(resolve, reject);
    };
    const handleError = () => reject(new Error("TradingView 위젯을 불러오지 못했습니다."));

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
    script.type = "module";
    script.src = TRADINGVIEW_SINGLE_TICKER_SCRIPT;
    script.setAttribute(SCRIPT_MARKER, "true");
    document.head.appendChild(script);
  }).catch((error) => {
    document.querySelector<HTMLScriptElement>(`script[${SCRIPT_MARKER}]`)?.remove();
    widgetLoader = null;
    throw error;
  });

  return widgetLoader;
}

export function TradingViewSingleTicker({
  symbol,
  label,
  href
}: {
  symbol: "CRYPTOCAP:BTC.D" | "FX_IDC:USDKRW";
  label: string;
  href: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const automaticallyRetriedRef = useRef(false);
  const previousSymbolRef = useRef(symbol);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [retryVersion, setRetryVersion] = useState(0);

  useEffect(() => {
    let active = true;
    let retryTimer: number | null = null;
    const host = hostRef.current;
    if (!host) return;
    if (previousSymbolRef.current !== symbol) {
      previousSymbolRef.current = symbol;
      automaticallyRetriedRef.current = false;
    }
    setStatus("loading");

    void loadTradingViewSingleTicker()
      .then(() => {
        if (!active || !hostRef.current) return;
        const widget = document.createElement("tv-single-ticker");
        widget.setAttribute("symbol", symbol);
        widget.setAttribute("theme", "dark");
        widget.setAttribute("hide-market-status", "false");
        widget.style.display = "block";
        widget.style.width = "100%";
        widget.style.height = "89px";
        hostRef.current.replaceChildren(widget);
        setStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        if (!automaticallyRetriedRef.current) {
          automaticallyRetriedRef.current = true;
          retryTimer = window.setTimeout(() => {
            if (active) setRetryVersion((current) => current + 1);
          }, 1_000);
          return;
        }
        setStatus("error");
      });

    return () => {
      active = false;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      host.replaceChildren();
    };
  }, [retryVersion, symbol]);

  const retry = () => {
    automaticallyRetriedRef.current = false;
    setRetryVersion((current) => current + 1);
  };

  return (
    <div className="min-w-0" role="group" aria-label={label} aria-busy={status === "loading"}>
      <div className="relative min-h-[89px] min-w-0">
        <div ref={hostRef} className="min-h-[89px] min-w-0" />
        {status === "loading" ? (
          <p className="pointer-events-none absolute inset-0 flex min-h-[89px] items-center text-sm font-semibold text-ui-muted" aria-live="polite">
            최신 값 불러오는 중
          </p>
        ) : null}
      </div>
      {status === "error" ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={retry}
            className="inline-flex min-h-8 items-center text-xs font-semibold text-ui-watch underline underline-offset-4"
          >
            다시 불러오기
          </button>
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-8 items-center text-xs font-semibold text-ui-muted underline underline-offset-4"
          >
            TradingView에서 확인
          </a>
        </div>
      ) : (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-7 items-center text-[11px] font-semibold text-ui-subtle underline decoration-ui-line underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-watch"
        >
          TradingView 원문
        </a>
      )}
    </div>
  );
}
