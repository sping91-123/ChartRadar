-- 코인, 글로벌, 올마켓 결제 상품을 Supabase 권한 값으로 반영합니다.
alter table public.profiles
  drop constraint if exists profiles_plan_check;

alter table public.profiles
  add constraint profiles_plan_check
  check (plan in (
    'free',
    'member',
    'premium',
    'admin',
    'crypto_monthly',
    'crypto_yearly',
    'stocks_monthly',
    'stocks_yearly',
    'bundle_monthly',
    'bundle_yearly'
  ));

alter table public.subscriptions
  drop constraint if exists subscriptions_plan_check;

alter table public.subscriptions
  add constraint subscriptions_plan_check
  check (plan in (
    'free',
    'member',
    'premium',
    'crypto_monthly',
    'crypto_yearly',
    'stocks_monthly',
    'stocks_yearly',
    'bundle_monthly',
    'bundle_yearly'
  ));

alter table public.subscriptions
  add column if not exists market_scope text not null default 'trial';

alter table public.subscriptions
  drop constraint if exists subscriptions_market_scope_check;

alter table public.subscriptions
  add constraint subscriptions_market_scope_check
  check (market_scope in ('trial', 'crypto', 'stocks', 'bundle'));

alter table public.subscriptions
  add column if not exists provider_order_id text;

create index if not exists subscriptions_user_status_idx
  on public.subscriptions (user_id, status, current_period_end);

create unique index if not exists subscriptions_provider_order_id_idx
  on public.subscriptions (provider, provider_order_id)
  where provider_order_id is not null;

drop policy if exists "profiles_update_own" on public.profiles;

comment on column public.profiles.plan is
  'Chart Radar entitlement. Public clients must not update this value directly.';

comment on column public.subscriptions.plan is
  'Checkout product id such as crypto_monthly, stocks_monthly, or bundle_monthly.';
