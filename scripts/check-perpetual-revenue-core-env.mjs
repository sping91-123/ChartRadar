import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const envPath = join(process.cwd(), ".env.local");
const requireOn = process.argv.includes("--require-on");
const requireCanary = process.argv.includes("--require-canary");

function parseEnv(source) {
  return new Map(source.split(/\r?\n/).flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) return [];
    const separator = trimmed.indexOf("=");
    return [[trimmed.slice(0, separator).trim(), trimmed.slice(separator + 1).trim()]];
  }));
}

const local = existsSync(envPath) ? parseEnv(readFileSync(envPath, "utf8")) : new Map();
const value = (key) => (process.env[key] ?? local.get(key) ?? "").trim();
const configured = (key) => {
  const current = value(key);
  return Boolean(current && current !== "***" && !current.includes("your-") && !current.includes("xxx"));
};

const rawMode = value("PERPETUAL_REVENUE_CORE_V1").toLowerCase();
const mode = rawMode || "off";
const rawCanaryIds = value("PERPETUAL_REVENUE_CORE_CANARY_USER_IDS");
const canaryIds = rawCanaryIds ? rawCanaryIds.split(",").map((item) => item.trim()).filter(Boolean) : [];
const validCanaryIds = canaryIds.length > 0 && canaryIds.length <= 2 && canaryIds.every((item) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item));
const canaryExpiresAt = Date.parse(value("PERPETUAL_REVENUE_CORE_CANARY_EXPIRES_AT"));
const validCanaryWindow = Number.isFinite(canaryExpiresAt) && canaryExpiresAt > Date.now() && canaryExpiresAt <= Date.now() + 24 * 60 * 60 * 1000;
const canaryActive = mode === "shadow" && validCanaryIds && validCanaryWindow;
const checks = [];
const check = (ok, label, detail) => checks.push({ ok, label, detail });

check(["off", "shadow", "on"].includes(mode), "feature mode", "PERPETUAL_REVENUE_CORE_V1 must be off, shadow, or on.");
if (requireOn) check(mode === "on", "on activation", "Explicit on mode is required for this release gate.");
if (rawCanaryIds) {
  check(validCanaryIds, "canary user IDs", "Canary entries must contain one or two comma-separated UUIDs.");
  check(validCanaryWindow, "canary expiry", "Canary expiry must be a future ISO timestamp no more than 24 hours ahead.");
}
if (requireCanary) {
  check(mode === "shadow", "canary mode", "Disposable canary verification requires shadow mode.");
  check(validCanaryIds, "canary allowlist", "At least one valid disposable canary UUID is required.");
  check(validCanaryWindow, "canary window", "A fail-closed canary expiry within 24 hours is required.");
}

if (mode === "shadow" || mode === "on") {
  check(configured("NEXT_PUBLIC_SUPABASE_URL"), "Supabase URL", "Snapshot persistence needs a configured project URL.");
  check(configured("SUPABASE_SERVICE_ROLE_KEY"), "Supabase service role", "Route-only writes need a service-role key.");
  check(configured("PRODUCT_ANALYTICS_HMAC_SECRET"), "analytics HMAC", "Anonymous shadow and funnel identifiers must be HMAC transformed.");
}

if (mode === "on" || requireCanary || canaryActive) {
  check(configured("CRON_SECRET"), "cron authentication", "The five-minute monitor worker must be authenticated.");
  const hasEnabledAiProvider = configured("GROQ_API_KEY") || (
    value("ENABLE_GEMINI_AI_FALLBACK").toLowerCase() === "true" && configured("GEMINI_API_KEY")
  );
  check(
    hasEnabledAiProvider,
    "AI explanation provider",
    "Paid Perpetual activation requires Groq or an explicitly enabled Gemini fallback."
  );
  check(
    configured("UPSTASH_REDIS_REST_URL") && configured("UPSTASH_REDIS_REST_TOKEN"),
    "shared AI cost guard",
    "Revenue-core users require Upstash so provider-backed AI has a cross-instance daily ceiling."
  );
  const aiDailyLimit = Number(value("PERPETUAL_AI_DAILY_PROVIDER_LIMIT") || "240");
  check(
    Number.isInteger(aiDailyLimit) && aiDailyLimit >= 1 && aiDailyLimit <= 5_000,
    "AI provider daily ceiling",
    "PERPETUAL_AI_DAILY_PROVIDER_LIMIT must be an integer from 1 to 5000."
  );
  const firebaseConfigured = configured("FIREBASE_SERVICE_ACCOUNT_JSON") || (
    configured("FIREBASE_PROJECT_ID") && configured("FIREBASE_CLIENT_EMAIL") && configured("FIREBASE_PRIVATE_KEY")
  );
  check(firebaseConfigured, "Firebase server credentials", "Push delivery needs a complete Firebase server credential set.");
}

let failures = 0;
for (const result of checks) {
  if (result.ok) console.log(`PASS ${result.label} - ${result.detail}`);
  else {
    failures += 1;
    console.error(`FAIL ${result.label} - ${result.detail}`);
  }
}

if (failures) {
  console.error(`\nPerpetual revenue-core environment gate failed with ${failures} unresolved requirement(s). Secret values were not printed.`);
  process.exitCode = 1;
} else {
  console.log(`\nPerpetual revenue-core environment gate passed for mode=${mode}. Secret values were not printed.`);
}
