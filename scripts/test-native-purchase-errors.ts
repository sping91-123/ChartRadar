import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { diagnosePurchaseError, purchaseSdkCodes, retainPurchaseOperation } from "../src/lib/nativePurchaseErrors";
import { sanitizeProductEventProperties } from "../src/lib/productEvents";

const sdkTypes = readFileSync("node_modules/@revenuecat/purchases-typescript-internal-esm/dist/errors.d.ts", "utf8");
for (const [, code] of Array.from(sdkTypes.matchAll(/^\s+\w+\s*=\s*"(\d+)"/gm))) {
  assert.ok(purchaseSdkCodes.has(code), `installed SDK code ${code} needs classification`);
}
for (const [code, category, retryable] of [
  [1, "cancelled", false], [2, "store", false], [3, "not_allowed", false],
  [6, "already_owned", false], [13, "already_owned", false], [10, "network", true],
  [35, "network", true], [15, "in_progress", false], [20, "pending", false],
  [23, "configuration", false], [11, "configuration", false], [0, "unknown", false]
] as const) {
  for (const representation of [code, String(code)]) {
    const error = Object.assign(new Error("receipt and private developer text"), { code: representation, userInfo: { token: "private" } });
    const diagnostic = diagnosePurchaseError(error);
    assert.equal(diagnostic.sdkCode, String(code));
    assert.equal(diagnostic.category, category);
    assert.equal(diagnostic.retryable, retryable);
    assert.equal(JSON.stringify(diagnostic).includes("private"), false);
  }
}
assert.equal(diagnosePurchaseError({ userCancelled: true }).code, "purchase_cancelled");
assert.equal(diagnosePurchaseError({ userCancelled: "true" }).code, "purchase_failed");
assert.equal(diagnosePurchaseError({ code: "receipt-private-999" }).sdkCode, null);
assert.equal(diagnosePurchaseError(null).category, "unknown");
assert.match(diagnosePurchaseError({ code: "20" }).message, /새 결제를 시작하지/);
assert.match(diagnosePurchaseError({ code: "2" }).message, /구독 권한 다시 확인/);
let stage: { stage: string } | undefined;
for (const next of ["configure_start", "get_products_start", "purchase_start", "purchase_error"]) {
  stage = retainPurchaseOperation(stage, { stage: next });
}
assert.equal(stage?.stage, "purchase_start");
assert.equal(retainPurchaseOperation({ stage: "get_products_start" }, { stage: "purchase_error" })?.stage, "get_products_start");
assert.deepEqual(sanitizeProductEventProperties("purchase_failed", {
  code: "sdk_network", sdkCode: "10", category: "network", retryable: true, stage: "get_products_start", message: "private", userInfo: { token: "private" }
}), { code: "sdk_network", sdkCode: "10", category: "network", retryable: true, stage: "get_products_start" });
assert.deepEqual(sanitizeProductEventProperties("purchase_failed", {
  sdkCode: "private-999", category: "private", retryable: "yes", stage: "private"
}), {});
console.log("native purchase errors: PASS");
