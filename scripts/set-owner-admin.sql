-- Chart Radar 운영자 계정을 Supabase 권한 원천으로 설정합니다.
-- Supabase SQL Editor에서 한 번 실행하세요.

do $$
begin
  if not exists (
    select 1
    from auth.users
    where lower(email) = lower('sping91@gmail.com')
  ) then
    raise exception 'Supabase Auth에서 % 계정을 찾지 못했습니다. 먼저 해당 이메일로 로그인해 주세요.', 'sping91@gmail.com';
  end if;
end $$;

with owner_user as (
  select id, email, raw_user_meta_data
  from auth.users
  where lower(email) = lower('sping91@gmail.com')
  order by created_at desc
  limit 1
)
insert into public.profiles (id, email, display_name, avatar_url, plan)
select
  id,
  email,
  coalesce(raw_user_meta_data->>'name', raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
  coalesce(raw_user_meta_data->>'avatar_url', raw_user_meta_data->>'picture'),
  'admin'
from owner_user
on conflict (id) do update
set
  email = excluded.email,
  display_name = coalesce(excluded.display_name, public.profiles.display_name),
  avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
  plan = 'admin',
  updated_at = now();

select id, email, display_name, plan, updated_at
from public.profiles
where lower(email) = lower('sping91@gmail.com');
