-- NEWS useful-v2 operational hardening:
-- - persist delayed CFTC positioning through the single news-sync lease
-- - claim FCM token attempts before network delivery for at-most-once semantics

create table if not exists public.cftc_positioning_observations (
  id uuid primary key default gen_random_uuid(),
  asset text not null check (asset in ('btc', 'eth')),
  report_date date not null,
  observed_at timestamptz not null,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (asset, report_date)
);

create index if not exists cftc_positioning_observations_asset_report_idx
  on public.cftc_positioning_observations (asset, report_date desc);

alter table public.cftc_positioning_observations enable row level security;
revoke all privileges on table public.cftc_positioning_observations from public, anon, authenticated;
revoke all privileges on table public.cftc_positioning_observations from service_role;
grant select, insert, update, delete on table public.cftc_positioning_observations to service_role;

-- RLS does not govern TRUNCATE/REFERENCES/TRIGGER. Rebuild the browser-role
-- ACL so authenticated users retain only their existing RLS-filtered SELECT.
revoke all privileges on table public.push_alert_events from public, anon, authenticated;
grant select on table public.push_alert_events to authenticated;

alter table public.push_alert_events
  add column if not exists delivery_attempted_token_ids uuid[] not null default '{}'::uuid[];

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.push_alert_events'::regclass
      and conname = 'push_alert_events_attempted_tokens_limit'
  ) then
    alter table public.push_alert_events
      add constraint push_alert_events_attempted_tokens_limit
      check (cardinality(delivery_attempted_token_ids) <= 20);
  end if;
end
$$;

create or replace function public.claim_news_impact_delivery_tokens(
  p_event_id uuid,
  p_attempt integer,
  p_token_ids uuid[]
)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.push_alert_events%rowtype;
  v_claimed uuid[] := '{}'::uuid[];
begin
  if p_event_id is null
     or p_attempt is null
     or p_token_ids is null
     or cardinality(p_token_ids) = 0
     or cardinality(p_token_ids) > 20 then
    return v_claimed;
  end if;

  select *
  into v_event
  from public.push_alert_events
  where id = p_event_id
    and rule_id = 'news-impact'
  for update;

  if not found
     or v_event.delivery_status <> 'sending'
     or v_event.delivery_attempt_count <> p_attempt
     or v_event.delivery_lease_until is null
     or v_event.delivery_lease_until <= pg_catalog.now() then
    return v_claimed;
  end if;

  select coalesce(array_agg(distinct token_id), '{}'::uuid[])
  into v_claimed
  from unnest(p_token_ids) token_id
  where not (token_id = any(coalesce(v_event.delivery_attempted_token_ids, '{}'::uuid[])));

  if cardinality(v_claimed) = 0
     or cardinality(coalesce(v_event.delivery_attempted_token_ids, '{}'::uuid[]) || v_claimed) > 20 then
    return '{}'::uuid[];
  end if;

  update public.push_alert_events
  set delivery_attempted_token_ids = (
        select array_agg(distinct token_id)
        from unnest(coalesce(v_event.delivery_attempted_token_ids, '{}'::uuid[]) || v_claimed) token_id
      )
  where id = p_event_id;

  return v_claimed;
end
$$;

revoke all on function public.claim_news_impact_delivery_tokens(uuid, integer, uuid[]) from public, anon, authenticated;
grant execute on function public.claim_news_impact_delivery_tokens(uuid, integer, uuid[]) to service_role;

create or replace function public.purge_news_impact_retention()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_sources integer := 0;
  v_events integer := 0;
  v_observations integer := 0;
  v_positioning integer := 0;
  v_runs integer := 0;
  v_alerts integer := 0;
begin
  delete from public.news_source_items where updated_at < pg_catalog.now() - interval '30 days';
  get diagnostics v_sources = row_count;
  delete from public.news_impact_events where occurred_at < pg_catalog.now() - interval '90 days';
  get diagnostics v_events = row_count;
  delete from public.global_reaction_observations where observed_at < pg_catalog.now() - interval '90 days';
  get diagnostics v_observations = row_count;
  delete from public.cftc_positioning_observations where report_date < (pg_catalog.now()::date - 90);
  get diagnostics v_positioning = row_count;
  delete from public.news_sync_runs where started_at < pg_catalog.now() - interval '30 days';
  get diagnostics v_runs = row_count;
  delete from public.push_alert_events
  where notification_kind = 'news_impact' and occurred_at < pg_catalog.now() - interval '90 days';
  get diagnostics v_alerts = row_count;
  delete from public.news_alert_budgets where budget_date < ((pg_catalog.now() at time zone 'Asia/Seoul')::date - 7);
  return jsonb_build_object(
    'sources', v_sources,
    'events', v_events,
    'observations', v_observations,
    'positioning', v_positioning,
    'runs', v_runs,
    'alerts', v_alerts
  );
end
$$;

revoke all on function public.purge_news_impact_retention() from public, anon, authenticated;
grant execute on function public.purge_news_impact_retention() to service_role;
