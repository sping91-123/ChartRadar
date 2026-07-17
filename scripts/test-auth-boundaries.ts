import assert from "node:assert/strict";
import { normalizeReturnTo, safeReturnTo, trustedRequestOrigin } from "../src/lib/authRedirect";

for (const value of [
  "//evil.example/path",
  "/\\evil.example/path",
  "/%5cevil.example/path",
  "/%255cevil.example/path",
  "/ok\u0000bad",
  "https://evil.example/",
  "javascript:alert(1)",
  "%252f%252fevil.example"
]) {
  assert.equal(normalizeReturnTo(value), null, `${JSON.stringify(value)} must be rejected`);
}

assert.equal(normalizeReturnTo("/account?tab=billing#current"), "/account?tab=billing#current");
assert.equal(safeReturnTo("//evil.example"), "/crypto");
assert.equal(
  trustedRequestOrigin("https://attacker.example/api/auth", "https://chart-radar.example"),
  "https://chart-radar.example"
);
assert.equal(trustedRequestOrigin("http://localhost:3000/login", "https://chart-radar.example"), "http://localhost:3000");

console.log("Authentication boundary matrix passed.");
