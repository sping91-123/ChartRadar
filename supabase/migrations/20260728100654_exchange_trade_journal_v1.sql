create table if not exists public.exchange_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('okx', 'bybit', 'bitget', 'bingx', 'lbank')),
  product text not null default 'usdt_perpetual' check (product = 'usdt_perpetual'),
  label text not null default '',
  account_uid_hash text not null check (length(account_uid_hash) = 64),
  account_mode text not null default 'unknown',
  position_mode text not null default 'unknown' check (position_mode in ('one_way', 'hedge', 'unknown')),
  status text not null default 'syncing' check (
    status in (
      'syncing', 'ready', 'partial', 'permission_changed', 'ip_mismatch',
      'rate_limited', 'provider_unavailable', 'disconnected'
    )
  ),
  masked_api_key text not null,
  permission_summary jsonb not null default '{}'::jsonb,
  ip_whitelist text[] not null default array[]::text[],
  history_days integer not null default 30 check (history_days in (30, 90)),
  first_sync_from timestamptz not null,
  flat_baseline_at timestamptz not null,
  baseline_open_symbols text[] not null default array[]::text[],
  symbol_flat_baselines jsonb not null default '{}'::jsonb
    check (jsonb_typeof(symbol_flat_baselines) = 'object'),
  last_synced_at timestamptz,
  next_sync_at timestamptz not null default now(),
  sync_lease_token uuid,
  sync_lease_until timestamptz,
  sync_failure_count integer not null default 0 check (sync_failure_count >= 0),
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.exchange_credentials (
  connection_id uuid primary key references public.exchange_connections(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  encrypted_credentials text not null,
  encryption_iv text not null,
  authentication_tag text not null,
  key_version integer not null check (key_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exchange_order_contexts (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.exchange_connections(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('okx', 'bybit', 'bitget', 'bingx')),
  product text not null default 'usdt_perpetual' check (product = 'usdt_perpetual'),
  external_order_id text not null,
  symbol text not null,
  position_mode text not null check (position_mode in ('one_way', 'hedge', 'unknown')),
  position_side text not null check (position_side in ('net', 'long', 'short', 'unknown')),
  open_close text not null default 'unknown' check (open_close in ('open', 'close', 'mixed', 'unknown')),
  reduce_only boolean,
  payload_fingerprint text not null check (length(payload_fingerprint) = 64),
  observed_at timestamptz not null,
  updated_at timestamptz not null default now(),
  unique (connection_id, product, external_order_id)
);

create table if not exists public.exchange_trade_fills (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.exchange_connections(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('okx', 'bybit', 'bitget', 'bingx')),
  product text not null default 'usdt_perpetual' check (product = 'usdt_perpetual'),
  external_trade_id text not null,
  external_order_id text,
  symbol text not null,
  side text not null check (side in ('buy', 'sell')),
  position_mode text not null check (position_mode in ('one_way', 'hedge', 'unknown')),
  position_side text not null check (position_side in ('net', 'long', 'short', 'unknown')),
  open_close text not null default 'unknown' check (open_close in ('open', 'close', 'mixed', 'unknown')),
  reduce_only boolean,
  quantity_base numeric(38, 18) not null check (quantity_base > 0),
  quantity_contracts numeric(38, 18),
  contract_multiplier numeric(38, 18),
  price numeric(38, 18) not null check (price > 0),
  quote_notional numeric(38, 18) not null,
  provider_realized_pnl numeric(38, 18),
  fee_native_signed numeric(38, 18) not null default 0,
  fee_currency text not null,
  fee_quote_signed numeric(38, 18),
  executed_at timestamptz not null,
  provider_sequence text,
  execution_type text not null check (execution_type in ('trade', 'liquidation', 'adl', 'delivery', 'other')),
  payload_fingerprint text not null check (length(payload_fingerprint) = 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, product, external_trade_id)
);

create table if not exists public.exchange_cashflows (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.exchange_connections(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('okx', 'bybit', 'bitget', 'bingx')),
  external_cashflow_id text not null,
  symbol text,
  position_side text not null check (position_side in ('net', 'long', 'short', 'unknown')),
  cashflow_type text not null check (
    cashflow_type in ('trade_fee', 'funding', 'liquidation_fee', 'adl', 'settlement', 'transfer', 'other')
  ),
  amount_signed numeric(38, 18) not null,
  currency text not null,
  amount_quote_signed numeric(38, 18),
  occurred_at timestamptz not null,
  related_trade_id text,
  related_order_id text,
  allocation_status text not null check (allocation_status in ('allocated', 'unallocated', 'ambiguous')),
  reconciliation_only boolean not null default false,
  payload_fingerprint text not null check (length(payload_fingerprint) = 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, external_cashflow_id)
);

create table if not exists public.exchange_trade_positions (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.exchange_connections(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position_fingerprint text not null check (length(position_fingerprint) = 64),
  provider text not null check (provider in ('okx', 'bybit', 'bitget', 'bingx')),
  round_trip_key text not null,
  symbol text not null,
  position_side text not null check (position_side in ('long', 'short')),
  opened_at timestamptz not null,
  closed_at timestamptz not null,
  quantity_base numeric(38, 18) not null check (quantity_base > 0),
  average_entry_price numeric(38, 18) not null,
  average_exit_price numeric(38, 18) not null,
  realized_pnl numeric(38, 18) not null,
  provider_realized_pnl numeric(38, 18),
  fee_total numeric(38, 18) not null default 0,
  funding_total numeric(38, 18) not null default 0,
  net_pnl numeric(38, 18) not null,
  exit_reason text not null check (exit_reason in ('trade', 'liquidation', 'adl', 'delivery')),
  fill_count integer not null check (fill_count > 0),
  calculation_version text not null check (calculation_version = 'round_trip_v1'),
  quality text not null check (quality in ('complete', 'partial')),
  warnings text[] not null default array[]::text[],
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, round_trip_key)
);

create table if not exists public.exchange_trade_assessments (
  position_id uuid primary key,
  connection_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('ready', 'insufficient_data', 'market_data_unavailable')),
  evaluation_version text not null check (evaluation_version = 'market_context_v1'),
  position_fingerprint text not null check (length(position_fingerprint) = 64),
  input_fingerprint text not null check (length(input_fingerprint) = 64),
  market_provider text not null check (market_provider in ('okx', 'bybit', 'bitget', 'bingx')),
  market_symbol text not null check (length(market_symbol) between 1 and 80),
  primary_timeframe text not null check (primary_timeframe in ('1m', '5m', '15m', '1h', '4h')),
  context_timeframe text not null check (context_timeframe in ('5m', '15m', '1h', '4h', '1d')),
  requested_from timestamptz not null,
  requested_until timestamptz not null check (requested_until >= requested_from),
  coverage_ratio numeric(8, 6) not null check (coverage_ratio between 0 and 1),
  expected_bars integer not null check (expected_bars >= 0 and expected_bars <= 2000),
  observed_bars integer not null check (observed_bars >= 0 and observed_bars <= 2000),
  max_gap_bars integer not null check (max_gap_bars >= 0 and max_gap_bars <= 2000),
  confidence text not null check (confidence in ('high', 'medium', 'low', 'unavailable')),
  entry_score smallint check (entry_score between 0 and 100),
  entry_grade text check (entry_grade in ('a', 'b', 'c', 'd')),
  exit_score smallint check (exit_score between 0 and 100),
  exit_grade text check (exit_grade in ('a', 'b', 'c', 'd')),
  holding_seconds bigint not null check (holding_seconds >= 0),
  duration_class text not null check (duration_class in ('ultra_short', 'short', 'intraday', 'swing', 'position')),
  significance text check (significance in ('meaningful', 'limited', 'noise')),
  post_exit_confirmation text not null check (
    post_exit_confirmation in ('reversal_after_exit', 'continued_after_exit', 'mixed', 'unavailable')
  ),
  metrics jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metrics) = 'object' and octet_length(metrics::text) <= 4000),
  entry_reasons text[] not null default array[]::text[] check (cardinality(entry_reasons) <= 12),
  exit_reasons text[] not null default array[]::text[] check (cardinality(exit_reasons) <= 12),
  significance_reasons text[] not null default array[]::text[] check (cardinality(significance_reasons) <= 12),
  warnings text[] not null default array[]::text[] check (cardinality(warnings) <= 12),
  next_retry_at timestamptz,
  attempt_count smallint not null default 1 check (attempt_count between 1 and 20),
  evaluated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (
      status = 'ready'
      and confidence in ('high', 'medium', 'low')
      and entry_score is not null
      and entry_grade is not null
      and significance is not null
    )
    or (
      status = 'insufficient_data'
      and confidence = 'low'
      and entry_score is null
      and entry_grade is null
      and exit_score is null
      and exit_grade is null
      and significance is null
      and post_exit_confirmation = 'unavailable'
      and next_retry_at is not null
    )
    or (
      status = 'market_data_unavailable'
      and confidence = 'unavailable'
      and entry_score is null
      and entry_grade is null
      and exit_score is null
      and exit_grade is null
      and significance is null
      and post_exit_confirmation = 'unavailable'
      and next_retry_at is not null
    )
  )
);

create table if not exists public.exchange_trade_reviews (
  id uuid primary key default gen_random_uuid(),
  position_id uuid not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  strategy_tags text[] not null default array[]::text[],
  kept_principles text[] not null default array[]::text[],
  broken_principles text[] not null default array[]::text[],
  next_checkpoint text not null default '',
  memo text not null default '',
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exchange_sync_checkpoints (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.exchange_connections(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  stream text not null check (stream in ('fills', 'cashflows', 'orders')),
  symbol text not null default '*',
  cursor jsonb not null default '{}'::jsonb,
  watermark timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, stream, symbol)
);

create table if not exists public.exchange_sync_runs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.exchange_connections(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (
    status in ('ready', 'partial', 'permission_changed', 'ip_mismatch', 'rate_limited', 'provider_unavailable')
  ),
  started_at timestamptz not null,
  completed_at timestamptz not null default now(),
  fill_count integer not null default 0 check (fill_count >= 0),
  cashflow_count integer not null default 0 check (cashflow_count >= 0),
  position_count integer not null default 0 check (position_count >= 0),
  error_code text,
  warnings text[] not null default array[]::text[]
);

alter table public.journals
  add column if not exists trade_position_id uuid references public.exchange_trade_positions(id) on delete set null;
alter table public.journals drop constraint if exists journals_source_check;
alter table public.journals add constraint journals_source_check
  check (source is null or source in ('manual', 'chart', 'scout', 'snapshot', 'alert', 'news', 'exchange'));

create index if not exists exchange_connections_due_idx
  on public.exchange_connections (next_sync_at, sync_lease_until)
  where status <> 'disconnected';
create index if not exists exchange_connections_user_idx
  on public.exchange_connections (user_id, created_at);
create unique index if not exists exchange_connections_one_active_provider_idx
  on public.exchange_connections (user_id, provider)
  where status <> 'disconnected';
create index if not exists exchange_credentials_user_idx
  on public.exchange_credentials (user_id);
create index if not exists exchange_order_contexts_user_time_idx
  on public.exchange_order_contexts (user_id, observed_at desc);
create index if not exists exchange_trade_fills_user_time_idx
  on public.exchange_trade_fills (user_id, executed_at desc);
create index if not exists exchange_trade_fills_connection_symbol_time_idx
  on public.exchange_trade_fills (connection_id, symbol, executed_at);
create index if not exists exchange_cashflows_connection_time_idx
  on public.exchange_cashflows (connection_id, occurred_at);
create index if not exists exchange_trade_positions_user_closed_idx
  on public.exchange_trade_positions (user_id, closed_at desc)
  where is_current;
create index if not exists exchange_trade_positions_connection_symbol_idx
  on public.exchange_trade_positions (connection_id, symbol, closed_at);
create index if not exists exchange_trade_assessments_user_time_idx
  on public.exchange_trade_assessments (user_id, evaluated_at desc);
create index if not exists exchange_trade_assessments_retry_idx
  on public.exchange_trade_assessments (next_retry_at)
  where status = 'market_data_unavailable';
create index if not exists exchange_trade_reviews_user_idx
  on public.exchange_trade_reviews (user_id, reviewed_at desc);
create index if not exists exchange_sync_runs_user_time_idx
  on public.exchange_sync_runs (user_id, completed_at desc);
create index if not exists exchange_sync_runs_connection_idx
  on public.exchange_sync_runs (connection_id);
create index if not exists journals_trade_position_idx
  on public.journals (trade_position_id)
  where trade_position_id is not null;
create unique index if not exists journals_exchange_trade_position_unique_idx
  on public.journals (trade_position_id)
  where source = 'exchange' and trade_position_id is not null;

alter table public.exchange_credentials
  drop constraint if exists exchange_credentials_connection_owner_fkey;
alter table public.exchange_credentials
  add constraint exchange_credentials_connection_owner_fkey
  foreign key (connection_id, user_id)
  references public.exchange_connections(id, user_id)
  on delete cascade;
alter table public.exchange_order_contexts
  drop constraint if exists exchange_order_contexts_connection_owner_fkey;
alter table public.exchange_order_contexts
  add constraint exchange_order_contexts_connection_owner_fkey
  foreign key (connection_id, user_id)
  references public.exchange_connections(id, user_id)
  on delete cascade;
alter table public.exchange_trade_fills
  drop constraint if exists exchange_trade_fills_connection_owner_fkey;
alter table public.exchange_trade_fills
  add constraint exchange_trade_fills_connection_owner_fkey
  foreign key (connection_id, user_id)
  references public.exchange_connections(id, user_id)
  on delete cascade;
alter table public.exchange_cashflows
  drop constraint if exists exchange_cashflows_connection_owner_fkey;
alter table public.exchange_cashflows
  add constraint exchange_cashflows_connection_owner_fkey
  foreign key (connection_id, user_id)
  references public.exchange_connections(id, user_id)
  on delete cascade;
create unique index if not exists exchange_trade_positions_id_user_unique
  on public.exchange_trade_positions (id, user_id);
create unique index if not exists exchange_trade_positions_id_connection_user_unique
  on public.exchange_trade_positions (id, connection_id, user_id);
alter table public.exchange_trade_positions
  drop constraint if exists exchange_trade_positions_connection_owner_fkey;
alter table public.exchange_trade_positions
  add constraint exchange_trade_positions_connection_owner_fkey
  foreign key (connection_id, user_id)
  references public.exchange_connections(id, user_id)
  on delete cascade;
alter table public.exchange_trade_assessments
  drop constraint if exists exchange_trade_assessments_position_owner_fkey;
alter table public.exchange_trade_assessments
  add constraint exchange_trade_assessments_position_owner_fkey
  foreign key (position_id, connection_id, user_id)
  references public.exchange_trade_positions(id, connection_id, user_id)
  on delete cascade;
alter table public.exchange_trade_assessments
  drop constraint if exists exchange_trade_assessments_connection_owner_fkey;
alter table public.exchange_trade_reviews
  drop constraint if exists exchange_trade_reviews_position_owner_fkey;
alter table public.exchange_trade_reviews
  add constraint exchange_trade_reviews_position_owner_fkey
  foreign key (position_id, user_id)
  references public.exchange_trade_positions(id, user_id)
  on delete cascade;
alter table public.exchange_sync_checkpoints
  drop constraint if exists exchange_sync_checkpoints_connection_owner_fkey;
alter table public.exchange_sync_checkpoints
  add constraint exchange_sync_checkpoints_connection_owner_fkey
  foreign key (connection_id, user_id)
  references public.exchange_connections(id, user_id)
  on delete cascade;
alter table public.exchange_sync_runs
  drop constraint if exists exchange_sync_runs_connection_owner_fkey;
alter table public.exchange_sync_runs
  add constraint exchange_sync_runs_connection_owner_fkey
  foreign key (connection_id, user_id)
  references public.exchange_connections(id, user_id)
  on delete cascade;

alter table public.exchange_connections enable row level security;
alter table public.exchange_credentials enable row level security;
alter table public.exchange_order_contexts enable row level security;
alter table public.exchange_trade_fills enable row level security;
alter table public.exchange_cashflows enable row level security;
alter table public.exchange_trade_positions enable row level security;
alter table public.exchange_trade_assessments enable row level security;
alter table public.exchange_trade_reviews enable row level security;
alter table public.exchange_sync_checkpoints enable row level security;
alter table public.exchange_sync_runs enable row level security;

drop policy if exists "exchange_connections_select_own" on public.exchange_connections;
create policy "exchange_connections_select_own"
  on public.exchange_connections for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "exchange_credentials_service_only" on public.exchange_credentials;
create policy "exchange_credentials_service_only"
  on public.exchange_credentials for all to service_role
  using (true) with check (true);
drop policy if exists "exchange_order_contexts_select_own" on public.exchange_order_contexts;
create policy "exchange_order_contexts_select_own"
  on public.exchange_order_contexts for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "exchange_trade_fills_select_own" on public.exchange_trade_fills;
create policy "exchange_trade_fills_select_own"
  on public.exchange_trade_fills for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "exchange_cashflows_select_own" on public.exchange_cashflows;
create policy "exchange_cashflows_select_own"
  on public.exchange_cashflows for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "exchange_trade_positions_select_own" on public.exchange_trade_positions;
create policy "exchange_trade_positions_select_own"
  on public.exchange_trade_positions for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "exchange_trade_assessments_service_only" on public.exchange_trade_assessments;
create policy "exchange_trade_assessments_service_only"
  on public.exchange_trade_assessments for all to service_role
  using (true) with check (true);
drop policy if exists "exchange_trade_reviews_select_own" on public.exchange_trade_reviews;
create policy "exchange_trade_reviews_select_own"
  on public.exchange_trade_reviews for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "exchange_sync_checkpoints_service_only" on public.exchange_sync_checkpoints;
create policy "exchange_sync_checkpoints_service_only"
  on public.exchange_sync_checkpoints for all to service_role
  using (true) with check (true);
drop policy if exists "exchange_sync_runs_select_own" on public.exchange_sync_runs;
create policy "exchange_sync_runs_select_own"
  on public.exchange_sync_runs for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all privileges on table public.exchange_connections from public, anon, authenticated, service_role;
revoke all privileges on table public.exchange_credentials from public, anon, authenticated, service_role;
revoke all privileges on table public.exchange_order_contexts from public, anon, authenticated, service_role;
revoke all privileges on table public.exchange_trade_fills from public, anon, authenticated, service_role;
revoke all privileges on table public.exchange_cashflows from public, anon, authenticated, service_role;
revoke all privileges on table public.exchange_trade_positions from public, anon, authenticated, service_role;
revoke all privileges on table public.exchange_trade_assessments from public, anon, authenticated, service_role;
revoke all privileges on table public.exchange_trade_reviews from public, anon, authenticated, service_role;
revoke all privileges on table public.exchange_sync_checkpoints from public, anon, authenticated, service_role;
revoke all privileges on table public.exchange_sync_runs from public, anon, authenticated, service_role;

grant select, insert, update, delete on table public.exchange_connections to service_role;
grant select, insert, update, delete on table public.exchange_credentials to service_role;
grant select, insert, update, delete on table public.exchange_order_contexts to service_role;
grant select, insert, update, delete on table public.exchange_trade_fills to service_role;
grant select, insert, update, delete on table public.exchange_cashflows to service_role;
grant select, insert, update, delete on table public.exchange_trade_positions to service_role;
grant select, insert, update, delete on table public.exchange_trade_assessments to service_role;
grant select, insert, update, delete on table public.exchange_trade_reviews to service_role;
grant select, insert, update, delete on table public.exchange_sync_checkpoints to service_role;
grant select, insert, update, delete on table public.exchange_sync_runs to service_role;

create or replace function public.set_exchange_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

create or replace function public.enforce_journal_trade_position_owner()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.trade_position_id is not null and not exists (
    select 1
    from public.exchange_trade_positions position
    where position.id = new.trade_position_id
      and position.user_id = new.user_id
  ) then
    raise exception 'journal trade position owner mismatch';
  end if;
  return new;
end
$$;

create or replace function public.exchange_user_has_coin_pro(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce((
      select account.raw_app_meta_data ->> 'role' = 'admin'
      from auth.users account
      where account.id = p_user_id
    ), false)
    or exists (
      select 1
      from public.subscriptions subscription
      where subscription.user_id = p_user_id
        and subscription.revoked_at is null
        and subscription.status in ('trialing', 'active', 'canceled')
        and subscription.current_period_end > now()
        and subscription.market_scope in ('crypto', 'bundle')
    )
$$;

drop trigger if exists journals_trade_position_owner_guard on public.journals;
create trigger journals_trade_position_owner_guard
before insert or update of trade_position_id, user_id on public.journals
for each row execute function public.enforce_journal_trade_position_owner();

drop trigger if exists set_exchange_connections_updated_at on public.exchange_connections;
create trigger set_exchange_connections_updated_at
before update on public.exchange_connections
for each row execute function public.set_exchange_updated_at();
drop trigger if exists set_exchange_credentials_updated_at on public.exchange_credentials;
create trigger set_exchange_credentials_updated_at
before update on public.exchange_credentials
for each row execute function public.set_exchange_updated_at();
drop trigger if exists set_exchange_order_contexts_updated_at on public.exchange_order_contexts;
create trigger set_exchange_order_contexts_updated_at
before update on public.exchange_order_contexts
for each row execute function public.set_exchange_updated_at();
drop trigger if exists set_exchange_trade_fills_updated_at on public.exchange_trade_fills;
create trigger set_exchange_trade_fills_updated_at
before update on public.exchange_trade_fills
for each row execute function public.set_exchange_updated_at();
drop trigger if exists set_exchange_cashflows_updated_at on public.exchange_cashflows;
create trigger set_exchange_cashflows_updated_at
before update on public.exchange_cashflows
for each row execute function public.set_exchange_updated_at();
drop trigger if exists set_exchange_trade_positions_updated_at on public.exchange_trade_positions;
create trigger set_exchange_trade_positions_updated_at
before update on public.exchange_trade_positions
for each row execute function public.set_exchange_updated_at();
drop trigger if exists set_exchange_trade_assessments_updated_at on public.exchange_trade_assessments;
create trigger set_exchange_trade_assessments_updated_at
before update on public.exchange_trade_assessments
for each row execute function public.set_exchange_updated_at();
drop trigger if exists set_exchange_trade_reviews_updated_at on public.exchange_trade_reviews;
create trigger set_exchange_trade_reviews_updated_at
before update on public.exchange_trade_reviews
for each row execute function public.set_exchange_updated_at();
drop trigger if exists set_exchange_sync_checkpoints_updated_at on public.exchange_sync_checkpoints;
create trigger set_exchange_sync_checkpoints_updated_at
before update on public.exchange_sync_checkpoints
for each row execute function public.set_exchange_updated_at();

create or replace function public.create_exchange_connection(
  p_id uuid,
  p_user_id uuid,
  p_provider text,
  p_label text,
  p_account_uid_hash text,
  p_account_mode text,
  p_position_mode text,
  p_masked_api_key text,
  p_permission_summary jsonb,
  p_ip_whitelist text[],
  p_history_days integer,
  p_first_sync_from timestamptz,
  p_flat_baseline_at timestamptz,
  p_baseline_open_symbols text[],
  p_connection_limit integer,
  p_encrypted_credentials text,
  p_encryption_iv text,
  p_authentication_tag text,
  p_key_version integer
)
returns table (id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_allowed_connection_limit integer;
  v_allowed_history_days integer;
  v_connection_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  if not public.exchange_user_has_coin_pro(p_user_id) then
    raise exception 'exchange coin pro required';
  end if;
  v_allowed_connection_limit := 5;
  v_allowed_history_days := 90;
  if p_provider not in ('okx', 'bybit', 'bitget', 'bingx') then
    raise exception 'exchange provider unavailable';
  end if;
  if p_history_days not in (30, 90) then raise exception 'invalid history window'; end if;
  if p_history_days > v_allowed_history_days or coalesce(p_connection_limit, 1) > v_allowed_connection_limit then
    raise exception 'exchange entitlement changed';
  end if;
  if exists (
    select 1
    from public.account_deletion_requests deletion
    where deletion.user_id = p_user_id
      and deletion.status in ('pending', 'processing', 'failed')
  ) then
    raise exception 'account deletion pending';
  end if;
  select count(*) into v_connection_count
  from public.exchange_connections connection
  where connection.user_id = p_user_id
    and connection.status <> 'disconnected';
  if v_connection_count >= greatest(1, least(coalesce(p_connection_limit, 1), v_allowed_connection_limit)) then
    raise exception 'exchange connection limit reached';
  end if;

  insert into public.exchange_connections (
    id, user_id, provider, label, account_uid_hash, account_mode, position_mode,
    status, masked_api_key, permission_summary, ip_whitelist, history_days, first_sync_from,
    flat_baseline_at, baseline_open_symbols
  )
  values (
    p_id, p_user_id, p_provider, left(coalesce(p_label, ''), 80), p_account_uid_hash,
    left(coalesce(p_account_mode, 'unknown'), 40), p_position_mode, 'syncing', p_masked_api_key,
    coalesce(p_permission_summary, '{}'::jsonb), coalesce(p_ip_whitelist, array[]::text[]),
    p_history_days, p_first_sync_from, p_flat_baseline_at,
    coalesce(p_baseline_open_symbols, array[]::text[])
  );

  insert into public.exchange_credentials (
    connection_id, user_id, encrypted_credentials, encryption_iv, authentication_tag, key_version
  )
  values (
    p_id, p_user_id, p_encrypted_credentials, p_encryption_iv, p_authentication_tag, p_key_version
  );
  return query select p_id;
end
$$;

create or replace function public.disconnect_exchange_connection(
  p_connection_id uuid,
  p_user_id uuid,
  p_delete_history boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changed uuid;
begin
  delete from public.exchange_credentials credential
  where credential.connection_id = p_connection_id
    and credential.user_id = p_user_id;

  if p_delete_history then
    delete from public.journals journal
    where journal.user_id = p_user_id
      and journal.source = 'exchange'
      and journal.trade_position_id in (
        select position.id
        from public.exchange_trade_positions position
        where position.connection_id = p_connection_id
          and position.user_id = p_user_id
      );
    delete from public.exchange_connections connection
    where connection.id = p_connection_id
      and connection.user_id = p_user_id
    returning connection.id into v_changed;
  else
    update public.exchange_connections connection
    set status = 'disconnected',
        sync_lease_token = null,
        sync_lease_until = null,
        next_sync_at = now() + interval '100 years',
        permission_summary = '{}'::jsonb,
        ip_whitelist = array[]::text[],
        last_error_code = null
    where connection.id = p_connection_id
      and connection.user_id = p_user_id
    returning connection.id into v_changed;
  end if;
  return v_changed is not null;
end
$$;

create or replace function public.claim_exchange_connection(
  p_connection_id uuid,
  p_user_id uuid,
  p_lease_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claimed uuid;
  v_has_coin_pro boolean;
begin
  v_has_coin_pro := public.exchange_user_has_coin_pro(p_user_id);
  if not v_has_coin_pro then
    return false;
  end if;
  update public.exchange_connections connection
  set status = 'syncing',
      sync_lease_token = p_lease_token,
      sync_lease_until = now() + interval '5 minutes',
      last_error_code = null,
      history_days = connection.history_days,
      first_sync_from = connection.first_sync_from
  where connection.id = p_connection_id
    and connection.user_id = p_user_id
    and connection.status <> 'disconnected'
    and (connection.sync_lease_until is null or connection.sync_lease_until < now())
    and not exists (
      select 1
      from public.account_deletion_requests deletion
      where deletion.user_id = p_user_id
        and deletion.status in ('pending', 'processing', 'failed')
    )
  returning connection.id into v_claimed;
  return v_claimed is not null;
end
$$;

create or replace function public.claim_due_exchange_connections(
  p_limit integer,
  p_lease_token uuid
)
returns table (
  id uuid,
  user_id uuid,
  provider text,
  history_days integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with ranked as (
    select
      connection.id,
      connection.user_id,
      row_number() over (
        partition by connection.user_id
        order by connection.created_at, connection.id
      ) as connection_rank,
      public.exchange_user_has_coin_pro(connection.user_id) as has_coin_pro
    from public.exchange_connections connection
    where connection.status <> 'disconnected'
  ),
  due as (
    select connection.id
    from public.exchange_connections connection
    join ranked on ranked.id = connection.id
    where ranked.has_coin_pro
      and connection.next_sync_at <= now()
      and (connection.sync_lease_until is null or connection.sync_lease_until < now())
      and not exists (
        select 1
        from public.account_deletion_requests deletion
        where deletion.user_id = connection.user_id
          and deletion.status in ('pending', 'processing', 'failed')
      )
    order by connection.next_sync_at, connection.id
    for update of connection skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 25))
  ),
  claimed as (
    update public.exchange_connections connection
    set status = 'syncing',
        sync_lease_token = p_lease_token,
        sync_lease_until = now() + interval '5 minutes',
        last_error_code = null,
        history_days = connection.history_days,
        first_sync_from = connection.first_sync_from
    from due
    join ranked on ranked.id = due.id
    where connection.id = due.id
    returning connection.id, connection.user_id, connection.provider, connection.history_days
  )
  select claimed.id, claimed.user_id, claimed.provider, claimed.history_days
  from claimed;
end
$$;

create or replace function public.commit_exchange_sync_batch(
  p_connection_id uuid,
  p_user_id uuid,
  p_lease_token uuid,
  p_started_at timestamptz,
  p_status text,
  p_stream text,
  p_symbol text,
  p_cursor jsonb,
  p_watermark timestamptz,
  p_orders jsonb,
  p_fills jsonb,
  p_cashflows jsonb,
  p_positions jsonb,
  p_symbol_flat_baselines jsonb,
  p_warnings text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection public.exchange_connections%rowtype;
  v_has_coin_pro boolean;
  v_order_count integer := 0;
  v_fill_count integer := 0;
  v_cashflow_count integer := 0;
  v_position_count integer := 0;
begin
  if p_status not in ('ready', 'partial') then
    raise exception 'invalid exchange sync status';
  end if;
  if p_stream not in ('fills', 'cashflows', 'orders') then
    raise exception 'invalid exchange sync stream';
  end if;

  select * into v_connection
  from public.exchange_connections connection
  where connection.id = p_connection_id
    and connection.user_id = p_user_id
    and connection.sync_lease_token = p_lease_token
    and connection.sync_lease_until >= now()
  for update;
  if not found then raise exception 'exchange sync lease not found'; end if;
  v_has_coin_pro := public.exchange_user_has_coin_pro(p_user_id);
  if not v_has_coin_pro then
    raise exception 'exchange coin pro required';
  end if;
  if exists (
    select 1
    from public.account_deletion_requests deletion
    where deletion.user_id = p_user_id
      and deletion.status in ('pending', 'processing', 'failed')
  ) then
    raise exception 'account deletion pending';
  end if;

  insert into public.exchange_order_contexts (
    connection_id, user_id, provider, external_order_id, symbol, position_mode,
    position_side, open_close, reduce_only, payload_fingerprint, observed_at
  )
  select
    p_connection_id, p_user_id, v_connection.provider, row.external_order_id, row.symbol,
    row.position_mode, row.position_side, row.open_close, row.reduce_only, row.payload_fingerprint, row.observed_at
  from jsonb_to_recordset(coalesce(p_orders, '[]'::jsonb)) as row(
    external_order_id text,
    symbol text,
    position_mode text,
    position_side text,
    open_close text,
    reduce_only boolean,
    payload_fingerprint text,
    observed_at timestamptz
  )
  on conflict (connection_id, product, external_order_id) do update set
    symbol = excluded.symbol,
    position_mode = excluded.position_mode,
    position_side = excluded.position_side,
    open_close = excluded.open_close,
    reduce_only = excluded.reduce_only,
    payload_fingerprint = excluded.payload_fingerprint,
    observed_at = excluded.observed_at;
  get diagnostics v_order_count = row_count;

  insert into public.exchange_trade_fills (
    connection_id, user_id, provider, external_trade_id, external_order_id, symbol, side,
    position_mode, position_side, open_close, reduce_only, quantity_base, quantity_contracts,
    contract_multiplier, price, quote_notional, provider_realized_pnl, fee_native_signed,
    fee_currency, fee_quote_signed, executed_at, provider_sequence, execution_type, payload_fingerprint
  )
  select
    p_connection_id, p_user_id, v_connection.provider, row.external_trade_id, row.external_order_id,
    row.symbol, row.side, row.position_mode, row.position_side, row.open_close, row.reduce_only, row.quantity_base,
    row.quantity_contracts, row.contract_multiplier, row.price, row.quote_notional,
    row.provider_realized_pnl, row.fee_native_signed, row.fee_currency, row.fee_quote_signed,
    row.executed_at, row.provider_sequence, row.execution_type, row.payload_fingerprint
  from jsonb_to_recordset(coalesce(p_fills, '[]'::jsonb)) as row(
    external_trade_id text,
    external_order_id text,
    symbol text,
    side text,
    position_mode text,
    position_side text,
    open_close text,
    reduce_only boolean,
    quantity_base numeric,
    quantity_contracts numeric,
    contract_multiplier numeric,
    price numeric,
    quote_notional numeric,
    provider_realized_pnl numeric,
    fee_native_signed numeric,
    fee_currency text,
    fee_quote_signed numeric,
    executed_at timestamptz,
    provider_sequence text,
    execution_type text,
    payload_fingerprint text
  )
  on conflict (connection_id, product, external_trade_id) do update set
    external_order_id = excluded.external_order_id,
    symbol = excluded.symbol,
    side = excluded.side,
    position_mode = excluded.position_mode,
    position_side = excluded.position_side,
    open_close = excluded.open_close,
    reduce_only = excluded.reduce_only,
    quantity_base = excluded.quantity_base,
    quantity_contracts = excluded.quantity_contracts,
    contract_multiplier = excluded.contract_multiplier,
    price = excluded.price,
    quote_notional = excluded.quote_notional,
    provider_realized_pnl = excluded.provider_realized_pnl,
    fee_native_signed = excluded.fee_native_signed,
    fee_currency = excluded.fee_currency,
    fee_quote_signed = excluded.fee_quote_signed,
    executed_at = excluded.executed_at,
    provider_sequence = excluded.provider_sequence,
    execution_type = excluded.execution_type,
    payload_fingerprint = excluded.payload_fingerprint;
  get diagnostics v_fill_count = row_count;

  insert into public.exchange_cashflows (
    connection_id, user_id, provider, external_cashflow_id, symbol, position_side,
    cashflow_type, amount_signed, currency, amount_quote_signed, occurred_at,
    related_trade_id, related_order_id, allocation_status, reconciliation_only, payload_fingerprint
  )
  select
    p_connection_id, p_user_id, v_connection.provider, row.external_cashflow_id, row.symbol,
    row.position_side, row.cashflow_type, row.amount_signed, row.currency, row.amount_quote_signed,
    row.occurred_at, row.related_trade_id, row.related_order_id, row.allocation_status,
    row.reconciliation_only, row.payload_fingerprint
  from jsonb_to_recordset(coalesce(p_cashflows, '[]'::jsonb)) as row(
    external_cashflow_id text,
    symbol text,
    position_side text,
    cashflow_type text,
    amount_signed numeric,
    currency text,
    amount_quote_signed numeric,
    occurred_at timestamptz,
    related_trade_id text,
    related_order_id text,
    allocation_status text,
    reconciliation_only boolean,
    payload_fingerprint text
  )
  on conflict (connection_id, external_cashflow_id) do update set
    symbol = excluded.symbol,
    position_side = excluded.position_side,
    cashflow_type = excluded.cashflow_type,
    amount_signed = excluded.amount_signed,
    currency = excluded.currency,
    amount_quote_signed = excluded.amount_quote_signed,
    occurred_at = excluded.occurred_at,
    related_trade_id = excluded.related_trade_id,
    related_order_id = excluded.related_order_id,
    allocation_status = excluded.allocation_status,
    reconciliation_only = excluded.reconciliation_only,
    payload_fingerprint = excluded.payload_fingerprint;
  get diagnostics v_cashflow_count = row_count;

  update public.exchange_trade_positions position
  set is_current = false
  where position.connection_id = p_connection_id
    and position.user_id = p_user_id;

  insert into public.exchange_trade_positions (
    connection_id, user_id, position_fingerprint, provider, round_trip_key, symbol, position_side, opened_at, closed_at,
    quantity_base, average_entry_price, average_exit_price, realized_pnl, provider_realized_pnl,
    fee_total, funding_total, net_pnl, exit_reason, fill_count, calculation_version, quality, warnings,
    is_current
  )
  select
    p_connection_id, p_user_id, row.position_fingerprint, v_connection.provider, row.round_trip_key, row.symbol,
    row.position_side, row.opened_at, row.closed_at, row.quantity_base, row.average_entry_price,
    row.average_exit_price, row.realized_pnl, row.provider_realized_pnl, row.fee_total,
    row.funding_total, row.net_pnl, row.exit_reason, row.fill_count, row.calculation_version,
    row.quality, coalesce(row.warnings, array[]::text[]), true
  from jsonb_to_recordset(coalesce(p_positions, '[]'::jsonb)) as row(
    position_fingerprint text,
    round_trip_key text,
    symbol text,
    position_side text,
    opened_at timestamptz,
    closed_at timestamptz,
    quantity_base numeric,
    average_entry_price numeric,
    average_exit_price numeric,
    realized_pnl numeric,
    provider_realized_pnl numeric,
    fee_total numeric,
    funding_total numeric,
    net_pnl numeric,
    exit_reason text,
    fill_count integer,
    calculation_version text,
    quality text,
    warnings text[]
  )
  on conflict (connection_id, round_trip_key) do update set
    position_fingerprint = excluded.position_fingerprint,
    symbol = excluded.symbol,
    position_side = excluded.position_side,
    opened_at = excluded.opened_at,
    closed_at = excluded.closed_at,
    quantity_base = excluded.quantity_base,
    average_entry_price = excluded.average_entry_price,
    average_exit_price = excluded.average_exit_price,
    realized_pnl = excluded.realized_pnl,
    provider_realized_pnl = excluded.provider_realized_pnl,
    fee_total = excluded.fee_total,
    funding_total = excluded.funding_total,
    net_pnl = excluded.net_pnl,
    exit_reason = excluded.exit_reason,
    fill_count = excluded.fill_count,
    calculation_version = excluded.calculation_version,
    quality = excluded.quality,
    warnings = excluded.warnings,
    is_current = true;
  get diagnostics v_position_count = row_count;

  delete from public.exchange_trade_assessments assessment
  using public.exchange_trade_positions position
  where position.id = assessment.position_id
    and position.connection_id = p_connection_id
    and position.user_id = p_user_id
    and (
      position.quality <> 'complete'
      or assessment.position_fingerprint <> position.position_fingerprint
    );

  insert into public.exchange_sync_checkpoints (
    connection_id, user_id, stream, symbol, cursor, watermark
  )
  values (
    p_connection_id, p_user_id, p_stream, coalesce(nullif(p_symbol, ''), '*'),
    coalesce(p_cursor, '{}'::jsonb), p_watermark
  )
  on conflict (connection_id, stream, symbol) do update set
    cursor = excluded.cursor,
    watermark = excluded.watermark;

  update public.exchange_connections connection
  set status = p_status,
      last_synced_at = now(),
      next_sync_at = now() + interval '15 minutes',
      sync_lease_token = null,
      sync_lease_until = null,
      sync_failure_count = 0,
      last_error_code = null,
      symbol_flat_baselines = coalesce(p_symbol_flat_baselines, connection.symbol_flat_baselines)
  where connection.id = p_connection_id
    and connection.user_id = p_user_id
    and connection.sync_lease_token = p_lease_token;

  insert into public.exchange_sync_runs (
    connection_id, user_id, status, started_at, fill_count, cashflow_count,
    position_count, warnings
  )
  values (
    p_connection_id, p_user_id, p_status, p_started_at, v_fill_count, v_cashflow_count,
    v_position_count, coalesce(p_warnings, array[]::text[])
  );

  return jsonb_build_object(
    'orders', v_order_count,
    'fills', v_fill_count,
    'cashflows', v_cashflow_count,
    'positions', v_position_count
  );
end
$$;

create or replace function public.list_due_exchange_trade_assessment_positions(
  p_user_id uuid,
  p_connection_id uuid,
  p_now timestamptz,
  p_limit integer
)
returns setof public.exchange_trade_positions
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.exchange_user_has_coin_pro(p_user_id) then
    raise exception 'exchange coin pro required';
  end if;
  if exists (
    select 1
    from public.account_deletion_requests deletion
    where deletion.user_id = p_user_id
      and deletion.status in ('pending', 'processing', 'failed')
  ) then
    raise exception 'account deletion pending';
  end if;
  if not exists (
    select 1
    from public.exchange_connections connection
    where connection.id = p_connection_id
      and connection.user_id = p_user_id
      and connection.status <> 'disconnected'
  ) then
    raise exception 'active exchange connection not found';
  end if;

  return query
  select position.*
  from public.exchange_trade_positions position
  left join public.exchange_trade_assessments assessment
    on assessment.position_id = position.id
  where position.user_id = p_user_id
    and position.connection_id = p_connection_id
    and position.is_current
    and position.quality = 'complete'
    and (
      assessment.position_id is null
      or assessment.position_fingerprint <> position.position_fingerprint
      or assessment.evaluation_version <> 'market_context_v1'
      or (
        assessment.next_retry_at is not null
        and assessment.next_retry_at <= coalesce(p_now, now())
        and assessment.attempt_count < 12
      )
    )
  order by
    case when assessment.position_id is null then 0 else 1 end,
    position.closed_at desc
  limit greatest(1, least(coalesce(p_limit, 2), 10));
end
$$;

create or replace function public.upsert_exchange_trade_assessment(
  p_position_id uuid,
  p_connection_id uuid,
  p_user_id uuid,
  p_position_fingerprint text,
  p_assessment jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_position public.exchange_trade_positions%rowtype;
  v_existing public.exchange_trade_assessments%rowtype;
  v_status text := p_assessment ->> 'status';
  v_metrics jsonb := coalesce(p_assessment -> 'metrics', '{}'::jsonb);
  v_entry_reasons text[];
  v_exit_reasons text[];
  v_significance_reasons text[];
  v_warnings text[];
  v_upsert_count integer := 0;
begin
  if not public.exchange_user_has_coin_pro(p_user_id) then
    raise exception 'exchange coin pro required';
  end if;
  if exists (
    select 1
    from public.account_deletion_requests deletion
    where deletion.user_id = p_user_id
      and deletion.status in ('pending', 'processing', 'failed')
  ) then
    raise exception 'account deletion pending';
  end if;
  select * into v_position
  from public.exchange_trade_positions position
  where position.id = p_position_id
    and position.connection_id = p_connection_id
    and position.user_id = p_user_id
    and position.is_current
  for update;
  if not found then raise exception 'current exchange position not found'; end if;
  if v_position.quality <> 'complete' then
    raise exception 'complete exchange position required';
  end if;
  if length(coalesce(p_position_fingerprint, '')) <> 64
     or p_position_fingerprint <> v_position.position_fingerprint then
    raise exception 'stale exchange position fingerprint';
  end if;
  if octet_length(coalesce(p_assessment::text, '')) > 12000 then
    raise exception 'exchange assessment payload too large';
  end if;
  if v_status not in ('ready', 'insufficient_data', 'market_data_unavailable') then
    raise exception 'invalid exchange assessment status';
  end if;
  if p_assessment ->> 'evaluation_version' <> 'market_context_v1' then
    raise exception 'invalid exchange assessment version';
  end if;
  if length(coalesce(p_assessment ->> 'input_fingerprint', '')) <> 64 then
    raise exception 'invalid exchange assessment input fingerprint';
  end if;
  if p_assessment ->> 'market_provider' <> v_position.provider then
    raise exception 'exchange assessment provider mismatch';
  end if;
  if v_status = 'ready' and (
    p_assessment ->> 'confidence' not in ('high', 'medium', 'low')
    or nullif(p_assessment ->> 'entry_score', '') is null
    or nullif(p_assessment ->> 'entry_grade', '') is null
    or nullif(p_assessment ->> 'significance', '') is null
  ) then
    raise exception 'invalid ready exchange assessment';
  end if;
  if v_status in ('insufficient_data', 'market_data_unavailable') and (
    nullif(p_assessment ->> 'entry_score', '') is not null
    or nullif(p_assessment ->> 'entry_grade', '') is not null
    or nullif(p_assessment ->> 'exit_score', '') is not null
    or nullif(p_assessment ->> 'exit_grade', '') is not null
    or nullif(p_assessment ->> 'significance', '') is not null
    or p_assessment ->> 'post_exit_confirmation' <> 'unavailable'
    or nullif(p_assessment ->> 'next_retry_at', '') is null
  ) then
    raise exception 'invalid deferred exchange assessment';
  end if;
  if v_status = 'insufficient_data' and p_assessment ->> 'confidence' <> 'low' then
    raise exception 'invalid insufficient exchange assessment confidence';
  end if;
  if v_status = 'market_data_unavailable' and p_assessment ->> 'confidence' <> 'unavailable' then
    raise exception 'invalid unavailable exchange assessment confidence';
  end if;
  select * into v_existing
  from public.exchange_trade_assessments assessment
  where assessment.position_id = p_position_id
  for update;
  if found and v_existing.position_fingerprint = p_position_fingerprint then
    if (p_assessment ->> 'evaluated_at')::timestamptz <= v_existing.evaluated_at then
      return false;
    end if;
    if (
      case v_status
        when 'ready' then 3
        when 'insufficient_data' then 2
        else 1
      end
      <
      case v_existing.status
        when 'ready' then 3
        when 'insufficient_data' then 2
        else 1
      end
    ) then
      update public.exchange_trade_assessments assessment
      set attempt_count = least(assessment.attempt_count + 1, 20),
          next_retry_at = coalesce(
            nullif(p_assessment ->> 'next_retry_at', '')::timestamptz,
            assessment.next_retry_at
          )
      where assessment.position_id = p_position_id;
      return false;
    end if;
  end if;
  if jsonb_typeof(v_metrics) <> 'object' or octet_length(v_metrics::text) > 4000 then
    raise exception 'invalid exchange assessment metrics';
  end if;
  if coalesce(jsonb_typeof(p_assessment -> 'entry_reasons'), 'array') <> 'array'
     or coalesce(jsonb_typeof(p_assessment -> 'exit_reasons'), 'array') <> 'array'
     or coalesce(jsonb_typeof(p_assessment -> 'significance_reasons'), 'array') <> 'array'
     or coalesce(jsonb_typeof(p_assessment -> 'warnings'), 'array') <> 'array' then
    raise exception 'invalid exchange assessment reasons';
  end if;

  select coalesce(array_agg(left(value, 80)), array[]::text[])
  into v_entry_reasons
  from jsonb_array_elements_text(coalesce(p_assessment -> 'entry_reasons', '[]'::jsonb)) value;
  select coalesce(array_agg(left(value, 80)), array[]::text[])
  into v_exit_reasons
  from jsonb_array_elements_text(coalesce(p_assessment -> 'exit_reasons', '[]'::jsonb)) value;
  select coalesce(array_agg(left(value, 80)), array[]::text[])
  into v_significance_reasons
  from jsonb_array_elements_text(coalesce(p_assessment -> 'significance_reasons', '[]'::jsonb)) value;
  select coalesce(array_agg(left(value, 80)), array[]::text[])
  into v_warnings
  from jsonb_array_elements_text(coalesce(p_assessment -> 'warnings', '[]'::jsonb)) value;
  if cardinality(v_entry_reasons) > 12
     or cardinality(v_exit_reasons) > 12
     or cardinality(v_significance_reasons) > 12
     or cardinality(v_warnings) > 12 then
    raise exception 'exchange assessment reason limit exceeded';
  end if;

  insert into public.exchange_trade_assessments (
    position_id, connection_id, user_id, status, evaluation_version,
    position_fingerprint, input_fingerprint, market_provider, market_symbol,
    primary_timeframe, context_timeframe, requested_from, requested_until,
    coverage_ratio, expected_bars, observed_bars, max_gap_bars, confidence,
    entry_score, entry_grade, exit_score, exit_grade, holding_seconds,
    duration_class, significance, post_exit_confirmation, metrics,
    entry_reasons, exit_reasons, significance_reasons, warnings,
    next_retry_at, attempt_count, evaluated_at
  )
  values (
    p_position_id, p_connection_id, p_user_id, v_status, p_assessment ->> 'evaluation_version',
    p_position_fingerprint, p_assessment ->> 'input_fingerprint', p_assessment ->> 'market_provider',
    left(p_assessment ->> 'market_symbol', 80), p_assessment ->> 'primary_timeframe',
    p_assessment ->> 'context_timeframe', (p_assessment ->> 'requested_from')::timestamptz,
    (p_assessment ->> 'requested_until')::timestamptz,
    (p_assessment ->> 'coverage_ratio')::numeric,
    (p_assessment ->> 'expected_bars')::integer,
    (p_assessment ->> 'observed_bars')::integer,
    (p_assessment ->> 'max_gap_bars')::integer,
    p_assessment ->> 'confidence',
    nullif(p_assessment ->> 'entry_score', '')::smallint,
    nullif(p_assessment ->> 'entry_grade', ''),
    nullif(p_assessment ->> 'exit_score', '')::smallint,
    nullif(p_assessment ->> 'exit_grade', ''),
    (p_assessment ->> 'holding_seconds')::bigint,
    p_assessment ->> 'duration_class',
    nullif(p_assessment ->> 'significance', ''),
    p_assessment ->> 'post_exit_confirmation',
    v_metrics, v_entry_reasons, v_exit_reasons, v_significance_reasons, v_warnings,
    nullif(p_assessment ->> 'next_retry_at', '')::timestamptz, 1,
    (p_assessment ->> 'evaluated_at')::timestamptz
  )
  on conflict (position_id) do update set
    connection_id = excluded.connection_id,
    user_id = excluded.user_id,
    status = excluded.status,
    evaluation_version = excluded.evaluation_version,
    position_fingerprint = excluded.position_fingerprint,
    input_fingerprint = excluded.input_fingerprint,
    market_provider = excluded.market_provider,
    market_symbol = excluded.market_symbol,
    primary_timeframe = excluded.primary_timeframe,
    context_timeframe = excluded.context_timeframe,
    requested_from = excluded.requested_from,
    requested_until = excluded.requested_until,
    coverage_ratio = excluded.coverage_ratio,
    expected_bars = excluded.expected_bars,
    observed_bars = excluded.observed_bars,
    max_gap_bars = excluded.max_gap_bars,
    confidence = excluded.confidence,
    entry_score = excluded.entry_score,
    entry_grade = excluded.entry_grade,
    exit_score = excluded.exit_score,
    exit_grade = excluded.exit_grade,
    holding_seconds = excluded.holding_seconds,
    duration_class = excluded.duration_class,
    significance = excluded.significance,
    post_exit_confirmation = excluded.post_exit_confirmation,
    metrics = excluded.metrics,
    entry_reasons = excluded.entry_reasons,
    exit_reasons = excluded.exit_reasons,
    significance_reasons = excluded.significance_reasons,
    warnings = excluded.warnings,
    next_retry_at = excluded.next_retry_at,
    attempt_count = least(public.exchange_trade_assessments.attempt_count + 1, 20),
    evaluated_at = excluded.evaluated_at
  where excluded.evaluated_at > public.exchange_trade_assessments.evaluated_at
    and (
      excluded.position_fingerprint <> public.exchange_trade_assessments.position_fingerprint
      or (
        case excluded.status
          when 'ready' then 3
          when 'insufficient_data' then 2
          else 1
        end
        >=
        case public.exchange_trade_assessments.status
          when 'ready' then 3
          when 'insufficient_data' then 2
          else 1
        end
      )
    );
  get diagnostics v_upsert_count = row_count;
  return v_upsert_count = 1;
end
$$;

create or replace function public.fail_exchange_sync(
  p_connection_id uuid,
  p_user_id uuid,
  p_lease_token uuid,
  p_started_at timestamptz,
  p_status text,
  p_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated uuid;
begin
  if p_status not in ('permission_changed', 'ip_mismatch', 'rate_limited', 'provider_unavailable', 'partial') then
    raise exception 'invalid exchange failure status';
  end if;
  update public.exchange_connections connection
  set status = p_status,
      next_sync_at = case
        when p_status in ('permission_changed', 'ip_mismatch') then now() + interval '24 hours'
        when p_status = 'rate_limited' then now() + interval '30 minutes'
        else now() + interval '1 hour'
      end,
      sync_lease_token = null,
      sync_lease_until = null,
      sync_failure_count = connection.sync_failure_count + 1,
      last_error_code = left(coalesce(p_error_code, p_status), 80)
  where connection.id = p_connection_id
    and connection.user_id = p_user_id
    and connection.sync_lease_token = p_lease_token
  returning connection.id into v_updated;
  if v_updated is null then return false; end if;
  insert into public.exchange_sync_runs (
    connection_id, user_id, status, started_at, error_code
  )
  values (
    p_connection_id, p_user_id, p_status, p_started_at, left(coalesce(p_error_code, p_status), 80)
  );
  return true;
end
$$;

create or replace function public.purge_account_application_data(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table_name text;
  affected integer;
  total_affected integer := 0;
begin
  foreach v_table_name in array array[
    'exchange_connections',
    'journals', 'push_alert_events', 'push_alert_presets', 'push_tokens',
    'product_events', 'perpetual_scenario_monitors', 'subscriptions', 'oauth_provider_credentials',
    'news_alert_preferences', 'news_alert_budgets'
  ]
  loop
    if to_regclass('public.' || v_table_name) is not null
       and exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = v_table_name and column_name = 'user_id'
       ) then
      execute format('delete from public.%I where user_id = $1', v_table_name) using p_user_id;
      get diagnostics affected = row_count;
      total_affected := total_affected + affected;
    end if;
  end loop;

  if to_regclass('public.billing_entitlement_events') is not null then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'billing_entitlement_events' and column_name = 'actor_user_id'
    ) and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'billing_entitlement_events' and column_name = 'metadata'
    ) then
      execute $sql$
        update public.billing_entitlement_events
        set event_id = 'anonymized:' || id::text,
            user_id = case when user_id = $1 then null else user_id end,
            actor_user_id = case when actor_user_id = $1 then null else actor_user_id end,
            metadata = metadata - 'user_id' - 'email'
        where user_id = $1 or actor_user_id = $1
      $sql$ using p_user_id;
    else
      update public.billing_entitlement_events
      set event_id = 'anonymized:' || id::text,
          user_id = null
      where user_id = p_user_id;
    end if;
  end if;
  if to_regclass('public.profiles') is not null then delete from public.profiles where id = p_user_id; end if;
  return jsonb_build_object('deleted_rows', total_affected);
end
$$;

revoke all on function public.set_exchange_updated_at() from public, anon, authenticated;
revoke all on function public.enforce_journal_trade_position_owner() from public, anon, authenticated;
revoke all on function public.exchange_user_has_coin_pro(uuid) from public, anon, authenticated;
revoke all on function public.create_exchange_connection(
  uuid, uuid, text, text, text, text, text, text, jsonb, text[], integer, timestamptz, timestamptz, text[], integer, text, text, text, integer
) from public, anon, authenticated;
revoke all on function public.disconnect_exchange_connection(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.claim_exchange_connection(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.claim_due_exchange_connections(integer, uuid) from public, anon, authenticated;
revoke all on function public.commit_exchange_sync_batch(
  uuid, uuid, uuid, timestamptz, text, text, text, jsonb, timestamptz, jsonb, jsonb, jsonb, jsonb, jsonb, text[]
) from public, anon, authenticated;
revoke all on function public.list_due_exchange_trade_assessment_positions(uuid, uuid, timestamptz, integer)
  from public, anon, authenticated;
revoke all on function public.upsert_exchange_trade_assessment(uuid, uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.fail_exchange_sync(uuid, uuid, uuid, timestamptz, text, text) from public, anon, authenticated;
revoke all on function public.purge_account_application_data(uuid) from public, anon, authenticated;

grant execute on function public.set_exchange_updated_at() to service_role;
grant execute on function public.enforce_journal_trade_position_owner() to service_role;
grant execute on function public.exchange_user_has_coin_pro(uuid) to service_role;
grant execute on function public.create_exchange_connection(
  uuid, uuid, text, text, text, text, text, text, jsonb, text[], integer, timestamptz, timestamptz, text[], integer, text, text, text, integer
) to service_role;
grant execute on function public.disconnect_exchange_connection(uuid, uuid, boolean) to service_role;
grant execute on function public.claim_exchange_connection(uuid, uuid, uuid) to service_role;
grant execute on function public.claim_due_exchange_connections(integer, uuid) to service_role;
grant execute on function public.commit_exchange_sync_batch(
  uuid, uuid, uuid, timestamptz, text, text, text, jsonb, timestamptz, jsonb, jsonb, jsonb, jsonb, jsonb, text[]
) to service_role;
grant execute on function public.list_due_exchange_trade_assessment_positions(uuid, uuid, timestamptz, integer)
  to service_role;
grant execute on function public.upsert_exchange_trade_assessment(uuid, uuid, uuid, text, jsonb) to service_role;
grant execute on function public.fail_exchange_sync(uuid, uuid, uuid, timestamptz, text, text) to service_role;
grant execute on function public.purge_account_application_data(uuid) to service_role;
