-- Emergency fail-closed guard. The following entitlement migration installs the
-- final public/premium SELECT policies after the canonical ledger is available.
do $$
declare
  policy_record record;
begin
  if to_regclass('public.signals') is null then
    return;
  end if;

  alter table public.signals enable row level security;

  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'signals'
  loop
    execute format('drop policy if exists %I on public.signals', policy_record.policyname);
  end loop;

  revoke all privileges on table public.signals from public, anon, authenticated;
  grant select, insert, update, delete on table public.signals to service_role;
end
$$;
