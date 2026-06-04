"use client";

import { useEffect, useMemo, useState } from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { ActionButton, StatusPill } from "@/components/ui/DesignPrimitives";
import { CoinLargeTradeFlowPanel } from "@/components/coin/CoinLargeTradeFlowPanel";
import { CoinFuturesSignalPressurePanel } from "@/components/coin/CoinSignalPressurePanel";
import type { FuturesSymbolInfo } from "@/components/coin/CoinSignalPressurePanel";

const ALT_FUTURES_STORAGE_KEY = "chartRadar.altFuturesSymbols.v1";
const MAX_ALT_FUTURES_SELECTION = 4;

const supportedAltFuturesSymbols: FuturesSymbolInfo[] = [
  { symbol: "SOLUSDT", label: "SOL" },
  { symbol: "XRPUSDT", label: "XRP" },
  { symbol: "DOGEUSDT", label: "DOGE" },
  { symbol: "BNBUSDT", label: "BNB" }
];

const defaultAltFuturesSymbols = supportedAltFuturesSymbols;
const supportedSymbolMap = new Map(supportedAltFuturesSymbols.map((item) => [item.symbol, item]));

function normalizeSymbol(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function sanitizeAltFuturesSymbols(value: unknown): FuturesSymbolInfo[] {
  if (!Array.isArray(value)) return defaultAltFuturesSymbols;

  const seen = new Set<string>();
  const next: FuturesSymbolInfo[] = [];

  for (const item of value) {
    const symbol = normalizeSymbol(item);
    if (symbol === "BTCUSDT" || symbol === "ETHUSDT") continue;

    const supported = supportedSymbolMap.get(symbol);
    if (!supported || seen.has(supported.symbol)) continue;

    next.push(supported);
    seen.add(supported.symbol);

    if (next.length >= MAX_ALT_FUTURES_SELECTION) break;
  }

  return next.length ? next : defaultAltFuturesSymbols;
}

function readStoredAltFuturesSymbols() {
  if (typeof window === "undefined") return defaultAltFuturesSymbols;

  try {
    const raw = window.localStorage.getItem(ALT_FUTURES_STORAGE_KEY);
    if (!raw) return defaultAltFuturesSymbols;
    return sanitizeAltFuturesSymbols(JSON.parse(raw));
  } catch {
    return defaultAltFuturesSymbols;
  }
}

function persistAltFuturesSymbols(symbols: FuturesSymbolInfo[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(ALT_FUTURES_STORAGE_KEY, JSON.stringify(symbols.map((item) => item.symbol)));
  } catch {
    // Storage failure should not block the live panels; default state remains usable.
  }
}

function isDefaultSelection(symbols: FuturesSymbolInfo[]) {
  return (
    symbols.length === defaultAltFuturesSymbols.length &&
    symbols.every((item, index) => item.symbol === defaultAltFuturesSymbols[index]?.symbol)
  );
}

export function AltFuturesSignalSection() {
  const [selectedSymbols, setSelectedSymbols] = useState<FuturesSymbolInfo[]>(defaultAltFuturesSymbols);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    setSelectedSymbols(readStoredAltFuturesSymbols());
    setStorageReady(true);
  }, []);

  const selectedLabelText = useMemo(() => selectedSymbols.map((item) => item.label).join(" · "), [selectedSymbols]);
  const defaultSelected = isDefaultSelection(selectedSymbols);

  const toggleSymbol = (target: FuturesSymbolInfo) => {
    setSelectedSymbols((current) => {
      const exists = current.some((item) => item.symbol === target.symbol);

      if (exists) {
        if (current.length <= 1) return current;
        const next = current.filter((item) => item.symbol !== target.symbol);
        persistAltFuturesSymbols(next);
        return next;
      }

      if (current.length >= MAX_ALT_FUTURES_SELECTION) return current;

      const next = [...current, target];
      persistAltFuturesSymbols(next);
      return next;
    });
  };

  const restoreDefaults = () => {
    setSelectedSymbols(defaultAltFuturesSymbols);
    persistAltFuturesSymbols(defaultAltFuturesSymbols);
  };

  return (
    <>
      <section className="border-y border-ui-line py-3 sm:py-4">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-ui-label font-semibold uppercase tracking-[0.12em] text-ui-subtle">내 알트 선물 목록</p>
            <h2 className="mt-1 text-ui-heading font-semibold tracking-tight text-ui-text">{selectedLabelText}</h2>
            <p className="mt-1 text-ui-body text-ui-muted [word-break:keep-all]">
              선택한 알트 기준으로 쏠림과 큰 체결 흐름을 확인합니다.
            </p>
          </div>
          <ActionButton tone="secondary" onClick={restoreDefaults} disabled={defaultSelected} className="self-start">
            <RotateCcw size={15} aria-hidden />
            기본값으로 복원
          </ActionButton>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          <StatusPill tone="info" icon={SlidersHorizontal}>
            목록 변경
          </StatusPill>
          <div className="flex flex-wrap gap-2" role="group" aria-label="내 알트 선물 목록 선택">
            {supportedAltFuturesSymbols.map((item) => {
              const selected = selectedSymbols.some((selectedItem) => selectedItem.symbol === item.symbol);
              const disableRemove = selected && selectedSymbols.length <= 1;
              return (
                <button
                  key={item.symbol}
                  type="button"
                  onClick={() => toggleSymbol(item)}
                  aria-pressed={selected}
                  disabled={disableRemove}
                  className={`min-h-9 rounded-ui-sm border px-3 text-xs font-semibold transition ${
                    selected
                      ? "border-ui-brand bg-ui-brand/10 text-ui-brand"
                      : "border-ui-line bg-transparent text-ui-muted hover:border-ui-lineStrong hover:text-ui-text"
                  } disabled:cursor-not-allowed disabled:opacity-70`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs leading-5 text-ui-muted [word-break:keep-all]">
            기본값은 SOL · XRP · DOGE · BNB입니다. 최소 1개를 유지합니다.
          </p>
        </div>
      </section>

      {storageReady ? (
        <>
          <section className="pt-1">
            <p className="text-ui-label font-semibold uppercase tracking-[0.12em] text-ui-subtle">앱이 감지한 알트 직접 신호</p>
            <h2 className="mt-1 text-ui-heading font-semibold tracking-tight text-ui-text">선택 알트의 쏠림과 큰 체결을 먼저 확인합니다</h2>
            <p className="mt-1 text-ui-body text-ui-muted [word-break:keep-all]">
              알트 선물 화면은 {selectedLabelText} 기준의 포지션 쏠림과 큰 체결 흐름을 우선 분리하고, 언락·변동성 부담은 이어서 확인합니다.
            </p>
          </section>
          <CoinFuturesSignalPressurePanel mode="alts" symbols={selectedSymbols} />
          <CoinLargeTradeFlowPanel mode="alts" symbols={selectedSymbols} />
        </>
      ) : (
        <section className="pt-1">
          <p className="text-ui-label font-semibold uppercase tracking-[0.12em] text-ui-subtle">앱이 감지한 알트 직접 신호</p>
          <h2 className="mt-1 text-ui-heading font-semibold tracking-tight text-ui-text">선택 목록 확인 중</h2>
        </section>
      )}
    </>
  );
}
