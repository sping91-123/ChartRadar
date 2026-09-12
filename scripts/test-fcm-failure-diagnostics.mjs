import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const native = createRequire(import.meta.url);
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const logs = [], requests = [];
let failAuth = true, failTransport = false;
let responseStatus = 404, responseText = JSON.stringify({ error: { status: "NOT_FOUND", message: "PRIVATE_DEVICE_SENTINEL", details: [{ errorCode: "UNREGISTERED" }] } });
const module = { exports: {} };
vm.runInNewContext(ts.transpileModule(readFileSync("src/lib/server/firebaseMessaging.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText, {
  module, exports: module.exports, require: native, Buffer, Date, URLSearchParams, AbortSignal, AbortController, setTimeout, clearTimeout,
  process: { env: { FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: "fixture", client_email: "fixture@example.invalid", private_key: privateKey.export({ type: "pkcs8", format: "pem" }) }) } },
  console: { warn: (...args) => logs.push(args) },
  fetch: async (url, options) => {
    requests.push({ url, options });
    if (url.includes("oauth2") && failAuth) return new Response("PRIVATE_AUTH_ERROR_SENTINEL", { status: 401 });
    if (!url.includes("oauth2") && failTransport) throw new Error("PRIVATE_TRANSPORT_SENTINEL");
    return url.includes("oauth2") ? new Response(JSON.stringify({ access_token: "PRIVATE_AUTH_SENTINEL", expires_in: 3600 }))
      : new Response(responseText, { status: responseStatus });
  }
});
const message = { token: "PRIVATE_TOKEN_SENTINEL", title: "fixture", body: "fixture" };
async function rejectsSafely() { await assert.rejects(module.exports.sendFcmMessage(message), error => { assert(!error.message.includes("PRIVATE_")); return true; }); }
await rejectsSafely(); assert.equal(logs[0][1].code, "AUTH_UNAVAILABLE"); failAuth = false; logs.length = 0; requests.length = 0;
await rejectsSafely();
assert.equal(logs[0][1].code, "UNREGISTERED"); assert.equal(logs[0][1].httpStatus, 404);
responseStatus = 403; responseText = JSON.stringify({ error: { status: "PERMISSION_DENIED", message: "PRIVATE_ACCOUNT_SENTINEL" } });
await rejectsSafely(); assert.equal(logs[1][1].code, "PERMISSION_DENIED");
responseStatus = 500; responseText = "PRIVATE_MALFORMED_SENTINEL";
await rejectsSafely(); assert.equal(logs[2][1].code, "UNKNOWN");
responseText = JSON.stringify({ error: { status: "PRIVATE_STATUS_SENTINEL", details: [{ errorCode: "PRIVATE_CODE_SENTINEL" }] } });
await rejectsSafely(); assert.equal(logs[3][1].code, "UNKNOWN");
failTransport = true; await rejectsSafely(); assert.equal(logs[4][1].code, "TRANSPORT_ERROR"); failTransport = false;
assert(!JSON.stringify(logs).includes("PRIVATE_"));
assert.equal(requests.filter(r => r.url.includes("oauth2")).length, 1);
assert.equal(JSON.parse(requests[1].options.body).message.token, message.token);
responseStatus = 200; responseText = JSON.stringify({ name: "fixture-success" });
assert.equal((await module.exports.sendFcmMessage(message)).name, "fixture-success"); assert.equal(logs.length, 5);
console.log("PASS provider errors are classified without token/account/raw-message disclosure; send and success behavior are preserved. Fixtures only.");
