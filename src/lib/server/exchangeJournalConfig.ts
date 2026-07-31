import {
  activeExchangeProviders,
  exchangeProviders,
  type ActiveExchangeProvider,
  type ExchangeProvider
} from "../exchangeJournal";
import { exchangeCredentialEncryptionConfigurationError } from "./exchangeCredentials";

export type ExchangeJournalMode = "off" | "shadow" | "on";

function readMode(value: string | undefined): ExchangeJournalMode {
  return value === "on" || value === "shadow" ? value : "off";
}

export function exchangeJournalMode() {
  return readMode(process.env.EXCHANGE_JOURNAL_V1);
}

export function isExchangeJournalReadable() {
  return exchangeJournalMode() !== "off";
}

export function isExchangeJournalMutationEnabled() {
  return exchangeJournalMode() === "on";
}

function isIpv4(value: string) {
  const octets = value.split(".");
  return octets.length === 4 &&
    octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) >= 0 && Number(octet) <= 255);
}

export function configuredExchangeEgressIps() {
  const raw = process.env.EXCHANGE_SYNC_EGRESS_IPS?.trim() ?? "";
  if (!raw) return [];
  const tokens = raw.split(",").map((value) => value.trim());
  if (
    tokens.length !== 2 ||
    tokens.some((value) => !value || value.includes("/") || !isIpv4(value)) ||
    new Set(tokens).size !== tokens.length
  ) {
    return [];
  }
  return [...tokens].sort();
}

export function exchangeConnectionRollout() {
  const value = process.env.EXCHANGE_CONNECTION_ROLLOUT;
  return value === "canary" || value === "ga" ? value : "locked";
}

export function configuredCanaryUserIds() {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const raw = process.env.EXCHANGE_CONNECTION_CANARY_USER_IDS?.trim() ?? "";
  if (!raw) return [];
  const tokens = raw.split(",").map((value) => value.trim().toLowerCase());
  if (tokens.some((value) => !uuid.test(value)) || new Set(tokens).size !== tokens.length) return [];
  return tokens;
}

export function exchangeMutationConfigurationError() {
  if (!isExchangeJournalMutationEnabled()) return "exchange_feature_disabled";
  const encryptionError = exchangeCredentialEncryptionConfigurationError();
  if (encryptionError) return encryptionError;
  const rollout = exchangeConnectionRollout();
  if (rollout === "locked") return "exchange_rollout_locked";
  if (rollout === "canary" && configuredCanaryUserIds().length === 0) {
    return "exchange_canary_not_configured";
  }
  return null;
}

export function isExchangeUserInRollout(userId: string) {
  if (exchangeConnectionRollout() === "ga") return true;
  return configuredCanaryUserIds().includes(userId.toLowerCase());
}

export function exchangeCronAllowedUserIds() {
  if (exchangeConnectionRollout() === "ga") return null;
  return configuredCanaryUserIds();
}

function boundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number) {
  if (!value || !/^\d+$/.test(value.trim())) return fallback;
  return Math.max(minimum, Math.min(maximum, Number(value)));
}

export function exchangeSyncBatchSize() {
  return boundedInteger(process.env.EXCHANGE_SYNC_BATCH_SIZE, 8, 1, 25);
}

export function exchangeSyncConcurrency() {
  return boundedInteger(process.env.EXCHANGE_SYNC_CONCURRENCY, 4, 1, 8);
}

export function isExchangeProviderEnabled(provider: ExchangeProvider): provider is ActiveExchangeProvider {
  if (!activeExchangeProviders.includes(provider as ActiveExchangeProvider)) return false;
  const key = `EXCHANGE_${provider.toUpperCase()}_ENABLED`;
  return process.env[key] === "true";
}

export function hasExchangeJournalPaidAccess(entitlement: { isPaid: boolean; state: string }) {
  return entitlement.state === "active" && entitlement.isPaid;
}

export function exchangeJournalCapabilities(isPaid: boolean, userId = "", operationsEnabled = false) {
  const mode = exchangeJournalMode();
  const configurationReady = exchangeMutationConfigurationError() === null;
  const canRead = isPaid && mode !== "off";
  const rolloutAllowed = Boolean(userId) && isExchangeUserInRollout(userId);
  const canMutate = canRead && operationsEnabled && configurationReady && rolloutAllowed;
  const reason = !isPaid
    ? "coin_pro_required"
    : mode === "off"
      ? "exchange_feature_disabled"
      : !operationsEnabled
        ? "exchange_operations_locked"
        : !configurationReady
          ? exchangeMutationConfigurationError()
          : !rolloutAllowed
            ? "exchange_rollout_not_allowed"
            : null;
  return {
    mode,
    canUse: isPaid,
    isEntitled: isPaid,
    canRead,
    canConnect: canMutate,
    canSync: canMutate,
    canCleanup: true,
    operationsEnabled,
    reason,
    egressIps: configuredExchangeEgressIps(),
    connectionLimit: isPaid ? 5 : 0,
    historyDays: isPaid ? 90 : 0,
    providers: exchangeProviders.map((provider) => ({
      id: provider,
      enabled: canRead && isExchangeProviderEnabled(provider),
      comingSoon: provider === "lbank"
    }))
  };
}

export function assertExchangeMutationConfiguration(userId?: string) {
  const configurationError = exchangeMutationConfigurationError();
  if (configurationError) throw new ExchangeJournalConfigurationError(configurationError);
  if (userId && !isExchangeUserInRollout(userId)) {
    throw new ExchangeJournalConfigurationError("exchange_rollout_not_allowed");
  }
}

export class ExchangeJournalConfigurationError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "ExchangeJournalConfigurationError";
  }
}
