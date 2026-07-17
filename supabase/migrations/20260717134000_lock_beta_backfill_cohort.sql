-- Keep the beta cohort and conflict check stable from validation through the
-- optional insert. This replaces function metadata only and performs no row
-- mutation until an authorized caller explicitly passes p_dry_run=false.
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
  -- Lock in auth -> profile -> subscription order to avoid racing signup,
  -- role changes, legacy tier changes, or a concurrent entitlement write.
  lock table auth.users in share mode;
  lock table public.profiles in share mode;
  lock table public.subscriptions in share row exclusive mode;

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
