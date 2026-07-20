-- Home -> Perpetual revenue core v1.
-- Forward-only and additive. Apply to production only after the separate rollout gate.

create table if not exists public.perpetual_decision_snapshots (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null,
  asset text not null check (asset in ('btc', 'eth')),
  symbol text not null check (symbol in ('BTCUSDT', 'ETHUSDT')),
  exchange text not null default 'binance' check (exchange = 'binance'),
  engine_version text not null,
  bucket_at timestamptz not null,
  generated_at timestamptz not null,
  expires_at timestamptz not null,
  quality text not null check (quality in ('ready', 'partial', 'stale', 'unavailable')),
  source_status jsonb not null default '{}'::jsonb,
  public_payload jsonb not null default '{}'::jsonb,
  pro_payload jsonb,
  created_at timestamptz not null default now(),
  unique (asset, bucket_at, engine_version)
);

create index if not exists perpetual_decision_snapshots_asset_generated_idx
  on public.perpetual_decision_snapshots (asset, generated_at desc);
create index if not exists perpetual_decision_snapshots_fingerprint_idx
  on public.perpetual_decision_snapshots (fingerprint);

create table if not exists public.perpetual_scenario_monitors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_id uuid not null references public.perpetual_decision_snapshots(id) on delete cascade,
  last_snapshot_id uuid references public.perpetual_decision_snapshots(id) on delete set null,
  condition_id text not null,
  condition jsonb not null,
  asset text not null check (asset in ('btc', 'eth')),
  symbol text not null check (symbol in ('BTCUSDT', 'ETHUSDT')),
  timeframe text not null check (timeframe in ('15m', '1h', '4h')),
  condition_kind text not null check (
    condition_kind in ('price_cross_above', 'price_cross_below', 'pressure_state_change', 'decision_state_change')
  ),
  condition_role text not null check (condition_role in ('primary', 'confirmation', 'invalidation')),
  threshold numeric,
  baseline_state text check (baseline_state in ('neutral', 'upside_watch', 'downside_watch', 'risk')),
  target_state text check (target_state in ('neutral', 'upside_watch', 'downside_watch', 'risk')),
  baseline_pressure text check (baseline_pressure in ('upsideShorts', 'downsideLongs', 'balanced')),
  target_pressure text check (target_pressure in ('upsideShorts', 'downsideLongs', 'balanced')),
  status text not null default 'active' check (
    status in ('active', 'paused', 'paused_entitlement', 'triggered', 'expired', 'canceled')
  ),
  expires_at timestamptz not null,
  last_evaluated_at timestamptz,
  triggered_at timestamptz,
  paused_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, snapshot_id, condition_id),
  unique (id, user_id)
);

create index if not exists perpetual_scenario_monitors_scan_idx
  on public.perpetual_scenario_monitors (asset, expires_at, created_at)
  where status = 'active';
create index if not exists perpetual_scenario_monitors_user_status_idx
  on public.perpetual_scenario_monitors (user_id, status, created_at);
create index if not exists perpetual_scenario_monitors_snapshot_idx
  on public.perpetual_scenario_monitors (snapshot_id);
create index if not exists perpetual_scenario_monitors_last_snapshot_idx
  on public.perpetual_scenario_monitors (last_snapshot_id)
  where last_snapshot_id is not null;
create unique index if not exists perpetual_scenario_monitors_live_condition_idx
  on public.perpetual_scenario_monitors (user_id, condition_id)
  where status in ('active', 'paused', 'paused_entitlement');

create table if not exists public.perpetual_decision_outcomes (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.perpetual_decision_snapshots(id) on delete cascade,
  condition_id text not null,
  outcome text not null check (outcome in ('confirmed', 'invalidated', 'expired', 'insufficient_data')),
  evaluator_version text not null,
  evaluated_at timestamptz not null default now(),
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (snapshot_id, condition_id, outcome)
);

create table if not exists public.product_events (
  event_id uuid primary key,
  event_name text not null check (
    event_name in (
      'home_snapshot_viewed', 'home_perpetual_opened', 'perpetual_snapshot_viewed',
      'pro_gate_viewed', 'monitor_created', 'monitor_failed', 'scenario_triggered',
      'scenario_opened', 'journal_saved', 'paywall_viewed', 'purchase_started',
      'purchase_failed', 'purchase_cancelled', 'entitlement_activated'
    )
  ),
  event_source text not null check (event_source in ('client', 'server')),
  user_id uuid references auth.users(id) on delete cascade,
  anonymous_id_hash text,
  surface text not null,
  asset text check (asset in ('btc', 'eth')),
  snapshot_id uuid references public.perpetual_decision_snapshots(id) on delete set null,
  monitor_id uuid references public.perpetual_scenario_monitors(id) on delete set null,
  attribution_id uuid,
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (
    (user_id is null and anonymous_id_hash is not null)
    or (user_id is not null and anonymous_id_hash is null)
  ),
  check (not (properties ?| array['ip', 'token', 'access_token', 'refresh_token', 'order_id', 'payment_id', 'leverage', 'entry_amount', 'pnl', 'free_text']))
);

create index if not exists product_events_name_occurred_idx
  on public.product_events (event_name, occurred_at desc);
create index if not exists product_events_user_occurred_idx
  on public.product_events (user_id, occurred_at desc)
  where user_id is not null;
create index if not exists product_events_snapshot_idx
  on public.product_events (snapshot_id)
  where snapshot_id is not null;
create index if not exists product_events_monitor_idx
  on public.product_events (monitor_id)
  where monitor_id is not null;

alter table public.push_alert_events
  add column if not exists occurred_at timestamptz,
  add column if not exists delivery_status text,
  add column if not exists delivery_attempt_count integer not null default 0,
  add column if not exists delivery_lease_until timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists sent_count integer not null default 0,
  add column if not exists failed_count integer not null default 0,
  add column if not exists last_delivery_error text;

update public.push_alert_events
set occurred_at = coalesce(occurred_at, sent_at, created_at),
    delivery_status = coalesce(delivery_status, 'sent'),
    delivered_at = coalesce(delivered_at, sent_at)
where occurred_at is null or delivery_status is null;

alter table public.push_alert_events
  alter column occurred_at set default now(),
  alter column occurred_at set not null,
  alter column delivery_status set default 'pending',
  alter column delivery_status set not null;

alter table public.push_alert_events drop constraint if exists push_alert_events_delivery_status_check;
alter table public.push_alert_events add constraint push_alert_events_delivery_status_check
  check (delivery_status in ('pending', 'sending', 'sent', 'partial', 'failed', 'in_app_only'));
alter table public.push_alert_events enable row level security;
revoke all privileges on table public.push_alert_events from public, anon;
revoke insert, update, delete on table public.push_alert_events from authenticated;
grant select on table public.push_alert_events to authenticated;
drop policy if exists "push_alert_events_select_own" on public.push_alert_events;
create policy "push_alert_events_select_own"
on public.push_alert_events for select
to authenticated
using ((select auth.uid()) = user_id);

alter table public.journals
  add column if not exists decision_snapshot_id uuid references public.perpetual_decision_snapshots(id) on delete set null,
  add column if not exists monitor_id uuid references public.perpetual_scenario_monitors(id) on delete set null,
  add column if not exists decision_context jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'journals_monitor_id_fkey'
      and conrelid = 'public.journals'::regclass
  ) then
    alter table public.journals
      add constraint journals_monitor_id_fkey
      foreign key (monitor_id) references public.perpetual_scenario_monitors(id) on delete set null;
  end if;
end
$$;

create index if not exists journals_decision_snapshot_idx
  on public.journals (decision_snapshot_id)
  where decision_snapshot_id is not null;
create index if not exists journals_monitor_idx
  on public.journals (monitor_id)
  where monitor_id is not null;

alter table public.journals drop constraint if exists journals_source_check;
alter table public.journals add constraint journals_source_check
  check (source in ('manual', 'chart', 'scout', 'snapshot', 'alert'));

create or replace function public.enforce_journal_monitor_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.monitor_id is not null and not exists (
    select 1
    from public.perpetual_scenario_monitors monitor
    where monitor.id = new.monitor_id
      and monitor.user_id = new.user_id
  ) then
    raise exception 'journal_monitor_owner_mismatch' using errcode = '23503';
  end if;
  return new;
end
$$;

drop trigger if exists journals_monitor_owner_guard on public.journals;
create trigger journals_monitor_owner_guard
before insert or update of monitor_id, user_id on public.journals
for each row execute function public.enforce_journal_monitor_owner();

alter table public.perpetual_decision_snapshots enable row level security;
alter table public.perpetual_scenario_monitors enable row level security;
alter table public.perpetual_decision_outcomes enable row level security;
alter table public.product_events enable row level security;

revoke all privileges on table public.perpetual_decision_snapshots from public, anon, authenticated;
revoke all privileges on table public.perpetual_scenario_monitors from public, anon, authenticated;
revoke all privileges on table public.perpetual_decision_outcomes from public, anon, authenticated;
revoke all privileges on table public.product_events from public, anon, authenticated;
revoke all privileges on table public.perpetual_decision_snapshots from service_role;
revoke all privileges on table public.perpetual_scenario_monitors from service_role;
revoke all privileges on table public.perpetual_decision_outcomes from service_role;
revoke all privileges on table public.product_events from service_role;
revoke all privileges on table public.push_alert_events from service_role;
revoke all privileges on table public.journals from service_role;
revoke all privileges on table public.profiles from service_role;
revoke all privileges on table public.push_alert_presets from service_role;
grant select, insert, update, delete on table public.perpetual_decision_snapshots to service_role;
grant select, insert, update, delete on table public.perpetual_scenario_monitors to service_role;
grant select, insert, update, delete on table public.perpetual_decision_outcomes to service_role;
grant select, insert, update, delete on table public.product_events to service_role;
grant select, insert, update, delete on table public.push_alert_events to service_role;
grant select, insert, update, delete on table public.journals to service_role;
grant select, update on table public.profiles to service_role;
grant select, insert, update, delete on table public.push_alert_presets to service_role;
revoke insert, update, delete on table public.push_alert_presets from public, anon, authenticated;

create or replace function public.create_perpetual_monitor(
  p_user_id uuid,
  p_snapshot_id uuid,
  p_condition_id text,
  p_condition jsonb,
  p_monitor_limit integer
)
returns setof public.perpetual_scenario_monitors
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_snapshot public.perpetual_decision_snapshots%rowtype;
  v_existing public.perpetual_scenario_monitors%rowtype;
  v_monitor_id uuid;
  v_used integer;
  v_expires_at timestamptz;
begin
  if p_user_id is null or p_monitor_limit is null or p_monitor_limit < 1 or p_monitor_limit > 20 then
    raise exception 'invalid_monitor_request' using errcode = '22023';
  end if;
  if p_condition is null or jsonb_typeof(p_condition) <> 'object' or p_condition->>'id' is distinct from p_condition_id then
    raise exception 'invalid_monitor_condition' using errcode = '22023';
  end if;

  perform 1 from public.profiles where id = p_user_id for update;
  if not found then raise exception 'monitor_user_not_found' using errcode = 'P0002'; end if;
  select * into v_snapshot
  from public.perpetual_decision_snapshots snapshot
  where snapshot.id = p_snapshot_id
  for share;
  if not found then raise exception 'snapshot_not_found' using errcode = 'P0002'; end if;
  if v_snapshot.quality <> 'ready' or v_snapshot.expires_at <= now() then
    raise exception 'snapshot_not_actionable' using errcode = 'P0001';
  end if;

  select * into v_existing
  from public.perpetual_scenario_monitors monitor
  where monitor.user_id = p_user_id
    and monitor.condition_id = p_condition_id
    and monitor.status in ('active', 'paused', 'paused_entitlement')
  order by monitor.created_at asc, monitor.id asc
  limit 1
  for update;
  if found then
    if v_existing.expires_at <= now() then
      update public.perpetual_scenario_monitors
      set status = 'expired', updated_at = now()
      where id = v_existing.id;
    elsif v_existing.status = 'active' then
      return query select monitor.* from public.perpetual_scenario_monitors monitor where monitor.id = v_existing.id;
      return;
    elsif v_existing.status = 'paused' then
      update public.perpetual_scenario_monitors
      set status = 'active', paused_at = null, updated_at = now()
      where id = v_existing.id;
      return query select monitor.* from public.perpetual_scenario_monitors monitor where monitor.id = v_existing.id;
      return;
    else
      raise exception 'monitor_limit_reached' using errcode = 'P0001';
    end if;
  end if;

  select * into v_existing
  from public.perpetual_scenario_monitors monitor
  where monitor.user_id = p_user_id
    and monitor.snapshot_id = p_snapshot_id
    and monitor.condition_id = p_condition_id
  for update;
  if found then raise exception 'monitor_not_rearmable' using errcode = 'P0001'; end if;

  select
    (select count(*) from public.perpetual_scenario_monitors monitor
      where monitor.user_id = p_user_id
        and monitor.status in ('active', 'paused')
        and monitor.expires_at > now())
    +
    (select count(*) from public.push_alert_presets preset where preset.user_id = p_user_id and preset.market = 'crypto' and preset.enabled = true)
  into v_used;
  if v_used >= p_monitor_limit then
    raise exception 'monitor_limit_reached' using errcode = 'P0001';
  end if;

  v_expires_at := least(
    coalesce(nullif(p_condition->>'expiresAt', '')::timestamptz, now() + interval '24 hours'),
    now() + interval '14 days'
  );
  if v_expires_at <= now() then raise exception 'condition_expired' using errcode = 'P0001'; end if;

  insert into public.perpetual_scenario_monitors (
    user_id, snapshot_id, condition_id, condition, asset, symbol, timeframe,
    condition_kind, condition_role, threshold, baseline_state, target_state,
    baseline_pressure, target_pressure, expires_at
  ) values (
    p_user_id, p_snapshot_id, p_condition_id, p_condition, v_snapshot.asset, v_snapshot.symbol,
    p_condition->>'timeframe', p_condition->>'kind', p_condition->>'role',
    nullif(p_condition->>'threshold', '')::numeric,
    nullif(p_condition->>'baselineState', ''), nullif(p_condition->>'targetState', ''),
    nullif(p_condition->>'baselinePressure', ''), nullif(p_condition->>'targetPressure', ''),
    v_expires_at
  )
  on conflict do nothing
  returning id into v_monitor_id;

  if v_monitor_id is null then
    select monitor.* into v_existing
    from public.perpetual_scenario_monitors monitor
    where monitor.user_id = p_user_id
      and monitor.condition_id = p_condition_id
      and monitor.status in ('active', 'paused', 'paused_entitlement')
    order by monitor.created_at asc, monitor.id asc
    limit 1
    for update;
    if found and v_existing.status = 'active' then
      v_monitor_id := v_existing.id;
    elsif found and v_existing.status = 'paused' then
      update public.perpetual_scenario_monitors
      set status = 'active', paused_at = null, updated_at = now()
      where id = v_existing.id;
      v_monitor_id := v_existing.id;
    elsif found then
      raise exception 'monitor_limit_reached' using errcode = 'P0001';
    end if;
  end if;

  if v_monitor_id is null then raise exception 'monitor_not_rearmable' using errcode = 'P0001'; end if;

  return query select monitor.* from public.perpetual_scenario_monitors monitor where monitor.id = v_monitor_id;
end
$$;

create or replace function public.set_perpetual_monitor_status(
  p_user_id uuid,
  p_monitor_id uuid,
  p_action text,
  p_monitor_limit integer
)
returns setof public.perpetual_scenario_monitors
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_monitor public.perpetual_scenario_monitors%rowtype;
  v_used integer;
begin
  perform 1 from public.profiles where id = p_user_id for update;
  if not found then raise exception 'monitor_user_not_found' using errcode = 'P0002'; end if;
  select * into v_monitor
  from public.perpetual_scenario_monitors monitor
  where monitor.id = p_monitor_id and monitor.user_id = p_user_id
  for update;
  if not found then raise exception 'monitor_not_found' using errcode = 'P0002'; end if;

  if p_action = 'cancel' then
    update public.perpetual_scenario_monitors
    set status = 'canceled', paused_at = now(), updated_at = now()
    where id = p_monitor_id and status in ('active', 'paused', 'paused_entitlement');
  elsif p_action = 'pause' then
    update public.perpetual_scenario_monitors set status = 'paused', paused_at = now(), updated_at = now() where id = p_monitor_id and status = 'active';
  elsif p_action = 'resume' then
    if v_monitor.status = 'active' then
      return query select monitor.* from public.perpetual_scenario_monitors monitor where monitor.id = p_monitor_id;
      return;
    end if;
    if v_monitor.status not in ('paused', 'paused_entitlement') then
      raise exception 'monitor_not_resumable' using errcode = 'P0001';
    end if;
    if p_monitor_limit is null or p_monitor_limit < 1 or p_monitor_limit > 20 then
      raise exception 'invalid_monitor_request' using errcode = '22023';
    end if;
    if v_monitor.expires_at <= now() then raise exception 'condition_expired' using errcode = 'P0001'; end if;
    select
      (select count(*) from public.perpetual_scenario_monitors monitor
        where monitor.user_id = p_user_id
          and monitor.id <> p_monitor_id
          and monitor.status in ('active', 'paused')
          and monitor.expires_at > now())
      +
      (select count(*) from public.push_alert_presets preset where preset.user_id = p_user_id and preset.market = 'crypto' and preset.enabled = true)
    into v_used;
    if v_used >= p_monitor_limit then raise exception 'monitor_limit_reached' using errcode = 'P0001'; end if;
    update public.perpetual_scenario_monitors set status = 'active', paused_at = null, updated_at = now() where id = p_monitor_id and status in ('paused', 'paused_entitlement');
  else
    raise exception 'invalid_monitor_action' using errcode = '22023';
  end if;
  return query select monitor.* from public.perpetual_scenario_monitors monitor where monitor.id = p_monitor_id;
end
$$;

create or replace function public.claim_perpetual_monitor_trigger(
  p_monitor_id uuid,
  p_evaluated_snapshot_id uuid,
  p_event_key text,
  p_title text,
  p_body text,
  p_payload jsonb,
  p_outcome text,
  p_evaluator_version text
)
returns table (event_id uuid, user_id uuid, claimed boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_monitor public.perpetual_scenario_monitors%rowtype;
  v_evaluated public.perpetual_decision_snapshots%rowtype;
  v_event_id uuid;
begin
  select * into v_monitor
  from public.perpetual_scenario_monitors monitor
  where monitor.id = p_monitor_id
  for update;
  if not found or v_monitor.status <> 'active' or v_monitor.expires_at <= now() then return; end if;

  select * into v_evaluated
  from public.perpetual_decision_snapshots snapshot
  where snapshot.id = p_evaluated_snapshot_id;
  if not found
     or v_evaluated.asset <> v_monitor.asset
     or v_evaluated.symbol <> v_monitor.symbol
     or v_evaluated.quality <> 'ready' then
    raise exception 'evaluated_snapshot_mismatch' using errcode = '22023';
  end if;

  update public.perpetual_scenario_monitors
  set status = 'triggered', last_snapshot_id = p_evaluated_snapshot_id,
      last_evaluated_at = now(), triggered_at = now(), updated_at = now()
  where id = p_monitor_id;

  insert into public.push_alert_events (
    user_id, market, rule_id, event_key, title, body, payload,
    occurred_at, sent_at, delivery_status
  ) values (
    v_monitor.user_id, 'crypto', 'perpetual_scenario', left(p_event_key, 240),
    left(p_title, 160), left(p_body, 500), coalesce(p_payload, '{}'::jsonb),
    now(), now(), 'pending'
  )
  on conflict do nothing
  returning id into v_event_id;

  if v_event_id is null then return; end if;
  insert into public.perpetual_decision_outcomes (
    snapshot_id, condition_id, outcome, evaluator_version, evaluated_at, evidence
  ) values (
    v_monitor.snapshot_id, v_monitor.condition_id, p_outcome, left(p_evaluator_version, 80), now(),
    jsonb_build_object('evaluated_snapshot_id', p_evaluated_snapshot_id)
  ) on conflict (snapshot_id, condition_id, outcome) do nothing;

  return query select v_event_id, v_monitor.user_id, true;
end
$$;

create or replace function public.lease_perpetual_alert_delivery(p_event_id uuid, p_lease_seconds integer default 90)
returns setof public.push_alert_events
language sql
security invoker
set search_path = ''
as $$
  update public.push_alert_events event
  set delivery_status = 'sending',
      delivery_attempt_count = event.delivery_attempt_count + 1,
      delivery_lease_until = now() + make_interval(secs => least(greatest(p_lease_seconds, 30), 300))
  where event.id = p_event_id
    and event.rule_id = 'perpetual_scenario'
    and event.delivery_attempt_count < 3
    and (
      event.delivery_status in ('pending', 'failed')
      or (event.delivery_status = 'sending' and event.delivery_lease_until < now())
    )
  returning event.*
$$;

create or replace function public.complete_perpetual_alert_delivery(
  p_event_id uuid,
  p_attempt integer,
  p_status text,
  p_sent_count integer,
  p_failed_count integer,
  p_error text default null
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_attempt is null or p_attempt < 1 or p_status not in ('sent', 'partial', 'failed', 'in_app_only') then
    raise exception 'invalid_delivery_status' using errcode = '22023';
  end if;
  update public.push_alert_events
  set delivery_status = p_status,
      sent_count = greatest(p_sent_count, 0),
      failed_count = greatest(p_failed_count, 0),
      delivered_at = case when p_status in ('sent', 'partial') then now() else delivered_at end,
      delivery_lease_until = null,
      last_delivery_error = left(p_error, 500)
  where id = p_event_id
    and rule_id = 'perpetual_scenario'
    and delivery_status = 'sending'
    and delivery_attempt_count = p_attempt;
  return found;
end
$$;

create or replace function public.replace_crypto_push_presets(
  p_user_id uuid,
  p_presets jsonb,
  p_monitor_limit integer
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_monitor_count integer;
  v_preset_count integer;
begin
  if p_user_id is null or p_presets is null or jsonb_typeof(p_presets) <> 'array'
     or p_monitor_limit is null or p_monitor_limit < 1 or p_monitor_limit > 20 then
    raise exception 'invalid_preset_request' using errcode = '22023';
  end if;
  perform 1 from public.profiles where id = p_user_id for update;
  if not found then raise exception 'monitor_user_not_found' using errcode = 'P0002'; end if;
  select count(*) into v_monitor_count
  from public.perpetual_scenario_monitors
  where user_id = p_user_id
    and status in ('active', 'paused')
    and expires_at > now();
  select count(*) into v_preset_count
  from jsonb_array_elements(p_presets) item
  where coalesce(item->>'market', 'crypto') = 'crypto';
  if v_monitor_count + v_preset_count > p_monitor_limit then
    raise exception 'monitor_limit_reached' using errcode = 'P0001';
  end if;

  delete from public.push_alert_presets where user_id = p_user_id and market = 'crypto';
  insert into public.push_alert_presets (
    user_id, market, preset_id, symbol, mode, timeframe, side, quality, score, headline, enabled, saved_at
  )
  select
    p_user_id, 'crypto', item->>'preset_id', item->>'symbol', nullif(item->>'mode', ''),
    item->>'timeframe', item->>'side', item->>'quality', coalesce((item->>'score')::numeric, 0),
    coalesce(item->>'headline', ''), true, coalesce((item->>'saved_at')::timestamptz, now())
  from jsonb_array_elements(p_presets) item
  where coalesce(item->>'market', 'crypto') = 'crypto';
  return v_preset_count;
end
$$;

create or replace function public.reconcile_perpetual_monitor_limit(
  p_user_id uuid,
  p_monitor_limit integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_active_monitors integer := 0;
  v_saved_monitors integer := 0;
  v_enabled_presets integer := 0;
  v_preset_capacity integer := 0;
begin
  if p_user_id is null or p_monitor_limit is null or p_monitor_limit < 0 or p_monitor_limit > 20 then
    raise exception 'invalid_monitor_request' using errcode = '22023';
  end if;
  perform 1 from public.profiles where id = p_user_id for update;
  if not found then raise exception 'monitor_user_not_found' using errcode = 'P0002'; end if;

  with ranked as (
    select id, row_number() over (order by created_at asc, id asc) as position
    from public.perpetual_scenario_monitors
    where user_id = p_user_id
      and status in ('active', 'paused', 'paused_entitlement')
      and expires_at > now()
  )
  update public.perpetual_scenario_monitors monitor
  set status = case
        when ranked.position > p_monitor_limit then 'paused_entitlement'
        when monitor.status = 'paused' then 'paused'
        else 'active'
      end,
      paused_at = case
        when ranked.position > p_monitor_limit then coalesce(monitor.paused_at, now())
        when monitor.status = 'paused' then monitor.paused_at
        else null
      end,
      updated_at = now()
  from ranked
  where monitor.id = ranked.id
    and monitor.status is distinct from case
      when ranked.position > p_monitor_limit then 'paused_entitlement'
      when monitor.status = 'paused' then 'paused'
      else 'active'
    end;

  select count(*) into v_active_monitors
  from public.perpetual_scenario_monitors
  where user_id = p_user_id and status = 'active';
  select count(*) into v_saved_monitors
  from public.perpetual_scenario_monitors
  where user_id = p_user_id
    and status in ('active', 'paused')
    and expires_at > now();
  v_preset_capacity := greatest(p_monitor_limit - v_saved_monitors, 0);

  with ranked as (
    select id, row_number() over (order by saved_at asc, id asc) as position
    from public.push_alert_presets
    where user_id = p_user_id and market = 'crypto' and enabled = true
  )
  update public.push_alert_presets preset
  set enabled = false, updated_at = now()
  from ranked
  where preset.id = ranked.id and ranked.position > v_preset_capacity;

  select count(*) into v_enabled_presets
  from public.push_alert_presets
  where user_id = p_user_id and market = 'crypto' and enabled = true;

  return jsonb_build_object(
    'active_monitors', v_active_monitors,
    'saved_monitors', v_saved_monitors,
    'enabled_presets', v_enabled_presets,
    'limit', p_monitor_limit
  );
end
$$;

create or replace function public.expire_perpetual_monitors(p_evaluator_version text)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_expired integer := 0;
begin
  with expired as (
    update public.perpetual_scenario_monitors
    set status = 'expired', last_evaluated_at = now(), updated_at = now()
    where status in ('active', 'paused', 'paused_entitlement') and expires_at <= now()
    returning snapshot_id, condition_id
  ), recorded as (
    insert into public.perpetual_decision_outcomes (
      snapshot_id, condition_id, outcome, evaluator_version, evaluated_at, evidence
    )
    select snapshot_id, condition_id, 'expired', left(coalesce(p_evaluator_version, 'unknown'), 80), now(),
           jsonb_build_object('reason', 'monitor_expired')
    from expired
    on conflict (snapshot_id, condition_id, outcome) do nothing
    returning 1
  )
  select count(*) into v_expired from expired;
  return v_expired;
end
$$;

create or replace function public.record_perpetual_decision_outcome(
  p_snapshot_id uuid,
  p_condition_id text,
  p_outcome text,
  p_evaluator_version text,
  p_evidence jsonb default '{}'::jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_outcome not in ('confirmed', 'invalidated', 'expired', 'insufficient_data') then
    raise exception 'invalid_decision_outcome' using errcode = '22023';
  end if;
  insert into public.perpetual_decision_outcomes (
    snapshot_id, condition_id, outcome, evaluator_version, evaluated_at, evidence
  ) values (
    p_snapshot_id, left(p_condition_id, 180), p_outcome,
    left(coalesce(p_evaluator_version, 'unknown'), 80), now(),
    jsonb_strip_nulls(jsonb_build_object(
      'quality', case when p_evidence->>'quality' in ('ready', 'partial', 'stale', 'unavailable') then p_evidence->>'quality' else null end,
      'reason', case when p_evidence->>'reason' in ('monitor_expired', 'insufficient_data') then p_evidence->>'reason' else null end,
      'evaluated_snapshot_id', case
        when coalesce(p_evidence->>'evaluated_snapshot_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then p_evidence->>'evaluated_snapshot_id'
        else null
      end
    ))
  ) on conflict (snapshot_id, condition_id, outcome) do nothing;
end
$$;

create or replace function public.purge_perpetual_revenue_core_retention()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_events integer := 0;
  v_snapshots integer := 0;
begin
  delete from public.product_events where occurred_at < now() - interval '90 days';
  get diagnostics v_events = row_count;
  delete from public.perpetual_decision_snapshots snapshot
  where snapshot.generated_at < now() - interval '30 days';
  get diagnostics v_snapshots = row_count;
  return jsonb_build_object('product_events', v_events, 'snapshots', v_snapshots);
end
$$;

create or replace function public.purge_account_application_data(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table_name text;
  affected integer;
  total_affected integer := 0;
begin
  foreach v_table_name in array array[
    'journals', 'push_alert_events', 'push_alert_presets', 'push_tokens',
    'product_events', 'perpetual_scenario_monitors', 'subscriptions', 'oauth_provider_credentials'
  ]
  loop
    if to_regclass('public.' || v_table_name) is not null
       and exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = v_table_name and column_name = 'user_id'
       ) then
      execute format('delete from public.%I where user_id = $1', v_table_name) using p_user_id;
      get diagnostics affected = row_count;
      total_affected := total_affected + affected;
    end if;
  end loop;

  if to_regclass('public.billing_entitlement_events') is not null then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'billing_entitlement_events' and column_name = 'actor_user_id'
    ) and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'billing_entitlement_events' and column_name = 'metadata'
    ) then
      execute $sql$
        update public.billing_entitlement_events
        set event_id = 'anonymized:' || id::text,
            user_id = case when user_id = $1 then null else user_id end,
            actor_user_id = case when actor_user_id = $1 then null else actor_user_id end,
            metadata = metadata - 'user_id' - 'email'
        where user_id = $1 or actor_user_id = $1
      $sql$ using p_user_id;
    else
      update public.billing_entitlement_events
      set event_id = 'anonymized:' || id::text,
          user_id = null
      where user_id = p_user_id;
    end if;
  end if;
  if to_regclass('public.profiles') is not null then delete from public.profiles where id = p_user_id; end if;
  return jsonb_build_object('deleted_rows', total_affected);
end
$$;

revoke all on function public.create_perpetual_monitor(uuid, uuid, text, jsonb, integer) from public, anon, authenticated;
revoke all on function public.enforce_journal_monitor_owner() from public, anon, authenticated;
revoke all on function public.set_perpetual_monitor_status(uuid, uuid, text, integer) from public, anon, authenticated;
revoke all on function public.claim_perpetual_monitor_trigger(uuid, uuid, text, text, text, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.lease_perpetual_alert_delivery(uuid, integer) from public, anon, authenticated;
revoke all on function public.complete_perpetual_alert_delivery(uuid, integer, text, integer, integer, text) from public, anon, authenticated;
revoke all on function public.replace_crypto_push_presets(uuid, jsonb, integer) from public, anon, authenticated;
revoke all on function public.reconcile_perpetual_monitor_limit(uuid, integer) from public, anon, authenticated;
revoke all on function public.expire_perpetual_monitors(text) from public, anon, authenticated;
revoke all on function public.record_perpetual_decision_outcome(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.purge_perpetual_revenue_core_retention() from public, anon, authenticated;
revoke all on function public.purge_account_application_data(uuid) from public, anon, authenticated;
grant execute on function public.create_perpetual_monitor(uuid, uuid, text, jsonb, integer) to service_role;
grant execute on function public.enforce_journal_monitor_owner() to service_role;
grant execute on function public.set_perpetual_monitor_status(uuid, uuid, text, integer) to service_role;
grant execute on function public.claim_perpetual_monitor_trigger(uuid, uuid, text, text, text, jsonb, text, text) to service_role;
grant execute on function public.lease_perpetual_alert_delivery(uuid, integer) to service_role;
grant execute on function public.complete_perpetual_alert_delivery(uuid, integer, text, integer, integer, text) to service_role;
grant execute on function public.replace_crypto_push_presets(uuid, jsonb, integer) to service_role;
grant execute on function public.reconcile_perpetual_monitor_limit(uuid, integer) to service_role;
grant execute on function public.expire_perpetual_monitors(text) to service_role;
grant execute on function public.record_perpetual_decision_outcome(uuid, text, text, text, jsonb) to service_role;
grant execute on function public.purge_perpetual_revenue_core_retention() to service_role;
grant execute on function public.purge_account_application_data(uuid) to service_role;
