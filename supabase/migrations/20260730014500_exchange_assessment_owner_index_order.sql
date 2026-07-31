drop index if exists public.exchange_trade_assessments_position_owner_idx;
create index exchange_trade_assessments_position_owner_idx
  on public.exchange_trade_assessments (position_id, connection_id, user_id);
