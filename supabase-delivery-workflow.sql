-- ZUNE Delivery workflow schema
-- Applied to Supabase project rpkogiieegqgxqbzwxwo.
-- Uses existing order_checkouts/order_deliveries records; no order data is replaced.

alter table public.order_deliveries
  add column if not exists assigned_driver_id uuid references auth.users(id) on delete set null,
  add column if not exists seller_handover_confirmed_at timestamptz,
  add column if not exists driver_pickup_confirmed_at timestamptz,
  add column if not exists driver_delivered_at timestamptz,
  add column if not exists buyer_confirmed_at timestamptz,
  add column if not exists last_latitude double precision,
  add column if not exists last_longitude double precision,
  add column if not exists last_location_at timestamptz,
  add column if not exists payout_status text not null default 'awaiting_confirmation',
  add column if not exists driver_payout_amount numeric,
  add column if not exists zune_delivery_amount numeric;

create table if not exists public.zune_delivery_events (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.order_deliveries(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in (
    'driver_assigned','seller_handover_confirmed','driver_pickup_confirmed',
    'in_transit','driver_marked_delivered','buyer_confirmed_received',
    'location_updated','delivery_disputed','delivery_cancelled'
  )),
  note text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now()
);
create index if not exists zune_delivery_events_delivery_created_idx on public.zune_delivery_events(delivery_id,created_at);
create index if not exists order_deliveries_assigned_driver_idx on public.order_deliveries(assigned_driver_id,status);
alter table public.zune_delivery_events enable row level security;
drop policy if exists zune_delivery_events_participant_read on public.zune_delivery_events;
create policy zune_delivery_events_participant_read on public.zune_delivery_events
for select to authenticated using (
 exists (
  select 1 from public.order_deliveries d
  join public.order_checkouts c on c.id=d.checkout_id
  where d.id=zune_delivery_events.delivery_id and (
   public.zune_is_admin() or c.buyer_id=(select auth.uid())
   or d.vendor_id=(select auth.uid()) or d.assigned_driver_id=(select auth.uid())
  )
 )
);
grant select on public.zune_delivery_events to authenticated;

CREATE OR REPLACE FUNCTION public.zune_delivery_active_drivers()
 RETURNS TABLE(driver_id uuid, full_name text, phone_number text, vehicle_type text, vehicle_registration text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if auth.uid() is null then raise exception 'Tafadhali ingia kwanza.'; end if;
 if not public.zune_is_admin() and not exists(select 1 from public.products p where p.vendor_id=auth.uid()) then
   raise exception 'Akaunti hii haina ruhusa ya kuona madereva.';
 end if;
 return query select p.user_id,p.full_name,p.phone_number,p.vehicle_type,p.vehicle_registration
 from public.delivery_driver_profiles p where p.status='active' order by p.full_name;
end;
$function$


CREATE OR REPLACE FUNCTION public.zune_delivery_assign_driver(p_delivery_id uuid, p_driver_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare d public.order_deliveries%rowtype;
begin
 if auth.uid() is null then raise exception 'Tafadhali ingia kwanza.'; end if;
 select * into d from public.order_deliveries where id=p_delivery_id for update;
 if not found then raise exception 'Delivery haijapatikana.'; end if;
 if d.vendor_id<>auth.uid() and not public.zune_is_admin() then raise exception 'Huna ruhusa ya kupanga dereva wa oda hii.'; end if;
 if d.status not in ('pending','assigned') or d.seller_handover_confirmed_at is not null then raise exception 'Dereva hawezi kubadilishwa baada ya makabidhiano.'; end if;
 if not exists(select 1 from public.delivery_driver_profiles p where p.user_id=p_driver_id and p.status='active') then
  raise exception 'Dereva hajathibitishwa au akaunti yake haipo hai.';
 end if;
 update public.order_deliveries set assigned_driver_id=p_driver_id,status='assigned' where id=p_delivery_id;
 insert into public.zune_delivery_events(delivery_id,actor_id,event_type,note) values(p_delivery_id,auth.uid(),'driver_assigned','Muuzaji amemchagua dereva.');
 return jsonb_build_object('ok',true,'delivery_id',p_delivery_id,'driver_id',p_driver_id,'status','assigned');
end; $function$


CREATE OR REPLACE FUNCTION public.zune_delivery_buyer_confirm_received(p_delivery_id uuid, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare d public.order_deliveries%rowtype; v_buyer uuid;
begin
  if auth.uid() is null then raise exception 'Tafadhali ingia kwanza.'; end if;
  select * into d from public.order_deliveries where id=p_delivery_id for update;
  if not found then raise exception 'Delivery haijapatikana.'; end if;
  select buyer_id into v_buyer from public.order_checkouts where id=d.checkout_id;
  if v_buyer is distinct from auth.uid() then raise exception 'Mnunuzi wa oda hii pekee ndiye anayeweza kuthibitisha kupokea.'; end if;
  if d.status <> 'delivered' or d.driver_delivered_at is null then
    raise exception 'Dereva lazima athibitishe kufikisha mzigo kwanza.';
  end if;
  update public.order_deliveries
    set status='completed',buyer_confirmed_at=now(),payout_status='awaiting_allocation'
    where id=p_delivery_id;
  insert into public.zune_delivery_events(delivery_id,actor_id,event_type,note)
    values(p_delivery_id,auth.uid(),'buyer_confirmed_received',nullif(trim(coalesce(p_note,'')),''));
  return jsonb_build_object('ok',true,'status','completed','payout_status','awaiting_allocation',
    'message','Mnunuzi amethibitisha kupokea. Mgawanyo wa malipo unasubiri kanuni za malipo za ZUNE.');
end;
$function$


CREATE OR REPLACE FUNCTION public.zune_delivery_driver_delivered(p_delivery_id uuid, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare d public.order_deliveries%rowtype;
begin
 if auth.uid() is null then raise exception 'Tafadhali ingia kwanza.'; end if;
 select * into d from public.order_deliveries where id=p_delivery_id for update;
 if not found or d.assigned_driver_id<>auth.uid() then raise exception 'Oda hii haijapangiwa akaunti yako.'; end if;
 if d.status<>'in_transit' or d.driver_pickup_confirmed_at is null then
  raise exception 'Dereva lazima athibitishe kupokea mzigo na kuanza safari kwanza.';
 end if;
 update public.order_deliveries set status='delivered',driver_delivered_at=now() where id=p_delivery_id;
 insert into public.zune_delivery_events(delivery_id,actor_id,event_type,note) values(p_delivery_id,auth.uid(),'driver_marked_delivered',nullif(trim(coalesce(p_note,'')),''));
 return jsonb_build_object('ok',true,'status','delivered','payout_status','awaiting_buyer_confirmation');
end; $function$


CREATE OR REPLACE FUNCTION public.zune_delivery_driver_in_transit(p_delivery_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare d public.order_deliveries%rowtype;
begin
  if auth.uid() is null then raise exception 'Tafadhali ingia kwanza.'; end if;
  select * into d from public.order_deliveries where id=p_delivery_id for update;
  if not found or d.assigned_driver_id <> auth.uid() then raise exception 'Oda hii haijapangiwa akaunti yako.'; end if;
  if d.status <> 'picked_up' then raise exception 'Dereva athibitishe kupokea mzigo kwanza.'; end if;
  update public.order_deliveries set status='in_transit' where id=p_delivery_id;
  insert into public.zune_delivery_events(delivery_id,actor_id,event_type,note)
    values(p_delivery_id,auth.uid(),'in_transit','Dereva ameanza safari.');
  return jsonb_build_object('ok',true,'status','in_transit');
end;
$function$


CREATE OR REPLACE FUNCTION public.zune_delivery_driver_pickup(p_delivery_id uuid, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare d public.order_deliveries%rowtype;
begin
  if auth.uid() is null then raise exception 'Tafadhali ingia kwanza.'; end if;
  select * into d from public.order_deliveries where id=p_delivery_id for update;
  if not found or d.assigned_driver_id <> auth.uid() then raise exception 'Oda hii haijapangiwa akaunti yako.'; end if;
  if d.status <> 'ready_for_pickup' or d.seller_handover_confirmed_at is null then
    raise exception 'Muuzaji lazima athibitishe kukabidhi mzigo kwanza.';
  end if;
  update public.order_deliveries set driver_pickup_confirmed_at=now(),status='picked_up' where id=p_delivery_id;
  insert into public.zune_delivery_events(delivery_id,actor_id,event_type,note)
    values(p_delivery_id,auth.uid(),'driver_pickup_confirmed',nullif(trim(coalesce(p_note,'')),''));
  return jsonb_build_object('ok',true,'status','picked_up');
end;
$function$


CREATE OR REPLACE FUNCTION public.zune_delivery_driver_queue()
 RETURNS TABLE(delivery_id uuid, checkout_id uuid, delivery_fee numeric, currency text, delivery_status text, recipient_name text, recipient_phone text, delivery_address text, region text, district text, latitude double precision, longitude double precision, seller_handover_confirmed_at timestamp with time zone, driver_pickup_confirmed_at timestamp with time zone, driver_delivered_at timestamp with time zone, buyer_confirmed_at timestamp with time zone, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if auth.uid() is null then raise exception 'Tafadhali ingia kwanza.'; end if;
 if not exists(select 1 from public.delivery_driver_profiles p where p.user_id=auth.uid() and p.status='active') then
   raise exception 'Akaunti ya dereva haijaidhinishwa au haipo hai.';
 end if;
 return query
 select d.id,d.checkout_id,d.delivery_fee,d.currency,d.status,c.recipient_name,c.recipient_phone,
 c.delivery_address,c.region,c.district,c.latitude,c.longitude,d.seller_handover_confirmed_at,
 d.driver_pickup_confirmed_at,d.driver_delivered_at,d.buyer_confirmed_at,d.created_at
 from public.order_deliveries d join public.order_checkouts c on c.id=d.checkout_id
 where d.assigned_driver_id=auth.uid()
 order by d.created_at desc;
end;
$function$


CREATE OR REPLACE FUNCTION public.zune_delivery_seller_handover(p_delivery_id uuid, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare d public.order_deliveries%rowtype;
begin
  if auth.uid() is null then raise exception 'Tafadhali ingia kwanza.'; end if;
  select * into d from public.order_deliveries where id=p_delivery_id for update;
  if not found then raise exception 'Delivery haijapatikana.'; end if;
  if d.vendor_id <> auth.uid() and not public.zune_is_admin() then raise exception 'Muuzaji huyu hana ruhusa ya oda hii.'; end if;
  if d.assigned_driver_id is null then raise exception 'Chagua dereva kabla ya kukabidhi mzigo.'; end if;
  if d.status <> 'assigned' then raise exception 'Oda haipo kwenye hatua ya kukabidhiwa.'; end if;
  update public.order_deliveries set seller_handover_confirmed_at=now(),status='ready_for_pickup' where id=p_delivery_id;
  insert into public.zune_delivery_events(delivery_id,actor_id,event_type,note)
    values(p_delivery_id,auth.uid(),'seller_handover_confirmed',nullif(trim(coalesce(p_note,'')),''));
  return jsonb_build_object('ok',true,'status','ready_for_pickup');
end;
$function$


CREATE OR REPLACE FUNCTION public.zune_delivery_seller_queue()
 RETURNS TABLE(delivery_id uuid, checkout_id uuid, vendor_id uuid, delivery_fee numeric, currency text, delivery_status text, assigned_driver_id uuid, seller_handover_confirmed_at timestamp with time zone, driver_pickup_confirmed_at timestamp with time zone, driver_delivered_at timestamp with time zone, buyer_confirmed_at timestamp with time zone, payout_status text, recipient_name text, recipient_phone text, delivery_address text, region text, district text, latitude double precision, longitude double precision, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if auth.uid() is null then raise exception 'Tafadhali ingia kwanza.'; end if;
 if not public.zune_is_admin() and not exists(select 1 from public.products p where p.vendor_id=auth.uid()) then
  raise exception 'Akaunti hii haina duka linaloweza kusimamia delivery.';
 end if;
 return query
 select d.id,d.checkout_id,d.vendor_id,d.delivery_fee,d.currency,d.status,d.assigned_driver_id,
 d.seller_handover_confirmed_at,d.driver_pickup_confirmed_at,d.driver_delivered_at,d.buyer_confirmed_at,
 d.payout_status,c.recipient_name,c.recipient_phone,c.delivery_address,c.region,c.district,c.latitude,c.longitude,d.created_at
 from public.order_deliveries d join public.order_checkouts c on c.id=d.checkout_id
 where public.zune_is_admin() or d.vendor_id=auth.uid()
 order by d.created_at desc;
end; $function$


CREATE OR REPLACE FUNCTION public.zune_delivery_update_location(p_delivery_id uuid, p_latitude double precision, p_longitude double precision)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare d public.order_deliveries%rowtype;
begin
  if auth.uid() is null then raise exception 'Tafadhali ingia kwanza.'; end if;
  if p_latitude is null or p_longitude is null or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'GPS coordinates si sahihi.';
  end if;
  select * into d from public.order_deliveries where id=p_delivery_id for update;
  if not found or d.assigned_driver_id <> auth.uid() then raise exception 'Oda hii haijapangiwa akaunti yako.'; end if;
  if d.status not in ('picked_up','in_transit') then raise exception 'GPS tracking huanza baada ya dereva kupokea mzigo.'; end if;
  update public.order_deliveries set last_latitude=p_latitude,last_longitude=p_longitude,last_location_at=now() where id=p_delivery_id;
  insert into public.zune_delivery_events(delivery_id,actor_id,event_type,latitude,longitude)
    values(p_delivery_id,auth.uid(),'location_updated',p_latitude,p_longitude);
  return jsonb_build_object('ok',true,'updated_at',now());
end;
$function$


revoke all on function public.zune_delivery_assign_driver(uuid,uuid) from public,anon;
revoke all on function public.zune_delivery_seller_handover(uuid,text) from public,anon;
revoke all on function public.zune_delivery_driver_pickup(uuid,text) from public,anon;
revoke all on function public.zune_delivery_driver_in_transit(uuid) from public,anon;
revoke all on function public.zune_delivery_driver_delivered(uuid,text) from public,anon;
revoke all on function public.zune_delivery_buyer_confirm_received(uuid,text) from public,anon;
revoke all on function public.zune_delivery_update_location(uuid,double precision,double precision) from public,anon;
revoke all on function public.zune_delivery_seller_queue() from public,anon;
revoke all on function public.zune_delivery_active_drivers() from public,anon;
revoke all on function public.zune_delivery_driver_queue() from public,anon;
grant execute on function public.zune_delivery_assign_driver(uuid,uuid) to authenticated;
grant execute on function public.zune_delivery_seller_handover(uuid,text) to authenticated;
grant execute on function public.zune_delivery_driver_pickup(uuid,text) to authenticated;
grant execute on function public.zune_delivery_driver_in_transit(uuid) to authenticated;
grant execute on function public.zune_delivery_driver_delivered(uuid,text) to authenticated;
grant execute on function public.zune_delivery_buyer_confirm_received(uuid,text) to authenticated;
grant execute on function public.zune_delivery_update_location(uuid,double precision,double precision) to authenticated;
grant execute on function public.zune_delivery_seller_queue() to authenticated;
grant execute on function public.zune_delivery_active_drivers() to authenticated;
grant execute on function public.zune_delivery_driver_queue() to authenticated;
