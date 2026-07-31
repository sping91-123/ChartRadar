import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const activeDir = join(root, "supabase", "migrations");
const legacyDir = join(root, "supabase", "legacy-migrations");
const active = readdirSync(activeDir).filter((name) => name.endsWith(".sql")).sort();
const legacy = existsSync(legacyDir) ? readdirSync(legacyDir).filter((name) => name.endsWith(".sql")).sort() : [];
const failures = [];

function readNormalized(path) {
  return readFileSync(path, "utf8").replace(/\r\n?/g, "\n");
}

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
const canonical = canonicalName ? readNormalized(join(activeDir, canonicalName)) : "";
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
const gateCAdvisor = gateCAdvisorName ? readNormalized(join(activeDir, gateCAdvisorName)) : "";
for (const marker of [
  "revoke all privileges on table public.billing_entitlement_events",
  'drop policy if exists "본인 구독 읽기"',
  "alter function public.has_effective_market_entitlement(text) security invoker"
]) {
  if (!gateCAdvisor.includes(marker)) failures.push(`Gate C advisor migration is missing ${marker}`);
}

const betaLockName = active.find((name) => name.endsWith("_lock_beta_backfill_cohort.sql"));
const betaLock = betaLockName ? readNormalized(join(activeDir, betaLockName)) : "";
for (const marker of [
  "lock table auth.users in share mode",
  "lock table public.profiles in share mode",
  "lock table public.subscriptions in share row exclusive mode",
  "p_dry_run boolean default true"
]) {
  if (!betaLock.includes(marker)) failures.push(`beta backfill lock migration is missing ${marker}`);
}

const perpetualCoreName = active.find((name) => name.endsWith("_perpetual_revenue_core_v1.sql"));
const perpetualCore = perpetualCoreName ? readNormalized(join(activeDir, perpetualCoreName)) : "";
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
const journalReconcile = journalReconcileName ? readNormalized(join(activeDir, journalReconcileName)) : "";
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

const macroStatusReconcileName = active.find((name) => name.endsWith("_reconcile_macro_event_status.sql"));
const macroStatusReconcile = macroStatusReconcileName ? readNormalized(join(activeDir, macroStatusReconcileName)) : "";
for (const marker of [
  "drop constraint if exists macro_events_status_check",
  "released_pending_actual",
  "actual_available"
]) {
  if (!macroStatusReconcile.includes(marker)) failures.push(`Macro event status reconciler is missing ${marker}`);
}

const newsImpactName = active.find((name) => name.endsWith("_news_impact_v1.sql"));
const newsImpact = newsImpactName ? readNormalized(join(activeDir, newsImpactName)) : "";
for (const marker of [
  "create table if not exists public.macro_events",
  "create table if not exists public.macro_sync_runs",
  "create table if not exists public.news_source_catalog",
  "create table if not exists public.news_impact_events",
  "create table if not exists public.news_market_reactions",
  "create table if not exists public.news_alert_preferences",
  "claim_news_sync_run",
  "claim_news_impact_alert",
  "lease_news_impact_delivery",
  "purge_news_impact_retention",
  "revoke all privileges on table public.news_source_items from public, anon, authenticated, service_role",
  "revoke all privileges on table public.macro_events from public, anon, authenticated, service_role",
  "grant execute on function public.claim_news_impact_alert"
]) {
  if (!newsImpact.includes(marker)) failures.push(`News Impact migration is missing ${marker}`);
}

const newsHardeningName = active.find((name) => name.endsWith("_harden_news_impact_v1.sql"));
const newsHardening = newsHardeningName ? readNormalized(join(activeDir, newsHardeningName)) : "";
for (const marker of [
  "add column if not exists allowed_hosts",
  "where allowed_hosts is null",
  "existing_news_source_item_not_allowed",
  "before insert or update of source_id, policy_status, canonical_url",
  "evaluated.generated_at > baseline.generated_at",
  "deletion.status in ('pending', 'processing', 'failed')",
  "news_sync_runs_active_lease_idx",
  "renew_news_sync_run",
  "retire_stale_news_reactions",
  "evaluated.generated_at > baseline.generated_at",
  "deletion.status in ('pending', 'processing', 'failed')",
  "pg_advisory_xact_lock",
  "delivery_succeeded_token_ids",
  "finalize_exhausted_news_impact_deliveries",
  "expire_news_impact_delivery",
  "complete_news_impact_delivery(uuid, integer, text, integer, integer, text, uuid[])"
]) {
  if (!newsHardening.includes(marker)) failures.push(`News Impact hardening migration is missing ${marker}`);
}

const newsUsefulName = active.find((name) => name.endsWith("_news_impact_useful_v2.sql"));
const newsUseful = newsUsefulName ? readNormalized(join(activeDir, newsUsefulName)) : "";
for (const marker of [
  "federal_register_financial",
  "occ_news_releases",
  "cftc_cot_positioning",
  "array['federalregister.gov']::text[]",
  "array['occ.gov']::text[]",
  "array['publicreporting.cftc.gov', 'publicreportinghub.cftc.gov']::text[]",
  "enforce_news_reaction_engine_version",
  "enforce_news_alert_source_provenance",
  "push_source_item_ids",
  "old.pre_snapshot_id is not null",
  "baseline.engine_version = evaluated.engine_version",
  "revoke all on function public.enforce_news_reaction_engine_version() from public, anon, authenticated, service_role"
]) {
  if (!newsUseful.includes(marker)) failures.push(`News usefulness migration is missing ${marker}`);
}

const newsOperationalName = active.find((name) => name.endsWith("_news_impact_operational_hardening.sql"));
const newsOperational = newsOperationalName ? readNormalized(join(activeDir, newsOperationalName)) : "";
for (const marker of [
  "create table if not exists public.cftc_positioning_observations",
  "delivery_attempted_token_ids",
  "claim_news_impact_delivery_tokens",
  "delete from public.cftc_positioning_observations",
  "revoke all privileges on table public.cftc_positioning_observations from public, anon, authenticated",
  "revoke all privileges on table public.push_alert_events from public, anon, authenticated",
  "grant select on table public.push_alert_events to authenticated",
  "revoke all on function public.claim_news_impact_delivery_tokens(uuid, integer, uuid[]) from public, anon, authenticated"
]) {
  if (!newsOperational.includes(marker)) failures.push(`News operational hardening migration is missing ${marker}`);
}

const exchangeJournalName = active.find((name) => name.endsWith("_exchange_trade_journal_v1.sql"));
const exchangeJournal = exchangeJournalName ? readNormalized(join(activeDir, exchangeJournalName)) : "";
for (const marker of [
  "create table if not exists public.exchange_connections",
  "create table if not exists public.exchange_credentials",
  "create table if not exists public.exchange_trade_fills",
  "create table if not exists public.exchange_cashflows",
  "create table if not exists public.exchange_trade_positions",
  "create table if not exists public.exchange_trade_assessments",
  "create table if not exists public.exchange_trade_reviews",
  "create table if not exists public.exchange_sync_checkpoints",
  "create table if not exists public.exchange_sync_runs",
  "flat_baseline_at",
  "symbol_flat_baselines",
  "open_close",
  "is_current",
  "create or replace function public.create_exchange_connection",
  "create or replace function public.claim_due_exchange_connections",
  "create or replace function public.commit_exchange_sync_batch",
  "create or replace function public.list_due_exchange_trade_assessment_positions",
  "create or replace function public.upsert_exchange_trade_assessment",
  "position_fingerprint text not null",
  "attempt_count smallint not null",
  "create or replace function public.disconnect_exchange_connection",
  "delete from public.journals journal",
  "'exchange_connections',",
  "revoke all privileges on table public.exchange_credentials from public, anon, authenticated, service_role",
  "grant execute on function public.commit_exchange_sync_batch"
]) {
  if (!exchangeJournal.includes(marker)) failures.push(`Exchange journal migration is missing ${marker}`);
}

const exchangeRuntimeControlName = active.find((name) => name.endsWith("_exchange_runtime_kill_switch.sql"));
const exchangeRuntimeControl = exchangeRuntimeControlName
  ? readNormalized(join(activeDir, exchangeRuntimeControlName))
  : "";
for (const marker of [
  "create table if not exists public.exchange_feature_control",
  "operations_enabled boolean not null default false",
  "create or replace function public.exchange_operations_enabled",
  "create or replace function public.guard_exchange_connection_operations",
  "new.next_sync_at := new.last_synced_at + interval '10 minutes'",
  "p_allowed_user_ids uuid[]",
  "connection.user_id = any(p_allowed_user_ids)",
  "revoke all on function public.claim_due_exchange_connections(integer, uuid, uuid[])",
  "grant execute on function public.claim_due_exchange_connections(integer, uuid, uuid[]) to service_role"
]) {
  if (!exchangeRuntimeControl.includes(marker)) {
    failures.push(`Exchange runtime control migration is missing ${marker}`);
  }
}

const canonicalSchema = readNormalized(join(root, "supabase", "schema.sql"));
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
  "journals_decision_snapshot_idx",
  "create table if not exists public.news_source_catalog",
  "create table if not exists public.cftc_positioning_observations",
  "create or replace function public.claim_news_impact_delivery_tokens",
  "revoke all privileges on table public.push_alert_events from public, anon, authenticated",
  "grant select on table public.push_alert_events to authenticated",
  "create table if not exists public.news_impact_events",
  "create table if not exists public.news_market_reactions",
  "create or replace function public.claim_news_sync_run",
  "create or replace function public.claim_news_impact_alert",
  "create or replace function public.lease_news_impact_delivery",
  "create or replace function public.purge_news_impact_retention",
  "revoke all privileges on table public.news_source_items from public, anon, authenticated, service_role",
  "revoke all privileges on table public.macro_events from public, anon, authenticated, service_role",
  "grant execute on function public.claim_news_impact_alert",
  "add column if not exists allowed_hosts",
  "retire_stale_news_reactions",
  "news_sync_runs_active_lease_idx",
  "renew_news_sync_run",
  "delivery_succeeded_token_ids",
  "finalize_exhausted_news_impact_deliveries",
  "expire_news_impact_delivery",
  "complete_news_impact_delivery(uuid, integer, text, integer, integer, text, uuid[])",
  "federal_register_financial",
  "occ_news_releases",
  "cftc_cot_positioning",
  "create or replace function public.enforce_news_reaction_engine_version()",
  "create or replace function public.enforce_news_alert_source_provenance()",
  "push_source_item_ids",
  "baseline.engine_version = evaluated.engine_version"
]) {
  if (!canonicalSchema.includes(marker)) failures.push(`canonical schema is missing ${marker}`);
}

for (const marker of [
  "-- Exchange trade journal v1 canonical mirror.",
  "create table if not exists public.exchange_connections",
  "create table if not exists public.exchange_credentials",
  "create table if not exists public.exchange_trade_fills",
  "create table if not exists public.exchange_trade_assessments",
  "create table if not exists public.exchange_feature_control",
  "create or replace function public.exchange_operations_enabled",
  "create or replace function public.guard_exchange_connection_operations",
  "p_allowed_user_ids uuid[]",
  "create or replace function public.commit_exchange_sync_batch",
  "create or replace function public.list_due_exchange_trade_assessment_positions",
  "create or replace function public.upsert_exchange_trade_assessment",
  "create or replace function public.disconnect_exchange_connection",
  "delete from public.journals journal",
  "revoke all privileges on table public.exchange_credentials from public, anon, authenticated, service_role"
]) {
  if (!canonicalSchema.includes(marker)) failures.push(`canonical schema is missing ${marker}`);
}
if (
  canonicalSchema.indexOf("-- Exchange trade journal v1 canonical mirror.") !==
  canonicalSchema.lastIndexOf("-- Exchange trade journal v1 canonical mirror.")
) {
  failures.push("canonical schema contains more than one Exchange trade journal mirror");
}

const newsSchemaBaseMarker = "-- News Impact v1 canonical schema mirror.";
const newsSchemaHardeningMarker = "-- News Impact v1 forward-only hardening mirror.";
const newsSchemaBaseIndex = canonicalSchema.indexOf(newsSchemaBaseMarker);
const newsSchemaHardeningIndex = canonicalSchema.indexOf(newsSchemaHardeningMarker);
if (newsSchemaBaseIndex < 0 || newsSchemaHardeningIndex <= newsSchemaBaseIndex) {
  failures.push("canonical schema must declare the News Impact base before its hardening mirror");
}
if (canonicalSchema.indexOf(newsSchemaHardeningMarker, newsSchemaHardeningIndex + 1) >= 0) {
  failures.push("canonical schema contains more than one News Impact hardening mirror");
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
      const newsReplay = spawnSync(process.execPath, ["scripts/test-news-impact-ledger.mjs"], {
        cwd: root,
        stdio: "inherit",
        shell: false
      });
      if (newsReplay.status !== 0) {
        console.error("FAIL executable News Impact migration matrix");
        process.exitCode = newsReplay.status ?? 1;
      } else {
        console.log("PASS executable News Impact migration matrix.");
        const exchangeReplay = spawnSync(process.execPath, ["scripts/test-exchange-journal-ledger.mjs"], {
          cwd: root,
          stdio: "inherit",
          shell: false
        });
        if (exchangeReplay.status !== 0) {
          console.error("FAIL executable Exchange journal migration matrix");
          process.exitCode = exchangeReplay.status ?? 1;
        } else {
          console.log("PASS executable Exchange journal migration matrix.");
        }
      }
    }
  }
}
