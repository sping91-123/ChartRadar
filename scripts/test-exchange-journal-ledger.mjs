import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const root = process.cwd();
const migration = readFileSync(
  join(root, "supabase/migrations/20260728100654_exchange_trade_journal_v1.sql"),
  "utf8"
);
const fkIndexMigration = readFileSync(
  join(root, "supabase/migrations/20260730013000_exchange_trade_journal_fk_indexes.sql"),
  "utf8"
);
const assessmentIndexOrderMigration = readFileSync(
  join(root, "supabase/migrations/20260730014500_exchange_assessment_owner_index_order.sql"),
  "utf8"
);
const runtimeKillSwitchMigration = readFileSync(
  join(root, "supabase/migrations/20260730145928_exchange_runtime_kill_switch.sql"),
  "utf8"
);
const userId = "20000000-0000-4000-8000-000000000001";
const otherUserId = "20000000-0000-4000-8000-000000000002";
const connectionId = "30000000-0000-4000-8000-000000000001";
const secondConnectionId = "30000000-0000-4000-8000-000000000002";
const leaseToken = "40000000-0000-4000-8000-000000000001";
const secondLeaseToken = "40000000-0000-4000-8000-000000000002";
const thirdLeaseToken = "40000000-0000-4000-8000-000000000003";
const fingerprint = "a".repeat(64);
const db = await PGlite.create();

async function asService(sql, params = []) {
  await db.exec("set role service_role");
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
}

async function createConnection(id, provider, limit = 1, ownerId = userId, historyDays = 90) {
  return asService(
    `select * from public.create_exchange_connection(
      $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::text[],
      $11, $12, $13, $14::text[], $15, $16, $17, $18, $19
    )`,
    [
      id,
      ownerId,
      provider,
      `${provider} fixture`,
      "b".repeat(64),
      "fixture",
      "one_way",
      "••••1234",
      JSON.stringify({ readOnly: true }),
      ["203.0.113.10"],
      historyDays,
      historyDays === 90 ? "2026-04-01T00:00:00.000Z" : "2026-06-01T00:00:00.000Z",
      "2026-07-01T00:00:00.000Z",
      [],
      limit,
      "ciphertext",
      "iv",
      "tag",
      1
    ]
  );
}

function syncPayload(idSuffix = "1") {
  return {
    orders: [{
      external_order_id: `order-${idSuffix}`,
      symbol: "BTC/USDT:USDT",
      position_mode: "one_way",
      position_side: "net",
      open_close: "open",
      reduce_only: false,
      payload_fingerprint: fingerprint,
      observed_at: "2026-07-01T00:02:00.000Z"
    }],
    fills: [{
      external_trade_id: `trade-${idSuffix}`,
      external_order_id: `order-${idSuffix}`,
      symbol: "BTC/USDT:USDT",
      side: "buy",
      position_mode: "one_way",
      position_side: "net",
      open_close: "open",
      reduce_only: false,
      quantity_base: "1",
      quantity_contracts: "100",
      contract_multiplier: "0.01",
      price: "100",
      quote_notional: "100",
      provider_realized_pnl: null,
      fee_native_signed: "-0.1",
      fee_currency: "USDT",
      fee_quote_signed: "-0.1",
      executed_at: "2026-07-01T00:00:00.000Z",
      provider_sequence: "1",
      execution_type: "trade",
      payload_fingerprint: fingerprint
    }],
    cashflows: [{
      external_cashflow_id: `funding-${idSuffix}`,
      symbol: "BTC/USDT:USDT",
      position_side: "net",
      cashflow_type: "funding",
      amount_signed: "-0.2",
      currency: "USDT",
      amount_quote_signed: "-0.2",
      occurred_at: "2026-07-01T00:01:00.000Z",
      related_trade_id: null,
      related_order_id: null,
      allocation_status: "allocated",
      reconciliation_only: false,
      payload_fingerprint: fingerprint
    }],
    positions: [{
      position_fingerprint: "c".repeat(64),
      round_trip_key: `round-trip-${idSuffix}`,
      symbol: "BTC/USDT:USDT",
      position_side: "long",
      opened_at: "2026-07-01T00:00:00.000Z",
      closed_at: "2026-07-01T00:02:00.000Z",
      quantity_base: "1",
      average_entry_price: "100",
      average_exit_price: "110",
      realized_pnl: "10",
      provider_realized_pnl: "10",
      fee_total: "-0.21",
      funding_total: "-0.2",
      net_pnl: "9.59",
      exit_reason: "trade",
      fill_count: 2,
      calculation_version: "round_trip_v1",
      quality: "complete",
      warnings: []
    }]
  };
}

async function commit(connection, lease, payload, ownerId = userId) {
  return asService(
    `select public.commit_exchange_sync_batch(
      $1, $2, $3, $4, 'ready', 'fills', '*', $5::jsonb, $6,
      $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12::text[]
    ) as result`,
    [
      connection,
      ownerId,
      lease,
      "2026-07-01T00:00:00.000Z",
      JSON.stringify({ phase: "incremental", backfillBefore: null }),
      "2026-07-01T00:03:00.000Z",
      JSON.stringify(payload.orders),
      JSON.stringify(payload.fills),
      JSON.stringify(payload.cashflows),
      JSON.stringify(payload.positions),
      JSON.stringify({}),
      []
    ]
  );
}

function assessmentPayload(overrides = {}) {
  return {
    status: "ready",
    evaluation_version: "market_context_v1",
    input_fingerprint: "d".repeat(64),
    market_provider: "okx",
    market_symbol: "BTC-USDT-SWAP",
    primary_timeframe: "1m",
    context_timeframe: "5m",
    requested_from: "2026-06-30T21:00:00.000Z",
    requested_until: "2026-07-01T00:10:00.000Z",
    coverage_ratio: 1,
    expected_bars: 190,
    observed_bars: 190,
    max_gap_bars: 0,
    confidence: "high",
    entry_score: 82,
    entry_grade: "a",
    exit_score: 74,
    exit_grade: "b",
    holding_seconds: 120,
    duration_class: "ultra_short",
    significance: "meaningful",
    post_exit_confirmation: "reversal_after_exit",
    metrics: { mfe_atr: 1.2, mae_atr: 0.3, capture_ratio: 0.75 },
    entry_reasons: ["trend_aligned"],
    exit_reasons: ["high_move_capture"],
    significance_reasons: ["meaningful_excursion"],
    warnings: [],
    next_retry_at: null,
    evaluated_at: "2026-07-01T00:11:00.000Z",
    ...overrides
  };
}

async function upsertAssessment(
  positionId,
  ownerId = userId,
  connection = connectionId,
  overrides = {},
  positionFingerprint = "c".repeat(64)
) {
  return asService(
    "select public.upsert_exchange_trade_assessment($1,$2,$3,$4,$5::jsonb) as saved",
    [positionId, connection, ownerId, positionFingerprint, JSON.stringify(assessmentPayload(overrides))]
  );
}

try {
  await db.exec(`
    create schema auth;
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    create or replace function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create table auth.users (
      id uuid primary key,
      email text,
      raw_app_meta_data jsonb not null default '{}'::jsonb
    );
    create table public.profiles (
      id uuid primary key references auth.users(id) on delete cascade,
      plan text
    );
    create table public.subscriptions (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references auth.users(id),
      status text,
      market_scope text,
      current_period_end timestamptz,
      revoked_at timestamptz
    );
    create table public.account_deletion_requests (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references auth.users(id),
      status text not null
    );
    create table public.journals (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references auth.users(id),
      source text,
      created_at timestamptz not null default now()
    );
    insert into auth.users (id,email) values
      ('${userId}','exchange-fixture@example.invalid'),
      ('${otherUserId}','other-fixture@example.invalid');
    insert into public.profiles (id,plan) values
      ('${userId}',null),
      ('${otherUserId}',null);
  `);

  await db.exec(migration);
  await db.exec(migration);
  await db.exec(fkIndexMigration);
  await db.exec(fkIndexMigration);
  await db.exec(assessmentIndexOrderMigration);
  await db.exec(assessmentIndexOrderMigration);
  await db.exec(runtimeKillSwitchMigration);
  await db.exec(runtimeKillSwitchMigration);

  assert.equal(
    (await asService(
      "select operations_enabled from public.exchange_feature_control where id"
    )).rows[0].operations_enabled,
    false,
    "runtime exchange operations must be fail-closed after migration"
  );
  await db.exec(
    "update public.exchange_feature_control set operations_enabled=true, reason='fixture_enabled' where id"
  );

  for (const table of [
    "exchange_connections",
    "exchange_credentials",
    "exchange_order_contexts",
    "exchange_trade_fills",
    "exchange_cashflows",
    "exchange_trade_positions",
    "exchange_trade_assessments",
    "exchange_trade_reviews",
    "exchange_sync_checkpoints",
    "exchange_sync_runs"
  ]) {
    const rls = await db.query(
      "select relrowsecurity from pg_class where oid=$1::regclass",
      [`public.${table}`]
    );
    assert.equal(rls.rows[0].relrowsecurity, true, `${table} must enable RLS`);
    const authenticatedPrivilege = await db.query(
      "select has_table_privilege('authenticated', $1, 'SELECT') as allowed",
      [`public.${table}`]
    );
    assert.equal(authenticatedPrivilege.rows[0].allowed, false, `${table} must be server API only`);
  }
  assert.equal(
    (await db.query(
      "select count(*)::int as count from pg_indexes where schemaname='public' and indexname='exchange_sync_runs_connection_idx'"
    )).rows[0].count,
    1,
    "exchange sync run cleanup must use a connection index"
  );
  for (const indexName of [
    "exchange_cashflows_connection_owner_idx",
    "exchange_cashflows_user_idx",
    "exchange_credentials_connection_owner_idx",
    "exchange_order_contexts_connection_owner_idx",
    "exchange_sync_checkpoints_connection_owner_idx",
    "exchange_sync_checkpoints_user_idx",
    "exchange_sync_runs_connection_owner_idx",
    "exchange_trade_assessments_position_owner_idx",
    "exchange_trade_fills_connection_owner_idx",
    "exchange_trade_positions_connection_owner_idx",
    "exchange_trade_reviews_position_owner_idx"
  ]) {
    assert.equal(
      (await db.query(
        "select count(*)::int as count from pg_indexes where schemaname='public' and indexname=$1",
        [indexName]
      )).rows[0].count,
      1,
      `${indexName} must cover an exchange owner foreign key`
    );
  }
  assert.match(
    (await db.query(
      "select indexdef from pg_indexes where schemaname='public' and indexname='exchange_trade_assessments_position_owner_idx'"
    )).rows[0].indexdef,
    /\(position_id, connection_id, user_id\)$/,
    "assessment owner index must follow the composite foreign key order"
  );
  assert.equal(
    (await db.query(
      "select has_function_privilege('authenticated', 'public.commit_exchange_sync_batch(uuid,uuid,uuid,timestamptz,text,text,text,jsonb,timestamptz,jsonb,jsonb,jsonb,jsonb,jsonb,text[])', 'EXECUTE') as allowed"
    )).rows[0].allowed,
    false
  );
  assert.equal(
    (await db.query(
      "select has_function_privilege('authenticated', 'public.upsert_exchange_trade_assessment(uuid,uuid,uuid,text,jsonb)', 'EXECUTE') as allowed"
    )).rows[0].allowed,
    false
  );
  assert.equal(
    (await db.query(
      "select has_function_privilege('authenticated', 'public.list_due_exchange_trade_assessment_positions(uuid,uuid,timestamptz,integer)', 'EXECUTE') as allowed"
    )).rows[0].allowed,
    false
  );
  for (const childTable of ["exchange_trade_assessments", "exchange_trade_reviews"]) {
    assert.equal(
      (await db.query(
        `select count(*)::int as count
         from pg_constraint
         where conrelid=$1::regclass
           and confrelid='public.exchange_trade_positions'::regclass
           and contype='f'`,
        [`public.${childTable}`]
      )).rows[0].count,
      1,
      `${childTable} must expose one unambiguous position relationship`
    );
  }

  await assert.rejects(
    () => createConnection(connectionId, "okx"),
    /exchange coin pro required/,
    "Basic users must not create exchange connections"
  );
  await db.query(
    `insert into public.subscriptions (
      user_id,status,market_scope,current_period_end,revoked_at
    ) values ($1,'active','crypto',now()+interval '1 day',null)`,
    [userId]
  );

  const created = await createConnection(connectionId, "okx");
  assert.equal(created.rows[0].id, connectionId);
  assert.equal(
    (await asService("select count(*)::int as count from public.exchange_credentials where user_id=$1", [userId])).rows[0].count,
    1
  );
  await assert.rejects(
    () => createConnection("30000000-0000-4000-8000-000000000099", "bybit", 1),
    /exchange connection limit reached/
  );

  const claim = await asService(
    "select public.claim_exchange_connection($1,$2,$3) as claimed",
    [connectionId, userId, leaseToken]
  );
  assert.equal(claim.rows[0].claimed, true);
  const stolen = await asService(
    "select public.claim_exchange_connection($1,$2,$3) as claimed",
    [connectionId, userId, secondLeaseToken]
  );
  assert.equal(stolen.rows[0].claimed, false, "an active lease must not be stolen");

  const payload = syncPayload();
  await commit(connectionId, leaseToken, payload);
  assert.equal(
    Math.round(Number((await asService(
      "select extract(epoch from (next_sync_at-last_synced_at)) as seconds from public.exchange_connections where id=$1",
      [connectionId]
    )).rows[0].seconds)),
    600,
    "successful syncs must be due in 10 minutes so the five-minute cron stays within the 15-minute target"
  );
  for (const [table, expected] of [
    ["exchange_order_contexts", 1],
    ["exchange_trade_fills", 1],
    ["exchange_cashflows", 1],
    ["exchange_trade_positions", 1],
    ["exchange_sync_checkpoints", 1],
    ["exchange_sync_runs", 1]
  ]) {
    assert.equal(
      (await asService(`select count(*)::int as count from public.${table} where user_id=$1`, [userId])).rows[0].count,
      expected,
      `${table} first commit`
    );
  }
  const firstPositionId = (await asService(
    "select id from public.exchange_trade_positions where user_id=$1 and is_current limit 1",
    [userId]
  )).rows[0].id;
  assert.equal((await upsertAssessment(firstPositionId)).rows[0].saved, true);
  assert.equal((await upsertAssessment(firstPositionId, userId, connectionId, {
    entry_score: 80,
    evaluated_at: "2026-07-01T00:12:00.000Z"
  })).rows[0].saved, true);
  assert.equal((await upsertAssessment(firstPositionId, userId, connectionId, {
    status: "market_data_unavailable",
    confidence: "unavailable",
    entry_score: null,
    entry_grade: null,
    exit_score: null,
    exit_grade: null,
    significance: null,
    post_exit_confirmation: "unavailable",
    next_retry_at: "2026-07-01T06:13:00.000Z",
    evaluated_at: "2026-07-01T00:13:00.000Z"
  })).rows[0].saved, false, "a transient market failure must not downgrade a ready assessment");
  await assert.rejects(
    () => upsertAssessment(
      firstPositionId,
      userId,
      connectionId,
      { evaluated_at: "2026-07-01T00:14:00.000Z" },
      "e".repeat(64)
    ),
    /stale exchange position fingerprint/,
    "a stale evaluator must not overwrite the current position"
  );
  assert.equal(
    (await asService(
      "select count(*)::int as count from public.list_due_exchange_trade_assessment_positions($1,$2,$3,$4)",
      [userId, connectionId, "2026-07-02T00:00:00.000Z", 10]
    )).rows[0].count,
    1,
    "a protected ready assessment may retry later without being downgraded"
  );
  assert.equal(
    (await asService(
      "select count(*)::int as count from public.exchange_trade_assessments where user_id=$1",
      [userId]
    )).rows[0].count,
    1,
    "assessment upsert must remain one row per current position"
  );
  await assert.rejects(
    () => upsertAssessment(firstPositionId, otherUserId),
    /exchange coin pro required|current exchange position not found/,
    "assessment upsert must reject a different user"
  );
  await db.query(
    "update public.subscriptions set current_period_end=now()-interval '1 minute' where user_id=$1",
    [userId]
  );
  await assert.rejects(
    () => upsertAssessment(firstPositionId, userId, connectionId, {
      evaluated_at: "2026-07-01T00:15:00.000Z"
    }),
    /exchange coin pro required/,
    "an expired entitlement must reject assessment writes"
  );
  await db.query(
    "update public.subscriptions set current_period_end=now()+interval '1 day' where user_id=$1",
    [userId]
  );
  const assessmentDeletionId = "50000000-0000-4000-8000-000000000099";
  await db.query(
    "insert into public.account_deletion_requests (id,user_id,status) values ($1,$2,'pending')",
    [assessmentDeletionId, userId]
  );
  await assert.rejects(
    () => upsertAssessment(firstPositionId, userId, connectionId, {
      evaluated_at: "2026-07-01T00:16:00.000Z"
    }),
    /account deletion pending/,
    "deletion pending must reject assessment writes"
  );
  await db.query("delete from public.account_deletion_requests where id=$1", [assessmentDeletionId]);

  await asService(
    "update public.exchange_connections set next_sync_at=now(), sync_lease_until=null where id=$1 and user_id=$2",
    [connectionId, userId]
  );
  assert.equal(
    (await asService(
      "select public.claim_exchange_connection($1,$2,$3) as claimed",
      [connectionId, userId, secondLeaseToken]
    )).rows[0].claimed,
    true
  );
  await commit(connectionId, secondLeaseToken, payload);
  for (const table of [
    "exchange_order_contexts",
    "exchange_trade_fills",
    "exchange_cashflows",
    "exchange_trade_positions",
    "exchange_sync_checkpoints"
  ]) {
    assert.equal(
      (await asService(`select count(*)::int as count from public.${table} where user_id=$1`, [userId])).rows[0].count,
      1,
      `${table} must remain deduplicated after retry`
    );
  }
  assert.equal(
    (await asService("select count(*)::int as count from public.exchange_sync_runs where user_id=$1", [userId])).rows[0].count,
    2,
    "each successful sync attempt keeps an audit row"
  );

  await asService(
    "update public.exchange_connections set next_sync_at=now(), sync_lease_until=null where id=$1 and user_id=$2",
    [connectionId, userId]
  );
  assert.equal(
    (await asService(
      "select public.claim_exchange_connection($1,$2,$3) as claimed",
      [connectionId, userId, thirdLeaseToken]
    )).rows[0].claimed,
    true
  );
  await commit(connectionId, thirdLeaseToken, syncPayload("2"));
  assert.equal(
    (await asService(
      "select count(*)::int as count from public.exchange_trade_positions where user_id=$1 and is_current",
      [userId]
    )).rows[0].count,
    1,
    "a replacement calculation must expose only its current generation"
  );
  assert.equal(
    (await asService(
      "select count(*)::int as count from public.exchange_trade_positions where user_id=$1",
      [userId]
    )).rows[0].count,
    2,
    "superseded reviewed rows remain retained but inactive"
  );

  await asService(
    "update public.exchange_connections set next_sync_at=now(), sync_lease_until=null where id=$1",
    [connectionId]
  );
  const deletionId = "50000000-0000-4000-8000-000000000001";
  await db.query(
    "insert into public.account_deletion_requests (id,user_id,status) values ($1,$2,'pending')",
    [deletionId, userId]
  );
  assert.equal(
    (await asService(
      "select public.claim_exchange_connection($1,$2,$3) as claimed",
      [connectionId, userId, leaseToken]
    )).rows[0].claimed,
    false,
    "deletion pending must block claim"
  );
  await db.query("delete from public.account_deletion_requests where id=$1", [deletionId]);
  assert.equal(
    (await asService(
      "select public.claim_exchange_connection($1,$2,$3) as claimed",
      [connectionId, userId, leaseToken]
    )).rows[0].claimed,
    true
  );
  await db.query(
    "insert into public.account_deletion_requests (id,user_id,status) values ($1,$2,'processing')",
    [deletionId, userId]
  );
  await assert.rejects(() => commit(connectionId, leaseToken, payload), /account deletion pending/);
  assert.equal(
    (await asService("select count(*)::int as count from public.exchange_trade_fills where user_id=$1", [userId])).rows[0].count,
    2,
    "a rejected commit must not recreate or mutate ledger rows"
  );
  await db.query("delete from public.account_deletion_requests where id=$1", [deletionId]);

  await db.exec(
    "update public.exchange_feature_control set operations_enabled=false, reason='fixture_kill' where id"
  );
  await assert.rejects(
    () => commit(connectionId, leaseToken, payload),
    /exchange operations disabled/,
    "the database kill switch must reject a final ledger commit"
  );
  assert.equal(
    (await asService(
      "select count(*)::int as count from public.claim_due_exchange_connections(10,$1,null::uuid[])",
      ["40000000-0000-4000-8000-000000000020"]
    )).rows[0].count,
    0,
    "the database kill switch must reject scheduled claims"
  );
  assert.equal(
    (await asService(
      "select public.disconnect_exchange_connection($1,$2,false) as disconnected",
      [connectionId, userId]
    )).rows[0].disconnected,
    true
  );
  assert.equal(
    (await asService("select count(*)::int as count from public.exchange_credentials where user_id=$1", [userId])).rows[0].count,
    0,
    "disconnect must delete credentials immediately"
  );
  assert.equal(
    (await asService("select count(*)::int as count from public.exchange_trade_positions where user_id=$1", [userId])).rows[0].count,
    2,
    "disconnect can preserve normalized history"
  );
  await db.exec(
    "update public.exchange_feature_control set operations_enabled=true, reason='fixture_reenabled' where id"
  );
  const retainedPositionId = (await asService(
    "select id from public.exchange_trade_positions where user_id=$1 order by created_at limit 1",
    [userId]
  )).rows[0].id;
  await db.query(
    "insert into public.journals (user_id,source,trade_position_id) values ($1,'exchange',$2)",
    [userId, retainedPositionId]
  );
  assert.equal(
    (await asService(
      "select public.disconnect_exchange_connection($1,$2,true) as disconnected",
      [connectionId, userId]
    )).rows[0].disconnected,
    true,
    "delete-history disconnect removes a previously disconnected connection"
  );
  assert.equal(
    (await db.query(
      "select count(*)::int as count from public.journals where user_id=$1 and source='exchange'",
      [userId]
    )).rows[0].count,
    0,
    "delete-history disconnect removes normalized exchange journals"
  );

  await createConnection(secondConnectionId, "okx");
  assert.equal(
    (await asService(
      "select public.disconnect_exchange_connection($1,$2,true) as disconnected",
      [secondConnectionId, userId]
    )).rows[0].disconnected,
    true
  );
  assert.equal(
    (await asService("select count(*)::int as count from public.exchange_connections where id=$1", [secondConnectionId])).rows[0].count,
    0,
    "delete-history disconnect removes the connection root"
  );

  await asService("select public.purge_account_application_data($1)", [userId]);
  await asService("select public.purge_account_application_data($1)", [userId]);
  for (const table of [
    "exchange_connections",
    "exchange_credentials",
    "exchange_order_contexts",
    "exchange_trade_fills",
    "exchange_cashflows",
    "exchange_trade_positions",
    "exchange_trade_assessments",
    "exchange_trade_reviews",
    "exchange_sync_checkpoints",
    "exchange_sync_runs"
  ]) {
    assert.equal(
      (await asService(`select count(*)::int as count from public.${table} where user_id=$1`, [userId])).rows[0].count,
      0,
      `${table} must be empty after idempotent account purge`
    );
  }

  await db.query(
    `insert into public.subscriptions (
      user_id,status,market_scope,current_period_end,revoked_at
    ) values ($1,'active','crypto',now()+interval '1 day',null)`,
    [otherUserId]
  );
  const quotaOldest = "30000000-0000-4000-8000-000000000010";
  const quotaNewer = "30000000-0000-4000-8000-000000000011";
  await createConnection(quotaOldest, "okx", 5, otherUserId, 90);
  await createConnection(quotaNewer, "bybit", 5, otherUserId, 90);
  const canaryBlocked = await asService(
    "select * from public.claim_due_exchange_connections(10,$1,array[$2::uuid])",
    ["40000000-0000-4000-8000-000000000012", userId]
  );
  assert.equal(canaryBlocked.rows.length, 0, "cron must not lease users outside the canary allowlist");
  const expiryLease = "40000000-0000-4000-8000-000000000009";
  assert.equal(
    (await asService(
      "select public.claim_exchange_connection($1,$2,$3) as claimed",
      [quotaOldest, otherUserId, expiryLease]
    )).rows[0].claimed,
    true
  );
  await db.query("update public.subscriptions set current_period_end=now()-interval '1 minute' where user_id=$1", [otherUserId]);
  await assert.rejects(
    () => commit(quotaOldest, expiryLease, syncPayload("expired"), otherUserId),
    /exchange coin pro required/,
    "A lease acquired before expiry must not commit after entitlement expires"
  );
  await asService(
    `update public.exchange_connections
     set next_sync_at=case when id=$1 then now()+interval '1 hour' else now() end,
         sync_lease_until=null
     where user_id=$2`,
    [quotaOldest, otherUserId]
  );
  const blockedAfterExpiry = await asService(
    "select * from public.claim_due_exchange_connections(10,$1,null::uuid[])",
    ["40000000-0000-4000-8000-000000000010"]
  );
  assert.equal(blockedAfterExpiry.rows.length, 0, "Expired users must not receive cron sync leases");
  await asService(
    "update public.exchange_connections set next_sync_at=now() where id=$1",
    [quotaOldest]
  );
  const manualClaimAfterExpiry = await asService(
    "select public.claim_exchange_connection($1,$2,$3) as claimed",
    [quotaOldest, otherUserId, "40000000-0000-4000-8000-000000000011"]
  );
  assert.equal(manualClaimAfterExpiry.rows[0].claimed, false, "Expired users must not receive manual sync leases");
  await assert.rejects(
    () => createConnection("30000000-0000-4000-8000-000000000012", "bingx", 5, otherUserId, 90),
    /exchange coin pro required/,
    "Expired users must not add another exchange connection"
  );
  await asService("select public.purge_account_application_data($1)", [otherUserId]);

  console.log("Exchange ledger migration, RLS, lease, dedupe, disconnect, and purge matrix passed.");
} finally {
  await db.close();
}
