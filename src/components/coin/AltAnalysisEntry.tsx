"use client";

import { useEffect, useState } from "react";
import { LiveMarketChart } from "@/components/LiveMarketChart";
import { altSymbols } from "@/components/crypto/constants";
import { chartTimeframes, type ChartTimeframe } from "@/lib/marketAnalysis";

const choices = ["SOL", "XRP", "DOGE", "BNB", ...altSymbols.map((symbol) => symbol.replace("USDT.P", "")).filter((symbol) => !["SOL", "XRP", "DOGE", "BNB"].includes(symbol))];

export function AltAnalysisEntry({ initialFocus, initialTimeframe }: { initialFocus?: string | null; initialTimeframe?: string }) {
  const focusedSymbol = initialFocus && /^[A-Z0-9]{2,30}$/.test(initialFocus) && !["BTC", "ETH"].includes(initialFocus) ? initialFocus : null;
  const [selected, setSelected] = useState<string | null>(focusedSymbol);
  const symbolChoices = focusedSymbol && !choices.includes(focusedSymbol) ? [focusedSymbol, ...choices] : choices;
  const timeframe = chartTimeframes.includes(initialTimeframe as ChartTimeframe) ? initialTimeframe as ChartTimeframe : undefined;
  useEffect(() => {
    if (!selected) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("focus");
    url.searchParams.set("symbol", `${selected}USDT.P`);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    document.getElementById("basic-coins")?.scrollIntoView({ block: "start" });
  }, [selected]);
  return (
    <section aria-labelledby="alt-analysis-entry" className="min-w-0">
      <div className="bg-ui-panel px-3 py-4">
        <h1 id="alt-analysis-entry" className="break-words text-xl font-bold text-ui-text">{selected ? `${selected} 현재 조건 확인` : "먼저 확인할 알트를 고르세요"}</h1>
        <p className="mt-2 text-xs leading-5 text-ui-muted">선택한 종목의 현재 상태·위험·확인 조건을 먼저 봅니다. Basic 분석 횟수는 종목 분석을 열 때 적용됩니다.</p>
        <div className="mt-3 grid grid-cols-4 gap-2" role="group" aria-label="분석할 알트 선택">
          {symbolChoices.map((symbol) => <button type="button" key={symbol} aria-pressed={selected === symbol} onClick={() => setSelected(symbol)} className={`min-h-11 break-all rounded-ui-sm px-1 text-sm font-semibold ${selected === symbol ? "bg-ui-brand text-white" : "bg-ui-inset text-ui-text"}`}>{symbol}</button>)}
        </div>
        {!selected ? <p className="mt-3 text-xs leading-5 text-ui-subtle">아직 분석을 요청하지 않았습니다. 시장 전체 흐름은 아래에서 먼저 볼 수 있습니다.</p> : null}
      </div>
      {selected ? <LiveMarketChart key={`${selected}:${timeframe ?? "default"}`} altOnly selectedSymbol={`${selected}USDT.P`} initialTimeframe={timeframe} hideSymbolSelector /> : null}
    </section>
  );
}
