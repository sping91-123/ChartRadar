-- Exchange journal runtime controls:
-- - fail closed independently of deploy-time environment variables
-- - preserve credential cleanup while mutations are disabled
-- - filter scheduled claims to the current canary cohort
-- - schedule successful syncs at 10 minutes so a five-minute cron stays within the 15-minute target

create table if not exists public.exchange_feature_control (
  id boolean primary key default true check (id),
  operations_enabled boolean not null default false,
  reason text not null default 'initial_lock' check (char_length(reason) between 1 and 120),
  updated_at timestamptz not null default now()
);

alter table public.exchange_feature_control enable row level security;
revoke all on table public.exchange_feature_control from public, anon, authenticated;
grant select on table public.exchange_feature_control to service_role;

insert into public.exchange_feature_control (id, operations_enabled, reason)
values (true, false, 'initial_lock')
on conflict (id) do nothing;

drop trigger if exists set_exchange_feature_control_updated_at on public.exchange_feature_control;
create trigger set_exchange_feature_control_updated_at
before update on public.exchange_feature_control
for each row execute function public.set_exchange_updated_at();

create or replace function public.exchange_operations_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select control.operations_enabled
    from public.exchange_feature_control control
    where control.id
  ), false)
$$;

create or replace function public.guard_exchange_connection_operations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enabled boolean := public.exchange_operations_enabled();
begin
  if tg_op = 'INSERT' then
    if not v_enabled then
      raise exception 'exchange operations disabled';
    end if;
    return new;
  end if;

  if v_enabled then
    if old.sync_lease_token is not null
      and new.sync_lease_token is null
      and new.last_synced_at is distinct from old.last_synced_at
      and new.status in ('ready', 'partial')
    then
      new.next_sync_at := new.last_synced_at + interval '10 minutes';
    end if;
    return new;
  end if;

  if new.status = 'disconnected' then
    return new;
  end if;

  if old.sync_lease_token is not null
    and new.sync_lease_token is null
    and new.last_synced_at is not distinct from old.last_synced_at
    and new.status in ('partial', 'permission_changed', 'ip_mismatch', 'rate_limited', 'provider_unavailable')
  then
    return new;
  end if;

  raise exception 'exchange operations disabled';
end
$$;

drop trigger if exists guard_exchange_connection_operations on public.exchange_connections;
create trigger guard_exchange_connection_operations
before insert or update on public.exchange_connections
for each row execute function public.guard_exchange_connection_operations();

create or replace function public.claim_exchange_connection(
  p_connection_id uuid,
  p_user_id uuid,
  p_lease_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claimed uuid;
  v_has_coin_pro boolean;
begin
  if not public.exchange_operations_enabled() then
    return false;
  end if;
  v_has_coin_pro := public.exchange_user_has_coin_pro(p_user_id);
  if not v_has_coin_pro then
    return false;
  end if;
  update public.exchange_connections connection
  set status = 'syncing',
      sync_lease_token = p_lease_token,
      sync_lease_until = now() + interval '5 minutes',
      last_error_code = null,
      history_days = connection.history_days,
      first_sync_from = connection.first_sync_from
  where connection.id = p_connection_id
    and connection.user_id = p_user_id
    and connection.status <> 'disconnected'
    and (connection.sync_lease_until is null or connection.sync_lease_until < now())
    and not exists (
      select 1
      from public.account_deletion_requests deletion
      where deletion.user_id = p_user_id
        and deletion.status in ('pending', 'processing', 'failed')
    )
  returning connection.id into v_claimed;
  return v_claimed is not null;
end
$$;

drop function if exists public.claim_due_exchange_connections(integer, uuid);
create or replace function public.claim_due_exchange_connections(
  p_limit integer,
  p_lease_token uuid,
  p_allowed_user_ids uuid[]
)
returns table (
  id uuid,
  user_id uuid,
  provider text,
  history_days integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.exchange_operations_enabled() then
    return;
  end if;
  return query
  with ranked as (
    select
      connection.id,
      connection.user_id,
      row_number() over (
        partition by connection.user_id
        order by connection.created_at, connection.id
      ) as connection_rank,
      public.exchange_user_has_coin_pro(connection.user_id) as has_coin_pro
    from public.exchange_connections connection
    where connection.status <> 'disconnected'
  ),
  due as (
    select connection.id
    from public.exchange_connections connection
    join ranked on ranked.id = connection.id
    where ranked.has_coin_pro
      and (p_allowed_user_ids is null or connection.user_id = any(p_allowed_user_ids))
      and connection.next_sync_at <= now()
      and (connection.sync_lease_until is null or connection.sync_lease_until < now())
      and not exists (
        select 1
        from public.account_deletion_requests deletion
        where deletion.user_id = connection.user_id
          and deletion.status in ('pending', 'processing', 'failed')
      )
    order by connection.next_sync_at, connection.id
    for update of connection skip locked
    limit greatest(1, least(coalesce(p_limit, 8), 25))
  ),
  claimed as (
    update public.exchange_connections connection
    set status = 'syncing',
        sync_lease_token = p_lease_token,
        sync_lease_until = now() + interval '5 minutes',
        last_error_code = null,
        history_days = connection.history_days,
        first_sync_from = connection.first_sync_from
    from due
    join ranked on ranked.id = due.id
    where connection.id = due.id
    returning connection.id, connection.user_id, connection.provider, connection.history_days
  )
  select claimed.id, claimed.user_id, claimed.provider, claimed.history_days
  from claimed;
end
$$;

revoke all on function public.exchange_operations_enabled() from public, anon, authenticated;
revoke all on function public.guard_exchange_connection_operations() from public, anon, authenticated;
revoke all on function public.claim_exchange_connection(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.claim_due_exchange_connections(integer, uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.claim_exchange_connection(uuid, uuid, uuid) to service_role;
grant execute on function public.claim_due_exchange_connections(integer, uuid, uuid[]) to service_role;

comment on table public.exchange_feature_control is
  'Operator-controlled, fail-closed exchange mutation gate. Environment flags can further restrict but never bypass it.';
