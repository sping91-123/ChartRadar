import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import vm from "node:vm";
import ts from "typescript";

const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
let user = { id: owner, app_metadata: { role: "admin" } };
let deleting = false, authFailure = false, deletionFailure = false;
let subscriptions = [], sent = [], records = [];
const event = {
  market: "crypto", ruleId: "radar-grade", alertKind: "market_scout",
  eventKey: "fixture:crypto:eth:1", title: "Fixture market event", body: "Fixture evidence",
  symbol: "ETHUSDT.P", score: 90, quality: "A", evidenceLabels: ["structure", "volume"],
  data: { type: "radar-grade", timeframe: "4h", symbol: "ETHUSDT.P" }
};
const stubs = {
  "@/lib/server/supabaseAdmin": {
    supabaseAdminAuth: async (path, options) => {
      assert.equal(path, `admin/users/${owner}`);
      assert.equal(options.allowNotFound, true);
      if (authFailure) throw new Error("fixture auth unavailable");
      return user;
    },
    supabaseAdminRest: async (path, options) => {
      if (path.startsWith("account_deletion_requests?")) {
        assert.ok(path.includes(`user_id=eq.${owner}`));
        assert.ok(path.includes("status=in.(pending,processing,failed)"));
        if (deletionFailure) throw new Error("fixture deletion lookup unavailable");
        return deleting ? [{ user_id: owner }] : [];
      }
      if (path.startsWith("push_tokens?")) return [{ id: "fixture-device", user_id: owner, token: "fixture-token", markets: ["crypto"], rule_ids: ["radar-grade"] }];
      if (path.startsWith("subscriptions?")) return subscriptions;
      if (path.startsWith("push_alert_presets?")) return [];
      if (path.startsWith("push_alert_events?")) return [];
      if (path === "push_alert_events" && options?.method === "POST") {
        records.push(options.body);
        return null;
      }
      throw new Error(`Unexpected database call: ${path}`);
    }
  },
  "@/lib/server/firebaseMessaging": { sendFcmMessage: async message => { sent.push(message); } },
  "@/lib/server/perpetualMonitorScanner": {
    runPerpetualMonitorScan: async () => ({ enabled: true, triggered: 0, sent: 0, failed: 0, warnings: [] })
  },
  "@/lib/server/news/newsImpactAlertOutbox": {
    deliverNewsImpactOutbox: async () => ({ events: 0, sent: 0, failed: 0, inAppOnly: 0 })
  },
  "@/lib/server/push/scanners/setupScanner": {
    scanCryptoSetups: async () => [], scanStockSetups: async () => [], stockMomentumSymbols: []
  },
  "@/lib/server/push/scanners/liquidationScanner": { scanLiquidationEvent: async () => null },
  "@/lib/server/push/scanners/macroScanner": { scanMacroCalendarEvent: async () => null },
  "@/lib/server/push/genericEvents": {
    buildGenericPushEvents: () => ({ events: [event], marketScoutLimitSkippedCount: 0, globalBatchSkippedCount: 0, globalMomentumLimitSkippedCount: 0, globalAssetLimitSkippedCount: 0 })
  }
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
    exports: module.exports, module, Date, Map, Set, URL, URLSearchParams, encodeURIComponent,
    process: { env: {} }, console: { ...console, warn: () => {} },
    require: name => {
      if (name in stubs) return stubs[name];
      const local = name.startsWith("@/") ? resolve("src", name.slice(2)) : name.startsWith(".") ? resolve(dirname(path), name) : null;
      assert.ok(local, `Unexpected dependency: ${name}`);
      return load(`${local}.ts`);
    }
  }, { filename: path });
  return module.exports;
}

const { userPlan, ruleAllowed } = load("src/lib/server/push/entitlements.ts");
const { runPushAlertScan } = load("src/lib/server/pushAlertScanner.ts");
const plan = () => userPlan(new Map([[owner, subscriptions]]), owner);
const scan = async () => {
  sent = []; records = [];
  return runPushAlertScan({ origin: "https://fixture.invalid", pushDeliveryEnabled: true });
};

assert.equal(await plan(), "admin", "a trusted administrator needs no paid subscription row");
assert.equal(ruleAllowed(event, await plan()), true);
assert.equal((await scan()).sent, 1, "the full scanner must await and honor the trusted admin role");
assert.equal(sent[0].token, "fixture-token");
assert.equal(records.length, 1);

user = { id: owner, app_metadata: {}, user_metadata: { role: "admin" } };
assert.equal(await plan(), "free", "user-editable metadata cannot grant Pro");
assert.equal((await scan()).sent, 0, "Basic users remain gated");
assert.equal(records.length, 0);

subscriptions = [{ user_id: owner, plan: "crypto_monthly", status: "active", market_scope: "crypto", current_period_end: "2099-01-01T00:00:00Z" }];
assert.equal((await scan()).sent, 1, "valid paid crypto users keep their notifications");
assert.equal(ruleAllowed({ ...event, ruleId: "stock-momentum" }, await plan()), false, "crypto does not grant stocks");
subscriptions[0].revoked_at = "2026-09-08T00:00:00Z";
assert.equal((await scan()).sent, 0, "revoked subscriptions cannot receive Pro events");
subscriptions[0].revoked_at = null;
subscriptions[0].current_period_end = "2000-01-01T00:00:00Z";
assert.equal((await scan()).sent, 0, "expired subscriptions cannot receive Pro events");

user = { id: owner, app_metadata: { role: "admin" } };
deleting = true;
assert.equal(await plan(), null);
assert.equal((await scan()).sent, 0, "deletion takes precedence over administrator access");
deleting = false; authFailure = true;
assert.equal((await scan()).sent, 0, "failed role lookup must skip delivery");
authFailure = false; deletionFailure = true;
assert.equal((await scan()).sent, 0, "failed deletion lookup must skip delivery");
deletionFailure = false; user = null;
assert.equal((await scan()).sent, 0, "deleted users cannot receive push");
user = { id: "another-user", app_metadata: { role: "admin" } };
assert.equal(await plan(), null, "a mismatched auth response cannot grant access");
console.log("PASS push entitlement regression: admin delivery, Basic and market gates, paid/revoked/expired plans, trusted metadata, deletion and lookup failures; no live FCM sent");
