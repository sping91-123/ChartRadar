import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const token = "fixture-current-device-token";
const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
let admin = false, ownsToken = true, allowed = true, authValid = true, unavailable = false;
let sent = [], records = [], rateOptions = null;
const stubs = {
  "next/server": require("next/server"),
  "@/lib/pushTestMessages": require("../.verify-dist/src/lib/pushTestMessages.js"),
  "@/lib/pushReceiptTest": require("../.verify-dist/src/lib/pushReceiptTest.js"),
  "@/lib/server/supabaseAdmin": {
    isSupabaseAdminConfigured: () => true,
    fetchSupabaseUserOnServer: async () => {
      if (!authValid) throw new Error("invalid auth");
      return { id: owner, app_metadata: admin ? { role: "admin" } : {} };
    },
    supabaseAdminRest: async (path, options) => {
      if (path.startsWith("push_tokens?")) {
        const params = new URLSearchParams(path.split("?")[1]);
        assert.equal(params.get("user_id"), `eq.${owner}`, "token ownership must be enforced in the server query");
        assert.equal(params.get("enabled"), "eq.true");
        assert.equal(params.get("platform"), "eq.android");
        assert.equal(params.get("provider"), "eq.fcm");
        assert.equal(params.get("limit"), "1");
        if (!admin) assert.equal(params.get("token"), `eq.${token}`, "ordinary tests target the requested owned device, never another recent device");
        return ownsToken ? [{ token }] : [];
      }
      assert.equal(path, "push_alert_events");
      records.push(options.body);
      return null;
    }
  },
  "@/lib/server/firebaseMessaging": {
    isFirebaseMessagingConfigured: () => true,
    sendFcmMessage: async message => { sent.push(message); }
  },
  "@/lib/server/rateLimit": {
    readJsonBodyLimited: require("../.verify-dist/src/lib/server/rateLimit.js").readJsonBodyLimited,
    rateLimit: async (_request, options) => {
      rateOptions = options;
      return { allowed, retryAfter: 120, backend: unavailable ? "unavailable" : "upstash" };
    }
  }
};
const compiled = ts.transpileModule(readFileSync("src/app/api/push-test/route.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
const module = { exports: {} };
vm.runInNewContext(compiled, {
  exports: module.exports, module, require: name => {
    assert.ok(name in stubs, `unexpected route dependency ${name}`);
    return stubs[name];
  }, process: { env: { NODE_ENV: "production" } }, console, Date, encodeURIComponent
});
const post = async (body = { kind: "default", token }, authenticated = true) => module.exports.POST(new Request("https://fixture.invalid/api/push-test", {
  method: "POST", headers: { "Content-Type": "application/json", ...(authenticated ? { Authorization: "Bearer fixture" } : {}) }, body: JSON.stringify(body)
}));
assert.equal((await post()).status, 200);
assert.equal(sent.length, 1);
assert.equal(sent[0].token, token);
assert.equal(sent[0].data.type, "push_test");
assert.equal(records[0].user_id, owner);
assert.equal(records[0].delivery_status, "sent");
assert.equal(records[0].sent_count, 1);
assert.equal(rateOptions.limit, 3);
assert.equal(rateOptions.windowMs, 300_000);
assert.equal(rateOptions.includeClientIp, false);
assert.equal(rateOptions.requireSharedBackend, true);
assert.equal((await post({ kind: "crypto", token })).status, 403);
assert.equal((await post({ kind: "default" })).status, 403);
assert.equal((await post(undefined, false)).status, 401);
authValid = false;
assert.equal((await post()).status, 401);
authValid = true;
ownsToken = false;
assert.equal((await post()).status, 404, "another account or disabled token must not receive a test");
ownsToken = true;
allowed = false;
const throttled = await post();
assert.equal(throttled.status, 429);
assert.equal(throttled.headers.get("Retry-After"), "120");
unavailable = true;
assert.equal((await post()).status, 503, "a missing shared limit must fail closed");
assert.equal(sent.length, 1, "denied requests must not reach FCM");
assert.equal(records.length, 1);
unavailable = false; allowed = true; admin = true;
assert.equal((await post({ kind: "crypto" })).status, 200);
assert.equal(sent.length, 2, "legacy admin example remains supported");
console.log("PASS receipt API: authenticated device ownership, fixed Basic message, admin boundary, shared rate limit, delivery logging; no live FCM sent");
