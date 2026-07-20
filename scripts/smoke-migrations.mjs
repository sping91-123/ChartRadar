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

const perpetualCoreName = active.find((name) => name.endsWith("_perpetual_revenue_core_v1.sql"));
const perpetualCore = perpetualCoreName ? readFileSync(join(activeDir, perpetualCoreName), "utf8") : "";
for (const marker of [
  "create table if not exists public.perpetual_decision_snapshots",
  "create table if not exists public.perpetual_scenario_monitors",
  "create table if not exists public.perpetual_decision_outcomes",
  "create table if not exists public.product_events",
  "create_perpetual_monitor",
  "claim_perpetual_monitor_trigger",
  "lease_perpetual_alert_delivery",
  "replace_crypto_push_presets",
  "purge_perpetual_revenue_core_retention",
  "purge_account_application_data",
  "'product_events', 'perpetual_scenario_monitors'",
  "revoke all privileges on table public.perpetual_scenario_monitors from public, anon, authenticated",
  "revoke all privileges on table public.perpetual_scenario_monitors from service_role",
  "perpetual_scenario_monitors_snapshot_idx",
  "perpetual_scenario_monitors_last_snapshot_idx",
  "product_events_snapshot_idx",
  "product_events_monitor_idx",
  "journals_decision_snapshot_idx",
  "journals_monitor_idx",
  'create policy "push_alert_events_select_own"\non public.push_alert_events for select\nto authenticated\nusing ((select auth.uid()) = user_id)',
  "revoke all on function public.purge_account_application_data(uuid) from public, anon, authenticated",
  "grant execute on function public.purge_account_application_data(uuid) to service_role"
]) {
  if (!perpetualCore.includes(marker)) failures.push(`perpetual revenue core migration is missing ${marker}`);
}

const journalReconcileName = active.find((name) => name.endsWith("_reconcile_journal_columns.sql"));
const journalReconcile = journalReconcileName ? readFileSync(join(activeDir, journalReconcileName), "utf8") : "";
for (const marker of [
  "add column if not exists market text",
  "add column if not exists scout_snapshot jsonb",
  "add column if not exists outcome text",
  "add column if not exists outcome_at timestamptz",
  "add column if not exists updated_at timestamptz",
  "journals_market_check",
  "journals_outcome_check",
  "set_journals_updated_at"
]) {
  if (!journalReconcile.includes(marker)) failures.push(`Journal reconciler migration is missing ${marker}`);
}

const canonicalSchema = readFileSync(join(root, "supabase", "schema.sql"), "utf8");
for (const marker of [
  "perpetual_scenario_monitors_live_condition_idx",
  "create or replace function public.create_perpetual_monitor",
  "create or replace function public.claim_perpetual_monitor_trigger",
  "create or replace function public.lease_perpetual_alert_delivery",
  "create or replace function public.reconcile_perpetual_monitor_limit",
  "create or replace function public.purge_perpetual_revenue_core_retention",
  'create policy "push_alert_events_select_own"\non public.push_alert_events for select\nto authenticated\nusing ((select auth.uid()) = user_id)',
  "revoke all privileges on table public.perpetual_scenario_monitors from service_role",
  "perpetual_scenario_monitors_snapshot_idx",
  "product_events_snapshot_idx",
  "journals_decision_snapshot_idx"
]) {
  if (!canonicalSchema.includes(marker)) failures.push(`canonical schema is missing ${marker}`);
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
    const perpetualReplay = spawnSync(process.execPath, ["scripts/test-perpetual-monitors.mjs"], {
      cwd: root,
      stdio: "inherit",
      shell: false
    });
    if (perpetualReplay.status !== 0) {
      console.error("FAIL executable Perpetual revenue core migration matrix");
      process.exitCode = perpetualReplay.status ?? 1;
    } else {
      console.log("PASS executable Perpetual revenue core migration matrix.");
    }
  }
}
