import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const nativeRequire = createRequire(import.meta.url), cache = new Map();
const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const id = "11111111-1111-4111-8111-111111111111", snapshotId = "22222222-2222-4222-8222-222222222222";
const now = Date.now(), iso = delta => new Date(now + delta).toISOString();
const primary = { id: "perpetual-state-v3.0.0:btc:primary", kind: "decision_state_change", role: "primary", timeframe: "15m", label: "방향 신호 변화 확인", threshold: null, baselineState: "neutral", expiresAt: iso(86_400_000) };
const below = { ...primary, id: "perpetual-condition-v3.0.0:btc:below", kind: "price_cross_below", role: "confirmation", threshold: 90, label: "90 이하에서 15분봉 마감" };
const above = { ...below, id: "perpetual-condition-v3.0.0:btc:above", kind: "price_cross_above", role: "invalidation", threshold: 110, label: "110 이상에서 15분봉 마감" };
const snapshot = { id: snapshotId, asset: "btc", symbol: "BTCUSDT", engineVersion: "perpetual-v3.0.0", generatedAt: iso(-1000), expiresAt: iso(59000), price: 100, quality: "ready", summary: { state: "neutral", headline: "방향 대기", topRisk: "하단 이탈 확인", primaryCondition: primary }, pro: { secret: "never-return", confirmationConditions: [below], invalidationConditions: [above], multiTimeframeEvidence: [{ timeframe: "15m", closedPrice: 100 }] } };
let actor = owner, state = "active", paid = false, currentFails = false, stored;
const stubs = {
  "@/lib/server/requestEntitlement": { getRequestEntitlement: async () => ({ userId: actor, isAuthenticated: Boolean(actor), state, isPaid: paid, plan: paid ? "crypto_monthly" : "free" }), entitlementRateKey: key => key },
  "@/lib/server/perpetualRevenueCore": { isPerpetualRevenueCoreUserEnabled: () => true },
  "@/lib/server/rateLimit": { rateLimit: async () => ({ allowed: true }), readJsonBodyLimited: async request => { try { return { ok: true, value: await request.json() }; } catch { return { ok: false }; } } },
  "@/lib/server/productEventStore": { recordServerProductEvent: async () => {} },
  "@/lib/server/perpetualDecisionSource": { getPerpetualDecisionSnapshotById: async sid => sid === snapshotId ? snapshot : null, resolvePerpetualDecisionSnapshot: async () => { if (currentFails) throw Error("offline"); return { snapshot }; } },
  "@/lib/server/supabaseAdmin": { isSupabaseAdminConfigured: () => true, supabaseAdminRest: async path => {
    const q = new URLSearchParams(path.split("?")[1]);
    assert.equal(q.get("user_id"), `eq.${actor}`);
    assert.equal(q.get("id"), `eq.${id}`);
    return stored && actor === owner ? [{ ...stored, user_id: owner, snapshot_id: snapshotId, last_snapshot_id: null, condition_id: stored.condition.id, condition_kind: stored.condition.kind, condition_role: stored.condition.role, created_at: iso(0), updated_at: iso(0), expires_at: primary.expiresAt }] : [];
  } }
};
function load(file) {
  file = resolve(file); if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  vm.runInNewContext(ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module, exports: module.exports, console, Date, URL, URLSearchParams, Request, Response,
    require: name => { if (name in stubs) return stubs[name]; const local = name.startsWith("@/") ? resolve("src", name.slice(2)) : name.startsWith(".") ? resolve(dirname(file), name) : null; return local ? load(local + ".ts") : nativeRequire(name); }
  }, { filename: file }); return module.exports;
}
const store = load("src/lib/server/perpetualMonitorStore.ts");
stubs["@/lib/server/perpetualMonitorStore"] = { ...store, markExpiredPerpetualMonitors: async () => {}, reconcilePerpetualMonitorLimit: async () => {}, sharedCryptoConditionUsage: async () => ({ total: stored ? 1 : 0 }), createPerpetualMonitor: async p => {
  assert.equal(p.userId, actor);
  stored ??= { id, snapshotId, asset: "btc", symbol: "BTCUSDT", condition: p.condition, status: "active", expiresAt: primary.expiresAt };
  return structuredClone(stored);
} };
const core = load("src/lib/personalMonitor.ts"), monitorLib = load("src/lib/perpetualMonitor.ts");
const create = load("src/app/api/crypto/perpetual/monitors/route.ts"), detail = load("src/app/api/crypto/perpetual/monitors/[id]/route.ts");
const request = body => new Request("https://fixture.invalid/api/crypto/perpetual/monitors", body ? { method: "POST", body: JSON.stringify(body) } : undefined);
const ctx = { params: Promise.resolve({ id }) };
let failed = 0;
async function check(name, fn) { try { await fn(); console.log("PASS " + name); } catch (e) { failed++; console.error("FAIL " + name, e); } }
await check("intent recommendations use price direction, never scenario role or unavailable Pro conditions", () => {
  assert.equal(core.preferredWatchCondition([primary, above, below], "long").id, below.id);
  assert.equal(core.preferredWatchCondition([primary, above, below], "short").id, above.id);
  assert.equal(core.preferredWatchCondition([primary, above, below], "watching").id, primary.id);
  assert.equal(core.preferredWatchCondition([primary], "long").id, primary.id);
  assert.equal(core.isWatchIntent("__proto__"), false);
});
await check("creation rejects fabricated context and invalid intent while preserving Basic gate", async () => {
  const input = { snapshotId, conditionId: primary.id, watchIntent: "long" };
  assert.equal((await create.POST(request({ ...input, watchContext: { price: 1 } }))).status, 400);
  assert.equal((await create.POST(request({ ...input, watchIntent: "__proto__" }))).status, 400);
  assert.equal((await create.POST(request({ ...input, conditionId: below.id }))).status, 403);
  assert.equal(stored, undefined);
  const r = await create.POST(request(input)); assert.equal(r.status, 201);
  const c = (await r.json()).monitor.condition.watchContext;
  assert.equal(c.intent, "long"); assert.equal(c.price, snapshot.price); assert.equal(c.headline, snapshot.summary.headline);
  assert.equal(c.savedAt, snapshot.generatedAt);
});
await check("duplicate create preserves actual saved context and old clients remain supported", async () => {
  const r = await create.POST(request({ snapshotId, conditionId: primary.id, watchIntent: "short" }));
  assert.equal((await r.json()).monitor.condition.watchContext.intent, "long");
  stored = undefined;
  const legacy = await create.POST(request({ snapshotId, conditionId: primary.id }));
  assert.equal(legacy.status, 201); assert.equal((await legacy.json()).monitor.condition.watchContext, undefined);
  stored = undefined; paid = true;
  assert.equal((await create.POST(request({ snapshotId, conditionId: below.id, watchIntent: "long" }))).status, 201); paid = false;
});
await check("owned Basic detail is private, excludes Pro current data and blocks another account", async () => {
  const r = await detail.GET(request(), ctx); assert.equal(r.status, 200);
  assert.match(r.headers.get("cache-control"), /private.*no-store/);
  const d = await r.json(); assert.equal(d.monitor.condition.watchContext.intent, "long");
  assert.equal(d.current.pro, undefined); assert(!JSON.stringify(d.current).includes("never-return"));
  actor = other; assert.equal((await detail.GET(request(), ctx)).status, 404);
  actor = null; assert.equal((await detail.GET(request(), ctx)).status, 401);
  actor = owner; state = "deletion_pending"; assert.equal((await detail.GET(request(), ctx)).status, 409); state = "active";
  currentFails = true; const partial = await (await detail.GET(request(), ctx)).json();
  assert.equal(partial.monitor.id, id); assert.equal(partial.current, null); currentFails = false;
});
await check("freshness and price validity prevent invented comparisons", () => {
  const context = core.personalWatchContext({ ...snapshot, generatedAt: iso(-3600000) }, "long"), current = core.monitorCurrentBrief(snapshot);
  assert.equal(core.monitorChangeSummary(context, { ...current, price: 110 }, now).priceChange, 10);
  for (const bad of [{ ...current, quality: "stale" }, { ...current, price: 0 }, { ...current, generatedAt: iso(1000) }, { ...current, generatedAt: iso(-8*60000) }]) {
    assert.equal(core.monitorChangeSummary(context, bad, now).priceChange, null);
  }
  const checked = { ...current, generatedAt: iso(-4*60000), expiresAt: iso(-3*60000) };
  assert.equal(core.monitorChangeSummary(context, checked, now).ready, false);
  assert.equal(core.monitorChangeSummary(context, checked, now, "last_check").ready, true);
  assert.equal(core.monitorChangeSummary(null, current, now).priceChange, null);
});
await check("personal push includes saved intent, observed closed price and next check; legacy copy preserved", () => {
  const condition = { ...below, watchContext: core.personalWatchContext(snapshot, "long") };
  const copy = monitorLib.monitorNotificationCopy(condition, snapshot);
  assert.match(copy.title, /상승 방향 보유/); assert.match(copy.body, /확정봉 종가/); assert.match(copy.body, /다음 확인:/);
  assert.match(monitorLib.monitorNotificationCopy(below, snapshot).body, /알림 당시 근거/);
});
await check("user price uses the existing 15m close engine and accepts only a bounded shape", () => {
  const engine = load("src/lib/perpetualDecisionSnapshot.ts");
  for (const input of [null, [], { threshold: "90", direction: "below" }, { threshold: 1e-10, direction: "above" }, { threshold: Infinity, direction: "below" }, { threshold: 90, direction: "below", timeframe: "1m" }]) assert.equal(core.personalPriceCondition(snapshot, input), null);
  const c = core.personalPriceCondition(snapshot, { threshold: 90, direction: "below" });
  assert.equal(c.timeframe, "15m"); assert.equal(Date.parse(c.expiresAt) - Date.parse(snapshot.generatedAt), 86_400_000);
  assert.equal(engine.isMonitorConditionMet(c, snapshot), false);
  assert.equal(engine.isMonitorConditionMet(c, { ...snapshot, pro: { ...snapshot.pro, multiTimeframeEvidence: [{ timeframe: "15m", closedPrice: 89 }] } }), true);
  assert.equal(engine.isMonitorConditionMet(core.personalPriceCondition(snapshot, { threshold: 110, direction: "above" }), { ...snapshot, pro: { ...snapshot.pro, multiTimeframeEvidence: [{ timeframe: "15m", closedPrice: 110 }] } }), true);
  const precise = core.personalPriceCondition(snapshot, { threshold: 3000.12345678, direction: "above" });
  const copy = load("src/lib/perpetualDecisionCopy.ts");
  assert.match(copy.monitorConditionDisplayLabel(precise), /3,000\.12345678/);
  assert.match(copy.monitorAlertCopy(precise).trigger, /3,000\.12345678/);
  assert.match(monitorLib.monitorNotificationCopy(precise, snapshot).body, /3,000\.12345678/);
});
await check("personal price creation requires Pro, strict XOR, confirmed price and an unmet condition", async () => {
  stored = undefined;
  const input = { snapshotId, watchIntent: "long", personalPrice: { threshold: 90, direction: "below" } };
  assert.equal((await create.POST(request(input))).status, 403);
  paid = true;
  assert.equal((await create.POST(request({ ...input, conditionId: primary.id }))).status, 400);
  assert.equal((await create.POST(request({ ...input, personalPrice: { ...input.personalPrice, role: "primary" } }))).status, 400);
  assert.equal((await create.POST(request({ ...input, personalPrice: { threshold: 101, direction: "below" } }))).status, 422);
  const evidence = snapshot.pro.multiTimeframeEvidence;
  snapshot.pro.multiTimeframeEvidence = [];
  assert.equal((await create.POST(request(input))).status, 409);
  snapshot.pro.multiTimeframeEvidence = evidence;
  const r = await create.POST(request(input)); assert.equal(r.status, 201);
  const m = (await r.json()).monitor;
  assert.equal(m.condition.threshold, 90); assert.equal(m.condition.kind, "price_cross_below"); assert.equal(m.condition.watchContext.intent, "long");
  assert.match(m.condition.label, /내 확인 가격/); assert.equal(m.condition.role, "confirmation");
  paid = false;
});
await check("scanner preserves user price, situation and original context in the actual alert payload", async () => {
  const origin = { ...snapshot, price: 120, generatedAt: iso(-3600000) };
  const condition = { ...core.personalPriceCondition(origin, { threshold: 110, direction: "below" }), watchContext: core.personalWatchContext(origin, "long") };
  const row = { id, user_id: owner, snapshot_id: snapshotId, condition_id: condition.id, condition, condition_role: condition.role, asset: "btc" };
  let claimed;
  Object.assign(stubs["@/lib/server/perpetualMonitorStore"], { listStoredPerpetualMonitorOwnerIds: async () => [], listActivePerpetualMonitorRows: async () => [row], listPendingPerpetualAlertEvents: async () => [], claimPerpetualMonitorTrigger: async p => { claimed = p; return { claimed: true, user_id: owner }; } });
  Object.assign(stubs["@/lib/server/perpetualRevenueCore"], { perpetualRevenueCoreMode: () => "on", isPerpetualRevenueCoreScannerEnabled: () => true, shouldRunPerpetualRevenueMaintenance: () => true });
  stubs["@/lib/server/supabaseAdmin"].supabaseAdminRpc = async () => 0;
  stubs["@/lib/server/firebaseMessaging"] = { sendFcmMessage: async () => { throw Error("No real sends in this test"); } };
  const scanner = load("src/lib/server/perpetualMonitorScanner.ts");
  const result = await scanner.runPerpetualMonitorScan();
  assert.equal(result.triggered, 1); assert.equal(result.warnings.length, 0);
  assert.equal(claimed.payload.monitorId, id); assert.equal(claimed.payload.watchContext.intent, "long");
  assert.equal(claimed.payload.watchContext.price, 120); assert.equal(claimed.evaluatedSnapshotId, snapshot.id);
  assert.match(claimed.body, /110/); assert.match(claimed.title, /상승 방향 보유/);
});
if (failed) process.exitCode = 1;
