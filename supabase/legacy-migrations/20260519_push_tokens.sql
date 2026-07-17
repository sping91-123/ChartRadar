-- Android 앱 푸시 토큰 저장소.

create extension if not exists pgcrypto;

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
  updated_at timestamptz not null default now()
);

create unique index if not exists push_tokens_token_idx
on public.push_tokens(token);

create index if not exists push_tokens_user_enabled_idx
on public.push_tokens(user_id, enabled);

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

drop trigger if exists set_push_tokens_updated_at on public.push_tokens;
create trigger set_push_tokens_updated_at
before update on public.push_tokens
for each row execute function public.set_updated_at();

drop trigger if exists set_push_alert_presets_updated_at on public.push_alert_presets;
create trigger set_push_alert_presets_updated_at
before update on public.push_alert_presets
for each row execute function public.set_updated_at();

alter table public.push_tokens enable row level security;
alter table public.push_alert_presets enable row level security;
alter table public.push_alert_events enable row level security;

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
