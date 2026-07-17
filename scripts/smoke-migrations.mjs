import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const activeDir = join(root, "supabase", "migrations");
const legacyDir = join(root, "supabase", "legacy-migrations");
const active = readdirSync(activeDir).filter((name) => name.endsWith(".sql")).sort();
const legacy = existsSync(legacyDir) ? readdirSync(legacyDir).filter((name) => name.endsWith(".sql")).sort() : [];
const failures = [];

for (const name of active) {
  const version = /^([0-9]{14})_/.exec(name)?.[1];
  if (!version || version < "20260714120423") failures.push(`active migration is not forward-only: ${name}`);
}
for (const required of [
  "20260513_billing_entitlements.sql",
  "20260513_payment_confirmation.sql",
  "20260519_android_push_platform_guard.sql",
  "20260519_push_tokens.sql",
  "20260521_macro_events.sql",
  "20260614_journal_market.sql"
]) {
  if (!legacy.includes(required)) failures.push(`legacy migration archive is missing: ${required}`);
}
const versions = active.map((name) => name.split("_")[0]);
if (new Set(versions).size !== versions.length) failures.push("active migration versions are duplicated");

const canonicalName = active.find((name) => name.endsWith("_canonical_entitlement_ledger.sql"));
const canonical = canonicalName ? readFileSync(join(activeDir, canonicalName), "utf8") : "";
for (const marker of [
  "apply_billing_entitlement",
  "reconcile_provider_entitlements",
  "backfill_legacy_beta_entitlements",
  "signals_premium_read",
  "provider, provider_order_id"
]) {
  if (!canonical.includes(marker)) failures.push(`canonical entitlement migration is missing ${marker}`);
}

const gateCAdvisorName = active.find((name) => name.endsWith("_gate_c_advisor_hardening.sql"));
const gateCAdvisor = gateCAdvisorName ? readFileSync(join(activeDir, gateCAdvisorName), "utf8") : "";
for (const marker of [
  "revoke all privileges on table public.billing_entitlement_events",
  'drop policy if exists "본인 구독 읽기"',
  "alter function public.has_effective_market_entitlement(text) security invoker"
]) {
  if (!gateCAdvisor.includes(marker)) failures.push(`Gate C advisor migration is missing ${marker}`);
}

const betaLockName = active.find((name) => name.endsWith("_lock_beta_backfill_cohort.sql"));
const betaLock = betaLockName ? readFileSync(join(activeDir, betaLockName), "utf8") : "";
for (const marker of [
  "lock table auth.users in share mode",
  "lock table public.profiles in share mode",
  "lock table public.subscriptions in share row exclusive mode",
  "p_dry_run boolean default true"
]) {
  if (!betaLock.includes(marker)) failures.push(`beta backfill lock migration is missing ${marker}`);
}

if (failures.length) {
  failures.forEach((failure) => console.error(`FAIL ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`PASS forward-only migration guard (${active.length} active, ${legacy.length} archived).`);
  const replay = spawnSync(process.execPath, ["scripts/test-entitlement-ledger.mjs"], {
    cwd: root,
    stdio: "inherit",
    shell: false
  });
  if (replay.status !== 0) {
    console.error("FAIL PGlite production/repository/fresh replay matrix");
    process.exitCode = replay.status ?? 1;
  } else {
    console.log("PASS executable PGlite migration replay matrix.");
  }
}
