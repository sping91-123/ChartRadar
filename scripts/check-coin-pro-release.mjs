// Coin Pro v2 release prerequisites. This never prints secret values.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const checks = [];
const read = (relativePath) => {
  const absolute = join(root, relativePath);
  return existsSync(absolute) ? readFileSync(absolute, "utf8") : "";
};
const check = (ok, label, detail) => checks.push({ ok, label, detail });

function parseEnv(source) {
  return new Map(source.split(/\r?\n/).flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) return [];
    const separator = trimmed.indexOf("=");
    return [[trimmed.slice(0, separator).trim(), trimmed.slice(separator + 1).trim()]];
  }));
}

const localEnvPath = join(root, ".env.local");
const localEnv = existsSync(localEnvPath) ? parseEnv(readFileSync(localEnvPath, "utf8")) : new Map();
const value = (key) => (process.env[key] ?? localEnv.get(key) ?? "").trim();
const configured = (key) => {
  const current = value(key);
  return Boolean(current && current !== "***" && !current.includes("your-") && !current.includes("xxx"));
};

const fingerprintPattern = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/i;
const fingerprints = value("ANDROID_APP_LINK_SHA256_FINGERPRINTS")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const internalUserIds = value("PRODUCT_ANALYTICS_INTERNAL_USER_IDS")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const internalQaEventIds = value("COIN_PRO_V2_INTERNAL_QA_EVENT_IDS")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

check(
  fingerprints.length > 0 && fingerprints.every((item) => fingerprintPattern.test(item)),
  "Play App Signing fingerprint",
  "ANDROID_APP_LINK_SHA256_FINGERPRINTS must contain valid production SHA-256 certificate fingerprints."
);
check(
  configured("PRODUCT_ANALYTICS_HMAC_SECRET") && value("PRODUCT_ANALYTICS_HMAC_SECRET").length >= 32,
  "analytics HMAC secret",
  "The anonymous funnel HMAC key must contain at least 32 characters."
);
check(
  configured("PRODUCT_ANALYTICS_QA_SECRET") && value("PRODUCT_ANALYTICS_QA_SECRET").length >= 32,
  "signed QA secret",
  "The internal QA signature key must contain at least 32 characters."
);
check(
  (configured("UPSTASH_REDIS_REST_URL") && configured("UPSTASH_REDIS_REST_TOKEN")) ||
    (configured("KV_REST_API_URL") && configured("KV_REST_API_TOKEN")),
  "shared Coin usage backend",
  "An Upstash REST URL/token pair (UPSTASH_REDIS_REST_* or Vercel KV_REST_API_*) is required for production fail-closed daily quotas."
);
check(
  internalUserIds.every((item) => uuidPattern.test(item)),
  "internal tester IDs",
  "When present, PRODUCT_ANALYTICS_INTERNAL_USER_IDS must contain comma-separated UUIDs."
);
check(
  internalQaEventIds.length === 12 && new Set(internalQaEventIds.map((item) => item.toLowerCase())).size === 12 && internalQaEventIds.every((item) => uuidPattern.test(item)),
  "12 internal QA event IDs",
  "COIN_PRO_V2_INTERNAL_QA_EVENT_IDS must contain the 12 exact, unique post-baseline UI-audit event UUIDs."
);

const manifest = read("android/app/src/main/AndroidManifest.xml");
const mainActivity = read("android/app/src/main/java/com/staronlabs/chartradar/MainActivity.java");
const assetLinks = read("src/app/.well-known/assetlinks.json/route.ts");
const migration = read("supabase/migrations/20260801103109_coin_pro_conversion_v2.sql");
const billing = read("src/lib/billing.ts");
const mobilePurchases = read("src/lib/mobilePurchases.ts");
const proPricing = read("src/components/ProPricingPanel.tsx");
const conversion = read("src/lib/coinProConversion.ts");
const firstMonitorPush = read("src/lib/firstMonitorPush.ts");
const scoutRoute = read("src/app/api/scout/route.ts");
const watchlistRoute = read("src/app/api/watchlist-scan/route.ts");
const altUsageRoute = read("src/app/api/crypto/alt-analysis-usage/route.ts");

check(manifest.includes('android:autoVerify="true"'), "App Link auto verification", "Android manifest must request domain verification.");
check(manifest.includes('android:host="chartradar.kr"') && manifest.includes('android:path="/pro"'), "App Link scope", "Only the HTTPS /pro route is claimed.");
check(assetLinks.includes("ANDROID_APP_LINK_SHA256_FINGERPRINTS"), "assetlinks source", "The public association route must read the release fingerprints.");
check(
  mainActivity.includes("PENDING_INSTALL_REFERRER_ROUTE") && mainActivity.includes("INSTALL_REFERRER_CONSUMED"),
  "Install Referrer recovery",
  "A validated campaign route must survive a slow or offline first launch until navigation succeeds."
);
check(
  conversion.includes('market: "crypto"') && mainActivity.includes('appendAllowlistedQuery(safeRoute, "market"') && mainActivity.includes("acceptedAppLink"),
  "Coin App Link context",
  "Play referrers and cold-start App Links must preserve the crypto market context."
);
check(
  migration.includes("funnel_session_hash") && migration.includes("traffic_class") && migration.includes("verified_trial_started") &&
    migration.includes("product_purchase_attributions") && migration.includes("mark_coin_pro_v2_internal_events"),
  "conversion migration",
  "The additive conversion event schema must be present before production rollout."
);
check(billing.includes("trialDays: 14"), "14-day product contract", "Coin monthly billing metadata must retain the approved trial length.");
check(
  mobilePurchases.includes("resolveNativeTrialEligibility") && proPricing.includes("14일 무료 체험 가능 여부와 갱신일은 Google Play 결제 화면에서 확인됩니다."),
  "trial eligibility tri-state",
  "Unknown offer eligibility must stay distinct from verified eligible and ineligible states."
);
check(
  firstMonitorPush.includes('registrationStage === "denied"') && firstMonitorPush.includes('state.permission === "granted" && !state.synced'),
  "first-monitor Push recovery",
  "Denied permission remains sticky while granted-but-unsynced devices can retry."
);
check(
  scoutRoute.includes('mode === "both"') && scoutRoute.includes("claimCoinDailyUsage") &&
    watchlistRoute.includes("claimCoinDailyUsage") && altUsageRoute.includes("distinctRateLimit"),
  "server-enforced Coin usage quotas",
  "Scout, Watchlist, and distinct Alt-symbol limits must be enforced by the shared server quota backend."
);
check(
  mobilePurchases.includes('"purchase_success"') &&
    mobilePurchases.includes('"entitlement_sync_pending"') &&
    proPricing.includes('eventName: "store_purchase_succeeded"') &&
    proPricing.includes('eventName: "entitlement_sync_pending"'),
  "purchase state separation",
  "Store success and delayed entitlement synchronization must remain separate states."
);

let failures = 0;
for (const result of checks) {
  if (result.ok) console.log(`PASS ${result.label} - ${result.detail}`);
  else {
    failures += 1;
    console.error(`FAIL ${result.label} - ${result.detail}`);
  }
}

if (failures) {
  console.error(`\nCoin Pro v2 release gate failed with ${failures} unresolved requirement(s). Secret values were not printed.`);
  process.exitCode = 1;
} else {
  console.log("\nCoin Pro v2 local release prerequisites passed. Play Console, RevenueCat, migration, device, and production checks are still separate approval gates.");
}
