"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  History,
  Link2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  TrendingUp
} from "lucide-react";
import { ActionButton, AppSurface, DataRow, PanelCard, SectionHeader, StatusPill } from "@/components/ui/DesignPrimitives";
import {
  TradeQualityAssessmentCard,
  type ExchangeTradeAssessmentView
} from "@/components/journal/TradeQualityAssessmentCard";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";

type DashboardTab = "summary" | "calendar" | "analysis" | "history";
type GroupKey = "providers" | "symbols" | "sides" | "strategies";

interface AnalyticsMetric {
  completedTrades: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number | null;
  netPnl: string;
  grossProfit: string;
  grossLoss: string;
  profitFactor: string | null;
  feeTotal: string;
  fundingTotal: string;
  maxRealizedDrawdown: string;
  reviewedTrades: number;
  principleComplianceRate: number | null;
}

interface AnalyticsGroup {
  key: string;
  label: string;
  sampleSize: number;
  sampleStatus: "insufficient" | "ready";
  metrics: AnalyticsMetric;
}

interface AnalyticsResponse {
  windowDays: 30 | 90;
  summary: AnalyticsMetric;
  summary30d: AnalyticsMetric;
  incompleteTrades: number;
  unreviewedTrades: number;
  nextAction: string;
  calendar: Array<{
    date: string;
    netPnl: string;
    trades: number;
    wins: number;
    losses: number;
    breakeven: number;
  }>;
  groups: Record<GroupKey, AnalyticsGroup[]> | null;
  canCrossAnalyze: boolean;
  connections: Array<{
    id: string;
    provider: "okx" | "bybit" | "bitget" | "bingx";
    status: string;
    lastSyncedAt: string | null;
    nextSyncAt: string;
    lastErrorCode: string | null;
  }>;
}

interface ExchangeReview {
  strategy_tags: string[];
  kept_principles: string[];
  broken_principles: string[];
  next_checkpoint: string;
  memo: string;
  reviewed_at: string;
}

interface ExchangePosition {
  id: string;
  kind: "exchange";
  provider: "okx" | "bybit" | "bitget" | "bingx";
  symbol: string;
  positionSide: "long" | "short";
  openedAt: string;
  closedAt: string;
  quantityBase: string;
  averageEntryPrice: string;
  averageExitPrice: string;
  realizedPnl: string;
  feeTotal: string;
  fundingTotal: string;
  netPnl: string;
  exitReason: "trade" | "liquidation" | "adl" | "delivery";
  quality: "complete" | "partial";
  warnings: string[];
  assessment: ExchangeTradeAssessmentView | null;
  review: ExchangeReview | null;
  decisionCandidate: {
    journalId: string;
    source: "snapshot" | "alert" | "news";
    savedAt: string;
    snapshotId: string | null;
    snapshotAvailable: boolean;
    asset: "btc" | "eth";
    headline: string;
    topRisk: string;
    primaryConditionLabel: string | null;
  } | null;
}

interface TradesResponse {
  windowDays: 30 | 90;
  positions: ExchangePosition[];
}

const tabs: Array<{ id: DashboardTab; label: string; icon: typeof BarChart3 }> = [
  { id: "summary", label: "요약", icon: ShieldCheck },
  { id: "calendar", label: "캘린더", icon: CalendarDays },
  { id: "analysis", label: "분석", icon: BarChart3 },
  { id: "history", label: "히스토리", icon: History }
];

const groupLabels: Record<GroupKey, string> = {
  providers: "거래소",
  symbols: "종목",
  sides: "롱·숏",
  strategies: "전략 태그"
};

const keptOptions = ["손절 기준 준수", "포지션 크기 준수", "상위 시간봉 확인", "기다렸다 진입"];
const brokenOptions = ["손절 늦춤", "비중 과다", "추격 진입", "근거 부족", "익절 성급함"];

function formatUsdt(value: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "대사 중";
  const sign = numeric > 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(numeric)} USDT`;
}

function formatPercent(value: number | null) {
  return value === null ? "기록 없음" : `${Math.round(value * 100)}%`;
}

function formatDate(value: string | null, includeTime = true) {
  if (!value) return "아직 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "확인 불가";
  return new Intl.DateTimeFormat("ko-KR", includeTime
    ? { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }
    : { month: "2-digit", day: "2-digit" }).format(date);
}

function providerLabel(provider: ExchangePosition["provider"]) {
  if (provider === "okx") return "OKX";
  if (provider === "bybit") return "Bybit";
  if (provider === "bitget") return "Bitget";
  return "BingX";
}

function connectionIssueCopy(status: string) {
  if (status === "permission_changed") return "거래소 키의 읽기 권한이 바뀌었습니다. 연결 관리에서 권한을 다시 확인해 주세요.";
  if (status === "ip_mismatch") return "거래소 키의 IP 제한으로 동기화가 차단됐습니다. 연결 관리에서 IP 제한을 끄거나 허용 목록을 확인해 주세요.";
  if (status === "rate_limited") return "거래소 요청 제한으로 최신 원장 확인이 지연되고 있습니다.";
  if (status === "provider_unavailable") return "거래소 응답 지연으로 최신 원장 확인을 마치지 못했습니다.";
  if (status === "partial") return "일부 체결·수수료·펀딩 대사가 남아 해당 거래는 핵심 통계에서 제외됩니다.";
  return "체결과 수수료·펀딩 이력을 동기화하고 있습니다.";
}

function formatDrawdown(value: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "계산 중";
  return `${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(Math.abs(numeric))} USDT`;
}

function formatProfitFactor(value: string | null) {
  if (value === "infinite") return "∞";
  return value ?? "표본 없음";
}

function exitReasonLabel(value: ExchangePosition["exitReason"]) {
  if (value === "liquidation") return "강제청산";
  if (value === "adl") return "ADL";
  if (value === "delivery") return "만기 정산";
  return "일반 청산";
}

function warningLabel(value: string) {
  if (value.includes("fee_quote")) return "수수료 환산 확인 필요";
  if (value.includes("funding") || value.includes("cashflow")) return "펀딩 대사 확인 필요";
  if (value.includes("order_context") || value.includes("position_context")) return "포지션 문맥 확인 필요";
  if (value.includes("initial_flat")) return "이력 시작 경계 확인 필요";
  if (value.includes("reconciliation")) return "거래소 표시 손익과 대사 필요";
  return "원장 일부 확인 필요";
}

function toneForPnl(value: string) {
  const numeric = Number(value);
  if (numeric > 0) return "text-ui-long";
  if (numeric < 0) return "text-ui-short";
  return "text-ui-muted";
}

function kstDate(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(value);
}

function shiftMonth(month: string, offset: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return `${year}년 ${monthNumber}월`;
}

async function apiError(response: Response) {
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  return payload?.error ?? "자동 복기 데이터를 불러오지 못했습니다.";
}

function ReviewEditor({
  position,
  accessToken,
  onSaved,
  onCancel
}: {
  position: ExchangePosition;
  accessToken: string;
  onSaved: () => Promise<void>;
  onCancel: () => void;
}) {
  const [strategyText, setStrategyText] = useState(position.review?.strategy_tags.join(", ") ?? "");
  const [kept, setKept] = useState(position.review?.kept_principles ?? []);
  const [broken, setBroken] = useState(position.review?.broken_principles ?? []);
  const [checkpoint, setCheckpoint] = useState(position.review?.next_checkpoint ?? "");
  const [memo, setMemo] = useState(position.review?.memo ?? "");
  const [linkDecisionCandidate, setLinkDecisionCandidate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  function toggle(list: string[], value: string) {
    return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
  }

  async function save() {
    setIsSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/journal/trades/${encodeURIComponent(position.id)}/review`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          strategyTags: strategyText.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 8),
          keptPrinciples: kept,
          brokenPrinciples: broken,
          nextCheckpoint: checkpoint.trim(),
          memo: memo.trim(),
          decisionCandidateJournalId: linkDecisionCandidate
            ? position.decisionCandidate?.journalId
            : undefined
        })
      });
      if (!response.ok) throw new Error(await apiError(response));
      const payload = await response.json() as { journalSaved?: boolean };
      if (payload.journalSaved === false) {
        setError("원칙 복기는 저장했지만 직접 복기 목록 반영에 실패했습니다. 새로고침 후 다시 확인해 주세요.");
        return;
      }
      await onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "복기를 저장하지 못했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AppSurface tone="inset" variant="report" padding="md" className="mt-3">
      <p className="text-sm font-black text-ui-text">{position.symbol} 기준 복기</p>
      <p className="mt-1 text-xs leading-5 text-ui-muted">체결내역에서 추측하지 않습니다. 직접 확인한 기준만 선택해 주세요.</p>
      {error ? <p className="mt-3 text-xs font-semibold text-ui-risk">{error}</p> : null}
      <div className="mt-4 grid gap-4">
        {position.decisionCandidate ? (
          <AppSurface tone="inset" variant="report" padding="md">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone="info">진입 전 저장 판단 후보</StatusPill>
              <span className="text-[11px] text-ui-subtle">
                {formatDate(position.decisionCandidate.savedAt)}
              </span>
            </div>
            <p className="mt-2 text-sm font-black leading-6 text-ui-text">
              {position.decisionCandidate.headline || "저장한 BTC·ETH 판단"}
            </p>
            {position.decisionCandidate.topRisk ? (
              <p className="mt-1 text-xs leading-5 text-ui-muted">
                먼저 확인할 리스크: {position.decisionCandidate.topRisk}
              </p>
            ) : null}
            {position.decisionCandidate.primaryConditionLabel ? (
              <p className="mt-1 text-xs leading-5 text-ui-muted">
                당시 확인 조건: {position.decisionCandidate.primaryConditionLabel}
              </p>
            ) : null}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs font-semibold text-ui-text">
                <input
                  type="checkbox"
                  checked={linkDecisionCandidate}
                  onChange={(event) => setLinkDecisionCandidate(event.target.checked)}
                  className="h-4 w-4 accent-ui-brand"
                />
                이 판단을 진입 근거로 확인하고 복기에 연결
              </label>
              {position.decisionCandidate.snapshotAvailable && position.decisionCandidate.snapshotId ? (
                <Link
                  href={`/crypto/perpetual?asset=${position.decisionCandidate.asset}&timeframe=15m&snapshot=${encodeURIComponent(position.decisionCandidate.snapshotId)}`}
                  className="inline-flex min-h-11 items-center text-xs font-semibold text-ui-brand"
                >
                  당시 판단 보기
                  <ChevronRight size={14} aria-hidden />
                </Link>
              ) : null}
            </div>
            <p className="mt-2 text-[11px] leading-5 text-ui-subtle">
              자동으로 확정하지 않습니다. 진입 6시간 전부터 진입 시각까지 이 계정에 저장한 가장 가까운 판단입니다.
            </p>
          </AppSurface>
        ) : null}
        <label className="grid gap-2 text-xs font-semibold text-ui-muted">
          전략 태그 · 쉼표로 구분
          <input
            value={strategyText}
            onChange={(event) => setStrategyText(event.target.value)}
            maxLength={260}
            placeholder="예: 지지 반등, 추세 추종"
            className="min-h-10 border-b border-ui-line bg-transparent text-sm text-ui-text outline-none focus:border-ui-brand"
          />
        </label>
        <div>
          <p className="text-xs font-semibold text-ui-muted">지킨 기준</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {keptOptions.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setKept((current) => toggle(current, item));
                  setBroken((current) => current.filter((value) => value !== item));
                }}
                className={`min-h-11 rounded-ui-sm px-3 text-xs font-semibold ${kept.includes(item) ? "bg-ui-long/15 text-ui-long" : "bg-ui-panel text-ui-muted"}`}
              >
                {kept.includes(item) ? <Check size={13} className="mr-1 inline" aria-hidden /> : null}
                {item}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-ui-muted">깨진 기준</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {brokenOptions.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setBroken((current) => toggle(current, item));
                  setKept((current) => current.filter((value) => value !== item));
                }}
                className={`min-h-11 rounded-ui-sm px-3 text-xs font-semibold ${broken.includes(item) ? "bg-ui-short/15 text-ui-short" : "bg-ui-panel text-ui-muted"}`}
              >
                {broken.includes(item) ? <Check size={13} className="mr-1 inline" aria-hidden /> : null}
                {item}
              </button>
            ))}
          </div>
        </div>
        <label className="grid gap-2 text-xs font-semibold text-ui-muted">
          다음 거래 전 체크
          <input
            value={checkpoint}
            onChange={(event) => setCheckpoint(event.target.value)}
            maxLength={500}
            placeholder="예: 손절 기준을 먼저 적고 진입"
            className="min-h-10 border-b border-ui-line bg-transparent text-sm text-ui-text outline-none focus:border-ui-brand"
          />
        </label>
        <label className="grid gap-2 text-xs font-semibold text-ui-muted">
          메모
          <textarea
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            maxLength={2000}
            rows={3}
            className="resize-none border-b border-ui-line bg-transparent py-2 text-sm leading-6 text-ui-text outline-none focus:border-ui-brand"
          />
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <ActionButton tone="primary" onClick={() => void save()} disabled={isSaving}>
            {isSaving ? <Loader2 className="animate-spin" size={16} aria-hidden /> : <CheckCircle2 size={16} aria-hidden />}
            복기 저장
          </ActionButton>
          <ActionButton tone="ghost" onClick={onCancel}>닫기</ActionButton>
        </div>
      </div>
    </AppSurface>
  );
}

export function ExchangeJournalDashboard({ canConnect }: { canConnect: boolean }) {
  const { session, user, isLoading: isAuthLoading } = useSupabaseAuth();
  const [tab, setTab] = useState<DashboardTab>("summary");
  const [groupKey, setGroupKey] = useState<GroupKey>("providers");
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [trades, setTrades] = useState<TradesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => kstDate(new Date()).slice(0, 7));
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const loadGenerationRef = useRef(0);
  const loadAbortRef = useRef<AbortController | null>(null);
  const identityRef = useRef(user?.id ?? "");
  const accessToken = session?.accessToken ?? "";

  const load = useCallback(async () => {
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    const generation = ++loadGenerationRef.current;
    if (!accessToken) {
      setAnalytics(null);
      setTrades(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const headers = { Authorization: `Bearer ${accessToken}` };
      const [analyticsResponse, tradesResponse] = await Promise.all([
        fetch("/api/journal/analytics", { headers, cache: "no-store", signal: controller.signal }),
        fetch("/api/journal/trades", { headers, cache: "no-store", signal: controller.signal })
      ]);
      if (!analyticsResponse.ok) throw new Error(await apiError(analyticsResponse));
      if (!tradesResponse.ok) throw new Error(await apiError(tradesResponse));
      const [nextAnalytics, nextTrades] = await Promise.all([
        analyticsResponse.json() as Promise<AnalyticsResponse>,
        tradesResponse.json() as Promise<TradesResponse>
      ]);
      if (controller.signal.aborted || generation !== loadGenerationRef.current) return;
      setAnalytics(nextAnalytics);
      setTrades(nextTrades);
    } catch (loadError) {
      if (controller.signal.aborted || generation !== loadGenerationRef.current) return;
      setAnalytics(null);
      setTrades(null);
      setError(loadError instanceof Error ? loadError.message : "자동 복기 데이터를 불러오지 못했습니다.");
    } finally {
      if (generation === loadGenerationRef.current) setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    identityRef.current = user?.id ?? "";
    loadGenerationRef.current += 1;
    loadAbortRef.current?.abort();
    setAnalytics(null);
    setTrades(null);
    setReviewingId(null);
    setSelectedCalendarDate(null);
    setError("");
    setIsLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void load();
    return () => loadAbortRef.current?.abort();
  }, [load]);

  const activeConnections = useMemo(
    () => analytics?.connections.filter((connection) => connection.status !== "disconnected") ?? [],
    [analytics?.connections]
  );

  const lastSyncedAt = useMemo(() => {
    const times = activeConnections
      .map((connection) => connection.lastSyncedAt)
      .filter((value): value is string => Boolean(value))
      .map(Date.parse)
      .filter(Number.isFinite);
    return times.length ? new Date(Math.max(...times)).toISOString() : null;
  }, [activeConnections]);

  const connectionIssue = useMemo(() => {
    const priority = [
      "permission_changed",
      "ip_mismatch",
      "rate_limited",
      "provider_unavailable",
      "partial",
      "syncing"
    ];
    return priority
      .map((status) => activeConnections.find((connection) => connection.status === status))
      .find(Boolean) ?? null;
  }, [activeConnections]);

  const calendarDays = useMemo(() => {
    const items = new Map(analytics?.calendar.map((item) => [item.date, item]) ?? []);
    const [year, monthNumber] = calendarMonth.split("-").map(Number);
    const firstWeekday = new Date(`${calendarMonth}-01T00:00:00+09:00`).getDay();
    const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    const cells: Array<{ key: string; day: number; item: AnalyticsResponse["calendar"][number] | null } | null> = [
      ...Array.from({ length: firstWeekday }, () => null)
    ];
    for (let day = 1; day <= daysInMonth; day += 1) {
      const key = `${calendarMonth}-${String(day).padStart(2, "0")}`;
      cells.push({ key, day, item: items.get(key) ?? null });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [analytics?.calendar, calendarMonth]);

  const currentCalendarMonth = kstDate(new Date()).slice(0, 7);
  const earliestCalendarMonth = kstDate(
    new Date(Date.now() - (analytics?.windowDays ?? 30) * 24 * 60 * 60 * 1000)
  ).slice(0, 7);
  const selectedDayTrades = useMemo(
    () => selectedCalendarDate
      ? (trades?.positions ?? []).filter(
          (position) => kstDate(new Date(position.closedAt)) === selectedCalendarDate
        )
      : [],
    [selectedCalendarDate, trades?.positions]
  );

  const exchangeHistory = useMemo(
    () => [...(trades?.positions ?? [])].sort((left, right) => {
      const pendingDifference = Number(Boolean(left.review)) - Number(Boolean(right.review));
      if (pendingDifference !== 0) return pendingDifference;
      return Date.parse(right.closedAt) - Date.parse(left.closedAt);
    }),
    [trades?.positions]
  );

  if (isAuthLoading) {
    return (
      <PanelCard variant="report" padding="lg" className="flex items-center gap-2 text-sm text-ui-muted">
        <Loader2 className="animate-spin" size={18} aria-hidden />
        자동 복기 계정을 확인하고 있습니다.
      </PanelCard>
    );
  }

  if (!user || !accessToken) {
    return (
      <PanelCard variant="report" padding="lg">
        <SectionHeader
          eyebrow="자동 매매복기"
          title="로그인하면 거래소 원장과 직접 복기를 함께 볼 수 있습니다"
          description="직접 복기는 로그인하지 않아도 계속 사용할 수 있습니다. 거래소 API 자격정보는 기기 저장소에 남기지 않습니다."
          action={<ActionButton href="/login?returnTo=%2Fjournal" tone="primary">로그인</ActionButton>}
        />
      </PanelCard>
    );
  }

  return (
    <PanelCard variant="report" padding="lg">
      <SectionHeader
        eyebrow="자동 매매복기"
        title="체결 원장에서 다음 기준까지"
        description="읽기 전용 거래소 원장과 직접 선택한 원칙만 사용합니다. 대사가 끝나지 않은 거래는 핵심 통계에서 제외합니다."
        action={
          <div className="flex gap-2">
            <ActionButton onClick={() => void load()} disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" size={16} aria-hidden /> : <RefreshCw size={16} aria-hidden />}
              새로고침
            </ActionButton>
            <ActionButton href="/account/exchanges">
              <Link2 size={16} aria-hidden />
              연결 관리
            </ActionButton>
          </div>
        }
      />

      <div className="mt-4 grid grid-cols-4 gap-1 rounded-ui-sm bg-ui-inset p-1" role="tablist" aria-label="자동 매매복기 구간">
        {tabs.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={`flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-ui-sm px-1 text-[11px] font-semibold transition sm:flex-row sm:text-sm ${
                tab === item.id ? "bg-ui-panel text-ui-text shadow-ui-panel" : "text-ui-muted hover:text-ui-text"
              }`}
            >
              <Icon size={15} aria-hidden />
              {item.label}
            </button>
          );
        })}
      </div>

      {error ? (
        <AppSurface tone="critical" variant="report" padding="md" className="mt-4">
          <div className="flex items-start gap-2 text-sm font-semibold">
            <AlertTriangle size={17} className="mt-0.5 shrink-0" aria-hidden />
            <div>
              <p>{error}</p>
              <p className="mt-1 text-xs font-normal text-ui-muted">직접 복기 기록은 아래에서 계속 사용할 수 있습니다.</p>
            </div>
          </div>
        </AppSurface>
      ) : null}

      {connectionIssue ? (
        <AppSurface
          tone={connectionIssue.status === "permission_changed" || connectionIssue.status === "ip_mismatch" ? "critical" : "inset"}
          variant="report"
          padding="md"
          className="mt-4"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-2">
              <AlertTriangle size={17} className="mt-0.5 shrink-0" aria-hidden />
              <div className="min-w-0">
                <p className="break-words text-sm font-black text-ui-text">
                  {providerLabel(connectionIssue.provider)} 연결 확인 필요
                </p>
                <p className="mt-1 text-xs leading-5 text-ui-muted [word-break:keep-all]">
                  {connectionIssueCopy(connectionIssue.status)}
                </p>
              </div>
            </div>
            <ActionButton href="/account/exchanges">연결 상태 보기</ActionButton>
          </div>
        </AppSurface>
      ) : null}

      {!analytics || !trades ? (
        <AppSurface tone="inset" variant="report" padding="md" className="mt-4">
          {isLoading ? (
            <p className="flex items-center gap-2 text-sm text-ui-muted">
              <Loader2 className="animate-spin" size={17} aria-hidden />
              체결 원장과 복기 통계를 불러오는 중입니다.
            </p>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-ui-muted">
                {canConnect
                  ? "연결된 원장이 아직 없습니다."
                  : "자동 연동은 운영 안전 조건을 확인한 뒤 열립니다. 거래소별 발급 안내는 먼저 확인할 수 있습니다."}
              </p>
              <ActionButton href="/account/exchanges" tone={canConnect ? "primary" : "secondary"}>
                {canConnect ? "읽기 전용 거래소 연결" : "거래소 연동 안내 보기"}
              </ActionButton>
            </div>
          )}
        </AppSurface>
      ) : tab === "summary" ? (
        <div className="mt-4 grid gap-4">
          <div className={`grid grid-cols-2 gap-2 ${analytics.windowDays === 90 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
            {analytics.windowDays === 90 ? (
              <AppSurface tone="inset" variant="report" padding="md">
                <p className="text-ui-label font-semibold text-ui-subtle">최근 30일 순손익</p>
                <p className={`mt-2 text-lg font-black ${toneForPnl(analytics.summary30d.netPnl)}`}>{formatUsdt(analytics.summary30d.netPnl)}</p>
              </AppSurface>
            ) : null}
            <AppSurface tone="inset" variant="report" padding="md">
              <p className="text-ui-label font-semibold text-ui-subtle">{analytics.windowDays}일 순손익</p>
              <p className={`mt-2 text-lg font-black ${toneForPnl(analytics.summary.netPnl)}`}>{formatUsdt(analytics.summary.netPnl)}</p>
            </AppSurface>
            <AppSurface tone="inset" variant="report" padding="md">
              <p className="text-ui-label font-semibold text-ui-subtle">완료 거래</p>
              <p className="mt-2 text-lg font-black text-ui-text">{analytics.summary.completedTrades}건</p>
              {analytics.incompleteTrades ? <p className="mt-1 text-[11px] text-ui-watch">대사 중 {analytics.incompleteTrades}건</p> : null}
            </AppSurface>
            <AppSurface tone="inset" variant="report" padding="md">
              <p className="text-ui-label font-semibold text-ui-subtle">원칙 준수율</p>
              <p className="mt-2 text-lg font-black text-ui-text">{formatPercent(analytics.summary.principleComplianceRate)}</p>
              <p className="mt-1 text-[11px] text-ui-subtle">직접 선택한 기준만 집계</p>
            </AppSurface>
          </div>
          <AppSurface tone="inset" variant="report" padding="md">
            <div className="flex items-start gap-3">
              <ShieldCheck size={20} className="mt-0.5 shrink-0 text-ui-brand" aria-hidden />
              <div>
                <p className="text-xs font-semibold text-ui-subtle">가장 중요한 다음 행동</p>
                <p className="mt-1 break-words text-sm font-black leading-6 text-ui-text [word-break:keep-all]">
                  {connectionIssue ? connectionIssueCopy(connectionIssue.status) : analytics.nextAction}
                </p>
              </div>
            </div>
          </AppSurface>
          <div className="divide-y divide-ui-line">
            <DataRow label="마지막 동기화" value={formatDate(lastSyncedAt)} />
            <DataRow label="승률" value={formatPercent(analytics.summary.winRate)} detail="순손익 양수 / 양수+음수 종료 거래. 본절은 별도입니다." />
            <DataRow label="Profit factor" value={formatProfitFactor(analytics.summary.profitFactor)} />
            <DataRow label="거래 수수료 합계" value={formatUsdt(analytics.summary.feeTotal)} detail="비용은 음수, rebate는 양수로 반영합니다." />
            <DataRow label="펀딩 합계" value={formatUsdt(analytics.summary.fundingTotal)} />
            <DataRow label="최대 실현손익 drawdown" value={formatDrawdown(analytics.summary.maxRealizedDrawdown)} />
          </div>
        </div>
      ) : tab === "calendar" ? (
        <div className="mt-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <ActionButton
              aria-label="이전 달"
              onClick={() => {
                setCalendarMonth((current) => shiftMonth(current, -1));
                setSelectedCalendarDate(null);
              }}
              disabled={calendarMonth <= earliestCalendarMonth}
            >
              <ChevronLeft size={16} aria-hidden />
              이전
            </ActionButton>
            <p className="text-sm font-black text-ui-text">{formatMonth(calendarMonth)}</p>
            <ActionButton
              aria-label="다음 달"
              onClick={() => {
                setCalendarMonth((current) => shiftMonth(current, 1));
                setSelectedCalendarDate(null);
              }}
              disabled={calendarMonth >= currentCalendarMonth}
            >
              다음
              <ChevronRight size={16} aria-hidden />
            </ActionButton>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-ui-subtle">
            {["일", "월", "화", "수", "목", "금", "토"].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => day ? (
              <button
                key={day.key}
                type="button"
                onClick={() => setSelectedCalendarDate(day.key)}
                aria-pressed={selectedCalendarDate === day.key}
                aria-label={`${day.key}${day.item ? `, ${day.item.trades}건, ${formatUsdt(day.item.netPnl)}` : ", 거래 없음"}`}
                className={`min-h-[4.5rem] min-w-0 rounded-ui-sm p-1.5 text-left ring-1 transition ${
                  selectedCalendarDate === day.key
                    ? "bg-ui-panel ring-ui-brand"
                    : day.item
                      ? "bg-ui-elevated ring-transparent"
                      : "bg-ui-inset/55 ring-transparent"
                }`}
              >
                <p className="text-[10px] font-semibold text-ui-subtle">{day.day}</p>
                {day.item ? (
                  <>
                    <p className={`mt-2 truncate text-[10px] font-black ${toneForPnl(day.item.netPnl)}`}>{formatUsdt(day.item.netPnl).replace(" USDT", "")}</p>
                    <p className="mt-1 text-[9px] text-ui-muted">{day.item.trades}건</p>
                  </>
                ) : null}
              </button>
            ) : <span key={`empty:${index}`} aria-hidden className="min-h-[4.5rem]" />)}
          </div>
          {selectedCalendarDate ? (
            <AppSurface tone="inset" variant="report" padding="md" className="mt-3">
              <p className="text-sm font-black text-ui-text">{selectedCalendarDate} 청산 거래</p>
              {selectedDayTrades.length ? (
                <div className="mt-2 divide-y divide-ui-line">
                  {selectedDayTrades.map((position) => (
                    <div key={position.id} className="flex items-center justify-between gap-3 py-2 text-xs">
                      <span className="min-w-0 truncate font-semibold text-ui-text">
                        {position.symbol} · {position.positionSide === "long" ? "롱" : "숏"}
                      </span>
                      <span className={`shrink-0 font-black ${toneForPnl(position.netPnl)}`}>
                        {formatUsdt(position.netPnl)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-ui-muted">이 날짜에 표시할 종료 거래가 없습니다.</p>
              )}
            </AppSurface>
          ) : null}
          <p className="mt-3 text-xs leading-5 text-ui-subtle">KST 청산일 기준입니다. 대사 완료 거래만 일별 순손익에 포함합니다.</p>
        </div>
      ) : tab === "analysis" ? (
        analytics.canCrossAnalyze && analytics.groups ? (
        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(groupLabels) as GroupKey[]).map((key) => (
              <ActionButton
                key={key}
                tone={groupKey === key ? "primary" : "secondary"}
                onClick={() => setGroupKey(key)}
                aria-pressed={groupKey === key}
              >
                {groupLabels[key]}
              </ActionButton>
            ))}
          </div>
          <div className="mt-4 divide-y divide-ui-line">
            {analytics.groups[groupKey].length ? analytics.groups[groupKey].map((group) => (
              <article key={group.key} className="py-4 first:pt-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-ui-text">{group.label}</p>
                    <p className="mt-1 text-xs text-ui-muted">{group.sampleSize}건</p>
                  </div>
                  <StatusPill tone={group.sampleStatus === "ready" ? "info" : "watch"}>
                    {group.sampleStatus === "ready" ? "비교 가능" : "표본 부족"}
                  </StatusPill>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <AppSurface tone="inset" variant="report" padding="sm">
                    <p className="text-[10px] text-ui-subtle">승률</p>
                    <p className="mt-1 text-sm font-black text-ui-text">{formatPercent(group.metrics.winRate)}</p>
                  </AppSurface>
                  <AppSurface tone="inset" variant="report" padding="sm">
                    <p className="text-[10px] text-ui-subtle">순손익</p>
                    <p className={`mt-1 truncate text-sm font-black ${toneForPnl(group.metrics.netPnl)}`}>{formatUsdt(group.metrics.netPnl).replace(" USDT", "")}</p>
                  </AppSurface>
                  <AppSurface tone="inset" variant="report" padding="sm">
                    <p className="text-[10px] text-ui-subtle">PF</p>
                    <p className="mt-1 text-sm font-black text-ui-text">{formatProfitFactor(group.metrics.profitFactor)}</p>
                  </AppSurface>
                </div>
              </article>
            )) : (
              <AppSurface tone="inset" variant="report" padding="md">
                <p className="text-sm text-ui-muted">{groupKey === "strategies" ? "전략 태그를 직접 복기하면 비교가 시작됩니다." : "대사 완료 거래가 아직 없습니다."}</p>
              </AppSurface>
            )}
          </div>
        </div>
        ) : (
          <AppSurface tone="inset" variant="report" padding="md" className="mt-4">
            <SectionHeader
              eyebrow="Coin Pro"
              title="교차 분석 권한을 확인해 주세요"
              description="Coin Pro 또는 코인 권한이 포함된 상위 플랜에서 거래소·종목·방향·전략 태그별 분석을 이용할 수 있습니다."
              action={<ActionButton href="/pro?market=crypto&source=exchange-journal" tone="primary">Coin Pro 보기</ActionButton>}
            />
          </AppSurface>
        )
      ) : (
        <div className="mt-4 divide-y divide-ui-line">
          {exchangeHistory.length ? exchangeHistory.map((position) => (
            <article key={position.id} className="py-4 first:pt-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone={position.positionSide === "long" ? "long" : "short"}>
                      {position.positionSide === "long" ? <TrendingUp size={13} aria-hidden /> : <TrendingDown size={13} aria-hidden />}
                      {position.positionSide === "long" ? "롱" : "숏"}
                    </StatusPill>
                    <p className="font-black text-ui-text">{position.symbol}</p>
                    <span className="text-xs text-ui-subtle">{providerLabel(position.provider)}</span>
                  </div>
                  <p className="mt-2 text-xs text-ui-muted">{formatDate(position.closedAt)} 청산</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`text-sm font-black ${toneForPnl(position.netPnl)}`}>{formatUsdt(position.netPnl)}</p>
                  <p className="mt-1 text-[10px] text-ui-subtle">수수료·펀딩 반영</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <AppSurface tone="inset" variant="report" padding="sm">
                  <p className="text-ui-subtle">평균 진입</p>
                  <p className="mt-1 truncate font-semibold text-ui-text">{Number(position.averageEntryPrice).toLocaleString()}</p>
                </AppSurface>
                <AppSurface tone="inset" variant="report" padding="sm">
                  <p className="text-ui-subtle">평균 청산</p>
                  <p className="mt-1 truncate font-semibold text-ui-text">{Number(position.averageExitPrice).toLocaleString()}</p>
                </AppSurface>
                <AppSurface tone="inset" variant="report" padding="sm">
                  <p className="text-ui-subtle">수수료</p>
                  <p className="mt-1 truncate font-semibold text-ui-text">{formatUsdt(position.feeTotal)}</p>
                </AppSurface>
                <AppSurface tone="inset" variant="report" padding="sm">
                  <p className="text-ui-subtle">펀딩</p>
                  <p className="mt-1 truncate font-semibold text-ui-text">{formatUsdt(position.fundingTotal)}</p>
                </AppSurface>
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone={position.quality === "complete" ? "long" : "watch"}>
                    {position.quality === "complete" ? "대사 완료" : "일부 확인 필요"}
                  </StatusPill>
                  <StatusPill tone={position.review ? "info" : "risk"}>
                    {position.review ? "복기 완료" : "미복기"}
                  </StatusPill>
                  <StatusPill tone={position.exitReason === "trade" ? "info" : "risk"}>
                    {exitReasonLabel(position.exitReason)}
                  </StatusPill>
                </div>
                <ActionButton onClick={() => setReviewingId(reviewingId === position.id ? null : position.id)}>
                  {position.review ? "복기 수정" : "기준 선택"}
                  <ChevronRight size={15} aria-hidden />
                </ActionButton>
              </div>
              {position.quality === "partial" && position.warnings.length ? (
                <p className="mt-2 break-words text-xs leading-5 text-ui-watch">
                  {Array.from(new Set(position.warnings.map(warningLabel))).slice(0, 2).join(" · ")}
                </p>
              ) : null}
              {position.quality === "complete" ? (
                <TradeQualityAssessmentCard assessment={position.assessment} />
              ) : null}
              {reviewingId === position.id ? (
                <ReviewEditor
                  position={position}
                  accessToken={accessToken}
                  onSaved={async () => {
                    setReviewingId(null);
                    await load();
                  }}
                  onCancel={() => setReviewingId(null)}
                />
              ) : null}
            </article>
          )) : (
            <AppSurface tone="inset" variant="report" padding="md">
              <p className="text-sm text-ui-muted">자동 수집된 종료 거래가 아직 없습니다.</p>
            </AppSurface>
          )}
        </div>
      )}

      {analytics && activeConnections.length === 0 ? (
        <AppSurface tone="inset" variant="report" padding="md" className="mt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-ui-text">읽기 전용 거래소 연결이 없습니다</p>
              <p className="mt-1 text-xs leading-5 text-ui-muted">읽기 전용 연결을 추가하면 동기화된 종료 거래와 복기 기준을 확인할 수 있습니다.</p>
            </div>
            <Link href="/account/exchanges" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-ui-sm bg-ui-brand px-3 text-sm font-semibold text-white">
              연결 안내 보기
              <ChevronRight size={15} aria-hidden />
            </Link>
          </div>
        </AppSurface>
      ) : null}

      <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-ui-subtle">
        <Clock3 size={14} className="mt-0.5 shrink-0" aria-hidden />
        이 화면은 기록과 점검을 돕습니다. 진입 지시나 미래 성과 예측을 제공하지 않습니다.
      </p>
    </PanelCard>
  );
}
