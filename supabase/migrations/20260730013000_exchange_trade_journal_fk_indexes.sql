create index if not exists exchange_cashflows_connection_owner_idx
  on public.exchange_cashflows (connection_id, user_id);
create index if not exists exchange_cashflows_user_idx
  on public.exchange_cashflows (user_id);
create index if not exists exchange_credentials_connection_owner_idx
  on public.exchange_credentials (connection_id, user_id);
create index if not exists exchange_order_contexts_connection_owner_idx
  on public.exchange_order_contexts (connection_id, user_id);
create index if not exists exchange_sync_checkpoints_connection_owner_idx
  on public.exchange_sync_checkpoints (connection_id, user_id);
create index if not exists exchange_sync_checkpoints_user_idx
  on public.exchange_sync_checkpoints (user_id);
create index if not exists exchange_sync_runs_connection_owner_idx
  on public.exchange_sync_runs (connection_id, user_id);
create index if not exists exchange_trade_assessments_position_owner_idx
  on public.exchange_trade_assessments (position_id, user_id, connection_id);
create index if not exists exchange_trade_fills_connection_owner_idx
  on public.exchange_trade_fills (connection_id, user_id);
create index if not exists exchange_trade_positions_connection_owner_idx
  on public.exchange_trade_positions (connection_id, user_id);
create index if not exists exchange_trade_reviews_position_owner_idx
  on public.exchange_trade_reviews (position_id, user_id);
