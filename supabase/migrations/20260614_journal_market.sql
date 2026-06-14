alter table public.journals
  add column if not exists market text;

alter table public.journals
  drop constraint if exists journals_market_check;

alter table public.journals
  add constraint journals_market_check
  check (market in ('crypto', 'stocks') or market is null);

update public.journals
set market = case
  when lower(coalesce(verdict, '')) like '%global%' then 'stocks'
  when upper(coalesce(symbol, '')) in ('SPY', 'QQQ', 'DIA', 'IWM', 'AAPL', 'MSFT', 'NVDA', 'TSLA', 'META', 'GOOGL', 'AMZN', 'AMD', 'AVGO', 'JPM', 'XOM', 'GLD', 'USO') then 'stocks'
  when lower(coalesce(verdict, '')) like '%crypto%' then 'crypto'
  when symbol is not null then 'crypto'
  else market
end
where market is null;
