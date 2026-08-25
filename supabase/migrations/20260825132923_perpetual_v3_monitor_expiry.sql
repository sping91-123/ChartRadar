create or replace function public.expire_perpetual_monitors(p_evaluator_version text)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_expired integer := 0;
begin
  with candidates as (
    select monitor.id,
           case
             when monitor.expires_at <= now() then 'monitor_expired'
             else 'engine_version_changed'
           end as reason
    from public.perpetual_scenario_monitors monitor
    left join public.perpetual_decision_snapshots snapshot on snapshot.id = monitor.snapshot_id
    where monitor.status in ('active', 'paused', 'paused_entitlement')
      and (
        monitor.expires_at <= now()
        or (
          nullif(trim(coalesce(p_evaluator_version, '')), '') is not null
          and snapshot.engine_version is distinct from left(trim(p_evaluator_version), 80)
        )
      )
  ), expired as (
    update public.perpetual_scenario_monitors monitor
    set status = 'expired', last_evaluated_at = now(), updated_at = now()
    from candidates
    where monitor.id = candidates.id
    returning monitor.snapshot_id, monitor.condition_id, candidates.reason
  ), recorded as (
    insert into public.perpetual_decision_outcomes (
      snapshot_id, condition_id, outcome, evaluator_version, evaluated_at, evidence
    )
    select snapshot_id, condition_id, 'expired', left(coalesce(p_evaluator_version, 'unknown'), 80), now(),
           jsonb_build_object('reason', reason)
    from expired
    on conflict (snapshot_id, condition_id, outcome) do nothing
    returning 1
  )
  select count(*) into v_expired from expired;
  return v_expired;
end
$$;

revoke all on function public.expire_perpetual_monitors(text) from public, anon, authenticated;
grant execute on function public.expire_perpetual_monitors(text) to service_role;
