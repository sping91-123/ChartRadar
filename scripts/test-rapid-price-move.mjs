import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const nativeRequire = createRequire(import.meta.url);
const now = Math.floor(Date.now() / 60000) * 60000 + 10000;
class TestDate extends Date { static now() { return now; } }
const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
let admin = true, deleted = false, failFcm = false, sourceFlat = false, queryCount = 0;
let tokens = [{ id: "fixture-device", user_id: owner, token: "fixture-token", markets: ["crypto"], rule_ids: ["rapid-price-move"] }];
const records = new Map(), sent = [], queries = [];
const stubs = {
  "@/lib/server/supabaseAdmin": {
    isSupabaseAdminConfigured: () => true,
    fetchSupabaseUserOnServer: async () => ({ id: owner }),
    supabaseAdminAuth: async () => ({ id: owner, app_metadata: admin ? { role: "admin" } : {} }),
    supabaseAdminRest: async (path, options) => {
      queryCount++; queries.push(path);
      if (path.startsWith("push_tokens?")) { assert.match(path, /rule_ids=cs\.\{rapid-price-move\}/); return tokens; }
      if (path.startsWith("subscriptions?")) return [];
      if (path.startsWith("account_deletion_requests?")) return deleted ? [{ user_id: owner }] : [];
      if (options?.method === "POST") {
        assert.equal(path, "push_alert_events?on_conflict=user_id,event_key&select=id");
        assert.equal(options.prefer, "resolution=ignore-duplicates,return=representation");
        const key = options.body.user_id + options.body.event_key;
        if (records.has(key)) return [];
        records.set(key, JSON.parse(JSON.stringify({ id: "fixture-row", ...options.body })));
        return [{ id: "fixture-row" }];
      }
      if (options?.method === "PATCH") {
        for (const row of records.values()) Object.assign(row, options.body);
        return null;
      }
      if (path.startsWith("push_alert_events?")) {
        if (path.includes("event_key=eq.")) {
          const params = new URLSearchParams(path.split("?")[1]);
          assert.equal(params.get("user_id"), `eq.${owner}`);
          assert.equal(params.get("rule_id"), "eq.rapid-price-move");
          assert.equal(params.get("limit"), "1");
          return [...records.values()].filter(row => row.user_id === owner && `eq.${row.event_key}` === params.get("event_key"));
        }
        return [];
      }
      throw Error(`Unexpected query ${path}`);
    }
  },
  "@/lib/server/firebaseMessaging": { isFirebaseMessagingConfigured: () => true, sendFcmMessage: async message => {
    assert.equal([...records.values()][0]?.delivery_status, "sending", "chart must be saved before delivery");
    sent.push(message); if (failFcm) throw Error("fixture failure");
  } },
  "@/lib/server/rateLimit": { rateLimit: async () => ({ allowed: true }) },
  "@/lib/server/newsImpactMode": { newsImpactRuntimePolicy: () => ({ expose: false }) }
};
const cache = new Map();
function load(file) {
  file = resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  vm.runInNewContext(ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    module, exports: module.exports, Date: TestDate, URL, URLSearchParams, Request, Response, AbortSignal, console,
    process: { env: { CRON_SECRET: "fixture-cron", NODE_ENV: "production" } },
    fetch: async url => {
      assert.match(url, /^https:\/\/fapi.binance.com\/fapi\/v1\/klines\?symbol=(BTCUSDT|ETHUSDT)&interval=1m&limit=62$/);
      return { ok: true, json: async () => fixtureCandles(sourceFlat ? 0 : 2).map(c => [c.time * 1000, String(c.open), String(c.high), String(c.low), String(c.close), String(c.volume), (c.time + 60) * 1000 - 1]) };
    },
    require: name => {
      if (name in stubs) return stubs[name];
      const local = name.startsWith("@/") ? resolve("src", name.slice(2)) : name.startsWith(".") ? resolve(dirname(file), name) : null;
      return local ? load(`${local}.ts`) : nativeRequire(name);
    }
  }, { filename: file });
  return module.exports;
}
function fixtureCandles(change = 1.2, minutes = 5) {
  const lastTime = Math.floor(now / 60000) * 60 - 60;
  return Array.from({ length: 61 }, (_, i) => {
    const progress = Math.max(0, (i - (60 - minutes)) / minutes);
    const close = 65000 * (1 + change * progress / 100);
    const open = 65000 * (1 + change * Math.max(0, progress - 1 / minutes) / 100);
    return { time: lastTime - (60 - i) * 60, open, close, high: Math.max(open, close) + 2, low: Math.min(open, close) - 2, volume: progress > 0 ? 30 : 10 };
  });
}
const core = load("src/lib/rapidPriceMove.ts");
const { rapidMoveToEvent, scanRapidMoveEvent } = load("src/lib/server/push/scanners/rapidMoveScanner.ts");
const { sameRapidMove, deliverRapidMoveEvent, runRapidMoveScan } = load("src/lib/server/push/rapidMoveDelivery.ts");
const { resolvePushTargetPath } = load("src/lib/pushTargetPath.ts");
const { GET: historyGet } = load("src/app/api/push-alert-events/route.ts");
const { GET: cronGet } = load("src/app/api/rapid-move-cron/route.ts");
const up = core.detectRapidPriceMove("BTCUSDT", fixtureCandles(), now);
const down = core.detectRapidPriceMove("ETHUSDT", fixtureCandles(-2), now);
let failures = 0;
async function check(label, fn) { try { await fn(); console.log(`PASS ${label}`); } catch (e) { failures++; console.error(`FAIL ${label}: ${e.stack}`); } }
await check("BTC/ETH use distinct thresholds and both windows produce one event", () => {
  assert.equal(up.windowMinutes, 5); assert.equal(down.direction, "down");
  assert.equal(core.detectRapidPriceMove("ETHUSDT", fixtureCandles(1.2), now), null);
  assert.equal(core.detectRapidPriceMove("BTCUSDT", fixtureCandles(2.2, 15), now).windowMinutes, 15);
  assert.equal(core.detectRapidPriceMove("BTCUSDT", fixtureCandles(0.9), now), null);
});
await check("incomplete, stale, missing, duplicated and invalid bars cannot manufacture alerts", () => {
  assert.equal(core.detectRapidPriceMove("BTCUSDT", fixtureCandles(), now + 180000), null);
  for (const candles of [fixtureCandles().filter((_,i)=>i!==40), [...fixtureCandles().slice(0,60), fixtureCandles()[59]], fixtureCandles().map((c,i)=>i===60?{...c,low:-1}:c)]) assert.equal(core.detectRapidPriceMove("BTCUSDT", candles, now), null);
  const forming = { ...fixtureCandles()[60], time: Math.floor(now / 60000) * 60, high: 70000, close: 69000 };
  assert.equal(core.detectRapidPriceMove("BTCUSDT", [...fixtureCandles(0), forming], now), null);
});
await check("stored chart reproduces its numbers; modified snapshots fail validation", () => {
  assert.equal(core.readRapidMoveSnapshot(JSON.parse(JSON.stringify(up))).endPrice, up.endPrice);
  assert.equal(core.readRapidMoveSnapshot({ ...up, endPrice: 1 }), null);
  assert.equal(core.readRapidMoveSnapshot({ ...up, candles: [null] }), null);
  assert.match(core.rapidMoveNextCheck(up), /고가.*유지/);
  assert.match(core.rapidMoveNextCheck(down), /저가.*회복/);
});
const event = rapidMoveToEvent(up);
await check("overlapping windows suppress repeated moves and allow genuine extension or reversal", () => {
  const row = { event_key: "previous", rule_id: "rapid-price-move", created_at: new Date(now - 6 * 60000).toISOString(), payload: event.data };
  assert.equal(sameRapidMove([row], event, now), true);
  assert.equal(sameRapidMove([row], { ...event, data: { ...event.data, direction: "down" } }, now), false);
  assert.equal(sameRapidMove([row], { ...event, data: { ...event.data, end_price: String(up.endPrice * 1.015) } }, now), false);
  assert.equal(sameRapidMove([{ ...row, created_at: new Date(now - 60000).toISOString() }], event, now), true);
});
await check("concurrent duplicate delivery sends once and persists the chart before FCM", async () => {
  records.clear(); sent.length = 0;
  await Promise.all([deliverRapidMoveEvent(owner, tokens, event), deliverRapidMoveEvent(owner, tokens, event)]);
  assert.equal(sent.length, 1); assert.equal(records.size, 1);
  assert.equal([...records.values()][0].delivery_status, "sent");
  assert.equal(sent[0].data.auditEvidence, undefined);
  assert.ok(sent[0].ttlSeconds > 0 && sent[0].ttlSeconds <= 120);
  assert.ok(Buffer.byteLength(JSON.stringify(sent[0].data)) < 2000);
});
await check("preferences and stale delivery prevent sends; FCM failures retain a failed record", async () => {
  records.clear(); sent.length = 0;
  await deliverRapidMoveEvent(owner, [{ ...tokens[0], rule_ids: [] }], event);
  await deliverRapidMoveEvent(owner, tokens, { ...event, data: { ...event.data, observed_at: new Date(now - 180000).toISOString() } });
  assert.equal(sent.length, 0); assert.equal(records.size, 0);
  failFcm = true; await deliverRapidMoveEvent(owner, tokens, event); failFcm = false;
  assert.equal([...records.values()][0].delivery_status, "failed");
  assert.equal([...records.values()][0].payload.sentCount, 0);
});
await check("natural quiet scans use no account reads; dry-run and Basic/deletion gates write nothing", async () => {
  sourceFlat = true; queryCount = 0;
  assert.equal((await runRapidMoveScan()).candidates, 0); assert.equal(queryCount, 0);
  sourceFlat = false; records.clear(); sent.length = 0;
  assert.equal((await runRapidMoveScan({ dryRun: true })).wouldSend, 2);
  assert.equal(records.size, 0); assert.equal(sent.length, 0);
  admin = false; assert.equal((await runRapidMoveScan()).sent, 0);
  admin = true; deleted = true; assert.equal((await runRapidMoveScan()).sent, 0); deleted = false;
  assert.equal(records.size, 0);
});
await check("deep links and authenticated history return the exact owned event only", async () => {
  assert.equal(resolvePushTargetPath(event.data), `/crypto/price-alert?event=${encodeURIComponent(event.eventKey)}`);
  assert.equal(resolvePushTargetPath({ ...event.data, event_key: "https://evil.invalid" }), "/crypto/alertlist");
  const request = key => new Request(`https://fixture.invalid/api/push-alert-events?event=${encodeURIComponent(key)}`, { headers: { authorization: "Bearer fixture" } });
  records.clear(); sent.length = 0; await deliverRapidMoveEvent(owner, tokens, event);
  const response = await historyGet(request(event.eventKey));
  assert.equal(response.status, 200); assert.equal((await response.json()).events.length, 1);
  assert.match(response.headers.get("cache-control"), /private.*no-store/);
  assert.equal((await historyGet(request("bad,key"))).status, 400);
  assert.equal((await historyGet(new Request("https://fixture.invalid/api/push-alert-events"))).status, 401);
  for (const row of records.values()) row.user_id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  assert.equal((await (await historyGet(request(event.eventKey))).json()).events.length, 0);
});
await check("cron requires its secret before any scan and supports a read-only diagnostic", async () => {
  assert.equal((await cronGet(new Request("https://fixture.invalid/api/rapid-move-cron"))).status, 401);
  records.clear(); sent.length = 0;
  assert.equal((await cronGet(new Request("https://fixture.invalid/api/rapid-move-cron?dryRun=1", { headers: { authorization: "Bearer fixture-cron" } }))).status, 200);
  assert.equal(sent.length, 0); assert.equal(records.size, 0);
  assert.equal((await scanRapidMoveEvent("BTCUSDT")).data.timeframe, "1m");
});
if (process.argv.includes("--write-fixture")) { mkdirSync("output/rapid-move", { recursive: true }); writeFileSync("output/rapid-move/fixtures.json", JSON.stringify({ up, down, event }, null, 2)); }
if (failures) process.exitCode = 1;
else console.log("Rapid move regression passed; fixtures only, no live FCM or database mutations.");
