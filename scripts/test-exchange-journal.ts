import assert from "node:assert/strict";
import {
  calculateExchangeAnalytics,
  matchSavedDecisionCandidates,
  reconstructRoundTrips,
  type CanonicalExchangeCashflow,
  type CanonicalExchangeFill
} from "../src/lib/exchangeJournal";
import {
  addDecimal,
  divideDecimal,
  multiplyDecimal,
  normalizeDecimal
} from "../src/lib/decimal";
import {
  decryptExchangeCredentials,
  encryptExchangeCredentials,
  maskedApiKey
} from "../src/lib/server/exchangeCredentials";
import {
  configuredExchangeEgressIps,
  exchangeCronAllowedUserIds,
  exchangeJournalCapabilities,
  exchangeSyncBatchSize,
  exchangeSyncConcurrency,
  hasExchangeJournalPaidAccess
} from "../src/lib/server/exchangeJournalConfig";
import { selectBingxSyncSymbols } from "../src/lib/exchangeBingxScope";
import {
  buildSyncWindow,
  type ExchangeSyncWindowConnection
} from "../src/lib/exchangeSyncWindow";
import {
  parseBingxCredentialValidation,
  parseBitgetCredentialValidation,
  parseBybitCredentialValidation,
  parseOkxCredentialValidation
} from "../src/lib/server/exchanges/permissions";
import {
  normalizeCcxtCashflow,
  normalizeCcxtOrderContext,
  normalizeCcxtTrade
} from "../src/lib/server/exchanges/normalization";
import { ExchangeConnectorError } from "../src/lib/server/exchanges/types";

const connectionId = "10000000-0000-4000-8000-000000000001";
const userId = "20000000-0000-4000-8000-000000000001";
const otherUserId = "20000000-0000-4000-8000-000000000002";
const t0 = Date.parse("2026-07-01T00:00:00.000Z");

process.env.EXCHANGE_CREDENTIAL_ENCRYPTION_KEY_V1 = Buffer.alloc(32, 7).toString("base64");
process.env.APPLE_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 8).toString("base64");
process.env.EXCHANGE_SYNC_EGRESS_IPS = "203.0.113.11,203.0.113.10";
process.env.EXCHANGE_JOURNAL_V1 = "on";
process.env.EXCHANGE_CONNECTION_ROLLOUT = "canary";
process.env.EXCHANGE_CONNECTION_CANARY_USER_IDS = userId;
process.env.EXCHANGE_OKX_ENABLED = "true";
process.env.EXCHANGE_BYBIT_ENABLED = "true";
process.env.EXCHANGE_BITGET_ENABLED = "true";
process.env.EXCHANGE_BINGX_ENABLED = "true";
process.env.EXCHANGE_LBANK_ENABLED = "true";

function fill(
  id: string,
  offsetMinutes: number,
  side: "buy" | "sell",
  quantityBase: string,
  price: string,
  feeQuoteSigned: string,
  overrides: Partial<CanonicalExchangeFill> = {}
): CanonicalExchangeFill {
  return {
    provider: "okx",
    connectionId,
    externalTradeId: id,
    externalOrderId: `order-${id}`,
    symbol: "BTC/USDT:USDT",
    product: "usdt_perpetual",
    side,
    positionMode: "one_way",
    positionSide: "net",
    openClose: "unknown",
    reduceOnly: false,
    quantityBase,
    quantityContracts: quantityBase,
    contractMultiplier: "1",
    price,
    quoteNotional: multiplyDecimal(quantityBase, price),
    providerRealizedPnl: null,
    feeNativeSigned: feeQuoteSigned,
    feeCurrency: "USDT",
    feeQuoteSigned,
    executedAt: new Date(t0 + offsetMinutes * 60_000).toISOString(),
    providerSequence: String(offsetMinutes),
    executionType: "trade",
    payloadFingerprint: id.padEnd(64, "0").slice(0, 64),
    ...overrides
  };
}

function funding(
  id: string,
  offsetMinutes: number,
  amount: string,
  overrides: Partial<CanonicalExchangeCashflow> = {}
): CanonicalExchangeCashflow {
  return {
    provider: "okx",
    connectionId,
    externalCashflowId: id,
    symbol: "BTC/USDT:USDT",
    positionSide: "net",
    type: "funding",
    amountSigned: amount,
    currency: "USDT",
    amountQuoteSigned: amount,
    occurredAt: new Date(t0 + offsetMinutes * 60_000).toISOString(),
    relatedTradeId: null,
    relatedOrderId: null,
    allocationStatus: "unallocated",
    reconciliationOnly: false,
    payloadFingerprint: id.padEnd(64, "f").slice(0, 64),
    ...overrides
  };
}

function expectConnectorCode(callback: () => unknown, code: string) {
  assert.throws(callback, (error) => error instanceof ExchangeConnectorError && error.code === code);
}

assert.equal(normalizeDecimal("1.230000000000000000"), "1.23");
assert.equal(normalizeDecimal("0.1e1"), "1");
assert.equal(normalizeDecimal("0.001e3"), "1");
assert.equal(addDecimal("0.1", "0.2"), "0.3");
assert.equal(multiplyDecimal("0.00000001", "123456789.12345678"), "1.2345678912345678");
assert.equal(divideDecimal("1", "8"), "0.125");
assert.deepEqual(configuredExchangeEgressIps(), ["203.0.113.10", "203.0.113.11"]);
assert.deepEqual(
  {
    canUse: exchangeJournalCapabilities(false, "", true).canUse,
    canConnect: exchangeJournalCapabilities(false, "", true).canConnect,
    connectionLimit: exchangeJournalCapabilities(false, "", true).connectionLimit,
    historyDays: exchangeJournalCapabilities(false, "", true).historyDays,
    enabledProviders: exchangeJournalCapabilities(false, "", true).providers.filter((provider) => provider.enabled).length
  },
  {
    canUse: false,
    canConnect: false,
    connectionLimit: 0,
    historyDays: 0,
    enabledProviders: 0
  },
  "Basic capabilities must remain cleanup-only"
);
assert.deepEqual(
  {
    canUse: exchangeJournalCapabilities(true, userId, true).canUse,
    canConnect: exchangeJournalCapabilities(true, userId, true).canConnect,
    connectionLimit: exchangeJournalCapabilities(true, userId, true).connectionLimit,
    historyDays: exchangeJournalCapabilities(true, userId, true).historyDays,
    enabledProviders: exchangeJournalCapabilities(true, userId, true).providers.filter((provider) => provider.enabled).length,
    lbankEnabled: exchangeJournalCapabilities(true, userId, true).providers.find((provider) => provider.id === "lbank")?.enabled
  },
  {
    canUse: true,
    canConnect: true,
    connectionLimit: 5,
    historyDays: 90,
    enabledProviders: 4,
    lbankEnabled: false
  }
);
process.env.EXCHANGE_SYNC_EGRESS_IPS = "203.0.113.10,999.0.0.1";
assert.deepEqual(configuredExchangeEgressIps(), []);
assert.equal(exchangeJournalCapabilities(true, userId, true).canConnect, true);
delete process.env.EXCHANGE_SYNC_EGRESS_IPS;
assert.equal(exchangeJournalCapabilities(true, userId, true).canConnect, true);
process.env.EXCHANGE_SYNC_EGRESS_IPS = "203.0.113.11,203.0.113.10";
process.env.EXCHANGE_CREDENTIAL_ENCRYPTION_KEY_V1 = process.env.APPLE_TOKEN_ENCRYPTION_KEY;
assert.equal(exchangeJournalCapabilities(true, userId, true).canConnect, false);
process.env.EXCHANGE_CREDENTIAL_ENCRYPTION_KEY_V1 = Buffer.alloc(32, 7).toString("base64");
assert.equal(exchangeJournalCapabilities(true, otherUserId, true).canConnect, false);
assert.equal(exchangeJournalCapabilities(true, userId, false).canConnect, false);
assert.equal(exchangeJournalCapabilities(true, userId, false).reason, "exchange_operations_locked");
process.env.EXCHANGE_JOURNAL_V1 = "shadow";
assert.equal(exchangeJournalCapabilities(true, userId, true).canRead, true);
assert.equal(exchangeJournalCapabilities(true, userId, true).canConnect, false);
process.env.EXCHANGE_JOURNAL_V1 = "off";
assert.equal(exchangeJournalCapabilities(true, userId, true).canRead, false);
process.env.EXCHANGE_JOURNAL_V1 = "on";
assert.deepEqual(exchangeCronAllowedUserIds(), [userId]);
process.env.EXCHANGE_SYNC_BATCH_SIZE = "99";
process.env.EXCHANGE_SYNC_CONCURRENCY = "0";
assert.equal(exchangeSyncBatchSize(), 25);
assert.equal(exchangeSyncConcurrency(), 1);
delete process.env.EXCHANGE_SYNC_BATCH_SIZE;
delete process.env.EXCHANGE_SYNC_CONCURRENCY;
assert.equal(exchangeSyncBatchSize(), 8);
assert.equal(exchangeSyncConcurrency(), 4);
assert.deepEqual(
  selectBingxSyncSymbols([
    "BTCUSDT",
    "ETH-USDT",
    "SOL/USDT:USDT",
    "XRPUSDT",
    "DOGEUSDT",
    "ADAUSDT",
    "LINKUSDT",
    "AVAXUSDT",
    "SUIUSDT"
  ]),
  {
    symbols: [
      "BTC/USDT:USDT",
      "ETH/USDT:USDT",
      "SOL/USDT:USDT",
      "XRP/USDT:USDT",
      "DOGE/USDT:USDT",
      "ADA/USDT:USDT",
      "LINK/USDT:USDT",
      "AVAX/USDT:USDT"
    ],
    truncated: true
  }
);
assert.equal(hasExchangeJournalPaidAccess({ state: "basic", isPaid: false }), false);
assert.equal(hasExchangeJournalPaidAccess({ state: "active", isPaid: false }), false);
assert.equal(hasExchangeJournalPaidAccess({ state: "unavailable", isPaid: true }), false);
assert.equal(hasExchangeJournalPaidAccess({ state: "active", isPaid: true }), true);

const encrypted = encryptExchangeCredentials(connectionId, userId, "okx", {
  apiKey: "FAKE-API-KEY-1234",
  secret: "FAKE-SECRET-NEVER-LOG",
  passphrase: "FAKE-PASSPHRASE"
});
assert.equal(encrypted.keyVersion, 1);
assert.notEqual(encrypted.iv, encryptExchangeCredentials(connectionId, userId, "okx", {
  apiKey: "FAKE-API-KEY-1234",
  secret: "FAKE-SECRET-NEVER-LOG"
}).iv);
assert.ok(!JSON.stringify(encrypted).includes("FAKE-SECRET"));
assert.deepEqual(decryptExchangeCredentials(connectionId, userId, "okx", encrypted), {
  apiKey: "FAKE-API-KEY-1234",
  secret: "FAKE-SECRET-NEVER-LOG",
  passphrase: "FAKE-PASSPHRASE"
});
assert.throws(
  () => decryptExchangeCredentials(connectionId, userId, "bybit", encrypted),
  /credential_decryption_failed/
);
assert.equal(maskedApiKey("FAKE-API-KEY-1234"), "••••1234");

assert.deepEqual(
  parseOkxCredentialValidation({
    code: "0",
    data: [{ uid: "fake-okx-uid", acctLv: "2", posMode: "net_mode", perm: "read_only", ip: "203.0.113.11,203.0.113.10" }]
  }).ipWhitelist,
  ["203.0.113.10", "203.0.113.11"]
);
assert.deepEqual(
  parseOkxCredentialValidation({
    code: "0",
    data: [{ uid: "fake-okx-no-ip", acctLv: "2", posMode: "net_mode", perm: "read_only", ip: "" }]
  }).ipWhitelist,
  []
);
delete process.env.EXCHANGE_SYNC_EGRESS_IPS;
expectConnectorCode(
  () => parseOkxCredentialValidation({
    code: "0",
    data: [{ uid: "fake-okx-other-ip", acctLv: "2", posMode: "net_mode", perm: "read_only", ip: "198.51.100.20" }]
  }),
  "ip_mismatch"
);
process.env.EXCHANGE_SYNC_EGRESS_IPS = "203.0.113.11,203.0.113.10";
expectConnectorCode(
  () => parseOkxCredentialValidation({
    code: "0",
    data: [{ uid: "fake", posMode: "net_mode", perm: "read_only,trade", ip: "203.0.113.10,203.0.113.11" }]
  }),
  "permission_changed"
);
expectConnectorCode(
  () => parseOkxCredentialValidation({
    code: "0",
    data: [{ uid: "fake", posMode: "net_mode", perm: "read_only", ip: "203.0.113.10" }]
  }),
  "ip_mismatch"
);

assert.equal(
  parseBybitCredentialValidation({
    retCode: 0,
    result: {
      readOnly: 1,
      uta: 1,
      userID: "fake-bybit-uid",
      ips: ["203.0.113.10", "203.0.113.11"],
      permissions: { ContractTrade: ["Order", "Position"] }
    }
  }).accountMode,
  "uta"
);
assert.deepEqual(
  parseBybitCredentialValidation({
    retCode: 0,
    result: {
      readOnly: 1,
      uta: 1,
      userID: "fake-bybit-no-ip",
      ips: [],
      permissions: { ContractTrade: ["Order", "Position"] }
    }
  }).ipWhitelist,
  []
);
expectConnectorCode(
  () => parseBybitCredentialValidation({
    retCode: 0,
    result: {
      readOnly: 0,
      ips: ["203.0.113.10", "203.0.113.11"],
      permissions: { ContractTrade: ["Order"] }
    }
  }),
  "permission_changed"
);
expectConnectorCode(
  () => parseBybitCredentialValidation({
    retCode: 0,
    result: {
      readOnly: 1,
      ips: ["203.0.113.10", "203.0.113.11"],
      permissions: { ContractTrade: ["Order"] }
    }
  }),
  "permission_changed"
);

assert.equal(
  parseBitgetCredentialValidation({
    code: "00000",
    data: {
      userId: "fake-bitget-uid",
      permType: "read-only",
      permissions: ["uta_trade", "uta_mgt"],
      ips: ["203.0.113.10", "203.0.113.11"]
    }
  }).provider,
  "bitget"
);
assert.deepEqual(
  parseBitgetCredentialValidation({
    code: "00000",
    data: {
      userId: "fake-bitget-no-ip",
      permType: "read-only",
      permissions: ["uta_trade", "uta_mgt"],
      ips: []
    }
  }).ipWhitelist,
  []
);
expectConnectorCode(
  () => parseBitgetCredentialValidation({
    code: "00000",
    data: {
      userId: "fake",
      permType: "read-and-write",
      permissions: ["uta_trade", "withdraw"],
      ips: ["203.0.113.10", "203.0.113.11"]
    }
  }),
  "permission_changed"
);
expectConnectorCode(
  () => parseBitgetCredentialValidation({
    code: "00000",
    data: {
      userId: "fake",
      permType: "read-only",
      permissions: ["uta_trade"],
      ips: ["203.0.113.10", "203.0.113.11"]
    }
  }),
  "permission_changed"
);

assert.equal(
  parseBingxCredentialValidation(
    {
      code: 0,
      data: {
        enableReading: true,
        enableSpotAndMarginTrading: false,
        enableWithdrawals: false,
        enableInternalTransfer: false,
        enableFutures: false,
        permitsUniversalTransfer: false,
        enableVanillaOptions: false,
        ipRestrict: true
      }
    },
    { code: 0, data: { uid: "fake-bingx-uid" } },
    {
      code: 0,
      data: {
        apiKeyList: [{
          permissions: [2],
          ipAddresses: ["203.0.113.10", "203.0.113.11"]
        }]
      }
    }
  ).provider,
  "bingx"
);
assert.deepEqual(
  parseBingxCredentialValidation(
    {
      code: 0,
      data: {
        enableReading: true,
        enableSpotAndMarginTrading: false,
        enableWithdrawals: false,
        enableInternalTransfer: false,
        enableFutures: false,
        permitsUniversalTransfer: false,
        enableVanillaOptions: false,
        ipRestrict: false
      }
    },
    { code: 0, data: { uid: "fake-bingx-no-ip" } },
    { code: 0, data: { apiKeyList: [{ permissions: [2], ipAddresses: [] }] } }
  ).ipWhitelist,
  []
);
expectConnectorCode(
  () => parseBingxCredentialValidation(
    {
      code: 0,
      data: {
        enableReading: true,
        enableFutures: true,
        ipRestrict: true
      }
    },
    { code: 0, data: { uid: "fake" } },
    { code: 0, data: { apiKeyList: [{ permissions: [2], ipAddresses: ["203.0.113.10", "203.0.113.11"] }] } }
  ),
  "permission_changed"
);

const normalizedTrade = normalizeCcxtTrade(
  "okx",
  connectionId,
  {
    id: "raw-precision",
    order: "raw-order",
    symbol: "BTC/USDT:USDT",
    side: "buy",
    amount: 1.2,
    price: 100.2,
    fee: { cost: 0.1, currency: "USDT" },
    info: {
      fillSz: "1.200000000000000001",
      fillPx: "100.200000000000000001",
      fee: "-0.100000000000000001",
      feeCcy: "USDT",
      posSide: "net",
      fillTime: String(t0)
    }
  },
  {
    symbol: "BTC/USDT:USDT",
    contract: true,
    swap: true,
    linear: true,
    settle: "USDT",
    contractSize: "0.01"
  }
);
assert.ok(normalizedTrade);
assert.equal(normalizedTrade.quantityContracts, "1.200000000000000001");
assert.equal(normalizedTrade.quantityBase, "0.012");
assert.equal(normalizedTrade.price, "100.200000000000000001");
assert.equal(normalizedTrade.feeQuoteSigned, "-0.100000000000000001");
const bitgetUtaTrade = normalizeCcxtTrade(
  "bitget",
  connectionId,
  {
    id: "1322441401010528257",
    order: "1322441400976261120",
    symbol: "BTC/USDT:USDT",
    side: "sell",
    timestamp: 1751020520451,
    info: {
      execId: "1322441401010528257",
      orderId: "1322441400976261120",
      category: "USDT-FUTURES",
      symbol: "BTCUSDT",
      orderType: "market",
      side: "sell",
      execPrice: "107005.4",
      execQty: "0.0001",
      execValue: "10.70054",
      tradeSide: "close",
      feeDetail: [{ feeCoin: "USDT", fee: "0.00642032" }],
      createdTime: "1751020520451",
      execPnl: "0.00017"
    }
  },
  {
    id: "BTCUSDT",
    symbol: "BTC/USDT:USDT",
    contract: true,
    swap: true,
    linear: true,
    settle: "USDT",
    contractSize: "1"
  }
);
assert.ok(bitgetUtaTrade);
assert.equal(bitgetUtaTrade.externalTradeId, "1322441401010528257");
assert.equal(bitgetUtaTrade.quantityBase, "0.0001");
assert.equal(bitgetUtaTrade.price, "107005.4");
assert.equal(bitgetUtaTrade.quoteNotional, "10.70054");
assert.equal(bitgetUtaTrade.feeCurrency, "USDT");
assert.equal(bitgetUtaTrade.feeQuoteSigned, "-0.00642032");
assert.equal(bitgetUtaTrade.providerRealizedPnl, "0.00017");
assert.equal(bitgetUtaTrade.openClose, "close");
assert.equal(bitgetUtaTrade.executionType, "trade");
const bitgetMultiFeeTrade = normalizeCcxtTrade(
  "bitget",
  connectionId,
  {
    id: "multi-fee",
    symbol: "ETH/USDT:USDT",
    side: "buy",
    amount: 1,
    price: 100,
    timestamp: t0,
    info: {
      feeDetail: [
        { feeCoin: "USDT", fee: "0.001" },
        { feeCoin: "USDT", fee: "0.002" }
      ]
    }
  },
  { symbol: "ETH/USDT:USDT", contract: true, swap: true, linear: true, settle: "USDT" }
);
assert.equal(bitgetMultiFeeTrade?.feeQuoteSigned, "-0.003");
const bitgetMalformedMultiFeeTrade = normalizeCcxtTrade(
  "bitget",
  connectionId,
  {
    id: "malformed-multi-fee",
    symbol: "ETH/USDT:USDT",
    side: "buy",
    amount: 1,
    price: 100,
    timestamp: t0,
    info: {
      feeDetail: [
        { feeCoin: "USDT", fee: "N/A" },
        { feeCoin: "USDT", fee: "0.002" }
      ]
    }
  },
  { symbol: "ETH/USDT:USDT", contract: true, swap: true, linear: true, settle: "USDT" }
);
assert.equal(bitgetMalformedMultiFeeTrade?.feeQuoteSigned, null);
const ccxtRebateTrade = normalizeCcxtTrade(
  "bybit",
  connectionId,
  {
    id: "fee-rebate",
    symbol: "ETH/USDT:USDT",
    side: "buy",
    amount: 1,
    price: 100,
    timestamp: t0,
    fee: { cost: -0.001, currency: "USDT" }
  },
  { symbol: "ETH/USDT:USDT", contract: true, swap: true, linear: true, settle: "USDT" }
);
assert.equal(ccxtRebateTrade?.feeQuoteSigned, "0.001");
assert.equal(
  normalizeCcxtTrade(
    "bitget",
    connectionId,
    {
      id: "mixed-fee-currencies",
      symbol: "ETH/USDT:USDT",
      side: "buy",
      amount: 1,
      price: 100,
      timestamp: t0,
      info: {
        feeDetail: [
          { feeCoin: "USDT", fee: "0.001" },
          { feeCoin: "BGB", fee: "0.002" }
        ]
      }
    },
    { symbol: "ETH/USDT:USDT", contract: true, swap: true, linear: true, settle: "USDT" }
  ),
  null
);
assert.equal(
  normalizeCcxtTrade(
    "okx",
    connectionId,
    { id: "spot", symbol: "BTC/USDT", side: "buy", amount: 1, price: 1, timestamp: t0 },
    { symbol: "BTC/USDT", contract: false, swap: false, linear: true, settle: "USDT" }
  ),
  null
);
assert.equal(
  normalizeCcxtTrade(
    "okx",
    connectionId,
    {
      id: "dated-future",
      symbol: "BTC/USDT:USDT-260925",
      side: "buy",
      amount: 1,
      price: 1,
      timestamp: t0
    },
    {
      symbol: "BTC/USDT:USDT-260925",
      contract: true,
      swap: false,
      future: true,
      linear: true,
      settle: "USDT"
    }
  ),
  null
);
const malformedFee = normalizeCcxtTrade(
  "okx",
  connectionId,
  {
    id: "malformed-fee",
    symbol: "BTC/USDT:USDT",
    side: "buy",
    amount: 1,
    price: 100,
    fee: { cost: 0, currency: "USDT" },
    info: { fillSz: "1", fillPx: "100", fee: "N/A", feeCcy: "USDT", fillTime: String(t0), posSide: "net" }
  },
  { symbol: "BTC/USDT:USDT", contract: true, swap: true, linear: true, settle: "USDT" }
);
assert.ok(malformedFee);
assert.equal(malformedFee.feeQuoteSigned, null);
const feeLedger = normalizeCcxtCashflow("bybit", connectionId, {
  id: "fee-ledger",
  currency: "USDT",
  amount: 0.25,
  direction: "out",
  type: "commission",
  timestamp: t0
});
assert.equal(feeLedger?.amountQuoteSigned, "-0.25");
assert.equal(feeLedger?.reconciliationOnly, true);
for (const [provider, entry] of [
  ["okx", {
    id: "okx-funding",
    info: { type: "8", subType: "173", balChg: "-0.5", ccy: "USDT", ts: String(t0) }
  }],
  ["bybit", {
    id: "bybit-funding",
    info: { execType: "Funding", cashFlow: "-0.25", currency: "USDT", transactionTime: String(t0), timestamp: String(t0) }
  }],
  ["bitget", {
    id: "bitget-funding",
    info: {
      businessType: "CONTRACT_MAIN_SETTLE_FEE_USER_OUT",
      amount: "-0.2",
      coin: "USDT",
      ts: String(t0)
    }
  }],
  ["bingx", {
    id: "bingx-funding",
    info: { incomeType: "FUNDING_FEE", income: "0.3", asset: "USDT", time: String(t0) }
  }]
] as const) {
  const normalized = normalizeCcxtCashflow(provider, connectionId, entry);
  assert.equal(normalized?.type, "funding", `${provider} funding type`);
  assert.ok(normalized?.amountQuoteSigned, `${provider} funding amount`);
}
assert.deepEqual(
  normalizeCcxtOrderContext({
    id: "bitget-order",
    symbol: "BTC/USDT:USDT",
    info: {
      posSide: "long",
      holdMode: "one_way_mode",
      reduceOnly: "NO"
    }
  }),
  {
    externalOrderId: "bitget-order",
    symbol: "BTC/USDT:USDT",
    positionMode: "one_way",
    positionSide: "long",
    openClose: "unknown",
    reduceOnly: false
  }
);
const verifiedEpisode = reconstructRoundTrips(
  [
    fill("verified-open", 0, "buy", "1", "100", "-0.10", { openClose: "open" }),
    fill("verified-close", 1, "sell", "1", "110", "-0.11", { openClose: "close" })
  ],
  [],
  {
    flatAt: new Date(t0 - 1).toISOString(),
    openSymbols: []
  }
);
assert.equal(verifiedEpisode.roundTrips[0].quality, "complete");

const basicLong = reconstructRoundTrips([
  fill("long-open", 0, "buy", "1", "100", "-0.10"),
  fill("long-close", 1, "sell", "1", "110", "-0.11")
]);
assert.equal(basicLong.openPositionCount, 0);
assert.equal(basicLong.roundTrips.length, 1);
assert.equal(basicLong.roundTrips[0].realizedPnl, "10");
assert.equal(basicLong.roundTrips[0].feeTotal, "-0.21");
assert.equal(basicLong.roundTrips[0].netPnl, "9.79");
assert.equal(basicLong.roundTrips[0].quality, "partial");
assert.ok(basicLong.roundTrips[0].warnings.includes("initial_flat_state_unverified"));

const basicShort = reconstructRoundTrips([
  fill("short-open", 0, "sell", "2", "100", "-0.20"),
  fill("short-close", 1, "buy", "2", "90", "-0.18")
]);
assert.equal(basicShort.roundTrips[0].realizedPnl, "20");
assert.equal(basicShort.roundTrips[0].netPnl, "19.62");

const scaled = reconstructRoundTrips([
  fill("scale-1", 0, "buy", "1", "100", "-0.10"),
  fill("scale-2", 1, "buy", "1", "120", "-0.12"),
  fill("scale-3", 2, "sell", "0.5", "130", "-0.065"),
  fill("scale-4", 3, "sell", "1.5", "90", "-0.135")
]);
assert.equal(scaled.roundTrips[0].averageEntryPrice, "110");
assert.equal(scaled.roundTrips[0].realizedPnl, "-20");
assert.equal(scaled.roundTrips[0].netPnl, "-20.42");

const reversal = reconstructRoundTrips([
  fill("reverse-1", 0, "buy", "1", "100", "-0.10"),
  fill("reverse-2", 1, "sell", "1.5", "110", "-0.165", { providerRealizedPnl: "10" }),
  fill("reverse-3", 2, "buy", "0.5", "105", "-0.0525", { providerRealizedPnl: "2.5" })
]);
assert.equal(reversal.roundTrips.length, 2);
assert.equal(reversal.roundTrips[0].netPnl, "9.79");
assert.equal(reversal.roundTrips[0].providerRealizedPnl, "10");
assert.equal(reversal.roundTrips[1].netPnl, "2.3925");
assert.equal(reversal.roundTrips[1].providerRealizedPnl, "2.5");
assert.ok(reversal.roundTrips.every((row) => row.quality === "partial"));
assert.ok(reversal.roundTrips[1].warnings.includes("initial_flat_state_unverified"));

const hedge = reconstructRoundTrips([
  fill("hedge-long-open", 0, "buy", "1", "100", "-0.10", { positionMode: "hedge", positionSide: "long" }),
  fill("hedge-short-open", 1, "sell", "2", "105", "-0.21", { positionMode: "hedge", positionSide: "short" }),
  fill("hedge-long-close", 2, "sell", "1", "110", "-0.11", { positionMode: "hedge", positionSide: "long" }),
  fill("hedge-short-close-1", 3, "buy", "0.5", "95", "-0.0475", { positionMode: "hedge", positionSide: "short" }),
  fill("hedge-short-close-2", 4, "buy", "1.5", "100", "-0.15", { positionMode: "hedge", positionSide: "short" })
]);
assert.deepEqual(hedge.roundTrips.map((row) => row.netPnl), ["9.79", "12.0925"]);

const partialFills = reconstructRoundTrips([
  fill("partial-1", 0, "buy", "0.4", "100", "-0.04", { externalOrderId: "same-order" }),
  fill("partial-2", 1, "buy", "0.6", "101", "-0.0606", { externalOrderId: "same-order" }),
  fill("partial-close", 2, "sell", "1", "102", "-0.102")
]);
assert.equal(partialFills.roundTrips[0].averageEntryPrice, "100.6");
assert.equal(partialFills.roundTrips[0].netPnl, "1.1974");

const withFunding = reconstructRoundTrips([
  fill("fund-open", 0, "buy", "1", "100", "-0.10"),
  fill("fund-close", 2, "sell", "1", "110", "-0.11")
], [funding("funding-1", 1, "-1")]);
assert.equal(withFunding.roundTrips[0].fundingTotal, "-1");
assert.equal(withFunding.roundTrips[0].netPnl, "8.79");

const ambiguousFunding = reconstructRoundTrips([
  fill("ambiguous-open", 0, "buy", "1", "100", "-0.10"),
  fill("ambiguous-close", 2, "sell", "1", "110", "-0.11")
], [funding("ambiguous-funding", 1, "-1", {
  positionSide: "unknown",
  allocationStatus: "ambiguous"
})]);
assert.equal(ambiguousFunding.roundTrips[0].fundingTotal, "-1");
assert.equal(ambiguousFunding.roundTrips[0].netPnl, "8.79");

const ambiguousHedgeFunding = reconstructRoundTrips([
  fill("ambiguous-hedge-long-open", 0, "buy", "1", "100", "-0.10", {
    positionMode: "hedge",
    positionSide: "long"
  }),
  fill("ambiguous-hedge-short-open", 0, "sell", "1", "100", "-0.10", {
    positionMode: "hedge",
    positionSide: "short"
  }),
  fill("ambiguous-hedge-long-close", 2, "sell", "1", "110", "-0.11", {
    positionMode: "hedge",
    positionSide: "long"
  }),
  fill("ambiguous-hedge-short-close", 2, "buy", "1", "90", "-0.09", {
    positionMode: "hedge",
    positionSide: "short"
  })
], [funding("ambiguous-hedge-funding", 1, "-1", {
  positionSide: "unknown",
  allocationStatus: "ambiguous"
})]);
assert.ok(ambiguousHedgeFunding.roundTrips.every((row) => row.fundingTotal === "0"));
assert.ok(ambiguousHedgeFunding.roundTrips.every((row) => row.warnings.includes("funding_ambiguous")));

const nonQuoteFee = reconstructRoundTrips([
  fill("native-fee-open", 0, "buy", "1", "100", "0", {
    feeNativeSigned: "-0.001",
    feeCurrency: "BGB",
    feeQuoteSigned: null
  }),
  fill("native-fee-close", 1, "sell", "1", "110", "-0.11")
]);
assert.equal(nonQuoteFee.roundTrips[0].quality, "partial");
assert.ok(nonQuoteFee.roundTrips[0].warnings.includes("fee_quote_unavailable"));

const reduceOnlyOverflow = reconstructRoundTrips([
  fill("reduce-open", 0, "buy", "0.4", "100", "-0.04"),
  fill("reduce-overflow", 1, "sell", "1", "90", "-0.10", { reduceOnly: true })
]);
assert.equal(reduceOnlyOverflow.openPositionCount, 0);
assert.equal(reduceOnlyOverflow.roundTrips[0].quality, "partial");
assert.ok(reduceOnlyOverflow.roundTrips[0].warnings.includes("inconsistent_reduce_only"));
assert.ok(reduceOnlyOverflow.warnings.includes("inconsistent_reduce_only:reduce-overflow"));

const deduped = reconstructRoundTrips([
  fill("duplicate-open", 0, "buy", "1", "100", "-0.10"),
  fill("duplicate-open", 0, "buy", "1", "100", "-0.10"),
  fill("duplicate-close", 1, "sell", "1", "101", "-0.101")
]);
assert.equal(deduped.roundTrips[0].fillCount, 2);

const boundaryCrossing = reconstructRoundTrips([
  fill("boundary-close", 0, "sell", "1", "110", "-0.11"),
  fill("boundary-new-open", 1, "buy", "1", "100", "-0.10")
]);
assert.equal(boundaryCrossing.roundTrips.length, 1);
assert.equal(boundaryCrossing.roundTrips[0].quality, "partial");
assert.ok(boundaryCrossing.roundTrips[0].warnings.includes("initial_flat_state_unverified"));

const boundaryAfterUnmatchedReduceOnly = reconstructRoundTrips([
  fill("boundary-reduce-only", 0, "sell", "0.5", "115", "-0.05", { reduceOnly: true }),
  fill("boundary-close-remainder", 1, "sell", "0.5", "110", "-0.05"),
  fill("boundary-real-open", 2, "buy", "0.5", "100", "-0.05")
]);
assert.equal(boundaryAfterUnmatchedReduceOnly.roundTrips.length, 1);
assert.equal(boundaryAfterUnmatchedReduceOnly.roundTrips[0].quality, "partial");
assert.ok(boundaryAfterUnmatchedReduceOnly.roundTrips[0].warnings.includes("initial_flat_state_unverified"));

const repeatedBoundaryAmbiguity = reconstructRoundTrips([
  fill("boundary-old-close", 0, "sell", "1", "120", "-0.12"),
  fill("boundary-real-long-open", 1, "buy", "1", "110", "-0.11"),
  fill("boundary-real-long-close", 2, "sell", "1", "100", "-0.10"),
  fill("boundary-next-long-open", 3, "buy", "1", "90", "-0.09")
]);
assert.equal(repeatedBoundaryAmbiguity.roundTrips.length, 2);
assert.ok(repeatedBoundaryAmbiguity.roundTrips.every((row) => row.quality === "partial"));

const analytics = calculateExchangeAnalytics([
  {
    id: "winner",
    provider: "okx",
    symbol: "BTC/USDT:USDT",
    positionSide: "long",
    closedAt: new Date(t0).toISOString(),
    netPnl: "10",
    feeTotal: "-1",
    fundingTotal: "0",
    quality: "complete",
    keptPrinciples: ["entry", "risk"],
    brokenPrinciples: []
  },
  {
    id: "loser",
    provider: "bybit",
    symbol: "ETH/USDT:USDT",
    positionSide: "short",
    closedAt: new Date(t0 + 60_000).toISOString(),
    netPnl: "-4",
    feeTotal: "-0.5",
    fundingTotal: "0.2",
    quality: "complete",
    keptPrinciples: [],
    brokenPrinciples: ["stop"]
  },
  {
    id: "breakeven",
    provider: "bitget",
    symbol: "BTC/USDT:USDT",
    positionSide: "long",
    closedAt: new Date(t0 + 120_000).toISOString(),
    netPnl: "0",
    feeTotal: "0",
    fundingTotal: "0",
    quality: "complete"
  },
  {
    id: "partial-excluded",
    provider: "bingx",
    symbol: "BTC/USDT:USDT",
    positionSide: "long",
    closedAt: new Date(t0 + 180_000).toISOString(),
    netPnl: "999",
    feeTotal: "0",
    fundingTotal: "0",
    quality: "partial"
  }
]);
assert.equal(analytics.completedTrades, 3);
assert.equal(analytics.winRate, 0.5);
assert.equal(analytics.breakeven, 1);
assert.equal(analytics.netPnl, "6");
assert.equal(analytics.profitFactor, "2.5");
assert.equal(analytics.maxRealizedDrawdown, "4");
assert.equal(analytics.reviewedTrades, 2);
assert.equal(analytics.principleComplianceRate, 2 / 3);
assert.equal(
  calculateExchangeAnalytics([
    {
      id: "only-winner",
      provider: "okx",
      symbol: "BTC/USDT:USDT",
      positionSide: "long",
      closedAt: new Date(t0).toISOString(),
      netPnl: "1",
      feeTotal: "0",
      fundingTotal: "0",
      quality: "complete"
    }
  ]).profitFactor,
  "infinite"
);

const retryConnection: ExchangeSyncWindowConnection = {
  provider: "okx",
  first_sync_from: "2026-06-01T00:00:00.000Z"
};
const retryWindow = buildSyncWindow(retryConnection, {
  watermark: "2026-07-20T00:00:00.000Z",
  cursor: {
    retryUntil: "2026-07-14T00:00:00.000Z",
    retryFloor: "2026-07-13T00:00:00.000Z",
    retrySpanMs: 3_600_000,
    retryTargetWatermark: "2026-07-20T00:00:00.000Z",
    retryResumePhase: "backfill",
    retryResumeBackfillBefore: "2026-07-13T00:00:00.000Z"
  }
});
assert.equal(retryWindow.phase, "retry");
assert.equal(retryWindow.since, "2026-07-13T23:00:00.000Z");
assert.equal(retryWindow.until, "2026-07-14T00:00:00.000Z");
assert.equal(retryWindow.retry?.resumePhase, "backfill");

const decisionCandidates = matchSavedDecisionCandidates(
  [
    {
      id: "position-btc",
      userId,
      symbol: "BTC/USDT:USDT",
      openedAt: new Date(t0).toISOString()
    },
    {
      id: "position-sol",
      userId,
      symbol: "SOL/USDT:USDT",
      openedAt: new Date(t0).toISOString()
    }
  ],
  [
    {
      id: "outside-window",
      userId,
      source: "snapshot",
      savedAt: new Date(t0 - 6 * 60 * 60 * 1000 - 1).toISOString(),
      decisionSnapshotId: "outside",
      decisionContext: { asset: "btc", snapshotId: "outside" }
    },
    {
      id: "boundary-window",
      userId,
      source: "snapshot",
      savedAt: new Date(t0 - 6 * 60 * 60 * 1000).toISOString(),
      decisionSnapshotId: "boundary",
      decisionContext: { asset: "btc", snapshotId: "boundary" }
    },
    {
      id: "wrong-asset",
      userId,
      source: "alert",
      savedAt: new Date(t0 - 1).toISOString(),
      decisionSnapshotId: "eth",
      decisionContext: { asset: "eth", snapshotId: "eth" }
    },
    {
      id: "other-user",
      userId: "20000000-0000-4000-8000-000000000099",
      source: "news",
      savedAt: new Date(t0).toISOString(),
      decisionSnapshotId: "other",
      decisionContext: { asset: "btc", snapshotId: "other" }
    },
    {
      id: "latest-owned",
      userId,
      source: "news",
      savedAt: new Date(t0).toISOString(),
      decisionSnapshotId: null,
      decisionContext: {
        asset: "btc",
        snapshotId: "retained-context-id",
        headline: "저장한 판단",
        topRisk: "무효화 기준",
        primaryCondition: { label: "조건 확인" }
      }
    }
  ],
  userId
);
assert.equal(decisionCandidates.get("position-btc")?.journalId, "latest-owned");
assert.equal(decisionCandidates.get("position-btc")?.snapshotId, "retained-context-id");
assert.equal(decisionCandidates.get("position-btc")?.snapshotAvailable, false);
assert.equal(decisionCandidates.has("position-sol"), false);

console.log("Exchange permission, crypto, normalization, round-trip, and analytics fixtures passed.");
