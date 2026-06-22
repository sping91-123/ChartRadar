"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Check, ChevronRight, HelpCircle, Loader2, RefreshCw, Settings2, X } from "lucide-react";
import { ActionButton } from "@/components/ui/DesignPrimitives";
import { hasMarketEntitlement } from "@/lib/billing";
import { withSupabaseAuth } from "@/lib/authFetch";
import {
  basicHomeInterestChangeStatus,
  defaultHomeInterestCoin,
  homeInterestMaxBasic,
  homeInterestMaxPro,
  readHomeInterestCoins,
  recordBasicHomeInterestChange,
  sameHomeCoin,
  writeHomeInterestCoins,
  type HomeInterestCoin
} from "@/lib/homeInterestCoins";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";
import type { CryptoExchangeId, CryptoExchangeMarket, CryptoHomeSnapshot, CryptoHomeTicker } from "@/lib/server/cryptoExchangeData";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; snapshot: CryptoHomeSnapshot }
  | { status: "error"; message: string };

type MarketLoadState =
  | { status: "idle"; markets: CryptoExchangeMarket[] }
  | { status: "loading"; markets: CryptoExchangeMarket[] }
  | { status: "ready"; markets: CryptoExchangeMarket[] }
  | { status: "error"; markets: CryptoExchangeMarket[]; message: string };

interface ExchangeOption {
  id: CryptoExchangeId;
  label: string;
}

const exchangeOptions: ExchangeOption[] = [
  { id: "binance", label: "Binance" },
  { id: "okx", label: "OKX" },
  { id: "bingx", label: "BingX" },
  { id: "bitget", label: "Bitget" },
  { id: "gateio", label: "Gate.io" },
  { id: "bybit", label: "Bybit" }
];

const exchangeLabels = new Map(exchangeOptions.map((item) => [item.id, item.label]));

function formatPrice(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) return "-";
  const digits = value >= 100 ? 2 : value >= 10 ? 3 : value >= 1 ? 4 : 6;
  return `$${value.toLocaleString("ko-KR", { maximumFractionDigits: digits })}`;
}

function formatPercent(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "변동률 확인 중";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function formatNumber(value: number | null | undefined, digits = 0) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "확인 중";
  return value.toLocaleString("ko-KR", { maximumFractionDigits: digits });
}

function formatVolume(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "거래량 확인 중";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  return formatNumber(value, 0);
}

function formatNextChangeAt(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "내일";
  return date.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function trendScoreClass(score: number) {
  if (score >= 62) return "text-ui-long";
  if (score <= 38) return "text-ui-short";
  return "text-ui-watch";
}

function directionAccent(direction: CryptoHomeSnapshot["direction"]) {
  if (direction === "up") return { text: "text-ui-long", border: "border-ui-long/45", bg: "bg-ui-long/10", bar: "bg-ui-long" };
  if (direction === "down") return { text: "text-ui-short", border: "border-ui-short/45", bg: "bg-ui-short/10", bar: "bg-ui-short" };
  return { text: "text-ui-watch", border: "border-ui-watch/45", bg: "bg-ui-watch/10", bar: "bg-ui-watch" };
}

function DirectionMark({ direction }: { direction: CryptoHomeSnapshot["direction"] }) {
  if (direction === "up") return <ArrowUp size={14} aria-hidden />;
  if (direction === "down") return <ArrowDown size={14} aria-hidden />;
  return <span aria-hidden>━</span>;
}

function arrowCell(direction: string) {
  const up = direction === "bullish";
  const down = direction === "bearish";
  return (
    <span
      className={`mx-auto grid h-8 w-8 place-items-center rounded-ui-sm ${
        up ? "bg-ui-long/12 text-ui-long" : down ? "bg-ui-short/12 text-ui-short" : "bg-ui-inset text-ui-muted"
      }`}
      aria-label={up ? "상방" : down ? "하방" : "미확인"}
    >
      {up ? <ArrowUp size={16} aria-hidden /> : down ? <ArrowDown size={16} aria-hidden /> : "-"}
    </span>
  );
}

function detailedSymbol(coin: HomeInterestCoin) {
  return `${coin.base.toUpperCase()}USDT.P`;
}

function detailedAnalysisHref(coin: HomeInterestCoin) {
  const symbol = detailedSymbol(coin);
  const params = new URLSearchParams({ symbol, exchange: coin.exchangeId });
  const path = symbol === "BTCUSDT.P" || symbol === "ETHUSDT.P" ? "/crypto/perpetual" : "/crypto/perpetual/alts";
  return `${path}?${params.toString()}`;
}

function marketMatches(market: CryptoExchangeMarket, query: string) {
  const normalized = query.trim().toUpperCase();
  if (!normalized) return true;
  return (
    market.base.toUpperCase().includes(normalized) ||
    market.symbol.toUpperCase().includes(normalized) ||
    market.marketId.toUpperCase().includes(normalized)
  );
}

function compactAiText(text: string) {
  return text.replace(/[\u3400-\u9fff]/g, "").replace(/\s+/g, " ").trim();
}

function readableParagraphs(text: string) {
  return compactAiText(text)
    .split(/(?<=[.!?。])\s+|\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);
}

function SnapshotSkeleton() {
  return (
    <section className="space-y-2 py-2">
      <div className="h-24 animate-pulse rounded-ui-md bg-ui-elevated/45" />
      <div className="grid grid-cols-3 gap-2">
        <div className="h-16 animate-pulse rounded-ui-sm bg-ui-elevated/30" />
        <div className="h-16 animate-pulse rounded-ui-sm bg-ui-elevated/30" />
        <div className="h-16 animate-pulse rounded-ui-sm bg-ui-elevated/30" />
      </div>
    </section>
  );
}

function CoinSelectionTabs({
  coins,
  activeCoin,
  onSelect
}: {
  coins: HomeInterestCoin[];
  activeCoin: HomeInterestCoin;
  onSelect: (coin: HomeInterestCoin) => void;
}) {
  if (coins.length <= 1) return null;
  return (
    <div className="flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="관심코인">
      {coins.map((coin) => {
        const active = sameHomeCoin(coin, activeCoin);
        return (
          <button
            key={`${coin.exchangeId}:${coin.symbol}`}
            type="button"
            onClick={() => onSelect(coin)}
            className={`min-h-10 shrink-0 rounded-ui-sm px-3 text-sm font-semibold transition ${
              active ? "bg-ui-brand text-white" : "bg-ui-elevated text-ui-muted hover:bg-ui-inset hover:text-ui-text"
            }`}
            role="tab"
            aria-selected={active}
          >
            {coin.base}
          </button>
        );
      })}
    </div>
  );
}

function StructureTable({ snapshot }: { snapshot: CryptoHomeSnapshot }) {
  return (
    <section className="rounded-ui-md bg-ui-elevated/45 px-3 py-3">
      <p className="text-sm font-black text-ui-text">MSB / CHoCH</p>
      <div className="mt-3 grid grid-cols-[3.75rem_repeat(5,minmax(2.4rem,1fr))] items-center gap-1 text-center text-[11px] font-black text-ui-subtle">
        <span className="text-left">프레임</span>
        {snapshot.timeframes.map((item) => (
          <span key={item.timeframe}>{item.label}</span>
        ))}
      </div>
      <div className="mt-2 grid gap-2">
        <div className="grid grid-cols-[3.75rem_repeat(5,minmax(2.4rem,1fr))] items-center gap-1">
          <span className="text-sm font-black text-ui-text">MSB</span>
          {snapshot.timeframes.map((item) => (
            <span key={item.timeframe}>{arrowCell(item.msb)}</span>
          ))}
        </div>
        <div className="grid grid-cols-[3.75rem_repeat(5,minmax(2.4rem,1fr))] items-center gap-1">
          <span className="text-sm font-black text-ui-text">CHoCH</span>
          {snapshot.timeframes.map((item) => (
            <span key={item.timeframe}>{arrowCell(item.choch)}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

function PressurePanel({
  snapshot,
  onShowEvidence
}: {
  snapshot: CryptoHomeSnapshot;
  onShowEvidence: () => void;
}) {
  const { pressure } = snapshot;
  const total = pressure.longScore + pressure.shortScore;
  const markerPercent = total > 0 ? Math.max(4, Math.min(96, (pressure.longScore / total) * 100)) : 50;
  const dominantLabel =
    pressure.longScore > pressure.shortScore + 8 ? "롱 압력 우세" : pressure.shortScore > pressure.longScore + 8 ? "숏 압력 우세" : "롱/숏 균형";
  return (
    <section className="rounded-ui-md bg-ui-elevated/45 px-3 py-3">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-ui-label font-semibold uppercase tracking-[0.12em] text-ui-subtle">롱/숏 우세 압력</p>
          <p className="mt-1 text-sm font-semibold text-ui-text">{dominantLabel}</p>
        </div>
        <ActionButton tone="ghost" onClick={onShowEvidence} className="min-h-9 shrink-0 px-2.5 text-xs">
          근거 보기
        </ActionButton>
      </div>
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs font-black">
          <span className="text-ui-short">숏 {pressure.shortScore}점</span>
          <span className="text-ui-long">롱 {pressure.longScore}점</span>
        </div>
        <div className="relative mt-2 h-4 rounded-full bg-gradient-to-r from-ui-short via-ui-line to-ui-long">
          <span className="absolute left-1/2 top-1/2 h-7 w-px -translate-y-1/2 bg-white/80" aria-hidden />
          <span
            className="absolute top-1/2 h-8 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ui-brand shadow-[0_0_0_3px_rgba(255,255,255,0.12)]"
            style={{ left: `${markerPercent}%` }}
            aria-hidden
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-ui-subtle">
          <span>숏 쏠림</span>
          <span>균형</span>
          <span>롱 쏠림</span>
        </div>
      </div>
    </section>
  );
}

function PriceDirectionPanel({
  snapshot,
  ticker,
  onShowScore,
  onOpenSettings
}: {
  snapshot: CryptoHomeSnapshot;
  ticker: CryptoHomeTicker | null;
  onShowScore: () => void;
  onOpenSettings: () => void;
}) {
  const direction = directionAccent(snapshot.direction);
  const changePercent = ticker?.changePercent ?? snapshot.changePercent;
  const scorePercent = Math.max(4, Math.min(96, snapshot.compositeScore));
  const scoreZone = snapshot.compositeScore >= 62 ? "상방권" : snapshot.compositeScore <= 38 ? "하방권" : "중립권";
  return (
    <section className="rounded-ui-md border border-ui-line/70 bg-ui-elevated/50 px-3 py-3">
      <div className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-ui-subtle">관심코인</p>
          <p className="mt-1 text-sm font-black leading-4 text-ui-muted">{snapshot.selection.exchangeLabel}</p>
          <h1 className="mt-0.5 text-2xl font-black leading-7 tracking-tight text-ui-text [word-break:keep-all]">{snapshot.selection.base}USDT.P</h1>
        </div>
        <ActionButton tone="secondary" onClick={onOpenSettings} className="min-h-9 shrink-0 px-2.5 text-xs">
          <Settings2 size={15} aria-hidden />
          관심코인 설정
        </ActionButton>
      </div>

      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p className="text-3xl font-black tracking-tight text-ui-text">{formatPrice(ticker?.price ?? snapshot.price)}</p>
          <p className={`mt-1 text-sm font-black ${changePercent !== null && changePercent !== undefined && changePercent < 0 ? "text-ui-short" : "text-ui-long"}`}>
            24h {formatPercent(changePercent)}
          </p>
        </div>
        <Link
          href={detailedAnalysisHref(snapshot.selection)}
          className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-ui-sm bg-ui-inset px-2.5 text-xs font-black text-ui-text transition hover:bg-ui-line/60"
        >
          상세분석
          <ChevronRight size={14} aria-hidden />
        </Link>
      </div>

      <div className={`mt-3 rounded-ui-md border px-3 py-3 ${direction.border} ${direction.bg}`}>
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-black text-ui-subtle">현재 방향</p>
            <div className="mt-2 flex min-w-0 items-center gap-2">
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ui-panel/80 ${direction.text}`}>
                <DirectionMark direction={snapshot.direction} />
              </span>
              <span className={`min-w-0 text-2xl font-black leading-7 ${direction.text}`}>{snapshot.directionLabel}</span>
            </div>
            <p className="mt-1 text-xs font-semibold leading-5 text-ui-muted">프레임별 MSB와 CHoCH를 종합한 구조 점수입니다.</p>
          </div>
          <button
            type="button"
            onClick={onShowScore}
            className="min-h-[4.75rem] w-[5.75rem] shrink-0 rounded-ui-sm border border-ui-line/70 bg-ui-panel/80 px-2.5 py-2 text-left transition hover:bg-ui-panel"
            aria-label="종합점수 근거 보기"
            title="종합점수 근거"
          >
            <span className="flex items-center justify-between gap-1 text-[10px] font-black text-ui-subtle">
              종합점수
              <HelpCircle size={12} aria-hidden />
            </span>
            <span className={`mt-1 block text-2xl font-black leading-7 ${trendScoreClass(snapshot.compositeScore)}`}>{snapshot.compositeScore}점</span>
            <span className="mt-0.5 block text-[11px] font-bold text-ui-muted">{scoreZone}</span>
          </button>
        </div>
        <div className="mt-3 rounded-ui-sm bg-ui-panel/55 px-2.5 py-2">
          <div className="flex items-center justify-between text-[10px] font-black text-ui-subtle">
            <span>하방</span>
            <span>{scoreZone}</span>
            <span>상방</span>
          </div>
          <div className="relative mt-2 h-1.5 rounded-full bg-ui-line">
            <span className={`absolute inset-y-0 left-0 rounded-full ${direction.bar}`} style={{ width: `${scorePercent}%` }} aria-hidden />
            <span
              className="absolute top-1/2 h-4 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_2px_rgba(255,255,255,0.12)]"
              style={{ left: `${scorePercent}%` }}
              aria-hidden
            />
          </div>
          <div className="mt-1 grid grid-cols-3 text-[10px] font-semibold text-ui-subtle">
            <span>0</span>
            <span className="text-center">50</span>
            <span className="text-right">100</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function strategyPartRows(body: string) {
  const labels = ["분석", "근거", "확인"];
  const labeled = body
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, ...rest] = line.split(":");
      const normalizedLabel = label.trim();
      return labels.includes(normalizedLabel) && rest.length
        ? { label: normalizedLabel, text: rest.join(":").trim() }
        : null;
    })
    .filter((item): item is { label: string; text: string } => Boolean(item));

  if (labeled.length) return labeled;

  return body
    .split(/(?<=[.!?。])\s+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((text, index) => ({ label: labels[index] ?? "확인", text }));
}

function StrategyRadar({
  snapshot,
  aiText,
  aiStatus
}: {
  snapshot: CryptoHomeSnapshot;
  aiText: string;
  aiStatus: "idle" | "loading" | "ready" | "error";
}) {
  return (
    <section className="space-y-3 rounded-ui-md bg-ui-elevated/45 px-3 py-3">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-ui-label font-semibold uppercase tracking-[0.12em] text-ui-subtle">매매 전략 레이더</p>
          <p className="mt-1 text-sm font-black text-ui-text">현재 구조 기준 요약 분석</p>
        </div>
        {aiStatus === "loading" ? <Loader2 className="mt-1 shrink-0 animate-spin text-ui-muted" size={16} aria-hidden /> : null}
      </div>
      {aiText ? (
        <div className="grid gap-2 border-t border-ui-line pt-3 text-sm leading-6 text-ui-muted [word-break:keep-all]">
          {readableParagraphs(aiText).map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      ) : null}
      <div className="grid gap-2 md:grid-cols-3">
        {snapshot.strategyRadar.map((item) => (
          <article key={item.title} className="min-w-0 rounded-ui-sm border border-ui-line/70 bg-ui-inset/35 px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-black leading-5 text-ui-text [word-break:keep-all]">{item.title}</p>
              <span
                className={`rounded-full px-2 py-1 text-[10px] font-black ${
                  item.tone === "long"
                    ? "bg-ui-long/10 text-ui-long"
                    : item.tone === "short" || item.tone === "risk"
                      ? "bg-ui-short/10 text-ui-short"
                      : "bg-ui-watch/10 text-ui-watch"
                }`}
              >
                현재 판정
              </span>
            </div>
            <div className="mt-3 grid gap-2">
              {strategyPartRows(item.body).map((part) => (
                <div key={`${item.title}-${part.label}`} className="grid grid-cols-[2.4rem_1fr] gap-2 text-xs leading-5">
                  <span className="font-black text-ui-subtle">{part.label}</span>
                  <span className="font-medium text-ui-muted [word-break:keep-all]">{part.text}</span>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function EvidenceDialog({ snapshot, onClose }: { snapshot: CryptoHomeSnapshot; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-3 py-5" role="dialog" aria-modal="true" aria-labelledby="pressure-evidence-title">
      <div className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-ui-md bg-ui-panel p-4 text-ui-text">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p id="pressure-evidence-title" className="text-base font-black">
              롱/숏 압력 근거
            </p>
            <p className="mt-1 text-xs font-semibold text-ui-muted">
              {snapshot.pressure.source === "binance-public" ? "Binance 공개 파생 데이터" : "CCXT 공개 데이터 일부"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center text-ui-muted transition hover:text-ui-text" aria-label="닫기">
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="mt-4 divide-y divide-ui-line rounded-ui-sm bg-ui-inset/30">
          {snapshot.pressure.evidence.map((item) => (
            <div key={item.label} className="flex min-w-0 items-start justify-between gap-3 px-3 py-2.5">
              <span className="text-xs font-semibold text-ui-muted">{item.label}</span>
              <span className={`text-right text-sm font-semibold ${item.available ? "text-ui-text" : "text-ui-subtle"}`}>{item.value}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs leading-5 text-ui-muted [word-break:keep-all]">
          거래소별 공개 범위가 달라 값이 비어 있을 수 있습니다. 데이터 없음 항목이 많을수록 압력 점수는 참고용으로만 봐야 합니다.
        </p>
      </div>
    </div>
  );
}

function scoreStateLabel(value: string) {
  if (value === "bullish") return "상방";
  if (value === "bearish") return "하방";
  if (value === "neutral") return "중립";
  return "미확인";
}

function signed(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
}

function ScoreDialog({ snapshot, onClose }: { snapshot: CryptoHomeSnapshot; onClose: () => void }) {
  const { scoreBreakdown } = snapshot;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-3 py-5" role="dialog" aria-modal="true" aria-labelledby="score-evidence-title">
      <div className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-ui-md bg-ui-panel p-4 text-ui-text">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p id="score-evidence-title" className="text-base font-black">
              종합점수 근거
            </p>
            <p className="mt-1 text-xs font-semibold text-ui-muted">MSB, CHoCH, 프레임 가중치와 보정값을 합산했습니다.</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center text-ui-muted transition hover:text-ui-text" aria-label="닫기">
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="mt-4 rounded-ui-sm bg-ui-inset/35 px-3 py-3">
          <div className="flex items-end justify-between gap-3">
            <span className={`text-3xl font-black ${trendScoreClass(scoreBreakdown.finalScore)}`}>{scoreBreakdown.finalScore}점</span>
            <span className="text-right text-xs font-semibold leading-5 text-ui-muted">
              원점수 {scoreBreakdown.rawScore.toFixed(2)}
              <br />
              보정 후 {scoreBreakdown.adjustedScore.toFixed(2)}
            </span>
          </div>
          <p className="mt-2 text-xs font-semibold text-ui-muted">
            {scoreBreakdown.adjustmentLabel} {signed(scoreBreakdown.adjustmentValue)}
          </p>
        </div>

        <div className="mt-4 divide-y divide-ui-line rounded-ui-sm bg-ui-inset/25">
          {scoreBreakdown.rows.map((row) => (
            <div key={row.timeframe} className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-2 px-3 py-2.5 text-xs">
              <span className="font-black text-ui-text">{row.label}</span>
              <span className="min-w-0 font-semibold leading-5 text-ui-muted">
                MSB {scoreStateLabel(row.msb)} {signed(row.msbContribution)} · CHoCH {scoreStateLabel(row.choch)} {signed(row.chochContribution)}
              </span>
              <span className={`font-black ${row.totalContribution > 0 ? "text-ui-long" : row.totalContribution < 0 ? "text-ui-short" : "text-ui-subtle"}`}>
                {signed(row.totalContribution)}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs leading-5 text-ui-muted [word-break:keep-all]">
          상위 프레임의 가중치를 더 크게 두고, 횡보나 압축 구간에서는 점수를 50점 쪽으로 낮춰 과한 방향 판단을 줄입니다.
        </p>
      </div>
    </div>
  );
}

function SettingsDialog({
  coins,
  isPaid,
  onSave,
  onClose
}: {
  coins: HomeInterestCoin[];
  isPaid: boolean;
  onSave: (coins: HomeInterestCoin[]) => void;
  onClose: () => void;
}) {
  const [exchangeId, setExchangeId] = useState<CryptoExchangeId>(coins[0]?.exchangeId ?? "binance");
  const [marketState, setMarketState] = useState<MarketLoadState>({ status: "idle", markets: [] });
  const [query, setQuery] = useState("");
  const [draftCoins, setDraftCoins] = useState<HomeInterestCoin[]>(coins);
  const [error, setError] = useState("");
  const basicStatus = basicHomeInterestChangeStatus();
  const limit = isPaid ? homeInterestMaxPro : homeInterestMaxBasic;

  useEffect(() => {
    let cancelled = false;
    async function loadMarkets() {
      setMarketState((state) => ({ status: "loading", markets: state.markets }));
      try {
        const response = await fetch(`/api/crypto-exchange-markets?exchange=${encodeURIComponent(exchangeId)}`, { cache: "no-store" });
        const payload = (await response.json()) as { markets?: CryptoExchangeMarket[]; error?: string };
        if (!response.ok || !Array.isArray(payload.markets)) throw new Error(payload.error ?? "코인 목록을 불러오지 못했습니다.");
        if (!cancelled) setMarketState({ status: "ready", markets: payload.markets });
      } catch (loadError) {
        if (!cancelled) {
          setMarketState((state) => ({
            status: "error",
            markets: state.markets,
            message: loadError instanceof Error ? loadError.message : "코인 목록을 불러오지 못했습니다."
          }));
        }
      }
    }
    void loadMarkets();
    return () => {
      cancelled = true;
    };
  }, [exchangeId]);

  const visibleMarkets = useMemo(() => {
    const trimmedQuery = query.trim();
    return marketState.markets.filter((market) => marketMatches(market, query)).slice(0, trimmedQuery ? 120 : 60);
  }, [marketState.markets, query]);

  const toggleMarket = (market: CryptoExchangeMarket) => {
    setError("");
    const selected = draftCoins.some((coin) => sameHomeCoin(coin, market));
    if (selected) {
      const next = draftCoins.filter((coin) => !sameHomeCoin(coin, market));
      setDraftCoins(next.length ? next : [defaultHomeInterestCoin]);
      return;
    }
    if (!isPaid) {
      setDraftCoins([market]);
      return;
    }
    if (draftCoins.length >= limit) {
      setError(`Pro는 관심코인을 최대 ${limit}개까지 설정할 수 있습니다.`);
      return;
    }
    setDraftCoins([...draftCoins, market]);
  };

  const save = () => {
    const normalized = draftCoins.slice(0, limit);
    if (!normalized.length) {
      setError("관심코인을 1개 이상 선택해 주세요.");
      return;
    }
    const changed = !isPaid && !sameHomeCoin(normalized[0], coins[0] ?? defaultHomeInterestCoin);
    if (changed && basicStatus.used) {
      setError(`Basic은 하루 1회만 변경할 수 있습니다. 다음 변경 가능 시간: ${formatNextChangeAt(basicStatus.nextChangeAt)}`);
      return;
    }
    if (changed) recordBasicHomeInterestChange();
    onSave(normalized);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-3 py-5" role="dialog" aria-modal="true" aria-labelledby="interest-settings-title">
      <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-ui-md bg-ui-panel text-ui-text">
        <header className="flex items-start justify-between gap-3 border-b border-ui-line px-4 py-4">
          <div className="min-w-0">
            <p id="interest-settings-title" className="text-base font-black">
              관심코인 설정
            </p>
            <p className="mt-1 text-xs font-semibold text-ui-muted">
              {isPaid ? `Pro는 최대 ${homeInterestMaxPro}개, 변경 제한 없음` : `Basic은 ${homeInterestMaxBasic}개, 하루 1회 변경`}
            </p>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center text-ui-muted transition hover:text-ui-text" aria-label="닫기">
            <X size={18} aria-hidden />
          </button>
        </header>
        <div className="overflow-y-auto px-4 py-4">
          <div className="rounded-ui-sm border border-ui-watch/35 bg-ui-watch/10 px-3 py-2.5 text-xs font-black leading-5 text-ui-watch [word-break:keep-all]">
            {isPaid ? "Pro는 관심코인 최대 5개, 변경 제한 없음" : "Basic은 관심코인 1개, 하루 1회 변경"}
          </div>

          <div className="mt-2 rounded-ui-sm bg-ui-inset/40 px-3 py-2 text-xs font-semibold leading-5 text-ui-muted [word-break:keep-all]">
            거래량이 낮거나 파생 데이터가 부족한 거래소/종목은 분석 정확도가 떨어질 수 있습니다.
          </div>

          <div className="mt-4 grid grid-cols-3 gap-1 sm:grid-cols-6">
            {exchangeOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setExchangeId(option.id)}
                className={`min-h-10 rounded-ui-sm px-2 text-xs font-black transition ${
                  exchangeId === option.id ? "bg-ui-brand text-white" : "bg-ui-elevated text-ui-muted hover:bg-ui-inset hover:text-ui-text"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <label className="mt-4 block">
            <span className="text-xs font-black text-ui-subtle">코인 검색</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="mt-1 h-11 w-full rounded-ui-sm border border-ui-line bg-ui-inset px-3 text-sm font-semibold text-ui-text outline-none placeholder:text-ui-subtle focus:border-ui-brand"
              placeholder="BTC, ETH, SOL..."
            />
          </label>
          <p className="mt-2 text-xs font-semibold leading-5 text-ui-muted [word-break:keep-all]">
            기본 목록은 거래량 높은 순으로 일부만 보여줍니다. 목록에 없으면 검색하세요.
          </p>

          <div className="mt-3">
            <p className="text-xs font-black text-ui-subtle">현재 관심코인</p>
            <div className="mt-1 flex min-w-0 flex-wrap gap-1">
              {draftCoins.map((coin) => (
                <span key={`${coin.exchangeId}:${coin.symbol}`} className="inline-flex min-h-8 items-center gap-1 rounded-ui-sm bg-ui-brand/15 px-2.5 text-xs font-black text-ui-text">
                  {coin.exchangeLabel} {coin.base}/USDT
                </span>
              ))}
            </div>
          </div>

          {marketState.status === "error" ? (
            <p className="mt-3 text-sm font-semibold text-ui-risk">{marketState.message}</p>
          ) : null}
          {error ? <p className="mt-3 text-sm font-semibold text-ui-risk">{error}</p> : null}

          <div className="mt-4 max-h-[42dvh] divide-y divide-ui-line overflow-y-auto rounded-ui-sm bg-ui-inset/25">
            {marketState.status === "loading" && !visibleMarkets.length ? (
              <div className="flex min-h-24 items-center justify-center gap-2 text-sm font-semibold text-ui-muted">
                <Loader2 className="animate-spin" size={16} aria-hidden />
                {exchangeLabels.get(exchangeId)} USDT 선물 목록 확인 중
              </div>
            ) : null}
            {visibleMarkets.map((market) => {
              const selected = draftCoins.some((coin) => sameHomeCoin(coin, market));
              return (
                <button
                  key={`${market.exchangeId}:${market.symbol}`}
                  type="button"
                  onClick={() => toggleMarket(market)}
                  className="flex min-h-12 w-full items-center justify-between gap-3 px-3 text-left transition hover:bg-ui-elevated/65"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-black text-ui-text">{market.base}</span>
                  <span className="block truncate text-xs font-semibold text-ui-muted">
                    {market.exchangeLabel} · {market.symbol}
                  </span>
                  <span className="mt-0.5 block text-[11px] font-semibold text-ui-subtle">24h 거래량 {formatVolume(market.quoteVolume)}</span>
                </span>
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-ui-sm ${selected ? "bg-ui-brand text-white" : "bg-ui-elevated text-ui-subtle"}`}>
                    {selected ? <Check size={15} aria-hidden /> : <ChevronRight size={15} aria-hidden />}
                  </span>
                </button>
              );
            })}
            {marketState.status !== "loading" && !visibleMarkets.length ? (
              <div className="flex min-h-24 items-center justify-center text-sm font-semibold text-ui-muted">검색 결과가 없습니다.</div>
            ) : null}
          </div>
        </div>
        <footer className="grid gap-2 border-t border-ui-line px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <p className="text-xs font-semibold text-ui-muted">
            {isPaid ? `${draftCoins.length}/${homeInterestMaxPro}개 선택` : basicStatus.used ? `오늘 변경 사용 완료 · ${formatNextChangeAt(basicStatus.nextChangeAt)} 이후 가능` : "오늘 1회 변경 가능"}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <ActionButton tone="ghost" onClick={onClose}>
              취소
            </ActionButton>
            <ActionButton tone="primary" onClick={save}>
              저장
            </ActionButton>
          </div>
        </footer>
      </div>
    </div>
  );
}

export function CoinRadarHomePanel() {
  const { profile } = useSupabaseAuth();
  const isPaid = hasMarketEntitlement(profile?.plan, "crypto");
  const [coins, setCoins] = useState<HomeInterestCoin[]>([defaultHomeInterestCoin]);
  const [activeCoin, setActiveCoin] = useState<HomeInterestCoin>(defaultHomeInterestCoin);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [tickerState, setTickerState] = useState<CryptoHomeTicker | null>(null);
  const [aiStatus, setAiStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [aiText, setAiText] = useState("");

  useEffect(() => {
    const stored = readHomeInterestCoins(isPaid);
    setCoins(stored);
    setActiveCoin((current) => stored.find((coin) => sameHomeCoin(coin, current)) ?? stored[0] ?? defaultHomeInterestCoin);
  }, [isPaid]);

  const loadSnapshot = useCallback(async (coin: HomeInterestCoin) => {
    setState({ status: "loading" });
    setAiText("");
    setAiStatus("idle");
    try {
      const params = new URLSearchParams({ exchange: coin.exchangeId, symbol: coin.symbol });
      const response = await fetch(`/api/crypto-home-snapshot?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json()) as { snapshot?: CryptoHomeSnapshot; error?: string };
      if (!response.ok || !payload.snapshot) throw new Error(payload.error ?? "홈 분석을 불러오지 못했습니다.");
      setState({ status: "ready", snapshot: payload.snapshot });
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "홈 분석을 불러오지 못했습니다." });
    }
  }, []);

  useEffect(() => {
    void loadSnapshot(activeCoin);
  }, [activeCoin, loadSnapshot]);

  useEffect(() => {
    if (state.status !== "ready") {
      setTickerState(null);
      return;
    }

    let cancelled = false;
    const { selection, price, changePercent, quoteVolume, updatedAt } = state.snapshot;
    setTickerState({ selection, price, changePercent, quoteVolume, updatedAt });

    async function loadTicker() {
      try {
        const params = new URLSearchParams({ exchange: selection.exchangeId, symbol: selection.symbol });
        const response = await fetch(`/api/crypto-home-ticker?${params.toString()}`, { cache: "no-store" });
        const payload = (await response.json()) as { ticker?: CryptoHomeTicker };
        if (!cancelled && response.ok && payload.ticker) {
          setTickerState(payload.ticker);
        }
      } catch {
        // Keep the last visible price. The full snapshot refresh handles deeper failures.
      }
    }

    void loadTicker();
    const timer = window.setInterval(loadTicker, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [state]);

  useEffect(() => {
    if (state.status !== "ready") return;
    let cancelled = false;
    const snapshot = state.snapshot;
    async function loadAi() {
      setAiStatus("loading");
      try {
        const response = await fetch(
          "/api/ai/market-briefing",
          await withSupabaseAuth({
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(snapshot.aiInput)
          })
        );
        const payload = (await response.json()) as { briefing?: string };
        if (!response.ok || !payload.briefing) throw new Error("AI 요약을 불러오지 못했습니다.");
        if (!cancelled) {
          setAiText(payload.briefing);
          setAiStatus("ready");
        }
      } catch {
        if (!cancelled) setAiStatus("error");
      }
    }
    void loadAi();
    return () => {
      cancelled = true;
    };
  }, [state]);

  const saveCoins = (nextCoins: HomeInterestCoin[]) => {
    const stored = writeHomeInterestCoins(nextCoins, isPaid);
    setCoins(stored);
    setActiveCoin(stored[0] ?? defaultHomeInterestCoin);
    setSettingsOpen(false);
  };

  const activeSnapshot = state.status === "ready" ? state.snapshot : null;
  const visibleTicker = tickerState ?? (activeSnapshot ? {
    selection: activeSnapshot.selection,
    price: activeSnapshot.price,
    changePercent: activeSnapshot.changePercent,
    quoteVolume: activeSnapshot.quoteVolume,
    updatedAt: activeSnapshot.updatedAt
  } : null);

  return (
    <div className="space-y-3 pb-24 pt-2 sm:pb-8">
      {state.status === "loading" ? <SnapshotSkeleton /> : null}

      {state.status === "error" ? (
        <section className="rounded-ui-md bg-ui-elevated/45 px-4 py-5">
          <p className="text-base font-black text-ui-text">홈 분석을 불러오지 못했습니다.</p>
          <p className="mt-2 text-sm leading-6 text-ui-muted">{state.message}</p>
          <ActionButton tone="secondary" onClick={() => loadSnapshot(activeCoin)} className="mt-4">
            <RefreshCw size={15} aria-hidden />
            다시 불러오기
          </ActionButton>
        </section>
      ) : null}

      {activeSnapshot ? (
        <>
          <PriceDirectionPanel
            snapshot={activeSnapshot}
            ticker={visibleTicker}
            onShowScore={() => setScoreOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
          />

          <CoinSelectionTabs coins={coins} activeCoin={activeCoin} onSelect={setActiveCoin} />

          <StructureTable snapshot={activeSnapshot} />
          <PressurePanel snapshot={activeSnapshot} onShowEvidence={() => setEvidenceOpen(true)} />
          <StrategyRadar snapshot={activeSnapshot} aiText={aiText} aiStatus={aiStatus} />
        </>
      ) : null}

      {settingsOpen ? <SettingsDialog coins={coins} isPaid={isPaid} onSave={saveCoins} onClose={() => setSettingsOpen(false)} /> : null}
      {scoreOpen && activeSnapshot ? <ScoreDialog snapshot={activeSnapshot} onClose={() => setScoreOpen(false)} /> : null}
      {evidenceOpen && activeSnapshot ? <EvidenceDialog snapshot={activeSnapshot} onClose={() => setEvidenceOpen(false)} /> : null}
    </div>
  );
}
