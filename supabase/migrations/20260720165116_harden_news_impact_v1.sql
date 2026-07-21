-- Forward-only hardening for News Impact revision handling, notification claims,
-- and retry-safe delivery. All objects remain service-role only.

alter table public.news_source_catalog
  add column if not exists allowed_hosts text[];

update public.news_source_catalog
set allowed_hosts = case source_id
  when 'macro_official_store' then array['bls.gov','bea.gov','federalreserve.gov','census.gov','dol.gov','doleta.gov']::text[]
  when 'fed_press_releases' then array['federalreserve.gov']::text[]
  when 'sec_press_releases' then array['sec.gov']::text[]
  when 'sec_edgar_tracked' then array['sec.gov']::text[]
  when 'cftc_releases' then array['cftc.gov']::text[]
  else '{}'::text[]
end
where allowed_hosts is null;

alter table public.news_source_catalog
  alter column allowed_hosts set default '{}'::text[],
  alter column allowed_hosts set not null;

create or replace function public.enforce_news_source_policy()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_source public.news_source_catalog%rowtype;
  v_host text;
begin
  if tg_op = 'INSERT' and new.policy_status <> 'allowed' then
    raise exception 'news_source_not_allowed' using errcode = '42501';
  end if;
  select * into v_source
  from public.news_source_catalog source
  where source.source_id = new.source_id
    and source.policy_status = 'allowed'
    and source.enabled = true;
  if new.policy_status = 'allowed' and not found then
    raise exception 'news_source_not_allowed' using errcode = '42501';
  end if;
  v_host := pg_catalog.lower(substring(new.canonical_url from '^https://([A-Za-z0-9.-]+)(/|$)'));
  if new.policy_status = 'allowed' and (
    v_host is null
    or pg_catalog.cardinality(v_source.allowed_hosts) = 0
    or not exists (
      select 1
      from pg_catalog.unnest(v_source.allowed_hosts) allowed_host
      where v_host = pg_catalog.lower(allowed_host)
         or v_host like '%.' || pg_catalog.lower(allowed_host)
    )
  ) then
    raise exception 'news_source_domain_not_allowed' using errcode = '42501';
  end if;
  return new;
end
$$;

do $$
declare
  v_invalid_item uuid;
begin
  select item.id into v_invalid_item
  from public.news_source_items item
  join public.news_source_catalog source on source.source_id = item.source_id
  where item.policy_status = 'allowed'
    and (
      source.policy_status <> 'allowed'
      or source.enabled = false
      or pg_catalog.cardinality(source.allowed_hosts) = 0
      or not exists (
        select 1
        from pg_catalog.unnest(source.allowed_hosts) allowed_host
        where pg_catalog.lower(substring(item.canonical_url from '^https://([A-Za-z0-9.-]+)(/|$)')) = pg_catalog.lower(allowed_host)
           or pg_catalog.lower(substring(item.canonical_url from '^https://([A-Za-z0-9.-]+)(/|$)')) like '%.' || pg_catalog.lower(allowed_host)
      )
    )
  limit 1;

  if v_invalid_item is not null then
    raise exception 'existing_news_source_item_not_allowed:%', v_invalid_item using errcode = '42501';
  end if;
end
$$;

drop trigger if exists enforce_news_source_policy on public.news_source_items;
create trigger enforce_news_source_policy
before insert or update of source_id, policy_status, canonical_url on public.news_source_items
for each row execute function public.enforce_news_source_policy();

create or replace function public.block_news_source_items_after_catalog_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.news_source_items item
  set policy_status = 'blocked',
      updated_at = pg_catalog.now()
  where item.source_id = new.source_id
    and item.policy_status = 'allowed'
    and (
      new.policy_status <> 'allowed'
      or new.enabled = false
      or pg_catalog.cardinality(new.allowed_hosts) = 0
      or not exists (
        select 1
        from pg_catalog.unnest(new.allowed_hosts) allowed_host
        where pg_catalog.lower(substring(item.canonical_url from '^https://([A-Za-z0-9.-]+)(/|$)')) = pg_catalog.lower(allowed_host)
           or pg_catalog.lower(substring(item.canonical_url from '^https://([A-Za-z0-9.-]+)(/|$)')) like '%.' || pg_catalog.lower(allowed_host)
      )
    );
  return new;
end
$$;

drop trigger if exists block_news_source_items_after_catalog_change on public.news_source_catalog;
create trigger block_news_source_items_after_catalog_change
after update of policy_status, enabled, allowed_hosts on public.news_source_catalog
for each row execute function public.block_news_source_items_after_catalog_change();

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
          and evaluated.generated_at > baseline.generated_at
      ) then
        raise exception 'news_reaction_snapshot_not_ready' using errcode = '23514';
      end if;
    elsif new.baseline_observation_id is null or new.evaluated_observation_id is null or not exists (
      select 1
      from public.global_reaction_observations baseline
      join public.global_reaction_observations evaluated on evaluated.id = new.evaluated_observation_id
      where baseline.id = new.baseline_observation_id
        and baseline.quality = 'ready' and evaluated.quality = 'ready'
        and evaluated.observed_at > baseline.observed_at
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

alter table public.news_sync_runs
  add column if not exists lease_expires_at timestamptz;

create index if not exists news_sync_runs_active_lease_idx
  on public.news_sync_runs (lease_expires_at)
  where lease_expires_at is not null;

create or replace function public.claim_news_sync_run(p_bucket_at timestamptz)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('news-impact-sync-v1', 0));
  if exists (
    select 1 from public.news_sync_runs run
    where run.lease_expires_at > pg_catalog.now()
  ) then
    return null;
  end if;

  insert into public.news_sync_runs (
    bucket_at, started_at, finished_at, status, lease_expires_at
  ) values (
    p_bucket_at, pg_catalog.now(), pg_catalog.now(), 'checked', pg_catalog.now() + interval '10 minutes'
  )
  on conflict (bucket_at) do nothing
  returning id into v_id;
  return v_id;
end
$$;

create or replace function public.renew_news_sync_run(p_run_id uuid, p_lease_seconds integer default 600)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('news-impact-sync-v1', 0));
  if exists (
    select 1 from public.news_sync_runs run
    where run.id <> p_run_id and run.lease_expires_at > pg_catalog.now()
  ) then
    return false;
  end if;

  update public.news_sync_runs run
  set lease_expires_at = pg_catalog.now() + pg_catalog.make_interval(secs => least(greatest(p_lease_seconds, 60), 900))
  where run.id = p_run_id
    and run.lease_expires_at > pg_catalog.now();
  return found;
end
$$;

alter table public.push_alert_events
  add column if not exists delivery_succeeded_token_ids uuid[] not null default '{}'::uuid[];

alter table public.push_alert_events
  drop constraint if exists push_alert_events_delivery_success_tokens_check;
alter table public.push_alert_events
  add constraint push_alert_events_delivery_success_tokens_check
  check (cardinality(delivery_succeeded_token_ids) <= 20);

create index if not exists news_market_reactions_due_idx
  on public.news_market_reactions (next_check_at, event_id, event_version)
  where next_check_at is not null;

create or replace function public.retire_stale_news_reactions()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.version is distinct from old.version or new.status = 'retracted' then
    update public.news_market_reactions reaction
    set next_check_at = null,
        updated_at = pg_catalog.clock_timestamp()
    where reaction.event_id = new.id
      and reaction.next_check_at is not null
      and (reaction.event_version <> new.version or new.status = 'retracted');
  end if;
  return new;
end
$$;

drop trigger if exists retire_stale_news_reactions on public.news_impact_events;
create trigger retire_stale_news_reactions
after update of version, status on public.news_impact_events
for each row execute function public.retire_stale_news_reactions();

update public.news_market_reactions reaction
set next_check_at = null,
    updated_at = pg_catalog.clock_timestamp()
from public.news_impact_events event
where event.id = reaction.event_id
  and reaction.next_check_at is not null
  and (reaction.event_version <> event.version or event.status = 'retracted');

revoke all on function public.retire_stale_news_reactions() from public, anon, authenticated;
grant execute on function public.retire_stale_news_reactions() to service_role;

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
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_budget_date date;
  v_budget public.news_alert_budgets%rowtype;
  v_alert_id uuid;
  v_not_before timestamptz;
  v_expires_at timestamptz;
  v_is_critical boolean;
  v_delivery_market text;
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
    and event.metadata ->> 'push_eligible' = 'true'
  for share;
  if not found then return; end if;
  v_market := v_event.market;
  v_delivery_market := case when v_market = 'global' then 'stocks' else 'crypto' end;
  v_is_critical := v_event.importance = 'critical';

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('news-impact:' || p_user_id::text, 0));

  if exists (
    select 1 from public.account_deletion_requests deletion
    where deletion.user_id = p_user_id
      and deletion.status in ('pending', 'processing', 'failed')
  ) then return; end if;

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
        and evaluated.generated_at > baseline.generated_at
    ) then return; end if;
  else
    if v_reaction.baseline_observation_id is null or v_reaction.evaluated_observation_id is null or not exists (
      select 1
      from public.global_reaction_observations baseline
      join public.global_reaction_observations evaluated on evaluated.id = v_reaction.evaluated_observation_id
      where baseline.id = v_reaction.baseline_observation_id
        and baseline.quality = 'ready' and evaluated.quality = 'ready'
        and evaluated.observed_at > baseline.observed_at
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
      and pg_catalog.cardinality(source.allowed_hosts) > 0
      and exists (
        select 1
        from pg_catalog.unnest(source.allowed_hosts) allowed_host
        where pg_catalog.lower(substring(item.canonical_url from '^https://([A-Za-z0-9.-]+)(/|$)')) = pg_catalog.lower(allowed_host)
           or pg_catalog.lower(substring(item.canonical_url from '^https://([A-Za-z0-9.-]+)(/|$)')) like '%.' || pg_catalog.lower(allowed_host)
      )
  ) then return; end if;

  if not exists (
    select 1 from public.news_alert_preferences preference
    where preference.user_id = p_user_id and preference.market = v_market and preference.enabled = true
  ) then return; end if;

  if exists (
    select 1
    from public.push_alert_events alert
    join public.news_impact_events prior_event on prior_event.id = alert.news_event_id
    where alert.user_id = p_user_id
      and alert.notification_kind = 'news_impact'
      and prior_event.semantic_key = v_event.semantic_key
      and alert.occurred_at > v_now - interval '24 hours'
  ) then return; end if;

  if not v_is_critical and exists (
    select 1 from public.push_alert_events alert
    where alert.user_id = p_user_id
      and alert.notification_kind = 'news_impact'
      and alert.market = v_delivery_market
      and coalesce(alert.critical, false) = false
      and alert.occurred_at > v_now - interval '6 hours'
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
  end if;

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
    p_user_id, v_delivery_market,
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

create or replace function public.finalize_exhausted_news_impact_deliveries()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer := 0;
begin
  update public.push_alert_events event
  set delivery_status = case
        when pg_catalog.cardinality(event.delivery_succeeded_token_ids) > 0 then 'partial'
        else 'in_app_only'
      end,
      push_suppressed_reason = case
        when pg_catalog.cardinality(event.delivery_succeeded_token_ids) > 0 then event.push_suppressed_reason
        else coalesce(event.push_suppressed_reason, 'delivery_attempts_exhausted')
      end,
      delivered_at = case
        when pg_catalog.cardinality(event.delivery_succeeded_token_ids) > 0 then coalesce(event.delivered_at, pg_catalog.now())
        else event.delivered_at
      end,
      delivery_lease_until = null
  where event.rule_id = 'news-impact'
    and event.delivery_attempt_count >= 3
    and (
      event.delivery_status = 'failed'
      or (event.delivery_status = 'sending' and event.delivery_lease_until < pg_catalog.now())
    );
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

create or replace function public.expire_news_impact_delivery(p_event_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.push_alert_events event
  set delivery_status = case
        when pg_catalog.cardinality(event.delivery_succeeded_token_ids) > 0 then 'partial'
        else 'in_app_only'
      end,
      push_suppressed_reason = case
        when pg_catalog.cardinality(event.delivery_succeeded_token_ids) > 0 then coalesce(event.push_suppressed_reason, 'expired_after_partial_delivery')
        else 'expired_after_priority_delay'
      end,
      delivered_at = case
        when pg_catalog.cardinality(event.delivery_succeeded_token_ids) > 0 then coalesce(event.delivered_at, pg_catalog.now())
        else event.delivered_at
      end,
      delivery_lease_until = null
  where event.id = p_event_id
    and event.rule_id = 'news-impact'
    and event.delivery_expires_at <= pg_catalog.now()
    and (
      event.delivery_status in ('pending', 'failed')
      or (
        event.delivery_status = 'sending'
        and (event.delivery_lease_until is null or event.delivery_lease_until < pg_catalog.now())
      )
    );
  return found;
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
      delivery_lease_until = pg_catalog.now() + pg_catalog.make_interval(secs => least(greatest(p_lease_seconds, 30), 300))
  where event.id = p_event_id
    and event.rule_id = 'news-impact'
    and coalesce(event.delivery_not_before, pg_catalog.now()) <= pg_catalog.now()
    and (event.delivery_expires_at is null or event.delivery_expires_at > pg_catalog.now())
    and event.delivery_attempt_count < 3
    and (
      event.delivery_status in ('pending', 'failed')
      or (event.delivery_status = 'sending' and event.delivery_lease_until < pg_catalog.now())
    )
  returning event.*
$$;

drop function if exists public.complete_news_impact_delivery(uuid, integer, text, integer, integer, text);

create or replace function public.complete_news_impact_delivery(
  p_event_id uuid,
  p_attempt integer,
  p_status text,
  p_sent_count integer,
  p_failed_count integer,
  p_error text,
  p_success_token_ids uuid[]
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_success_ids uuid[];
begin
  if p_attempt is null or p_attempt < 1 or p_status not in ('sent', 'partial', 'failed', 'in_app_only') then
    raise exception 'invalid_delivery_status' using errcode = '22023';
  end if;
  if pg_catalog.cardinality(coalesce(p_success_token_ids, '{}'::uuid[])) > 20 then
    raise exception 'too_many_delivery_targets' using errcode = '22023';
  end if;

  select coalesce(pg_catalog.array_agg(distinct token_id), '{}'::uuid[])
  into v_success_ids
  from pg_catalog.unnest(
    coalesce((select delivery_succeeded_token_ids from public.push_alert_events where id = p_event_id), '{}'::uuid[])
    || coalesce(p_success_token_ids, '{}'::uuid[])
  ) as tokens(token_id);

  update public.push_alert_events
  set delivery_status = p_status,
      delivery_succeeded_token_ids = v_success_ids,
      sent_count = pg_catalog.cardinality(v_success_ids),
      failed_count = greatest(p_failed_count, 0),
      delivered_at = case when p_status in ('sent', 'partial') then pg_catalog.now() else delivered_at end,
      delivery_lease_until = null,
      last_delivery_error = left(p_error, 500)
  where id = p_event_id and rule_id = 'news-impact'
    and delivery_status = 'sending' and delivery_attempt_count = p_attempt;
  return found;
end
$$;

revoke all on function public.finalize_exhausted_news_impact_deliveries() from public, anon, authenticated;
revoke all on function public.block_news_source_items_after_catalog_change() from public, anon, authenticated;
revoke all on function public.renew_news_sync_run(uuid, integer) from public, anon, authenticated;
revoke all on function public.expire_news_impact_delivery(uuid) from public, anon, authenticated;
revoke all on function public.complete_news_impact_delivery(uuid, integer, text, integer, integer, text, uuid[]) from public, anon, authenticated;
grant execute on function public.finalize_exhausted_news_impact_deliveries() to service_role;
grant execute on function public.renew_news_sync_run(uuid, integer) to service_role;
grant execute on function public.expire_news_impact_delivery(uuid) to service_role;
grant execute on function public.complete_news_impact_delivery(uuid, integer, text, integer, integer, text, uuid[]) to service_role;
