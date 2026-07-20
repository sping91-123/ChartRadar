-- Reconcile Journal columns that existed in the repository baseline but were
-- absent from some production-shaped databases. This migration is additive
-- and safe to replay.

alter table public.journals
  add column if not exists market text,
  add column if not exists scout_snapshot jsonb,
  add column if not exists outcome text,
  add column if not exists outcome_at timestamptz,
  add column if not exists updated_at timestamptz;

update public.journals
set updated_at = coalesce(created_at, now())
where updated_at is null;

alter table public.journals
  alter column updated_at set default now(),
  alter column updated_at set not null;

alter table public.journals
  drop constraint if exists journals_market_check;
alter table public.journals
  add constraint journals_market_check
  check (market is null or market in ('crypto', 'stocks'));

alter table public.journals
  drop constraint if exists journals_outcome_check;
alter table public.journals
  add constraint journals_outcome_check
  check (outcome is null or outcome in ('win', 'loss', 'breakeven', 'missed'));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_journals_updated_at on public.journals;
create trigger set_journals_updated_at
before update on public.journals
for each row execute function public.set_updated_at();
