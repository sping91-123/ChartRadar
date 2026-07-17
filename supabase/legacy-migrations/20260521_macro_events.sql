-- 공식 매크로 일정 동기화 결과를 저장하는 테이블입니다.

create extension if not exists pgcrypto;

create table if not exists public.macro_events (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_event_id text not null,
  event_type text not null check (event_type in ('numeric_release', 'document_release', 'meeting_event', 'speech_event', 'calendar_event')),
  title text not null,
  country text not null default 'US',
  category text not null default 'macro',
  importance integer not null default 1 check (importance in (1, 2, 3)),
  scheduled_at timestamptz not null,
  released_at timestamptz,
  status text not null check (
    status in (
      'scheduled',
      'imminent',
      'in_progress',
      'checking',
      'released',
      'document_released',
      'meeting_completed',
      'official_check_needed',
      'delayed',
      'stale',
      'past'
    )
  ),
  status_label text not null,
  actual_value text,
  consensus_value text,
  previous_value text,
  unit text,
  source_url text,
  official_url text,
  confidence numeric,
  stale_reason text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_event_id)
);

create index if not exists macro_events_scheduled_at_idx
on public.macro_events(scheduled_at);

create index if not exists macro_events_status_idx
on public.macro_events(status, scheduled_at);

create table if not exists public.macro_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  status text not null,
  fetched_count integer not null default 0,
  updated_count integer not null default 0,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists macro_sync_runs_started_at_idx
on public.macro_sync_runs(started_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_macro_events_updated_at on public.macro_events;
create trigger set_macro_events_updated_at
before update on public.macro_events
for each row execute function public.set_updated_at();

alter table public.macro_events enable row level security;
alter table public.macro_sync_runs enable row level security;
