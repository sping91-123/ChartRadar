import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import vm from "node:vm";
import ts from "typescript";

const now = Date.now();
const releaseAt = new Date(Math.floor((now + 30 * 60000) / 60000) * 60000).toISOString();
let calendar = { items: [] };
let report = {
  symbol: "BTCUSDT", period: "15m", grade: "heated", dominantSide: "downsideLongs",
  upsideShortPressure: 23, downsideLongPressure: 59, globalLongShort: { longPercent: 67.4, shortPercent: 32.6 }
};
let recordingEnabled = false;
const recordedEvents = [];
const fcmCalls = [];
let failDelivery = false;
const stubs = {
  "@/lib/server/supabaseAdmin": { supabaseAdminRest: async (path, options) => {
    assert.ok(recordingEnabled, "Unexpected database access");
    if (!options) {
      assert.match(path, /^push_alert_events\?select=id&/);
      return [];
    }
    assert.equal(path, "push_alert_events");
    assert.equal(options.method, "POST");
    recordedEvents.push(JSON.parse(JSON.stringify(options.body)));
    return [];
  } },
  "@/lib/server/firebaseMessaging": { sendFcmMessage: async (message) => {
    fcmCalls.push(message);
    if (failDelivery) throw new Error("fixture delivery failure");
    return { name: "fixture-message" };
  } },
  "@/lib/server/liquidationPressureSource": { fetchLiquidationPressureReport: async () => report }
};
const cache = new Map();
function load(path) {
  path = resolve(path);
  if (cache.has(path)) return cache.get(path).exports;
  const module = { exports: {} };
  cache.set(path, module);
  const code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  vm.runInNewContext(code, {
    exports: module.exports, module, Date, Intl, Map, Set, URL, URLSearchParams,
    fetch: async url => {
      assert.equal(url, "https://fixture.invalid/api/macro-calendar");
      return { ok: true, headers: { get: () => "application/json" }, json: async () => calendar };
    },
    require: name => {
      if (name in stubs) return stubs[name];
      const local = name.startsWith("@/") ? resolve("src", name.slice(2)) : name.startsWith(".") ? resolve(dirname(path), name) : null;
      assert.ok(local, `Unexpected dependency: ${name}`);
      return load(`${local}.ts`);
    }
  }, { filename: path });
  return module.exports;
}
const { cooldownDecisionForEvent } = load("src/lib/server/push/cooldown.ts");
const { scanLiquidationEvent } = load("src/lib/server/push/scanners/liquidationScanner.ts");
const { scanMacroCalendarEvent } = load("src/lib/server/push/scanners/macroScanner.ts");
const { setupToEvent } = load("src/lib/server/push/eventBuilders.ts");
const { personalizeEventForUser } = load("src/lib/server/push/personalization.ts");
const { resolvePushTargetPath } = load("src/lib/pushTargetPath.ts");
const { sendEventToUser } = load("src/lib/server/push/sendPush.ts");
const { buildLiquidationPressureReport } = load("src/lib/liquidationPressure.ts");
const failures = [];
async function check(label, fn) {
  try { await fn(); console.log(`PASS ${label}`); }
  catch (error) { failures.push(label); console.error(`FAIL ${label}: ${error.message}`); }
}
const recent = (event, minutes, patch = {}) => ({
  event_key: event.eventKey, market: event.market, rule_id: event.ruleId,
  created_at: new Date(now - minutes * 60000).toISOString(), payload: { ...event.data, ...patch }
});
const pressureEvent = await scanLiquidationEvent();
await check("pressure copy names the vulnerable side, observed evidence and next check", () => {
  assert.match(pressureEvent.title, /하락 시 롱 청산 주의/);
  assert.match(pressureEvent.body, /67.4%.*추정 59\/100.*15분봉.*지지 유지/);
  assert.equal(pressureEvent.data.pressure_side, "downsideLongs");
});
await check("unchanged pressure is not repeated after the old three-hour timer", () => {
  assert.equal(cooldownDecisionForEvent([recent(pressureEvent, 240, { pressure: "57" })], pressureEvent).reason, "unchanged_pressure");
  const legacy = recent(pressureEvent, 240, { pressure: "55" });
  delete legacy.payload.pressure_side;
  assert.equal(cooldownDecisionForEvent([legacy], pressureEvent).blocked, true);
});
await check("material increase, extreme transition and a changed side remain eligible", () => {
  const higher = { ...pressureEvent, data: { ...pressureEvent.data, pressure: "69" } };
  assert.equal(cooldownDecisionForEvent([recent(pressureEvent, 240)], higher).blocked, false);
  assert.equal(cooldownDecisionForEvent([recent(pressureEvent, 240, { pressure: "74" })], { ...higher, data: { ...higher.data, pressure: "75" } }).blocked, false);
  assert.equal(cooldownDecisionForEvent([recent(pressureEvent, 240, { pressure_side: "upsideShorts" })], pressureEvent).blocked, false);
  assert.equal(cooldownDecisionForEvent([recent(pressureEvent, 60)], higher).reason, "symbol_cooldown");
  assert.equal(cooldownDecisionForEvent([recent(pressureEvent, 24 * 60 + 1)], pressureEvent).blocked, false);
  assert.equal(cooldownDecisionForEvent([], pressureEvent).blocked, false);
});
await check("normal pressure does not generate an alert; short-side copy uses resistance", async () => {
  report = { ...report, grade: "normal" };
  assert.equal(await scanLiquidationEvent(), null);
  report = { ...report, grade: "heated", dominantSide: "upsideShorts", upsideShortPressure: 60, downsideLongPressure: 23 };
  const shortEvent = await scanLiquidationEvent();
  assert.match(shortEvent.body, /숏 계정 32.6%.*저항 돌파/);
  assert.match(shortEvent.title, /상승 시 숏 청산 주의/);
  assert.doesNotMatch(shortEvent.title, /쏠림/);
});
const item = (label, at = releaseAt) => ({ label, releaseAt: at, importance: 3 });
calendar = { items: [item("Core PPI MoM"), item("Core PPI m/m"), item("PPI MoM"), item("Initial Jobless Claims")] };
const macroEvent = await scanMacroCalendarEvent("https://fixture.invalid", "crypto");
await check("one release group has Korean labels and stable identity across labels and offsets", async () => {
  assert.match(macroEvent.body, /근원 생산자물가/);
  assert.equal(macroEvent.body.split("근원 생산자물가").length - 1, 1);
  assert.match(macroEvent.body, /신규 실업수당/);
  assert.match(macroEvent.title, /발표 전 확인/);
  const offset = new Date(Date.parse(releaseAt) + 9 * 3600000).toISOString().replace("Z", "+09:00");
  calendar = { items: [item("Core PPI m/m", offset)] };
  assert.equal((await scanMacroCalendarEvent("https://fixture.invalid", "crypto")).eventKey, macroEvent.eventKey);
  const old = recent(macroEvent, 120, { releaseAt: offset, eventLabel: "Core PPI MoM" });
  old.event_key = "legacy:label:offset";
  assert.equal(cooldownDecisionForEvent([old], macroEvent).reason, "same_release");
});
await check("reminders stay within one hour and skip stale or past calendars", async () => {
  calendar = { items: [item("PPI MoM", new Date(now + 2 * 3600000).toISOString())] };
  assert.equal(await scanMacroCalendarEvent("https://fixture.invalid"), null);
  calendar = { isStale: true, items: [item("PPI MoM")] };
  assert.equal(await scanMacroCalendarEvent("https://fixture.invalid"), null);
  calendar = { items: [item("PPI MoM", new Date(now - 60000).toISOString())] };
  assert.equal(await scanMacroCalendarEvent("https://fixture.invalid"), null);
});
await check("the macro daily limit counts sends older than six hours", () => {
  const rows = [8, 12, 20].map((hours, i) => recent(macroEvent, hours * 60, { releaseAt: new Date(now - (i + 1) * 3600000).toISOString() }));
  assert.equal(cooldownDecisionForEvent(rows, macroEvent).reason, "macro_daily_limit");
});
const setup = {
  symbol: "BNBUSDT.P", timeframe: "1h", score: 90, status: "active", plan: { side: "long", quality: "A" },
  analysis: { timeframeAnalyses: [{ timeframe: "1h", msb: "bullish", condition: { volumeState: "high", volatilityState: "normal" } }] }
};
const scout = setupToEvent(setup, "radar-grade", "crypto", "radar-grade");
await check("personalization preserves the setup's evidence and next check", () => {
  assert.equal(scout.title, "BNB 1h 상방 후보");
  assert.match(scout.body, /거래량 증가.*가격 구조.*다음 1h 봉/);
  assert.equal(personalizeEventForUser(scout, []).body, scout.body);
  assert.equal(personalizeEventForUser(scout, [{ symbol: setup.symbol }]).body, scout.body);
  assert.equal(scout.data.score, "90");
});
await check("an alt push opens the notified symbol and timeframe with safe metadata", () => {
  assert.equal(resolvePushTargetPath(scout.data), "/crypto/perpetual/alts?symbol=BNBUSDT.P&timeframe=1h&source=alert");
  assert.match(resolvePushTargetPath({ ...scout.data, symbol: "NEWTOKENUSDT.P", timeframe: "4h" }), /symbol=NEWTOKENUSDT.P&timeframe=4h/);
  assert.equal(resolvePushTargetPath({ ...scout.data, symbol: "https://evil.invalid", targetPath: "//evil.invalid" }), "/alts");
  assert.equal(resolvePushTargetPath({ ...scout.data, timeframe: "5m" }), "/alts");
  assert.equal(resolvePushTargetPath({ ...scout.data, symbol: "BTCUSDT.P" }), "/alts");
});
await check("pressure evidence preserves the inputs needed to reproduce its estimate", async () => {
  const observedAt = now - 15 * 60000;
  report = buildLiquidationPressureReport({
    symbol: "BTCUSDT", period: "15m", markPrice: 80000, fundingRate: 0.0001,
    openInterestChangePercent: 2,
    globalLongShort: { longPercent: 70, shortPercent: 30, ratio: 70 / 30 },
    topAccountLongShort: { longPercent: 65, shortPercent: 35, ratio: 65 / 35 },
    topPositionLongShort: { longPercent: 67, shortPercent: 33, ratio: 67 / 33 },
    takerFlow: { buyPercent: 55, sellPercent: 45, buyVolume: 55, sellVolume: 45 },
    evidenceObservedAt: { globalLongShort: observedAt }, updatedAt: observedAt
  });
  const event = await scanLiquidationEvent();
  const stored = JSON.parse(JSON.stringify(event.auditEvidence));
  const s = stored.snapshot;
  const replay = buildLiquidationPressureReport({ ...s, fundingRate: s.fundingRatePercent / 100, updatedAt: s.sourceUpdatedAt });
  assert.equal(replay.downsideLongPressure, Number(event.data.pressure));
  assert.equal(replay.dominantSide, event.data.pressure_side);
  assert.equal(s.evidenceObservedAt.globalLongShort, observedAt);
  assert.notEqual(stored.capturedAt, new Date(s.sourceUpdatedAt).toISOString());
});
await check("scout and macro audits preserve derived evidence and source labels without inventing timestamps", () => {
  assert.equal(scout.auditEvidence.source, "scout_derived_inputs");
  assert.equal(scout.auditEvidence.snapshot.score, 90);
  assert.equal(scout.auditEvidence.snapshot.quality, "A");
  assert.equal(scout.auditEvidence.snapshot.active.msb, "bullish");
  assert.equal(scout.auditEvidence.snapshot.active.volumeState, "high");
  assert.equal(scout.auditEvidence.snapshot.sourceUpdatedAt, null);
  assert.equal(macroEvent.auditEvidence.snapshot.items.length, 4);
  assert.ok(macroEvent.auditEvidence.snapshot.leadMinutes > 0 && macroEvent.auditEvidence.snapshot.leadMinutes <= 60);
  assert.equal(macroEvent.auditEvidence.snapshot.sourceUpdatedAt, null);
});
await check("successful sends persist server evidence; FCM payload and failed-send history stay separate", async () => {
  recordingEnabled = true;
  const tokens = [{ id: "fixture-device", user_id: "fixture-user", token: "fixture-token", markets: ["crypto"], rule_ids: ["radar-grade"] }];
  const personalized = personalizeEventForUser(scout, []);
  const result = await sendEventToUser("fixture-user", tokens, personalized);
  assert.equal(result.sent, 1);
  assert.equal(recordedEvents.length, 1);
  assert.deepEqual(recordedEvents[0].payload.auditEvidence, JSON.parse(JSON.stringify(scout.auditEvidence)));
  assert.equal(recordedEvents[0].payload.sentCount, 1);
  assert.equal(fcmCalls[0].data.auditEvidence, undefined);
  assert.ok(Object.values(fcmCalls[0].data).every(value => typeof value === "string"));
  failDelivery = true;
  const failed = await sendEventToUser("fixture-user", tokens, personalized);
  assert.equal(failed.failed, 1);
  assert.equal(recordedEvents.length, 1);
  recordingEnabled = false;
});
if (failures.length) process.exitCode = 1;
else console.log("Push usefulness regression passed; no live FCM or database writes.");
