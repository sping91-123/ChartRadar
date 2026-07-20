import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260719145731_perpetual_revenue_core_v1.sql"),
  "utf8"
);
const journalReconcileMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260720053200_reconcile_journal_columns.sql"),
  "utf8"
);
const ids = {
  basic: "30000000-0000-4000-8000-000000000001",
  paid: "30000000-0000-4000-8000-000000000002",
  trigger: "30000000-0000-4000-8000-000000000003",
  preset: "30000000-0000-4000-8000-000000000004",
  quota: "30000000-0000-4000-8000-000000000005"
};
const snapshots = [
  "40000000-0000-4000-8000-000000000001",
  "40000000-0000-4000-8000-000000000002",
  "40000000-0000-4000-8000-000000000003",
  "40000000-0000-4000-8000-000000000004",
  "40000000-0000-4000-8000-000000000005",
  "40000000-0000-4000-8000-000000000006"
];

async function asRole(db, role, sql, params = []) {
  await db.exec(`set role ${role}`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
}

async function asAuthenticatedUser(db, userId, sql, params = []) {
  await db.exec("set role authenticated");
  try {
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [userId]);
    return await db.query(sql, params);
  } finally {
    await db.query("select set_config('request.jwt.claim.sub','',false)");
    await db.exec("reset role");
  }
}

function condition(id, threshold, expiresAt = new Date(Date.now() + 86_400_000).toISOString()) {
  return {
    id,
    kind: "price_cross_above",
    role: "primary",
    timeframe: "15m",
    label: `조건 ${id}`,
    threshold,
    expiresAt
  };
}

async function insertSnapshot(db, id, asset, offsetMinutes, quality = "ready", generatedAt = new Date()) {
  const symbol = asset === "btc" ? "BTCUSDT" : "ETHUSDT";
  const generated = new Date(generatedAt.getTime() + offsetMinutes * 60_000);
  await db.query(
    `insert into public.perpetual_decision_snapshots (
      id,fingerprint,asset,symbol,engine_version,bucket_at,generated_at,expires_at,quality
    ) values ($1,$2,$3,$4,'perpetual-v1.0.0',$5,$5,$6,$7)`,
    [id, `fingerprint-${id}`, asset, symbol, generated.toISOString(), new Date(Date.now() + 3_600_000).toISOString(), quality]
  );
}

const db = await PGlite.create();
try {
  await db.exec(`
    create schema auth;
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    grant usage on schema public, auth to anon, authenticated, service_role;
    create or replace function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create table auth.users (id uuid primary key, email text);
    create table public.profiles (
      id uuid primary key references auth.users(id) on delete cascade,
      created_at timestamptz not null default now()
    );
    create table public.journals (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references auth.users(id) on delete cascade,
      title text not null default '', bias text not null default '', note text not null default '',
      source text not null default 'manual' constraint journals_source_check check (source in ('manual','chart','scout')),
      created_at timestamptz not null default now()
    );
    create table public.push_alert_presets (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references auth.users(id) on delete cascade,
      market text not null check (market in ('crypto','stocks')),
      preset_id text not null,
      symbol text not null,
      mode text,
      timeframe text not null,
      side text not null check (side in ('long','short')),
      quality text not null check (quality in ('A','B','C')),
      score numeric not null default 0,
      headline text not null default '',
      enabled boolean not null default true,
      saved_at timestamptz not null default now(),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique(user_id,preset_id)
    );
    create table public.push_alert_events (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references auth.users(id) on delete cascade,
      market text not null default 'crypto' check (market in ('crypto','stocks')),
      rule_id text not null,
      event_key text not null,
      title text not null,
      body text not null,
      payload jsonb not null default '{}'::jsonb,
      sent_at timestamptz not null default now(),
      created_at timestamptz not null default now()
    );
    create unique index push_alert_events_user_event_idx on public.push_alert_events(user_id,event_key);
    create table public.push_tokens (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references auth.users(id) on delete cascade
    );
    create table public.subscriptions (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references auth.users(id) on delete cascade
    );
    create table public.oauth_provider_credentials (
      user_id uuid not null references auth.users(id) on delete cascade
    );
    create table public.account_deletion_requests (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references auth.users(id) on delete cascade
    );
    create table public.billing_entitlement_events (
      id bigint generated by default as identity primary key,
      provider text not null,
      event_id text not null,
      user_id uuid references auth.users(id)
    );
  `);
  await db.query(
    "insert into auth.users (id,email) values ($1,'basic@example.invalid'),($2,'paid@example.invalid'),($3,'trigger@example.invalid'),($4,'preset@example.invalid'),($5,'quota@example.invalid')",
    [ids.basic, ids.paid, ids.trigger, ids.preset, ids.quota]
  );
  await db.query("insert into public.profiles (id) values ($1),($2),($3),($4),($5)", [ids.basic, ids.paid, ids.trigger, ids.preset, ids.quota]);

  await db.exec(migration);
  await db.exec(migration);
  await db.exec(journalReconcileMigration);
  await db.exec(journalReconcileMigration);

  for (const columnName of ["market", "scout_snapshot", "outcome", "outcome_at", "updated_at"]) {
    assert.equal(
      (await db.query(
        "select count(*)::int as count from information_schema.columns where table_schema='public' and table_name='journals' and column_name=$1",
        [columnName]
      )).rows[0].count,
      1,
      `journals.${columnName} must be reconciled`
    );
  }
  for (const constraintName of ["journals_market_check", "journals_outcome_check"]) {
    assert.equal(
      (await db.query(
        "select count(*)::int as count from pg_constraint where conrelid='public.journals'::regclass and conname=$1",
        [constraintName]
      )).rows[0].count,
      1,
      `${constraintName} must exist once`
    );
  }
  assert.equal(
    (await db.query(
      "select count(*)::int as count from pg_trigger where tgrelid='public.journals'::regclass and tgname='set_journals_updated_at' and not tgisinternal"
    )).rows[0].count,
    1,
    "Journal updated_at trigger must exist once"
  );

  const revenueTables = [
    "perpetual_decision_snapshots",
    "perpetual_scenario_monitors",
    "perpetual_decision_outcomes",
    "product_events"
  ];
  for (const table of revenueTables) {
    assert.equal(
      (await db.query("select relrowsecurity from pg_class where oid=$1::regclass", [`public.${table}`])).rows[0].relrowsecurity,
      true,
      `${table} must have RLS enabled`
    );
    for (const role of ["anon", "authenticated"]) {
      for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
        assert.equal(
          (await db.query("select has_table_privilege($1,$2,$3) as allowed", [role, `public.${table}`, privilege])).rows[0].allowed,
          false,
          `${role} must not have ${privilege} on ${table}`
        );
      }
    }
    for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
      assert.equal(
        (await db.query("select has_table_privilege('service_role',$1,$2) as allowed", [`public.${table}`, privilege])).rows[0].allowed,
        true,
        `service_role must have ${privilege} on ${table}`
      );
    }
    for (const privilege of ["TRUNCATE", "REFERENCES", "TRIGGER"]) {
      assert.equal(
        (await db.query("select has_table_privilege('service_role',$1,$2) as allowed", [`public.${table}`, privilege])).rows[0].allowed,
        false,
        `service_role must not have ${privilege} on ${table}`
      );
    }
  }

  for (const indexName of [
    "perpetual_scenario_monitors_snapshot_idx",
    "perpetual_scenario_monitors_last_snapshot_idx",
    "product_events_snapshot_idx",
    "product_events_monitor_idx",
    "journals_decision_snapshot_idx",
    "journals_monitor_idx"
  ]) {
    assert.equal(
      (await db.query("select count(*)::int as count from pg_indexes where schemaname='public' and indexname=$1", [indexName])).rows[0].count,
      1,
      `${indexName} must exist`
    );
  }

  const serviceFunctions = [
    "public.create_perpetual_monitor(uuid,uuid,text,jsonb,integer)",
    "public.set_perpetual_monitor_status(uuid,uuid,text,integer)",
    "public.claim_perpetual_monitor_trigger(uuid,uuid,text,text,text,jsonb,text,text)",
    "public.lease_perpetual_alert_delivery(uuid,integer)",
    "public.complete_perpetual_alert_delivery(uuid,integer,text,integer,integer,text)",
    "public.replace_crypto_push_presets(uuid,jsonb,integer)",
    "public.reconcile_perpetual_monitor_limit(uuid,integer)",
    "public.expire_perpetual_monitors(text)",
    "public.record_perpetual_decision_outcome(uuid,text,text,text,jsonb)",
    "public.purge_perpetual_revenue_core_retention()",
    "public.purge_account_application_data(uuid)"
  ];
  for (const signature of serviceFunctions) {
    for (const role of ["anon", "authenticated"]) {
      assert.equal(
        (await db.query("select has_function_privilege($1,$2,'EXECUTE') as allowed", [role, signature])).rows[0].allowed,
        false,
        `${role} must not execute ${signature}`
      );
    }
    assert.equal(
      (await db.query("select has_function_privilege('service_role',$1,'EXECUTE') as allowed", [signature])).rows[0].allowed,
      true,
      `service_role must execute ${signature}`
    );
  }

  await db.query(`insert into public.push_alert_events (
    user_id,market,rule_id,event_key,title,body
  ) values
    ($1,'crypto','perpetual_scenario','rls-basic','관찰 조건 충족','basic'),
    ($2,'crypto','perpetual_scenario','rls-paid','판단 변경','paid')`, [ids.basic, ids.paid]);
  const basicHistory = await asAuthenticatedUser(
    db,
    ids.basic,
    "select user_id,event_key from public.push_alert_events order by event_key"
  );
  assert.deepEqual(basicHistory.rows.map((row) => row.event_key), ["rls-basic"], "authenticated users must only read their own in-app alert history");
  const paidHistory = await asAuthenticatedUser(
    db,
    ids.paid,
    "select user_id,event_key from public.push_alert_events order by event_key"
  );
  assert.deepEqual(paidHistory.rows.map((row) => row.event_key), ["rls-paid"]);
  await assert.rejects(
    () => asRole(db, "anon", "select id from public.push_alert_events"),
    /permission denied/,
    "anonymous users must not read alert history"
  );

  for (let index = 0; index < snapshots.length; index += 1) {
    await insertSnapshot(db, snapshots[index], index === 5 ? "eth" : "btc", index);
  }

  const basicCondition = condition("basic-primary", 100);
  const first = await asRole(db, "service_role", "select * from public.create_perpetual_monitor($1,$2,$3,$4,$5)", [
    ids.basic, snapshots[0], basicCondition.id, basicCondition, 1
  ]);
  assert.equal(first.rows.length, 1);
  const repeated = await asRole(db, "service_role", "select * from public.create_perpetual_monitor($1,$2,$3,$4,$5)", [
    ids.basic, snapshots[0], basicCondition.id, basicCondition, 1
  ]);
  assert.equal(repeated.rows[0].id, first.rows[0].id, "duplicate create must return the existing monitor");
  await asRole(db, "service_role", "select * from public.set_perpetual_monitor_status($1,$2,'pause',1)", [ids.basic, first.rows[0].id]);
  const resumedByCreate = await asRole(db, "service_role", "select * from public.create_perpetual_monitor($1,$2,$3,$4,$5)", [
    ids.basic, snapshots[1], basicCondition.id, basicCondition, 1
  ]);
  assert.equal(resumedByCreate.rows[0].id, first.rows[0].id, "creating a user-paused condition must resume the existing monitor instead of reporting a false success");
  assert.equal(resumedByCreate.rows[0].status, "active");
  await asRole(db, "service_role", "select * from public.set_perpetual_monitor_status($1,$2,'pause',1)", [ids.basic, first.rows[0].id]);
  await assert.rejects(
    () => asRole(db, "service_role", "select * from public.create_perpetual_monitor($1,$2,$3,$4,$5)", [
      ids.basic, snapshots[1], "basic-second", condition("basic-second", 101), 1
    ]),
    /monitor_limit_reached/,
    "paused monitors must still consume the saved-condition quota"
  );

  await db.query(`insert into public.push_alert_presets (
    user_id,market,preset_id,symbol,timeframe,side,quality
  ) values ($1,'crypto','crypto:preset','BTCUSDT','15m','long','A')`, [ids.preset]);
  await assert.rejects(
    () => asRole(db, "service_role", "select * from public.create_perpetual_monitor($1,$2,$3,$4,$5)", [
      ids.preset, snapshots[1], "preset-shared", condition("preset-shared", 102), 1
    ]),
    /monitor_limit_reached/,
    "presets and scenario monitors must share one quota"
  );

  const paidMonitorIds = [];
  for (let index = 1; index <= 3; index += 1) {
    const id = `paid-${index}`;
    const created = await asRole(db, "service_role", "select * from public.create_perpetual_monitor($1,$2,$3,$4,$5)", [
      ids.paid, snapshots[index], id, condition(id, 110 + index), 20
    ]);
    paidMonitorIds.push(created.rows[0].id);
  }
  await asRole(db, "service_role", "select * from public.set_perpetual_monitor_status($1,$2,'pause',20)", [ids.paid, paidMonitorIds[0]]);
  await db.query(`insert into public.push_alert_presets (
    user_id,market,preset_id,symbol,timeframe,side,quality
  ) values ($1,'crypto','paid:preset','BTCUSDT','15m','long','A')`, [ids.paid]);
  await asRole(db, "service_role", "select public.reconcile_perpetual_monitor_limit($1,1)", [ids.paid]);
  const reconciled = await db.query(
    "select status,count(*)::int as count from public.perpetual_scenario_monitors where user_id=$1 group by status order by status",
    [ids.paid]
  );
  assert.deepEqual(
    Object.fromEntries(reconciled.rows.map((row) => [row.status, row.count])),
    { paused: 1, paused_entitlement: 2 },
    "downgrade must count user-paused rows, preserve the oldest pause, and entitlement-pause every row beyond the Basic limit"
  );
  assert.equal(
    (await db.query("select count(*)::int as count from public.push_alert_presets where user_id=$1 and enabled=true", [ids.paid])).rows[0].count,
    0,
    "a retained user-paused monitor must consume the shared Basic slot and disable paid presets"
  );
  assert.equal(
    (await db.query("select count(*)::int as count from public.perpetual_scenario_monitors where user_id=$1 and status in ('active','paused')", [ids.paid])).rows[0].count,
    1,
    "paused_entitlement preservation rows must stay outside the current entitlement quota"
  );
  await assert.rejects(
    () => asRole(db, "service_role", "select * from public.create_perpetual_monitor($1,$2,$3,$4,$5)", [
      ids.paid, snapshots[5], "paid-2", condition("paid-2", 112), 1
    ]),
    /monitor_limit_reached/,
    "creating a preserved entitlement-paused condition must not return an inactive monitor as a successful start"
  );

  const resumedPaused = await asRole(db, "service_role", "select * from public.set_perpetual_monitor_status($1,$2,'resume',1)", [ids.paid, paidMonitorIds[0]]);
  assert.equal(resumedPaused.rows[0].status, "active", "resuming a user-paused monitor must not double-count the target row");
  await asRole(db, "service_role", "select * from public.set_perpetual_monitor_status($1,$2,'pause',1)", [ids.paid, paidMonitorIds[0]]);
  await assert.rejects(
    () => asRole(db, "service_role", "select * from public.set_perpetual_monitor_status($1,$2,'resume',1)", [ids.paid, paidMonitorIds[1]]),
    /monitor_limit_reached/,
    "an entitlement-paused monitor must not resume while another saved condition consumes the Basic slot"
  );
  await asRole(db, "service_role", "select * from public.set_perpetual_monitor_status($1,$2,'cancel',1)", [ids.paid, paidMonitorIds[0]]);

  const replacement = await asRole(db, "service_role", "select * from public.create_perpetual_monitor($1,$2,$3,$4,$5)", [
    ids.paid, snapshots[4], "paid-basic-replacement", condition("paid-basic-replacement", 115), 1
  ]);
  assert.equal(replacement.rows[0].status, "active", "paused_entitlement rows must not block a new monitor in a free Basic slot");
  await asRole(db, "service_role", "select * from public.set_perpetual_monitor_status($1,$2,'cancel',1)", [ids.paid, replacement.rows[0].id]);

  const replacementPreset = [{
    market: "crypto",
    preset_id: "paid:replacement",
    symbol: "BTCUSDT",
    mode: "majors",
    timeframe: "15m",
    side: "long",
    quality: "A",
    score: 1,
    headline: "replacement",
    saved_at: new Date().toISOString()
  }];
  await asRole(db, "service_role", "select public.replace_crypto_push_presets($1,$2::jsonb,1)", [ids.paid, JSON.stringify(replacementPreset)]);
  await assert.rejects(
    () => asRole(db, "service_role", "select * from public.set_perpetual_monitor_status($1,$2,'resume',1)", [ids.paid, paidMonitorIds[1]]),
    /monitor_limit_reached/,
    "an enabled preset must share the slot with an entitlement-paused monitor that is being resumed"
  );
  await asRole(db, "service_role", "select public.replace_crypto_push_presets($1,$2::jsonb,1)", [ids.paid, JSON.stringify([])]);
  const resumedEntitlement = await asRole(db, "service_role", "select * from public.set_perpetual_monitor_status($1,$2,'resume',1)", [ids.paid, paidMonitorIds[1]]);
  assert.equal(resumedEntitlement.rows[0].status, "active", "an entitlement-paused monitor must resume when the shared slot is free");

  await db.query(
    "update public.perpetual_scenario_monitors set status='paused',expires_at=now()-interval '1 minute' where id=$1",
    [paidMonitorIds[1]]
  );
  const expired = await asRole(db, "service_role", "select public.expire_perpetual_monitors('test-v1') as count");
  assert.equal(expired.rows[0].count, 1);
  assert.equal((await db.query("select status from public.perpetual_scenario_monitors where id=$1", [paidMonitorIds[1]])).rows[0].status, "expired");
  assert.equal(
    (await db.query("select count(*)::int as count from public.perpetual_decision_outcomes where outcome='expired'")).rows[0].count,
    1,
    "paused expiry must create a global expired outcome"
  );

  for (let index = 0; index < 20; index += 1) {
    const id = `quota-${index}`;
    const created = await asRole(db, "service_role", "select * from public.create_perpetual_monitor($1,$2,$3,$4,$5)", [
      ids.quota, snapshots[0], id, condition(id, 200 + index), 20
    ]);
    assert.equal(created.rows[0].status, "active");
  }
  await assert.rejects(
    () => asRole(db, "service_role", "select * from public.create_perpetual_monitor($1,$2,$3,$4,$5)", [
      ids.quota, snapshots[0], "quota-20", condition("quota-20", 220), 20
    ]),
    /monitor_limit_reached/,
    "Coin Pro must allow exactly 20 shared conditions and reject the 21st"
  );

  const triggerCondition = condition("trigger-primary", 120);
  const triggerMonitor = await asRole(db, "service_role", "select * from public.create_perpetual_monitor($1,$2,$3,$4,$5)", [
    ids.trigger, snapshots[4], triggerCondition.id, triggerCondition, 20
  ]);
  await assert.rejects(
    () => asRole(db, "service_role", "select * from public.claim_perpetual_monitor_trigger($1,$2,'bad-asset','관찰 조건 충족','조건 확인',$3,'confirmed','test-v1')", [
      triggerMonitor.rows[0].id,
      snapshots[5],
      { type: "perpetual_scenario", destination: "perpetual_snapshot" }
    ]),
    /evaluated_snapshot_mismatch/,
    "an evaluated snapshot from another asset must be rejected"
  );
  const payload = {
    type: "perpetual_scenario",
    destination: "perpetual_snapshot",
    asset: "btc",
    snapshotId: snapshots[3],
    monitorId: triggerMonitor.rows[0].id,
    conditionId: triggerCondition.id
  };
  const claimed = await asRole(db, "service_role", "select * from public.claim_perpetual_monitor_trigger($1,$2,'trigger-once','관찰 조건 충족','조건 확인',$3,'confirmed','test-v1')", [
    triggerMonitor.rows[0].id, snapshots[3], payload
  ]);
  assert.equal(claimed.rows.length, 1);
  const triggerLink = await db.query(
    "select snapshot_id,last_snapshot_id from public.perpetual_scenario_monitors where id=$1",
    [triggerMonitor.rows[0].id]
  );
  assert.equal(triggerLink.rows[0].snapshot_id, snapshots[4]);
  assert.equal(
    triggerLink.rows[0].last_snapshot_id,
    snapshots[3],
    "the alert and Journal contract must retain the evaluated trigger snapshot separately from the creation snapshot"
  );
  const claimedAgain = await asRole(db, "service_role", "select * from public.claim_perpetual_monitor_trigger($1,$2,'trigger-once','관찰 조건 충족','조건 확인',$3,'confirmed','test-v1')", [
    triggerMonitor.rows[0].id, snapshots[3], payload
  ]);
  assert.equal(claimedAgain.rows.length, 0, "a triggered monitor cannot be claimed twice");
  await assert.rejects(
    () => asRole(db, "service_role", "select * from public.create_perpetual_monitor($1,$2,$3,$4,$5)", [
      ids.trigger, snapshots[4], triggerCondition.id, triggerCondition, 20
    ]),
    /monitor_not_rearmable/,
    "a terminal one-shot condition must retain its row and cannot be rearmed on the same snapshot"
  );
  assert.equal(
    (await db.query("select count(*)::int as count from public.perpetual_scenario_monitors where id=$1", [triggerMonitor.rows[0].id])).rows[0].count,
    1,
    "terminal monitor history must remain available for Journal and product-event foreign keys"
  );

  const eventId = claimed.rows[0].event_id;
  const lease = await asRole(db, "service_role", "select * from public.lease_perpetual_alert_delivery($1,90)", [eventId]);
  assert.equal(lease.rows.length, 1);
  assert.equal((await asRole(db, "service_role", "select * from public.lease_perpetual_alert_delivery($1,90)", [eventId])).rows.length, 0);
  const staleAttempt = lease.rows[0].delivery_attempt_count;
  await db.query("update public.push_alert_events set delivery_lease_until=now()-interval '1 second' where id=$1", [eventId]);
  const recoveredLease = await asRole(db, "service_role", "select * from public.lease_perpetual_alert_delivery($1,90)", [eventId]);
  assert.equal(recoveredLease.rows.length, 1, "an expired delivery lease must be recoverable");
  const currentAttempt = recoveredLease.rows[0].delivery_attempt_count;
  assert.equal(currentAttempt, staleAttempt + 1);
  assert.equal(
    (await asRole(db, "service_role", "select public.complete_perpetual_alert_delivery($1,$2,'sent',1,0,null) as completed", [eventId, staleAttempt])).rows[0].completed,
    false,
    "a stale worker attempt must not complete a newer lease"
  );
  assert.equal(
    (await asRole(db, "service_role", "select public.complete_perpetual_alert_delivery($1,$2,'sent',1,0,null) as completed", [eventId, currentAttempt])).rows[0].completed,
    true
  );

  const oldSnapshot = "40000000-0000-4000-8000-000000000099";
  await insertSnapshot(db, oldSnapshot, "btc", 0, "ready", new Date(Date.now() - 31 * 86_400_000));
  await db.query(`insert into public.product_events (
    event_id,event_name,event_source,user_id,surface,occurred_at
  ) values ('50000000-0000-4000-8000-000000000001','paywall_viewed','client',$1,'paywall',now()-interval '91 days')`, [ids.trigger]);
  await asRole(db, "service_role", "select public.purge_perpetual_revenue_core_retention()");
  assert.equal((await db.query("select count(*)::int as count from public.perpetual_decision_snapshots where id=$1", [oldSnapshot])).rows[0].count, 0);
  assert.equal((await db.query("select count(*)::int as count from public.product_events where event_id='50000000-0000-4000-8000-000000000001'")).rows[0].count, 0);

  await db.query(`insert into public.journals (
    user_id,title,bias,note,source,decision_snapshot_id,monitor_id
  ) values ($1,'복기','','','alert',$2,$3)`, [ids.trigger, snapshots[4], triggerMonitor.rows[0].id]);
  await db.query(`insert into public.product_events (
    event_id,event_name,event_source,user_id,surface,snapshot_id,monitor_id,occurred_at
  ) values ('50000000-0000-4000-8000-000000000002','journal_saved','server',$1,'journal',$2,$3,now())`, [
    ids.trigger, snapshots[4], triggerMonitor.rows[0].id
  ]);
  const outcomeBeforePurge = (await db.query("select count(*)::int as count from public.perpetual_decision_outcomes where snapshot_id=$1", [snapshots[4]])).rows[0].count;
  await asRole(db, "service_role", "select public.purge_account_application_data($1)", [ids.trigger]);
  await asRole(db, "service_role", "select public.purge_account_application_data($1)", [ids.trigger]);
  assert.equal((await db.query("select count(*)::int as count from public.journals where user_id=$1", [ids.trigger])).rows[0].count, 0);
  assert.equal((await db.query("select count(*)::int as count from public.perpetual_scenario_monitors where user_id=$1", [ids.trigger])).rows[0].count, 0);
  assert.equal((await db.query("select count(*)::int as count from public.product_events where user_id=$1", [ids.trigger])).rows[0].count, 0);
  assert.equal((await db.query("select count(*)::int as count from public.perpetual_decision_snapshots where id=$1", [snapshots[4]])).rows[0].count, 1);
  assert.equal((await db.query("select count(*)::int as count from public.perpetual_decision_outcomes where snapshot_id=$1", [snapshots[4]])).rows[0].count, outcomeBeforePurge);

  console.log("Perpetual monitor migration, quota, trigger, delivery, retention, and purge matrix passed.");
} finally {
  await db.close();
}
