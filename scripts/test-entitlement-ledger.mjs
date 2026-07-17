import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const root = process.cwd();
const emergencySql = readFileSync(join(root, "supabase/migrations/20260715164519_close_signal_entitlement_gap.sql"), "utf8");
const ledgerSql = readFileSync(join(root, "supabase/migrations/20260715164522_canonical_entitlement_ledger.sql"), "utf8");
const hotfixSql = readFileSync(join(root, "supabase/migrations/20260714120423_close_profile_entitlement_self_upgrade.sql"), "utf8");
const accountDeletionSql = readFileSync(join(root, "supabase/migrations/20260715164525_account_deletion_requests.sql"), "utf8");
const gateCAdvisorSql = readFileSync(join(root, "supabase/migrations/20260717133500_gate_c_advisor_hardening.sql"), "utf8");
const betaBackfillLockSql = readFileSync(join(root, "supabase/migrations/20260717134000_lock_beta_backfill_cohort.sql"), "utf8");

const ids = {
  basic: "00000000-0000-4000-8000-000000000001",
  paid: "00000000-0000-4000-8000-000000000002",
  admin: "00000000-0000-4000-8000-000000000003",
  transfer: "00000000-0000-4000-8000-000000000004"
};

async function asRole(db, role, callback) {
  await db.exec(`set role ${role}`);
  try {
    return await callback();
  } finally {
    await db.exec("reset role");
  }
}

async function setClaims(db, userId, role = "") {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await db.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify({ sub: userId, app_metadata: role ? { role } : {} })
  ]);
}

const db = await PGlite.create();
try {
  await db.exec(`
    create schema auth;
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create or replace function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create or replace function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
    $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;
    create table auth.users (
      id uuid primary key,
      email text,
      raw_app_meta_data jsonb not null default '{}'::jsonb
    );
    create table public.profiles (
      id uuid primary key references auth.users(id) on delete cascade,
      membership_tier text not null default 'free',
      created_at timestamptz not null default now()
    );
    create table public.subscriptions (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references auth.users(id) on delete cascade,
      tier text not null check (tier in ('member', 'premium')),
      status text not null default 'active' check (status in ('active', 'canceled', 'past_due')),
      provider text not null check (provider in ('toss', 'youtube_membership')),
      provider_subscription_id text,
      current_period_end timestamptz,
      created_at timestamptz not null default now()
    );
    alter table public.subscriptions enable row level security;
    create policy "본인 구독 읽기" on public.subscriptions
      for select to public using (auth.uid() = user_id);
    create table public.signals (
      id uuid primary key default gen_random_uuid(),
      symbol text not null,
      timeframe text not null,
      direction text not null check (direction in ('long', 'short')),
      setup_type text not null,
      entry_price numeric not null,
      stop_loss numeric,
      take_profit numeric,
      confidence numeric,
      fired_at timestamptz not null default now(),
      closed_at timestamptz,
      outcome text check (outcome in ('win', 'loss', 'breakeven')),
      metadata jsonb
    );
    alter table public.signals enable row level security;
    create policy "broad_authenticated" on public.signals for select to authenticated using (true);
    grant select, insert, update, delete on public.signals to anon, authenticated, service_role;
  `);

  await db.query(
    "insert into auth.users (id,email,raw_app_meta_data) values ($1,'basic@example.invalid','{}'),($2,'paid@example.invalid','{}'),($3,'admin@example.invalid','{\"role\":\"admin\"}'),($4,'transfer@example.invalid','{}')",
    [ids.basic, ids.paid, ids.admin, ids.transfer]
  );
  await db.query("insert into public.profiles (id) values ($1),($2),($3),($4)", [ids.basic, ids.paid, ids.admin, ids.transfer]);
  for (let index = 0; index < 12; index += 1) {
    const userId = `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    await db.query("insert into auth.users (id,email) values ($1,$2)", [userId, `beta-${index}@example.invalid`]);
    await db.query(
      "insert into public.profiles (id,membership_tier,created_at) values ($1,'premium',now() - interval '1 month')",
      [userId]
    );
  }

  await db.exec(`
    create or replace function public.handle_new_user()
    returns trigger language plpgsql security definer set search_path=public as $$
    begin
      insert into public.profiles (id) values (new.id);
      return new;
    end
    $$;
    create trigger on_auth_user_created
      after insert on auth.users for each row execute function public.handle_new_user();

    create or replace function public.sync_membership_tier()
    returns trigger language plpgsql security definer set search_path=public as $$
    begin
      update public.profiles set membership_tier='premium'
      where id=coalesce(new.user_id,old.user_id);
      return coalesce(new,old);
    end
    $$;
    create trigger on_subscription_change
      after insert or update or delete on public.subscriptions
      for each row execute function public.sync_membership_tier();

    create or replace function public.set_updated_at()
    returns trigger language plpgsql as $$
    begin
      return new;
    end
    $$;
  `);

  const legacySignalAt = "2026-07-01T00:00:00.000Z";
  await db.query(`
    insert into public.signals (
      symbol, timeframe, direction, setup_type, entry_price, fired_at
    ) values ('LEGACY','1h','long','fixture',1,$1)
  `, [legacySignalAt]);

  await db.exec(emergencySql);
  const emergencyGrants = await db.query("select has_table_privilege('authenticated','public.signals','SELECT') as can_select");
  assert.equal(emergencyGrants.rows[0].can_select, false, "emergency migration must close signal reads");

  await db.exec(ledgerSql);
  await db.exec(ledgerSql);
  await db.exec("grant all privileges on table public.billing_entitlement_events to service_role");
  await db.exec(gateCAdvisorSql);
  await db.exec(gateCAdvisorSql);
  await db.exec(betaBackfillLockSql);
  await db.exec(betaBackfillLockSql);

  assert.equal(
    (await db.query("select triggered_at = fired_at as preserved from public.signals where symbol='LEGACY'")).rows[0].preserved,
    true,
    "the canonical signal timestamp must preserve the production fired_at value"
  );
  await db.query("delete from public.signals where symbol='LEGACY'");

  assert.equal(
    (await db.query("select has_function_privilege('anon','public.handle_new_user()','EXECUTE') as allowed")).rows[0].allowed,
    false,
    "anonymous users must not execute the signup trigger function"
  );
  assert.equal(
    (await db.query("select has_function_privilege('authenticated','public.sync_membership_tier()','EXECUTE') as allowed")).rows[0].allowed,
    false,
    "authenticated users must not execute the legacy tier sync function"
  );
  assert.equal(
    (await db.query(`
      select count(*)::int as count
      from pg_trigger
      where tgrelid='public.subscriptions'::regclass
        and tgname='on_subscription_change'
        and not tgisinternal
    `)).rows[0].count,
    0,
    "the legacy profile tier sync trigger must be removed"
  );
  assert.match(
    (await db.query(`
      select array_to_string(proconfig, ',') as config
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='set_updated_at'
    `)).rows[0].config,
    /search_path=/,
    "set_updated_at must pin its search_path"
  );
  assert.equal(
    (await db.query(`
      select p.prosecdef
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='has_effective_market_entitlement'
    `)).rows[0].prosecdef,
    false,
    "the RLS entitlement helper must run as the authenticated invoker"
  );
  assert.equal(
    (await db.query("select has_table_privilege('service_role','public.billing_entitlement_events','TRUNCATE') as allowed")).rows[0].allowed,
    false,
    "service role must not be able to truncate the append-only event ledger"
  );
  assert.equal(
    (await db.query("select has_table_privilege('service_role','public.billing_entitlement_events','SELECT') as allowed")).rows[0].allowed,
    true,
    "service role must retain read access to the event ledger"
  );
  assert.equal(
    (await db.query(`
      select count(*)::int as count
      from pg_policies
      where schemaname='public' and tablename='subscriptions'
        and policyname='본인 구독 읽기'
    `)).rows[0].count,
    0,
    "the duplicate production subscription policy must be removed"
  );
  assert.match(
    (await db.query(`
      select pg_get_functiondef(p.oid) as definition
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='backfill_legacy_beta_entitlements'
    `)).rows[0].definition,
    /lock table auth\.users in share mode;[\s\S]*lock table public\.profiles in share mode;[\s\S]*lock table public\.subscriptions in share row exclusive mode;/i,
    "beta validation and apply must share a locked cohort snapshot"
  );
  const postMigrationSignupId = "00000000-0000-4000-8000-000000000099";
  await db.query(
    "insert into auth.users (id,email,raw_app_meta_data) values ($1,'post-migration@example.invalid','{}')",
    [postMigrationSignupId]
  );
  assert.equal(
    (await db.query("select membership_tier from public.profiles where id=$1", [postMigrationSignupId])).rows[0].membership_tier,
    "free",
    "the hardened signup trigger must support the production membership_tier profile shape"
  );
  await db.query("delete from auth.users where id=$1", [postMigrationSignupId]);

  const dryRun = await db.query("select public.backfill_legacy_beta_entitlements(12, true) as result");
  assert.equal(dryRun.rows[0].result.eligible_count, 12);
  assert.match(dryRun.rows[0].result.cohort_hash, /^[0-9a-f]{32}$/);
  assert.equal((await db.query("select count(*)::int as count from public.subscriptions where provider='legacy_beta'")).rows[0].count, 0);
  await db.query(`
    insert into public.subscriptions (user_id,provider,status,tier,plan,market_scope,provider_order_id)
    values ('10000000-0000-4000-8000-000000000001','manual','inactive','premium','premium','bundle','conflict-beta')
  `);
  await assert.rejects(() => db.query("select public.backfill_legacy_beta_entitlements(12, true)"));
  await db.query("delete from public.subscriptions where provider_order_id='conflict-beta'");
  await assert.rejects(() => db.query("select public.backfill_legacy_beta_entitlements(12, false, 'wrong-cohort')"));
  const applied = await db.query("select public.backfill_legacy_beta_entitlements(12, false, $1) as result", [dryRun.rows[0].result.cohort_hash]);
  assert.equal(applied.rows[0].result.inserted_count, 12);
  const betaDates = await db.query(`
    select count(*)::int as count
    from public.subscriptions subscription
    join public.profiles profile on profile.id = subscription.user_id
    where subscription.provider = 'legacy_beta'
      and subscription.current_period_start = profile.created_at
      and subscription.current_period_end = profile.created_at + interval '3 months'
      and subscription.market_scope = 'bundle'
  `);
  assert.equal(betaDates.rows[0].count, 12);
  const reapplied = await db.query("select public.backfill_legacy_beta_entitlements(12, false, $1) as result", [dryRun.rows[0].result.cohort_hash]);
  assert.equal(reapplied.rows[0].result.inserted_count, 0, "beta backfill must be idempotent");

  const observedAt = new Date(Date.now() - 2_000).toISOString();
  const periodEnd = new Date(Date.now() + 86_400_000).toISOString();
  const appliedManual = await db.query(
    `select public.apply_billing_entitlement(
      $1,'manual','evt-manual-1','crypto_monthly','crypto','active',$2,$3,
      'manual_admin_grant','manual:paid:crypto',null,$2,false,null
    ) as result`,
    [ids.paid, observedAt, periodEnd]
  );
  assert.equal(appliedManual.rows[0].result.status, "active");
  const duplicate = await db.query(
    `select public.apply_billing_entitlement(
      $1,'manual','evt-manual-1','crypto_monthly','crypto','active',$2,$3,
      'manual_admin_grant','manual:paid:crypto',null,$2,false,null
    ) as result`,
    [ids.paid, observedAt, periodEnd]
  );
  assert.equal(duplicate.rows[0].result.status, "duplicate");
  await setClaims(db, ids.paid);
  const safeSubscriptionRead = await asRole(db, "authenticated", () => db.query("select provider,status,plan,market_scope,current_period_end from public.subscriptions where user_id=$1", [ids.paid]));
  assert.equal(safeSubscriptionRead.rows[0].provider, "manual", "authenticated users must be able to read the safe provider source column");

  const snapshot = JSON.stringify([
    {
      plan: "crypto_monthly",
      market_scope: "crypto",
      status: "active",
      current_period_start: observedAt,
      current_period_end: periodEnd,
      provider_product_id: "chart_radar_crypto_monthly",
      provider_order_id: "rc:paid:crypto"
    },
    {
      plan: "stocks_monthly",
      market_scope: "stocks",
      status: "active",
      current_period_start: observedAt,
      current_period_end: periodEnd,
      provider_product_id: "chart_radar_global_monthly",
      provider_order_id: "rc:paid:stocks"
    }
  ]);
  const reconciledAt = new Date(Date.now() - 1_000).toISOString();
  await assert.rejects(() => db.query(
    "select public.reconcile_provider_entitlements($1,'revenuecat','rc-null-end',$2::jsonb,$3,false)",
    [ids.paid, JSON.stringify([{ ...JSON.parse(snapshot)[0], current_period_end: null }]), reconciledAt]
  ));
  const reconciled = await db.query(
    "select public.reconcile_provider_entitlements($1,'revenuecat','rc-snapshot-1',$2::jsonb,$3,false) as result",
    [ids.paid, snapshot, reconciledAt]
  );
  assert.equal(reconciled.rows[0].result.status, "active");
  assert.equal((await db.query("select count(*)::int as count from public.subscriptions where provider='revenuecat' and revoked_at is null")).rows[0].count, 2);
  await setClaims(db, ids.paid);
  const combinedBundleAccess = await asRole(db, "authenticated", () => db.query("select public.has_effective_market_entitlement('bundle') as allowed"));
  assert.equal(combinedBundleAccess.rows[0].allowed, true, "separate crypto and stocks plans together satisfy bundle access");

  const equalSnapshot = await db.query(
    "select public.reconcile_provider_entitlements($1,'revenuecat','rc-snapshot-equal',$2::jsonb,$3,false) as result",
    [ids.paid, snapshot, reconciledAt]
  );
  assert.equal(equalSnapshot.rows[0].result.status, "stale", "equal timestamps must not be last-writer-wins");

  const foreignObservedAt = new Date(Date.parse(reconciledAt) + 10).toISOString();
  const eventCountBeforeForeignClaim = (await db.query("select count(*)::int as count from public.billing_entitlement_events")).rows[0].count;
  await assert.rejects(() => db.query(
    "select public.reconcile_provider_entitlements($1,'revenuecat','rc-foreign-claim',$2::jsonb,$3,false)",
    [ids.transfer, JSON.stringify([JSON.parse(snapshot)[0]]), foreignObservedAt]
  ));
  assert.equal(
    (await db.query("select count(*)::int as count from public.billing_entitlement_events")).rows[0].count,
    eventCountBeforeForeignClaim,
    "a rejected foreign order claim must roll back its event"
  );
  assert.equal(
    (await db.query("select user_id from public.subscriptions where provider_order_id='rc:paid:crypto'")).rows[0].user_id,
    ids.paid,
    "a foreign snapshot must not replace order ownership"
  );

  const validatedConstraints = await db.query(`
    select count(*)::int as count
    from pg_constraint
    where conrelid='public.subscriptions'::regclass
      and conname in (
        'subscriptions_status_check', 'subscriptions_plan_check',
        'subscriptions_market_scope_check', 'subscriptions_eligible_shape_check'
      )
      and convalidated
  `);
  assert.equal(validatedConstraints.rows[0].count, 4, "canonical subscription constraints must be validated");
  await asRole(db, "service_role", () => db.query("select count(*) from public.billing_entitlement_events"));
  await assert.rejects(() => asRole(db, "service_role", () => db.query(`
    insert into public.billing_entitlement_events (provider,event_id,event_type,observed_at)
    values ('manual','direct-write','apply',now())
  `)));
  await assert.rejects(() => asRole(db, "service_role", () => db.query("update public.billing_entitlement_events set outcome='tampered'")));

  const beforeBadEventCount = (await db.query("select count(*)::int as count from public.billing_entitlement_events")).rows[0].count;
  const badObservedAt = new Date(Date.parse(reconciledAt) + 1).toISOString();
  await assert.rejects(() => db.query(
    "select public.reconcile_provider_entitlements($1,'revenuecat','rc-bad',$2::jsonb,$3,false)",
    [ids.paid, JSON.stringify([{ ...JSON.parse(snapshot)[0], plan: "unknown_plan" }]), badObservedAt]
  ));
  assert.equal((await db.query("select count(*)::int as count from public.billing_entitlement_events")).rows[0].count, beforeBadEventCount);

  const emptyAt = new Date().toISOString();
  const emptied = await db.query(
    "select public.reconcile_provider_entitlements($1,'revenuecat','rc-empty-1','[]'::jsonb,$2,true) as result",
    [ids.paid, emptyAt]
  );
  assert.equal(emptied.rows[0].result.status, "not_active");
  assert.equal((await db.query("select count(*)::int as count from public.subscriptions where provider='revenuecat' and revoked_at is null")).rows[0].count, 0);
  await setClaims(db, ids.paid);
  const cryptoOnlyBundleAccess = await asRole(db, "authenticated", () => db.query("select public.has_effective_market_entitlement('bundle') as allowed"));
  assert.equal(cryptoOnlyBundleAccess.rows[0].allowed, false, "a crypto-only plan must not read bundle signals");

  const transferAt = new Date(Date.parse(emptyAt) + 1).toISOString();
  const transferred = await db.query(
    "select public.reconcile_provider_entitlements($1,'revenuecat','rc-transfer',$2::jsonb,$3,false) as result",
    [ids.transfer, JSON.stringify([JSON.parse(snapshot)[0]]), transferAt]
  );
  assert.equal(transferred.rows[0].result.status, "active");
  assert.equal(
    (await db.query("select user_id from public.subscriptions where provider_order_id='rc:paid:crypto'")).rows[0].user_id,
    ids.transfer,
    "only a previously revoked RevenueCat order may transfer to another user"
  );

  await db.query(`
    insert into public.signals (
      symbol, timeframe, direction, setup_type, entry_price, visibility, market_scope
    )
    values
      ('PUBLIC','1h','long','fixture',1,'public','bundle'),
      ('COIN','1h','long','fixture',1,'premium','crypto'),
      ('STOCK','1h','long','fixture',1,'premium','stocks'),
      ('BUNDLE','1h','long','fixture',1,'premium','bundle')
  `);
  await setClaims(db, ids.basic);
  const basicSignals = await asRole(db, "authenticated", () => db.query("select symbol from public.signals order by symbol"));
  assert.deepEqual(basicSignals.rows.map((row) => row.symbol), ["PUBLIC"]);

  await setClaims(db, ids.paid);
  const paidSignals = await asRole(db, "authenticated", () => db.query("select symbol from public.signals order by symbol"));
  assert.deepEqual(paidSignals.rows.map((row) => row.symbol), ["COIN", "PUBLIC"]);

  await setClaims(db, ids.admin, "admin");
  const adminSignals = await asRole(db, "authenticated", () => db.query("select symbol from public.signals order by symbol"));
  assert.deepEqual(adminSignals.rows.map((row) => row.symbol), ["BUNDLE", "COIN", "PUBLIC", "STOCK"]);

  console.log("Canonical entitlement ledger and signal RLS matrix passed.");
} finally {
  await db.close();
}

const repoDb = await PGlite.create();
try {
  await repoDb.exec(`
    create schema auth;
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    create or replace function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;
    create table auth.users (id uuid primary key, raw_app_meta_data jsonb not null default '{}'::jsonb);
    create table public.profiles (
      id uuid primary key references auth.users(id),
      plan text not null default 'free',
      created_at timestamptz not null default now()
    );
    create table public.subscriptions (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references auth.users(id),
      provider text not null default 'manual',
      status text not null default 'inactive',
      plan text not null default 'free',
      market_scope text not null default 'trial',
      current_period_start timestamptz,
      current_period_end timestamptz,
      provider_customer_id text,
      provider_subscription_id text,
      provider_order_id text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create table public.signals (
      id uuid primary key default gen_random_uuid(),
      symbol text not null,
      timeframe text not null,
      bias text not null,
      verdict text not null,
      summary text not null default '',
      payload jsonb not null default '{}'::jsonb,
      visibility text not null default 'member' check (visibility in ('public','member','premium')),
      triggered_at timestamptz not null default now(),
      created_at timestamptz not null default now()
    );
    alter table public.signals enable row level security;
    create policy "repo_broad_read" on public.signals for select to authenticated using (true);
    grant select, insert, update, delete on public.signals to anon, authenticated, service_role;
  `);
  await repoDb.exec(emergencySql);
  await repoDb.exec(ledgerSql);
  await repoDb.exec(ledgerSql);
  await repoDb.exec(gateCAdvisorSql);
  await repoDb.exec(gateCAdvisorSql);
  await repoDb.exec(betaBackfillLockSql);
  await repoDb.exec(betaBackfillLockSql);
  const defaults = await repoDb.query(`
    select column_default, is_nullable
    from information_schema.columns
    where table_schema='public' and table_name='signals' and column_name='visibility'
  `);
  assert.match(defaults.rows[0].column_default, /premium/);
  assert.equal(defaults.rows[0].is_nullable, "NO");
  console.log("Repository-shape repeated migration matrix passed.");
} finally {
  await repoDb.close();
}

const freshDb = await PGlite.create();
try {
  await freshDb.exec(`
    create schema auth;
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    create or replace function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;
    create table auth.users (
      id uuid primary key,
      email text,
      raw_app_meta_data jsonb not null default '{}'::jsonb
    );
  `);
  for (let pass = 0; pass < 2; pass += 1) {
    await freshDb.exec(hotfixSql);
    await freshDb.exec(emergencySql);
    await freshDb.exec(ledgerSql);
    await freshDb.exec(accountDeletionSql);
    await freshDb.exec(gateCAdvisorSql);
    await freshDb.exec(betaBackfillLockSql);
  }
  const freshUserId = "30000000-0000-4000-8000-000000000001";
  await freshDb.query("insert into auth.users (id,email) values ($1,'fresh@example.invalid')", [freshUserId]);
  assert.equal(
    (await freshDb.query("select count(*)::int as count from public.profiles where id=$1", [freshUserId])).rows[0].count,
    1,
    "fresh replay must install a working signup profile trigger"
  );
  for (const table of ["profiles", "subscriptions", "billing_entitlement_events", "account_deletion_requests"]) {
    assert.equal(
      (await freshDb.query("select to_regclass($1) is not null as present", [`public.${table}`])).rows[0].present,
      true,
      `fresh replay must create public.${table}`
    );
  }
  console.log("Fresh production-shape repeated migration matrix passed.");
} finally {
  await freshDb.close();
}
