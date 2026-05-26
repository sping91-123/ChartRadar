"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CandlestickSeries,
  LineStyle,
  createSeriesMarkers,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesMarkersPluginApi,
  type ISeriesApi,
  type SeriesMarker,
  type Time
} from "lightweight-charts";
import {
  Activity,
  BarChart3,
  Bot,
  Bug,
  Copy,
  Crown,
  History,
  HelpCircle,
  Settings2,
} from "lucide-react";
import {
  analyzeTimeframe,
  chartTimeframes,
  fetchBinanceCandles,
  summarizeMarket,
  tradingModeConfigs,
  type AnalysisReason,
  type Candle,
  type ChartTimeframe,
  type DirectionState,
  type MarketAnalysis,
  type TimeframeAnalysis,
  type TradingMode
} from "@/lib/marketAnalysis";
import { appendJournalEntry } from "@/lib/journal";
import type { MarketBriefingInput } from "@/lib/ai/types";
import { normalizePineDirection, parsePineSnapshot, pineDirectionForTimeframe, type PineSnapshot } from "@/lib/pineParity";
import { createRemoteJournalEntry } from "@/lib/remoteJournal";
import { evaluateRadarDecision, type RadarDecision } from "@/lib/radarDecisionEngine";
import { getActiveSupabaseSession } from "@/lib/supabase";
import { withSupabaseAuth } from "@/lib/authFetch";
import { BeginnerActionGuide, type BeginnerGuideStep, type BeginnerGuideTone } from "@/components/BeginnerActionGuide";
import { RadarInsightPanel, type RadarInsightSummaryMetric } from "@/components/RadarInsightPanel";
import { TechnicalRadarPanel } from "@/components/TechnicalRadarPanel";
import { LiquidationPressurePanel } from "@/components/LiquidationPressurePanel";
import { CryptoChartPanel } from "@/components/crypto/CryptoChartPanel";
import { CryptoControlBar } from "@/components/crypto/CryptoControlBar";
import { CryptoChartLoadingOverlay, CryptoErrorState } from "@/components/crypto/CryptoFallbackState";
import { hasMarketEntitlement } from "@/lib/billing";
import { recordUsageEvent } from "@/lib/usageMeter";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";
import { getChartThemeOptions, observeChartThemeChange } from "@/lib/chartTheme";
import { marketAnalysisToRadarInsight, visibleRadarInsightForPlan, type RadarInsight } from "@/lib/radarInsight";
import {
  MAJOR_STRENGTH_HELP,
  altAnalysisFreeLimit,
  altAnalysisUsageStorageKey,
  altSymbols,
  cryptoDefaultChartHeightClass,
  cryptoMajorChartHeightClass,
  defaultOverlaySettings,
  legacyChannelStoragePrefix,
  legacyOverlaySettingsStorageKeys,
  legacyPreviousBrandStoragePrefix,
  majorSymbols,
  overlayPresets,
  overlaySettingsStorageKey,
  radarProfileOptions,
  showPineParityTools,
  storagePrefix,
  structureSensitivityOptions,
  symbols,
  timeframeScoreLimit
} from "@/components/crypto/constants";
import {
  aiConditionLabel,
  aiStateLabel,
  barsAgoLabel,
  biasClasses,
  biasLabel,
  conditionLabel,
  conditionTone,
  directionBadge,
  eventDirectionLabel,
  formatIndicatorValue,
  formatPrice,
  formatPriceRange,
  formatUpdatedAt,
  killzoneLabel,
  planQualityClasses,
  readinessClasses,
  readinessLabel,
  reasonClasses,
  stateLabel,
  symbolLabel
} from "@/components/crypto/displayHelpers";
import type {
  AltAnalysisGate,
  AltAnalysisUsageSnapshot,
  MarketBriefingState,
  MarketCachePayload,
  OverlaySettings,
  ParityRow,
  RadarProfile,
  RadarPulseItem,
  RadarPulseTone,
  StructureSensitivity
} from "@/components/crypto/types";

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function emptyAltAnalysisUsage(): AltAnalysisUsageSnapshot {
  return { dateKey: localDateKey(), symbols: [] };
}

function readAltAnalysisUsage(): AltAnalysisUsageSnapshot {
  if (typeof window === "undefined") return emptyAltAnalysisUsage();

  try {
    const raw = window.localStorage.getItem(altAnalysisUsageStorageKey);
    if (!raw) return emptyAltAnalysisUsage();

    const parsed = JSON.parse(raw) as Partial<AltAnalysisUsageSnapshot>;
    if (parsed.dateKey !== localDateKey() || !Array.isArray(parsed.symbols)) return emptyAltAnalysisUsage();

    return {
      dateKey: parsed.dateKey,
      symbols: Array.from(new Set(parsed.symbols.filter((item): item is string => typeof item === "string")))
    };
  } catch {
    return emptyAltAnalysisUsage();
  }
}

function writeAltAnalysisUsage(snapshot: AltAnalysisUsageSnapshot) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(altAnalysisUsageStorageKey, JSON.stringify(snapshot));
}

function initialAltAnalysisGate(isPaid: boolean): AltAnalysisGate {
  const limit = isPaid ? 300 : altAnalysisFreeLimit;
  return {
    allowed: true,
    used: 0,
    limit,
    remaining: limit,
    symbols: []
  };
}

function getAltAnalysisGate(isPaid: boolean, currentSymbol?: string): AltAnalysisGate {
  const snapshot = readAltAnalysisUsage();
  if (isPaid) {
    return {
      allowed: true,
      used: snapshot.symbols.length,
      limit: 300,
      remaining: 300,
      symbols: snapshot.symbols
    };
  }

  const alreadyUsed = currentSymbol ? snapshot.symbols.includes(currentSymbol) : false;
  return {
    allowed: alreadyUsed || snapshot.symbols.length < altAnalysisFreeLimit,
    used: snapshot.symbols.length,
    limit: altAnalysisFreeLimit,
    remaining: Math.max(0, altAnalysisFreeLimit - snapshot.symbols.length),
    symbols: snapshot.symbols
  };
}

function registerAltAnalysisSymbol(symbol: string, isPaid: boolean): AltAnalysisGate {
  const snapshot = readAltAnalysisUsage();
  if (isPaid || snapshot.symbols.includes(symbol)) {
    return getAltAnalysisGate(isPaid, symbol);
  }

  if (snapshot.symbols.length >= altAnalysisFreeLimit) {
    return {
      allowed: false,
      used: snapshot.symbols.length,
      limit: altAnalysisFreeLimit,
      remaining: 0,
      symbols: snapshot.symbols
    };
  }

  const next = {
    dateKey: snapshot.dateKey,
    symbols: [...snapshot.symbols, symbol]
  };
  writeAltAnalysisUsage(next);
  recordUsageEvent("altIndividualAnalysis");

  return {
    allowed: true,
    used: next.symbols.length,
    limit: altAnalysisFreeLimit,
    remaining: Math.max(0, altAnalysisFreeLimit - next.symbols.length),
    symbols: next.symbols
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidMarketCachePayload(value: unknown): value is MarketCachePayload {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value.candles) || !isRecord(value.analysis)) return false;

  const timeframeAnalyses = value.analysis.timeframeAnalyses;
  return (
    Array.isArray(timeframeAnalyses) &&
    timeframeAnalyses.length > 0 &&
    timeframeAnalyses.every((item) => isRecord(item) && isRecord(item.condition))
  );
}

function readMarketCache(cacheKey: string): MarketCachePayload | null {
  if (typeof window === "undefined") return null;

  const cached = window.localStorage.getItem(cacheKey);
  if (!cached) return null;

  try {
    const parsed = JSON.parse(cached) as unknown;
    if (isValidMarketCachePayload(parsed)) return parsed;
  } catch {
    // fall through and clear the broken cache below
  }

  window.localStorage.removeItem(cacheKey);
  return null;
}

function BriefingKeyword({ children, tone }: { children: string; tone: "long" | "short" | "warn" | "neutral" }) {
  const className =
    tone === "long"
      ? "text-signal-success"
      : tone === "short"
        ? "text-signal-danger"
        : tone === "warn"
          ? "text-signal-warning"
          : "text-accent-blue";
  return <span className={className}>{children}</span>;
}

function cleanBriefingText(text: string) {
  return text
    .replace(/[\u3040-\u30ff]+/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitBriefingParagraphs(text: string) {
  const cleaned = cleanBriefingText(text);
  const explicitParagraphs = cleaned
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (explicitParagraphs.length >= 2) return explicitParagraphs;

  const sentences = cleaned
    .split(/(?<=[.!?。！？])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (sentences.length <= 2) return cleaned ? [cleaned] : [];

  const midpoint = Math.ceil(sentences.length / 2);
  return [sentences.slice(0, midpoint).join(" "), sentences.slice(midpoint).join(" ")].filter(Boolean);
}

function HighlightedBriefing({ text }: { text: string }) {
  const pattern =
    /(롱|숏|매수|매도|상승|하락|지지|저항|돌파|이탈|유리|불리|우세|중립|횡보|관망|주의|위험|리스크|조정|과열|침체|손절|익절|OB|FVG|POC|PD|MSB|BOS|CHoCH|Sweep|CISD|강점|약점|대기|관찰)/g;
  const paragraphs = splitBriefingParagraphs(text);
  return (
    <div className="space-y-3">
      {paragraphs.map((paragraph, paragraphIndex) => (
        <p key={paragraphIndex} className="rounded-md border border-white/10 bg-black/15 px-3 py-3 text-sm leading-7 text-slate-200 [word-break:keep-all]">
          {paragraph.split(pattern).map((part, index) => {
            if (!part) return null;
            if (["롱", "매수", "상승", "지지", "돌파", "유리", "우세", "강점"].includes(part)) {
              return <BriefingKeyword key={`${paragraphIndex}-${part}-${index}`} tone="long">{part}</BriefingKeyword>;
            }
            if (["숏", "매도", "하락", "저항", "이탈", "불리"].includes(part)) {
              return <BriefingKeyword key={`${paragraphIndex}-${part}-${index}`} tone="short">{part}</BriefingKeyword>;
            }
            if (["주의", "위험", "리스크", "조정", "과열", "침체", "약점", "손절"].includes(part)) {
              return <BriefingKeyword key={`${paragraphIndex}-${part}-${index}`} tone="warn">{part}</BriefingKeyword>;
            }
            if (
              ["중립", "횡보", "관망", "OB", "FVG", "POC", "PD", "MSB", "BOS", "CHoCH", "Sweep", "CISD", "대기", "관찰", "익절"].includes(part)
            ) {
              return <BriefingKeyword key={`${paragraphIndex}-${part}-${index}`} tone="neutral">{part}</BriefingKeyword>;
            }
            return <span key={`${paragraphIndex}-${part}-${index}`}>{part}</span>;
          })}
        </p>
      ))}
    </div>
  );
}

/** lightweight-charts v5는 timeZone 옵션 미지원 → UTC 타임스탬프에 KST 오프셋 직접 가산 */
const KST_OFFSET_SEC = 9 * 3600; // +9h

function toKstTime(utcSec: number): Time {
  return (utcSec + KST_OFFSET_SEC) as unknown as Time;
}

function candleTimeAt(candles: Candle[], index: number): Time | null {
  if (index < 0 || index >= candles.length) return null;
  return toKstTime(candles[index].time);
}

function storageKey(name: string) {
  return `${storagePrefix}.${name}`;
}

function legacyStorageKeys(name: string) {
  return [`${legacyPreviousBrandStoragePrefix}.${name}`, `${legacyChannelStoragePrefix}.${name}`];
}

function readLocalStorageWithLegacy(primaryKey: string, legacyKeys: string[]) {
  const current = window.localStorage.getItem(primaryKey);
  if (current !== null) return current;

  const legacyKey = legacyKeys.find((key) => window.localStorage.getItem(key) !== null);
  const legacy = legacyKey ? window.localStorage.getItem(legacyKey) : null;
  if (legacy !== null) {
    window.localStorage.setItem(primaryKey, legacy);
    legacyKeys.forEach((key) => window.localStorage.removeItem(key));
  }

  return legacy;
}

function writeLocalStorage(primaryKey: string, legacyKeys: string[], value: string) {
  window.localStorage.setItem(primaryKey, value);
  legacyKeys.forEach((key) => window.localStorage.removeItem(key));
}

function readOverlaySettings(): OverlaySettings {
  if (typeof window === "undefined") return defaultOverlaySettings;

  try {
    const raw = readLocalStorageWithLegacy(overlaySettingsStorageKey, legacyOverlaySettingsStorageKeys);
    if (!raw) return defaultOverlaySettings;
    const parsed = JSON.parse(raw) as Partial<OverlaySettings>;
    return { ...defaultOverlaySettings, ...parsed };
  } catch {
    return defaultOverlaySettings;
  }
}

function userFacingRiskPercent(analysis: MarketAnalysis | null) {
  if (!analysis) return 0;
  const base = analysis.bias === "neutral" ? 55 : 35;
  const readinessPenalty = analysis.readiness === "high" ? -15 : analysis.readiness === "medium" ? 5 : 22;
  const warningPenalty = Math.min(35, (analysis.riskFlags.length + analysis.warnings.length) * 9);
  const scorePenalty = Math.max(0, 18 - Math.abs(analysis.biasScore)) * 0.8;
  return Math.min(95, Math.max(5, Math.round(base + readinessPenalty + warningPenalty + scorePenalty)));
}

function userFacingRiskLabel(analysis: MarketAnalysis | null) {
  if (!analysis) return "대기 중";
  const risk = userFacingRiskPercent(analysis);
  if (risk >= 70) return "위험 높음";
  if (risk >= 45) return "주의 구간";
  return "검토 가능";
}

function userFacingNextStep(analysis: MarketAnalysis | null) {
  if (!analysis) return "레이더가 차트 데이터를 감지하는 중";
  if (analysis.bias === "neutral") return "신규 판단보다 구조 확인";
  if (analysis.readiness === "high") return "손절/수량 먼저 확인";
  return "반응 확인 후 판단";
}

function uniqueText(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function buildAltAnalysisRiskSignals(analysis: MarketAnalysis, active?: TimeframeAnalysis) {
  const signals: string[] = [];

  if (
    active?.condition.rsiState === "overbought" ||
    active?.condition.keltnerPosition === "outsideUpper" ||
    active?.condition.bollingerPosition === "outsideUpper"
  ) {
    signals.push("급등 추격 주의");
  }
  if (active?.condition.volatilityState === "expanded") {
    signals.push("변동성 확대");
    signals.push("BTC 방향성 의존");
  }
  if (active?.condition.volumeState === "low") {
    signals.push("거래량 부족");
    signals.push("저유동성 리스크");
  }
  if (analysis.bias === "neutral" || active?.condition.regime === "mixed") {
    signals.push("상방/하방 근거 혼재");
  }
  if (analysis.readiness !== "high") signals.push("리스크 점검");

  return uniqueText([...signals, ...analysis.riskFlags]).slice(0, 5);
}

function altAnalysisFilterLabel(analysis: MarketAnalysis, active?: TimeframeAnalysis) {
  const risks = buildAltAnalysisRiskSignals(analysis, active);
  if (risks.includes("급등 추격 주의") || risks.includes("변동성 확대") || risks.length >= 3) return "고위험 구간";
  if (analysis.bias === "neutral" || analysis.readiness === "low") return "관망 우위";
  return "추적 후보";
}

function altAnalysisFilterClass(label: string) {
  if (label === "고위험 구간") return "border-signal-danger/30 bg-signal-danger/10 text-signal-danger";
  if (label === "관망 우위") return "border-signal-warning/30 bg-signal-warning/10 text-signal-warning";
  return "border-accent-blue/30 bg-accent-blue/10 text-accent-blue";
}

function overlayPresetMatches(settings: OverlaySettings, preset: keyof typeof overlayPresets) {
  const target = overlayPresets[preset];
  return (Object.keys(target) as Array<keyof OverlaySettings>).every((key) => settings[key] === target[key]);
}

function structureSensitivityLabel(value: StructureSensitivity) {
  return structureSensitivityOptions.find((item) => item.value === value)?.label ?? "빠른 변화 감지";
}

function beginnerToneFromDecision(decision: RadarDecision | null): BeginnerGuideTone {
  if (!decision) return "neutral";
  if (decision.action === "enter") return "success";
  if (decision.action === "avoid") return "danger";
  return "warning";
}

function buildRadarPulse(analysis: MarketAnalysis, active?: TimeframeAnalysis): RadarPulseItem[] {
  const directionTitle =
    analysis.bias === "long" ? "롱 우세" : analysis.bias === "short" ? "숏 우세" : "횡보 관찰";
  const directionTone: RadarPulseTone =
    analysis.bias === "long" ? "long" : analysis.bias === "short" ? "short" : "warn";
  const riskText =
    analysis.riskFlags[0] ??
    (active?.condition.rsiState === "overbought"
      ? "과열권에 가까워 추격 판단은 피하는 편이 좋습니다."
      : active?.condition.volatilityState === "expanded"
        ? "변동성이 커져 손절폭과 포지션 크기를 먼저 줄여야 합니다."
        : "뚜렷한 위험 플래그는 적지만, 손절 기준 없이 들어가면 판독 의미가 없습니다.");
  const nextText =
    analysis.checkpoints[0] ??
    (analysis.bias === "neutral"
      ? "MSB와 CHoCH가 같은 방향으로 다시 정렬되는지 확인하세요."
      : analysis.actionGuide);

  return [
    {
      label: "핵심",
      title: directionTitle,
      text: analysis.summaryLine,
      tone: directionTone
    },
    {
      label: "위험",
      title: userFacingRiskLabel(analysis),
      text: riskText,
      tone: analysis.riskFlags.length > 0 ? "warn" : "neutral"
    },
    {
      label: "다음 확인",
      title: userFacingNextStep(analysis),
      text: nextText,
      tone: "neutral"
    }
  ];
}

function buildCoinBeginnerSteps(analysis: MarketAnalysis, decision: RadarDecision | null): BeginnerGuideStep[] {
  const firstBlocker = decision?.blockers[0] ?? analysis.riskFlags[0] ?? analysis.warnings[0];
  const firstConfirmation = decision?.confirmations[0] ?? analysis.opportunityFlags[0] ?? analysis.currentLocationLabel;
  const actionTitle =
    decision?.action === "enter"
      ? "손절과 수량 고정"
      : decision?.action === "avoid"
        ? "새 구조 대기"
        : "반응 확인";
  const blockerBody =
    firstBlocker ??
    firstConfirmation ??
    "방향, 현재 위치, 거래량이 같은 쪽으로 맞는지 한 번 더 확인하세요.";

  return [
    {
      label: "1. 지금 판단",
      title: decision?.title ?? analysis.verdict,
      body: decision?.summary ?? analysis.summaryLine,
      tone: beginnerToneFromDecision(decision)
    },
    {
      label: "2. 먼저 할 일",
      title: actionTitle,
      body: decision?.nextStep ?? analysis.actionGuide,
      tone: decision?.action === "avoid" ? "danger" : "info"
    },
    {
      label: "3. 막히는 조건",
      title: firstBlocker ? "이 조건이면 보수적으로" : "근거가 유지되는지 확인",
      body: blockerBody,
      tone: firstBlocker ? "warning" : "neutral"
    }
  ];
}

function buildCoinBasicBeginnerSteps(analysis: MarketAnalysis): BeginnerGuideStep[] {
  return [
    {
      label: "1. 최종 판단",
      title: analysis.verdict,
      body: "Basic에서는 방향 요약만 제공합니다. 상세 조건, 무효화 기준, 세부 리스크는 Pro에서 확인할 수 있습니다.",
      tone: "info"
    },
    {
      label: "2. 리스크 확인",
      title: analysis.riskFlags[0] ?? "리스크 먼저 확인",
      body: "이 정보는 투자 권유가 아니라 판단 보조용입니다. 세부 리스크는 Pro에서 전체 맥락으로 확인합니다.",
      tone: analysis.riskFlags.length > 0 ? "warning" : "neutral"
    },
    {
      label: "3. 다음 기준",
      title: "추적 조건은 잠금",
      body: "실제 판단에 필요한 추적 조건, 무효화 기준, 다음 확인 기준은 Pro 판단 보조 영역에서 확인합니다.",
      tone: "neutral"
    }
  ];
}

function buildMajorScreenGuideSteps(isPro: boolean): BeginnerGuideStep[] {
  return [
    {
      label: "1. 상단 판단",
      title: "Radar Insight를 먼저 봅니다",
      body: isPro
        ? "최종 판단, 판단 강도, 추적 조건, 무효화 기준은 상단 판단 카드에서 먼저 확인합니다."
        : "Basic에서는 방향 요약만 제공합니다. 공개된 핵심 근거와 일반 리스크만 먼저 확인합니다.",
      tone: "info"
    },
    {
      label: "2. 근거 상세",
      title: "아래 영역은 보조 근거입니다",
      body: "ICT 구조, 기술지표, 차트 표시는 상단 판단을 뒷받침하는 확인 자료로만 봅니다.",
      tone: "neutral"
    },
    {
      label: "3. 실행 전 점검",
      title: isPro ? "리스크 기준을 다시 점검" : "세부 조건은 Pro 영역",
      body: isPro
        ? "구체 판단은 추적 조건, 무효화 기준, 리스크 점검을 모두 맞춘 뒤 검토합니다."
        : "추적 조건, 무효화 기준, 구체 레벨, 다음 확인 기준은 Pro에서 판단 보조 항목으로 확인합니다.",
      tone: isPro ? "warning" : "neutral"
    }
  ];
}

function compactSummaryText(value: string | undefined, maxLength = 46) {
  if (!value) return "확인 필요";
  return value.length > maxLength ? `${value.slice(0, maxLength).trim()}…` : value;
}

function buildMajorSummaryMetrics(
  analysis: MarketAnalysis,
  activeAnalysis: TimeframeAnalysis | undefined,
  insight: RadarInsight
): RadarInsightSummaryMetric[] {
  const volatilityExpanded = activeAnalysis?.condition.volatilityState === "expanded";
  return [
    {
      label: "구조",
      value: activeAnalysis ? `MSB ${stateLabel(activeAnalysis.msb)} · CHoCH ${stateLabel(activeAnalysis.choch)}` : "구조 확인 중",
      detail: "현재 타임프레임 구조",
      tone: insight.finalView === "long_bias" ? "long" : insight.finalView === "short_bias" ? "short" : "watch"
    },
    {
      label: "변동성",
      value: activeAnalysis
        ? `${formatIndicatorValue(activeAnalysis.condition.atrPercent, 2, "%")} · ${conditionLabel(activeAnalysis.condition.volatilityState)}`
        : "변동성 확인 중",
      detail: "ATR 기준 압력",
      tone: volatilityExpanded ? "risk" : "info"
    },
    {
      label: "리스크",
      value: compactSummaryText(insight.risks[0] ?? analysis.riskFlags[0] ?? analysis.warnings[0]),
      detail: "추격 전 확인",
      tone: insight.finalView === "high_risk" ? "risk" : insight.finalView === "watch" ? "watch" : "info"
    }
  ];
}

function radarPulseClasses(tone: RadarPulseTone) {
  if (tone === "long") return "border-signal-success/20 bg-black/20 text-signal-success";
  if (tone === "short") return "border-signal-danger/20 bg-black/20 text-signal-danger";
  if (tone === "warn") return "border-signal-warning/20 bg-black/20 text-signal-warning";
  return "border-white/10 bg-black/20 text-slate-200";
}

function compareNumber(webValue: number | null, pineValue: number | null | undefined, tolerancePct = 0.0005) {
  if (webValue === null || pineValue === null || pineValue === undefined || !Number.isFinite(Number(pineValue))) {
    return { result: "대기", matched: false };
  }

  const diff = Math.abs(webValue - Number(pineValue));
  const tolerance = Math.max(Math.abs(webValue) * tolerancePct, 1e-8);
  return {
    result: diff <= tolerance ? "일치" : `차이 ${formatPrice(diff)}`,
    matched: diff <= tolerance
  };
}

function compareOptionalValue(webValue: string, pineValue: string | undefined) {
  if (!pineValue) {
    return { result: "대기", matched: false };
  }

  return {
    result: webValue === pineValue ? "일치" : "차이",
    matched: webValue === pineValue
  };
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-surface-line bg-surface-cardSoft p-3">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function SignalMetric({
  label,
  value,
  direction,
  isActive
}: {
  label: string;
  value: string;
  direction?: DirectionState | "neutral";
  isActive?: boolean;
}) {
  const tone =
    direction === "bullish"
      ? "border-signal-success/30 bg-signal-success/10 text-signal-success"
      : direction === "bearish"
        ? "border-signal-danger/30 bg-signal-danger/10 text-signal-danger"
        : "border-accent-blue/20 bg-accent-blue/5 text-slate-200";

  return (
    <div className={`rounded-md border p-3 ${tone}`}>
      <p className="text-xs font-semibold opacity-80">{label}</p>
      <p className="mt-1 text-sm font-black">{value}</p>
      {isActive ? <p className="mt-1 text-[11px] font-bold opacity-80">현재가 내부</p> : null}
    </div>
  );
}

function parityHint(row: ParityRow) {
  if (row.label.includes("MSB") || row.label.includes("CHoCH")) {
    return "구조 방향 차이는 봉 확정 여부, MSB 종가/윅 기준, ZigZag length를 먼저 맞춰보세요.";
  }

  if (row.label === "h0" || row.label === "h1" || row.label === "l0" || row.label === "l1") {
    return "스윙 포인트 차이는 보통 피벗 확정 시점이나 ZigZag 계산 기준에서 납니다.";
  }

  if (row.label.includes("OB") || row.label.includes("FVG")) {
    return "구간 차이는 origin candle 선택, mitigation 기준, iFVG 전환 기준을 비교해보세요.";
  }

  if (row.label.includes("OTE") || row.label.includes("PD")) {
    return "OTE/PD 차이는 기준 범위가 4H 20봉인지, 지표의 스윙 기준인지 확인이 필요합니다.";
  }

  if (row.label.includes("EMA")) {
    return "EMA 차이는 4H EMA 원본/스무딩 여부와 현재 봉 포함 여부를 확인하면 됩니다.";
  }

  return "해당 항목의 계산 기준과 현재 봉 포함 여부를 먼저 맞춰보세요.";
}

function timeframeSignalSummary(item: TimeframeAnalysis) {
  const parts: string[] = [];
  if (item.inOb && item.latestOb) parts.push(`${item.latestOb.direction === "bullish" ? "상승" : "하락"} OB 내부`);
  if (item.inFvg && item.latestFvg) parts.push(item.latestFvg.state === "ifvg" ? "iFVG 내부" : "FVG 내부");
  if (item.oteZone !== "none") parts.push(`${item.oteZone === "long" ? "롱" : "숏"} OTE`);
  if (item.latestSweep && item.latestSweep.age <= 8) parts.push(`Sweep ${barsAgoLabel(item.latestSweep.age, item.timeframe)}`);
  if (item.latestCisd && item.latestCisd.age <= 8) parts.push(`CISD ${barsAgoLabel(item.latestCisd.age, item.timeframe)}`);
  if (item.latestDisplacement && item.latestDisplacement.age <= 8) {
    parts.push(`Displacement ${barsAgoLabel(item.latestDisplacement.age, item.timeframe)}`);
  }
  if (item.buySideLiquidity) parts.push("상단 유동성");
  if (item.sellSideLiquidity) parts.push("하단 유동성");
  return parts.length ? parts.slice(0, 3).join(" / ") : "겹치는 신호 없음";
}

export function LiveMarketChart({ majorOnly = false, altOnly = false }: { majorOnly?: boolean; altOnly?: boolean } = {}) {
  const initialSymbol = altOnly ? altSymbols[0] : majorSymbols[0];
  const { profile } = useSupabaseAuth();
  const hasCoinPro = hasMarketEntitlement(profile?.plan, "crypto");
  const isMajorScreen = majorOnly && !altOnly;
  const isBasicAltView = altOnly && !hasCoinPro;
  const canShowAltProDetails = !altOnly || hasCoinPro;
  const canShowMajorProDetails = !isMajorScreen || hasCoinPro;
  const canShowDetailedAnalysis = canShowMajorProDetails && canShowAltProDetails;
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartApiRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const pendingUserSelectedAltSymbolRef = useRef<string | null>(null);

  const [symbol, setSymbol] = useState(initialSymbol);
  const [activeTimeframe, setActiveTimeframe] = useState<ChartTimeframe>("15m");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [analysis, setAnalysis] = useState<MarketAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<"confirmed" | "aggressive">("confirmed");
  const [radarProfile, setRadarProfile] = useState<RadarProfile>("combined");
  const [msbMode, setMsbMode] = useState<"close" | "wick">("close");
  const [structureSensitivity, setStructureSensitivity] = useState<StructureSensitivity>(7);
  const [isUsingCachedData, setIsUsingCachedData] = useState(false);
  const [showAdvancedControls, setShowAdvancedControls] = useState(false);
  const [showDetailedReadout, setShowDetailedReadout] = useState(true);
  const [showOtherSymbols, setShowOtherSymbols] = useState(false);
  const [otherSymbolQuery, setOtherSymbolQuery] = useState("");
  const [dynamicSymbols, setDynamicSymbols] = useState<string[]>([]);
  const [pineSnapshotInput, setPineSnapshotInput] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [marketBriefing, setMarketBriefing] = useState<MarketBriefingState>({ status: "idle" });
  const [overlaySettings, setOverlaySettings] = useState<OverlaySettings>(defaultOverlaySettings);
  const [altAnalysisGate, setAltAnalysisGate] = useState<AltAnalysisGate>(() => initialAltAnalysisGate(false));
  const [hasMounted, setHasMounted] = useState(false);
  const effectiveTradingMode: TradingMode = activeTimeframe === "5m" || activeTimeframe === "15m" ? "scalp" : "swing";
  const modeTimeframes = chartTimeframes;
  const primarySymbols = useMemo(() => (altOnly ? altSymbols.slice(0, 5) : majorSymbols), [altOnly]);
  const allSelectableSymbols = useMemo(() => (dynamicSymbols.length > 0 ? dynamicSymbols : symbols), [dynamicSymbols]);
  const otherSymbols = useMemo(
    () =>
      majorOnly
        ? []
        : allSelectableSymbols.filter((item) => !majorSymbols.includes(item) && !primarySymbols.includes(item)).slice(0, 220),
    [allSelectableSymbols, majorOnly, primarySymbols]
  );
  const filteredOtherSymbols = useMemo(() => {
    const query = otherSymbolQuery.trim().toUpperCase();
    if (!query) return otherSymbols;
    return otherSymbols.filter((item) => item.includes(query) || symbolLabel(item).includes(query));
  }, [otherSymbolQuery, otherSymbols]);
  const isOtherSymbolActive = otherSymbols.includes(symbol);
  const chartTitle = altOnly ? "알트코인 레이더" : "코인 레이더";
  const chartDescription = altOnly
    ? "선택한 알트코인의 구조, 과열, 변동성, 브리핑을 BTC/ETH와 같은 방식으로 확인합니다."
    : "BTC와 ETH의 구조, 추세, 변동성, 시장 브리핑을 한 화면에서 확인합니다.";

  const visibleAltAnalysisGate = hasMounted ? altAnalysisGate : initialAltAnalysisGate(false);
  const cacheKey = `${storagePrefix}.marketCache.${symbol}.${activeTimeframe}.${analysisMode}.${msbMode}.${structureSensitivity}`;

  const selectSymbol = useCallback((nextSymbol: string, options: { userSelected?: boolean } = {}) => {
    if (altOnly && options.userSelected) {
      pendingUserSelectedAltSymbolRef.current = nextSymbol;
    }
    setSymbol(nextSymbol);
    setShowOtherSymbols(false);
    setOtherSymbolQuery("");
  }, [altOnly]);

  useEffect(() => {
    setHasMounted(true);
    setOverlaySettings(readOverlaySettings());
  }, []);

  useEffect(() => {
    if (!altOnly) return;
    setAltAnalysisGate(getAltAnalysisGate(hasCoinPro, symbol));
  }, [altOnly, hasCoinPro, symbol]);

  useEffect(() => {
    if (majorOnly) return;
    let cancelled = false;
    async function loadCryptoSymbols() {
      try {
        const response = await fetch("/api/crypto-symbols", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { symbols?: Array<{ symbol: string }> };
        const nextSymbols = (data.symbols ?? []).map((item) => item.symbol);
        if (!cancelled && nextSymbols.length) setDynamicSymbols(nextSymbols);
      } catch {
        // 기본 10개 코인 선택으로 대체한다.
      }
    }
    void loadCryptoSymbols();
    return () => {
      cancelled = true;
    };
  }, [majorOnly]);

  useEffect(() => {
    if (majorOnly && !majorSymbols.includes(symbol)) {
      selectSymbol(majorSymbols[0]);
    }
    if (altOnly && majorSymbols.includes(symbol)) {
      selectSymbol(altSymbols[0]);
    }
  }, [altOnly, majorOnly, selectSymbol, symbol]);

  useEffect(() => {
    const storedSymbol = readLocalStorageWithLegacy(storageKey("symbol"), legacyStorageKeys("symbol"));
    const storedTimeframe = readLocalStorageWithLegacy(storageKey("timeframe"), legacyStorageKeys("timeframe")) as ChartTimeframe | null;
    const storedMode = readLocalStorageWithLegacy(storageKey("analysisMode"), legacyStorageKeys("analysisMode")) as "confirmed" | "aggressive" | null;
    const storedRadarProfile = readLocalStorageWithLegacy(storageKey("radarProfile"), legacyStorageKeys("radarProfile")) as RadarProfile | null;
    const storedMsbMode = readLocalStorageWithLegacy(storageKey("msbMode"), legacyStorageKeys("msbMode")) as "close" | "wick" | null;
    const storedStructureSensitivity = Number(readLocalStorageWithLegacy(storageKey("structureSensitivity"), legacyStorageKeys("structureSensitivity"))) as StructureSensitivity;

    if (storedSymbol && symbols.includes(storedSymbol) && (!altOnly || !majorSymbols.includes(storedSymbol))) {
      setSymbol(storedSymbol);
    }
    if (storedTimeframe && chartTimeframes.includes(storedTimeframe)) {
      setActiveTimeframe(storedTimeframe);
    }
    if (storedMode === "confirmed" || storedMode === "aggressive") {
      setAnalysisMode(storedMode);
    }
    if (storedRadarProfile === "combined" || storedRadarProfile === "ict" || storedRadarProfile === "technical") {
      setRadarProfile(storedRadarProfile);
    }
    if (storedMsbMode === "close" || storedMsbMode === "wick") {
      setMsbMode(storedMsbMode);
    }
    if ([5, 7, 9].includes(storedStructureSensitivity)) {
      setStructureSensitivity(storedStructureSensitivity);
    }
  }, [altOnly]);

  useEffect(() => {
    writeLocalStorage(storageKey("symbol"), legacyStorageKeys("symbol"), symbol);
  }, [symbol]);

  useEffect(() => {
    writeLocalStorage(storageKey("timeframe"), legacyStorageKeys("timeframe"), activeTimeframe);
  }, [activeTimeframe]);

  useEffect(() => {
    writeLocalStorage(storageKey("analysisMode"), legacyStorageKeys("analysisMode"), analysisMode);
  }, [analysisMode]);

  useEffect(() => {
    writeLocalStorage(storageKey("radarProfile"), legacyStorageKeys("radarProfile"), radarProfile);
  }, [radarProfile]);

  useEffect(() => {
    writeLocalStorage(storageKey("msbMode"), legacyStorageKeys("msbMode"), msbMode);
  }, [msbMode]);

  useEffect(() => {
    writeLocalStorage(storageKey("structureSensitivity"), legacyStorageKeys("structureSensitivity"), String(structureSensitivity));
  }, [structureSensitivity]);

  useEffect(() => {
    writeLocalStorage(overlaySettingsStorageKey, legacyOverlaySettingsStorageKeys, JSON.stringify(overlaySettings));
  }, [overlaySettings]);

  useEffect(() => {
    const parsed = readMarketCache(cacheKey);
    if (!parsed) return;

    if (!candles.length && parsed.candles.length && !analysis) {
      setCandles(parsed.candles);
      setAnalysis(parsed.analysis);
      setIsUsingCachedData(true);
    }
  }, [analysis, cacheKey, candles.length]);

  const loadMarket = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      if (altOnly) {
        const currentGate = getAltAnalysisGate(hasCoinPro, symbol);
        setAltAnalysisGate(currentGate);

        if (!currentGate.allowed) {
          setCandles([]);
          setAnalysis(null);
          setMarketBriefing({ status: "idle" });
          return;
        }
      }

      const candleSets = await Promise.all(
        chartTimeframes.map(async (timeframe) => ({
          timeframe,
          candles: await fetchBinanceCandles(symbol, timeframe, 320)
        }))
      );

      const activeCandles = candleSets.find((item) => item.timeframe === activeTimeframe)?.candles ?? [];
      const fourHourCandles = candleSets.find((item) => item.timeframe === "4h")?.candles ?? [];
      const analyses = candleSets.map((item) => {
        const analysisCandles =
          analysisMode === "confirmed" && item.candles.length > 50 ? item.candles.slice(0, -1) : item.candles;
        const oteAnchorCandles =
          analysisMode === "confirmed" && fourHourCandles.length > 50 ? fourHourCandles.slice(0, -1) : fourHourCandles;

        return analyzeTimeframe(item.timeframe, analysisCandles, {
          oteAnchorCandles,
          useCloseForMsb: msbMode === "close",
          zigLen: structureSensitivity
        });
      });
      const latestPrice = (analysisMode === "confirmed" && activeCandles.length > 50 ? activeCandles[activeCandles.length - 2] : activeCandles[activeCandles.length - 1])?.close ?? 0;

      setCandles(activeCandles);
      const nextAnalysis = summarizeMarket(symbol, activeTimeframe, analyses, latestPrice, effectiveTradingMode);
      setAnalysis(nextAnalysis);
      setIsUsingCachedData(false);

      if (typeof window !== "undefined") {
        const payload: MarketCachePayload = {
          analysis: nextAnalysis,
          candles: activeCandles
        };
        window.localStorage.setItem(cacheKey, JSON.stringify(payload));
      }
      if (altOnly && pendingUserSelectedAltSymbolRef.current === symbol) {
        setAltAnalysisGate(registerAltAnalysisSymbol(symbol, hasCoinPro));
        pendingUserSelectedAltSymbolRef.current = null;
      }
    } catch (loadError) {
      const fallback = readMarketCache(cacheKey);

      if (fallback) {
        setCandles(fallback.candles);
        setAnalysis(fallback.analysis);
        setIsUsingCachedData(true);
        if (altOnly && pendingUserSelectedAltSymbolRef.current === symbol) {
          setAltAnalysisGate(registerAltAnalysisSymbol(symbol, hasCoinPro));
          pendingUserSelectedAltSymbolRef.current = null;
        }
        setError("실시간 데이터를 잠시 불러오지 못해 최근 레이더 판독값을 보여주고 있습니다.");
      } else {
        setError(loadError instanceof Error ? loadError.message : "시장 흐름을 잠시 확인하지 못했습니다.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [activeTimeframe, altOnly, analysisMode, cacheKey, effectiveTradingMode, hasCoinPro, msbMode, structureSensitivity, symbol]);

  useEffect(() => {
    loadMarket();
    const id = window.setInterval(() => loadMarket(), 30000);
    return () => window.clearInterval(id);
  }, [loadMarket]);

  useEffect(() => {
    if (!chartRef.current || chartApiRef.current) return;
    const chartThemeOptions = getChartThemeOptions();

    const chart = createChart(chartRef.current, {
      autoSize: true,
      ...chartThemeOptions,
      timeScale: {
        ...chartThemeOptions.timeScale,
        timeVisible: true
      },
      crosshair: {
        mode: 1
      }
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#34d399",
      downColor: "#fb4d5f",
      borderUpColor: "#34d399",
      borderDownColor: "#fb4d5f",
      wickUpColor: "#34d399",
      wickDownColor: "#fb4d5f"
    });

    chartApiRef.current = chart;
    candleSeriesRef.current = candleSeries;
    markersRef.current = createSeriesMarkers(candleSeries, []);
    const stopObservingTheme = observeChartThemeChange(() => {
      const nextThemeOptions = getChartThemeOptions();
      chart.applyOptions({
        ...nextThemeOptions,
        timeScale: {
          ...nextThemeOptions.timeScale,
          timeVisible: true
        }
      });
    });

    return () => {
      stopObservingTheme();
      if (candleSeriesRef.current) {
        priceLinesRef.current.forEach((line) => candleSeriesRef.current?.removePriceLine(line));
        priceLinesRef.current = [];
      }
      markersRef.current?.setMarkers([]);
      markersRef.current = null;
      chart.remove();
      chartApiRef.current = null;
      candleSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!candleSeriesRef.current) return;

    candleSeriesRef.current.setData(
      candles.map((candle) => ({
        time: toKstTime(candle.time),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close
      }))
    );

    // 가격 크기에 맞춰 Y축 정밀도 자동 조정 (XRP/DOGE 같은 저가 코인 대응)
    if (candles.length > 0) {
      const lastPrice = candles[candles.length - 1].close;
      const precision =
        lastPrice >= 1000 ? 1 : lastPrice >= 100 ? 2 : lastPrice >= 10 ? 3 : lastPrice >= 1 ? 4 : lastPrice >= 0.01 ? 5 : 6;
      candleSeriesRef.current.applyOptions({
        priceFormat: {
          type: "price",
          precision,
          minMove: Math.pow(10, -precision)
        }
      });
    }

    chartApiRef.current?.timeScale().fitContent();
  }, [candles]);

  const activeAnalysis = useMemo(
    () => analysis?.timeframeAnalyses.find((item) => item.timeframe === activeTimeframe),
    [analysis, activeTimeframe]
  );
  const altRiskSignals = useMemo(
    () => (analysis ? buildAltAnalysisRiskSignals(analysis, activeAnalysis) : []),
    [activeAnalysis, analysis]
  );
  const altFilterLabel = useMemo(
    () => (analysis ? altAnalysisFilterLabel(analysis, activeAnalysis) : "추적 대기"),
    [activeAnalysis, analysis]
  );
  const activeDealingRange = activeAnalysis?.dealingRange ?? {
    high: null,
    low: null,
    equilibrium: null,
    position: "unknown" as const
  };
  const radarDecision = useMemo(() => (analysis ? evaluateRadarDecision(analysis) : null), [analysis]);
  const radarInsight = useMemo(() => (analysis ? marketAnalysisToRadarInsight(analysis) : null), [analysis]);
  const visibleRadarInsight = useMemo(
    () => (radarInsight ? visibleRadarInsightForPlan(radarInsight, hasCoinPro) : null),
    [hasCoinPro, radarInsight]
  );
  const hasAnyOverlay = useMemo(
    () => canShowDetailedAnalysis && Object.values(overlaySettings).some(Boolean),
    [canShowDetailedAnalysis, overlaySettings]
  );
  const combinedScoreLimit = useMemo(() => {
    if (!analysis) return null;
    const config = tradingModeConfigs[effectiveTradingMode];
    const weightedTimeframes = new Set<ChartTimeframe>([activeTimeframe, ...config.contextTimeframes]);
    const max = analysis.timeframeAnalyses.reduce((sum, item) => {
      if (!weightedTimeframes.has(item.timeframe)) return sum;
      const weight =
        config.contextTimeframes.includes(item.timeframe) ? 1.35 : item.timeframe === activeTimeframe ? 1.25 : 1;
      return sum + timeframeScoreLimit * weight;
    }, 0);
    return Number(max.toFixed(2));
  }, [activeTimeframe, analysis, effectiveTradingMode]);

  const marketBriefingInput = useMemo<MarketBriefingInput | null>(() => {
    if (isBasicAltView) return null;
    if (!analysis || !activeAnalysis) return null;

    const scenario = analysis.proPlan
      ? {
          title: analysis.proPlan.title,
          reason: analysis.proPlan.reason,
          entry: formatPriceRange(analysis.proPlan.entryLow, analysis.proPlan.entryHigh),
          invalidation: formatPrice(analysis.proPlan.invalidation),
          targets: `${formatPrice(analysis.proPlan.target1)} / ${formatPrice(analysis.proPlan.target2)}`,
          confidence: analysis.proPlan.confidence
        }
      : null;

    return {
      symbol: analysis.symbol,
      activeTimeframe: analysis.activeTimeframe,
      tradingMode: analysis.tradingMode,
      price: analysis.price,
      verdict: analysis.verdict,
      bias: analysis.bias,
      biasScore: analysis.biasScore,
      scoreRange: combinedScoreLimit ? `-${combinedScoreLimit}~+${combinedScoreLimit}` : "계산 중",
      readiness: analysis.readiness,
      summaryLine: analysis.summaryLine,
      actionGuide: analysis.actionGuide,
      currentLocationLabel: analysis.currentLocationLabel,
      killzone: analysis.killzone,
      opportunityFlags: analysis.opportunityFlags.slice(0, 6),
      riskFlags: analysis.riskFlags.slice(0, 6),
      reasons: analysis.reasons.slice(0, 8).map((item) => ({ text: item.text, tone: item.tone })),
      active: {
        timeframe: activeAnalysis.timeframe,
        msb: aiStateLabel(activeAnalysis.msb),
        choch: aiStateLabel(activeAnalysis.choch),
        ob: activeAnalysis.latestOb
          ? `${aiStateLabel(activeAnalysis.latestOb.direction)}${activeAnalysis.inOb ? " 내부" : " 구간 대기"}`
          : "없음",
        fvg: activeAnalysis.latestFvg
          ? `${aiStateLabel(activeAnalysis.latestFvg.direction)} ${activeAnalysis.latestFvg.state === "ifvg" ? "iFVG" : "FVG"}${activeAnalysis.inFvg ? " 내부" : " 구간 대기"}`
          : "없음",
        sweep: activeAnalysis.latestSweep
          ? `${aiStateLabel(activeAnalysis.latestSweep.direction)} ${barsAgoLabel(activeAnalysis.latestSweep.age, activeTimeframe)}`
          : "없음",
        cisd: activeAnalysis.latestCisd
          ? `${aiStateLabel(activeAnalysis.latestCisd.direction)} ${barsAgoLabel(activeAnalysis.latestCisd.age, activeTimeframe)}`
          : "없음",
        displacement: activeAnalysis.latestDisplacement
          ? `${aiStateLabel(activeAnalysis.latestDisplacement.direction)} ${barsAgoLabel(activeAnalysis.latestDisplacement.age, activeTimeframe)} · 강도 ${activeAnalysis.latestDisplacement.strength}점`
          : "없음",
        buySideLiquidity: activeAnalysis.buySideLiquidity
          ? `${activeAnalysis.buySideLiquidity.level.toLocaleString("ko-KR", { maximumFractionDigits: 5 })} · ${Math.abs(activeAnalysis.buySideLiquidity.distancePercent).toFixed(2)}%`
          : "없음",
        sellSideLiquidity: activeAnalysis.sellSideLiquidity
          ? `${activeAnalysis.sellSideLiquidity.level.toLocaleString("ko-KR", { maximumFractionDigits: 5 })} · ${Math.abs(activeAnalysis.sellSideLiquidity.distancePercent).toFixed(2)}%`
          : "없음",
        dealingRange: aiStateLabel(activeDealingRange.position),
        pd: aiStateLabel(activeAnalysis.premiumDiscount),
        poc: activeAnalysis.volumeProfile
          ? `${aiStateLabel(activeAnalysis.volumeProfile.position)} ${Math.abs(activeAnalysis.volumeProfile.distancePercent).toFixed(2)}%`
          : "없음",
        regime: aiConditionLabel(activeAnalysis.condition.regime),
        dmi: `${formatIndicatorValue(activeAnalysis.condition.adx14, 1)} ${aiConditionLabel(activeAnalysis.condition.dmiState)}`,
        supertrend: aiConditionLabel(activeAnalysis.condition.supertrendDirection),
        donchian: aiConditionLabel(activeAnalysis.condition.donchianPosition),
        keltner: aiConditionLabel(activeAnalysis.condition.keltnerPosition),
        emaStack: aiConditionLabel(activeAnalysis.condition.emaStack),
        bollingerWidth: formatIndicatorValue(activeAnalysis.condition.bollingerWidthPercentile, 1, "%"),
        rsi: `${formatIndicatorValue(activeAnalysis.condition.rsi14, 1)} ${aiConditionLabel(activeAnalysis.condition.rsiState)}`,
        macd: aiConditionLabel(activeAnalysis.condition.macdState),
        volatility: `${formatIndicatorValue(activeAnalysis.condition.atrPercent, 2, "%")} ${aiConditionLabel(activeAnalysis.condition.volatilityState)}`,
        volume: `${formatIndicatorValue(activeAnalysis.condition.volumeRatio, 2, "x")} ${aiConditionLabel(activeAnalysis.condition.volumeState)}`,
        bollinger: aiConditionLabel(activeAnalysis.condition.bollingerPosition)
      },
      timeframes: analysis.timeframeAnalyses.map((item) => ({
        timeframe: item.timeframe,
        msb: aiStateLabel(item.msb),
        choch: aiStateLabel(item.choch),
        score: item.score,
        summary: timeframeSignalSummary(item)
      })),
      scenario
    };
  }, [activeAnalysis, activeDealingRange.position, activeTimeframe, analysis, combinedScoreLimit, isBasicAltView]);
  const marketBriefingScopeKey = `${symbol}.${activeTimeframe}`;

  useEffect(() => {
    setMarketBriefing({ status: "idle" });
  }, [marketBriefingScopeKey]);

  const loadMarketBriefing = useCallback(async () => {
    if (!marketBriefingInput) return;
    setMarketBriefing({ status: "loading" });

    try {
      const response = await fetch(
        "/api/ai/market-briefing",
        await withSupabaseAuth({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(marketBriefingInput)
        })
      );
      const payload = (await response.json().catch(() => ({}))) as {
        briefing?: string;
        model?: string;
        cached?: boolean;
        error?: string;
      };

      if (!response.ok || !payload.briefing) {
        throw new Error(payload.error ?? "AI 종합 피드백을 생성하지 못했습니다.");
      }

      setMarketBriefing({
        status: "ready",
        text: payload.briefing,
        model: payload.model ?? "unknown",
        cached: Boolean(payload.cached)
      });
    } catch (briefingError) {
      setMarketBriefing({
        status: "error",
        message: briefingError instanceof Error ? briefingError.message : "AI 종합 피드백을 잠시 확인하지 못했습니다. 잠시 뒤 다시 시도해 주세요."
      });
    }
  }, [marketBriefingInput]);

  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series) return;

    priceLinesRef.current.forEach((line) => series.removePriceLine(line));
    priceLinesRef.current = [];
    markersRef.current?.setMarkers([]);

    if (!activeAnalysis) return;
    if (!canShowDetailedAnalysis) return;

    const lines: Array<{ price: number | null | undefined; color: string; title: string; style?: LineStyle }> = [];
    const markers: SeriesMarker<Time>[] = [];

    if (overlaySettings.ema200 && activeAnalysis.ema200Value) {
      lines.push({
        price: activeAnalysis.ema200Value,
        color: "#facc15",
        title: `${activeAnalysis.timeframe} EMA200`,
        style: LineStyle.Dotted
      });
    }

    if (overlaySettings.poc && activeAnalysis.volumeProfile) {
      lines.push({
        price: activeAnalysis.volumeProfile.poc,
        color: "#fbbf24",
        title: `${activeAnalysis.timeframe} POC`,
        style: LineStyle.Dashed
      });
    }

    if (overlaySettings.orderBlocks && activeAnalysis.latestOb) {
      const color = activeAnalysis.latestOb.direction === "bullish" ? "#34d399" : "#fb4d5f";
      lines.push(
        { price: activeAnalysis.latestOb.top, color, title: `${activeAnalysis.timeframe} OB 상단` },
        { price: activeAnalysis.latestOb.bottom, color, title: `${activeAnalysis.timeframe} OB 하단` }
      );

      const obTime = candleTimeAt(candles, activeAnalysis.latestOb.originIndex);
      if (obTime) {
        markers.push({
          time: obTime,
          position: activeAnalysis.latestOb.direction === "bullish" ? "belowBar" : "aboveBar",
          color,
          shape: activeAnalysis.latestOb.direction === "bullish" ? "arrowUp" : "arrowDown",
          text: "OB"
        });
      }
    }

    if (overlaySettings.fvgs && activeAnalysis.latestFvg) {
      const color = activeAnalysis.latestFvg.direction === "bullish" ? "#38bdf8" : "#f59e0b";
      lines.push(
        {
          price: activeAnalysis.latestFvg.top,
          color,
          title: `${activeAnalysis.timeframe} ${activeAnalysis.latestFvg.state.toUpperCase()} 상단`,
          style: LineStyle.Dashed
        },
        {
          price: activeAnalysis.latestFvg.bottom,
          color,
          title: `${activeAnalysis.timeframe} ${activeAnalysis.latestFvg.state.toUpperCase()} 하단`,
          style: LineStyle.Dashed
        }
      );

      const fvgTime = candleTimeAt(candles, activeAnalysis.latestFvg.originIndex);
      if (fvgTime) {
        markers.push({
          time: fvgTime,
          position: activeAnalysis.latestFvg.direction === "bullish" ? "belowBar" : "aboveBar",
          color,
          shape: "circle",
          text: activeAnalysis.latestFvg.state === "ifvg" ? "iFVG" : "FVG"
        });
      }
    }

    if (overlaySettings.ote && activeAnalysis.oteLevels) {
      lines.push(
        {
          price: activeAnalysis.oteLevels.longLow,
          color: "#14b8a6",
          title: `${activeAnalysis.timeframe} OTE 롱 하단`,
          style: LineStyle.Dotted
        },
        {
          price: activeAnalysis.oteLevels.longHigh,
          color: "#14b8a6",
          title: `${activeAnalysis.timeframe} OTE 롱 상단`,
          style: LineStyle.Dotted
        },
        {
          price: activeAnalysis.oteLevels.shortLow,
          color: "#a855f7",
          title: `${activeAnalysis.timeframe} OTE 숏 하단`,
          style: LineStyle.Dotted
        },
        {
          price: activeAnalysis.oteLevels.shortHigh,
          color: "#a855f7",
          title: `${activeAnalysis.timeframe} OTE 숏 상단`,
          style: LineStyle.Dotted
        },
        {
          price: activeAnalysis.oteLevels.midpoint,
          color: "#94a3b8",
          title: `${activeAnalysis.timeframe} PD 50%`,
          style: LineStyle.Dashed
        }
      );
    }

    if (overlaySettings.msb && activeAnalysis.latestMsbEvent) {
      const msbTime = candleTimeAt(candles, activeAnalysis.latestMsbEvent.index);
      if (msbTime) {
        markers.push({
          time: msbTime,
          position: activeAnalysis.latestMsbEvent.direction === "bullish" ? "belowBar" : "aboveBar",
          color: activeAnalysis.latestMsbEvent.direction === "bullish" ? "#22c55e" : "#ef4444",
          shape: activeAnalysis.latestMsbEvent.direction === "bullish" ? "arrowUp" : "arrowDown",
          text: "MSB"
        });
      }
    }

    if (overlaySettings.choch && activeAnalysis.latestChochEvent) {
      const chochTime = candleTimeAt(candles, activeAnalysis.latestChochEvent.index);
      if (chochTime) {
        markers.push({
          time: chochTime,
          position: activeAnalysis.latestChochEvent.direction === "bullish" ? "belowBar" : "aboveBar",
          color: activeAnalysis.latestChochEvent.direction === "bullish" ? "#4ade80" : "#f87171",
          shape: "square",
          text: "CH"
        });
      }
    }

    if (overlaySettings.sweep && activeAnalysis.latestSweep) {
      const sweepTime = candleTimeAt(candles, activeAnalysis.latestSweep.index);
      if (sweepTime) {
        markers.push({
          time: sweepTime,
          position: activeAnalysis.latestSweep.direction === "bullish" ? "belowBar" : "aboveBar",
          color: activeAnalysis.latestSweep.direction === "bullish" ? "#60a5fa" : "#fbbf24",
          shape: "circle",
          text: "SWP"
        });
      }
    }

    if (overlaySettings.cisd && activeAnalysis.latestCisd) {
      const cisdTime = candleTimeAt(candles, activeAnalysis.latestCisd.index);
      if (cisdTime) {
        markers.push({
          time: cisdTime,
          position: activeAnalysis.latestCisd.direction === "bullish" ? "belowBar" : "aboveBar",
          color: activeAnalysis.latestCisd.direction === "bullish" ? "#10b981" : "#f97316",
          shape: "square",
          text: "CISD"
        });
      }
    }

    priceLinesRef.current = lines
      .filter((line) => Number.isFinite(line.price) && Number(line.price) > 0)
      .map((line) =>
        series.createPriceLine({
          price: Number(line.price),
          color: line.color,
          lineWidth: 1,
          lineStyle: line.style ?? LineStyle.Solid,
          axisLabelVisible: true,
          title: line.title
        })
      );
    markersRef.current?.setMarkers(markers);
  }, [activeAnalysis, canShowDetailedAnalysis, candles, overlaySettings]);

  const mtfFvgMap = useMemo(
    () =>
      analysis?.timeframeAnalyses.filter(
        (item) => item.timeframe === "15m" || item.timeframe === "1h" || item.timeframe === "4h" || item.timeframe === "1d"
      ) ?? [],
    [analysis]
  );

  const fourHourAnalysis = useMemo(
    () => analysis?.timeframeAnalyses.find((item) => item.timeframe === "4h"),
    [analysis]
  );

  const alignmentSummary = useMemo(() => {
    if (!analysis) return null;

    const higher = analysis.timeframeAnalyses.filter((item) => item.timeframe === "4h" || item.timeframe === "1d");
    const fast = analysis.timeframeAnalyses.filter((item) => item.timeframe === "5m" || item.timeframe === "15m");
    const higherBullish = higher.filter((item) => item.msb === "bullish").length;
    const higherBearish = higher.filter((item) => item.msb === "bearish").length;
    const fastBullish = fast.filter((item) => item.msb === "bullish").length;
    const fastBearish = fast.filter((item) => item.msb === "bearish").length;

    return {
      higher:
        higherBullish === higher.length
          ? "상위 구조 롱 정렬"
          : higherBearish === higher.length
            ? "상위 구조 숏 정렬"
            : "상위 구조 혼합",
      fast:
        fastBullish === fast.length
          ? "단기 구조 롱 정렬"
          : fastBearish === fast.length
            ? "단기 구조 숏 정렬"
            : "단기 구조 혼합"
    };
  }, [analysis]);

  const pineSnapshot = useMemo(() => parsePineSnapshot(pineSnapshotInput), [pineSnapshotInput]);

  const parityRows = useMemo<ParityRow[]>(() => {
    if (!activeAnalysis || !pineSnapshot) return [];

    const pineMsbFromSnapshot = pineSnapshot.msb ? pineDirectionForTimeframe(pineSnapshot.msb, activeTimeframe) : "unknown";
    const pineChochFromSnapshot = pineSnapshot.choch
      ? pineDirectionForTimeframe(pineSnapshot.choch, activeTimeframe)
      : "unknown";
    const pineMsb = pineMsbFromSnapshot !== "unknown" ? pineMsbFromSnapshot : normalizePineDirection(pineSnapshot.market);
    const pineChoch = pineChochFromSnapshot !== "unknown" ? pineChochFromSnapshot : normalizePineDirection(pineSnapshot.chochDir);
    const pineLatestFvg = pineSnapshot.latestFvg ??
      (pineSnapshot.fvgDir && pineSnapshot.fvgDir !== "none"
        ? {
            direction: pineSnapshot.fvgDir,
            state: pineSnapshot.fvgIsIfvg ? ("ifvg" as const) : ("fvg" as const),
            top: pineSnapshot.fvgTop,
            bottom: pineSnapshot.fvgBottom
          }
        : null);
    const pineObDirection =
      pineSnapshot.latestOb?.direction && pineSnapshot.latestOb.direction !== "none" ? pineSnapshot.latestOb.direction : undefined;
    const pineCisdDirection =
      pineSnapshot.latestCisd?.direction ?? (pineSnapshot.cisd && pineSnapshot.cisd !== "none" ? normalizePineDirection(pineSnapshot.cisd) : undefined);
    const rows: ParityRow[] = [
      {
        label: "MSB direction",
        web: stateLabel(activeAnalysis.msb),
        pine: stateLabel(pineMsb),
        matched: activeAnalysis.msb === pineMsb,
        result: activeAnalysis.msb === pineMsb ? "일치" : "차이",
        importance: "core"
      },
      {
        label: "CHoCH direction",
        web: stateLabel(activeAnalysis.choch),
        pine: stateLabel(pineChoch),
        matched: activeAnalysis.choch === pineChoch,
        result: activeAnalysis.choch === pineChoch ? "일치" : "차이",
        importance: "core"
      },
      {
        label: "h0",
        web: activeAnalysis.debug.h0 ? formatPrice(activeAnalysis.debug.h0) : "-",
        pine: pineSnapshot.h0 ? formatPrice(Number(pineSnapshot.h0)) : "-",
        ...compareNumber(activeAnalysis.debug.h0, pineSnapshot.h0),
        importance: "major"
      },
      {
        label: "h1",
        web: activeAnalysis.debug.h1 ? formatPrice(activeAnalysis.debug.h1) : "-",
        pine: pineSnapshot.h1 ? formatPrice(Number(pineSnapshot.h1)) : "-",
        ...compareNumber(activeAnalysis.debug.h1, pineSnapshot.h1),
        importance: "major"
      },
      {
        label: "l0",
        web: activeAnalysis.debug.l0 ? formatPrice(activeAnalysis.debug.l0) : "-",
        pine: pineSnapshot.l0 ? formatPrice(Number(pineSnapshot.l0)) : "-",
        ...compareNumber(activeAnalysis.debug.l0, pineSnapshot.l0),
        importance: "major"
      },
      {
        label: "l1",
        web: activeAnalysis.debug.l1 ? formatPrice(activeAnalysis.debug.l1) : "-",
        pine: pineSnapshot.l1 ? formatPrice(Number(pineSnapshot.l1)) : "-",
        ...compareNumber(activeAnalysis.debug.l1, pineSnapshot.l1),
        importance: "major"
      },
      {
        label: "EMA200 side",
        web: stateLabel(activeAnalysis.ema200Side),
        pine: stateLabel(pineSnapshot.ema200Side ?? "unknown"),
        ...compareOptionalValue(activeAnalysis.ema200Side, pineSnapshot.ema200Side),
        importance: "major"
      },
      {
        label: "PD zone",
        web: stateLabel(activeAnalysis.premiumDiscount),
        pine: stateLabel(pineSnapshot.premiumDiscount ?? "unknown"),
        ...compareOptionalValue(activeAnalysis.premiumDiscount, pineSnapshot.premiumDiscount),
        importance: "major"
      },
      {
        label: "OTE zone",
        web: stateLabel(activeAnalysis.oteZone),
        pine: stateLabel(pineSnapshot.oteZone ?? "unknown"),
        ...compareOptionalValue(activeAnalysis.oteZone, pineSnapshot.oteZone),
        importance: "major"
      },
      {
        label: "OB direction",
        web: activeAnalysis.latestOb ? stateLabel(activeAnalysis.latestOb.direction) : "-",
        pine: pineObDirection ? stateLabel(pineObDirection) : "-",
        ...compareOptionalValue(activeAnalysis.latestOb?.direction ?? "", pineObDirection),
        importance: "major"
      },
      {
        label: "OB top",
        web: activeAnalysis.latestOb ? formatPrice(activeAnalysis.latestOb.top) : "-",
        pine: pineSnapshot.latestOb?.top ? formatPrice(Number(pineSnapshot.latestOb.top)) : "-",
        ...compareNumber(activeAnalysis.latestOb?.top ?? null, pineSnapshot.latestOb?.top),
        importance: "minor"
      },
      {
        label: "OB bottom",
        web: activeAnalysis.latestOb ? formatPrice(activeAnalysis.latestOb.bottom) : "-",
        pine: pineSnapshot.latestOb?.bottom ? formatPrice(Number(pineSnapshot.latestOb.bottom)) : "-",
        ...compareNumber(activeAnalysis.latestOb?.bottom ?? null, pineSnapshot.latestOb?.bottom),
        importance: "minor"
      },
      {
        label: "FVG direction",
        web: activeAnalysis.latestFvg ? stateLabel(activeAnalysis.latestFvg.direction) : "-",
        pine: pineLatestFvg?.direction ? stateLabel(pineLatestFvg.direction) : "-",
        ...compareOptionalValue(activeAnalysis.latestFvg?.direction ?? "", pineLatestFvg?.direction),
        importance: "major"
      },
      {
        label: "FVG state",
        web: activeAnalysis.latestFvg?.state?.toUpperCase() ?? "-",
        pine: pineLatestFvg?.state?.toUpperCase() ?? "-",
        ...compareOptionalValue(activeAnalysis.latestFvg?.state ?? "", pineLatestFvg?.state),
        importance: "minor"
      },
      {
        label: "FVG top",
        web: activeAnalysis.latestFvg ? formatPrice(activeAnalysis.latestFvg.top) : "-",
        pine: pineLatestFvg?.top ? formatPrice(Number(pineLatestFvg.top)) : "-",
        ...compareNumber(activeAnalysis.latestFvg?.top ?? null, pineLatestFvg?.top),
        importance: "minor"
      },
      {
        label: "FVG bottom",
        web: activeAnalysis.latestFvg ? formatPrice(activeAnalysis.latestFvg.bottom) : "-",
        pine: pineLatestFvg?.bottom ? formatPrice(Number(pineLatestFvg.bottom)) : "-",
        ...compareNumber(activeAnalysis.latestFvg?.bottom ?? null, pineLatestFvg?.bottom),
        importance: "minor"
      },
      {
        label: "Sweep direction",
        web: activeAnalysis.latestSweep ? stateLabel(activeAnalysis.latestSweep.direction) : "-",
        pine: pineSnapshot.latestSweep?.direction ? stateLabel(pineSnapshot.latestSweep.direction) : "-",
        ...compareOptionalValue(activeAnalysis.latestSweep?.direction ?? "", pineSnapshot.latestSweep?.direction),
        importance: "minor"
      },
      {
        label: "Sweep level",
        web: activeAnalysis.latestSweep ? formatPrice(activeAnalysis.latestSweep.level) : "-",
        pine: pineSnapshot.latestSweep?.level ? formatPrice(Number(pineSnapshot.latestSweep.level)) : "-",
        ...compareNumber(activeAnalysis.latestSweep?.level ?? null, pineSnapshot.latestSweep?.level),
        importance: "minor"
      },
      {
        label: "CISD direction",
        web: activeAnalysis.latestCisd ? stateLabel(activeAnalysis.latestCisd.direction) : "-",
        pine: pineCisdDirection ? stateLabel(pineCisdDirection) : "-",
        ...compareOptionalValue(activeAnalysis.latestCisd?.direction ?? "", pineCisdDirection),
        importance: "minor"
      },
      {
        label: "CISD level",
        web: activeAnalysis.latestCisd ? formatPrice(activeAnalysis.latestCisd.level) : "-",
        pine: pineSnapshot.latestCisd?.level ? formatPrice(Number(pineSnapshot.latestCisd.level)) : "-",
        ...compareNumber(activeAnalysis.latestCisd?.level ?? null, pineSnapshot.latestCisd?.level),
        importance: "minor"
      },
      {
        label: "hiPts count",
        web: String(activeAnalysis.debug.hiCount),
        pine: pineSnapshot.hiCount === undefined ? "-" : String(pineSnapshot.hiCount),
        matched: pineSnapshot.hiCount === activeAnalysis.debug.hiCount,
        result: pineSnapshot.hiCount === activeAnalysis.debug.hiCount ? "일치" : "차이",
        importance: "minor"
      },
      {
        label: "loPts count",
        web: String(activeAnalysis.debug.loCount),
        pine: pineSnapshot.loCount === undefined ? "-" : String(pineSnapshot.loCount),
        matched: pineSnapshot.loCount === activeAnalysis.debug.loCount,
        result: pineSnapshot.loCount === activeAnalysis.debug.loCount ? "일치" : "차이",
        importance: "minor"
      }
    ];

    return rows.filter((row) => row.web !== "-" || row.pine !== "-");
  }, [activeAnalysis, activeTimeframe, pineSnapshot]);

  const parityScore = useMemo(() => {
    if (!parityRows.length) return null;
    const weighted = parityRows.reduce(
      (acc, row) => {
        const weight = row.importance === "core" ? 3 : row.importance === "major" ? 2 : 1;
        return {
          total: acc.total + weight,
          matched: acc.matched + (row.matched ? weight : 0)
        };
      },
      { total: 0, matched: 0 }
    );
    return Math.round((weighted.matched / weighted.total) * 100);
  }, [parityRows]);

  const parityMismatches = useMemo(() => parityRows.filter((row) => !row.matched), [parityRows]);

  const groupedReasons = useMemo(() => {
    if (!analysis) {
      return {
        bullish: [] as AnalysisReason[],
        bearish: [] as AnalysisReason[],
        neutral: [] as AnalysisReason[]
      };
    }

    return {
      bullish: analysis.reasons.filter((reason) => reason.tone === "bullish"),
      bearish: analysis.reasons.filter((reason) => reason.tone === "bearish"),
      neutral: analysis.reasons.filter((reason) => reason.tone === "neutral")
    };
  }, [analysis]);

  function toggleOverlay(key: keyof OverlaySettings) {
    setOverlaySettings((current) => ({
      ...current,
      [key]: !current[key]
    }));
  }

  function applyOverlayPreset(preset: keyof typeof overlayPresets) {
    setOverlaySettings(overlayPresets[preset]);
  }

  function applyStructurePreset(option: (typeof structureSensitivityOptions)[number]) {
    setStructureSensitivity(option.value);
    setAnalysisMode(option.analysisMode);
    setMsbMode(option.msbMode);
  }

  function comparableSnapshotFromWeb() {
    if (!activeAnalysis) return null;

    return {
      symbol,
      timeframe: activeTimeframe,
      market: activeAnalysis.debug.market,
      chochDir: activeAnalysis.debug.choch,
      msb: activeAnalysis.msb,
      choch: activeAnalysis.choch,
      ema200Side: activeAnalysis.ema200Side,
      volumeProfile: activeAnalysis.volumeProfile,
      premiumDiscount: activeAnalysis.premiumDiscount,
      oteZone: activeAnalysis.oteZone,
      h0: activeAnalysis.debug.h0,
      h1: activeAnalysis.debug.h1,
      l0: activeAnalysis.debug.l0,
      l1: activeAnalysis.debug.l1,
      hiCount: activeAnalysis.debug.hiCount,
      loCount: activeAnalysis.debug.loCount,
      latestOb: activeAnalysis.latestOb
        ? {
            direction: activeAnalysis.latestOb.direction,
            top: activeAnalysis.latestOb.top,
            bottom: activeAnalysis.latestOb.bottom
          }
        : null,
      latestFvg: activeAnalysis.latestFvg
        ? {
            direction: activeAnalysis.latestFvg.direction,
            state: activeAnalysis.latestFvg.state,
            top: activeAnalysis.latestFvg.top,
            bottom: activeAnalysis.latestFvg.bottom
          }
        : null,
      latestSweep: activeAnalysis.latestSweep
        ? {
            direction: activeAnalysis.latestSweep.direction,
            level: activeAnalysis.latestSweep.level,
            age: activeAnalysis.latestSweep.age
          }
        : null,
      latestCisd: activeAnalysis.latestCisd
        ? {
            direction: activeAnalysis.latestCisd.direction,
            level: activeAnalysis.latestCisd.level,
            age: activeAnalysis.latestCisd.age
          }
        : null
    };
  }

  function fillParityTemplateFromWeb() {
    const snapshot = comparableSnapshotFromWeb();
    if (!snapshot) return;
    setPineSnapshotInput(JSON.stringify(snapshot, null, 2));
  }

  async function copyDebugSnapshot() {
    if (!activeAnalysis) return;

    const snapshot = {
      symbol,
      timeframe: activeTimeframe,
      price: analysis?.price ?? null,
      bias: analysis?.bias ?? null,
      readiness: analysis?.readiness ?? null,
      killzone: analysis?.killzone ?? null,
      msb: activeAnalysis.msb,
      choch: activeAnalysis.choch,
      score: activeAnalysis.score,
      h0: activeAnalysis.debug.h0,
      h1: activeAnalysis.debug.h1,
      l0: activeAnalysis.debug.l0,
      l1: activeAnalysis.debug.l1,
      market: activeAnalysis.debug.market,
      chochDir: activeAnalysis.debug.choch,
      hiCount: activeAnalysis.debug.hiCount,
      loCount: activeAnalysis.debug.loCount,
      latestOb: activeAnalysis.latestOb,
      latestBb: activeAnalysis.latestBb,
      latestFvg: activeAnalysis.latestFvg,
      latestSweep: activeAnalysis.latestSweep,
      latestCisd: activeAnalysis.latestCisd,
      volumeProfile: activeAnalysis.volumeProfile,
      condition: activeAnalysis.condition,
      overlaySettings,
      currentLocationLabel: analysis?.currentLocationLabel ?? null,
      msbMode,
      longScenario: analysis?.longScenario ?? null,
      shortScenario: analysis?.shortScenario ?? null,
      opportunityFlags: analysis?.opportunityFlags ?? [],
      riskFlags: analysis?.riskFlags ?? [],
      updatedAt: analysis?.updatedAt ?? null
    };

    await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function saveAnalysisToJournal() {
    if (!analysis || !activeAnalysis) return;

    const noteParts = [
      `판정: ${analysis.verdict}`,
      `행동 가이드: ${analysis.actionGuide}`,
      `현재 위치: ${analysis.currentLocationLabel}`,
      `상위 구조: ${alignmentSummary?.higher ?? "-"}`,
      `단기 구조: ${alignmentSummary?.fast ?? "-"}`,
      `MSB/CHoCH: ${stateLabel(activeAnalysis.msb)} / ${stateLabel(activeAnalysis.choch)}`,
      `POC: ${
        activeAnalysis.volumeProfile
          ? `${formatPrice(activeAnalysis.volumeProfile.poc)} / ${stateLabel(activeAnalysis.volumeProfile.position)}`
          : "-"
      }`,
      `시장 환경: RSI ${formatIndicatorValue(activeAnalysis.condition.rsi14, 1)} (${conditionLabel(activeAnalysis.condition.rsiState)}) / MACD ${conditionLabel(
        activeAnalysis.condition.macdState
      )} / ATR ${formatIndicatorValue(activeAnalysis.condition.atrPercent, 2, "%")} (${conditionLabel(activeAnalysis.condition.volatilityState)})`,
      `체크포인트:`,
      ...analysis.checkpoints.map((item) => `- ${item}`),
      `위험 신호:`,
      ...(analysis.riskFlags.length ? analysis.riskFlags.map((item) => `- ${item}`) : ["- 없음"]),
      `추적 후보:`,
      ...(analysis.opportunityFlags.length ? analysis.opportunityFlags.map((item) => `- ${item}`) : ["- 없음"])
    ];

    const payload = {
      title: `${symbol} ${activeTimeframe} 레이더 저장`,
      bias: analysis.bias === "long" ? "롱" : analysis.bias === "short" ? "숏" : "관찰",
      note: noteParts.join("\n"),
      source: "chart",
      symbol,
      timeframe: activeTimeframe,
      verdict: analysis.verdict
    } as const;

    const session = await getActiveSupabaseSession();
    if (session) {
      try {
        await createRemoteJournalEntry(session.accessToken, payload);
        setSavedMessage("현재 레이더 판독을 복기에 저장했습니다.");
        window.setTimeout(() => setSavedMessage(""), 1800);
        return;
      } catch {
        setSavedMessage("복기에 남겼습니다. 잠시 후 다시 열어도 같은 판독을 확인할 수 있습니다.");
      }
    }

    appendJournalEntry(payload);

    if (!session) setSavedMessage("현재 레이더 판독을 복기에 저장했습니다.");
    window.setTimeout(() => setSavedMessage(""), 1800);
  }

  return (
    <section
      id="basic-coins"
      className={
        isMajorScreen
          ? "scroll-mt-24 rounded-ui-lg border border-ui-line bg-ui-panel p-3 pb-28 text-ui-text shadow-ui-panel sm:p-4 sm:pb-28"
          : "scroll-mt-24 rounded-lg border border-surface-line bg-surface-card p-4 pb-28 shadow-glow sm:p-5 sm:pb-28"
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div
              className={
                isMajorScreen
                  ? "grid h-10 w-10 shrink-0 place-items-center rounded-ui border border-ui-line bg-ui-inset text-ui-muted"
                  : "grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-accent-blue/25 bg-accent-blue/10 text-accent-blue"
              }
            >
              <BarChart3 size={21} aria-hidden />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className={isMajorScreen ? "text-ui-heading font-semibold tracking-tight text-ui-text" : "text-xl font-black text-white"}>{chartTitle}</h2>
                {!isMajorScreen ? (
                  <span className="rounded border border-accent-blue/30 bg-accent-blue/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-accent-blue">
                    Live
                  </span>
                ) : null}
                <span
                  className={
                    isMajorScreen
                      ? "rounded-ui-sm border border-ui-line bg-ui-inset px-2 py-0.5 text-ui-label font-semibold text-ui-muted"
                      : "rounded border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-bold text-slate-400"
                  }
                >
                  Binance 기준
                </span>
              </div>
              <p className={isMajorScreen ? "mt-1 text-ui-body text-ui-muted [word-break:keep-all]" : "mt-1 text-sm leading-6 text-slate-400 [word-break:keep-all]"}>
                {chartDescription}
              </p>
            </div>
          </div>
        </div>

      </div>

      <div className={`relative mt-4 grid gap-2 ${majorOnly ? "grid-cols-2" : altOnly ? "grid-cols-3 sm:grid-cols-6" : "grid-cols-3"}`}>
        {primarySymbols.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => selectSymbol(item, { userSelected: true })}
            className={`min-h-10 whitespace-nowrap rounded-md border px-3 text-sm font-black transition ${
              symbol === item
                ? isMajorScreen
                  ? "border-ui-lineStrong bg-ui-active text-ui-activeText ring-1 ring-inset ring-ui-lineStrong"
                  : "border-accent-blue bg-accent-blue text-slate-950"
                : isMajorScreen
                  ? "border-ui-line bg-ui-inset text-ui-muted hover:border-ui-lineStrong hover:text-ui-text"
                  : "border-surface-line bg-surface-cardSoft text-slate-300 hover:border-accent-blue/60"
            }`}
          >
            {symbolLabel(item)}
          </button>
        ))}
        {!majorOnly ? (
          <button
            type="button"
            onClick={() => {
              setShowOtherSymbols((value) => {
                if (value) setOtherSymbolQuery("");
                return !value;
              });
            }}
            className={`min-h-10 whitespace-nowrap rounded-md border px-3 text-sm font-black transition ${
              isOtherSymbolActive || showOtherSymbols
                ? "border-accent-blue bg-accent-blue text-slate-950"
                : "border-surface-line bg-surface-cardSoft text-slate-300 hover:border-accent-blue/60"
            }`}
          >
            {isOtherSymbolActive ? symbolLabel(symbol) : "그 외"}
          </button>
        ) : null}
        {!majorOnly && showOtherSymbols ? (
          <div className="absolute left-0 top-full z-50 mt-2 max-h-[58vh] w-[min(92vw,560px)] overflow-hidden rounded-lg border border-surface-line bg-slate-950 p-2 shadow-[0_18px_50px_rgba(0,0,0,0.55)]">
            <input
              value={otherSymbolQuery}
              onChange={(event) => setOtherSymbolQuery(event.target.value)}
              placeholder="코인 검색"
              className="mb-2 h-10 w-full rounded-md border border-surface-line bg-black/30 px-3 text-sm font-bold text-white outline-none placeholder:text-slate-500 focus:border-accent-blue"
            />
            <div className="grid max-h-[44vh] grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
              {filteredOtherSymbols.length > 0 ? (
                filteredOtherSymbols.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => selectSymbol(item, { userSelected: true })}
                    className={`min-h-9 rounded-md border px-2 text-xs font-black transition ${
                      symbol === item
                        ? "border-accent-blue bg-accent-blue text-slate-950"
                        : "border-surface-line bg-surface-cardSoft text-slate-300 hover:border-accent-blue/60"
                    }`}
                  >
                    {symbolLabel(item)}
                  </button>
                ))
              ) : (
                <p className="col-span-4 rounded-md border border-surface-line bg-black/20 px-3 py-4 text-center text-xs font-bold text-slate-400 sm:col-span-6">
                  검색 결과가 없습니다.
                </p>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {altOnly ? (
        <div
          className={`mt-3 rounded-lg border p-3 ${
            visibleAltAnalysisGate.allowed
              ? "border-cyan-300/20 bg-cyan-300/10"
              : "border-amber-300/35 bg-amber-300/10"
          }`}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className={`text-xs font-black ${visibleAltAnalysisGate.allowed ? "text-cyan-200" : "text-amber-200"}`}>
                {hasCoinPro ? "Coin Pro 알트 분석 무제한" : `무료 분석 ${visibleAltAnalysisGate.limit}개 중 ${Math.min(visibleAltAnalysisGate.used, visibleAltAnalysisGate.limit)}개 사용`}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-400 [word-break:keep-all]">
                {hasCoinPro
                  ? "관심 있는 알트코인을 제한 없이 바꿔가며 구조와 브리핑을 확인할 수 있습니다."
                  : visibleAltAnalysisGate.allowed
                    ? `무료에서는 하루 ${visibleAltAnalysisGate.limit}개의 알트를 개별 분석할 수 있습니다. 같은 알트는 다시 열어도 차감되지 않습니다.`
                    : "오늘 무료 알트 분석을 모두 사용했습니다. Coin Pro에서는 BTC/ETH·알트 리스크와 추적 조건을 반복 확인할 수 있습니다."}
              </p>
            </div>
            {!hasCoinPro ? (
              <Link
                href="/pro?market=crypto"
                className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-md bg-cyan-300 px-3 text-xs font-black text-slate-950 transition hover:bg-cyan-200"
              >
                <Crown size={13} aria-hidden />
                Coin Pro 상세 보기
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      {!isMajorScreen ? (
        <div className="mt-3 rounded-lg border border-surface-line bg-surface-cardSoft p-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black text-white">구조 감지 기준</p>
              <p className="mt-1 text-[11px] leading-5 text-slate-500 [word-break:keep-all]">
                초보자는 균형 감지를 기본으로 두고, 더 빠른 변화를 보고 싶을 때만 빠른 변화 감지를 쓰면 됩니다.
              </p>
            </div>
            <span className="text-[11px] font-bold text-slate-500">
              현재 {structureSensitivityLabel(structureSensitivity)}
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {structureSensitivityOptions.map((item) => {
              const active = structureSensitivity === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => applyStructurePreset(item)}
                  className={`min-h-16 rounded-md border px-3 py-2 text-left transition ${
                    active
                      ? "border-accent-blue bg-accent-blue text-slate-950"
                      : "border-surface-line bg-black/20 text-slate-300 hover:border-accent-blue/60"
                  }`}
                >
                  <span className="block text-sm font-black">{item.label}</span>
                  <span className="mt-1 block text-[11px] font-semibold opacity-80">{item.description}</span>
                  <span className="mt-1 block text-[10px] font-semibold opacity-70">{item.detail}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {altOnly && !visibleAltAnalysisGate.allowed ? (
        <div className="mt-4 rounded-lg border border-amber-300/30 bg-amber-300/10 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black text-amber-200">오늘 무료 알트 분석 완료</p>
              <h3 className="mt-2 text-2xl font-black text-white">새 알트 상세 판단은 Coin Pro에서 열립니다.</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 [word-break:keep-all]">
                무료에서는 하루 {visibleAltAnalysisGate.limit}개의 알트를 개별 분석할 수 있어요. 이미 확인한 알트는 다시 열 수 있고,
                새로운 알트의 추적 조건과 리스크까지 확인하려면 Coin Pro가 필요합니다.
              </p>
            </div>
            <Link
              href="/pro?market=crypto"
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-black text-slate-950 transition hover:bg-cyan-200"
            >
              <Crown size={16} aria-hidden />
              Coin Pro 상세 보기
            </Link>
          </div>
          {visibleAltAnalysisGate.symbols.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {visibleAltAnalysisGate.symbols.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => selectSymbol(item)}
                  className="rounded border border-white/10 bg-black/20 px-2 py-1 text-xs font-black text-slate-200 hover:border-cyan-300/60"
                >
                  다시 보기: {symbolLabel(item)}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : analysis && visibleRadarInsight ? (
        <div className="mt-4 space-y-4">
          <RadarInsightPanel
            insight={visibleRadarInsight}
            isPro={hasCoinPro}
            strengthHelp={isMajorScreen ? MAJOR_STRENGTH_HELP : undefined}
            variant={isMajorScreen ? "cryptoSummary" : "default"}
            priceLabel={isMajorScreen ? formatPrice(analysis.price) : undefined}
            dataStatusLabel={isMajorScreen ? `${isUsingCachedData ? "최근 저장본" : "실시간 확인"} · ${formatUpdatedAt(analysis.updatedAt)}` : undefined}
            summaryMetrics={isMajorScreen ? buildMajorSummaryMetrics(analysis, activeAnalysis, visibleRadarInsight) : undefined}
          />
          <div className="rounded-xl border border-surface-line bg-surface-cardSoft p-4">
            <BeginnerActionGuide
              title={isMajorScreen ? "화면은 이 순서로 읽습니다" : "지금은 이 순서로 보면 됩니다"}
              summary={
                isMajorScreen
                  ? "이 안내는 판단을 다시 내리는 영역이 아닙니다. 상단 판단을 먼저 보고, 아래 차트와 지표는 그 판단의 근거를 확인하는 순서로 봅니다."
                  : hasCoinPro
                  ? "방향, 현재 위치, 위험 조건을 한 줄 행동 순서로 압축했습니다. 초보자는 아래 3가지를 먼저 확인한 뒤 세부 지표로 내려가면 됩니다."
                  : "Basic에서는 방향 요약만 제공합니다. 공개된 근거와 일반 리스크까지만 확인하고, 세부 추적 조건과 다음 확인 기준은 Pro 판단 보조 영역에서 분리합니다."
              }
              steps={
                isMajorScreen
                  ? buildMajorScreenGuideSteps(hasCoinPro)
                  : hasCoinPro
                    ? buildCoinBeginnerSteps(analysis, radarDecision)
                    : buildCoinBasicBeginnerSteps(analysis)
              }
              checklist={
                isMajorScreen
                  ? hasCoinPro
                    ? [
                        "상단 판단 카드의 추적 조건과 무효화 기준을 먼저 확인",
                        "아래 구조·기술 근거가 같은 방향을 보조하는지 확인",
                        "리스크 점검 항목이 판단을 약화시키는지 확인"
                      ]
                    : [
                        "상단 판단과 판단 강도를 먼저 확인",
                        "Basic 공개 근거와 일반 리스크만 확인",
                        "구체 조건과 가격 레벨은 Pro 잠금 영역으로 구분"
                      ]
                  : hasCoinPro
                  ? [
                      "손절 기준을 말로 설명할 수 있는지 확인",
                      "수량이 계좌 기준 위험 한도 안인지 확인",
                      "다음 캔들에서도 같은 방향 근거가 유지되는지 확인"
                    ]
                  : [
                      "최종 판단과 판단 강도를 먼저 확인",
                      "공개된 핵심 근거와 리스크 1개만 확인",
                      "추적 조건, 무효화 기준, 다음 확인 기준은 잠금 영역으로 분리"
                    ]
              }
              help={
                isMajorScreen
                  ? "상단 Radar Insight가 최종 판단 영역입니다. 아래 안내와 지표는 판단을 보조하는 근거 확인용입니다."
                  : hasCoinPro
                  ? "판단 엔진은 차트 구조, 현재 위치, 위험 플래그, 데이터 신뢰도를 합쳐 행동 순서를 정리합니다. 점수가 좋아도 손절과 수량을 정하지 않았다면 아직 준비가 끝난 상태가 아닙니다."
                  : "Basic 안내는 판단 보조 요약입니다. 실제 판단에 필요한 조건, 무효화 기준, 상세 리스크는 Pro에서 전체 맥락으로 확인합니다."
              }
            />
          </div>
          {isMajorScreen ? (
            <div className="rounded-ui border border-ui-line bg-ui-inset p-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-ui-label font-semibold uppercase tracking-[0.08em] text-ui-subtle">구조 감지 기준</p>
                  <p className="mt-1 text-xs leading-5 text-ui-muted [word-break:keep-all]">
                    기본은 균형 감지입니다. 빠른 변화 감지는 더 민감하게 구조 변화를 확인할 때만 사용합니다.
                  </p>
                </div>
                <span className="text-xs font-semibold text-ui-muted">현재 {structureSensitivityLabel(structureSensitivity)}</span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {structureSensitivityOptions.map((item) => {
                  const active = structureSensitivity === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => applyStructurePreset(item)}
                      className={`min-h-14 rounded-ui-sm border px-3 py-2 text-left transition ${
                        active
                          ? "border-ui-lineStrong bg-ui-active text-ui-activeText ring-1 ring-inset ring-ui-lineStrong"
                          : "border-ui-line bg-ui-panel text-ui-muted hover:border-ui-lineStrong hover:text-ui-text"
                      }`}
                    >
                      <span className="block text-sm font-semibold">{item.label}</span>
                      <span className="mt-1 block text-[11px] font-semibold opacity-80">{item.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 min-h-56 animate-pulse rounded-lg border border-surface-line bg-surface-cardSoft p-4">
          <p className="text-xs font-semibold text-slate-500">{symbolLabel(symbol)} · {activeTimeframe} 레이더 결론</p>
          <div className="mt-4 h-8 w-40 rounded bg-white/10" />
          <div className="mt-4 h-4 w-full max-w-lg rounded bg-white/10" />
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <div className="h-14 rounded bg-white/10" />
            <div className="h-14 rounded bg-white/10" />
            <div className="h-14 rounded bg-white/10" />
          </div>
        </div>
      )}

      {canShowDetailedAnalysis ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowAdvancedControls((value) => !value)}
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-surface-line bg-surface-cardSoft px-3 text-sm font-bold text-slate-300 hover:border-accent-blue/60 hover:text-white"
          >
            <Settings2 size={16} aria-hidden />
            차트 표시 설정 {showAdvancedControls ? "접기" : "열기"}
          </button>
        </div>
      ) : null}

      {showAdvancedControls && canShowDetailedAnalysis ? (
        <div className="mt-3 rounded-lg border border-surface-line bg-surface-cardSoft p-3">
          <div className="rounded-md border border-white/10 bg-black/20 p-3">
            <p className="text-xs font-semibold text-slate-400">차트 표시 설정</p>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">
              차트 위에 표시할 보조 표시만 고릅니다. 최종 판독은 위의 구조 감지 기준을 따릅니다.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => applyOverlayPreset("all")}
                className={`min-h-9 rounded-md border px-3 text-xs font-bold transition ${
                  overlayPresetMatches(overlaySettings, "all")
                    ? "border-accent-blue bg-accent-blue text-slate-950"
                    : "border-accent-blue/30 bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20"
                }`}
              >
                전체
              </button>
              <button
                type="button"
                onClick={() => applyOverlayPreset("structure")}
                className={`min-h-9 rounded-md border px-3 text-xs font-bold transition ${
                  overlayPresetMatches(overlaySettings, "structure")
                    ? "border-accent-blue bg-accent-blue text-slate-950"
                    : "border-white/10 bg-black/20 text-slate-300 hover:border-accent-blue/40"
                }`}
              >
                구조 집중
              </button>
              <button
                type="button"
                onClick={() => applyOverlayPreset("zones")}
                className={`min-h-9 rounded-md border px-3 text-xs font-bold transition ${
                  overlayPresetMatches(overlaySettings, "zones")
                    ? "border-accent-blue bg-accent-blue text-slate-950"
                    : "border-white/10 bg-black/20 text-slate-300 hover:border-accent-blue/40"
                }`}
              >
                구간 집중
              </button>
              <button
                type="button"
                onClick={() => applyOverlayPreset("minimal")}
                className={`min-h-9 rounded-md border px-3 text-xs font-bold transition ${
                  overlayPresetMatches(overlaySettings, "minimal")
                    ? "border-accent-blue bg-accent-blue text-slate-950"
                    : "border-white/10 bg-black/20 text-slate-300 hover:border-accent-blue/40"
                }`}
              >
                미니멀
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["ema200", "EMA200"],
                ["poc", "POC"],
                ["orderBlocks", "OB / BB"],
                ["fvgs", "FVG / iFVG"],
                ["ote", "OTE / PD"],
                ["msb", "MSB"],
                ["choch", "CHoCH"],
                ["sweep", "Sweep"],
                ["cisd", "CISD"]
              ].map(([key, label]) => {
                const settingKey = key as keyof OverlaySettings;
                const enabled = overlaySettings[settingKey];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleOverlay(settingKey)}
                    className={`min-h-10 rounded-md border px-3 text-xs font-bold transition ${
                      enabled
                        ? "border-accent-blue bg-accent-blue/15 text-accent-blue"
                        : "border-surface-line bg-black/20 text-slate-400 hover:border-accent-blue/40"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4">
        <div className="overflow-hidden rounded-lg border border-surface-line bg-surface-cardSoft">
          <div className="flex items-center justify-between border-b border-surface-line px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-slate-500">현재가</p>
              <p className="text-lg font-black text-white">{analysis ? formatPrice(analysis.price) : "-"}</p>
            </div>
            {analysis ? (
              <span className={`rounded-md border px-3 py-1.5 text-sm font-black ${isMajorScreen ? "border-white/10 bg-black/20 text-slate-300" : biasClasses(analysis.bias)}`}>
                {isMajorScreen ? "판단 근거 차트" : analysis.verdict}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 border-b border-surface-line px-4 py-2 text-xs text-slate-400">
            <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1">
              {isUsingCachedData ? "최근 저장본" : "실시간 판독"}
            </span>
            <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1">
              자동 새로고침 30초
            </span>
            {analysis?.updatedAt ? (
              <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1">
                갱신 {formatUpdatedAt(analysis.updatedAt)}
              </span>
            ) : null}
          </div>
          {activeAnalysis && hasAnyOverlay ? (
            <div className="border-b border-surface-line bg-black/20 px-4 py-2 text-xs leading-5 text-slate-400">
              표시 중:{" "}
              {[
                overlaySettings.ema200 ? "EMA200" : null,
                overlaySettings.poc ? "POC" : null,
                overlaySettings.orderBlocks ? "OB/BB" : null,
                overlaySettings.fvgs ? "FVG/iFVG" : null,
                overlaySettings.ote ? "OTE/PD" : null,
                overlaySettings.msb ? "MSB" : null,
                overlaySettings.choch ? "CHoCH" : null,
                overlaySettings.sweep ? "Sweep" : null,
                overlaySettings.cisd ? "CISD" : null
              ]
                .filter(Boolean)
                .join(", ")}
            </div>
          ) : null}
          <CryptoChartPanel ref={chartRef} chartClassName={isMajorScreen ? cryptoMajorChartHeightClass : cryptoDefaultChartHeightClass}>
            {isLoading && !analysis ? <CryptoChartLoadingOverlay /> : null}
          </CryptoChartPanel>
          {activeAnalysis && !isBasicAltView && radarProfile !== "technical" ? (
            <div className="border-t border-surface-line bg-black/20 px-4 py-3">
              <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-slate-300">
                <span className="rounded-md border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-emerald-300">OB</span>
                <span className="rounded-md border border-sky-400/20 bg-sky-400/10 px-2 py-1 text-sky-300">FVG / iFVG</span>
                <span className="rounded-md border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-amber-300">POC</span>
                <span className="rounded-md border border-teal-400/20 bg-teal-400/10 px-2 py-1 text-teal-300">OTE 롱</span>
                <span className="rounded-md border border-violet-400/20 bg-violet-400/10 px-2 py-1 text-violet-300">OTE 숏</span>
                <span className="rounded-md border border-slate-400/20 bg-slate-400/10 px-2 py-1 text-slate-300">PD 50%</span>
                <span className="rounded-md border border-green-500/20 bg-green-500/10 px-2 py-1 text-green-300">MSB</span>
                <span className="rounded-md border border-rose-400/20 bg-rose-400/10 px-2 py-1 text-rose-300">CHoCH</span>
                <span className="rounded-md border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-amber-300">Sweep</span>
                <span className="rounded-md border border-orange-400/20 bg-orange-400/10 px-2 py-1 text-orange-300">CISD</span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          {error ? <CryptoErrorState message={error} /> : null}

          <div className={`rounded-lg border p-4 ${isBasicAltView ? altAnalysisFilterClass(altFilterLabel) : isMajorScreen ? "border-surface-line bg-surface-cardSoft text-slate-200" : biasClasses(analysis?.bias)}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold opacity-80">{isBasicAltView ? "알트 리스크 요약" : isMajorScreen ? "상단 판단의 근거 요약" : "레이더 판독"}</p>
                <h3 className="mt-1 text-2xl font-black">
                  {analysis ? (isBasicAltView ? altFilterLabel : isMajorScreen ? "아래 데이터는 판단 보조 근거입니다" : analysis.verdict) : "레이더 대기 중"}
                </h3>
              </div>
              <Activity size={26} aria-hidden />
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              {analysis
                ? isBasicAltView
                  ? `요약 리스크: ${altRiskSignals[0] ?? "리스크 점검"}. 세부 추적 조건과 가격 기준은 Pro에서 확인합니다.`
                  : isMajorScreen
                  ? "최종 판단, 판단 강도, 추적 조건, 무효화 기준은 상단 Radar Insight에서 확인하고, 이 영역은 그 판단을 만든 구조·기술 근거만 확인합니다."
                  : `종합 점수 ${analysis.biasScore}${combinedScoreLimit ? ` / -${combinedScoreLimit}~+${combinedScoreLimit}` : ""}. ${analysis.summaryLine}`
                : "캔들 데이터를 불러오고 있습니다."}
            </p>
            {analysis ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className={`rounded-md border px-3 py-3 ${readinessClasses(analysis.readiness)}`}>
                  <span className="block text-xs font-semibold opacity-80">데이터 신뢰도</span>
                  <span className="mt-1 block text-lg font-black">{readinessLabel(analysis.readiness)}</span>
                </div>
                {isMajorScreen ? (
                  <div className="rounded-md border border-white/10 bg-black/15 p-3 text-sm leading-6 text-slate-100">
                    <span className="block text-xs font-semibold text-slate-400">{hasCoinPro ? "근거 상세 범위" : "Basic 공개 범위"}</span>
                    <span className="mt-1 block">
                      {hasCoinPro
                        ? "Pro에서는 아래에서 구조 근거, 기술 근거, 리스크 점검을 이어서 확인합니다."
                        : "Basic에서는 방향 요약만 제공합니다. 상세 조건, 무효화 기준, 세부 리스크는 Pro에서 확인할 수 있습니다."}
                    </span>
                  </div>
                ) : isBasicAltView ? (
                  <div className="rounded-md border border-white/10 bg-black/15 p-3 text-sm leading-6 text-slate-100">
                    <span className="block text-xs font-semibold text-slate-400">공개 리스크</span>
                    <span className="mt-1 block">{altRiskSignals[0] ?? "리스크 점검"}</span>
                  </div>
                ) : (
                  <div className="rounded-md border border-white/10 bg-black/15 p-3 text-sm leading-6 text-slate-100">
                    <span className="block text-xs font-semibold text-slate-400">행동 가이드</span>
                    <span className="mt-1 block">{analysis.actionGuide}</span>
                  </div>
                )}
              </div>
            ) : null}
            {analysis && canShowDetailedAnalysis ? (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={saveAnalysisToJournal}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-white/10 bg-black/20 px-3 text-sm font-bold text-slate-200 hover:border-accent-blue/60 hover:text-white"
                >
                  <History size={16} aria-hidden />
                  레이더 저장
                </button>
              </div>
            ) : null}
            {savedMessage ? (
              <p className="mt-3 rounded-md border border-signal-success/25 bg-signal-success/10 px-3 py-2 text-sm text-signal-success">
                {savedMessage}
              </p>
            ) : null}
            {analysis && isBasicAltView ? (
              <div className="mt-3 rounded-md border border-cyan-300/25 bg-cyan-300/10 px-3 py-3">
                <p className="text-xs font-black text-cyan-100">Coin Pro 상세 판단 보조</p>
                <p className="mt-1 text-sm leading-6 text-slate-300 [word-break:keep-all]">
                  Basic에서는 방향 요약만 제공합니다. 무효화 기준, 구체 가격 레벨, AI 브리핑, 세부 리스크는 Coin Pro에서 확인할 수 있습니다.
                </p>
              </div>
            ) : null}
          </div>

          {analysis && activeAnalysis && !isBasicAltView ? (
            <LiquidationPressurePanel symbol={symbol} timeframe={activeTimeframe} />
          ) : null}

          {analysis && activeAnalysis && ((isMajorScreen && !hasCoinPro) || isBasicAltView) ? (
            <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-4">
              <p className="text-xs font-black text-cyan-100">Pro 판단 보조</p>
              <h3 className="mt-1 text-lg font-black text-white">
                {isBasicAltView ? "AI 알트 브리핑은 Coin Pro에서 상세 근거로 열립니다." : "AI 레이더 브리핑은 Pro에서 상세 근거로 열립니다."}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-300 [word-break:keep-all]">
                {isBasicAltView
                  ? "Basic에서는 방향 요약만 제공합니다. 구체 조건, 가격 레벨, 무효화 기준이 포함될 수 있는 AI 상세 브리핑은 Coin Pro에서 확인할 수 있습니다."
                  : "Basic에서는 방향 요약만 제공합니다. 구체 조건, 가격 레벨, 무효화 기준이 포함될 수 있는 AI 상세 브리핑은 Pro에서 확인할 수 있습니다."}
              </p>
            </div>
          ) : analysis && activeAnalysis ? (
            <div id="ai-briefing" className="scroll-mt-24 rounded-lg border border-accent-blue/25 bg-surface-cardSoft p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-accent-blue">AI 레이더 브리핑</p>
                  <h3 className="mt-1 text-lg font-black text-white">
                    {isMajorScreen ? "상단 판단의 근거를 문장으로 풀어봅니다." : "감지된 구조 전체를 AI가 종합해서 정리합니다."}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {isMajorScreen
                      ? "이 브리핑은 최종 판단을 다시 내리는 영역이 아니라, 구조와 기술 근거를 읽기 쉽게 정리하는 보조 설명입니다."
                      : radarProfile === "technical"
                      ? "선택 코인의 추세, 모멘텀, 변동성, 거래량 지표를 중심으로 시장 해석을 정리합니다."
                      : radarProfile === "ict"
                        ? "선택 코인의 MSB, CHoCH, OB, FVG, Sweep, CISD, PD, POC만 중심으로 시장 해석을 정리합니다."
                        : "선택 코인의 ICT 구조와 기술지표를 함께 읽어 시장 해석을 정리합니다."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadMarketBriefing}
                  disabled={marketBriefing.status === "loading"}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-accent-blue px-4 text-sm font-extrabold text-slate-950 hover:bg-sky-300 disabled:cursor-wait disabled:opacity-70"
                >
                  <Bot size={16} aria-hidden />
                  {marketBriefing.status === "loading" ? "레이더 분석 중" : marketBriefing.status === "ready" ? "다시 돌리기" : "레이더 브리핑 생성"}
                </button>
              </div>

              {marketBriefing.status === "loading" ? (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-sm">
                  <div className="w-full max-w-sm rounded-2xl border border-accent-blue/25 bg-slate-950/95 p-6 text-center shadow-[0_0_90px_rgba(56,189,248,0.22)]">
                    <div className="radar-mark-lg mx-auto h-36 w-36 border border-accent-blue/30" />
                    <p className="mt-5 text-base font-black text-white">AI 레이더 스캔 중</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {radarProfile === "technical"
                        ? "추세, 모멘텀, 변동성, 거래량 지표를 한 번에 훑고 있습니다."
                        : radarProfile === "ict"
                          ? "MSB, CHoCH, OB, FVG, Sweep, CISD, PD, POC를 한 번에 훑고 있습니다."
                          : "ICT 구조와 기술지표를 한 번에 훑고 있습니다."}
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-4">
                {marketBriefing.status === "idle" ? (
                  <p className="text-sm leading-6 text-slate-400">
                    버튼을 누르면 현재 차트와 레이더 값을 한 번에 읽어 핵심 방향, 위험 요인, 다음 확인 구간을 정리합니다.
                  </p>
                ) : null}
                {marketBriefing.status === "ready" ? (
                  <>
                    {!isMajorScreen ? (
                      <div className="mb-4 grid gap-2 sm:grid-cols-3">
                        <div className={`rounded-md border px-3 py-2 ${biasClasses(analysis.bias)}`}>
                          <p className="text-[11px] font-bold opacity-80">방향 결론</p>
                          <p className="mt-1 text-base font-black">
                            {analysis.bias === "long" ? "롱 우세" : analysis.bias === "short" ? "숏 우세" : "횡보 관찰"}
                          </p>
                        </div>
                        <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2">
                          <p className="text-[11px] font-bold text-slate-400">종합 점수</p>
                          <p className="mt-1 text-base font-black text-white">
                            {analysis.biasScore}
                            {combinedScoreLimit ? ` / -${combinedScoreLimit}~+${combinedScoreLimit}` : ""}
                          </p>
                        </div>
                        <div className={`rounded-md border px-3 py-2 ${readinessClasses(analysis.readiness)}`}>
                          <p className="text-[11px] font-bold opacity-80">데이터 신뢰도</p>
                          <p className="mt-1 text-base font-black">{readinessLabel(analysis.readiness)}</p>
                        </div>
                      </div>
                    ) : null}
                    <HighlightedBriefing text={marketBriefing.text} />
                    {marketBriefing.cached ? (
                      <p className="mt-3 text-xs text-slate-500">방금 전 생성한 브리핑을 다시 불러왔습니다.</p>
                    ) : null}
                  </>
                ) : null}
                {marketBriefing.status === "error" ? (
                  <p className="text-sm leading-6 text-signal-danger">{marketBriefing.message}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {analysis && activeAnalysis && activeAnalysis.condition && !isBasicAltView && radarProfile === "ict" ? (
            <div id="ict-radar" className="scroll-mt-24 rounded-lg border border-surface-line bg-surface-cardSoft p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-accent-blue">ICT 구조 기준</p>
                  <h3 className="mt-1 text-lg font-black text-white">구조 레이더</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    이 화면은 기술지표를 섞지 않고 MSB, CHoCH, OB, FVG, Sweep, CISD, PD, POC만 따로 봅니다.
                  </p>
                </div>
                <span className="inline-flex w-fit rounded-md border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-bold text-slate-300">
                  {activeTimeframe} 기준
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <SignalMetric label="MSB" value={stateLabel(activeAnalysis.msb)} direction={activeAnalysis.msb} />
                <SignalMetric
                  label="BOS"
                  value={activeAnalysis.latestMsbEvent ? `${eventDirectionLabel(activeAnalysis.latestMsbEvent.direction)} · ${barsAgoLabel(Math.max(0, candles.length - 1 - activeAnalysis.latestMsbEvent.index), activeTimeframe)}` : "없음"}
                  direction={activeAnalysis.latestMsbEvent?.direction}
                />
                <SignalMetric label="CHoCH" value={stateLabel(activeAnalysis.choch)} direction={activeAnalysis.choch} />
                <SignalMetric
                  label="OB"
                  value={activeAnalysis.latestOb ? stateLabel(activeAnalysis.latestOb.direction) : "없음"}
                  direction={activeAnalysis.latestOb?.direction}
                  isActive={activeAnalysis.inOb}
                />
                <SignalMetric
                  label="FVG"
                  value={activeAnalysis.latestFvg ? `${stateLabel(activeAnalysis.latestFvg.direction)} ${activeAnalysis.latestFvg.state === "ifvg" ? "iFVG" : "FVG"}` : "없음"}
                  direction={activeAnalysis.latestFvg?.direction}
                  isActive={activeAnalysis.inFvg}
                />
                <SignalMetric
                  label="Sweep"
                  value={activeAnalysis.latestSweep ? `${eventDirectionLabel(activeAnalysis.latestSweep.direction)} · ${barsAgoLabel(activeAnalysis.latestSweep.age, activeTimeframe)}` : "없음"}
                  direction={activeAnalysis.latestSweep?.direction}
                />
                <SignalMetric
                  label="CISD"
                  value={activeAnalysis.latestCisd ? `${eventDirectionLabel(activeAnalysis.latestCisd.direction)} · ${barsAgoLabel(activeAnalysis.latestCisd.age, activeTimeframe)}` : "없음"}
                  direction={activeAnalysis.latestCisd?.direction}
                />
                <SignalMetric
                  label="Displacement"
                  value={activeAnalysis.latestDisplacement ? `${eventDirectionLabel(activeAnalysis.latestDisplacement.direction)} · ${activeAnalysis.latestDisplacement.strength}점` : "없음"}
                  direction={activeAnalysis.latestDisplacement?.direction}
                />
                <SignalMetric
                  label="Liquidity"
                  value={
                    activeAnalysis.buySideLiquidity || activeAnalysis.sellSideLiquidity
                      ? `${activeAnalysis.buySideLiquidity ? "상단" : ""}${activeAnalysis.buySideLiquidity && activeAnalysis.sellSideLiquidity ? " / " : ""}${activeAnalysis.sellSideLiquidity ? "하단" : ""}`
                      : "없음"
                  }
                  direction="neutral"
                />
                <SignalMetric label="Dealing Range" value={stateLabel(activeDealingRange.position)} direction="neutral" />
                <SignalMetric label="PD" value={stateLabel(activeAnalysis.premiumDiscount)} direction="neutral" />
                <SignalMetric
                  label="POC"
                  value={activeAnalysis.volumeProfile ? `${stateLabel(activeAnalysis.volumeProfile.position)} · ${Math.abs(activeAnalysis.volumeProfile.distancePercent).toFixed(2)}%` : "없음"}
                  direction="neutral"
                />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <h4 className="text-base font-black text-white">핵심 해석</h4>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{analysis.summaryLine}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <h4 className="text-base font-black text-white">구조 감지 기준</h4>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    현재는 {structureSensitivityLabel(structureSensitivity)} 기준입니다. 빠른 변화와 큰 구조 중 무엇을 더 중요하게 볼지 정합니다.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {analysis && !isBasicAltView && radarProfile === "technical" ? <TechnicalRadarPanel candles={candles} timeframe={activeTimeframe} /> : null}

          {analysis && activeAnalysis && activeAnalysis.condition && !isBasicAltView && radarProfile === "combined" ? (
            <div id="radar-dashboard" className="scroll-mt-24 rounded-lg border border-surface-line bg-surface-cardSoft p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-accent-blue">판독 체계</p>
                  <h3 className="mt-1 text-lg font-black text-white">구조와 지표를 함께 확인합니다.</h3>
                </div>
                <span className="inline-flex w-fit rounded-md border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-bold text-slate-300">
                  {activeTimeframe} 기준
                </span>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-accent-blue/20 bg-black/20 p-4">
                  <p className="text-xs font-bold text-accent-blue">상단 판단의 구조 근거</p>
                  <h4 className="mt-1 text-base font-black text-white">ICT 구조 근거</h4>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <SignalMetric label="MSB" value={stateLabel(activeAnalysis.msb)} direction={activeAnalysis.msb} />
                    <SignalMetric
                      label="BOS"
                      value={activeAnalysis.latestMsbEvent ? `${eventDirectionLabel(activeAnalysis.latestMsbEvent.direction)} · ${barsAgoLabel(Math.max(0, candles.length - 1 - activeAnalysis.latestMsbEvent.index), activeTimeframe)}` : "없음"}
                      direction={activeAnalysis.latestMsbEvent?.direction}
                    />
                    <SignalMetric label="CHoCH" value={stateLabel(activeAnalysis.choch)} direction={activeAnalysis.choch} />
                    <SignalMetric
                      label="OB"
                      value={activeAnalysis.latestOb ? stateLabel(activeAnalysis.latestOb.direction) : "없음"}
                      direction={activeAnalysis.latestOb?.direction}
                      isActive={activeAnalysis.inOb}
                    />
                    <SignalMetric
                      label="FVG"
                      value={activeAnalysis.latestFvg ? `${stateLabel(activeAnalysis.latestFvg.direction)} ${activeAnalysis.latestFvg.state === "ifvg" ? "iFVG" : "FVG"}` : "없음"}
                      direction={activeAnalysis.latestFvg?.direction}
                      isActive={activeAnalysis.inFvg}
                    />
                    <SignalMetric
                      label="Sweep"
                      value={activeAnalysis.latestSweep ? `${eventDirectionLabel(activeAnalysis.latestSweep.direction)} · ${barsAgoLabel(activeAnalysis.latestSweep.age, activeTimeframe)}` : "없음"}
                      direction={activeAnalysis.latestSweep?.direction}
                    />
                    <SignalMetric
                      label="CISD"
                      value={activeAnalysis.latestCisd ? `${eventDirectionLabel(activeAnalysis.latestCisd.direction)} · ${barsAgoLabel(activeAnalysis.latestCisd.age, activeTimeframe)}` : "없음"}
                      direction={activeAnalysis.latestCisd?.direction}
                    />
                    <SignalMetric
                      label="Displacement"
                      value={activeAnalysis.latestDisplacement ? `${eventDirectionLabel(activeAnalysis.latestDisplacement.direction)} · ${activeAnalysis.latestDisplacement.strength}점` : "없음"}
                      direction={activeAnalysis.latestDisplacement?.direction}
                    />
                    <SignalMetric
                      label="Liquidity"
                      value={
                        activeAnalysis.buySideLiquidity || activeAnalysis.sellSideLiquidity
                          ? `${activeAnalysis.buySideLiquidity ? "상단" : ""}${activeAnalysis.buySideLiquidity && activeAnalysis.sellSideLiquidity ? " / " : ""}${activeAnalysis.sellSideLiquidity ? "하단" : ""}`
                          : "없음"
                      }
                      direction="neutral"
                    />
                    <SignalMetric label="Dealing Range" value={stateLabel(activeDealingRange.position)} direction="neutral" />
                    <SignalMetric label="PD" value={stateLabel(activeAnalysis.premiumDiscount)} direction="neutral" />
                    <SignalMetric
                      label="POC"
                      value={activeAnalysis.volumeProfile ? `${stateLabel(activeAnalysis.volumeProfile.position)} · ${Math.abs(activeAnalysis.volumeProfile.distancePercent).toFixed(2)}%` : "없음"}
                      direction="neutral"
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <p className="text-xs font-bold text-slate-400">추세 환경 지표</p>
                  <h4 className="mt-1 text-base font-black text-white">기술지표 참고값</h4>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className={`rounded-md border p-3 sm:col-span-2 ${conditionTone(activeAnalysis.condition.regime)}`}>
                      <p className="text-xs font-semibold opacity-80">시장 국면</p>
                      <p className="mt-1 text-sm font-black">
                        {conditionLabel(activeAnalysis.condition.regime)} · {formatIndicatorValue(activeAnalysis.condition.regimeScore, 2)}
                      </p>
                    </div>
                    <div className={`rounded-md border p-3 ${conditionTone(activeAnalysis.condition.dmiState)}`}>
                      <p className="text-xs font-semibold opacity-80">DMI / ADX</p>
                      <p className="mt-1 text-sm font-black">
                        {formatIndicatorValue(activeAnalysis.condition.adx14, 1)} · {conditionLabel(activeAnalysis.condition.dmiState)}
                      </p>
                    </div>
                    <div className={`rounded-md border p-3 ${conditionTone(activeAnalysis.condition.supertrendDirection)}`}>
                      <p className="text-xs font-semibold opacity-80">Supertrend</p>
                      <p className="mt-1 text-sm font-black">{conditionLabel(activeAnalysis.condition.supertrendDirection)}</p>
                    </div>
                    <div className={`rounded-md border p-3 ${conditionTone(activeAnalysis.condition.donchianPosition)}`}>
                      <p className="text-xs font-semibold opacity-80">Donchian 20</p>
                      <p className="mt-1 text-sm font-black">{conditionLabel(activeAnalysis.condition.donchianPosition)}</p>
                    </div>
                    <div className={`rounded-md border p-3 ${conditionTone(activeAnalysis.condition.keltnerPosition)}`}>
                      <p className="text-xs font-semibold opacity-80">Keltner</p>
                      <p className="mt-1 text-sm font-black">{conditionLabel(activeAnalysis.condition.keltnerPosition)}</p>
                    </div>
                    <div className={`rounded-md border p-3 ${conditionTone(activeAnalysis.condition.emaStack)}`}>
                      <p className="text-xs font-semibold opacity-80">EMA 배열</p>
                      <p className="mt-1 text-sm font-black">
                        {conditionLabel(activeAnalysis.condition.emaStack)} · {conditionLabel(activeAnalysis.condition.emaSlope)}
                      </p>
                    </div>
                    <div className={`rounded-md border p-3 ${conditionTone(activeAnalysis.condition.rsiState)}`}>
                      <p className="text-xs font-semibold opacity-80">RSI 14</p>
                      <p className="mt-1 text-sm font-black">
                        {formatIndicatorValue(activeAnalysis.condition.rsi14, 1)} · {conditionLabel(activeAnalysis.condition.rsiState)}
                      </p>
                    </div>
                    <div className={`rounded-md border p-3 ${conditionTone(activeAnalysis.condition.macdState)}`}>
                      <p className="text-xs font-semibold opacity-80">MACD</p>
                      <p className="mt-1 text-sm font-black">{conditionLabel(activeAnalysis.condition.macdState)}</p>
                    </div>
                    <div className={`rounded-md border p-3 ${conditionTone(activeAnalysis.condition.volatilityState)}`}>
                      <p className="text-xs font-semibold opacity-80">ATR 변동성</p>
                      <p className="mt-1 text-sm font-black">
                        {formatIndicatorValue(activeAnalysis.condition.atrPercent, 2, "%")} · {conditionLabel(activeAnalysis.condition.volatilityState)}
                      </p>
                    </div>
                    <div className={`rounded-md border p-3 ${conditionTone(activeAnalysis.condition.volumeState)}`}>
                      <p className="text-xs font-semibold opacity-80">거래량</p>
                      <p className="mt-1 text-sm font-black">
                        {formatIndicatorValue(activeAnalysis.condition.volumeRatio, 2, "x")} · {conditionLabel(activeAnalysis.condition.volumeState)}
                      </p>
                    </div>
                    <div className={`rounded-md border p-3 sm:col-span-2 ${conditionTone(activeAnalysis.condition.bollingerPosition)}`}>
                      <p className="text-xs font-semibold opacity-80">볼린저 위치</p>
                      <p className="mt-1 text-sm font-black">
                        {conditionLabel(activeAnalysis.condition.bollingerPosition)} · 폭 {formatIndicatorValue(activeAnalysis.condition.bollingerWidthPercentile, 1, "%")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          ) : null}

          {analysis && canShowDetailedAnalysis && radarProfile !== "technical" ? (
            <div className="rounded-lg border border-surface-line bg-surface-cardSoft p-4">
              <h3 className="text-sm font-bold text-white">지금 볼 구간</h3>
              <div className="mt-3 space-y-2">
                {analysis.checkpoints.map((item) => (
                  <p key={item} className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm leading-6 text-slate-200">
                    {item}
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          {analysis && canShowDetailedAnalysis && radarProfile !== "technical" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-surface-line bg-surface-cardSoft p-4">
                <h3 className="text-sm font-bold text-white">현재 위치 판단</h3>
                <p className="mt-3 rounded-md border border-white/10 bg-black/20 px-3 py-3 text-sm font-semibold text-slate-100">
                  {analysis.currentLocationLabel}
                </p>
              </div>
              <div className="rounded-lg border border-surface-line bg-surface-cardSoft p-4">
                <h3 className="text-sm font-bold text-white">현재 결론</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  지금은 {analysis.verdict} 쪽입니다. 다만 실제 판단은 현재 위치, 무효 기준, 포지션 크기를 같이 확인해야 합니다.
                </p>
              </div>
            </div>
          ) : null}

          {analysis?.proPlan && canShowDetailedAnalysis && radarProfile !== "technical" ? (
            <div className="rounded-lg border border-accent-blue/30 bg-accent-blue/10 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold text-accent-blue">분석 시나리오</p>
                  <h3 className="mt-1 text-lg font-black text-white">{analysis.proPlan.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{analysis.proPlan.reason}</p>
                  <p className="mt-2 rounded-md border border-signal-warning/25 bg-signal-warning/10 px-3 py-2 text-xs leading-5 text-signal-warning">
                    아래 가격대는 구조 확인용 기준입니다. 실제 판단 전에는 손절폭과 포지션 크기를 함께 계산하세요.
                  </p>
                </div>
                <span className={`inline-flex shrink-0 rounded-md border px-3 py-1.5 text-sm font-black ${planQualityClasses(analysis.proPlan.quality)}`}>
                  {analysis.proPlan.quality}급 · 신뢰도 {analysis.proPlan.confidence}%
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <MiniMetric label="관찰 구간" value={formatPriceRange(analysis.proPlan.entryLow, analysis.proPlan.entryHigh)} />
                <MiniMetric label="무효 기준" value={formatPrice(analysis.proPlan.invalidation)} />
                <MiniMetric label="다음 레벨 1" value={`${formatPrice(analysis.proPlan.target1)} / ${analysis.proPlan.rr1.toFixed(1)}R`} />
                <MiniMetric label="다음 레벨 2" value={`${formatPrice(analysis.proPlan.target2)} / ${analysis.proPlan.rr2.toFixed(1)}R`} />
              </div>
              <div className="mt-3 space-y-2">
                {analysis.proPlan.cautions.slice(0, 3).map((item) => (
                  <p key={item} className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs leading-5 text-slate-300">
                    {item}
                  </p>
                ))}
              </div>
            </div>
          ) : analysis && canShowDetailedAnalysis && radarProfile !== "technical" ? (
            <div className="rounded-lg border border-signal-warning/25 bg-signal-warning/10 p-4">
              <p className="text-sm font-bold text-signal-warning">분석 시나리오 대기</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                지금은 방향 우세가 충분히 또렷하지 않아 관찰 구간과 무효 기준을 계산하지 않았습니다. 이 상태에서 억지로 자리를 만들지 않는 것이 더 좋은 판독입니다.
              </p>
            </div>
          ) : null}

          {analysis && isMajorScreen && !hasCoinPro ? (
            <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-4">
              <p className="text-sm font-bold text-cyan-100">Pro 상세 판단 보조</p>
              <p className="mt-2 text-sm leading-6 text-slate-300 [word-break:keep-all]">
                Basic에서는 방향 요약만 제공합니다. 구체적인 롱/숏 추적 조건, 무효화 기준, 관찰 구간, 다음 레벨, 세부 리스크는 Pro에서 확인할 수 있습니다.
                이 정보는 투자 권유가 아니라 판단 보조용입니다.
              </p>
            </div>
          ) : null}

          {analysis && canShowDetailedAnalysis && radarProfile !== "technical" ? (
            <button
              type="button"
              onClick={() => setShowDetailedReadout((value) => !value)}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-surface-line bg-black/20 px-3 text-sm font-bold text-slate-200 hover:border-accent-blue/60 hover:text-white"
            >
              상세 판독 {showDetailedReadout ? "접기" : "펼치기"}
            </button>
          ) : null}

          {showDetailedReadout && canShowDetailedAnalysis && radarProfile !== "technical" ? (
            <>
          {analysis ? (
            <div className="rounded-lg border border-surface-line bg-surface-cardSoft p-4">
              <h3 className="text-sm font-bold text-white">타임프레임 구조</h3>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {analysis.timeframeAnalyses.map((item) => (
                  <div key={item.timeframe} className="rounded-md border border-surface-line bg-black/20 px-3 py-2 text-center">
                    <p className="text-[11px] font-semibold text-slate-400">{item.timeframe}</p>
                    <div className="mt-2 space-y-2">
                      <div className={`rounded-md border px-2 py-1 text-xs font-bold ${directionBadge(item.msb)}`}>
                        MSB {stateLabel(item.msb)}
                      </div>
                      <div className={`rounded-md border px-2 py-1 text-xs font-bold ${directionBadge(item.choch)}`}>
                        CHoCH {stateLabel(item.choch)}
                      </div>
                      <div className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-[11px] font-semibold text-slate-300">
                        점수 {item.score} / -{timeframeScoreLimit}~+{timeframeScoreLimit}
                      </div>
                      <p className="text-[11px] leading-5 text-slate-500">{timeframeSignalSummary(item)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {activeAnalysis ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-surface-line bg-surface-cardSoft p-4">
                <h3 className="text-sm font-bold text-white">현재 TF 이벤트</h3>
                <div className="mt-3 space-y-2">
                  {activeAnalysis.latestMsbEvent ? (
                    <p className="rounded-md border border-emerald-500/20 bg-black/20 px-3 py-2 text-sm leading-6 text-slate-200">
                      MSB {eventDirectionLabel(activeAnalysis.latestMsbEvent.direction)} / {barsAgoLabel(Math.max(0, candles.length - 1 - activeAnalysis.latestMsbEvent.index), activeTimeframe)} / {formatPrice(activeAnalysis.latestMsbEvent.level)}
                    </p>
                  ) : null}
                  {activeAnalysis.latestChochEvent ? (
                    <p className="rounded-md border border-rose-500/20 bg-black/20 px-3 py-2 text-sm leading-6 text-slate-200">
                      CHoCH {eventDirectionLabel(activeAnalysis.latestChochEvent.direction)} / {barsAgoLabel(Math.max(0, candles.length - 1 - activeAnalysis.latestChochEvent.index), activeTimeframe)} / {formatPrice(activeAnalysis.latestChochEvent.level)}
                    </p>
                  ) : null}
                  {activeAnalysis.latestSweep ? (
                    <p className="rounded-md border border-amber-500/20 bg-black/20 px-3 py-2 text-sm leading-6 text-slate-200">
                      Sweep {eventDirectionLabel(activeAnalysis.latestSweep.direction)} / {barsAgoLabel(activeAnalysis.latestSweep.age, activeTimeframe)} / {formatPrice(activeAnalysis.latestSweep.level)}
                    </p>
                  ) : null}
                  {activeAnalysis.latestCisd ? (
                    <p className="rounded-md border border-orange-500/20 bg-black/20 px-3 py-2 text-sm leading-6 text-slate-200">
                      CISD {eventDirectionLabel(activeAnalysis.latestCisd.direction)} / {barsAgoLabel(activeAnalysis.latestCisd.age, activeTimeframe)} / {formatPrice(activeAnalysis.latestCisd.level)}
                    </p>
                  ) : null}
                  {activeAnalysis.latestDisplacement ? (
                    <p className={`rounded-md border px-3 py-2 text-sm leading-6 ${directionBadge(activeAnalysis.latestDisplacement.direction)}`}>
                      Displacement {eventDirectionLabel(activeAnalysis.latestDisplacement.direction)} / {barsAgoLabel(activeAnalysis.latestDisplacement.age, activeTimeframe)} / 강도 {activeAnalysis.latestDisplacement.strength}점
                    </p>
                  ) : null}
                  {!activeAnalysis.latestMsbEvent &&
                  !activeAnalysis.latestChochEvent &&
                  !activeAnalysis.latestSweep &&
                  !activeAnalysis.latestCisd &&
                  !activeAnalysis.latestDisplacement ? (
                    <p className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm leading-6 text-slate-400">
                      최근 이벤트가 충분히 누적되지 않았습니다.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-lg border border-surface-line bg-surface-cardSoft p-4">
                <h3 className="text-sm font-bold text-white">현재 TF 주요 구간</h3>
                <div className="mt-3 space-y-2">
                  {activeAnalysis.latestOb ? (
                    <p className={`rounded-md border px-3 py-2 text-sm leading-6 ${directionBadge(activeAnalysis.latestOb.direction)}`}>
                      OB {eventDirectionLabel(activeAnalysis.latestOb.direction)} / {formatPriceRange(activeAnalysis.latestOb.bottom, activeAnalysis.latestOb.top)}
                    </p>
                  ) : null}
                  {activeAnalysis.latestBb ? (
                    <p className="rounded-md border border-violet-500/20 bg-black/20 px-3 py-2 text-sm leading-6 text-slate-200">
                      BB {eventDirectionLabel(activeAnalysis.latestBb.direction)} / {formatPriceRange(activeAnalysis.latestBb.bottom, activeAnalysis.latestBb.top)}
                    </p>
                  ) : null}
                  {activeAnalysis.latestFvg ? (
                    <p className={`rounded-md border px-3 py-2 text-sm leading-6 ${directionBadge(activeAnalysis.latestFvg.direction)}`}>
                      {activeAnalysis.latestFvg.state === "ifvg" ? "iFVG" : "FVG"} {eventDirectionLabel(activeAnalysis.latestFvg.direction)} / {formatPriceRange(activeAnalysis.latestFvg.bottom, activeAnalysis.latestFvg.top)}
                    </p>
                  ) : null}
                  {activeAnalysis.volumeProfile ? (
                    <p className="rounded-md border border-amber-500/20 bg-black/20 px-3 py-2 text-sm leading-6 text-slate-200">
                      POC {stateLabel(activeAnalysis.volumeProfile.position)} / {formatPrice(activeAnalysis.volumeProfile.poc)} · VA{" "}
                      {formatPriceRange(activeAnalysis.volumeProfile.val, activeAnalysis.volumeProfile.vah)}
                    </p>
                  ) : null}
                  {activeAnalysis.buySideLiquidity ? (
                    <p className="rounded-md border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-sm leading-6 text-sky-200">
                      Buy-side liquidity / {formatPrice(activeAnalysis.buySideLiquidity.level)} / {barsAgoLabel(activeAnalysis.buySideLiquidity.age, activeTimeframe)}
                    </p>
                  ) : null}
                  {activeAnalysis.sellSideLiquidity ? (
                    <p className="rounded-md border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-sm leading-6 text-sky-200">
                      Sell-side liquidity / {formatPrice(activeAnalysis.sellSideLiquidity.level)} / {barsAgoLabel(activeAnalysis.sellSideLiquidity.age, activeTimeframe)}
                    </p>
                  ) : null}
                  {activeDealingRange.equilibrium ? (
                    <p className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm leading-6 text-slate-200">
                      Dealing range / {stateLabel(activeDealingRange.position)} / EQ {formatPrice(activeDealingRange.equilibrium)}
                    </p>
                  ) : null}
                  {activeAnalysis.oteLevels ? (
                    <>
                      <p className="rounded-md border border-teal-500/20 bg-black/20 px-3 py-2 text-sm leading-6 text-slate-200">
                        OTE 롱 / {formatPriceRange(activeAnalysis.oteLevels.longLow, activeAnalysis.oteLevels.longHigh)}
                      </p>
                      <p className="rounded-md border border-purple-500/20 bg-black/20 px-3 py-2 text-sm leading-6 text-slate-200">
                        OTE 숏 / {formatPriceRange(activeAnalysis.oteLevels.shortLow, activeAnalysis.oteLevels.shortHigh)}
                      </p>
                    </>
                  ) : null}
                  {!activeAnalysis.latestOb &&
                  !activeAnalysis.latestBb &&
                  !activeAnalysis.latestFvg &&
                  !activeAnalysis.volumeProfile &&
                  !activeAnalysis.oteLevels &&
                  !activeAnalysis.buySideLiquidity &&
                  !activeAnalysis.sellSideLiquidity &&
                  !activeDealingRange.equilibrium ? (
                    <p className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm leading-6 text-slate-400">
                      아직 표시할 주요 구간이 부족합니다.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {analysis ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-surface-line bg-surface-cardSoft p-4">
                <h3 className="text-sm font-bold text-white">{analysis.longScenario.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">{analysis.longScenario.summary}</p>
                <div className="mt-3 space-y-2">
                  {analysis.longScenario.blockers.length > 0 ? (
                    analysis.longScenario.blockers.map((item) => (
                      <p
                        key={item}
                        className="rounded-md border border-signal-warning/20 bg-black/20 px-3 py-2 text-sm leading-6 text-slate-300"
                      >
                        {item}
                      </p>
                    ))
                  ) : (
                    <p className="rounded-md border border-signal-success/20 bg-black/20 px-3 py-2 text-sm leading-6 text-slate-300">
                      현재 기준으로 눈에 띄는 롱 반대 요소는 크지 않습니다.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-surface-line bg-surface-cardSoft p-4">
                <h3 className="text-sm font-bold text-white">{analysis.shortScenario.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">{analysis.shortScenario.summary}</p>
                <div className="mt-3 space-y-2">
                  {analysis.shortScenario.blockers.length > 0 ? (
                    analysis.shortScenario.blockers.map((item) => (
                      <p
                        key={item}
                        className="rounded-md border border-signal-warning/20 bg-black/20 px-3 py-2 text-sm leading-6 text-slate-300"
                      >
                        {item}
                      </p>
                    ))
                  ) : (
                    <p className="rounded-md border border-signal-success/20 bg-black/20 px-3 py-2 text-sm leading-6 text-slate-300">
                      현재 기준으로 눈에 띄는 숏 반대 요소는 크지 않습니다.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {analysis ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-emerald-500/20 bg-surface-cardSoft p-4">
                <h3 className="text-sm font-bold text-emerald-300">추적 후보</h3>
                <div className="mt-3 space-y-2">
                  {analysis.opportunityFlags.length > 0 ? (
                    analysis.opportunityFlags.map((item) => (
                      <p
                        key={item}
                        className="rounded-md border border-emerald-500/15 bg-emerald-500/5 px-3 py-2 text-sm leading-6 text-slate-200"
                      >
                        {item}
                      </p>
                    ))
                  ) : (
                    <p className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm leading-6 text-slate-300">
                      아직 강한 우세 신호가 겹쳐 보이지 않습니다. 구조 정렬과 구간 반응을 더 확인하세요.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-amber-500/20 bg-surface-cardSoft p-4">
                <h3 className="text-sm font-bold text-amber-300">위험 신호</h3>
                <div className="mt-3 space-y-2">
                  {analysis.riskFlags.length > 0 ? (
                    analysis.riskFlags.map((item) => (
                      <p
                        key={item}
                        className="rounded-md border border-amber-500/15 bg-amber-500/5 px-3 py-2 text-sm leading-6 text-slate-200"
                      >
                        {item}
                      </p>
                    ))
                  ) : (
                    <p className="rounded-md border border-signal-success/20 bg-black/20 px-3 py-2 text-sm leading-6 text-slate-300">
                      눈에 띄는 역행 신호는 많지 않습니다. 그래도 추격 여부와 손절 기준은 별도로 체크하세요.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {activeAnalysis ? (
            <div className="grid grid-cols-2 gap-3">
              <MiniMetric label="상위 구조" value={alignmentSummary?.higher ?? "-"} />
              <MiniMetric label="단기 구조" value={alignmentSummary?.fast ?? "-"} />
              <MiniMetric label="현재 TF MSB" value={stateLabel(activeAnalysis.msb)} />
              <MiniMetric label="현재 TF CHoCH" value={stateLabel(activeAnalysis.choch)} />
              <MiniMetric label="EMA200 위치" value={stateLabel(activeAnalysis.ema200Side)} />
              <MiniMetric
                label="POC 위치"
                value={
                  activeAnalysis.volumeProfile
                    ? `${stateLabel(activeAnalysis.volumeProfile.position)} / ${Math.abs(activeAnalysis.volumeProfile.distancePercent).toFixed(2)}%`
                    : "없음"
                }
              />
              <MiniMetric
                label="최근 OB"
                value={
                  activeAnalysis.latestOb
                    ? `${activeAnalysis.latestOb.direction === "bullish" ? "상승" : "하락"} / ${activeAnalysis.inOb ? "내부" : "외부"}`
                    : "없음"
                }
              />
              <MiniMetric
                label="최근 BB 후보"
                value={
                  activeAnalysis.latestBb
                    ? `${activeAnalysis.latestBb.direction === "bullish" ? "상승" : "하락"} / ${activeAnalysis.inBb ? "내부" : "외부"}`
                    : "없음"
                }
              />
              <MiniMetric
                label="최근 FVG"
                value={
                  activeAnalysis.latestFvg
                    ? `${activeAnalysis.latestFvg.direction === "bullish" ? "상승" : "하락"} / ${activeAnalysis.latestFvg.state === "ifvg" ? "iFVG" : "FVG"}`
                    : "없음"
                }
              />
              <MiniMetric
                label="최근 Sweep"
                value={
                  activeAnalysis.latestSweep
                    ? `${activeAnalysis.latestSweep.direction === "bullish" ? "저점 스윕" : "고점 스윕"} / ${barsAgoLabel(activeAnalysis.latestSweep.age, activeTimeframe)}`
                    : "없음"
                }
              />
              <MiniMetric
                label="최근 CISD"
                value={
                  activeAnalysis.latestCisd
                    ? `${activeAnalysis.latestCisd.direction === "bullish" ? "상승" : "하락"} / ${barsAgoLabel(activeAnalysis.latestCisd.age, activeTimeframe)}`
                    : "없음"
                }
              />
              <MiniMetric
                label="Displacement"
                value={
                  activeAnalysis.latestDisplacement
                    ? `${activeAnalysis.latestDisplacement.direction === "bullish" ? "상승" : "하락"} / ${activeAnalysis.latestDisplacement.strength}점`
                    : "없음"
                }
              />
              <MiniMetric
                label="Buy-side 유동성"
                value={activeAnalysis.buySideLiquidity ? `${formatPrice(activeAnalysis.buySideLiquidity.level)} / ${Math.abs(activeAnalysis.buySideLiquidity.distancePercent).toFixed(2)}%` : "없음"}
              />
              <MiniMetric
                label="Sell-side 유동성"
                value={activeAnalysis.sellSideLiquidity ? `${formatPrice(activeAnalysis.sellSideLiquidity.level)} / ${Math.abs(activeAnalysis.sellSideLiquidity.distancePercent).toFixed(2)}%` : "없음"}
              />
              <MiniMetric label="Dealing Range" value={stateLabel(activeDealingRange.position)} />
              <MiniMetric label="OTE" value={stateLabel(activeAnalysis.oteZone)} />
              <MiniMetric label="프리미엄/디스카운트" value={stateLabel(activeAnalysis.premiumDiscount)} />
              <MiniMetric label="FVG 내부" value={activeAnalysis.inFvg ? "예" : "아니오"} />
              <MiniMetric label="현재 구조 점수" value={String(activeAnalysis.score)} />
            </div>
          ) : null}

          {analysis ? (
            <div className="rounded-lg border border-surface-line bg-surface-cardSoft p-4">
              <h3 className="text-sm font-bold text-white">MTF FVG / iFVG 맵</h3>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {mtfFvgMap.map((item) => (
                  <div key={item.timeframe} className="rounded-md border border-surface-line bg-black/20 px-3 py-3">
                    <p className="text-xs font-semibold text-slate-400">{item.timeframe}</p>
                    {item.latestFvg ? (
                      <div className="mt-2 space-y-2">
                        <div className={`rounded-md border px-2 py-1 text-xs font-bold ${directionBadge(item.latestFvg.direction)}`}>
                          {item.latestFvg.state === "ifvg" ? "iFVG" : "FVG"} / {stateLabel(item.latestFvg.direction)}
                        </div>
                        <p className="text-xs text-slate-300">
                          {item.latestFvg.bottom.toLocaleString("ko-KR", { maximumFractionDigits: 5 })} -{" "}
                          {item.latestFvg.top.toLocaleString("ko-KR", { maximumFractionDigits: 5 })}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {item.inFvg ? "현재가 내부" : `${barsAgoLabel(item.latestFvg.age, item.timeframe)} 생성`}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-slate-500">최근 FVG 없음</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {analysis ? (
            <div className="rounded-lg border border-surface-line bg-surface-cardSoft p-4">
              <h3 className="text-sm font-bold text-white">분석 기준</h3>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <MiniMetric label="구조 감지" value={structureSensitivityLabel(structureSensitivity)} />
                <MiniMetric label="MSB 판정" value={msbMode === "close" ? "종가 돌파" : "윅 포함 돌파"} />
                <MiniMetric label="CHoCH 판정" value="윅 돌파" />
                <MiniMetric label="OTE 기준" value="4시간 20봉 범위" />
                <MiniMetric label="PD 기준" value="4시간 프리미엄/디스카운트" />
                <MiniMetric label="POC 기준" value="현재 시간대 최근 거래량 분포" />
                <MiniMetric label="스윕 기준" value="스윙 고점·저점 확정 이후" />
                <MiniMetric label="레이더 기준" value={`${activeTimeframe} 타임프레임`} />
                <MiniMetric label="판독 모드" value={analysisMode === "confirmed" ? "닫힌 봉 기준" : "진행 중 봉 포함"} />
                <MiniMetric label="4H EMA200" value={fourHourAnalysis ? stateLabel(fourHourAnalysis.ema200Side) : "-"} />
                <MiniMetric label="현재 킬존" value={killzoneLabel(analysis.killzone)} />
                <MiniMetric label="최근 갱신" value={formatUpdatedAt(analysis.updatedAt)} />
                <MiniMetric label="데이터 신뢰도" value={readinessLabel(analysis.readiness)} />
              </div>
            </div>
          ) : null}

          {showPineParityTools && showAdvancedControls && activeAnalysis ? (
            <div className="rounded-lg border border-surface-line bg-surface-cardSoft p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Bug size={16} className="text-accent-blue" aria-hidden />
                  <h3 className="text-sm font-bold text-white">Pine 대조 디버그</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDebug((prev) => !prev)}
                    className="inline-flex min-h-9 items-center gap-2 rounded-md border border-surface-line bg-black/20 px-3 text-xs font-bold text-slate-300 hover:border-accent-blue/60 hover:text-white"
                  >
                    {showDebug ? "접기" : "열기"}
                  </button>
                  <button
                    type="button"
                    onClick={copyDebugSnapshot}
                    className="inline-flex min-h-9 items-center gap-2 rounded-md border border-surface-line bg-black/20 px-3 text-xs font-bold text-slate-300 hover:border-accent-blue/60 hover:text-white"
                  >
                    <Copy size={14} aria-hidden />
                    {copied ? "복사됨" : "값 복사"}
                  </button>
                </div>
              </div>
              {showDebug ? (
                <>
                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    현재 Chart Radar가 읽은 구조 값입니다. 같은 코인과 타임프레임으로 TradingView 지표와 비교하면 판독 차이를 빠르게 확인할 수 있습니다.
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <MiniMetric label="h0" value={activeAnalysis.debug.h0 ? formatPrice(activeAnalysis.debug.h0) : "-"} />
                    <MiniMetric label="h1" value={activeAnalysis.debug.h1 ? formatPrice(activeAnalysis.debug.h1) : "-"} />
                    <MiniMetric label="l0" value={activeAnalysis.debug.l0 ? formatPrice(activeAnalysis.debug.l0) : "-"} />
                    <MiniMetric label="l1" value={activeAnalysis.debug.l1 ? formatPrice(activeAnalysis.debug.l1) : "-"} />
                    <MiniMetric label="market" value={String(activeAnalysis.debug.market)} />
                    <MiniMetric label="choch_dir" value={String(activeAnalysis.debug.choch)} />
                    <MiniMetric label="hiPts 수" value={String(activeAnalysis.debug.hiCount)} />
                    <MiniMetric label="loPts 수" value={String(activeAnalysis.debug.loCount)} />
                  </div>
                  <div className="mt-4 rounded-lg border border-accent-blue/20 bg-black/20 p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-white">Pine 스냅샷 일치율</h4>
                        <p className="mt-1 text-xs leading-5 text-slate-400">
                          Pine 지표에서 복사한 값이나 직접 적은 key=value 값을 넣으면 Chart Radar 판독값과 바로 비교합니다.
                        </p>
                      </div>
                      {parityScore !== null ? (
                        <span className={`rounded-md border px-3 py-1.5 text-sm font-black ${parityScore >= 90 ? "border-signal-success/30 bg-signal-success/10 text-signal-success" : parityScore >= 70 ? "border-signal-warning/30 bg-signal-warning/10 text-signal-warning" : "border-signal-danger/30 bg-signal-danger/10 text-signal-danger"}`}>
                          일치율 {parityScore}%
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={fillParityTemplateFromWeb}
                        className="inline-flex min-h-9 items-center rounded-md border border-accent-blue/30 bg-accent-blue/10 px-3 text-xs font-bold text-accent-blue hover:bg-accent-blue/20"
                      >
                        웹값 예시 채우기
                      </button>
                      <button
                        type="button"
                        onClick={() => setPineSnapshotInput("")}
                        className="inline-flex min-h-9 items-center rounded-md border border-white/10 bg-black/20 px-3 text-xs font-bold text-slate-300 hover:border-accent-blue/40"
                      >
                        입력 비우기
                      </button>
                    </div>
                    <textarea
                      value={pineSnapshotInput}
                      onChange={(event) => setPineSnapshotInput(event.target.value)}
                      placeholder={'예: {"market":1,"chochDir":-1,"h0":104500,"h1":105100,"l0":103800,"l1":102900,"hiCount":12,"loCount":12}'}
                      className="mt-3 min-h-24 w-full rounded-md border border-surface-line bg-surface-card px-3 py-2 text-xs leading-5 text-slate-200 outline-none focus:border-accent-blue"
                    />
                    <p className="mt-2 text-[11px] leading-5 text-slate-500">
                      지원 필드: market, chochDir, h0/h1/l0/l1, msb.{activeTimeframe}, choch.{activeTimeframe}, latestOb.*, latestFvg.*, fvgDir/fvgTop/fvgBottom, latestSweep.*, latestCisd.*, cisd
                    </p>
                    {pineSnapshotInput.trim() && !pineSnapshot ? (
                      <p className="mt-2 text-xs text-signal-danger">입력값을 읽지 못했습니다. JSON 또는 market=1, h0=... 형태로 넣어주세요.</p>
                    ) : null}
                    {parityRows.length > 0 ? (
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <MiniMetric label="핵심 일치율" value={parityScore !== null ? `${parityScore}%` : "-"} />
                        <MiniMetric label="대조 항목 수" value={String(parityRows.length)} />
                        <MiniMetric label="어긋난 항목" value={String(parityMismatches.length)} />
                      </div>
                    ) : null}
                    {parityMismatches.length > 0 ? (
                      <div className="mt-3 rounded-md border border-signal-warning/25 bg-signal-warning/10 p-3">
                        <p className="text-xs font-bold text-signal-warning">먼저 볼 차이</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {parityMismatches.slice(0, 6).map((row) => (
                            <span
                              key={row.label}
                              className={`rounded-md border px-2.5 py-1 text-xs font-bold ${
                                row.importance === "core"
                                  ? "border-signal-danger/30 bg-signal-danger/10 text-signal-danger"
                                  : row.importance === "major"
                                    ? "border-signal-warning/30 bg-signal-warning/10 text-signal-warning"
                                    : "border-white/10 bg-black/20 text-slate-300"
                              }`}
                            >
                              {row.label}
                            </span>
                          ))}
                        </div>
                        <div className="mt-3 space-y-2">
                          {parityMismatches.slice(0, 3).map((row) => (
                            <p key={`${row.label}-hint`} className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs leading-5 text-slate-300">
                              <span className="font-bold text-slate-100">{row.label}</span>: {parityHint(row)}
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {parityRows.length > 0 ? (
                      <div className="mt-3 overflow-hidden rounded-md border border-surface-line">
                        <div className="grid grid-cols-4 bg-black/30 px-3 py-2 text-[11px] font-bold text-slate-400">
                          <span>항목</span>
                          <span>Radar</span>
                          <span>Pine</span>
                          <span>결과</span>
                        </div>
                        {parityRows.map((row) => (
                          <div key={row.label} className="grid grid-cols-4 border-t border-surface-line px-3 py-2 text-xs text-slate-200">
                            <span className={row.importance === "core" ? "font-bold text-white" : row.importance === "major" ? "font-semibold text-slate-200" : "text-slate-300"}>
                              {row.label}
                            </span>
                            <span>{row.web}</span>
                            <span>{row.pine}</span>
                            <span className={row.matched ? "font-bold text-signal-success" : "font-bold text-signal-warning"}>
                              {row.result}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  필요할 때만 열어서 Pine 지표와 구조 값을 1:1로 맞춰볼 수 있게 접어뒀습니다.
                </p>
              )}
            </div>
          ) : null}

            </>
          ) : null}

          {analysis && canShowDetailedAnalysis ? (
            <div className="rounded-lg border border-surface-line bg-surface-cardSoft p-4">
              <h3 className="text-sm font-bold text-white">{isMajorScreen || altOnly ? "판단 근거 상세" : "판독 근거"}</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-md border border-signal-success/20 bg-signal-success/5 p-3">
                  <p className="text-xs font-bold text-signal-success">상승 근거</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {groupedReasons.bullish.length > 0 ? (
                      groupedReasons.bullish.map((reason) => (
                        <span
                          key={`${reason.text}-${reason.tone}`}
                          className={`rounded-md border px-2.5 py-1.5 text-sm font-semibold ${reasonClasses(reason.tone)}`}
                        >
                          {reason.text}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">뚜렷한 상승 근거 없음</span>
                    )}
                  </div>
                </div>
                <div className="rounded-md border border-signal-danger/20 bg-signal-danger/5 p-3">
                  <p className="text-xs font-bold text-signal-danger">하락 근거</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {groupedReasons.bearish.length > 0 ? (
                      groupedReasons.bearish.map((reason) => (
                        <span
                          key={`${reason.text}-${reason.tone}`}
                          className={`rounded-md border px-2.5 py-1.5 text-sm font-semibold ${reasonClasses(reason.tone)}`}
                        >
                          {reason.text}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">뚜렷한 하락 근거 없음</span>
                    )}
                  </div>
                </div>
                <div className="rounded-md border border-white/10 bg-black/20 p-3">
                  <p className="text-xs font-bold text-slate-300">횡보 / 참고</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {groupedReasons.neutral.length > 0 ? (
                      groupedReasons.neutral.map((reason) => (
                        <span
                          key={`${reason.text}-${reason.tone}`}
                          className={`rounded-md border px-2.5 py-1.5 text-sm font-semibold ${reasonClasses(reason.tone)}`}
                        >
                          {reason.text}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">추가 참고 근거 없음</span>
                    )}
                  </div>
                </div>
              </div>
              {analysis.warnings.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {analysis.warnings.map((warning) => (
                    <p key={warning} className="rounded-md border border-signal-warning/30 bg-signal-warning/10 p-2 text-sm leading-6 text-signal-warning">
                      {warning}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      <CryptoControlBar
        timeframes={modeTimeframes}
        activeTimeframe={activeTimeframe}
        onTimeframeChange={setActiveTimeframe}
        modes={radarProfileOptions}
        activeMode={radarProfile}
        onModeChange={setRadarProfile}
      />
    </section>
  );
}
