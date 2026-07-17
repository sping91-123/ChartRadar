-- Android 앱 푸시와 향후 웹 푸시 토큰의 채널 구분을 보강한다.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'push_tokens_provider_platform_check'
  ) then
    alter table public.push_tokens
    add constraint push_tokens_provider_platform_check
    check (
      (platform = 'android' and provider = 'fcm')
      or (platform = 'ios' and provider = 'apns')
      or (platform = 'web' and provider = 'webpush')
    );
  end if;
end;
$$;

create index if not exists push_tokens_android_fcm_enabled_idx
on public.push_tokens(user_id, enabled, last_registered_at desc)
where platform = 'android' and provider = 'fcm';
