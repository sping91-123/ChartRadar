create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'canceled', 'failed')),
  requested_at timestamptz not null default now(),
  -- This is the promised completion deadline, not a mandatory waiting period.
  process_after timestamptz not null default (now() + interval '7 days'),
  canceled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  attempt_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.oauth_provider_credentials (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('apple')),
  encrypted_refresh_token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);
alter table public.oauth_provider_credentials enable row level security;
revoke all privileges on table public.oauth_provider_credentials from public, anon, authenticated;
grant select, insert, update, delete on table public.oauth_provider_credentials to service_role;

create unique index if not exists account_deletion_requests_one_active_idx
  on public.account_deletion_requests (user_id)
  where status in ('pending', 'processing', 'failed');
drop index if exists public.account_deletion_requests_queue_idx;
create index account_deletion_requests_queue_idx
  on public.account_deletion_requests (status, process_after, started_at, requested_at);

alter table public.account_deletion_requests enable row level security;
revoke all privileges on table public.account_deletion_requests from public, anon, authenticated;
drop policy if exists "account_deletion_requests_select_own" on public.account_deletion_requests;
create policy "account_deletion_requests_select_own"
  on public.account_deletion_requests
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
grant select (id, user_id, status, requested_at, process_after, completed_at)
  on table public.account_deletion_requests to authenticated;
grant select, insert, update, delete on table public.account_deletion_requests to service_role;

create or replace function public.request_account_deletion(p_user_id uuid)
returns table (
  request_id uuid,
  request_status text,
  requested_at timestamptz,
  process_after timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.account_deletion_requests
  set status = 'pending',
      requested_at = now(),
      process_after = now() + interval '7 days',
      canceled_at = null,
      started_at = null,
      completed_at = null,
      last_error = null,
      updated_at = now()
  where user_id = p_user_id
    and status in ('pending', 'failed');

  if not found then
    insert into public.account_deletion_requests (user_id)
    select p_user_id
    where not exists (
      select 1
      from public.account_deletion_requests request
      where request.user_id = p_user_id
        and request.status in ('pending', 'processing', 'failed')
    )
    on conflict do nothing;
  end if;

  return query
  select request.id, request.status, request.requested_at, request.process_after
  from public.account_deletion_requests request
  where request.user_id = p_user_id
    and request.status in ('pending', 'processing', 'failed')
  order by request.requested_at desc
  limit 1;
end
$$;

create or replace function public.cancel_account_deletion(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.account_deletion_requests
  set status = 'canceled',
      canceled_at = now(),
      updated_at = now()
  where user_id = p_user_id
    and status = 'pending';
  return found;
end
$$;

revoke all on function public.request_account_deletion(uuid) from public, anon, authenticated;
revoke all on function public.cancel_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.request_account_deletion(uuid) to service_role;
grant execute on function public.cancel_account_deletion(uuid) to service_role;

create or replace function public.start_account_deletion(p_request_id uuid)
returns table (user_id uuid, request_status text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.account_deletion_requests request
  set status = 'processing',
      started_at = now(),
      attempt_count = request.attempt_count + 1,
      last_error = null,
      updated_at = now()
  where request.id = p_request_id
    and (
      request.status in ('pending', 'failed')
      or (
        request.status = 'processing'
        and request.started_at < now() - interval '15 minutes'
      )
    )
  returning request.user_id, request.status;
end
$$;

create or replace function public.fail_account_deletion(p_request_id uuid, p_error text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.account_deletion_requests
  set status = 'failed',
      last_error = left(coalesce(p_error, 'unknown failure'), 500),
      updated_at = now()
  where id = p_request_id
    and status = 'processing';
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
    'journals', 'push_alert_events', 'push_alert_presets', 'push_tokens', 'subscriptions', 'oauth_provider_credentials'
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
  if to_regclass('public.profiles') is not null then
    delete from public.profiles where id = p_user_id;
  end if;
  return jsonb_build_object('deleted_rows', total_affected);
end
$$;

revoke all on function public.start_account_deletion(uuid) from public, anon, authenticated;
revoke all on function public.fail_account_deletion(uuid, text) from public, anon, authenticated;
revoke all on function public.purge_account_application_data(uuid) from public, anon, authenticated;
grant execute on function public.start_account_deletion(uuid) to service_role;
grant execute on function public.fail_account_deletion(uuid, text) to service_role;
grant execute on function public.purge_account_application_data(uuid) to service_role;
