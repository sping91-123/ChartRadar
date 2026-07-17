alter table public.account_deletion_requests
  add column if not exists next_attempt_at timestamptz;

drop index if exists public.account_deletion_requests_queue_idx;
create index account_deletion_requests_queue_idx
  on public.account_deletion_requests (status, next_attempt_at, process_after, started_at, requested_at);

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
  return query
  select request.id, request.status, request.requested_at, request.process_after
  from public.account_deletion_requests request
  where request.user_id = p_user_id
    and request.status in ('pending', 'processing')
  order by request.requested_at desc
  limit 1;
  if found then
    return;
  end if;

  return query
  update public.account_deletion_requests request
  set status = 'pending',
      canceled_at = null,
      started_at = null,
      completed_at = null,
      next_attempt_at = null,
      last_error = null,
      updated_at = now()
  where request.id = (
    select failed.id
    from public.account_deletion_requests failed
    where failed.user_id = p_user_id
      and failed.status = 'failed'
    order by failed.requested_at desc
    limit 1
    for update
  )
  returning request.id, request.status, request.requested_at, request.process_after;
  if found then
    return;
  end if;

  insert into public.account_deletion_requests (user_id)
  values (p_user_id)
  on conflict do nothing;

  return query
  select request.id, request.status, request.requested_at, request.process_after
  from public.account_deletion_requests request
  where request.user_id = p_user_id
    and request.status in ('pending', 'processing', 'failed')
  order by request.requested_at desc
  limit 1;
end
$$;

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
      next_attempt_at = null,
      attempt_count = request.attempt_count + 1,
      last_error = null,
      updated_at = now()
  where request.id = p_request_id
    and (
      request.status = 'pending'
      or (
        request.status = 'failed'
        and coalesce(request.next_attempt_at, '-infinity'::timestamptz) <= now()
      )
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
      next_attempt_at = now() + (
        least(3600::numeric, 30::numeric * power(2::numeric, least(greatest(attempt_count - 1, 0), 7)))
        * interval '1 second'
      ),
      last_error = left(coalesce(p_error, 'unknown failure'), 500),
      updated_at = now()
  where id = p_request_id
    and status = 'processing';
end
$$;

revoke all on function public.request_account_deletion(uuid) from public, anon, authenticated;
revoke all on function public.start_account_deletion(uuid) from public, anon, authenticated;
revoke all on function public.fail_account_deletion(uuid, text) from public, anon, authenticated;
grant execute on function public.request_account_deletion(uuid) to service_role;
grant execute on function public.start_account_deletion(uuid) to service_role;
grant execute on function public.fail_account_deletion(uuid, text) to service_role;
