"use client";
// 앱이 켜져 있는 동안 시장별 레이더 감시 조건을 주기적으로 다시 확인한다.
import { useCallback, useEffect, useRef } from "react";
import { chartTimeframes, type Candle, type ChartTimeframe, type TradingMode } from "@/lib/marketAnalysis";
import { isAndroidNativeApp } from "@/lib/appPush";
import type { ScoutSetup } from "@/lib/setupScout";
import { analyzeTechnicalRadar } from "@/lib/technicalRadar";
import { withSupabaseAuth } from "@/lib/authFetch";
import {
  findSetupAlertMatches,
  readSetupAlertMatches,
  readSetupAlertPresets,
  REQUEST_SETUP_ALERT_CHECK_EVENT,
  SETUP_ALERT_CHECK_FINISHED_EVENT,
  SETUP_ALERT_PRESETS_CHANGED_EVENT,
  writeSetupAlertMatches,
  writeSetupAlertMonitorStatus,
  type SetupAlertMarket,
  type SetupAlertMonitorStatus
} from "@/lib/setupAlertPresets";

const scanModes: TradingMode[] = ["scalp", "swing"];
const monitoredMarkets: SetupAlertMarket[] = ["crypto", "stocks"];
const monitorIntervalMs = 5 * 60 * 1000;

function asChartTimeframe(value: string): ChartTimeframe {
  return chartTimeframes.includes(value as ChartTimeframe) ? (value as ChartTimeframe) : "1d";
}

function compactSymbol(symbol: string) {
  return symbol.replace("USDT.P", "").replace("USDT", "");
}

function sideLabel(side: ScoutSetup["plan"]["side"]) {
  return side === "long" ? "롱 우세" : "숏 우세";
}

function notifiedStorageKey(market: SetupAlertMarket) {
  return `chart-radar.notifiedSetupMatches.v1.${market}`;
}

function readNotifiedIds(market: SetupAlertMarket) {
  if (typeof window === "undefined") return new Set<string>();

  try {
    const raw = window.localStorage.getItem(notifiedStorageKey(market));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set<string>();
  }
}

function writeNotifiedIds(market: SetupAlertMarket, ids: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(notifiedStorageKey(market), JSON.stringify(Array.from(ids).slice(-80)));
}

function stockModeFromTimeframe(timeframe: ChartTimeframe): TradingMode {
  return timeframe === "5m" || timeframe === "15m" ? "scalp" : "swing";
}

function stockQuality(score: number): ScoutSetup["plan"]["quality"] {
  if (score >= 78) return "A";
  if (score >= 62) return "B";
  return "C";
}

async function fetchCurrentStockSetups(presets: ReturnType<typeof readSetupAlertPresets>): Promise<ScoutSetup[]> {
  const keys = Array.from(new Set(presets.map((preset) => `${preset.symbol}:${preset.timeframe}`)));
  const settled = await Promise.allSettled(
    keys.map(async (key) => {
      const [symbol, rawTimeframe] = key.split(":");
      const timeframe = asChartTimeframe(rawTimeframe ?? "1d");
      const response = await fetch(`/api/stocks/candles?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as { candles?: Candle[] };
      if (!response.ok || !Array.isArray(payload.candles) || payload.candles.length < 60) return null;

      const report = analyzeTechnicalRadar(payload.candles);
      if (!report.price) return null;

      const edge = report.bullishCount - report.bearishCount;
      if (Math.abs(edge) < 2) return null;

      const side: ScoutSetup["plan"]["side"] = edge > 0 ? "long" : "short";
      const score = Math.min(95, Math.max(50, 55 + Math.abs(edge) * 8));
      const support = report.supportResistance.support;
      const resistance = report.supportResistance.resistance;
      const invalidation =
        side === "long"
          ? support ?? report.price * 0.98
          : resistance ?? report.price * 1.02;
      const target1 =
        side === "long"
          ? resistance ?? report.price * 1.03
          : support ?? report.price * 0.97;
      const target2 = side === "long" ? report.price * 1.06 : report.price * 0.94;

      return {
        symbol,
        mode: stockModeFromTimeframe(timeframe),
        timeframe,
        analysis: {} as ScoutSetup["analysis"],
        plan: {
          mode: stockModeFromTimeframe(timeframe),
          side,
          quality: stockQuality(score),
          title: side === "long" ? "글로벌 기술 레이더 롱 우세" : "글로벌 기술 레이더 숏 우세",
          entryLabel: "현재 기술지표 재감지",
          entryLow: report.price,
          entryHigh: report.price,
          invalidation,
          target1,
          target2,
          rr1: 1,
          rr2: 2,
          confidence: score,
          reason: report.summary,
          cautions: []
        },
        score,
        status: "active",
        headline: `${symbol} ${timeframe} ${sideLabel(side)} 재감지`,
        distancePercent: 0,
        insideZone: true,
        proximity: "ready",
        currentPrice: report.price,
        scannedAt: new Date().toISOString()
      } satisfies ScoutSetup;
    })
  );

  return settled.flatMap((result) => (result.status === "fulfilled" && result.value ? [result.value] : []));
}

async function fetchCurrentSetups(market: SetupAlertMarket, presets: ReturnType<typeof readSetupAlertPresets>) {
  if (market === "stocks") {
    return fetchCurrentStockSetups(presets);
  }

  const results = await Promise.allSettled(
    scanModes.map(async (mode) => {
      const response = await fetch(`/api/scout?mode=${mode}&risk=radar&scope=all`, await withSupabaseAuth({ cache: "no-store" }));
      const payload = (await response.json().catch(() => ({}))) as { setups?: ScoutSetup[] };
      if (!response.ok || !Array.isArray(payload.setups)) return [];
      return payload.setups;
    })
  );

  return results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}

export function RadarAlertMonitor() {
  const isCheckingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runMarketCheck = useCallback(async (market: SetupAlertMarket, reason: SetupAlertMonitorStatus["reason"]) => {
    const presets = readSetupAlertPresets(market);
    if (presets.length === 0) {
      writeSetupAlertMonitorStatus({
        market,
        checkedAt: Date.now(),
        presetCount: 0,
        setupCount: 0,
        matchCount: 0,
        reason
      }, market);
      return 0;
    }

    const setups = await fetchCurrentSetups(market, presets);
    const matches = findSetupAlertMatches(presets, setups, market);
    writeSetupAlertMonitorStatus({
      market,
      checkedAt: Date.now(),
      presetCount: presets.length,
      setupCount: setups.length,
      matchCount: matches.length,
      reason
    }, market);

    if (matches.length === 0) return 0;

    const previous = readSetupAlertMatches(market);
    const merged = [...matches, ...previous.filter((item) => !matches.some((match) => match.id === item.id))];
    writeSetupAlertMatches(merged, market);

    if (isAndroidNativeApp() || !("Notification" in window) || Notification.permission !== "granted") return matches.length;

    const notifiedIds = readNotifiedIds(market);
    const freshMatch = matches.find((match) => !notifiedIds.has(match.id));
    if (!freshMatch) return matches.length;

    notifiedIds.add(freshMatch.id);
    writeNotifiedIds(market, notifiedIds);
    new Notification("Chart Radar 브라우저 감시 조건 일치", {
      body: `${compactSymbol(freshMatch.setup.symbol)} ${freshMatch.setup.timeframe} ${sideLabel(freshMatch.setup.side)} 감지가 다시 올라왔습니다.`,
      icon: "/brand/chart-radar-mark.png"
    });
    return matches.length;
  }, []);

  const runCheck = useCallback(async (reason: SetupAlertMonitorStatus["reason"] = "auto") => {
    if (isCheckingRef.current) return 0;
    if (typeof window === "undefined") return 0;

    isCheckingRef.current = true;
    try {
      const results = await Promise.all(monitoredMarkets.map((market) => runMarketCheck(market, reason)));
      return results.reduce((sum, count) => sum + count, 0);
    } finally {
      isCheckingRef.current = false;
    }
  }, [runMarketCheck]);

  useEffect(() => {
    void runCheck("auto");
    timerRef.current = setInterval(() => {
      void runCheck("auto");
    }, monitorIntervalMs);

    function handleVisibility() {
      if (document.visibilityState === "visible") void runCheck("visible");
    }

    function handlePresetChange() {
      void runCheck("preset-change");
    }

    async function handleManualCheck(event: Event) {
      const requestedMarket = (event as CustomEvent<{ market?: SetupAlertMarket }>).detail?.market;
      const matchCount = requestedMarket && monitoredMarkets.includes(requestedMarket)
        ? await runMarketCheck(requestedMarket, "manual")
        : await runCheck("manual");
      window.dispatchEvent(new CustomEvent(SETUP_ALERT_CHECK_FINISHED_EVENT, { detail: { matchCount } }));
    }

    window.addEventListener(SETUP_ALERT_PRESETS_CHANGED_EVENT, handlePresetChange);
    window.addEventListener(REQUEST_SETUP_ALERT_CHECK_EVENT, handleManualCheck);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      window.removeEventListener(SETUP_ALERT_PRESETS_CHANGED_EVENT, handlePresetChange);
      window.removeEventListener(REQUEST_SETUP_ALERT_CHECK_EVENT, handleManualCheck);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [runCheck, runMarketCheck]);

  return null;
}
