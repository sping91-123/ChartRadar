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
          <div className="grid h-10 w-10 shrink-0 place-items-center text-ui-brand">
            <BarChart3 size={21} aria-hidden />
          </div>
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-ui-brand">자산레이더</p>
            <h2 className="mt-1 text-xl font-semibold text-ui-text">선택 자산 상세 판단</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ui-muted [overflow-wrap:anywhere] [word-break:keep-all]">
              글로벌 전체 판단 이후 개별 종목을 확인하는 심화 영역입니다.
              상단 대시보드의 시장 모드, 매크로 압력, 섹터 로테이션과 함께 해석하세요.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex min-h-10 items-center justify-center gap-2 border-b border-ui-brand/40 bg-transparent px-1 text-xs font-semibold text-ui-brand transition hover:border-ui-brand hover:text-ui-text"
        >
          <RefreshCw size={14} aria-hidden />
          새로고침
        </button>
      </div>

      <div className="mt-5 rounded-ui-lg border border-ui-line/25 bg-ui-panel/35 p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-ui-brand">
              <Sparkles size={13} aria-hidden />
              상세 확인할 글로벌 자산
            </p>
            <h3 className="mt-2 break-words text-2xl font-semibold text-ui-text">
              {symbol}{" "}
              <span className="ml-2 text-base font-medium text-ui-muted">{selectedInfo?.name ?? symbol}</span>
            </h3>
            <p className="mt-1 text-xs font-medium text-ui-subtle">
              {selectedInfo ? groupLabels[selectedInfo.group] : "관심 시장"} · {timeframe} · {radarModes.find((item) => item.value === radarMode)?.label ?? "종합"} 분석
            </p>
          </div>
          <label className="relative block lg:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ui-subtle" size={15} aria-hidden />
            <input
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="종목 검색"
              className="h-11 w-full border-b border-ui-line bg-transparent pl-8 pr-0 text-sm font-semibold text-ui-text outline-none transition placeholder:text-ui-subtle focus:border-ui-brand/70"
            />
          </label>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2 sm:flex sm:overflow-x-auto sm:pb-1 sm:[scrollbar-width:none] sm:[&::-webkit-scrollbar]:hidden">
          {featuredItems.map((item) => (
            <button
              key={item.symbol}
              type="button"
              onClick={() => selectSymbol(item.symbol)}
              className={`min-h-11 min-w-0 border-b-2 px-1 py-1 text-left transition sm:shrink-0 ${
                symbol === item.symbol
                  ? "border-ui-brand text-ui-brand"
                  : "border-transparent bg-transparent text-ui-muted hover:text-ui-text"
              }`}
            >
              <span className="block truncate text-sm font-semibold">{item.symbol}</span>
              <span className={`block truncate text-[10px] font-medium ${symbol === item.symbol ? "text-ui-brand/80" : "text-ui-subtle"}`}>
                {groupLabels[item.group]}
              </span>
            </button>
          ))}
        </div>

        <GlobalAssetChecklist selectedInfo={selectedInfo} />

        <div className="mt-4 rounded-ui-md bg-ui-inset/20 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold text-ui-text">관심 글로벌 종목</p>
              <p className="mt-1 text-[11px] font-medium text-ui-subtle">
                매일 보는 ETF와 종목을 저장하면 이곳에 고정됩니다. 미국장 30초 체크 이후 개별 판단을 이어가세요.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onToggleSavedSymbol(symbol)}
              disabled={!canSaveSelectedSymbol}
              className={`inline-flex min-h-9 items-center justify-center gap-1.5 border-b px-0 text-xs font-semibold transition disabled:cursor-not-allowed disabled:border-ui-line/40 disabled:text-ui-subtle ${
                isSavedSymbol
                  ? "border-emerald-300/35 text-emerald-200"
                  : "border-ui-brand/30 text-ui-brand hover:text-ui-text"
              }`}
            >
              {isSavedSymbol ? <BookmarkCheck size={13} aria-hidden /> : <Bookmark size={13} aria-hidden />}
              {isSavedSymbol ? "저장됨" : canSaveSelectedSymbol ? "관심 추가" : "한도 도달"}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 sm:flex-nowrap sm:overflow-x-auto sm:pb-1 sm:[scrollbar-width:none] sm:[&::-webkit-scrollbar]:hidden">
            {visibleSavedItems.map((item) => (
              <button
                key={item.symbol}
                type="button"
                onClick={() => selectSymbol(item.symbol)}
                className={`min-h-10 min-w-0 border-b-2 px-1 text-left transition sm:shrink-0 ${
                  symbol === item.symbol
                    ? "border-emerald-300 text-emerald-200"
                    : "border-transparent bg-transparent text-ui-muted hover:text-ui-text"
                }`}
              >
                <span className="block text-xs font-semibold">{item.symbol}</span>
                <span className={`block max-w-[110px] truncate text-[10px] font-medium ${symbol === item.symbol ? "text-emerald-200/80" : "text-ui-subtle"}`}>
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
              className={`min-h-8 border-b-2 px-0 text-[11px] font-semibold transition ${
                selectedGroup === group
                  ? "border-ui-text text-ui-text"
                  : "border-transparent bg-transparent text-ui-muted hover:text-ui-text"
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
                  ? "border-ui-brand text-ui-brand"
                  : "border-transparent bg-transparent text-ui-muted hover:text-ui-text"
              }`}
            >
              <span className="block text-sm font-semibold">{item.symbol}</span>
              <span className={`block truncate text-[11px] font-medium ${symbol === item.symbol ? "text-ui-brand/80" : "text-ui-subtle"}`}>
                {item.name}
              </span>
            </button>
          ))}
        </div>
        {visibleUniverse.length === 0 ? (
          <p className="mt-3 rounded-ui-sm bg-ui-inset/25 px-3 py-2 text-xs font-medium text-ui-muted">
            검색 결과가 없습니다. 종목명이나 심볼을 조금 짧게 입력해 보세요.
          </p>
        ) : null}
      </div>
    </>
  );
}
