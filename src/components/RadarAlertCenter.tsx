"use client";
// 사용자가 받을 레이더 알림 조건을 설정하고 Pro 가치를 확인하는 패널입니다.
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
  type AppPushRegistrationStage,
  type AppPushDeviceState
} from "@/lib/appPush";

const baseStorageKey = "chartRadar.alertRules.v1";

type PermissionState = "unsupported" | "default" | "granted" | "denied";
type AlertMarket = "crypto" | "stocks";

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

function categoryClass(category: RadarAlertRule["category"]) {
  if (category === "crypto") return "border-cyan-300/25 bg-cyan-300/10 text-cyan-200";
  if (category === "stocks") return "border-emerald-300/25 bg-emerald-300/10 text-emerald-200";
  if (category === "news") return "border-amber-300/25 bg-amber-300/10 text-amber-200";
  return "border-slate-300/20 bg-slate-300/10 text-slate-200";
}

function permissionLabel(permission: PermissionState) {
  if (permission === "granted") return "브라우저 알림 권한이 켜져 있습니다";
  if (permission === "denied") return "브라우저 알림이 꺼져 있습니다";
  if (permission === "unsupported") return "현재 브라우저에서는 알림을 켤 수 없습니다";
  return "브라우저 알림 권한을 켤 수 있습니다";
}

function appPushPermissionLabel(state: AppPushDeviceState) {
  if (!state.supported) return "현재 환경에서는 앱 푸시 알림을 켤 수 없습니다";
  if (state.registrationStage === "checking_permission") return "알림 권한을 확인하고 있습니다";
  if (state.registrationStage === "requesting_permission") return "알림 권한을 요청하고 있습니다";
  if (state.registrationStage === "registering_device") return "앱 푸시 알림을 연결하고 있습니다";
  if (state.registrationStage === "saving_token") return "앱 푸시 알림 연결을 저장하고 있습니다";
  if (state.registrationStage === "failed") return "앱 푸시 알림 연결에 실패했습니다";
  if (state.permission === "granted" && state.synced) return "앱 푸시 알림이 켜져 있습니다";
  if (state.permission === "granted" && state.token) return "앱 알림 연결 확인이 필요합니다";
  if (state.permission === "denied") return "알림 권한이 거부되었습니다";
  return "앱 푸시 알림을 켤 수 있습니다";
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

function compactSymbol(symbol: string) {
  return symbol.replace("USDT.P", "").replace("USDT", "");
}

function presetSideLabel(side: SetupAlertPreset["side"], market: AlertMarket = "crypto") {
  if (market === "stocks") return side === "long" ? "상승 우세" : "하락 우세";
  return side === "long" ? "롱 우세" : "숏 우세";
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

function monitorReasonLabel(reason: SetupAlertMonitorStatus["reason"]) {
  if (reason === "manual") return "직접 확인";
  if (reason === "preset-change") return "조건 변경";
  if (reason === "visible") return "화면 확인";
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
    <article className={`rounded-xl border p-4 transition ${enabled ? "border-accent-blue/35 bg-accent-blue/10" : "border-surface-line bg-surface-cardSoft"}`}>
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
                Basic
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
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${enabled ? "left-6" : "left-1"}`} />
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
  const [appPushState, setAppPushState] = useState<AppPushDeviceState>(() => readAppPushState());
  const [isRequesting, setIsRequesting] = useState(false);
  const [activeTestKind, setActiveTestKind] = useState<PushTestKind | null>(null);
  const [isDisablingPush, setIsDisablingPush] = useState(false);
  const [isManualChecking, setIsManualChecking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

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

  useEffect(() => {
    if (!appPushState.supported || !appPushState.token || !hasLoadedStoredRules || rulesMarket !== market) return;
    void syncAndroidAppPushPreferences({ market, ruleIds: enabledRuleIds, presets: setupPresets }).then(setAppPushState);
  }, [appPushState.supported, appPushState.token, enabledRuleIds, hasLoadedStoredRules, market, rulesMarket, setupPresets]);

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
  const isAppPushConnecting =
    isRequesting ||
    appPushState.registrationStage === "checking_permission" ||
    appPushState.registrationStage === "requesting_permission" ||
    appPushState.registrationStage === "registering_device" ||
    appPushState.registrationStage === "saving_token";
  const canSendAppPushTest =
    isAndroidAppPush && appPushState.permission === "granted" && Boolean(appPushState.token) && appPushState.synced && appPushState.registrationStage === "enabled";

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
      const next = current.includes(ruleId) ? current.filter((id) => id !== ruleId) : [...current, ruleId];
      if (appPushState.supported && appPushState.token) {
        void syncAndroidAppPushPreferences({ market, ruleIds: next, presets: readSetupAlertPresets(market) }).then(setAppPushState);
      }
      return next;
    });
  }

  async function requestNotificationPermission() {
    setIsRequesting(true);
    setTestResult(null);
    try {
      if (isAndroidAppPush) {
        const next = await registerAndroidAppPush({ market, ruleIds: scopedEnabledRuleIds, presets: readSetupAlertPresets(market) });
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
    <section className="enterprise-panel p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-accent-blue/25 bg-accent-blue/10 text-accent-blue">
            <BellRing size={22} aria-hidden />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">{copy.eyebrow}</p>
            <h2 className="mt-1 text-xl font-black text-white">{copy.title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400 [word-break:keep-all]">
              {copy.description} 주요 조건이 감지되면 앱 알림으로 알려드립니다.
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-surface-line bg-surface-cardSoft p-3 lg:w-72">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-slate-400">켜진 알림</span>
            <span className="text-lg font-black text-cyan-200">{summary.enabledCount}개</span>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-400 [word-break:keep-all]">{summary.headline}</p>
          <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-bold">
            <span className="rounded-md border border-accent-blue/25 bg-accent-blue/10 px-2 py-1 text-accent-blue">
              Pro {summary.proCount}
            </span>
            <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-slate-300">
              Basic {summary.freeCount}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-surface-line bg-surface-cardSoft p-4">
          <Radar className="text-cyan-300" size={20} aria-hidden />
          <p className="mt-3 text-sm font-black text-white">{isGlobal ? "지수·변동성 감지" : "레이더 감지"}</p>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            {isGlobal ? "QQQ/SPY, NQ/ES, VIX 흐름 변화를 함께 확인합니다." : "A급 후보와 관심코인 변화를 빠르게 확인합니다."}
          </p>
        </div>
        <div className="rounded-xl border border-surface-line bg-surface-cardSoft p-4">
          <Zap className="text-orange-200" size={20} aria-hidden />
          <p className="mt-3 text-sm font-black text-white">{isGlobal ? "리스크오프 조합" : "위험 압력"}</p>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            {isGlobal ? "지수 약세, 변동성 상승, 달러·금 흐름을 함께 점검합니다." : "청산 압력과 과열 구간을 추격 전에 먼저 봅니다."}
          </p>
        </div>
        <div className="rounded-xl border border-surface-line bg-surface-cardSoft p-4">
          <Smartphone className="text-emerald-200" size={20} aria-hidden />
          <p className="mt-3 text-sm font-black text-white">앱 푸시 알림</p>
          <p className="mt-2 text-xs leading-5 text-slate-400">앱에서는 주요 조건을 알림으로 받고, 웹 알림은 열린 브라우저 안에서만 확인합니다.</p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-xl border border-surface-line bg-surface-cardSoft p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-black text-white">
            <ShieldCheck size={16} className="text-cyan-300" aria-hidden />
            {isAndroidAppPush ? appPushPermissionLabel(appPushState) : permissionLabel(permission)}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {isAndroidAppPush
              ? "알림은 시장 상황과 설정한 조건에 따라 발송됩니다. 주요 조건이 감지되면 앱 알림으로 알려드립니다."
              : "브라우저 알림은 현재 열린 화면에서 조건 일치를 알려주는 테스트 알림입니다. 백그라운드 웹 알림은 추후 별도로 지원할 예정입니다."}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={requestNotificationPermission}
            disabled={isAppPushConnecting || (!isAndroidAppPush && permission === "unsupported")}
            className="enterprise-button inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isAppPushConnecting ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <CheckCircle2 size={16} aria-hidden />}
            {isAndroidAppPush ? appPushActionLabel(appPushState.registrationStage) : "브라우저 알림 켜기"}
          </button>
          {isAndroidAppPush && appPushState.token ? (
            <>
              <button
                type="button"
                onClick={requestDisablePush}
                disabled={isDisablingPush}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-red-300/25 bg-red-300/10 px-4 text-sm font-black text-red-100 disabled:cursor-wait disabled:opacity-60"
              >
                {isDisablingPush ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <ShieldCheck size={16} aria-hidden />}
                앱 푸시 알림 끄기
              </button>
            </>
          ) : null}
        </div>
      </div>

      {toast ? (
        <p className="mt-3 rounded-xl border border-accent-blue/20 bg-accent-blue/10 px-3 py-2 text-xs leading-5 text-accent-blue">
          {toast}
        </p>
      ) : null}

      <div className="mt-4 rounded-xl border border-surface-line bg-surface-cardSoft p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-black text-white">푸시 테스트 / 알림 미리보기</p>
            <p className="mt-1 text-xs leading-5 text-slate-500 [word-break:keep-all]">
              {isAndroidAppPush
                ? "현재 로그인한 내 계정과 이 기기 연결로만 테스트 알림을 보냅니다."
                : "앱 푸시는 설치된 앱에서 사용할 수 있습니다. 웹에서는 브라우저 알림 미리보기만 확인합니다."}
            </p>
          </div>
          <span className="w-fit rounded-md border border-cyan-300/25 bg-cyan-300/10 px-2 py-1 text-[11px] font-black text-cyan-200">
            {isAndroidAppPush ? "앱 알림 테스트" : "브라우저 미리보기"}
          </span>
        </div>

        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border border-white/10 bg-black/25 p-3">
            <p className="font-bold text-slate-500">앱 환경</p>
            <p className="mt-1 font-black text-white">{isAndroidAppPush ? "확인됨" : "확인 안 됨"}</p>
          </div>
          <div className="rounded-md border border-white/10 bg-black/25 p-3">
            <p className="font-bold text-slate-500">알림 권한</p>
            <p className="mt-1 font-black text-white">{isAndroidAppPush ? appPushPermissionLabel(appPushState) : permissionLabel(permission)}</p>
          </div>
          <div className="rounded-md border border-white/10 bg-black/25 p-3">
            <p className="font-bold text-slate-500">앱 푸시 연결</p>
            <p className="mt-1 font-black text-white">{isAndroidAppPush ? appPushConnectionLabel(appPushState) : "앱에서 사용 가능"}</p>
          </div>
          <div className="rounded-md border border-white/10 bg-black/25 p-3">
            <p className="font-bold text-slate-500">마지막 연결 시각</p>
            <p className="mt-1 font-black text-white">{isAndroidAppPush ? formatAppPushUpdatedAt(appPushState.updatedAt) : "앱에서 확인"}</p>
          </div>
        </div>

        {isAndroidAppPush ? (
          <div className="mt-2 rounded-md border border-white/10 bg-black/20 p-3 text-xs leading-5 text-slate-400">
            <p>
              <span className="font-bold text-slate-500">연결 단계.</span> {appPushStageLabel(appPushState.registrationStage)}
              {appPushState.lastFailureStage ? ` · 실패 단계 ${appPushStageLabel(appPushState.lastFailureStage)}` : ""}
            </p>
            {appPushState.lastError ? (
              <p className="mt-1 text-amber-100">
                <span className="font-bold text-amber-200">마지막 오류.</span> {appPushState.lastError}
              </p>
            ) : null}
          </div>
        ) : null}

        {isAndroidAppPush && !canSendAppPushTest ? (
          <div className="mt-3 rounded-md border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">
            <p>앱 푸시 알림을 켜면 주요 조건이 감지될 때 알려드립니다.</p>
            <p className="mt-1 text-amber-100/80">상단의 앱 푸시 알림 켜기 버튼으로 연결한 뒤 테스트 알림을 보낼 수 있습니다.</p>
          </div>
        ) : null}

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {pushTestMessages.map((message) => {
            const isActive = activeTestKind === message.kind;
            return (
              <button
                key={message.kind}
                type="button"
                onClick={() => void requestTestPush(message.kind)}
                disabled={Boolean(activeTestKind) || (isAndroidAppPush && (isAppPushConnecting || !canSendAppPushTest))}
                className="min-h-16 rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-left transition hover:border-cyan-200 hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="flex items-center gap-2 text-xs font-black text-cyan-100">
                  {isActive ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <BellRing size={14} aria-hidden />}
                  {message.label}
                </span>
                <span className="mt-1 block text-[11px] leading-4 text-slate-400">{message.title}</span>
              </button>
            );
          })}
        </div>

        {testResult ? (
          <p className="mt-3 rounded-md border border-accent-blue/20 bg-accent-blue/10 p-3 text-xs leading-5 text-accent-blue">
            {testResult}
          </p>
        ) : null}
      </div>

      <div className="mt-4 rounded-xl border border-surface-line bg-surface-cardSoft p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-white">내가 저장한 레이더 감시</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              관심 있는 자산과 조건만 모아두고, 다시 맞아떨어지는 순간을 빠르게 확인합니다.
            </p>
          </div>
          <span className="rounded-md border border-accent-blue/25 bg-accent-blue/10 px-2 py-1 text-xs font-black text-accent-blue">
            {setupPresets.length}개 저장
          </span>
        </div>
        <button
          type="button"
          onClick={requestManualAlertCheck}
          disabled={isManualChecking}
          className="enterprise-button mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg px-3 text-sm font-black disabled:cursor-wait disabled:opacity-70"
        >
          {isManualChecking ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Radar size={16} aria-hidden />}
          저장 조건 다시 확인
        </button>
        {monitorStatus ? (
          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
            <div className="rounded-md border border-white/10 bg-black/25 p-3">
              <p className="font-bold text-slate-500">마지막 확인</p>
              <p className="mt-1 font-black text-white">{formatCheckedAt(monitorStatus.checkedAt)}</p>
            </div>
            <div className="rounded-md border border-white/10 bg-black/25 p-3">
              <p className="font-bold text-slate-500">확인 범위</p>
              <p className="mt-1 font-black text-white">
                조건 {monitorStatus.presetCount}개 · 후보 {monitorStatus.setupCount}개
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
            알림 화면을 열면 저장한 조건을 다시 훑고, 마지막 확인 상태가 여기에 표시됩니다.
          </p>
        )}
        {visibleSetupMatches.length > 0 ? (
          <div className="mt-3 rounded-md border border-emerald-300/25 bg-emerald-300/10 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-black text-emerald-200">최근 일치 감지</p>
              <span className="text-[11px] font-bold text-emerald-200/80">{formatSavedAt(visibleSetupMatches[0].matchedAt)}</span>
            </div>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {visibleSetupMatches.slice(0, compact ? 1 : 2).map((match) => (
                <article key={match.id} className="rounded border border-emerald-300/20 bg-black/20 p-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-black text-white">{compactSymbol(match.setup.symbol)}</span>
                    <span className="rounded border border-white/10 bg-black/30 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
                      {match.setup.timeframe}
                    </span>
                    <span className={match.setup.side === "long" ? "rounded border border-emerald-300/25 bg-emerald-300/10 px-1.5 py-0.5 text-[10px] font-black text-emerald-200" : "rounded border border-red-300/25 bg-red-300/10 px-1.5 py-0.5 text-[10px] font-black text-red-200"}>
                      {presetSideLabel(match.setup.side, market)}
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
            저장 조건이 현재 레이더 결과와 다시 맞아떨어지면 최근 일치 감지로 모아 보여줍니다.
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
                        {presetSideLabel(preset.side, market)}
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
            아직 저장한 감시 조건이 없습니다. 레이더 감지 카드에서 감시 저장을 누르면 여기에 모입니다.
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
