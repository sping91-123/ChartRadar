-- Coters Survival Diagnosis - Supabase phase 1 schema
-- Run this once in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  plan text not null default 'free' check (plan in ('free', 'member', 'premium', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.journals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  bias text not null default '관망',
  note text not null default '',
  source text not null default 'manual' check (source in ('manual', 'chart')),
  symbol text,
  timeframe text,
  verdict text,
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
  plan text not null default 'free' check (plan in ('free', 'member', 'premium')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  provider_customer_id text,
  provider_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

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
