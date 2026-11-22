-- ZUNE Delivery: central eligibility gate. Expired approvals never qualify.
create or replace function public.zune_delivery_driver_queue()
returns table(
 delivery_id uuid, checkout_id uuid, delivery_fee numeric, currency text, delivery_status text,
 recipient_name text, recipient_phone text, delivery_address text, region text, district text,
 latitude double precision, longitude double precision,
 seller_handover_confirmed_at timestamptz, driver_pickup_confirmed_at timestamptz,
 driver_delivered_at timestamptz, buyer_confirmed_at timestamptz, created_at timestamptz
)
language plpgsql security definer set search_path = ''
as $$
begin
 if auth.uid() is null then raise exception 'Tafadhali ingia kwanza.'; end if;
 if not exists(select 1 from public.delivery_driver_profiles p where p.user_id=auth.uid() and p.status='active') then
  raise exception 'Akaunti ya dereva haijaidhinishwa au imesimamishwa.';
 end if;
 -- Existing assignments remain visible so a driver can finish work already handed over.
 -- New assignments are blocked separately by zune_delivery_driver_has_required_documents().
 return query
 select d.id,d.checkout_id,d.delivery_fee,d.currency,d.status,c.recipient_name,c.recipient_phone,
 c.delivery_address,c.region,c.district,c.latitude,c.longitude,d.seller_handover_confirmed_at,
 d.driver_pickup_confirmed_at,d.driver_delivered_at,d.buyer_confirmed_at,d.created_at
 from public.order_deliveries d join public.order_checkouts c on c.id=d.checkout_id
 where d.assigned_driver_id=auth.uid() order by d.created_at desc;
end; $$;
revoke all on function public.zune_delivery_driver_queue() from public,anon;
grant execute on function public.zune_delivery_driver_queue() to authenticated;
