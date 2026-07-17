"use client";
// 사용자가 받을 레이더 알림 조건을 설정하고 Pro 가치를 확인하는 패널입니다.
import { useEffect, useMemo, useState } from "react";
import { BellRing, CheckCircle2, Clock3, Crown, Loader2, Radar, ShieldCheck } from "lucide-react";
import { ActionButton, AppSurface, DataRow, MetricRow, PanelCard, SectionHeader, StatusPill } from "@/components/ui/DesignPrimitives";
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
  SETUP_ALERT_MATCHES_CHANGED_EVENT,
  SETUP_ALERT_MONITOR_STATUS_EVENT,
  SETUP_ALERT_PRESETS_CHANGED_EVENT,
  type SetupAlertMatch,
  type SetupAlertMonitorStatus,
  type SetupAlertPreset
} from "@/lib/setupAlertPresets";
import { getUsageGate, recordUsageEvent } from "@/lib/usageMeter";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";
import { hasMarketEntitlement } from "@/lib/billing";
import { getPushTestMessage, pushTestMessages, type PushTestKind } from "@/lib/pushTestMessages";
import {
  disableAndroidAppPush,
  readAppPushState,
  registerAndroidAppPush,
  registerAppPushListeners,
  sendAndroidAppPushTest,
  subscribeAppPushState,
  syncAndroidAppPushPreferences,
  type AppPushMarket,
  type AppPushRegistrationStage,
  type AppPushDeviceState
} from "@/lib/appPush";

const baseStorageKey = "chartRadar.alertRules.v1";
const alertRowClassName =
  "max-[420px]:flex-col max-[420px]:gap-1 max-[420px]:[&>div:last-child]:shrink max-[420px]:[&>div:last-child]:text-left";

type PermissionState = "unsupported" | "default" | "granted" | "denied";
type AlertMarket = "crypto" | "stocks";
type AlertStatusTone = "long" | "short" | "watch" | "risk" | "locked" | "info";

interface AdminPushDiagnostics {
  scannedAt: string;
  last24h: {
    loggedEventCount: number;
    sentCount: number;
    failureCount: number;
  };
  diagnostics: {
    tokenCount: number;
    presetCount: number;
    genericEventCount: number;
    candidateEventCount?: number;
    qualityPassedEventCount?: number;
    deliveryEligibleEventCount?: number;
    finalSendAttemptCount?: number;
    eligibleEventCount: number;
    skippedLowScoreCount: number;
    duplicateSkippedTokenCount: number;
    sendTargetTokenCount: number;
    subscriptionCount: number;
    lookupErrorCount?: number;
    scannerErrorCount?: number;
  };
  candidateEvents: Array<{
    signalType: string;
    market: string;
    symbol: string | null;
    score: number | null;
    alertKind: string;
    skippedReason: string | null;
    wouldSend: boolean;
    alertTitle: string;
    alertBody: string;
    isWatchlist: boolean;
    isMarketScout: boolean;
    isWatchedSymbol: boolean;
    targetTokenCount: number;
  }>;
  recentEvents: Array<{
    createdAt: string;
    market: string;
    ruleId: string;
    signalType: string;
    alertKind: string | null;
    symbol: string | null;
    title: string;
    sentCount: number;
  }>;
  warnings: string[];
}

const alertMarketCopy = {
  crypto: {
    eyebrow: "알림 설정",
    title: "코인 레이더 알림",
    description: "시장 변화를 놓치지 않도록 감시 조건과 알림 상태를 정리합니다."
  },
  stocks: {
    eyebrow: "알림 설정",
    title: "글로벌 레이더 알림",
    description: "지수, 섹터, 매크로 변화에 대한 알림 상태를 정리합니다."
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

function categoryTone(category: RadarAlertRule["category"]): AlertStatusTone {
  if (category === "stocks") return "long";
  if (category === "news") return "risk";
  if (category === "system") return "info";
  return "watch";
}

function appPushConnectionLabel(state: AppPushDeviceState) {
  if (!state.supported) return "앱에서 사용 가능";
  if (state.registrationStage === "checking_permission") return "권한 확인 중";
  if (state.registrationStage === "requesting_permission") return "권한 요청 중";
  if (state.registrationStage === "registering_device") return "기기 연결 중";
  if (state.registrationStage === "saving_token") return "연결 저장 중";
  if (state.registrationStage === "failed") return "연결 실패";
  if (state.registrationStage === "denied") return "권한이 꺼져 있음";
  if (state.permission === "granted" && state.synced) return "연결됨";
  if (state.permission === "granted" && state.token) return "연결 확인 필요";
  if (state.permission === "denied") return "권한이 꺼져 있음";
  return "연결 전";
}

function appPushConnectionTone(state: AppPushDeviceState): AlertStatusTone {
  if (!state.supported) return "info";
  if (state.registrationStage === "failed" || state.registrationStage === "denied" || state.permission === "denied") return "risk";
  if (state.registrationStage === "checking_permission" || state.registrationStage === "requesting_permission" || state.registrationStage === "registering_device" || state.registrationStage === "saving_token") return "watch";
  if (state.permission === "granted" && state.synced) return "long";
  return "info";
}

function permissionTone(permission: PermissionState, appState: AppPushDeviceState, isAndroidAppPush: boolean): AlertStatusTone {
  if (isAndroidAppPush) {
    if (appState.permission === "granted") return "long";
    if (appState.permission === "denied" || appState.registrationStage === "denied") return "risk";
    return "watch";
  }
  if (permission === "granted") return "long";
  if (permission === "denied" || permission === "unsupported") return "risk";
  return "watch";
}

function permissionSummaryLabel(permission: PermissionState, appState: AppPushDeviceState, isAndroidAppPush: boolean) {
  if (isAndroidAppPush) {
    if (appState.permission === "granted") return "권한 허용됨";
    if (appState.permission === "denied" || appState.registrationStage === "denied") return "권한이 꺼져 있음";
    return "권한 확인 필요";
  }
  if (permission === "granted") return "권한 허용됨";
  if (permission === "denied") return "권한이 꺼져 있음";
  if (permission === "unsupported") return "지원 안 됨";
  return "권한 확인 필요";
}

function appPushStageLabel(stage: AppPushRegistrationStage | null) {
  if (stage === "checking_permission") return "권한 확인 중";
  if (stage === "requesting_permission") return "권한 요청 중";
  if (stage === "registering_device") return "기기 연결 중";
  if (stage === "saving_token") return "연결 저장 중";
  if (stage === "enabled") return "연결됨";
  if (stage === "denied") return "권한이 꺼져 있음";
  if (stage === "failed") return "실패";
  return "대기 중";
}

function appPushActionLabel(stage: AppPushRegistrationStage) {
  if (stage === "checking_permission") return "권한 확인 중";
  if (stage === "requesting_permission") return "권한 요청 중";
  if (stage === "registering_device") return "기기 연결 중";
  if (stage === "saving_token") return "연결 저장 중";
  return "앱 푸시 알림 켜기";
}

function formatAppPushUpdatedAt(iso: string | null) {
  if (!iso) return "아직 없음";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "확인 필요";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function marketDisplayName(market: AlertMarket | AppPushMarket) {
  return market === "stocks" ? "글로벌" : "코인";
}

function proPlanLabelForMarket(market: AlertMarket) {
  return market === "stocks" ? "Global Pro" : "Coin Pro";
}

function proHrefForMarket(market: AlertMarket) {
  return market === "stocks" ? "/pro?market=stocks" : "/pro?market=crypto";
}

function lockedRuleReason(market: AlertMarket) {
  return `${proPlanLabelForMarket(market)}에서 받을 수 있는 알림입니다. 현재 플랜에서는 이 알림이 잠겨 있습니다.`;
}

function isRuleLockedForPlan(rule: RadarAlertRule, hasCurrentMarketEntitlement: boolean) {
  return rule.tier === "pro" && !hasCurrentMarketEntitlement;
}

function formatPushMarkets(markets: AppPushMarket[]) {
  if (markets.length === 0) return "아직 없음";
  return markets.map(marketDisplayName).join(", ");
}

function marketPushActionLabel(market: AlertMarket, state: AppPushDeviceState, isLoading: boolean) {
  if (isLoading) return "로그인 확인 중";
  const marketName = marketDisplayName(market);
  if (state.registrationStage === "checking_permission") return "권한 확인 중";
  if (state.registrationStage === "requesting_permission") return "권한 요청 중";
  if (state.registrationStage === "registering_device") return "기기 연결 중";
  if (state.registrationStage === "saving_token") return "설정 저장 중";
  if (state.synced && state.markets.includes(market)) return `${marketName} 알림 다시 저장`;
  return `${marketName} 알림 켜기`;
}

function compactSymbol(symbol: string) {
  return symbol.replace("USDT.P", "").replace("USDT", "");
}

function presetSideLabel(side: SetupAlertPreset["side"], market: AlertMarket = "crypto") {
  if (market === "stocks") return side === "long" ? "상승 우세" : "하락 우세";
  return side === "long" ? "상방 우세" : "하방 우세";
}

function formatSavedAt(ms: number) {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금 저장";
  if (min < 60) return `${min}분 전 저장`;
  return `${Math.floor(min / 60)}시간 전 저장`;
}

function formatCheckedAt(ms: number) {
  const text = formatSavedAt(ms);
  return text.replace(" 저장", "");
}

function formatAbsoluteTime(iso: string | null) {
  if (!iso) return "아직 없음";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "확인 필요";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function monitorReasonLabel(reason: SetupAlertMonitorStatus["reason"]) {
  if (reason === "manual") return "직접 확인";
  if (reason === "preset-change") return "조건 변경";
  if (reason === "visible") return "화면 확인";
  return "자동 확인";
}

function RuleCard({
  rule,
  enabled,
  locked = false,
  lockedReason,
  lockedCtaHref,
  lockedCtaLabel,
  onToggle
}: {
  rule: RadarAlertRule;
  enabled: boolean;
  locked?: boolean;
  lockedReason?: string;
  lockedCtaHref?: string;
  lockedCtaLabel?: string;
  onToggle: (ruleId: RadarAlertRuleId) => void;
}) {
  const statusLabel = locked ? "Pro 필요" : enabled ? "켜짐" : "꺼짐";
  const statusTone: AlertStatusTone = locked ? "locked" : enabled ? "long" : "info";

  return (
    <div className={`py-4 first:pt-0 last:pb-0 ${enabled || locked ? "" : "opacity-80"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={categoryTone(rule.category)}>{categoryLabel(rule.category)}</StatusPill>
            <StatusPill tone={rule.tier === "pro" ? "locked" : "info"} icon={rule.tier === "pro" ? Crown : undefined}>
              {rule.tier === "pro" ? "Pro" : "Basic"}
            </StatusPill>
            <StatusPill tone={statusTone}>{statusLabel}</StatusPill>
          </div>
          <h3 className="mt-3 text-base font-semibold text-ui-text">{rule.title}</h3>
          <p className="mt-1 text-sm leading-6 text-ui-muted [word-break:keep-all]">{rule.description}</p>
          {locked && lockedReason ? <p className="mt-2 text-xs leading-5 text-ui-locked [word-break:keep-all]">{lockedReason}</p> : null}
          {locked && lockedCtaHref && lockedCtaLabel ? (
            <ActionButton href={lockedCtaHref} tone="secondary" className="mt-2 min-h-8 px-0 text-xs text-ui-brand">
              <Crown size={13} aria-hidden />
              {lockedCtaLabel}
            </ActionButton>
          ) : null}
        </div>
        {locked ? (
          <span className="inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-full border border-ui-lineStrong px-3 text-xs font-semibold text-ui-locked">
            <Crown size={13} aria-hidden />
            Pro 필요
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onToggle(rule.id)}
            className={`relative h-7 w-12 shrink-0 rounded-full border transition ${
              enabled ? "border-ui-brand bg-ui-brand" : "border-ui-lineStrong bg-ui-panel"
            }`}
            aria-pressed={enabled}
            aria-label={`${rule.title} 알림 ${enabled ? "끄기" : "켜기"}`}
          >
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${enabled ? "left-6" : "left-1"}`} />
          </button>
        )}
      </div>
      <div className="mt-3">
        <DataRow className={alertRowClassName} label="조건" value="감시 중" detail={rule.trigger} />
        <DataRow className={alertRowClassName} label="확인 주기" value={rule.cadence} />
      </div>
    </div>
  );
}

export function RadarAlertCenter({ compact = false, market = "crypto" }: { compact?: boolean; market?: AlertMarket }) {
  const { session, user, profile, isLoading: isAuthLoading } = useSupabaseAuth();
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
  const [appPushState, setAppPushState] = useState<AppPushDeviceState>(() => readAppPushState());
  const [isRequesting, setIsRequesting] = useState(false);
  const [activeTestKind, setActiveTestKind] = useState<PushTestKind | null>(null);
  const [isDisablingPush, setIsDisablingPush] = useState(false);
  const [isManualChecking, setIsManualChecking] = useState(false);
  const [isLoadingPushDiagnostics, setIsLoadingPushDiagnostics] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [pushDiagnostics, setPushDiagnostics] = useState<AdminPushDiagnostics | null>(null);
  const [pushDiagnosticsError, setPushDiagnosticsError] = useState<string | null>(null);

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
    setAppPushState(readAppPushState());
    void registerAppPushListeners();
    return subscribeAppPushState(setAppPushState);
  }, []);

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
          ? `저장한 감시 조건 중 ${matchCount}개가 현재 시장 흐름과 다시 맞아떨어졌습니다.`
          : "지금은 저장한 감시 조건과 다시 맞아떨어지는 레이더가 없습니다."
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
  const scopedEnabledRuleIds = useMemo(() => enabledRuleIds.filter((id) => scopedRules.some((rule) => rule.id === id)), [enabledRuleIds, scopedRules]);
  const displayEnabledRuleIds = useMemo(
    () =>
      scopedEnabledRuleIds.filter((id) => {
        const rule = scopedRules.find((item) => item.id === id);
        return rule ? !isRuleLockedForPlan(rule, isPaid) : false;
      }),
    [isPaid, scopedEnabledRuleIds, scopedRules]
  );
  const summary = useMemo(() => summarizeRadarAlerts(displayEnabledRuleIds), [displayEnabledRuleIds]);
  const visibleRules = compact ? scopedRules.slice(0, 3) : scopedRules;
  const lockedVisibleRuleCount = visibleRules.filter((rule) => isRuleLockedForPlan(rule, isPaid)).length;
  const visibleBasicRuleCount = visibleRules.filter((rule) => rule.tier !== "pro").length;
  const visibleSetupMatches = useMemo(() => {
    const seen = new Set<string>();
    return setupMatches.filter((match) => {
      const key = `${match.setup.symbol}:${match.setup.timeframe}:${match.setup.side}:${match.setup.headline}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [setupMatches]);
  const alertUsageBucketId = market === "stocks" ? "stocksAlertRule" : "cryptoAlertRule";
  const isAndroidAppPush = appPushState.supported && appPushState.platform === "android";
  const isAdmin = user?.app_metadata?.role === "admin";
  const alertsMarketParam = market === "stocks" ? "global" : "crypto";
  const loginHref = `/login?returnTo=${encodeURIComponent(market === "stocks" ? `/alerts?market=${alertsMarketParam}` : "/crypto/alertset")}`;
  const isAppPushConnecting =
    isRequesting ||
    appPushState.registrationStage === "checking_permission" ||
    appPushState.registrationStage === "requesting_permission" ||
    appPushState.registrationStage === "registering_device" ||
    appPushState.registrationStage === "saving_token";
  const canSendAppPushTest =
    isAndroidAppPush && appPushState.permission === "granted" && Boolean(appPushState.token) && appPushState.synced && appPushState.registrationStage === "enabled";
  const isCurrentMarketPushEnabled = appPushState.synced && appPushState.markets.includes(market);
  const otherMarket = market === "stocks" ? "crypto" : "stocks";
  const otherMarketHref = market === "stocks" ? "/crypto/alertset" : "/alerts?market=global";

  function deliverableRuleIds(ruleIds: RadarAlertRuleId[]) {
    return ruleIds.filter((id) => {
      const rule = scopedRules.find((item) => item.id === id);
      return rule ? !isRuleLockedForPlan(rule, isPaid) : false;
    });
  }

  useEffect(() => {
    if (!appPushState.supported || !appPushState.token || !hasLoadedStoredRules || rulesMarket !== market) return;
    void syncAndroidAppPushPreferences({ market, ruleIds: displayEnabledRuleIds, presets: setupPresets }).then(setAppPushState);
  }, [appPushState.supported, appPushState.token, displayEnabledRuleIds, hasLoadedStoredRules, market, rulesMarket, setupPresets]);

  function toggleRule(ruleId: RadarAlertRuleId) {
    const rule = scopedRules.find((item) => item.id === ruleId);
    if (rule && isRuleLockedForPlan(rule, isPaid)) {
      setToast(lockedRuleReason(market));
      return;
    }

    if (!enabledRuleIds.includes(ruleId)) {
      const usageGate = getUsageGate(alertUsageBucketId, isPaid);
      if (!usageGate.allowed) {
        setToast(usageGate.message);
        return;
      }
      recordUsageEvent(alertUsageBucketId);
    }
    setEnabledRuleIds((current) => {
      const next = current.includes(ruleId) ? current.filter((id) => id !== ruleId) : [...current, ruleId];
      if (appPushState.supported && appPushState.token) {
        void syncAndroidAppPushPreferences({ market, ruleIds: deliverableRuleIds(next), presets: readSetupAlertPresets(market) }).then(setAppPushState);
      }
      return next;
    });
  }

  async function requestNotificationPermission() {
    if (isAndroidAppPush && !session) {
      setTestResult(null);
      setToast("로그인 후 앱 푸시 알림을 계정에 연결할 수 있습니다.");
      return;
    }

    setIsRequesting(true);
    setTestResult(null);
    try {
      if (isAndroidAppPush) {
        const next = await registerAndroidAppPush({ market, ruleIds: displayEnabledRuleIds, presets: readSetupAlertPresets(market) });
        setAppPushState(next);
        if (next.registrationStage === "enabled" && next.synced) {
          setToast("앱 푸시 알림이 켜졌습니다. 저장한 조건과 알림 규칙이 연결되었습니다.");
        } else {
          setToast(next.lastError ?? "앱 푸시 연결이 완료되지 않았습니다. 앱을 다시 실행하거나 알림 권한을 확인해 주세요.");
        }
        return;
      }

      const usageGate = getUsageGate(alertUsageBucketId, isPaid);
      if (!usageGate.allowed) {
        setToast(usageGate.message);
        return;
      }

      if (typeof window === "undefined" || !("Notification" in window)) {
        setPermission("unsupported");
        setToast("현재 브라우저에서는 브라우저 알림을 켤 수 없습니다.");
        return;
      }

      const result = await Notification.requestPermission();
      recordUsageEvent(alertUsageBucketId);
      setPermission(result as PermissionState);
      if (result === "granted") {
        new Notification("Chart Radar 브라우저 알림 테스트", {
          body: isGlobal
            ? "현재 열린 브라우저에서 글로벌 감시 조건을 포그라운드 알림으로 확인합니다."
            : "현재 열린 브라우저에서 레이더 감시 조건을 포그라운드 알림으로 확인합니다.",
          icon: "/brand/chart-radar-mark.png"
        });
        setToast("브라우저 알림이 켜졌습니다. 현재 열린 브라우저의 테스트/포그라운드 알림으로만 동작합니다.");
      } else {
        setToast("브라우저 알림이 꺼져 있습니다. 브라우저 설정에서 언제든 다시 켤 수 있습니다.");
      }
    } catch (error) {
      setToast(error instanceof Error ? error.message : "앱 푸시 연결이 완료되지 않았습니다. 앱을 다시 실행하거나 알림 권한을 확인해 주세요.");
    } finally {
      setIsRequesting(false);
    }
  }

  async function requestBrowserPreview(kind: PushTestKind) {
    const message = getPushTestMessage(kind);
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      setTestResult("현재 브라우저에서는 알림 미리보기를 표시할 수 없습니다.");
      return;
    }

    let result = Notification.permission as PermissionState;
    if (result === "default") {
      result = (await Notification.requestPermission()) as PermissionState;
      setPermission(result);
    }

    if (result !== "granted") {
      setTestResult("브라우저 알림 권한이 꺼져 있습니다. 브라우저 설정에서 알림을 허용해 주세요.");
      return;
    }

    new Notification(message.title, {
      body: message.body,
      icon: "/brand/chart-radar-mark.png"
    });
    setTestResult("브라우저 알림 미리보기를 표시했습니다. 실제 앱 푸시는 설치된 앱에서 확인할 수 있습니다.");
  }

  async function requestTestPush(kind: PushTestKind) {
    if (!isAndroidAppPush) {
      await requestBrowserPreview(kind);
      return;
    }
    if (appPushState.permission !== "granted" || !appPushState.token) {
      setTestResult("먼저 앱 푸시 알림을 켜 주세요.");
      return;
    }

    setActiveTestKind(kind);
    try {
      const result = (await sendAndroidAppPushTest(kind)) as { logged?: boolean };
      const message = getPushTestMessage(kind);
      setTestResult(
        result.logged === false
          ? `${message.label}을 보냈습니다. 수신 여부를 휴대폰 알림 영역에서 확인해 주세요.`
          : `${message.label}을 보냈습니다. 휴대폰 알림 영역에서 수신 여부를 확인해 주세요.`
      );
    } catch (error) {
      setTestResult(error instanceof Error ? error.message : "테스트 알림 발송에 실패했습니다.");
    } finally {
      setActiveTestKind(null);
    }
  }

  async function requestPushDiagnostics() {
    if (!session?.accessToken) {
      setPushDiagnosticsError("관리자 로그인이 필요합니다.");
      return;
    }

    setIsLoadingPushDiagnostics(true);
    setPushDiagnosticsError(null);
    try {
      const response = await fetch("/api/admin/push-diagnostics", {
        headers: { Authorization: `Bearer ${session.accessToken}` },
        cache: "no-store"
      });
      const payload = (await response.json().catch(() => ({}))) as AdminPushDiagnostics & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "자동 알림 진단을 불러오지 못했습니다.");
      setPushDiagnostics(payload);
    } catch (error) {
      setPushDiagnosticsError(error instanceof Error ? error.message : "자동 알림 진단을 불러오지 못했습니다.");
    } finally {
      setIsLoadingPushDiagnostics(false);
    }
  }

  async function requestDisablePush() {
    setIsDisablingPush(true);
    try {
      const next = await disableAndroidAppPush();
      setAppPushState(next);
      setToast("앱 푸시 알림을 해제했습니다.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "앱 푸시 알림 해제에 실패했습니다.");
    } finally {
      setIsDisablingPush(false);
    }
  }

  function requestManualAlertCheck() {
    if (typeof window === "undefined") return;
    if (setupPresets.length === 0) {
      setToast("먼저 레이더 감지 카드에서 감시할 조건을 저장해 주세요.");
      return;
    }

    setIsManualChecking(true);
    setToast("저장한 조건과 현재 시장 흐름을 다시 비교하는 중입니다.");
    window.dispatchEvent(new CustomEvent(REQUEST_SETUP_ALERT_CHECK_EVENT, { detail: { market } }));
  }

  return (
    <AppSurface variant="flat" padding="lg" className="space-y-6">
      <SectionHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={`${copy.description} 주요 조건이 감지되면 앱 푸시 알림으로 알려드립니다.`}
        action={
          <div className="flex flex-wrap gap-2">
            <StatusPill tone={isAndroidAppPush ? appPushConnectionTone(appPushState) : "info"} icon={BellRing}>
              {isAndroidAppPush ? appPushConnectionLabel(appPushState) : "앱에서 사용 가능"}
            </StatusPill>
            <StatusPill tone="info">{summary.enabledCount}개 켜짐</StatusPill>
          </div>
        }
      />

      {!isPaid ? (
        <AppSurface tone="inset" variant="flat" padding="none" className="border-y border-ui-line py-3">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone="info">Basic {visibleBasicRuleCount}</StatusPill>
                <StatusPill tone="locked" icon={Crown}>Pro 잠김 {lockedVisibleRuleCount}</StatusPill>
              </div>
              <p className="mt-2 text-sm leading-6 text-ui-muted [word-break:keep-all]">
                Basic은 핵심 알림을 직접 저장하고, {proPlanLabelForMarket(market)}는 무효화·변동성·시장 전환 조건까지 함께 감시합니다.
              </p>
            </div>
            <ActionButton href={proHrefForMarket(market)} tone="secondary" className="min-h-9 w-full text-xs sm:w-auto">
              <Crown size={13} aria-hidden />
              Pro 알림 기준 보기
            </ActionButton>
          </div>
        </AppSurface>
      ) : null}

      <PanelCard variant="flat" padding="none" className="border-t border-ui-line py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={isAndroidAppPush ? appPushConnectionTone(appPushState) : "info"} icon={ShieldCheck}>
                {isAndroidAppPush ? appPushConnectionLabel(appPushState) : "앱에서 사용 가능"}
              </StatusPill>
              <StatusPill tone={permissionTone(permission, appPushState, isAndroidAppPush)}>
                {permissionSummaryLabel(permission, appPushState, isAndroidAppPush)}
              </StatusPill>
            </div>
            <h3 className="mt-3 text-base font-semibold text-ui-text">앱 푸시 알림 상태</h3>
            <p className="mt-1 text-sm leading-6 text-ui-muted [word-break:keep-all]">
              {isAndroidAppPush
                ? "시장 상황과 설정한 조건에 따라 알림을 보냅니다."
                : "앱 푸시는 설치된 앱에서 사용할 수 있습니다. 브라우저 알림은 현재 열린 화면의 미리보기 수준으로만 동작합니다."}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto lg:shrink-0">
            <ActionButton
              tone="primary"
              onClick={requestNotificationPermission}
              disabled={isAppPushConnecting || (isAndroidAppPush && isAuthLoading) || (!isAndroidAppPush && permission === "unsupported")}
              className="min-h-10 w-full px-4 text-sm sm:w-auto"
            >
              {isAppPushConnecting ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <CheckCircle2 size={16} aria-hidden />}
              {isAndroidAppPush ? marketPushActionLabel(market, appPushState, isAuthLoading) : "브라우저 알림 켜기"}
            </ActionButton>
            {isAndroidAppPush && appPushState.token ? (
              <ActionButton
                tone="danger"
                onClick={requestDisablePush}
                disabled={isDisablingPush}
                className="min-h-10 w-full px-4 text-sm sm:w-auto"
              >
                {isDisablingPush ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <ShieldCheck size={16} aria-hidden />}
                앱 푸시 알림 끄기
              </ActionButton>
            ) : null}
          </div>
        </div>

        <div className="mt-4">
          <DataRow className={alertRowClassName} label="앱 푸시 연결" value={<StatusPill tone={isAndroidAppPush ? appPushConnectionTone(appPushState) : "info"}>{isAndroidAppPush ? appPushConnectionLabel(appPushState) : "앱에서 사용 가능"}</StatusPill>} />
          <DataRow className={alertRowClassName} label="알림 권한" value={<StatusPill tone={permissionTone(permission, appPushState, isAndroidAppPush)}>{permissionSummaryLabel(permission, appPushState, isAndroidAppPush)}</StatusPill>} />
          <DataRow className={alertRowClassName} label="마지막 연결" value={isAndroidAppPush ? formatAppPushUpdatedAt(appPushState.updatedAt) : "앱에서 확인"} />
        </div>

        {isAndroidAppPush ? (
          <div className="mt-3">
            <DataRow className={alertRowClassName} label="현재 수신 시장" value={formatPushMarkets(appPushState.markets)} />
            <DataRow
              className={alertRowClassName}
              label={`${marketDisplayName(market)} 알림`}
              value={<StatusPill tone={isCurrentMarketPushEnabled ? "long" : "info"}>{isCurrentMarketPushEnabled ? "켜짐" : "꺼짐"}</StatusPill>}
              detail={`${marketDisplayName(otherMarket)} 알림은 ${marketDisplayName(otherMarket)} 알림 화면에서 별도로 켤 수 있습니다.`}
            />
            <ActionButton href={otherMarketHref} tone="secondary" className="mt-2 min-h-9 w-full text-xs sm:w-auto">
              {marketDisplayName(otherMarket)} 알림 설정하기
            </ActionButton>
          </div>
        ) : null}

        {isAndroidAppPush ? (
          <AppSurface tone="inset" variant="flat" padding="none" className="mt-3 border-t border-ui-line pt-3 text-xs leading-5 text-ui-muted">
            <p>
              <span className="font-semibold text-ui-subtle">현재 단계</span> {appPushStageLabel(appPushState.registrationStage)}
              {appPushState.lastFailureStage ? ` · 실패 단계 ${appPushStageLabel(appPushState.lastFailureStage)}` : ""}
            </p>
            {appPushState.lastError ? (
              <p className="mt-1 text-ui-risk">
                <span className="font-semibold">마지막 오류</span> {appPushState.lastError}
              </p>
            ) : null}
          </AppSurface>
        ) : null}

        {isAndroidAppPush && !canSendAppPushTest ? (
          <AppSurface tone="inset" padding="sm" className="mt-3 border-amber-400/24 bg-amber-400/10 text-xs leading-5 text-ui-risk shadow-none">
            <p>{session ? "앱 푸시 알림을 켜면 주요 조건이 감지될 때 알려드립니다." : "로그인 후 앱 푸시 알림을 계정에 연결할 수 있습니다."}</p>
          </AppSurface>
        ) : null}
      </PanelCard>

      {toast ? (
        <AppSurface as="p" tone="inset" padding="sm" className="text-xs leading-5 text-ui-brand shadow-none">
          {toast}
        </AppSurface>
      ) : null}

      {isAndroidAppPush && !isAuthLoading && !session ? (
        <PanelCard variant="flat" padding="none" className="flex flex-col gap-3 border-t border-ui-line py-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-ui-muted">로그인 후 앱 푸시 알림을 계정에 연결할 수 있습니다.</p>
          <ActionButton href={loginHref} tone="primary" className="min-h-10 w-full px-4 text-sm sm:w-auto">
            로그인하기
          </ActionButton>
        </PanelCard>
      ) : null}

      <PanelCard variant="flat" padding="none" className="border-t border-ui-line py-5">
        <SectionHeader
          title="기준가/무효화 알림"
          description="관심 있는 자산과 판단 기준을 모아두고 다시 맞아떨어지는 순간을 확인합니다."
          action={<StatusPill tone="info">{setupPresets.length}개 저장</StatusPill>}
        />
        <div className="mt-4">
          <ActionButton
            tone="secondary"
            onClick={requestManualAlertCheck}
            disabled={isManualChecking}
            className="min-h-10 w-full text-sm"
          >
            {isManualChecking ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Radar size={16} aria-hidden />}
            기준가/무효화 알림 다시 확인
          </ActionButton>
        </div>

        {monitorStatus ? (
          <div className="mt-4 border-y border-ui-line">
            <MetricRow className={alertRowClassName} label="마지막 확인" value={formatCheckedAt(monitorStatus.checkedAt)} />
            <MetricRow className={alertRowClassName} label="확인 범위" value={`조건 ${monitorStatus.presetCount}개 · 후보 ${monitorStatus.setupCount}개`} />
            <MetricRow
              className={alertRowClassName}
              label={monitorReasonLabel(monitorStatus.reason)}
              value={<StatusPill tone={monitorStatus.matchCount > 0 ? "long" : "info"}>일치 {monitorStatus.matchCount}개</StatusPill>}
            />
          </div>
        ) : (
          <AppSurface variant="flat" tone="inset" padding="none" className="mt-4 border-t border-ui-line pt-3 text-xs leading-5 text-ui-muted">
            저장한 조건의 마지막 상태가 여기에 표시됩니다.
          </AppSurface>
        )}

        {visibleSetupMatches.length > 0 ? (
          <AppSurface variant="report" tone="inset" padding="sm" className="mt-4 border-emerald-400/24 shadow-none">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-ui-long">최근 일치 감지</p>
              <span className="text-ui-label font-semibold text-ui-muted">{formatSavedAt(visibleSetupMatches[0].matchedAt)}</span>
            </div>
            <div className="mt-2 divide-y divide-ui-line">
              {visibleSetupMatches.slice(0, compact ? 1 : 2).map((match) => (
                <article key={match.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-semibold text-ui-text">{compactSymbol(match.setup.symbol)}</span>
                    <StatusPill tone="info" className="min-h-0 px-1.5 py-0.5 text-[10px]">{match.setup.timeframe}</StatusPill>
                    <StatusPill tone={match.setup.side === "long" ? "long" : "short"} className="min-h-0 px-1.5 py-0.5 text-[10px]">
                      {presetSideLabel(match.setup.side, market)}
                    </StatusPill>
                    <StatusPill tone="watch" className="min-h-0 px-1.5 py-0.5 text-[10px]">{match.setup.score}점</StatusPill>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-ui-muted">{match.setup.headline}</p>
                </article>
              ))}
            </div>
          </AppSurface>
        ) : (
          <AppSurface variant="flat" tone="inset" padding="none" className="mt-4 border-t border-ui-line pt-3 text-xs leading-5 text-ui-muted">
            저장한 판단 기준과 레이더 결과가 맞으면 최근 일치로 표시합니다.
          </AppSurface>
        )}

        {setupPresets.length > 0 ? (
          <div className="mt-4 divide-y divide-ui-line border-y border-ui-line">
            {setupPresets.slice(0, compact ? 2 : 6).map((preset) => (
              <article key={preset.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold text-ui-text">{compactSymbol(preset.symbol)}</span>
                      <StatusPill tone="info" className="min-h-0 px-1.5 py-0.5 text-[10px]">{preset.timeframe}</StatusPill>
                      <StatusPill tone={preset.side === "long" ? "long" : "short"} className="min-h-0 px-1.5 py-0.5 text-[10px]">
                        {presetSideLabel(preset.side, market)}
                      </StatusPill>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-ui-muted">{preset.headline}</p>
                  </div>
                  <StatusPill tone="watch" className="shrink-0">{preset.score}점</StatusPill>
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-ui-label font-semibold text-ui-subtle">
                  <Clock3 size={12} aria-hidden />
                  {formatSavedAt(preset.savedAt)}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <AppSurface variant="flat" tone="inset" padding="none" className="mt-4 border-t border-ui-line pt-3 text-xs leading-5 text-ui-muted">
            감시 저장을 누르면 조건이 여기에 모입니다.
          </AppSurface>
        )}
      </PanelCard>

      <PanelCard variant="flat" padding="none" className="border-t border-ui-line py-5">
        <SectionHeader
          title="알림 조건"
          description={summary.headline}
          action={
            <div className="flex flex-wrap gap-2">
              <StatusPill tone="locked">{lockedVisibleRuleCount > 0 ? `Pro 잠김 ${lockedVisibleRuleCount}` : `Pro ${summary.proCount}`}</StatusPill>
              <StatusPill tone="info">Basic {summary.freeCount}</StatusPill>
            </div>
          }
        />
        <div className="mt-4 divide-y divide-ui-line border-y border-ui-line">
          {visibleRules.map((rule) => {
            const locked = isRuleLockedForPlan(rule, isPaid);
            return (
              <RuleCard
                key={rule.id}
                rule={rule}
                enabled={!locked && enabledRuleIds.includes(rule.id)}
                locked={locked}
                lockedReason={locked ? lockedRuleReason(market) : undefined}
                lockedCtaHref={locked ? proHrefForMarket(market) : undefined}
                lockedCtaLabel={locked ? `${proPlanLabelForMarket(market)} 알림 기준 확인` : undefined}
                onToggle={toggleRule}
              />
            );
          })}
        </div>
      </PanelCard>

      {isAdmin ? (
        <AppSurface tone="inset" padding="md" className="space-y-4 border-amber-400/24 shadow-none">
          <SectionHeader
            eyebrow="관리자 전용"
            title="운영 도구"
            description="테스트 알림과 자동 알림 진단은 관리자에게만 표시됩니다."
            action={<StatusPill tone="risk">관리자</StatusPill>}
          />

          <PanelCard variant="report" className="shadow-none">
            <SectionHeader
              title="테스트 알림"
              description="현재 로그인한 내 계정과 이 기기 연결로만 테스트 알림을 보냅니다."
            />
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {pushTestMessages.map((message) => {
                const isActive = activeTestKind === message.kind;
                return (
                  <ActionButton
                    key={message.kind}
                    tone="secondary"
                    onClick={() => void requestTestPush(message.kind)}
                    disabled={Boolean(activeTestKind) || (isAndroidAppPush && (isAppPushConnecting || !canSendAppPushTest))}
                    className="min-h-16 flex-col items-start justify-start px-3 py-2 text-left"
                  >
                    <span className="flex items-center gap-2 text-xs font-semibold text-ui-text">
                      {isActive ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <BellRing size={14} aria-hidden />}
                      {message.label}
                    </span>
                    <span className="text-[11px] leading-4 text-ui-muted">{message.title}</span>
                  </ActionButton>
                );
              })}
            </div>
            {testResult ? (
              <AppSurface as="p" tone="inset" padding="sm" className="mt-3 text-xs leading-5 text-ui-brand shadow-none">
                {testResult}
              </AppSurface>
            ) : null}
          </PanelCard>

          <details className="border-y border-ui-line py-4">
            <summary className="cursor-pointer text-sm font-semibold text-ui-text">자동 알림 진단</summary>
            <p className="mt-2 text-xs leading-5 text-ui-muted">
              실제 발송 없이 후보와 제외 사유를 확인합니다. 기기 식별값, 이메일, 사용자 ID는 표시하지 않습니다.
            </p>
            <ActionButton
              tone="secondary"
              onClick={() => void requestPushDiagnostics()}
              disabled={isLoadingPushDiagnostics}
              className="mt-3"
            >
              {isLoadingPushDiagnostics ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Radar size={14} aria-hidden />}
              진단 새로고침
            </ActionButton>
            {pushDiagnosticsError ? (
              <AppSurface as="p" tone="inset" padding="sm" className="mt-3 border-amber-400/24 bg-amber-400/10 text-xs leading-5 text-ui-risk shadow-none">
                {pushDiagnosticsError}
              </AppSurface>
            ) : null}
            {pushDiagnostics ? (
              <div className="mt-3 space-y-3">
                <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                  <PanelCard variant="list" className="p-3 shadow-none">
                    <MetricRow label="진단 시각" value={formatAbsoluteTime(pushDiagnostics.scannedAt)} />
                  </PanelCard>
                  <PanelCard variant="list" className="p-3 shadow-none">
                    <MetricRow label="연결 기기" value={`${pushDiagnostics.diagnostics.tokenCount}개`} />
                  </PanelCard>
                  <PanelCard variant="list" className="p-3 shadow-none">
                    <MetricRow label="발송 후보" value={`${pushDiagnostics.diagnostics.eligibleEventCount}개`} />
                  </PanelCard>
                  <PanelCard variant="list" className="p-3 shadow-none">
                    <MetricRow label="발송 대상" value={`${pushDiagnostics.diagnostics.sendTargetTokenCount}개`} />
                  </PanelCard>
                  <PanelCard variant="list" className="p-3 shadow-none">
                    <MetricRow label="저장 알림" value={`${pushDiagnostics.diagnostics.presetCount}개`} />
                  </PanelCard>
                  <PanelCard variant="list" className="p-3 shadow-none">
                    <MetricRow label="자동 후보" value={`${pushDiagnostics.diagnostics.genericEventCount}개`} />
                  </PanelCard>
                  <PanelCard variant="list" className="p-3 shadow-none">
                    <MetricRow label="낮은 점수 제외" value={`${pushDiagnostics.diagnostics.skippedLowScoreCount}개`} />
                  </PanelCard>
                  <PanelCard variant="list" className="p-3 shadow-none">
                    <MetricRow label="중복 제외" value={`${pushDiagnostics.diagnostics.duplicateSkippedTokenCount}개`} />
                  </PanelCard>
                </div>
                <AppSurface variant="report" tone="inset" padding="sm" className="text-xs leading-5 text-ui-muted shadow-none">
                  <p className="font-semibold text-ui-text">
                    최근 24시간 기록 {pushDiagnostics.last24h.loggedEventCount}개 · 발송 합계 {pushDiagnostics.last24h.sentCount}개 · 진단 실패 {pushDiagnostics.last24h.failureCount}개
                  </p>
                  <p className="mt-1">
                    조회 오류 {pushDiagnostics.diagnostics.lookupErrorCount ?? 0}개 · 스캐너 오류 {pushDiagnostics.diagnostics.scannerErrorCount ?? 0}개
                  </p>
                  <p className="mt-1">
                    후보 {pushDiagnostics.diagnostics.candidateEventCount ?? pushDiagnostics.diagnostics.genericEventCount}개 · 품질 통과{" "}
                    {pushDiagnostics.diagnostics.qualityPassedEventCount ?? pushDiagnostics.diagnostics.eligibleEventCount}개 · 최종 시도{" "}
                    {pushDiagnostics.diagnostics.finalSendAttemptCount ?? 0}개
                  </p>
                </AppSurface>
                <PanelCard variant="report" className="shadow-none">
                  <p className="text-xs font-semibold text-ui-text">최근 후보 이벤트</p>
                  <div className="mt-2 space-y-2">
                    {pushDiagnostics.candidateEvents.slice(0, 5).map((event, index) => (
                      <article key={`${event.signalType}-${event.symbol ?? "market"}-${index}`} className="border-t border-ui-line py-2 text-[11px] leading-4 text-ui-muted first:border-t-0">
                        <p className="font-semibold text-ui-text">{event.alertTitle}</p>
                        <p>
                          {event.market} · {event.symbol ?? "시장"} · {event.score ?? "-"}점 · {event.alertKind} · {event.wouldSend ? "발송 가능" : event.skippedReason ?? "제외"}
                        </p>
                      </article>
                    ))}
                    {pushDiagnostics.candidateEvents.length === 0 ? <p className="text-[11px] text-ui-muted">후보 이벤트가 없습니다.</p> : null}
                  </div>
                </PanelCard>
              </div>
            ) : null}
          </details>
        </AppSurface>
      ) : null}

      {compact ? (
        <ActionButton
          href={market === "stocks" ? "/alerts?market=global" : "/crypto/alertset"}
          tone="secondary"
          className="min-h-10 w-full text-sm"
        >
          알림 조건 전체 설정하기
        </ActionButton>
      ) : null}
    </AppSurface>
  );
}
