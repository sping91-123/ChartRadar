import type { ActiveExchangeProvider, ExchangePositionMode } from "../../exchangeJournal";
import { configuredExchangeEgressIps } from "../exchangeJournalConfig";
import { ExchangeConnectorError, type ExchangeCredentialValidation } from "./types";

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function firstRecord(value: unknown) {
  if (Array.isArray(value)) return record(value[0]);
  return record(value);
}

function stringValue(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return "";
}

function booleanValue(value: unknown) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function stringArray(value: unknown) {
  if (Array.isArray(value)) return value.map(stringValue).filter(Boolean);
  return stringValue(value).split(",").map((item) => item.trim()).filter(Boolean);
}

function normalizedIps(value: unknown) {
  return Array.from(new Set(stringArray(value))).sort();
}

function positionMode(value: unknown): ExchangePositionMode {
  const normalized = stringValue(value).toLowerCase();
  if (normalized === "long_short_mode" || normalized === "hedge" || normalized === "hedge_mode") return "hedge";
  if (normalized === "net_mode" || normalized === "one_way" || normalized === "oneway") return "one_way";
  return "unknown";
}

function assertCompatibleIpWhitelist(provider: ActiveExchangeProvider, ips: string[], ipRestrictionEnabled = true) {
  const expected = configuredExchangeEgressIps();
  if (!ipRestrictionEnabled || ips.length === 0) {
    return { provider, ips };
  }
  if (expected.length === 0 || ips.length !== expected.length) {
    throw new ExchangeConnectorError("ip_mismatch", "ip_mismatch");
  }
  if (expected.some((ip, index) => ip !== ips[index])) {
    throw new ExchangeConnectorError("ip_mismatch", "ip_mismatch");
  }
  if (ips.some((ip) => ip.includes("/"))) {
    throw new ExchangeConnectorError("ip_mismatch", "ip_mismatch");
  }
  return { provider, ips };
}

export function parseOkxCredentialValidation(payload: unknown): ExchangeCredentialValidation {
  const root = record(payload);
  if (stringValue(root.code) !== "0") throw new ExchangeConnectorError("invalid_credentials", "permission_changed");
  const data = firstRecord(root.data);
  const permissions = stringArray(data.perm).map((value) => value.toLowerCase());
  if (permissions.length !== 1 || permissions[0] !== "read_only") {
    throw new ExchangeConnectorError("permission_changed", "permission_changed");
  }
  const ips = normalizedIps(data.ip);
  assertCompatibleIpWhitelist("okx", ips);
  return {
    provider: "okx",
    accountUid: stringValue(data.uid || data.mainUid),
    accountMode: stringValue(data.acctLv) || "unknown",
    positionMode: positionMode(data.posMode),
    ipWhitelist: ips,
    permissionSummary: { readOnly: true, ipBound: ips.length > 0, permissions: ["read_only"] }
  };
}

export function parseBybitCredentialValidation(payload: unknown): ExchangeCredentialValidation {
  const root = record(payload);
  if (Number(root.retCode) !== 0) throw new ExchangeConnectorError("invalid_credentials", "permission_changed");
  const data = record(root.result);
  if (Number(data.readOnly) !== 1) {
    throw new ExchangeConnectorError("permission_changed", "permission_changed");
  }
  const ips = normalizedIps(data.ips);
  assertCompatibleIpWhitelist("bybit", ips);
  const permissions = record(data.permissions);
  const contractPermissions = stringArray(permissions.ContractTrade);
  if (!contractPermissions.includes("Order") || !contractPermissions.includes("Position")) {
    throw new ExchangeConnectorError("permission_changed", "permission_changed");
  }
  return {
    provider: "bybit",
    accountUid: stringValue(data.userID || data.userId),
    accountMode: Number(data.uta) === 1 ? "uta" : "classic",
    positionMode: "unknown",
    ipWhitelist: ips,
    permissionSummary: { readOnly: true, ipBound: ips.length > 0, contractHistory: true }
  };
}

export function parseBitgetCredentialValidation(payload: unknown): ExchangeCredentialValidation {
  const root = record(payload);
  if (stringValue(root.code) !== "00000") throw new ExchangeConnectorError("invalid_credentials", "permission_changed");
  const data = record(root.data);
  if (stringValue(data.permType).toLowerCase() !== "read-only") {
    throw new ExchangeConnectorError("permission_changed", "permission_changed");
  }
  const permissions = stringArray(data.permissions).map((permission) => permission.toLowerCase());
  if (
    !permissions.includes("uta_trade") ||
    !permissions.includes("uta_mgt") ||
    permissions.some((permission) => permission.includes("withdraw") || permission.includes("transfer"))
  ) {
    throw new ExchangeConnectorError("permission_changed", "permission_changed");
  }
  const ips = normalizedIps(data.ips);
  assertCompatibleIpWhitelist("bitget", ips);
  return {
    provider: "bitget",
    accountUid: stringValue(data.userId),
    accountMode: "uta",
    positionMode: "unknown",
    ipWhitelist: ips,
    permissionSummary: { readOnly: true, ipBound: ips.length > 0, utaTradeHistory: true, utaFinancialHistory: true }
  };
}

export function parseBingxCredentialValidation(
  permissionPayload: unknown,
  uidPayload: unknown,
  keyInfoPayload: unknown
): ExchangeCredentialValidation {
  const permissionRoot = record(permissionPayload);
  if (Number(permissionRoot.code) !== 0) throw new ExchangeConnectorError("invalid_credentials", "permission_changed");
  const permission = record(permissionRoot.data);
  const readOnly =
    booleanValue(permission.enableReading) &&
    !booleanValue(permission.enableSpotAndMarginTrading) &&
    !booleanValue(permission.enableWithdrawals) &&
    !booleanValue(permission.enableInternalTransfer) &&
    !booleanValue(permission.enableFutures) &&
    !booleanValue(permission.permitsUniversalTransfer) &&
    !booleanValue(permission.enableVanillaOptions);
  if (!readOnly) throw new ExchangeConnectorError("permission_changed", "permission_changed");

  const uidRoot = record(uidPayload);
  if (Number(uidRoot.code) !== 0) throw new ExchangeConnectorError("invalid_credentials", "permission_changed");
  const uid = stringValue(record(uidRoot.data).uid);

  const keyRoot = record(keyInfoPayload);
  if (Number(keyRoot.code) !== 0) throw new ExchangeConnectorError("invalid_credentials", "permission_changed");
  const keyRows = Array.isArray(record(keyRoot.data).apiKeyList)
    ? (record(keyRoot.data).apiKeyList as unknown[]).map(record)
    : [];
  if (keyRows.length !== 1) throw new ExchangeConnectorError("response_invalid", "provider_unavailable");
  const permissionCodes = stringArray(keyRows[0].permissions);
  if (permissionCodes.length !== 1 || permissionCodes[0] !== "2") {
    throw new ExchangeConnectorError("permission_changed", "permission_changed");
  }
  const ips = normalizedIps(keyRows[0].ipAddresses);
  assertCompatibleIpWhitelist("bingx", ips, booleanValue(permission.ipRestrict));
  return {
    provider: "bingx",
    accountUid: uid,
    accountMode: "standard",
    positionMode: "unknown",
    ipWhitelist: ips,
    permissionSummary: { readOnly: true, ipBound: ips.length > 0, permissions: ["read"] }
  };
}
