-- P0 hotfix: public clients must never update profile entitlement columns.
-- On a fresh database the canonical reconciler creates profiles later, so this
-- emergency migration deliberately becomes a safe no-op.
do $migration$
begin
  if to_regclass('public.profiles') is null then
    return;
  end if;

  alter table public.profiles enable row level security;
  revoke update on table public.profiles from public, anon, authenticated;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'membership_tier'
  ) then
    execute 'revoke update (membership_tier) on table public.profiles from public, anon, authenticated';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'plan'
  ) then
    execute 'revoke update (plan) on table public.profiles from public, anon, authenticated';
  end if;

  drop policy if exists "본인 프로필 수정" on public.profiles;
  drop policy if exists "profiles_update_own" on public.profiles;
end
$migration$;
