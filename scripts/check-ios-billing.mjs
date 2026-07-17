import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const envPath = join(root, ".env.local");
const checks = [];
const read = (path) => readFileSync(join(root, path), "utf8");

function parseEnv(source) {
  return new Map(source.split(/\r?\n/).flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) return [];
    const index = trimmed.indexOf("=");
    return [[trimmed.slice(0, index).trim(), trimmed.slice(index + 1).trim()]];
  }));
}

function check(ok, label, detail) {
  checks.push({ ok, label, detail });
}

const env = existsSync(envPath) ? parseEnv(readFileSync(envPath, "utf8")) : new Map();
for (const key of [
  "NEXT_PUBLIC_REVENUECAT_IOS_API_KEY",
  "REVENUECAT_REST_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "APPLE_TEAM_ID",
  "APPLE_KEY_ID",
  "APPLE_CLIENT_ID",
  "APPLE_PRIVATE_KEY",
  "APPLE_TOKEN_ENCRYPTION_KEY"
]) {
  const value = env.get(key) ?? process.env[key] ?? "";
  check(Boolean(value && value !== "***" && !value.includes("your-")), `environment ${key}`, "iOS release requires a real value.");
}

const billing = read("src/lib/billing.ts");
const applePlugin = read("ios/App/App/AppleSignInPlugin.swift");
const project = read("ios/App/App.xcodeproj/project.pbxproj");
const entitlements = read("ios/App/App/App.entitlements");
const appleServer = read("src/lib/server/appleAuth.ts");
const packageManifest = read("ios/App/CapApp-SPM/Package.swift");
const appDelegate = read("ios/App/App/AppDelegate.swift");
for (const marker of ["android: { productId:", "ios: { productId:", "revenueCatPackageId:"]) {
  check(billing.includes(marker), `billing model ${marker}`, "Platform products are explicit.");
}
check(applePlugin.includes("ASAuthorizationAppleIDProvider"), "native Apple login", "AuthenticationServices bridge is present.");
check(project.includes("com.apple.SignInWithApple") && project.includes("com.apple.InAppPurchase"), "Xcode capabilities", "Apple login and IAP are enabled in the project.");
check(project.includes("CODE_SIGN_ENTITLEMENTS = App/App.entitlements"), "code-sign entitlements", "Both build configurations reference the entitlement file.");
check(/DEVELOPMENT_TEAM = [A-Z0-9]{10};/.test(project), "Apple development team", "Xcode signing must reference the release team.");
check(entitlements.includes("com.apple.developer.applesignin"), "Apple entitlement", "Sign in with Apple entitlement is present.");
check(appleServer.includes("https://appleid.apple.com/auth/revoke"), "Apple token revocation", "Account deletion revokes a linked Apple refresh token.");
check(!packageManifest.includes("..\\"), "SwiftPM portable paths", "Package paths use macOS-compatible forward slashes.");
check(packageManifest.includes("CapawesomeCapacitorGoogleSignIn"), "native Google sign-in package", "iOS avoids embedded-webview Google OAuth.");
check(!appDelegate.includes("DispatchQueue.main.async"), "Apple plugin registration", "The plugin is registered before the first JavaScript sign-in call.");

let failures = 0;
for (const result of checks) {
  if (result.ok) console.log(`PASS ${result.label} - ${result.detail}`);
  else {
    failures += 1;
    console.error(`FAIL ${result.label} - ${result.detail}`);
  }
}
if (failures) {
  console.error(`\niOS release gate failed with ${failures} unresolved requirement(s). Windows code checks are complete; run archive and StoreKit tests on macOS after fixing them.`);
  process.exitCode = 1;
} else {
  console.log("\niOS billing and Apple login static release gate passed. A macOS archive and TestFlight purchase test are still required.");
}
