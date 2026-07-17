-- Canonical, forward-only entitlement ledger. This migration is additive and
-- supports both the production legacy shape and the repository schema shape.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  plan text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke update on table public.profiles from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_row jsonb := to_jsonb(new);
  user_metadata jsonb := coalesce(user_row->'raw_user_meta_data', '{}'::jsonb);
  user_email text := user_row->>'email';
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='profiles' and column_name='email'
  ) then
    execute 'update public.profiles set email = coalesce($1, email) where id = $2'
      using user_email, new.id;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='profiles' and column_name='display_name'
  ) then
    execute 'update public.profiles set display_name = coalesce($1, display_name) where id = $2'
      using coalesce(user_metadata->>'name', user_metadata->>'full_name', split_part(user_email, '@', 1)), new.id;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='profiles' and column_name='avatar_url'
  ) then
    execute 'update public.profiles set avatar_url = coalesce($1, avatar_url) where id = $2'
      using coalesce(user_metadata->>'avatar_url', user_metadata->>'picture'), new.id;
  end if;
  return new;
end
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

do $migration$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    execute format(
      'alter function %s set search_path = %L',
      'public.set_updated_at()',
      ''
    );
  end if;
end
$migration$;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'manual',
  status text not null default 'inactive',
  tier text,
  plan text,
  market_scope text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  provider_customer_id text,
  provider_subscription_id text,
  provider_product_id text,
  provider_order_id text,
  provider_payment_id text,
  observed_at timestamptz,
  revoked_at timestamptz,
  revocation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions
  add column if not exists provider text not null default 'manual',
  add column if not exists status text not null default 'inactive',
  add column if not exists tier text,
  add column if not exists plan text,
  add column if not exists market_scope text,
  add column if not exists current_period_start timestamptz,
  add column if not exists current_period_end timestamptz,
  add column if not exists provider_customer_id text,
  add column if not exists provider_subscription_id text,
  add column if not exists provider_product_id text,
  add column if not exists provider_order_id text,
  add column if not exists provider_payment_id text,
  add column if not exists observed_at timestamptz,
  add column if not exists revoked_at timestamptz,
  add column if not exists revocation_reason text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists on_subscription_change on public.subscriptions;
do $migration$
begin
  if to_regprocedure('public.sync_membership_tier()') is not null then
    execute 'revoke execute on function public.sync_membership_tier() from public, anon, authenticated';
  end if;
end
$migration$;

update public.subscriptions
set plan = coalesce(plan, tier),
    tier = coalesce(tier, 'premium'),
    market_scope = coalesce(
      market_scope,
      case
        when coalesce(plan, tier) like 'crypto_%' then 'crypto'
        when coalesce(plan, tier) like 'stocks_%' then 'stocks'
        when coalesce(plan, tier) in ('premium', 'bundle_monthly', 'bundle_yearly') then 'bundle'
        else 'trial'
      end
    ),
    observed_at = coalesce(observed_at, updated_at, created_at, now())
where plan is null
   or tier is null
   or market_scope is null
   or observed_at is null;

alter table public.subscriptions
  drop constraint if exists subscriptions_provider_check,
  drop constraint if exists subscriptions_status_check,
  drop constraint if exists subscriptions_tier_check,
  drop constraint if exists subscriptions_plan_check,
  drop constraint if exists subscriptions_market_scope_check,
  drop constraint if exists subscriptions_eligible_shape_check;

alter table public.subscriptions
  add constraint subscriptions_status_check
    check (status in ('inactive', 'trialing', 'active', 'past_due', 'canceled', 'refunded', 'revoked', 'expired')) not valid,
  add constraint subscriptions_plan_check
    check (plan is null or plan in (
      'free', 'member', 'premium',
      'crypto_monthly', 'crypto_yearly',
      'stocks_monthly', 'stocks_yearly',
      'bundle_monthly', 'bundle_yearly'
    )) not valid,
  add constraint subscriptions_market_scope_check
    check (market_scope is null or market_scope in ('trial', 'crypto', 'stocks', 'bundle')) not valid,
  add constraint subscriptions_eligible_shape_check
    check (
      status not in ('trialing', 'active', 'canceled')
      or (
        plan is not null
        and market_scope in ('crypto', 'stocks', 'bundle')
        and current_period_end is not null
      )
    ) not valid;

alter table public.subscriptions
  validate constraint subscriptions_status_check,
  validate constraint subscriptions_plan_check,
  validate constraint subscriptions_market_scope_check,
  validate constraint subscriptions_eligible_shape_check;

drop index if exists public.subscriptions_provider_order_id_idx;
create unique index subscriptions_provider_order_id_idx
  on public.subscriptions (provider, provider_order_id)
  where provider_order_id is not null;
create index if not exists subscriptions_user_status_period_idx
  on public.subscriptions (user_id, status, current_period_end desc)
  where revoked_at is null;
create index if not exists subscriptions_provider_observed_idx
  on public.subscriptions (provider, user_id, observed_at desc);

alter table public.subscriptions enable row level security;
drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own"
  on public.subscriptions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
revoke all privileges on table public.subscriptions from public, anon, authenticated;
grant select (
  id, user_id, provider, status, plan, market_scope,
  current_period_start, current_period_end, revoked_at, created_at, updated_at
) on table public.subscriptions to authenticated;
grant select, insert, update, delete on table public.subscriptions to service_role;

create table if not exists public.billing_entitlement_events (
  id bigint generated by default as identity primary key,
  provider text not null,
  event_id text not null,
  user_id uuid,
  event_type text not null,
  observed_at timestamptz not null,
  actor_user_id uuid,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  outcome text not null default 'applied',
  created_at timestamptz not null default now(),
  unique (provider, event_id)
);
alter table public.billing_entitlement_events
  add column if not exists actor_user_id uuid,
  add column if not exists reason text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.billing_entitlement_events enable row level security;
revoke all privileges on table public.billing_entitlement_events from public, anon, authenticated;
revoke insert, update, delete on table public.billing_entitlement_events from service_role;
grant select on table public.billing_entitlement_events to service_role;
revoke all on sequence public.billing_entitlement_events_id_seq from public, anon, authenticated, service_role;

drop function if exists public.apply_billing_entitlement(
  uuid, text, text, text, text, text, timestamptz, timestamptz,
  text, text, text, timestamptz, boolean, text
);
drop function if exists public.apply_billing_entitlement(
  uuid, text, text, text, text, text, timestamptz, timestamptz,
  text, text, text, timestamptz, boolean, text, uuid, text, jsonb
);

create function public.apply_billing_entitlement(
  p_user_id uuid,
  p_provider text,
  p_event_id text,
  p_plan text default null,
  p_market_scope text default null,
  p_status text default 'active',
  p_period_start timestamptz default now(),
  p_period_end timestamptz default null,
  p_provider_product_id text default null,
  p_provider_order_id text default null,
  p_provider_payment_id text default null,
  p_observed_at timestamptz default now(),
  p_revoke boolean default false,
  p_revocation_reason text default null,
  p_actor_user_id uuid default null,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_count integer := 0;
  inserted_event_id bigint;
begin
  if p_user_id is null or nullif(trim(p_provider), '') is null or nullif(trim(p_event_id), '') is null then
    raise exception 'user_id, provider, and event_id are required';
  end if;
  if p_provider not in ('manual', 'revenuecat', 'legacy_beta') then
    raise exception 'unsupported entitlement provider';
  end if;
  if p_observed_at > now() + interval '5 minutes' then
    raise exception 'observed_at is in the future';
  end if;

  if not p_revoke then
    if p_plan not in (
      'member', 'premium', 'crypto_monthly', 'crypto_yearly',
      'stocks_monthly', 'stocks_yearly', 'bundle_monthly', 'bundle_yearly'
    ) then
      raise exception 'unsupported entitlement plan';
    end if;
    if p_market_scope not in ('crypto', 'stocks', 'bundle') then
      raise exception 'unsupported market scope';
    end if;
    if p_status not in ('trialing', 'active', 'canceled') then
      raise exception 'status is not authorization eligible';
    end if;
    if p_period_end is null or p_period_end <= p_observed_at then
      raise exception 'a future period end is required';
    end if;
    if p_provider = 'manual' and p_period_end > p_observed_at + interval '365 days' then
      raise exception 'manual entitlement cannot exceed 365 days';
    end if;
    if nullif(trim(p_provider_order_id), '') is null then
      raise exception 'provider_order_id is required';
    end if;
    if exists (
      select 1
      from public.subscriptions
      where provider = p_provider
        and provider_order_id = p_provider_order_id
        and user_id <> p_user_id
    ) then
      raise exception 'provider order belongs to another user';
    end if;
  end if;

  insert into public.billing_entitlement_events (
    provider, event_id, user_id, event_type, observed_at,
    actor_user_id, reason, metadata
  ) values (
    p_provider, p_event_id, p_user_id,
    case when p_revoke then 'revoke' else 'apply' end,
    p_observed_at, p_actor_user_id,
    coalesce(nullif(trim(p_reason), ''), nullif(trim(p_revocation_reason), '')),
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (provider, event_id) do nothing
  returning id into inserted_event_id;

  if inserted_event_id is null then
    return jsonb_build_object('status', 'duplicate', 'changed', false);
  end if;

  if p_revoke then
    update public.subscriptions
    set status = 'revoked',
        revoked_at = p_observed_at,
        revocation_reason = coalesce(nullif(trim(p_revocation_reason), ''), 'manual_revoke'),
        observed_at = p_observed_at,
        updated_at = now()
    where user_id = p_user_id
      and provider = p_provider
      and (p_provider_order_id is null or provider_order_id = p_provider_order_id)
      and coalesce(observed_at, '-infinity'::timestamptz) < p_observed_at;
    get diagnostics affected_count = row_count;
  else
    insert into public.subscriptions (
      user_id, provider, status, tier, plan, market_scope,
      current_period_start, current_period_end,
      provider_product_id, provider_order_id, provider_payment_id,
      observed_at, revoked_at, revocation_reason, updated_at
    ) values (
      p_user_id, p_provider, p_status, 'premium', p_plan, p_market_scope,
      p_period_start, p_period_end,
      p_provider_product_id, p_provider_order_id, p_provider_payment_id,
      p_observed_at, null, null, now()
    )
    on conflict (provider, provider_order_id) where provider_order_id is not null
    do update set
      status = excluded.status,
      tier = excluded.tier,
      plan = excluded.plan,
      market_scope = excluded.market_scope,
      current_period_start = excluded.current_period_start,
      current_period_end = excluded.current_period_end,
      provider_product_id = excluded.provider_product_id,
      provider_payment_id = excluded.provider_payment_id,
      observed_at = excluded.observed_at,
      revoked_at = null,
      revocation_reason = null,
      updated_at = now()
    where public.subscriptions.user_id = excluded.user_id
      and coalesce(public.subscriptions.observed_at, '-infinity'::timestamptz) < excluded.observed_at;
    get diagnostics affected_count = row_count;
    if affected_count = 0 and exists (
      select 1
      from public.subscriptions
      where provider = p_provider
        and provider_order_id = p_provider_order_id
        and user_id <> p_user_id
    ) then
      raise exception 'provider order belongs to another user';
    end if;
  end if;

  update public.billing_entitlement_events
  set outcome = case when affected_count > 0 then 'applied' else 'stale' end
  where id = inserted_event_id;

  return jsonb_build_object(
    'status', case when affected_count > 0 then 'active' else 'stale' end,
    'changed', affected_count > 0
  );
end
$$;

revoke all on function public.apply_billing_entitlement(
  uuid, text, text, text, text, text, timestamptz, timestamptz,
  text, text, text, timestamptz, boolean, text, uuid, text, jsonb
) from public, anon, authenticated;
grant execute on function public.apply_billing_entitlement(
  uuid, text, text, text, text, text, timestamptz, timestamptz,
  text, text, text, timestamptz, boolean, text, uuid, text, jsonb
) to service_role;

create or replace function public.reconcile_provider_entitlements(
  p_user_id uuid,
  p_provider text,
  p_event_id text,
  p_snapshot jsonb,
  p_observed_at timestamptz,
  p_verified_empty boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  inserted_event_id bigint;
  changed_count integer := 0;
  row_count_value integer := 0;
begin
  if p_provider <> 'revenuecat' then
    raise exception 'snapshot reconciliation is only enabled for revenuecat';
  end if;
  if jsonb_typeof(p_snapshot) <> 'array' then
    raise exception 'snapshot must be an array';
  end if;
  if jsonb_array_length(p_snapshot) = 0 and not p_verified_empty then
    raise exception 'empty snapshot must be explicitly verified';
  end if;
  if jsonb_array_length(p_snapshot) > 0 and p_verified_empty then
    raise exception 'verified_empty conflicts with a non-empty snapshot';
  end if;
  if p_observed_at > now() + interval '5 minutes' then
    raise exception 'observed_at is in the future';
  end if;
  if exists (
    select 1 from public.subscriptions
    where provider = p_provider
      and user_id = p_user_id
      and observed_at >= p_observed_at
  ) then
    return jsonb_build_object('status', 'stale', 'changed', false);
  end if;
  if (
    select count(*)
    from jsonb_array_elements(p_snapshot) value
  ) <> (
    select count(distinct value->>'provider_order_id')
    from jsonb_array_elements(p_snapshot) value
  ) then
    raise exception 'snapshot contains duplicate provider orders';
  end if;

  for item in select value from jsonb_array_elements(p_snapshot)
  loop
    if item->>'plan' not in (
      'crypto_monthly', 'crypto_yearly', 'stocks_monthly', 'stocks_yearly',
      'bundle_monthly', 'bundle_yearly'
    ) then
      raise exception 'snapshot contains an unknown product plan';
    end if;
    if item->>'market_scope' not in ('crypto', 'stocks', 'bundle') then
      raise exception 'snapshot contains an invalid market scope';
    end if;
    if coalesce(item->>'status', 'active') not in ('trialing', 'active', 'canceled') then
      raise exception 'snapshot contains an ineligible status';
    end if;
    if nullif(item->>'provider_order_id', '') is null
       or nullif(item->>'provider_product_id', '') is null then
      raise exception 'snapshot identifiers are required';
    end if;
    if nullif(item->>'current_period_end', '') is null then
      raise exception 'snapshot period end is required';
    end if;
    if (item->>'current_period_end')::timestamptz <= p_observed_at then
      raise exception 'snapshot period has already ended';
    end if;
    if exists (
      select 1 from public.subscriptions
      where provider = p_provider
        and provider_order_id = item->>'provider_order_id'
        and user_id <> p_user_id
        and not (
          status = 'revoked'
          and revoked_at is not null
          and coalesce(observed_at, '-infinity'::timestamptz) < p_observed_at
        )
    ) then
      raise exception 'provider order belongs to another user';
    end if;
  end loop;

  insert into public.billing_entitlement_events (
    provider, event_id, user_id, event_type, observed_at, reason, metadata
  ) values (
    p_provider, p_event_id, p_user_id, 'snapshot', p_observed_at,
    'provider_snapshot', jsonb_build_object('verified_empty', p_verified_empty)
  )
  on conflict (provider, event_id) do nothing
  returning id into inserted_event_id;
  if inserted_event_id is null then
    return jsonb_build_object('status', 'duplicate', 'changed', false);
  end if;

  for item in select value from jsonb_array_elements(p_snapshot)
  loop
    insert into public.subscriptions (
      user_id, provider, status, tier, plan, market_scope,
      current_period_start, current_period_end,
      provider_product_id, provider_order_id, provider_payment_id,
      observed_at, revoked_at, revocation_reason, updated_at
    ) values (
      p_user_id, p_provider, coalesce(item->>'status', 'active'), 'premium',
      item->>'plan', item->>'market_scope',
      coalesce((item->>'current_period_start')::timestamptz, p_observed_at),
      (item->>'current_period_end')::timestamptz,
      item->>'provider_product_id', item->>'provider_order_id', item->>'provider_payment_id',
      p_observed_at, null, null, now()
    )
    on conflict (provider, provider_order_id) where provider_order_id is not null
    do update set
      user_id = excluded.user_id,
      status = excluded.status,
      tier = excluded.tier,
      plan = excluded.plan,
      market_scope = excluded.market_scope,
      current_period_start = excluded.current_period_start,
      current_period_end = excluded.current_period_end,
      provider_product_id = excluded.provider_product_id,
      provider_payment_id = excluded.provider_payment_id,
      observed_at = excluded.observed_at,
      revoked_at = null,
      revocation_reason = null,
      updated_at = now()
    where (
        public.subscriptions.user_id = excluded.user_id
        or (
          public.subscriptions.status = 'revoked'
          and public.subscriptions.revoked_at is not null
        )
      )
      and coalesce(public.subscriptions.observed_at, '-infinity'::timestamptz) < excluded.observed_at;
    get diagnostics row_count_value = row_count;
    if row_count_value = 0 and exists (
      select 1
      from public.subscriptions
      where provider = p_provider
        and provider_order_id = item->>'provider_order_id'
        and user_id <> p_user_id
    ) then
      raise exception 'provider order belongs to another user';
    end if;
    changed_count := changed_count + row_count_value;
  end loop;

  update public.subscriptions subscription
  set status = 'revoked',
      revoked_at = p_observed_at,
      revocation_reason = case when p_verified_empty then 'verified_empty_snapshot' else 'missing_from_snapshot' end,
      observed_at = p_observed_at,
      updated_at = now()
  where subscription.user_id = p_user_id
    and subscription.provider = p_provider
    and coalesce(subscription.observed_at, '-infinity'::timestamptz) < p_observed_at
    and not exists (
      select 1
      from jsonb_array_elements(p_snapshot) value
      where value->>'provider_order_id' = subscription.provider_order_id
    );
  get diagnostics row_count_value = row_count;
  changed_count := changed_count + row_count_value;

  update public.billing_entitlement_events
  set outcome = case when changed_count > 0 or jsonb_array_length(p_snapshot) = 0 then 'applied' else 'stale' end
  where id = inserted_event_id;

  return jsonb_build_object(
    'status', case
      when jsonb_array_length(p_snapshot) = 0 then 'not_active'
      when changed_count > 0 then 'active'
      else 'stale'
    end,
    'changed', changed_count > 0
  );
end
$$;

revoke all on function public.reconcile_provider_entitlements(
  uuid, text, text, jsonb, timestamptz, boolean
) from public, anon, authenticated;
grant execute on function public.reconcile_provider_entitlements(
  uuid, text, text, jsonb, timestamptz, boolean
) to service_role;

drop function if exists public.backfill_legacy_beta_entitlements(integer, boolean);
create or replace function public.backfill_legacy_beta_entitlements(
  p_expected_count integer default 12,
  p_dry_run boolean default true,
  p_expected_cohort_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  eligible_count integer;
  conflicting_count integer;
  cohort_hash text;
  inserted_count integer := 0;
begin
  select count(*)::integer
  into eligible_count
  from public.profiles profile
  left join auth.users auth_user on auth_user.id = profile.id
  where coalesce(to_jsonb(profile)->>'plan', to_jsonb(profile)->>'membership_tier') = 'premium'
    and coalesce(auth_user.raw_app_meta_data->>'role', '') <> 'admin';

  select md5(coalesce(string_agg(profile.id::text, ',' order by profile.id), ''))
  into cohort_hash
  from public.profiles profile
  left join auth.users auth_user on auth_user.id = profile.id
  where coalesce(to_jsonb(profile)->>'plan', to_jsonb(profile)->>'membership_tier') = 'premium'
    and coalesce(auth_user.raw_app_meta_data->>'role', '') <> 'admin';

  select count(distinct profile.id)::integer
  into conflicting_count
  from public.profiles profile
  left join auth.users auth_user on auth_user.id = profile.id
  join public.subscriptions subscription on subscription.user_id = profile.id
  where coalesce(to_jsonb(profile)->>'plan', to_jsonb(profile)->>'membership_tier') = 'premium'
    and coalesce(auth_user.raw_app_meta_data->>'role', '') <> 'admin'
    and subscription.provider <> 'legacy_beta';

  if eligible_count <> p_expected_count then
    raise exception 'legacy beta count mismatch: expected %, found %', p_expected_count, eligible_count;
  end if;
  if conflicting_count > 0 then
    raise exception 'legacy beta cohort has % existing non-beta subscription(s)', conflicting_count;
  end if;
  if p_dry_run then
    return jsonb_build_object(
      'status', 'dry_run',
      'eligible_count', eligible_count,
      'conflicting_count', conflicting_count,
      'cohort_hash', cohort_hash,
      'changed', false
    );
  end if;
  if nullif(p_expected_cohort_hash, '') is null or p_expected_cohort_hash <> cohort_hash then
    raise exception 'legacy beta cohort changed after dry-run';
  end if;

  insert into public.subscriptions (
    user_id, provider, status, tier, plan, market_scope,
    current_period_start, current_period_end,
    provider_product_id, provider_order_id,
    observed_at, revoked_at, revocation_reason, updated_at
  )
  select
    profile.id,
    'legacy_beta',
    case when profile.created_at + interval '3 months' > now() then 'active' else 'expired' end,
    'premium',
    'premium',
    'bundle',
    profile.created_at,
    profile.created_at + interval '3 months',
    'legacy_beta_3_month',
    'legacy_beta:' || profile.id::text,
    now(),
    case when profile.created_at + interval '3 months' > now() then null else profile.created_at + interval '3 months' end,
    case when profile.created_at + interval '3 months' > now() then null else 'beta_period_ended' end,
    now()
  from public.profiles profile
  left join auth.users auth_user on auth_user.id = profile.id
  where coalesce(to_jsonb(profile)->>'plan', to_jsonb(profile)->>'membership_tier') = 'premium'
    and coalesce(auth_user.raw_app_meta_data->>'role', '') <> 'admin'
  on conflict (provider, provider_order_id) where provider_order_id is not null
  do nothing;
  get diagnostics inserted_count = row_count;

  insert into public.billing_entitlement_events (
    provider, event_id, user_id, event_type, observed_at, outcome
  )
  select
    'legacy_beta', 'legacy_beta:' || profile.id::text, profile.id,
    'beta_backfill', now(), 'applied'
  from public.profiles profile
  left join auth.users auth_user on auth_user.id = profile.id
  where coalesce(to_jsonb(profile)->>'plan', to_jsonb(profile)->>'membership_tier') = 'premium'
    and coalesce(auth_user.raw_app_meta_data->>'role', '') <> 'admin'
  on conflict (provider, event_id) do nothing;

  return jsonb_build_object(
    'status', 'applied', 'eligible_count', eligible_count,
    'inserted_count', inserted_count, 'changed', inserted_count > 0
  );
end
$$;

revoke all on function public.backfill_legacy_beta_entitlements(integer, boolean, text)
  from public, anon, authenticated;
grant execute on function public.backfill_legacy_beta_entitlements(integer, boolean, text)
  to service_role;

-- Final signal policy: public rows are readable by everyone; premium rows only
-- by an admin claim or an unexpired subscription for the matching market.
create table if not exists public.signals (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  timeframe text not null,
  bias text not null,
  verdict text not null,
  summary text not null default '',
  payload jsonb not null default '{}'::jsonb,
  visibility text,
  market_scope text,
  triggered_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.signals
  add column if not exists visibility text,
  add column if not exists market_scope text,
  add column if not exists triggered_at timestamptz;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'signals' and column_name = 'fired_at'
  ) then
    execute $sql$
      update public.signals
      set triggered_at = coalesce(triggered_at, fired_at, now())
      where triggered_at is null
    $sql$;
  else
    update public.signals
    set triggered_at = now()
    where triggered_at is null;
  end if;
end
$$;

alter table public.signals
  alter column triggered_at set default now(),
  alter column triggered_at set not null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'signals' and column_name = 'is_public'
  ) then
    execute $sql$
      update public.signals
      set visibility = case when coalesce(is_public, false) then 'public' else 'premium' end,
          market_scope = coalesce(market_scope, 'bundle')
      where visibility is null
         or visibility not in ('public', 'premium')
         or market_scope is null
    $sql$;
  else
    update public.signals
    set visibility = case when visibility = 'public' then 'public' else 'premium' end,
        market_scope = coalesce(market_scope, 'bundle')
    where visibility is null
       or visibility not in ('public', 'premium')
       or market_scope is null;
  end if;
end
$$;

alter table public.signals
  alter column visibility set default 'premium',
  alter column visibility set not null,
  alter column market_scope set default 'bundle',
  alter column market_scope set not null,
  drop constraint if exists signals_visibility_check,
  drop constraint if exists signals_market_scope_check;
alter table public.signals
  add constraint signals_visibility_check check (visibility in ('public', 'premium')),
  add constraint signals_market_scope_check check (market_scope in ('crypto', 'stocks', 'bundle'));

create or replace function public.has_effective_market_entitlement(p_market_scope text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce((select auth.jwt()->'app_metadata'->>'role' = 'admin'), false)
    or (
      p_market_scope in ('crypto', 'stocks', 'bundle')
      and exists (
      select 1
      from public.subscriptions subscription
      where subscription.user_id = (select auth.uid())
        and subscription.revoked_at is null
        and subscription.status in ('trialing', 'active', 'canceled')
        and subscription.current_period_end > now()
        and subscription.market_scope in ('bundle', 'crypto')
        and p_market_scope in ('crypto', 'bundle')
      )
      and (
        p_market_scope <> 'bundle'
        or exists (
          select 1
          from public.subscriptions subscription
          where subscription.user_id = (select auth.uid())
            and subscription.revoked_at is null
            and subscription.status in ('trialing', 'active', 'canceled')
            and subscription.current_period_end > now()
            and subscription.market_scope in ('bundle', 'stocks')
        )
      )
    )
    or (
      p_market_scope = 'stocks'
      and exists (
        select 1
        from public.subscriptions subscription
        where subscription.user_id = (select auth.uid())
          and subscription.revoked_at is null
          and subscription.status in ('trialing', 'active', 'canceled')
          and subscription.current_period_end > now()
          and subscription.market_scope in ('bundle', 'stocks')
      )
    )
$$;
revoke all on function public.has_effective_market_entitlement(text) from public, anon;
grant execute on function public.has_effective_market_entitlement(text) to authenticated, service_role;

alter table public.signals enable row level security;
drop policy if exists "signals_public_read" on public.signals;
drop policy if exists "signals_premium_read" on public.signals;
create policy "signals_public_read"
  on public.signals
  for select
  to anon, authenticated
  using (visibility = 'public');
create policy "signals_premium_read"
  on public.signals
  for select
  to authenticated
  using (
    visibility = 'premium'
    and public.has_effective_market_entitlement(market_scope)
  );
revoke all privileges on table public.signals from public, anon, authenticated;
grant select on table public.signals to anon, authenticated;
grant select, insert, update, delete on table public.signals to service_role;
create index if not exists signals_visibility_market_idx
  on public.signals (visibility, market_scope, triggered_at desc);
