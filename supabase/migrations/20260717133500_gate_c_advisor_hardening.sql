-- Follow-up for the already-applied Gate C ledger migration. This migration
-- changes privileges and policy/function metadata only; it does not mutate
-- profiles, subscriptions, signals, or entitlement event rows.
revoke all privileges on table public.billing_entitlement_events
  from public, anon, authenticated, service_role;
grant select on table public.billing_entitlement_events to service_role;

drop policy if exists "본인 구독 읽기" on public.subscriptions;

alter function public.has_effective_market_entitlement(text) security invoker;
