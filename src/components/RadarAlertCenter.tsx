"use client";
// 사용자가 받을 레이더 알림 조건을 설정하고 Pro 가치를 확인하는 패널이다.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BellRing, CheckCircle2, Clock3, Crown, Loader2, Radar, ShieldCheck, Smartphone, Zap } from "lucide-react";
import {
  getDefaultRadarAlertRuleIds,
  radarAlertRules,
  summarizeRadarAlerts,
  type RadarAlertRule,
  type RadarAlertRuleId
} from "@/lib/radarAlerts";
import {
  readSetupAlertMatches,
  readSetupAlertMonitorStatus,
  readSetupAlertPresets,
  REQUEST_SETUP_ALERT_CHECK_EVENT,
  SETUP_ALERT_CHECK_FINISHED_EVENT,
  SETUP_ALERT_MONITOR_STATUS_EVENT,
  SETUP_ALERT_MATCHES_CHANGED_EVENT,
  SETUP_ALERT_PRESETS_CHANGED_EVENT,
  type SetupAlertMatch,
  type SetupAlertMonitorStatus,
  type SetupAlertPreset
} from "@/lib/setupAlertPresets";
import { getUsageGate, recordUsageEvent } from "@/lib/usageMeter";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";
import { hasMarketEntitlement } from "@/lib/billing";

const baseStorageKey = "chartRadar.alertRules.v1";

type PermissionState = "unsupported" | "default" | "granted" | "denied";
type AlertMarket = "crypto" | "stocks";

const alertMarketCopy = {
  crypto: {
    eyebrow: "코인 레이더 알림",
    title: "코인 변동만 따로 감시합니다",
    description: "BTC·ETH와 알트코인 급변, A급 후보, 청산 압력, 코인 뉴스 흐름을 한곳에서 관리하는 알림 센터입니다."
  },
  stocks: {
    eyebrow: "글로벌 레이더 알림",
    title: "글로벌 시장 변동만 따로 감시합니다",
    description: "미국주식, ETF, 실적, 매크로 발표, 지수·원자재 급변을 한곳에서 관리하는 알림 센터입니다."
  }
} satisfies Record<AlertMarket, { eyebrow: string; title: string; description: string }>;

function getMarketRuleStorageKey(market: AlertMarket) {
  return `${baseStorageKey}.${market}`;
}

function getMarketDefaultRuleIds(market: AlertMarket): RadarAlertRuleId[] {
  return getDefaultRadarAlertRuleIds().filter((id) => {
    const rule = radarAlertRules.find((item) => item.id === id);
    if (!rule) return false;
    if (rule.category === "news" || rule.category === "system") return true;
    return market === "stocks" ? rule.category === "stocks" : rule.category === "crypto";
  });
}

function readStoredRuleIds(market: AlertMarket): RadarAlertRuleId[] {
  const defaults = getMarketDefaultRuleIds(market);
  if (typeof window === "undefined") return defaults;

  try {
    const raw =
      window.localStorage.getItem(getMarketRuleStorageKey(market)) ??
      (market === "crypto" ? window.localStorage.getItem(baseStorageKey) : null);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return defaults;
    const allowed = new Set(radarAlertRules.map((rule) => rule.id));
    return parsed
      .filter((id): id is RadarAlertRuleId => typeof id === "string" && allowed.has(id as RadarAlertRuleId))
      .filter((id) => {
        const rule = radarAlertRules.find((item) => item.id === id);
        if (!rule) return false;
        if (rule.category === "news" || rule.category === "system") return true;
        return market === "stocks" ? rule.category === "stocks" : rule.category === "crypto";
      });
  } catch {
    return defaults;
  }
}

function getPermissionState(): PermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission as PermissionState;
}

function categoryLabel(category: RadarAlertRule["category"]) {
  if (category === "crypto") return "코인";
  if (category === "stocks") return "글로벌";
  if (category === "news") return "뉴스";
  return "시스템";
}

function categoryClass(category: RadarAlertRule["category"]) {
  if (category === "crypto") return "border-cyan-300/25 bg-cyan-300/10 text-cyan-200";
  if (category === "stocks") return "border-emerald-300/25 bg-emerald-300/10 text-emerald-200";
  if (category === "news") return "border-amber-300/25 bg-amber-300/10 text-amber-200";
  return "border-slate-300/20 bg-slate-300/10 text-slate-200";
}

function permissionLabel(permission: PermissionState) {
  if (permission === "granted") return "브라우저 알림 허용됨";
  if (permission === "denied") return "브라우저 알림 차단됨";
  if (permission === "unsupported") return "이 브라우저는 알림을 지원하지 않습니다";
  return "브라우저 알림 권한 대기";
}

function compactSymbol(symbol: string) {
  return symbol.replace("USDT.P", "").replace("USDT", "");
}

function presetSideLabel(side: SetupAlertPreset["side"]) {
  return side === "long" ? "롱 우세" : "숏 우세";
}

function formatSavedAt(ms: number) {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금 저장";
  if (min < 60) return `${min}분 전 저장`;
  return `${Math.floor(min / 60)}시간 전 저장`;
}

function monitorReasonLabel(reason: SetupAlertMonitorStatus["reason"]) {
  if (reason === "manual") return "수동 확인";
  if (reason === "preset-change") return "조건 변경";
  if (reason === "visible") return "화면 복귀";
  return "자동 확인";
}

function RuleCard({
  rule,
  enabled,
  onToggle
}: {
  rule: RadarAlertRule;
  enabled: boolean;
  onToggle: (ruleId: RadarAlertRuleId) => void;
}) {
  return (
    <article className={`rounded-lg border p-4 transition ${enabled ? "border-cyan-300/25 bg-cyan-300/10" : "border-surface-line bg-surface-cardSoft"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-md border px-2 py-1 text-[11px] font-black ${categoryClass(rule.category)}`}>
              {categoryLabel(rule.category)}
            </span>
            {rule.tier === "pro" ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-cyan-300/25 bg-cyan-300/10 px-2 py-1 text-[11px] font-black text-cyan-200">
                <Crown size={12} aria-hidden />
                Pro
              </span>
            ) : (
              <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-[11px] font-bold text-slate-300">
                Free
              </span>
            )}
          </div>
          <h3 className="mt-3 text-base font-black text-white">{rule.title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400 [word-break:keep-all]">{rule.description}</p>
        </div>
        <button
          type="button"
          onClick={() => onToggle(rule.id)}
          className={`relative h-7 w-12 shrink-0 rounded-full border transition ${
            enabled ? "border-cyan-300 bg-cyan-300" : "border-surface-line bg-slate-800"
          }`}
          aria-pressed={enabled}
          aria-label={`${rule.title} 알림 ${enabled ? "끄기" : "켜기"}`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
              enabled ? "left-6" : "left-1"
            }`}
          />
        </button>
      </div>
      <div className="mt-4 grid gap-2 text-xs leading-5 text-slate-400 sm:grid-cols-2">
        <p className="rounded-md border border-white/10 bg-black/20 p-3">
          <span className="font-black text-slate-200">조건.</span> {rule.trigger}
        </p>
        <p className="rounded-md border border-white/10 bg-black/20 p-3">
          <span className="font-black text-slate-200">효용.</span> {rule.value}
        </p>
      </div>
      <p className="mt-3 text-[11px] font-bold text-slate-500">{rule.cadence}</p>
    </article>
  );
}

export function RadarAlertCenter({ compact = false, market = "crypto" }: { compact?: boolean; market?: AlertMarket }) {
  const { profile } = useSupabaseAuth();
  const isPaid = hasMarketEntitlement(profile?.plan, market);
  const copy = alertMarketCopy[market];
  const isGlobal = market === "stocks";
  const [enabledRuleIds, setEnabledRuleIds] = useState<RadarAlertRuleId[]>(() => getMarketDefaultRuleIds(market));
  const [rulesMarket, setRulesMarket] = useState<AlertMarket>(market);
  const [hasLoadedStoredRules, setHasLoadedStoredRules] = useState(false);
  const [setupPresets, setSetupPresets] = useState<SetupAlertPreset[]>([]);
  const [setupMatches, setSetupMatches] = useState<SetupAlertMatch[]>([]);
  const [monitorStatus, setMonitorStatus] = useState<SetupAlertMonitorStatus | null>(null);
  const [permission, setPermission] = useState<PermissionState>("default");
  const [isRequesting, setIsRequesting] = useState(false);
  const [isManualChecking, setIsManualChecking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setEnabledRuleIds(readStoredRuleIds(market));
    setRulesMarket(market);
    setHasLoadedStoredRules(true);
    setSetupPresets(readSetupAlertPresets(market));
    setSetupMatches(readSetupAlertMatches(market));
    setMonitorStatus(readSetupAlertMonitorStatus(market));
    setPermission(getPermissionState());
  }, [market]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    function syncPresets() {
      setSetupPresets(readSetupAlertPresets(market));
      setSetupMatches(readSetupAlertMatches(market));
      setMonitorStatus(readSetupAlertMonitorStatus(market));
    }

    function handleCheckFinished(event: Event) {
      const detail = (event as CustomEvent<{ matchCount?: number }>).detail;
      const matchCount = detail?.matchCount ?? 0;
      setIsManualChecking(false);
      setSetupMatches(readSetupAlertMatches(market));
      setMonitorStatus(readSetupAlertMonitorStatus(market));
      setToast(
        matchCount > 0
          ? `저장된 감시 조건 중 ${matchCount}개가 현재 레이더와 다시 맞아떨어졌습니다.`
          : "지금은 저장된 감시 조건과 다시 맞아떨어진 레이더가 없습니다."
      );
    }

    window.addEventListener("storage", syncPresets);
    window.addEventListener(SETUP_ALERT_PRESETS_CHANGED_EVENT, syncPresets);
    window.addEventListener(SETUP_ALERT_MATCHES_CHANGED_EVENT, syncPresets);
    window.addEventListener(SETUP_ALERT_MONITOR_STATUS_EVENT, syncPresets);
    window.addEventListener(SETUP_ALERT_CHECK_FINISHED_EVENT, handleCheckFinished);
    return () => {
      window.removeEventListener("storage", syncPresets);
      window.removeEventListener(SETUP_ALERT_PRESETS_CHANGED_EVENT, syncPresets);
      window.removeEventListener(SETUP_ALERT_MATCHES_CHANGED_EVENT, syncPresets);
      window.removeEventListener(SETUP_ALERT_MONITOR_STATUS_EVENT, syncPresets);
      window.removeEventListener(SETUP_ALERT_CHECK_FINISHED_EVENT, handleCheckFinished);
    };
  }, [market]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasLoadedStoredRules) return;
    if (rulesMarket !== market) return;
    window.localStorage.setItem(getMarketRuleStorageKey(market), JSON.stringify(enabledRuleIds));
  }, [enabledRuleIds, hasLoadedStoredRules, market, rulesMarket]);

  const scopedRules = useMemo(
    () =>
      radarAlertRules.filter((rule) => {
        if (rule.category === "news" || rule.category === "system") return true;
        return market === "stocks" ? rule.category === "stocks" : rule.category === "crypto";
      }),
    [market]
  );
  const scopedEnabledRuleIds = enabledRuleIds.filter((id) => scopedRules.some((rule) => rule.id === id));
  const summary = useMemo(() => summarizeRadarAlerts(scopedEnabledRuleIds), [scopedEnabledRuleIds]);
  const visibleRules = compact ? scopedRules.slice(0, 3) : scopedRules;
  const alertUsageBucketId = market === "stocks" ? "stocksAlertRule" : "cryptoAlertRule";

  function toggleRule(ruleId: RadarAlertRuleId) {
    if (!enabledRuleIds.includes(ruleId)) {
      const usageGate = getUsageGate(alertUsageBucketId, isPaid);
      if (!usageGate.allowed) {
        setToast(usageGate.message);
        return;
      }
      recordUsageEvent(alertUsageBucketId);
    }
    setEnabledRuleIds((current) => {
      if (current.includes(ruleId)) return current.filter((id) => id !== ruleId);
      return [...current, ruleId];
    });
  }

  async function requestNotificationPermission() {
    const usageGate = getUsageGate(alertUsageBucketId, isPaid);
    if (!usageGate.allowed) {
      setToast(usageGate.message);
      return;
    }

    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      setToast("현재 브라우저에서는 알림 권한을 요청할 수 없습니다.");
      return;
    }

    setIsRequesting(true);
    try {
      const result = await Notification.requestPermission();
      recordUsageEvent(alertUsageBucketId);
      setPermission(result as PermissionState);
      if (result === "granted") {
        new Notification("Chart Radar 알림이 켜졌습니다", {
          body: "A급 감지, 청산 압력, 뉴스 브리핑 알림을 받을 수 있습니다.",
          icon: "/brand/chart-radar-mark.png"
        });
        setToast("브라우저 알림 권한이 켜졌습니다. 저장한 조건은 이 기기에서 바로 확인할 수 있습니다.");
      } else {
        setToast("알림 권한이 꺼져 있습니다. 설정에서 언제든 다시 허용할 수 있습니다.");
      }
    } finally {
      setIsRequesting(false);
    }
  }

  function requestManualAlertCheck() {
    if (typeof window === "undefined") return;
    if (setupPresets.length === 0) {
      setToast("먼저 홈의 TOP 감지 카드에서 감시 조건을 저장해 주세요.");
      return;
    }

    setIsManualChecking(true);
    setToast("저장된 감시 조건을 현재 레이더 결과와 다시 비교하는 중입니다.");
    window.dispatchEvent(new CustomEvent(REQUEST_SETUP_ALERT_CHECK_EVENT, { detail: { market } }));
  }

  return (
    <section className="rounded-lg border border-cyan-300/25 bg-surface-card p-4 shadow-glow sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-cyan-300/30 bg-cyan-300/12 text-cyan-200">
            <BellRing size={22} aria-hidden />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">{copy.eyebrow}</p>
            <h2 className="mt-1 text-xl font-black text-white">{copy.title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400 [word-break:keep-all]">
              {copy.description}
              {" "}
              저장한 조건과 시장별 레이더를 이 화면에서 관리합니다.
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/25 p-3 lg:w-72">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-slate-400">켜진 알림</span>
            <span className="text-lg font-black text-cyan-200">{summary.enabledCount}개</span>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-400 [word-break:keep-all]">{summary.headline}</p>
          <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-bold">
            <span className="rounded-md border border-cyan-300/25 bg-cyan-300/10 px-2 py-1 text-cyan-200">
              Pro {summary.proCount}
            </span>
            <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-slate-300">
              Free {summary.freeCount}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-4">
          <Radar className="text-cyan-300" size={20} aria-hidden />
          <p className="mt-3 text-sm font-black text-white">{isGlobal ? "관심 자산 감지" : "레이더 감지"}</p>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            {isGlobal ? "ETF, 빅테크, 원자재 ETF의 급변과 저장한 조건을 빠르게 확인합니다." : "A급 후보와 관심코인 변화를 빠르게 확인합니다."}
          </p>
        </div>
        <div className="rounded-lg border border-orange-300/20 bg-orange-300/10 p-4">
          <Zap className="text-orange-200" size={20} aria-hidden />
          <p className="mt-3 text-sm font-black text-white">{isGlobal ? "매크로 압력" : "위험 압력"}</p>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            {isGlobal ? "금리, 지수, 섹터, 원자재 변동이 선택 자산에 주는 압력을 분리합니다." : "청산 압력과 과열 구간을 추격 전에 먼저 봅니다."}
          </p>
        </div>
        <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-4">
          <Smartphone className="text-emerald-200" size={20} aria-hidden />
          <p className="mt-3 text-sm font-black text-white">앱 알림 연동</p>
          <p className="mt-2 text-xs leading-5 text-slate-400">앱에서는 같은 조건을 푸시 알림으로 이어서 확인합니다.</p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-lg border border-surface-line bg-surface-cardSoft p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-black text-white">
            <ShieldCheck size={16} className="text-cyan-300" aria-hidden />
            {permissionLabel(permission)}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            웹에서는 브라우저 알림으로 확인하고, 앱에서는 같은 조건을 푸시 알림으로 이어서 받습니다.
          </p>
        </div>
        <button
          type="button"
          onClick={requestNotificationPermission}
          disabled={isRequesting || permission === "unsupported"}
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isRequesting ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <CheckCircle2 size={16} aria-hidden />}
          알림 권한 확인
        </button>
      </div>

      {toast ? (
        <p className="mt-3 rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs leading-5 text-cyan-100">
          {toast}
        </p>
      ) : null}

      <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-white">내가 저장한 레이더 감시</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              홈의 TOP 감지에서 저장한 조건입니다. 앱이 켜져 있으면 5분마다 다시 훑고, 일치하면 최근 감지에 남깁니다.
            </p>
          </div>
          <span className="rounded-md border border-cyan-300/25 bg-cyan-300/10 px-2 py-1 text-xs font-black text-cyan-200">
            {setupPresets.length}개 저장
          </span>
        </div>
        <button
          type="button"
          onClick={requestManualAlertCheck}
          disabled={isManualChecking}
          className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-emerald-300/30 bg-emerald-300/10 px-3 text-sm font-black text-emerald-200 transition hover:bg-emerald-300 hover:text-slate-950 disabled:cursor-wait disabled:opacity-70"
        >
          {isManualChecking ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Radar size={16} aria-hidden />}
          지금 저장 조건 확인
        </button>
        {monitorStatus ? (
          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
            <div className="rounded-md border border-white/10 bg-black/25 p-3">
              <p className="font-bold text-slate-500">마지막 확인</p>
              <p className="mt-1 font-black text-white">{formatSavedAt(monitorStatus.checkedAt).replace(" 저장", "")}</p>
            </div>
            <div className="rounded-md border border-white/10 bg-black/25 p-3">
              <p className="font-bold text-slate-500">확인 범위</p>
              <p className="mt-1 font-black text-white">
                조건 {monitorStatus.presetCount}개, 후보 {monitorStatus.setupCount}개
              </p>
            </div>
            <div className="rounded-md border border-white/10 bg-black/25 p-3">
              <p className="font-bold text-slate-500">{monitorReasonLabel(monitorStatus.reason)}</p>
              <p className={monitorStatus.matchCount > 0 ? "mt-1 font-black text-emerald-200" : "mt-1 font-black text-slate-300"}>
                일치 {monitorStatus.matchCount}개
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-3 rounded-md border border-white/10 bg-black/25 p-3 text-xs leading-5 text-slate-500">
            앱이 열리면 저장된 조건을 자동으로 확인하고, 마지막 확인 상태가 이곳에 표시됩니다.
          </p>
        )}
        {setupMatches.length > 0 ? (
          <div className="mt-3 rounded-md border border-emerald-300/25 bg-emerald-300/10 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-black text-emerald-200">최근 일치 감지</p>
              <span className="text-[11px] font-bold text-emerald-200/80">{formatSavedAt(setupMatches[0].matchedAt)}</span>
            </div>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {setupMatches.slice(0, compact ? 1 : 2).map((match) => (
                <article key={match.id} className="rounded border border-emerald-300/20 bg-black/20 p-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-black text-white">{compactSymbol(match.setup.symbol)}</span>
                    <span className="rounded border border-white/10 bg-black/30 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
                      {match.setup.timeframe}
                    </span>
                    <span className={match.setup.side === "long" ? "rounded border border-emerald-300/25 bg-emerald-300/10 px-1.5 py-0.5 text-[10px] font-black text-emerald-200" : "rounded border border-red-300/25 bg-red-300/10 px-1.5 py-0.5 text-[10px] font-black text-red-200"}>
                      {presetSideLabel(match.setup.side)}
                    </span>
                    <span className="rounded border border-cyan-300/25 bg-cyan-300/10 px-1.5 py-0.5 text-[10px] font-black text-cyan-200">
                      {match.setup.score}점
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-300">{match.setup.headline}</p>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-3 rounded-md border border-white/10 bg-black/25 p-3 text-xs leading-5 text-slate-500">
            저장 조건이 현재 레이더 결과와 다시 맞아떨어지면 이곳에 최근 일치 감지로 표시됩니다.
          </p>
        )}
        {setupPresets.length > 0 ? (
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {setupPresets.slice(0, compact ? 2 : 6).map((preset) => (
              <article key={preset.id} className="rounded-md border border-white/10 bg-black/25 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-black text-white">{compactSymbol(preset.symbol)}</span>
                      <span className="rounded border border-white/10 bg-black/30 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
                        {preset.timeframe}
                      </span>
                      <span className={preset.side === "long" ? "rounded border border-emerald-300/25 bg-emerald-300/10 px-1.5 py-0.5 text-[10px] font-black text-emerald-200" : "rounded border border-red-300/25 bg-red-300/10 px-1.5 py-0.5 text-[10px] font-black text-red-200"}>
                        {presetSideLabel(preset.side)}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{preset.headline}</p>
                  </div>
                  <span className="shrink-0 rounded border border-cyan-300/25 bg-cyan-300/10 px-2 py-1 text-[11px] font-black text-cyan-200">
                    {preset.score}점
                  </span>
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                  <Clock3 size={12} aria-hidden />
                  {formatSavedAt(preset.savedAt)}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-md border border-white/10 bg-black/25 p-3 text-xs leading-5 text-slate-500">
            아직 저장된 감시 조건이 없습니다. 홈의 레이더 TOP 감지 카드에서 감시 저장을 누르면 여기에 쌓입니다.
          </p>
        )}
      </div>

      <div className={`mt-4 grid gap-3 ${compact ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
        {visibleRules.map((rule) => (
          <RuleCard key={rule.id} rule={rule} enabled={enabledRuleIds.includes(rule.id)} onToggle={toggleRule} />
        ))}
      </div>

      {compact ? (
        <Link
          href={market === "stocks" ? "/alerts?market=global" : "/alerts?market=crypto"}
          className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-md border border-cyan-300/30 bg-cyan-300/10 px-4 text-sm font-black text-cyan-200 transition hover:bg-cyan-300 hover:text-slate-950"
        >
          알림 조건 전체 설정하기
        </Link>
      ) : null}
    </section>
  );
}
