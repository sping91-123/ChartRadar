import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
const nativeRequire = createRequire(import.meta.url), cache = new Map();
const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const id = "11111111-1111-4111-8111-111111111111", snapshot = "22222222-2222-4222-8222-222222222222";
const now = Date.now(), iso = age => new Date(now - age).toISOString();
const context = { asset: "btc", symbol: "BTCUSDT", snapshotId: snapshot, generatedAt: iso(3600000), quality: "ready", state: "neutral", headline: "가격 범위 안에서 관망", topRisk: "하단 이탈 여부 확인", primaryCondition: { id: "test-condition", label: "65,000 위에서 15분봉 마감 확인", role: "primary" } };
const base = { id, user_id: owner, created_at: iso(3500000), decision_snapshot_id: snapshot, decision_context: context };
const monitor = { id, snapshotId: snapshot, lastSnapshotId: snapshot, conditionId: "test-condition", condition: { id: "test-condition", kind: "price_close_above", label: context.primaryCondition.label, timeframe: "15m", role: "primary" }, asset: "btc", symbol: "BTCUSDT", timeframe: "15m", status: "active", createdAt: iso(3600000), updatedAt: iso(60000), expiresAt: iso(-3600000), lastEvaluatedAt: iso(60000), lastEvaluation: { quality: "ready", generatedAt: iso(60000), headline: "조건 아직 미충족" } };
let rows = [structuredClone(base)], state = "active", actor = owner, storageFails = false;
const calls = [];
const stubs = {
  "@/lib/server/requestEntitlement": { getRequestEntitlement: async () => ({ userId: actor, isAuthenticated: Boolean(actor), state, plan: "free", isPaid: false }), entitlementRateKey: (key, e) => key + e.userId },
  "@/lib/server/perpetualRevenueCore": { isPerpetualRevenueCoreUserEnabled: () => true },
  "@/lib/server/rateLimit": { rateLimit: async () => ({ allowed: true }), readJsonBodyLimited: async (r, max) => { const body = await r.text(); try { return body.length <= max ? { ok: true, value: JSON.parse(body) } : { ok: false, tooLarge: true }; } catch { return { ok: false }; } } },
  "@/lib/server/perpetualMonitorStore": { listUserPerpetualMonitors: async uid => { assert.equal(uid, actor); return [monitor]; }, listRecentTerminalPerpetualMonitors: async uid => { assert.equal(uid, actor); return []; } },
  "@/lib/server/supabaseAdmin": { isSupabaseAdminConfigured: () => true, supabaseAdminRest: async (path, options = {}) => {
    calls.push({ path, options });
    if (storageFails) throw Error("fixture store unavailable");
    const q = new URLSearchParams(path.split("?")[1]);
    assert.equal(q.get("user_id"), `eq.${actor}`);
    assert.equal(q.get("market"), "eq.crypto");
    assert.equal(q.get("source"), "in.(snapshot,alert,news)");
    const selected = rows.filter(r => r.user_id === actor && (!q.get("id") || q.get("id") === `eq.${r.id}`));
    if (options.method === "PATCH") { assert.deepEqual(Object.keys(options.body), ["decision_context"]); selected.forEach(r => Object.assign(r, structuredClone(options.body))); }
    else assert.equal(options.method ?? "GET", "GET");
    return structuredClone(selected);
  } }
};
function load(file) {
  file = resolve(file); if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  vm.runInNewContext(ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module, exports: module.exports, console, Date, URL, URLSearchParams, Request, Response,
    require: name => { if (name in stubs) return stubs[name]; const local = name.startsWith("@/") ? resolve("src", name.slice(2)) : name.startsWith(".") ? resolve(dirname(file), name) : null; return local ? load(local + ".ts") : nativeRequire(name); }
  }, { filename: file }); return module.exports;
}
const core = load("src/lib/decisionWorkspace.ts"), route = load("src/app/api/crypto/decision-workspace/route.ts");
const request = (method = "GET", body, query = "") => new Request("https://fixture.invalid/api/crypto/decision-workspace" + query, { method, ...(body ? { body: JSON.stringify(body), headers: { "content-type": "application/json" } } : {}) });
let failures = 0;
async function check(name, task) { try { await task(); console.log("PASS " + name); } catch (e) { failures++; console.error("FAIL " + name, e); } }
await check("bounded review input and original snapshot linkage", () => {
  assert.equal(core.readDecisionReviewInput({ conclusion: "__proto__", nextCheck: "x" }), null);
  assert.equal(core.readDecisionReviewInput({ conclusion: "kept", nextCheck: " " }), null);
  assert.equal(core.readDecisionReviewInput({ conclusion: "kept", nextCheck: "x".repeat(241) }), null);
  assert.equal(core.toWorkspaceJournal({ ...base, decision_snapshot_id: id }), null);
  assert.equal(core.toWorkspaceJournal(base).context.snapshotId, snapshot);
});
await check("expired, paused, stale and future checks are not counted as recent normal monitoring", () => {
  const data = { monitors: [monitor, { ...monitor, status: "paused" }, { ...monitor, expiresAt: iso(1) }, { ...monitor, lastEvaluatedAt: iso(8 * 60000) }, { ...monitor, lastEvaluatedAt: iso(-60000) }], journals: [core.toWorkspaceJournal(base)] };
  const summary = core.workspaceSummary(data, now);
  assert.equal(summary.running, 3); assert.equal(summary.checked, 1); assert.equal(summary.pending, 1); assert.equal(summary.reviewed, 0);
});
await check("GET is read-only, Basic may read owned history, and missing data stays explicit", async () => {
  calls.length = 0;
  const response = await route.GET(request("GET", null, `?journal=${id}`));
  assert.equal(response.status, 200); const data = await response.json();
  assert.equal(data.focusedJournal.id, id); assert.equal(data.journals.length, 1);
  assert(calls.every(c => !c.options.method));
  actor = other;
  assert.equal((await (await route.GET(request("GET", null, `?journal=${id}`))).json()).focusedJournal, null);
  actor = owner;
});
await check("review updates one owned record and preserves every original field", async () => {
  const response = await route.PATCH(request("PATCH", { id, conclusion: "waited", nextCheck: "  65,000 위 마감까지 관망  " }));
  assert.equal(response.status, 200); const journal = (await response.json()).journal;
  assert.equal(journal.review.nextCheck, "65,000 위 마감까지 관망");
  assert.equal(rows.length, 1);
  const { review, ...original } = rows[0].decision_context;
  assert.deepEqual(original, context); assert.equal(rows[0].decision_snapshot_id, snapshot);
  assert(Number.isFinite(Date.parse(review.reviewedAt)));
});
await check("authentication, deletion and lookup failure cannot fabricate a saved review", async () => {
  actor = null; assert.equal((await route.GET(request())).status, 401); actor = owner;
  state = "deletion_pending"; assert.equal((await route.PATCH(request("PATCH", { id, conclusion: "kept", nextCheck: "x" }))).status, 409); state = "active";
  actor = other; assert.equal((await route.PATCH(request("PATCH", { id, conclusion: "kept", nextCheck: "x" }))).status, 404); actor = owner;
  const before = JSON.stringify(rows);
  storageFails = true; assert.equal((await route.PATCH(request("PATCH", { id, conclusion: "changed", nextCheck: "x" }))).status, 503); storageFails = false;
  assert.equal(JSON.stringify(rows), before);
});
await check("extra fields cannot overwrite original analysis or reassign a user", async () => {
  assert.equal((await route.PATCH(request("PATCH", { id, conclusion: "kept", nextCheck: "x", user_id: other }))).status, 400);
  assert.equal((await route.PATCH(request("PATCH", { id, conclusion: "kept", nextCheck: "x", decision_context: {} }))).status, 400);
  assert.equal((await route.GET(request("GET", null, "?journal=bad"))).status, 400);
});
if (process.argv.includes("--write-fixture")) {
  mkdirSync("output/decision-workspace", { recursive: true });
  writeFileSync("output/decision-workspace/fixture.json", JSON.stringify({ owner, id, snapshot, data: { monitors: [monitor], history: [{ ...monitor, id: "33333333-3333-4333-8333-333333333333", status: "triggered", triggeredAt: iso(60000) }], journals: [core.toWorkspaceJournal(base)], focusedJournal: core.toWorkspaceJournal(base), unavailableJournalCount: 0, checkedAt: iso(0) } }, null, 2));
}
if (failures) process.exitCode = 1;
