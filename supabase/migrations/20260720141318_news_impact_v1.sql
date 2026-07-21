-- News Impact v1 is a service-role-only event, reaction, and notification ledger.

-- Production did not receive the historical macro storage migration. Bootstrap the
-- dependency here so this forward-only migration converges both fresh and existing
-- projects without replaying the legacy migration directory.

create table if not exists public.macro_events (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_event_id text not null,
  event_type text not null check (event_type in ('numeric_release', 'document_release', 'meeting_event', 'speech_event', 'calendar_event')),
  title text not null,
  country text not null default 'US',
  category text not null default 'macro',
  importance integer not null default 1 check (importance in (1, 2, 3)),
  scheduled_at timestamptz not null,
  released_at timestamptz,
  status text not null check (
    status in (
      'scheduled', 'imminent', 'in_progress', 'checking', 'released',
      'released_pending_actual', 'actual_available',
      'document_released', 'meeting_completed', 'official_check_needed',
      'delayed', 'stale', 'past'
    )
  ),
  status_label text not null,
  actual_value text,
  consensus_value text,
  previous_value text,
  unit text,
  source_url text,
  official_url text,
  confidence numeric,
  stale_reason text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_event_id)
);

create index if not exists macro_events_scheduled_at_idx
  on public.macro_events (scheduled_at);
create index if not exists macro_events_status_idx
  on public.macro_events (status, scheduled_at);

create table if not exists public.macro_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  status text not null,
  fetched_count integer not null default 0,
  updated_count integer not null default 0,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists macro_sync_runs_started_at_idx
  on public.macro_sync_runs (started_at desc);

create table if not exists public.news_source_catalog (
  source_id text primary key,
  display_name text not null,
  policy_status text not null check (policy_status in ('allowed', 'review', 'blocked')),
  policy_reason text not null,
  terms_url text not null check (terms_url ~ '^https://'),
  reviewed_at date not null,
  max_requests_per_second numeric not null check (max_requests_per_second >= 0 and max_requests_per_second <= 2),
  timeout_ms integer not null check (timeout_ms between 0 and 30000),
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not enabled or policy_status = 'allowed')
);

insert into public.news_source_catalog as current_source (
  source_id, display_name, policy_status, policy_reason, terms_url, reviewed_at,
  max_requests_per_second, timeout_ms, enabled
) values
  ('macro_official_store', 'ChartRadar 공식 매크로 원장', 'allowed', 'official_structured_release', 'https://www.bls.gov/developers/', '2026-07-20', 1, 8000, true),
  ('fed_press_releases', 'Federal Reserve', 'allowed', 'official_rss', 'https://www.federalreserve.gov/feeds/feeds.htm', '2026-07-20', 1, 8000, true),
  ('sec_press_releases', 'U.S. SEC', 'allowed', 'official_rss', 'https://www.sec.gov/about/developer-resources', '2026-07-20', 2, 10000, true),
  ('sec_edgar_tracked', 'SEC EDGAR', 'allowed', 'official_api_tracked_universe', 'https://www.sec.gov/search-filings/edgar-application-programming-interfaces', '2026-07-20', 2, 10000, true),
  ('cftc_releases', 'U.S. CFTC', 'allowed', 'official_rss', 'https://www.cftc.gov/RSS/index.htm', '2026-07-20', 1, 8000, true),
  ('coindesk_rss', 'CoinDesk', 'blocked', 'blocked_pending_license', 'https://www.coindesk.com/terms', '2026-07-20', 0, 0, false),
  ('cointelegraph_rss', 'Cointelegraph', 'blocked', 'blocked_pending_license', 'https://cointelegraph.com/terms-and-privacy', '2026-07-20', 0, 0, false),
  ('cnbc_rss', 'CNBC', 'blocked', 'blocked_pending_license', 'https://www.nbcuniversal.com/terms/prohibited-actions', '2026-07-20', 0, 0, false),
  ('marketwatch_rss', 'MarketWatch', 'blocked', 'blocked_pending_license', 'https://www.marketwatch.com/help/terms-of-use', '2026-07-20', 0, 0, false)
on conflict (source_id) do update set
  display_name = excluded.display_name,
  policy_status = case
    when current_source.policy_status <> 'allowed' or current_source.enabled = false then current_source.policy_status
    else excluded.policy_status
  end,
  policy_reason = case
    when current_source.policy_status <> 'allowed' or current_source.enabled = false then current_source.policy_reason
    else excluded.policy_reason
  end,
  terms_url = excluded.terms_url,
  reviewed_at = excluded.reviewed_at,
  max_requests_per_second = excluded.max_requests_per_second,
  timeout_ms = excluded.timeout_ms,
  enabled = case
    when current_source.policy_status <> 'allowed' or current_source.enabled = false then false
    else excluded.enabled
  end,
  updated_at = now();

create table if not exists public.news_source_health (
  source_id text primary key references public.news_source_catalog(source_id) on delete cascade,
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  circuit_open_until timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);

create table if not exists public.news_source_items (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references public.news_source_catalog(source_id) on delete restrict,
  external_id text not null,
  canonical_url text not null,
  original_title text not null,
  published_at timestamptz not null,
  first_seen_at timestamptz not null,
  content_hash text not null,
  policy_status text not null check (policy_status in ('allowed', 'review', 'blocked')),
  markets text[] not null default '{}'::text[],
  targets text[] not null default '{}'::text[],
  category text not null check (category in ('macro', 'regulation', 'corporate_sector', 'market_infrastructure')),
  event_type text not null,
  entities text[] not null default '{}'::text[],
  action text not null,
  structured_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, external_id),
  check (cardinality(markets) > 0 and markets <@ array['crypto', 'global']::text[]),
  check (cardinality(targets) > 0 and targets <@ array['btc', 'eth', 'global']::text[]),
  check (length(original_title) <= 240),
  check (canonical_url ~ '^https://')
);

create index if not exists news_source_items_published_idx
  on public.news_source_items (published_at desc);
create index if not exists news_source_items_content_hash_idx
  on public.news_source_items (content_hash);

create table if not exists public.news_impact_events (
  id uuid primary key default gen_random_uuid(),
  semantic_key text not null,
  market text not null check (market in ('crypto', 'global')),
  category text not null check (category in ('macro', 'regulation', 'corporate_sector', 'market_infrastructure')),
  targets text[] not null default '{}'::text[],
  importance text not null default 'normal' check (importance in ('normal', 'high', 'critical')),
  version integer not null default 1 check (version > 0),
  status text not null default 'active' check (status in ('active', 'revised', 'retracted')),
  occurred_at timestamptz not null,
  first_seen_at timestamptz not null,
  headline text not null,
  fact_summary text not null,
  primary_source_item_id uuid references public.news_source_items(id) on delete set null,
  macro_event_id uuid references public.macro_events(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (semantic_key, market),
  check (cardinality(targets) > 0 and targets <@ array['btc', 'eth', 'global']::text[]),
  check (length(headline) <= 180),
  check (length(fact_summary) <= 600)
);

create index if not exists news_impact_events_market_occurred_idx
  on public.news_impact_events (market, occurred_at desc);
create index if not exists news_impact_events_macro_idx
  on public.news_impact_events (macro_event_id) where macro_event_id is not null;

create table if not exists public.news_event_sources (
  event_id uuid not null references public.news_impact_events(id) on delete cascade,
  source_item_id uuid not null references public.news_source_items(id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (event_id, source_item_id)
);

create table if not exists public.global_reaction_observations (
  id uuid primary key default gen_random_uuid(),
  bucket_at timestamptz not null,
  observed_at timestamptz not null,
  quality text not null check (quality in ('ready', 'partial', 'stale', 'unavailable')),
  market_mode text not null check (market_mode in ('Risk-On', 'Neutral', 'Risk-Off')),
  metrics jsonb not null default '{}'::jsonb,
  signal_groups jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (bucket_at)
);

create index if not exists global_reaction_observations_observed_idx
  on public.global_reaction_observations (observed_at desc);

create table if not exists public.news_market_reactions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.news_impact_events(id) on delete cascade,
  event_version integer not null check (event_version > 0),
  target text not null check (target in ('btc', 'eth', 'global')),
  stage text not null check (stage in ('detected', 'provisional_15m', 'final_60m')),
  classification text not null check (classification in (
    'pending', 'supports_existing_state', 'conflicts_with_existing_state',
    'decision_state_changed', 'risk_increase', 'no_material_reaction', 'insufficient_data'
  )),
  risk_effect text not null check (risk_effect in ('increased', 'decreased', 'unchanged')),
  quality text not null check (quality in ('ready', 'partial', 'stale', 'unavailable')),
  event_at timestamptz not null,
  evaluated_at timestamptz,
  next_check_at timestamptz,
  pre_snapshot_id uuid references public.perpetual_decision_snapshots(id) on delete set null,
  evaluated_snapshot_id uuid references public.perpetual_decision_snapshots(id) on delete set null,
  baseline_observation_id uuid references public.global_reaction_observations(id) on delete set null,
  evaluated_observation_id uuid references public.global_reaction_observations(id) on delete set null,
  price_change_percent numeric,
  state_before text check (state_before in ('neutral', 'upside_watch', 'downside_watch', 'risk')),
  state_after text check (state_after in ('neutral', 'upside_watch', 'downside_watch', 'risk')),
  reaction_summary text not null,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, event_version, target, stage),
  check (
    (target in ('btc', 'eth') and baseline_observation_id is null and evaluated_observation_id is null)
    or (target = 'global' and pre_snapshot_id is null and evaluated_snapshot_id is null)
  ),
  check (length(reaction_summary) <= 700)
);

create index if not exists news_market_reactions_event_idx
  on public.news_market_reactions (event_id, evaluated_at desc);
create index if not exists news_market_reactions_target_stage_idx
  on public.news_market_reactions (target, stage, evaluated_at desc);
create index if not exists news_market_reactions_alert_idx
  on public.news_market_reactions (classification, evaluated_at desc)
  where quality = 'ready' and classification in ('risk_increase', 'decision_state_changed', 'conflicts_with_existing_state');

create table if not exists public.news_sync_runs (
  id uuid primary key default gen_random_uuid(),
  bucket_at timestamptz not null,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  status text not null check (status in ('stored', 'checked', 'partial', 'failed', 'skipped')),
  source_results jsonb not null default '[]'::jsonb,
  fetched_count integer not null default 0 check (fetched_count >= 0),
  accepted_count integer not null default 0 check (accepted_count >= 0),
  duplicate_count integer not null default 0 check (duplicate_count >= 0),
  evaluated_count integer not null default 0 check (evaluated_count >= 0),
  would_send_count integer not null default 0 check (would_send_count >= 0),
  error text,
  created_at timestamptz not null default now(),
  unique (bucket_at)
);

create index if not exists news_sync_runs_started_idx
  on public.news_sync_runs (started_at desc);

create table if not exists public.news_alert_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  market text not null check (market in ('crypto', 'global')),
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, market)
);

create table if not exists public.news_alert_budgets (
  user_id uuid not null references auth.users(id) on delete cascade,
  market text not null check (market in ('crypto', 'global')),
  budget_date date not null,
  ordinary_count integer not null default 0 check (ordinary_count between 0 and 2),
  critical_count integer not null default 0 check (critical_count between 0 and 1),
  last_ordinary_claimed_at timestamptz,
  last_critical_claimed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, market, budget_date)
);

alter table public.push_alert_events
  add column if not exists notification_kind text,
  add column if not exists delivery_priority text,
  add column if not exists news_event_id uuid references public.news_impact_events(id) on delete set null,
  add column if not exists news_reaction_id uuid references public.news_market_reactions(id) on delete set null,
  add column if not exists push_suppressed_reason text,
  add column if not exists delivery_not_before timestamptz,
  add column if not exists delivery_expires_at timestamptz,
  add column if not exists critical boolean not null default false,
  add column if not exists read_at timestamptz;

alter table public.push_alert_events drop constraint if exists push_alert_events_notification_kind_check;
alter table public.push_alert_events add constraint push_alert_events_notification_kind_check
  check (notification_kind is null or notification_kind in ('scenario_condition', 'macro_event', 'news_impact', 'generic'));
alter table public.push_alert_events drop constraint if exists push_alert_events_delivery_priority_check;
alter table public.push_alert_events add constraint push_alert_events_delivery_priority_check
  check (delivery_priority is null or delivery_priority in ('p0', 'p1', 'p2'));

create index if not exists push_alert_events_news_event_idx
  on public.push_alert_events (news_event_id, user_id) where news_event_id is not null;
create index if not exists push_alert_events_user_kind_occurred_idx
  on public.push_alert_events (user_id, notification_kind, occurred_at desc);

alter table public.journals
  add column if not exists news_event_id uuid references public.news_impact_events(id) on delete set null,
  add column if not exists news_reaction_id uuid references public.news_market_reactions(id) on delete set null;

create index if not exists journals_news_event_idx
  on public.journals (news_event_id) where news_event_id is not null;
create index if not exists journals_news_reaction_idx
  on public.journals (news_reaction_id) where news_reaction_id is not null;

alter table public.journals drop constraint if exists journals_source_check;
alter table public.journals add constraint journals_source_check
  check (source is null or source in ('manual', 'chart', 'scout', 'snapshot', 'alert', 'news'));

alter table public.product_events drop constraint if exists product_events_event_name_check;
alter table public.product_events add constraint product_events_event_name_check check (event_name in (
  'home_snapshot_viewed', 'home_perpetual_opened', 'perpetual_snapshot_viewed',
  'pro_gate_viewed', 'monitor_created', 'monitor_failed', 'scenario_triggered',
  'scenario_opened', 'journal_saved', 'paywall_viewed', 'purchase_started',
  'purchase_failed', 'purchase_cancelled', 'entitlement_activated',
  'news_impact_viewed', 'news_source_opened', 'news_to_market_opened',
  'news_alert_opted_in', 'news_alert_opened', 'news_journal_saved'
));

alter table public.product_events
  add column if not exists news_event_id uuid references public.news_impact_events(id) on delete set null,
  add column if not exists news_reaction_id uuid references public.news_market_reactions(id) on delete set null;
create index if not exists product_events_news_event_idx
  on public.product_events (news_event_id) where news_event_id is not null;
create index if not exists product_events_news_reaction_idx
  on public.product_events (news_reaction_id) where news_reaction_id is not null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

create or replace function public.enforce_news_source_policy()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.policy_status <> 'allowed' then
    raise exception 'news_source_not_allowed' using errcode = '42501';
  end if;
  if new.policy_status = 'allowed' and not exists (
      select 1
      from public.news_source_catalog source
      where source.source_id = new.source_id
        and source.policy_status = 'allowed'
        and source.enabled = true
    ) then
    raise exception 'news_source_not_allowed' using errcode = '42501';
  end if;
  return new;
end
$$;

create or replace function public.enforce_news_reaction_integrity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_event public.news_impact_events%rowtype;
begin
  select * into v_event
  from public.news_impact_events event
  where event.id = new.event_id
  for share;
  if not found or new.event_version <> v_event.version then
    raise exception 'news_reaction_event_version_mismatch' using errcode = '23514';
  end if;
  if (v_event.market = 'crypto' and (new.target not in ('btc', 'eth') or not (new.target = any(v_event.targets))))
     or (v_event.market = 'global' and (new.target <> 'global' or not ('global' = any(v_event.targets)))) then
    raise exception 'news_reaction_target_mismatch' using errcode = '23514';
  end if;
  if new.stage <> 'detected' and new.quality = 'ready' then
    if new.target in ('btc', 'eth') then
      if new.pre_snapshot_id is null or new.evaluated_snapshot_id is null or not exists (
        select 1
        from public.perpetual_decision_snapshots baseline
        join public.perpetual_decision_snapshots evaluated on evaluated.id = new.evaluated_snapshot_id
        where baseline.id = new.pre_snapshot_id
          and baseline.asset = new.target and evaluated.asset = new.target
          and baseline.quality = 'ready' and evaluated.quality = 'ready'
      ) then
        raise exception 'news_reaction_snapshot_not_ready' using errcode = '23514';
      end if;
    elsif new.baseline_observation_id is null or new.evaluated_observation_id is null or not exists (
      select 1
      from public.global_reaction_observations baseline
      join public.global_reaction_observations evaluated on evaluated.id = new.evaluated_observation_id
      where baseline.id = new.baseline_observation_id
        and baseline.quality = 'ready' and evaluated.quality = 'ready'
    ) then
      raise exception 'news_reaction_observation_not_ready' using errcode = '23514';
    end if;
  end if;
  if new.classification in ('risk_increase', 'decision_state_changed', 'conflicts_with_existing_state')
     and (new.stage = 'detected' or new.quality <> 'ready') then
    raise exception 'news_reaction_not_actionable' using errcode = '23514';
  end if;
  return new;
end
$$;

drop trigger if exists enforce_news_source_policy on public.news_source_items;
create trigger enforce_news_source_policy
before insert or update of source_id, policy_status on public.news_source_items
for each row execute function public.enforce_news_source_policy();

drop trigger if exists enforce_news_reaction_integrity on public.news_market_reactions;
create trigger enforce_news_reaction_integrity
before insert or update of event_id, event_version, target, stage, classification, quality,
  pre_snapshot_id, evaluated_snapshot_id, baseline_observation_id, evaluated_observation_id
on public.news_market_reactions
for each row execute function public.enforce_news_reaction_integrity();

drop trigger if exists set_news_source_items_updated_at on public.news_source_items;
create trigger set_news_source_items_updated_at before update on public.news_source_items
for each row execute function public.set_updated_at();
drop trigger if exists set_macro_events_updated_at on public.macro_events;
create trigger set_macro_events_updated_at before update on public.macro_events
for each row execute function public.set_updated_at();
drop trigger if exists set_news_source_catalog_updated_at on public.news_source_catalog;
create trigger set_news_source_catalog_updated_at before update on public.news_source_catalog
for each row execute function public.set_updated_at();
drop trigger if exists set_news_source_health_updated_at on public.news_source_health;
create trigger set_news_source_health_updated_at before update on public.news_source_health
for each row execute function public.set_updated_at();
drop trigger if exists set_news_impact_events_updated_at on public.news_impact_events;
create trigger set_news_impact_events_updated_at before update on public.news_impact_events
for each row execute function public.set_updated_at();
drop trigger if exists set_news_market_reactions_updated_at on public.news_market_reactions;
create trigger set_news_market_reactions_updated_at before update on public.news_market_reactions
for each row execute function public.set_updated_at();
drop trigger if exists set_news_alert_preferences_updated_at on public.news_alert_preferences;
create trigger set_news_alert_preferences_updated_at before update on public.news_alert_preferences
for each row execute function public.set_updated_at();

alter table public.news_source_catalog enable row level security;
alter table public.news_source_health enable row level security;
alter table public.news_source_items enable row level security;
alter table public.news_impact_events enable row level security;
alter table public.news_event_sources enable row level security;
alter table public.global_reaction_observations enable row level security;
alter table public.news_market_reactions enable row level security;
alter table public.news_sync_runs enable row level security;
alter table public.news_alert_preferences enable row level security;
alter table public.news_alert_budgets enable row level security;
alter table public.macro_events enable row level security;
alter table public.macro_sync_runs enable row level security;

revoke all privileges on table public.news_source_catalog from public, anon, authenticated, service_role;
revoke all privileges on table public.news_source_health from public, anon, authenticated, service_role;
revoke all privileges on table public.news_source_items from public, anon, authenticated, service_role;
revoke all privileges on table public.news_impact_events from public, anon, authenticated, service_role;
revoke all privileges on table public.news_event_sources from public, anon, authenticated, service_role;
revoke all privileges on table public.global_reaction_observations from public, anon, authenticated, service_role;
revoke all privileges on table public.news_market_reactions from public, anon, authenticated, service_role;
revoke all privileges on table public.news_sync_runs from public, anon, authenticated, service_role;
revoke all privileges on table public.news_alert_preferences from public, anon, authenticated, service_role;
revoke all privileges on table public.news_alert_budgets from public, anon, authenticated, service_role;
revoke all privileges on table public.macro_events from public, anon, authenticated, service_role;
revoke all privileges on table public.macro_sync_runs from public, anon, authenticated, service_role;

grant select, insert, update, delete on table public.news_source_catalog to service_role;
grant select, insert, update, delete on table public.news_source_health to service_role;
grant select, insert, update, delete on table public.news_source_items to service_role;
grant select, insert, update, delete on table public.news_impact_events to service_role;
grant select, insert, update, delete on table public.news_event_sources to service_role;
grant select, insert, update, delete on table public.global_reaction_observations to service_role;
grant select, insert, update, delete on table public.news_market_reactions to service_role;
grant select, insert, update, delete on table public.news_sync_runs to service_role;
grant select, insert, update, delete on table public.news_alert_preferences to service_role;
grant select, insert, update, delete on table public.news_alert_budgets to service_role;
grant select, insert, update, delete on table public.macro_events to service_role;
grant select, insert, update, delete on table public.macro_sync_runs to service_role;

create or replace function public.claim_news_sync_run(p_bucket_at timestamptz)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.news_sync_runs (
    bucket_at, started_at, finished_at, status
  ) values (
    p_bucket_at, now(), now(), 'checked'
  )
  on conflict (bucket_at) do nothing
  returning id into v_id;
  return v_id;
end
$$;

create or replace function public.set_news_alert_preference(
  p_user_id uuid,
  p_market text,
  p_enabled boolean
)
returns setof public.news_alert_preferences
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_market not in ('crypto', 'global') then
    raise exception 'invalid_news_market' using errcode = '22023';
  end if;
  insert into public.news_alert_preferences (user_id, market, enabled)
  values (p_user_id, p_market, coalesce(p_enabled, false))
  on conflict (user_id, market) do update
  set enabled = excluded.enabled, updated_at = now();
  return query select preference.* from public.news_alert_preferences preference
  where preference.user_id = p_user_id and preference.market = p_market;
end
$$;

drop function if exists public.claim_news_impact_alert(uuid, uuid, text, text, text, jsonb, boolean, timestamptz);
create or replace function public.claim_news_impact_alert(
  p_user_id uuid,
  p_reaction_id uuid,
  p_event_key text,
  p_title text,
  p_body text,
  p_payload jsonb
)
returns setof public.push_alert_events
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_reaction public.news_market_reactions%rowtype;
  v_event public.news_impact_events%rowtype;
  v_market text;
  v_now timestamptz := clock_timestamp();
  v_budget_date date;
  v_budget public.news_alert_budgets%rowtype;
  v_alert_id uuid;
  v_not_before timestamptz;
  v_expires_at timestamptz;
  v_is_critical boolean;
begin
  v_budget_date := (v_now at time zone 'Asia/Seoul')::date;
  v_not_before := v_now;
  v_expires_at := v_now + interval '30 minutes';
  select * into v_reaction from public.news_market_reactions reaction
  where reaction.id = p_reaction_id for share;
  if not found or v_reaction.quality <> 'ready' or v_reaction.classification not in (
    'risk_increase', 'decision_state_changed', 'conflicts_with_existing_state'
  ) then return; end if;

  select * into v_event from public.news_impact_events event
  where event.id = v_reaction.event_id
    and event.status <> 'retracted'
    and event.version = v_reaction.event_version
  for share;
  if not found then return; end if;
  v_market := v_event.market;
  v_is_critical := v_event.importance = 'critical';

  if (v_market = 'crypto' and (v_reaction.target not in ('btc', 'eth') or not (v_reaction.target = any(v_event.targets))))
     or (v_market = 'global' and (v_reaction.target <> 'global' or not ('global' = any(v_event.targets)))) then
    return;
  end if;

  if v_reaction.target in ('btc', 'eth') then
    if v_reaction.pre_snapshot_id is null or v_reaction.evaluated_snapshot_id is null or not exists (
      select 1
      from public.perpetual_decision_snapshots baseline
      join public.perpetual_decision_snapshots evaluated on evaluated.id = v_reaction.evaluated_snapshot_id
      where baseline.id = v_reaction.pre_snapshot_id
        and baseline.asset = v_reaction.target and evaluated.asset = v_reaction.target
        and baseline.quality = 'ready' and evaluated.quality = 'ready'
    ) then return; end if;
  else
    if v_reaction.baseline_observation_id is null or v_reaction.evaluated_observation_id is null or not exists (
      select 1
      from public.global_reaction_observations baseline
      join public.global_reaction_observations evaluated on evaluated.id = v_reaction.evaluated_observation_id
      where baseline.id = v_reaction.baseline_observation_id
        and baseline.quality = 'ready' and evaluated.quality = 'ready'
    ) then return; end if;
  end if;

  if not exists (
    select 1
    from public.news_event_sources event_source
    join public.news_source_items item on item.id = event_source.source_item_id
    join public.news_source_catalog source on source.source_id = item.source_id
    where event_source.event_id = v_event.id
      and item.policy_status = 'allowed'
      and source.policy_status = 'allowed'
      and source.enabled = true
  ) then return; end if;

  if not exists (
    select 1 from public.news_alert_preferences preference
    where preference.user_id = p_user_id and preference.market = v_market and preference.enabled = true
  ) then return; end if;

  insert into public.news_alert_budgets (user_id, market, budget_date)
  values (p_user_id, v_market, v_budget_date)
  on conflict (user_id, market, budget_date) do nothing;

  select * into v_budget from public.news_alert_budgets budget
  where budget.user_id = p_user_id and budget.market = v_market and budget.budget_date = v_budget_date
  for update;

  if v_is_critical then
    if v_budget.critical_count >= 1 or v_budget.ordinary_count + v_budget.critical_count >= 3 then return; end if;
  else
    if v_budget.ordinary_count >= 2 or v_budget.ordinary_count + v_budget.critical_count >= 3 then return; end if;
    if v_budget.last_ordinary_claimed_at is not null and v_budget.last_ordinary_claimed_at > v_now - interval '6 hours' then return; end if;
  end if;

  if exists (
    select 1 from public.push_alert_events alert
    where alert.user_id = p_user_id and alert.news_event_id = v_event.id
      and alert.notification_kind = 'news_impact' and alert.occurred_at > v_now - interval '24 hours'
  ) then return; end if;

  if not v_is_critical and exists (
    select 1 from public.push_alert_events alert
    where alert.user_id = p_user_id and alert.rule_id = 'perpetual_scenario'
      and alert.occurred_at > v_now - interval '30 minutes'
  ) then
    v_not_before := v_now + interval '30 minutes';
    v_expires_at := v_now + interval '60 minutes';
  end if;

  insert into public.push_alert_events (
    user_id, market, rule_id, event_key, title, body, payload, occurred_at, sent_at,
    delivery_status, notification_kind, delivery_priority, news_event_id, news_reaction_id,
    delivery_not_before, delivery_expires_at, critical
  ) values (
    p_user_id, case when v_market = 'global' then 'stocks' else 'crypto' end,
    'news-impact', left(p_event_key, 240), left(p_title, 160), left(p_body, 500), coalesce(p_payload, '{}'::jsonb),
    v_now, v_now, 'pending', 'news_impact', case when v_is_critical then 'p1' else 'p2' end,
    v_event.id, v_reaction.id, v_not_before, v_expires_at, v_is_critical
  )
  on conflict (user_id, event_key) do nothing
  returning id into v_alert_id;

  if v_alert_id is null then return; end if;
  update public.news_alert_budgets
  set ordinary_count = ordinary_count + case when v_is_critical then 0 else 1 end,
      critical_count = critical_count + case when v_is_critical then 1 else 0 end,
      last_ordinary_claimed_at = case when v_is_critical then last_ordinary_claimed_at else v_now end,
      last_critical_claimed_at = case when v_is_critical then v_now else last_critical_claimed_at end,
      updated_at = v_now
  where user_id = p_user_id and market = v_market and budget_date = v_budget_date;

  return query select alert.* from public.push_alert_events alert where alert.id = v_alert_id;
end
$$;

create or replace function public.lease_news_impact_delivery(p_event_id uuid, p_lease_seconds integer default 90)
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
    and event.rule_id = 'news-impact'
    and coalesce(event.delivery_not_before, now()) <= now()
    and (event.delivery_expires_at is null or event.delivery_expires_at > now())
    and event.delivery_attempt_count < 3
    and (
      event.delivery_status in ('pending', 'failed')
      or (event.delivery_status = 'sending' and event.delivery_lease_until < now())
    )
  returning event.*
$$;

create or replace function public.complete_news_impact_delivery(
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
  where id = p_event_id and rule_id = 'news-impact'
    and delivery_status = 'sending' and delivery_attempt_count = p_attempt;
  return found;
end
$$;

create or replace function public.mark_push_alert_read(p_user_id uuid, p_event_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.push_alert_events
  set read_at = coalesce(read_at, now())
  where id = p_event_id and user_id = p_user_id;
  return found;
end
$$;

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
  v_runs integer := 0;
  v_alerts integer := 0;
begin
  delete from public.news_source_items where updated_at < now() - interval '30 days';
  get diagnostics v_sources = row_count;
  delete from public.news_impact_events where occurred_at < now() - interval '90 days';
  get diagnostics v_events = row_count;
  delete from public.global_reaction_observations where observed_at < now() - interval '90 days';
  get diagnostics v_observations = row_count;
  delete from public.news_sync_runs where started_at < now() - interval '30 days';
  get diagnostics v_runs = row_count;
  delete from public.push_alert_events
  where notification_kind = 'news_impact' and occurred_at < now() - interval '90 days';
  get diagnostics v_alerts = row_count;
  delete from public.news_alert_budgets where budget_date < ((now() at time zone 'Asia/Seoul')::date - 7);
  return jsonb_build_object('sources', v_sources, 'events', v_events, 'observations', v_observations, 'runs', v_runs, 'alerts', v_alerts);
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
    'product_events', 'perpetual_scenario_monitors', 'subscriptions', 'oauth_provider_credentials',
    'news_alert_preferences', 'news_alert_budgets'
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

revoke all on function public.claim_news_sync_run(timestamptz) from public, anon, authenticated;
revoke all on function public.set_news_alert_preference(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.claim_news_impact_alert(uuid, uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.lease_news_impact_delivery(uuid, integer) from public, anon, authenticated;
revoke all on function public.complete_news_impact_delivery(uuid, integer, text, integer, integer, text) from public, anon, authenticated;
revoke all on function public.mark_push_alert_read(uuid, uuid) from public, anon, authenticated;
revoke all on function public.purge_news_impact_retention() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.enforce_news_source_policy() from public, anon, authenticated;
revoke all on function public.enforce_news_reaction_integrity() from public, anon, authenticated;
revoke all on function public.purge_account_application_data(uuid) from public, anon, authenticated;

grant execute on function public.claim_news_sync_run(timestamptz) to service_role;
grant execute on function public.set_news_alert_preference(uuid, text, boolean) to service_role;
grant execute on function public.claim_news_impact_alert(uuid, uuid, text, text, text, jsonb) to service_role;
grant execute on function public.lease_news_impact_delivery(uuid, integer) to service_role;
grant execute on function public.complete_news_impact_delivery(uuid, integer, text, integer, integer, text) to service_role;
grant execute on function public.mark_push_alert_read(uuid, uuid) to service_role;
grant execute on function public.purge_news_impact_retention() to service_role;
grant execute on function public.set_updated_at() to service_role;
grant execute on function public.enforce_news_source_policy() to service_role;
grant execute on function public.enforce_news_reaction_integrity() to service_role;
grant execute on function public.purge_account_application_data(uuid) to service_role;
