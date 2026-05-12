-- 결제 승인 후 같은 주문번호가 중복 반영되지 않도록 구독 주문번호를 고유하게 관리합니다.
create unique index if not exists subscriptions_provider_order_id_idx
on public.subscriptions(provider_order_id)
where provider_order_id is not null;
