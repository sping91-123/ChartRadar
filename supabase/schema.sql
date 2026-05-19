-- Chart Radar - Supabase phase 1 schema
-- Run this once in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  plan text not null default 'free' check (plan in ('free', 'member', 'premium', 'admin', 'crypto_monthly', 'crypto_yearly', 'stocks_monthly', 'stocks_yearly', 'bundle_monthly', 'bundle_yearly')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.journals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  bias text not null default '관망',
  note text not null default '',
  source text not null default 'manual' check (source in ('manual', 'chart', 'scout')),
  symbol text,
  timeframe text,
  verdict text,
  scout_snapshot jsonb,
  outcome text check (outcome in ('win', 'loss', 'breakeven', 'missed')),
  outcome_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.signals (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  timeframe text not null,
  bias text not null check (bias in ('long', 'short', 'neutral')),
  verdict text not null,
  summary text not null default '',
  payload jsonb not null default '{}'::jsonb,
  visibility text not null default 'member' check (visibility in ('public', 'member', 'premium')),
  triggered_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.video_markers (
  id uuid primary key default gen_random_uuid(),
  youtube_video_id text not null,
  video_title text,
  symbol text not null,
  timeframe text not null,
  marker_time timestamptz not null,
  label text not null,
  note text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'manual',
  status text not null default 'inactive' check (status in ('inactive', 'trialing', 'active', 'past_due', 'canceled')),
  plan text not null default 'free' check (plan in ('free', 'member', 'premium', 'crypto_monthly', 'crypto_yearly', 'stocks_monthly', 'stocks_yearly', 'bundle_monthly', 'bundle_yearly')),
  market_scope text not null default 'trial' check (market_scope in ('trial', 'crypto', 'stocks', 'bundle')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  provider_customer_id text,
  provider_subscription_id text,
  provider_order_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null default 'android' check (platform in ('android', 'ios', 'web')),
  provider text not null default 'fcm' check (provider in ('fcm', 'apns', 'webpush')),
  app_id text not null default 'com.staronlabs.chartradar',
  enabled boolean not null default true,
  markets text[] not null default array[]::text[],
  rule_ids text[] not null default array[]::text[],
  device_label text,
  last_registered_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_tokens_provider_platform_check check (
    (platform = 'android' and provider = 'fcm')
    or (platform = 'ios' and provider = 'apns')
    or (platform = 'web' and provider = 'webpush')
  )
);

create unique index if not exists subscriptions_provider_order_id_idx
on public.subscriptions(provider_order_id)
where provider_order_id is not null;

create unique index if not exists push_tokens_token_idx
on public.push_tokens(token);

create index if not exists push_tokens_user_enabled_idx
on public.push_tokens(user_id, enabled);

create index if not exists push_tokens_android_fcm_enabled_idx
on public.push_tokens(user_id, enabled, last_registered_at desc)
where platform = 'android' and provider = 'fcm';

create table if not exists public.push_alert_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  market text not null default 'crypto' check (market in ('crypto', 'stocks')),
  preset_id text not null,
  symbol text not null,
  mode text,
  timeframe text not null,
  side text not null check (side in ('long', 'short')),
  quality text not null check (quality in ('A', 'B', 'C')),
  score numeric not null default 0,
  headline text not null default '',
  enabled boolean not null default true,
  saved_at timestamptz not null default now(),
  last_matched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists push_alert_presets_user_preset_idx
on public.push_alert_presets(user_id, preset_id);

create index if not exists push_alert_presets_market_enabled_idx
on public.push_alert_presets(market, enabled);

create table if not exists public.push_alert_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  market text not null default 'crypto' check (market in ('crypto', 'stocks')),
  rule_id text not null,
  event_key text not null,
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists push_alert_events_user_event_idx
on public.push_alert_events(user_id, event_key);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_journals_updated_at on public.journals;
create trigger set_journals_updated_at
before update on public.journals
for each row execute function public.set_updated_at();

drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
create trigger set_subscriptions_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

drop trigger if exists set_push_tokens_updated_at on public.push_tokens;
create trigger set_push_tokens_updated_at
before update on public.push_tokens
for each row execute function public.set_updated_at();

drop trigger if exists set_push_alert_presets_updated_at on public.push_alert_presets;
create trigger set_push_alert_presets_updated_at
before update on public.push_alert_presets
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(excluded.display_name, profiles.display_name),
        avatar_url = coalesce(excluded.avatar_url, profiles.avatar_url);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.journals enable row level security;
alter table public.signals enable row level security;
alter table public.video_markers enable row level security;
alter table public.subscriptions enable row level security;
alter table public.push_tokens enable row level security;
alter table public.push_alert_presets enable row level security;
alter table public.push_alert_events enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
-- 결제 권한이 profiles.plan에 들어가므로 공개 클라이언트가 임의로 plan을 바꾸지 못하게 합니다.
-- 프로필 수정은 별도 서버 함수 또는 관리자 경로를 통해 열어 주세요.

drop policy if exists "journals_select_own" on public.journals;
create policy "journals_select_own"
on public.journals for select
using (auth.uid() = user_id);

drop policy if exists "journals_insert_own" on public.journals;
create policy "journals_insert_own"
on public.journals for insert
with check (auth.uid() = user_id);

drop policy if exists "journals_update_own" on public.journals;
create policy "journals_update_own"
on public.journals for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "journals_delete_own" on public.journals;
create policy "journals_delete_own"
on public.journals for delete
using (auth.uid() = user_id);

drop policy if exists "signals_public_or_authenticated" on public.signals;
create policy "signals_public_or_authenticated"
on public.signals for select
using (visibility = 'public' or auth.role() = 'authenticated');

drop policy if exists "video_markers_public_read" on public.video_markers;
create policy "video_markers_public_read"
on public.video_markers for select
using (true);

drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own"
on public.subscriptions for select
using (auth.uid() = user_id);

drop policy if exists "push_tokens_select_own" on public.push_tokens;
create policy "push_tokens_select_own"
on public.push_tokens for select
using (auth.uid() = user_id);

drop policy if exists "push_tokens_delete_own" on public.push_tokens;
create policy "push_tokens_delete_own"
on public.push_tokens for delete
using (auth.uid() = user_id);

drop policy if exists "push_alert_presets_select_own" on public.push_alert_presets;
create policy "push_alert_presets_select_own"
on public.push_alert_presets for select
using (auth.uid() = user_id);

drop policy if exists "push_alert_events_select_own" on public.push_alert_events;
create policy "push_alert_events_select_own"
on public.push_alert_events for select
using (auth.uid() = user_id);
