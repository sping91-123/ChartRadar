-- Forward-only NEWS usefulness and reaction-integrity upgrade.
-- Federal Register remains an official, metadata-only source and is not push eligible.

insert into public.news_source_catalog as current_source (
  source_id,
  display_name,
  policy_status,
  policy_reason,
  terms_url,
  reviewed_at,
  max_requests_per_second,
  timeout_ms,
  enabled,
  allowed_hosts
) values (
  'federal_register_financial',
  'Federal Register',
  'allowed',
  'official_public_inspection_api_metadata_only',
  'https://www.archives.gov/federal-register/faqs',
  '2026-07-24',
  1,
  10000,
  true,
  array['federalregister.gov']::text[]
)
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
  allowed_hosts = case
    when current_source.policy_status <> 'allowed'
      or current_source.enabled = false
      or pg_catalog.cardinality(current_source.allowed_hosts) = 0
      then current_source.allowed_hosts
    else excluded.allowed_hosts
  end,
  updated_at = pg_catalog.now();

-- A market reaction cannot compare outputs from different decision engines.
-- Existing mismatches stay in the audit ledger but are made non-actionable.
update public.news_market_reactions reaction
set quality = 'unavailable',
    classification = 'insufficient_data',
    risk_effect = 'unchanged',
    reaction_summary = '분석 기준 버전이 달라 발표 전후 반응을 비교하지 않습니다.',
    next_check_at = null,
    updated_at = pg_catalog.clock_timestamp()
from public.perpetual_decision_snapshots baseline,
     public.perpetual_decision_snapshots evaluated
where reaction.target in ('btc', 'eth')
  and reaction.stage <> 'detected'
  and reaction.pre_snapshot_id = baseline.id
  and reaction.evaluated_snapshot_id = evaluated.id
  and baseline.engine_version <> evaluated.engine_version;

create or replace function public.enforce_news_reaction_engine_version()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and old.target in ('btc', 'eth')
     and old.stage <> 'detected'
     and old.quality = 'ready'
     and old.pre_snapshot_id is not null
     and old.evaluated_snapshot_id is not null
     and (new.pre_snapshot_id is null or new.evaluated_snapshot_id is null) then
    new.quality := 'unavailable';
    new.classification := 'insufficient_data';
    new.risk_effect := 'unchanged';
    new.reaction_summary := '보관 기간이 지난 비교 자료는 방향 판단에 다시 사용하지 않습니다.';
    new.next_check_at := null;
    return new;
  end if;

  if new.target in ('btc', 'eth')
     and new.stage <> 'detected'
     and new.quality = 'ready'
     and not exists (
       select 1
       from public.perpetual_decision_snapshots baseline
       join public.perpetual_decision_snapshots evaluated
         on evaluated.id = new.evaluated_snapshot_id
       where baseline.id = new.pre_snapshot_id
         and baseline.asset = new.target
         and evaluated.asset = new.target
         and baseline.engine_version = evaluated.engine_version
     ) then
    raise exception 'news_reaction_engine_version_mismatch' using errcode = '23514';
  end if;
  return new;
end
$$;

drop trigger if exists enforce_news_reaction_engine_version on public.news_market_reactions;
create trigger enforce_news_reaction_engine_version
before insert or update of target, stage, quality, pre_snapshot_id, evaluated_snapshot_id
on public.news_market_reactions
for each row execute function public.enforce_news_reaction_engine_version();

revoke all on function public.enforce_news_reaction_engine_version() from public, anon, authenticated, service_role;
grant execute on function public.enforce_news_reaction_engine_version() to service_role;

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

  if tg_op = 'UPDATE'
     and old.stage <> 'detected'
     and old.quality = 'ready'
     and (
       (old.target in ('btc', 'eth')
         and old.pre_snapshot_id is not null
         and old.evaluated_snapshot_id is not null
         and (new.pre_snapshot_id is null or new.evaluated_snapshot_id is null))
       or
       (old.target = 'global'
         and old.baseline_observation_id is not null
         and old.evaluated_observation_id is not null
         and (new.baseline_observation_id is null or new.evaluated_observation_id is null))
     ) then
    new.quality := 'unavailable';
    new.classification := 'insufficient_data';
    new.risk_effect := 'unchanged';
    new.reaction_summary := '보관 기간이 지난 비교 자료는 방향 판단에 다시 사용하지 않습니다.';
    new.next_check_at := null;
    return new;
  end if;

  if new.stage <> 'detected' and new.quality = 'ready' then
    if new.target in ('btc', 'eth') then
      if new.pre_snapshot_id is null or new.evaluated_snapshot_id is null or not exists (
        select 1
        from public.perpetual_decision_snapshots baseline
        join public.perpetual_decision_snapshots evaluated on evaluated.id = new.evaluated_snapshot_id
        where baseline.id = new.pre_snapshot_id
          and baseline.asset = new.target
          and evaluated.asset = new.target
          and baseline.quality = 'ready'
          and evaluated.quality = 'ready'
          and evaluated.generated_at > baseline.generated_at
          and evaluated.engine_version = baseline.engine_version
      ) then
        raise exception 'news_reaction_snapshot_not_ready' using errcode = '23514';
      end if;
    elsif new.baseline_observation_id is null or new.evaluated_observation_id is null or not exists (
      select 1
      from public.global_reaction_observations baseline
      join public.global_reaction_observations evaluated on evaluated.id = new.evaluated_observation_id
      where baseline.id = new.baseline_observation_id
        and baseline.quality = 'ready'
        and evaluated.quality = 'ready'
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

revoke all on function public.enforce_news_reaction_integrity() from public, anon, authenticated, service_role;
grant execute on function public.enforce_news_reaction_integrity() to service_role;

insert into public.news_source_catalog as current_source (
  source_id,
  display_name,
  policy_status,
  policy_reason,
  terms_url,
  reviewed_at,
  max_requests_per_second,
  timeout_ms,
  enabled,
  allowed_hosts
) values (
  'occ_news_releases',
  'U.S. OCC',
  'allowed',
  'official_rss_crypto_policy',
  'https://www.occ.gov/rss/index-rss.html',
  '2026-07-24',
  1,
  8000,
  true,
  array['occ.gov']::text[]
)
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
  allowed_hosts = case
    when current_source.policy_status <> 'allowed'
      or current_source.enabled = false
      or pg_catalog.cardinality(current_source.allowed_hosts) = 0
      then current_source.allowed_hosts
    else excluded.allowed_hosts
  end,
  updated_at = pg_catalog.now();

insert into public.news_source_catalog as current_source (
  source_id,
  display_name,
  policy_status,
  policy_reason,
  terms_url,
  reviewed_at,
  max_requests_per_second,
  timeout_ms,
  enabled,
  allowed_hosts
) values (
  'cftc_cot_positioning',
  'U.S. CFTC 주간 포지션',
  'allowed',
  'official_weekly_tff_dataset_context_only',
  'https://publicreporting.cftc.gov/stories/s/User-s-Guide/p2fg-u73y/',
  '2026-07-24',
  1,
  6000,
  true,
  array['publicreporting.cftc.gov', 'publicreportinghub.cftc.gov']::text[]
)
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
  allowed_hosts = case
    when current_source.policy_status <> 'allowed'
      or current_source.enabled = false
      or pg_catalog.cardinality(current_source.allowed_hosts) = 0
      then current_source.allowed_hosts
    else excluded.allowed_hosts
  end,
  updated_at = pg_catalog.now();

-- Bind alert eligibility to the exact official source item that earned it.
-- Legacy eligible events are backfilled from their primary source once.
update public.news_impact_events event
set metadata = pg_catalog.jsonb_set(
  event.metadata,
  '{push_source_item_ids}',
  pg_catalog.to_jsonb(array[event.primary_source_item_id::text]),
  true
)
where event.metadata ->> 'push_eligible' = 'true'
  and event.primary_source_item_id is not null
  and case
    when pg_catalog.jsonb_typeof(event.metadata -> 'push_source_item_ids') = 'array'
      then pg_catalog.jsonb_array_length(event.metadata -> 'push_source_item_ids') = 0
    else true
  end;

create or replace function public.enforce_news_alert_source_provenance()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.notification_kind is distinct from 'news_impact' then
    return new;
  end if;

  if new.news_event_id is null
     or new.news_reaction_id is null
     or not exists (
       select 1
       from public.news_impact_events event
       join public.news_market_reactions reaction
         on reaction.id = new.news_reaction_id
        and reaction.event_id = event.id
        and reaction.event_version = event.version
       join public.news_event_sources event_source on event_source.event_id = event.id
       join public.news_source_items item on item.id = event_source.source_item_id
       join public.news_source_catalog source on source.source_id = item.source_id
       where event.id = new.news_event_id
         and event.status <> 'retracted'
         and event.metadata ->> 'push_eligible' = 'true'
         and event.metadata -> 'push_source_item_ids' @> pg_catalog.jsonb_build_array(item.id::text)
         and reaction.quality = 'ready'
         and reaction.classification in (
           'risk_increase', 'decision_state_changed', 'conflicts_with_existing_state'
         )
         and item.source_id in (
           'macro_official_store', 'fed_press_releases', 'sec_press_releases', 'cftc_releases'
         )
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
     ) then
    return null;
  end if;

  return new;
end
$$;

drop trigger if exists enforce_news_alert_source_provenance on public.push_alert_events;
create trigger enforce_news_alert_source_provenance
before insert on public.push_alert_events
for each row execute function public.enforce_news_alert_source_provenance();

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
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('news-impact:' || p_user_id::text, 0)
  );
  insert into public.news_alert_preferences (user_id, market, enabled)
  values (p_user_id, p_market, coalesce(p_enabled, false))
  on conflict (user_id, market) do update
  set enabled = excluded.enabled, updated_at = pg_catalog.clock_timestamp();
  return query select preference.* from public.news_alert_preferences preference
  where preference.user_id = p_user_id and preference.market = p_market;
end
$$;

revoke all on function public.enforce_news_alert_source_provenance() from public, anon, authenticated, service_role;
revoke all on function public.set_news_alert_preference(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.enforce_news_alert_source_provenance() to service_role;
grant execute on function public.set_news_alert_preference(uuid, text, boolean) to service_role;
