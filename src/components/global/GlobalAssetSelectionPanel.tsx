import { BarChart3, Bookmark, BookmarkCheck, RefreshCw, Search, Sparkles } from "lucide-react";
import type { ChartTimeframe } from "@/lib/marketAnalysis";
import type { StockSymbolInfo } from "@/lib/stockMarket";
import { GlobalAssetChecklist } from "@/components/global/GlobalAssetPlaybook";
import { groupLabels, groupOrder, radarModes, type GlobalRadarMode } from "@/components/global/stockRadarConfig";

type AssetGroupFilter = StockSymbolInfo["group"] | "all";

export function GlobalAssetSelectionPanel({
  symbol,
  selectedInfo,
  timeframe,
  radarMode,
  searchQuery,
  onSearchQueryChange,
  onRefresh,
  featuredItems,
  onSelectSymbol,
  visibleSavedItems,
  onToggleSavedSymbol,
  canSaveSelectedSymbol,
  isSavedSymbol,
  selectedGroup,
  onSelectedGroupChange,
  visibleUniverse
}: {
  symbol: string;
  selectedInfo: StockSymbolInfo | null;
  timeframe: ChartTimeframe;
  radarMode: GlobalRadarMode;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onRefresh: () => void;
  featuredItems: StockSymbolInfo[];
  onSelectSymbol: (value: string) => void;
  visibleSavedItems: StockSymbolInfo[];
  onToggleSavedSymbol: (value: string) => void;
  canSaveSelectedSymbol: boolean;
  isSavedSymbol: boolean;
  selectedGroup: AssetGroupFilter;
  onSelectedGroupChange: (value: AssetGroupFilter) => void;
  visibleUniverse: StockSymbolInfo[];
}) {
  const selectSymbol = (nextSymbol: string) => {
    onSelectSymbol(nextSymbol);
    onSearchQueryChange("");
  };

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center text-accent-blue">
            <BarChart3 size={21} aria-hidden />
          </div>
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-accent-blue">자산레이더</p>
            <h2 className="mt-1 text-xl font-black text-white">선택 자산 상세 판단</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              글로벌 전체 판단 이후 개별 종목을 확인하는 심화 영역입니다.
              상단 대시보드의 시장 모드, 매크로 압력, 섹터 로테이션과 함께 해석하세요.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex min-h-10 items-center justify-center gap-2 border-b border-accent-blue/40 bg-transparent px-1 text-xs font-black text-accent-blue transition hover:border-accent-blue hover:text-cyan-200"
        >
          <RefreshCw size={14} aria-hidden />
          새로고침
        </button>
      </div>

      <div className="mt-5 border-y border-accent-blue/20 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.18em] text-accent-blue">
              <Sparkles size={13} aria-hidden />
              상세 확인할 글로벌 자산
            </p>
            <h3 className="mt-2 break-words text-2xl font-black text-white">
              {symbol}{" "}
              <span className="ml-2 text-base font-bold text-slate-400">{selectedInfo?.name ?? symbol}</span>
            </h3>
            <p className="mt-1 text-xs font-bold text-slate-500">
              {selectedInfo ? groupLabels[selectedInfo.group] : "관심 시장"} · {timeframe} · {radarModes.find((item) => item.value === radarMode)?.label ?? "종합"} 분석
            </p>
          </div>
          <label className="relative block lg:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} aria-hidden />
            <input
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="종목 검색"
              className="h-11 w-full border-b border-surface-line bg-transparent pl-8 pr-0 text-sm font-bold text-white outline-none transition placeholder:text-slate-600 focus:border-accent-blue/70"
            />
          </label>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {featuredItems.map((item) => (
            <button
              key={item.symbol}
              type="button"
              onClick={() => selectSymbol(item.symbol)}
              className={`min-h-11 shrink-0 border-b-2 px-1 text-left transition ${
                symbol === item.symbol
                  ? "border-accent-blue text-accent-blue"
                  : "border-transparent bg-transparent text-slate-200 hover:text-white"
              }`}
            >
              <span className="block text-sm font-black">{item.symbol}</span>
              <span className={`block text-[10px] font-bold ${symbol === item.symbol ? "text-accent-blue/80" : "text-slate-500"}`}>
                {groupLabels[item.group]}
              </span>
            </button>
          ))}
        </div>

        <GlobalAssetChecklist selectedInfo={selectedInfo} />

        <div className="mt-4 border-y border-white/10 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black text-white">관심 글로벌 종목</p>
              <p className="mt-1 text-[11px] font-bold text-slate-500">
                매일 보는 ETF와 종목을 저장하면 이곳에 고정됩니다. 미국장 30초 체크 이후 개별 판단을 이어가세요.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onToggleSavedSymbol(symbol)}
              disabled={!canSaveSelectedSymbol}
              className={`inline-flex min-h-9 items-center justify-center gap-1.5 border-b px-0 text-xs font-black transition disabled:cursor-not-allowed disabled:border-slate-500/30 disabled:text-slate-500 ${
                isSavedSymbol
                  ? "border-emerald-300/35 text-emerald-200"
                  : "border-accent-blue/30 text-accent-blue hover:text-cyan-100"
              }`}
            >
              {isSavedSymbol ? <BookmarkCheck size={13} aria-hidden /> : <Bookmark size={13} aria-hidden />}
              {isSavedSymbol ? "저장됨" : canSaveSelectedSymbol ? "관심 추가" : "한도 도달"}
            </button>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {visibleSavedItems.map((item) => (
              <button
                key={item.symbol}
                type="button"
                onClick={() => selectSymbol(item.symbol)}
                className={`min-h-10 shrink-0 border-b-2 px-1 text-left transition ${
                  symbol === item.symbol
                    ? "border-emerald-300 text-emerald-200"
                    : "border-transparent bg-transparent text-slate-200 hover:text-white"
                }`}
              >
                <span className="block text-xs font-black">{item.symbol}</span>
                <span className={`block max-w-[110px] truncate text-[10px] font-bold ${symbol === item.symbol ? "text-emerald-200/80" : "text-slate-500"}`}>
                  {item.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {(["all", ...groupOrder] as AssetGroupFilter[]).map((group) => (
            <button
              key={group}
              type="button"
              onClick={() => onSelectedGroupChange(group)}
              className={`min-h-8 border-b-2 px-0 text-[11px] font-black transition ${
                selectedGroup === group
                  ? "border-white text-white"
                  : "border-transparent bg-transparent text-slate-300 hover:text-white"
              }`}
            >
              {group === "all" ? "전체" : groupLabels[group]}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {visibleUniverse.map((item) => (
            <button
              key={item.symbol}
              type="button"
              onClick={() => onSelectSymbol(item.symbol)}
              className={`min-h-12 border-b-2 px-0 text-left transition ${
                symbol === item.symbol
                  ? "border-accent-blue text-accent-blue"
                  : "border-transparent bg-transparent text-slate-200 hover:text-white"
              }`}
            >
              <span className="block text-sm font-black">{item.symbol}</span>
              <span className={`block truncate text-[11px] font-bold ${symbol === item.symbol ? "text-accent-blue/80" : "text-slate-500"}`}>
                {item.name}
              </span>
            </button>
          ))}
        </div>
        {visibleUniverse.length === 0 ? (
          <p className="mt-3 border-y border-white/10 py-3 text-xs font-bold text-slate-500">
            검색 결과가 없습니다. 종목명이나 심볼을 조금 짧게 입력해 보세요.
          </p>
        ) : null}
      </div>
    </>
  );
}
