begin;

alter table public.product_events
  add column if not exists funnel_session_hash text,
  add column if not exists traffic_class text not null default 'user';

alter table public.product_events drop constraint if exists product_events_traffic_class_check;
alter table public.product_events add constraint product_events_traffic_class_check
  check (traffic_class in ('user', 'internal'));

alter table public.product_events drop constraint if exists product_events_funnel_session_hash_check;
alter table public.product_events add constraint product_events_funnel_session_hash_check
  check (funnel_session_hash is null or funnel_session_hash ~ '^[0-9a-f]{64}$');

alter table public.product_events drop constraint if exists product_events_event_name_check;
alter table public.product_events add constraint product_events_event_name_check check (event_name in (
  'home_snapshot_viewed', 'home_perpetual_opened', 'perpetual_snapshot_viewed',
  'pro_gate_viewed', 'pro_cta_clicked', 'monitor_created', 'monitor_failed', 'scenario_triggered',
  'scenario_opened', 'journal_saved', 'paywall_viewed', 'auth_started', 'auth_completed',
  'store_opened', 'purchase_started', 'store_purchase_succeeded', 'entitlement_sync_pending',
  'purchase_failed', 'purchase_cancelled', 'entitlement_activated', 'verified_trial_started',
  'trial_converted', 'subscription_cancelled', 'subscription_expired',
  'news_impact_viewed', 'news_source_opened', 'news_to_market_opened',
  'news_alert_opted_in', 'news_alert_opened', 'news_journal_saved'
));

create index if not exists product_events_funnel_session_idx
  on public.product_events (funnel_session_hash, occurred_at)
  where funnel_session_hash is not null;
create index if not exists product_events_traffic_funnel_idx
  on public.product_events (traffic_class, event_name, occurred_at desc);

create table if not exists public.product_purchase_attributions (
  provider text not null,
  provider_order_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null,
  attribution_id uuid not null,
  funnel_session_hash text,
  traffic_class text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '45 days'),
  primary key (provider, provider_order_id),
  check (provider ~ '^[a-z][a-z0-9_]{1,31}$'),
  check (plan_id ~ '^[a-z][a-z0-9_]{1,63}$'),
  check (funnel_session_hash is null or funnel_session_hash ~ '^[0-9a-f]{64}$'),
  check (traffic_class in ('user', 'internal'))
);

create index if not exists product_purchase_attributions_user_idx
  on public.product_purchase_attributions (user_id, provider, updated_at desc);

alter table public.product_purchase_attributions enable row level security;
revoke all privileges on table public.product_purchase_attributions from public, anon, authenticated;
revoke all privileges on table public.product_purchase_attributions from service_role;
grant select, insert, update, delete on table public.product_purchase_attributions to service_role;

create or replace function public.purge_perpetual_revenue_core_retention()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_events integer := 0;
  v_attributions integer := 0;
  v_snapshots integer := 0;
begin
  delete from public.product_events where occurred_at < now() - interval '90 days';
  get diagnostics v_events = row_count;
  delete from public.product_purchase_attributions where expires_at <= now();
  get diagnostics v_attributions = row_count;
  delete from public.perpetual_decision_snapshots snapshot
  where snapshot.generated_at < now() - interval '30 days';
  get diagnostics v_snapshots = row_count;
  return jsonb_build_object('product_events', v_events, 'purchase_attributions', v_attributions, 'snapshots', v_snapshots);
end
$$;

create or replace function public.mark_coin_pro_v2_internal_events(
  p_event_ids uuid[],
  p_expected_count integer default 12
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_unique_count integer;
  v_existing_count integer;
  v_updated_count integer;
begin
  if p_expected_count <> 12 then
    raise exception 'coin_pro_v2_internal_event_count_must_be_12';
  end if;

  select count(distinct event_id) into v_unique_count
  from unnest(coalesce(p_event_ids, array[]::uuid[])) as ids(event_id);
  if v_unique_count <> p_expected_count then
    raise exception 'expected_%_unique_event_ids_received_%', p_expected_count, v_unique_count;
  end if;

  select count(*) into v_existing_count
  from public.product_events
  where event_id = any(p_event_ids);
  if v_existing_count <> p_expected_count then
    raise exception 'expected_%_existing_events_found_%', p_expected_count, v_existing_count;
  end if;

  update public.product_events
  set traffic_class = 'internal'
  where event_id = any(p_event_ids);
  get diagnostics v_updated_count = row_count;
  return v_updated_count;
end;
$$;

revoke all on function public.mark_coin_pro_v2_internal_events(uuid[], integer) from public, anon, authenticated;
grant execute on function public.mark_coin_pro_v2_internal_events(uuid[], integer) to service_role;

-- product_events remains RLS-enabled and service-role-only. No client grant is added.

commit;
