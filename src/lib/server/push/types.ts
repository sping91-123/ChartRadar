import type { BillingEntitlementPlan } from "@/lib/billing";
import type { TradingMode } from "@/lib/marketAnalysis";
import type { RadarAlertRuleId } from "@/lib/radarAlerts";
import type { SetupAlertMarket } from "@/lib/setupAlertPresets";
import type { ScoutSetup } from "@/lib/setupScout";

export interface PushTokenRow {
  id: string;
  user_id: string;
  token: string;
  markets: string[] | null;
  rule_ids: string[] | null;
}

export interface PushProfileRow {
  id: string;
  plan?: BillingEntitlementPlan;
  membership_tier?: BillingEntitlementPlan;
}

export interface PushSubscriptionRow {
  user_id: string;
  plan?: BillingEntitlementPlan;
  tier?: BillingEntitlementPlan;
}

export interface PushAlertPresetRow {
  user_id: string;
  market: SetupAlertMarket;
  preset_id: string;
  symbol: string;
  mode: TradingMode | null;
  timeframe: string;
  side: "long" | "short";
  quality: "A" | "B" | "C";
  score: number;
  headline: string;
  saved_at: string;
}

export interface PushAlertEvent {
  market: SetupAlertMarket;
  ruleId: RadarAlertRuleId;
  alertKind:
    | "market_scout"
    | "watchlist"
    | "liquidation"
    | "macro"
    | "global"
    | "global_momentum"
    | "global_asset"
    | "risk_off"
    | "semiconductor_leadership";
  eventKey: string;
  title: string;
  body: string;
  data: Record<string, string>;
  score?: number;
  quality?: ScoutSetup["plan"]["quality"];
  symbol?: string;
  system?: boolean;
  isWatchlist?: boolean;
  isMarketScout?: boolean;
  isWatchedSymbol?: boolean;
  evidenceLabels?: string[];
  marketScoutRank?: number;
}

export interface ScanContext {
  origin: string;
  dryRun?: boolean;
  diagnosticsLimit?: number;
}

export interface OptionalEventSourceResult {
  label: string;
  event: PushAlertEvent | null;
  warning: string | null;
}

export interface PushEventDiagnostic {
  signalType: string;
  ruleId: RadarAlertRuleId;
  market: SetupAlertMarket;
  symbol?: string;
  timeframe?: string;
  score?: number;
  quality?: ScoutSetup["plan"]["quality"];
  alertKind: PushAlertEvent["alertKind"];
  alertTitle: string;
  alertBody: string;
  title: string;
  reason: string;
  eventKey: string;
  wouldSend: boolean;
  skippedReason: "low_score" | "entitlement" | "token_preferences" | "duplicate" | "dry_run" | null;
  targetTokenCount: number;
  system: boolean;
  isWatchlist: boolean;
  isMarketScout: boolean;
  isWatchedSymbol: boolean;
  evidenceLabels: string[];
  marketScoutRank?: number;
  threshold: string;
}

export interface PushScanDiagnostics {
  tokenCount: number;
  userCount: number;
  profileCount: number;
  subscriptionCount: number;
  presetCount: number;
  cryptoPresetCount: number;
  stockPresetCount: number;
  cryptoSetupCount: number;
  stockPresetSetupCount: number;
  stockMomentumSetupCount: number;
  optionalEventCount: number;
  genericEventCount: number;
  candidateEventCount: number;
  qualityPassedEventCount: number;
  deliveryEligibleEventCount: number;
  finalSendAttemptCount: number;
  eligibleEventCount: number;
  entitlementBlockedEventCount: number;
  preferenceSkippedTokenCount: number;
  duplicateSkippedTokenCount: number;
  sendTargetTokenCount: number;
  skippedLowScoreCount: number;
  lookupErrorCount: number;
  scannerErrorCount: number;
  skippedLowScoreSamples: PushEventDiagnosticSample[];
  preferenceSkippedSamples: PushPreferenceSkippedSample[];
  duplicateSkippedSamples: PushDuplicateSkippedSample[];
  topCandidateSamples: PushEventDiagnosticSample[];
}

export interface PushEventDiagnosticSample {
  symbol: string | null;
  market: SetupAlertMarket;
  timeframe: string | null;
  score: number | null;
  quality: ScoutSetup["plan"]["quality"] | null;
  alertKind: PushAlertEvent["alertKind"];
  skippedReason: PushEventDiagnostic["skippedReason"];
  threshold: string;
  wouldSend?: boolean;
}

export interface PushPreferenceSkippedSample {
  market: SetupAlertMarket;
  alertKind: PushAlertEvent["alertKind"];
  ruleId: RadarAlertRuleId;
  reason: "token_preferences";
}

export interface PushDuplicateSkippedSample {
  eventKey: string;
  market: SetupAlertMarket;
  symbol: string | null;
  bucket: string | null;
  reason: "duplicate";
}
