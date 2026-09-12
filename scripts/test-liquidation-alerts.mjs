import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const native = createRequire(import.meta.url);
const now = Math.floor(Date.now() / 900000) * 900000 + 120000;
class TestDate extends Date { static now() { return now; } }
const a = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", b = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
let userId = a, failStore = false, failFcm = false, failPatch = false;
const records = new Map(), sent = [], queries = [];
const stubs = {
  "@/lib/server/firebaseMessaging": { sendFcmMessage: async message => {
    assert([...records.values()].some(row => row.delivery_status === "sending"), "record must precede FCM");
    assert(Object.values(message.data).every(v => typeof v === "string")); sent.push(message);
    if (failFcm) throw Error("test transport failure");
  } },
  "@/lib/server/supabaseAdmin": {
    isSupabaseAdminConfigured: () => true,
    fetchSupabaseUserOnServer: async () => ({ id: userId }),
    supabaseAdminRest: async (path, options) => {
      queries.push(path); if (failStore) throw Error("test store unavailable");
      if (options?.method === "POST") {
        assert.equal(options.prefer, "resolution=ignore-duplicates,return=representation");
        const key = options.body.user_id + options.body.event_key;
        if (records.has(key)) return [];
        const row = JSON.parse(JSON.stringify({ ...options.body, id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" }));
        records.set(key, row); return [{ id: row.id }];
      }
      if (options?.method === "PATCH") {
        if (failPatch) throw Error("test result persistence unavailable");
        for (const row of records.values()) if (path.includes("user_id=eq." + row.user_id)) Object.assign(row, options.body);
        return null;
      }
      if (path.includes("event_key=eq.")) {
        const p = new URLSearchParams(path.split("?")[1]);
        assert.equal(p.get("rule_id"), "eq.liquidation-pressure"); assert.equal(p.get("limit"), "1");
        return [...records.values()].filter(row => "eq." + row.user_id === p.get("user_id") && "eq." + row.event_key === p.get("event_key"));
      }
      if (path.includes("rule_id=eq.liquidation-pressure")) return [];
      throw Error("Unexpected query " + path);
    }
  },
  "@/lib/server/rateLimit": { rateLimit: async () => ({ allowed: true }) },
  "@/lib/server/newsImpactMode": { newsImpactRuntimePolicy: () => ({ expose: true }) },
  "@/lib/perpetualMonitor": { isUuid: value => typeof value === "string" && /^[a-f0-9-]{36}$/.test(value) }
};
const cache = new Map();
function load(file) {
  file = resolve(file); if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  vm.runInNewContext(ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    module, exports: module.exports, Date: TestDate, Intl, URL, URLSearchParams, Request, Response, AbortSignal, console,
    require: name => {
      if (stubs[name]) return stubs[name];
      if (name.startsWith("@/")) return load(resolve("src", name.slice(2)) + ".ts");
      if (name.startsWith(".")) return load(resolve(dirname(file), name) + ".ts");
      return native(name);
    }
  }); return module.exports;
}
const lib = load("src/lib/liquidationAlert.ts");
const { cooldownDecisionForEvent } = load("src/lib/server/push/cooldown.ts");
const { withLiquidationChange } = load("src/lib/server/push/liquidationChange.ts");
const { latestLiquidationSentEvent } = load("src/lib/server/push/duplicateGuard.ts");
const { deliverLiquidationEvent } = load("src/lib/server/push/liquidationDelivery.ts");
const { resolvePushTargetPath } = load("src/lib/pushTargetPath.ts");
const { GET } = load("src/app/api/push-alert-events/route.ts");
const observed = now - 15 * 60000;
const report = { symbol: "BTCUSDT", period: "15m", grade: "heated", dominantSide: "downsideLongs",
  upsideShortPressure: 20, downsideLongPressure: 66, fundingRatePercent: 0.01, fundingRateSource: "Binance", openInterestChangePercent: 1,
  globalLongShort: { longPercent: 60, shortPercent: 40 }, topAccountLongShort: { longPercent: 60, shortPercent: 40 },
  topPositionLongShort: { longPercent: 60, shortPercent: 40 }, takerFlow: { buyPercent: 55, sellPercent: 45 },
  evidenceObservedAt: Object.fromEntries(["fundingRate", "openInterest", "globalLongShort", "topAccountLongShort", "topPositionLongShort", "takerFlow"].map(k => [k, observed])) };
assert(lib.liquidationInputsReady(report));
for (const key of Object.keys(report.evidenceObservedAt)) for (const invalid of [null, now + 1000, now - (key === "fundingRate" ? 10 * 3600000 : 3600000)]) {
  assert.equal(lib.liquidationInputsReady({ ...report, evidenceObservedAt: { ...report.evidenceObservedAt, [key]: invalid } }), false, key);
}
assert.equal(lib.liquidationInputsReady({ ...report, globalLongShort: { longPercent: null, shortPercent: null } }), false);
assert.equal(lib.liquidationInputsReady({ ...report, dominantSide: "balanced" }), false);
assert.equal(lib.liquidationInputsReady({ ...report, fundingRateSource: "OKX 참고값" }), false);
console.log("PASS missing, stale, future and mismatched-source inputs fail closed");
const latestOpen = Math.floor(now / 900000) * 900 - 900;
const candles = Array.from({ length: 5 }, (_, i) => ({ time: latestOpen + (i - 4) * 900, open: 80000, high: 81000, low: i === 4 ? 78000 : 79000, close: i === 4 ? 78500 : 80000, volume: 10 }));
const prices = lib.liquidationPriceContext(candles);
assert.equal(prices.low, 79000); assert.equal(prices.close, 78500);
assert.equal(lib.liquidationPriceContext(candles.slice(1)), null);
assert.equal(lib.liquidationPriceContext(candles.map((c, i) => i === 2 ? { ...c, time: c.time - 900 } : c)), null);
assert.equal(lib.liquidationPriceContext(candles.map(c => ({ ...c, time: c.time + 900 }))), null);
const snapshot = { version: 2, symbol: "BTCUSDT", observedAt: new Date(now).toISOString(), side: "downsideLongs", pressure: 66, longAccountPercent: 60, shortAccountPercent: 40, prices };
assert(lib.readLiquidationAlertSnapshot(snapshot));
assert.equal(lib.readLiquidationAlertSnapshot({ ...snapshot, prices: { ...prices, low: 1 } }), null);
assert.match(lib.liquidationNextCheck(snapshot), /79,000.*다음 15분봉.*회복/);
assert(!lib.liquidationNextCheck(snapshot).includes("지지"));
console.log("PASS reference excludes the latest candle, rejects gaps/forming candles, and preserves the historical price");
const key = lib.liquidationAlertKey(snapshot);
const event = { market: "crypto", ruleId: "liquidation-pressure", alertKind: "liquidation", symbol: "BTCUSDT", eventKey: key, title: "BTC 하락 시 롱 청산 주의",
  body: lib.liquidationNextCheck(snapshot), data: { type: "liquidation-pressure", destination: "liquidation_alert", event_key: key, symbol: "BTCUSDT", pressure: "66", pressure_side: "downsideLongs" },
  auditEvidence: { version: 1, source: "liquidation_inputs", capturedAt: snapshot.observedAt, snapshot: { alert: snapshot } } };
const recent = (minutes, pressure = "66", side = "downsideLongs") => ({ market: "crypto", rule_id: "liquidation-pressure", event_key: "old", created_at: new Date(now - minutes * 60000).toISOString(), payload: { symbol: "BTCUSDT", pressure, pressure_side: side, sentCount: 1 } });
for (const minutes of [25 * 60, 7 * 24 * 60]) assert.equal(cooldownDecisionForEvent([recent(minutes)], event).reason, "unchanged_pressure");
assert.equal(cooldownDecisionForEvent([{ ...recent(10), delivery_status: "failed", payload: { ...recent(10).payload, sentCount: 0 } }], event).blocked, false);
assert.equal(cooldownDecisionForEvent([recent(60, "60", "upsideShorts")], event).blocked, false);
assert.equal(cooldownDecisionForEvent([recent(5, "60", "upsideShorts")], event).blocked, true);
assert.equal(cooldownDecisionForEvent([recent(60, "60", "balanced")], event).blocked, true);
assert.equal(cooldownDecisionForEvent([recent(240, "95", "balanced")], event).blocked, false);
assert.notEqual(lib.liquidationAlertKey({ ...snapshot, side: "upsideShorts" }), key);
const personalized = withLiquidationChange(event, [recent(300, "55")]);
assert.match(personalized.body, /55 → 66\/100/);
assert.equal(personalized.auditEvidence.snapshot.alert.change.previousPressure, 55);
await latestLiquidationSentEvent(a);
assert.match(queries.at(-1), /payload->>sentCount.gt.0/); assert(!queries.at(-1).includes("created_at=gte"));
console.log("PASS repeat suppression crosses days, meaningful reversals bypass 3h, and prior accepted legacy events are included");
assert.equal(resolvePushTargetPath(event.data), "/crypto/liquidation-alert?event=" + encodeURIComponent(key));
assert.equal(resolvePushTargetPath({ ...event.data, event_key: "https://bad.invalid" }), "/crypto/alertlist");
const targets = [{ id: "device", token: "fixture-token" }];
const tomorrow = { ...snapshot, observedAt: new Date(now + 86400000).toISOString(), prices: lib.liquidationPriceContext(candles.map(c => ({ ...c, time: c.time + 86400 })), now + 86400000) };
const futureEvent = { ...event, eventKey: lib.liquidationAlertKey(tomorrow), auditEvidence: { ...event.auditEvidence, snapshot: { alert: tomorrow } } };
assert.equal((await deliverLiquidationEvent(a, targets, futureEvent)).sent, 0); assert.equal(records.size, 0);
const delivered = await Promise.all([deliverLiquidationEvent(a, targets, personalized), deliverLiquidationEvent(a, targets, personalized)]);
assert.equal(delivered.reduce((sum, x) => sum + x.sent, 0), 1); assert.equal(sent.length, 1);
assert.equal([...records.values()][0].sent_count, 1);
assert(sent[0].ttlSeconds > 0 && sent[0].ttlSeconds <= 300);
failStore = true;
await assert.rejects(deliverLiquidationEvent(b, targets, personalized)); assert.equal(sent.length, 1); failStore = false;
failFcm = true;
const failed = await deliverLiquidationEvent(b, targets, personalized);
assert.equal(failed.failed, 1); assert.equal(records.get(b + key).delivery_status, "failed"); failFcm = false;
failPatch = true;
const c = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
await assert.rejects(deliverLiquidationEvent(c, targets, personalized));
assert.equal(records.get(c + key).delivery_status, "sending");
const beforeRetry = sent.length;
assert.equal((await deliverLiquidationEvent(c, targets, personalized)).duplicate, 1);
assert.equal(sent.length, beforeRetry); failPatch = false;
console.log("PASS atomic duplicate claim, save-before-send, TTL, store failure and transport failure handling");
const request = () => new Request("https://fixture.invalid/api/push-alert-events?market=crypto&event=" + encodeURIComponent(key), { headers: { Authorization: "Bearer fixture" } });
let response = await GET(request()); assert.equal(response.status, 200); assert.match(response.headers.get("cache-control"), /private.*no-store/);
assert.equal((await response.json()).events[0].payload.auditEvidence.snapshot.alert.change.previousPressure, 55);
userId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"; response = await GET(request()); assert.equal((await response.json()).events.length, 0);
assert.equal((await GET(new Request("https://fixture.invalid/api/push-alert-events?event=" + encodeURIComponent(key)))).status, 401);
console.log("PASS owned event retrieval, cross-account isolation and anonymous rejection");
console.log("Liquidation quality regression passed; no live database or FCM calls.");
