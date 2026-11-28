-- ZUNE Delivery proof of delivery (POD)
-- Applied to shared Supabase project rpkogiieegqgxqbzwxwo.
-- Private evidence is uploaded by the assigned driver while in transit.
-- Only that driver, the delivery buyer and Admin can view the evidence.

alter table public.order_deliveries
  add column if not exists proof_of_delivery_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('zune-delivery-proofs', 'zune-delivery-proofs', false, 8388608,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public = false, file_size_limit = 8388608,
    allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "ZUNE assigned drivers upload delivery proof" on storage.objects;
create policy "ZUNE assigned drivers upload delivery proof"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'zune-delivery-proofs'
  and exists (
    select 1 from public.order_deliveries d
    where d.id::text = (storage.foldername(name))[1]
      and d.assigned_driver_id = (select auth.uid())
      and d.status = 'in_transit'
  )
);

drop policy if exists "ZUNE drivers remove unlinked delivery proof uploads" on storage.objects;
create policy "ZUNE drivers remove unlinked delivery proof uploads"
on storage.objects for delete to authenticated
using (
  bucket_id = 'zune-delivery-proofs'
  and exists (
    select 1 from public.order_deliveries d
    where d.id::text = (storage.foldername(name))[1]
      and d.assigned_driver_id = (select auth.uid())
      and d.status = 'in_transit'
      and d.proof_of_delivery_path is distinct from name
  )
);

drop policy if exists "ZUNE delivery participants view proof" on storage.objects;
create policy "ZUNE delivery participants view proof"
on storage.objects for select to authenticated
using (
  bucket_id = 'zune-delivery-proofs'
  and exists (
    select 1 from public.order_deliveries d
    join public.order_checkouts c on c.id = d.checkout_id
    where d.id::text = (storage.foldername(name))[1]
      and (d.assigned_driver_id = (select auth.uid())
        or c.buyer_id = (select auth.uid())
        or public.zune_is_admin())
  )
);

alter table public.zune_delivery_events
  drop constraint if exists zune_delivery_events_event_type_check;
alter table public.zune_delivery_events
  add constraint zune_delivery_events_event_type_check
  check (event_type = any (array[
    'driver_assigned','driver_accepted','driver_rejected','driver_response_expired',
    'seller_handover_confirmed','driver_pickup_confirmed','in_transit',
    'driver_marked_delivered','buyer_confirmed_received','location_updated',
    'delivery_disputed','delivery_cancelled','eta_updated','delivery_proof_uploaded'
  ]));

create or replace function public.zune_delivery_driver_submit_proof(p_delivery_id uuid,p_object_path text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare d public.order_deliveries%rowtype;
begin
 if auth.uid() is null then raise exception 'Tafadhali ingia kwanza.'; end if;
 if p_object_path is null or length(p_object_path)>500
   or split_part(p_object_path,'/',1)<>p_delivery_id::text
   or split_part(p_object_path,'/',2)='' then
  raise exception 'Njia ya picha ya ushahidi si sahihi.';
 end if;
 select * into d from public.order_deliveries where id=p_delivery_id for update;
 if not found or d.assigned_driver_id<>auth.uid() then raise exception 'Delivery hii haijapangiwa akaunti yako.'; end if;
 if d.status<>'in_transit' then raise exception 'Picha ya ushahidi inaweza kupakiwa wakati safari inaendelea pekee.'; end if;
 if not exists(select 1 from storage.objects o where o.bucket_id='zune-delivery-proofs' and o.name=p_object_path) then
  raise exception 'Picha haijapatikana kwenye hifadhi salama.';
 end if;
 update public.order_deliveries set proof_of_delivery_path=p_object_path where id=p_delivery_id;
 insert into public.zune_delivery_events(delivery_id,actor_id,event_type,note)
 values(p_delivery_id,auth.uid(),'delivery_proof_uploaded','Dereva amepakia picha ya ushahidi wa kufikisha.');
 return jsonb_build_object('ok',true,'delivery_id',p_delivery_id,'proof_uploaded',true);
end; $$;
revoke all on function public.zune_delivery_driver_submit_proof(uuid,text) from public,anon;
grant execute on function public.zune_delivery_driver_submit_proof(uuid,text) to authenticated;

create or replace function public.zune_delivery_driver_delivered(p_delivery_id uuid,p_note text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare d public.order_deliveries%rowtype;
begin
 if auth.uid() is null then raise exception 'Tafadhali ingia kwanza.'; end if;
 select * into d from public.order_deliveries where id=p_delivery_id for update;
 if not found or d.assigned_driver_id<>auth.uid() then raise exception 'Oda hii haijapangiwa akaunti yako.'; end if;
 if d.status<>'in_transit' or d.driver_pickup_confirmed_at is null then
  raise exception 'Dereva lazima athibitishe kupokea mzigo na kuanza safari kwanza.';
 end if;
 if d.proof_of_delivery_path is null or not exists(
  select 1 from storage.objects o where o.bucket_id='zune-delivery-proofs' and o.name=d.proof_of_delivery_path
 ) then raise exception 'Pakia picha ya ushahidi wa kufikisha mzigo kabla ya kuthibitisha.'; end if;
 update public.order_deliveries set status='delivered',driver_delivered_at=now() where id=p_delivery_id;
 insert into public.zune_delivery_events(delivery_id,actor_id,event_type,note)
 values(p_delivery_id,auth.uid(),'driver_marked_delivered',nullif(trim(coalesce(p_note,'')),''));
 return jsonb_build_object('ok',true,'status','delivered','payout_status','awaiting_buyer_confirmation','proof_uploaded',true);
end; $$;
revoke all on function public.zune_delivery_driver_delivered(uuid,text) from public,anon;
grant execute on function public.zune_delivery_driver_delivered(uuid,text) to authenticated;

create or replace function public.zune_delivery_buyer_tracking(p_delivery_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_result jsonb;
begin
 if auth.uid() is null then raise exception 'Tafadhali ingia kwenye akaunti yako kwanza.'; end if;
 select jsonb_build_object(
  'delivery_id',d.id,
  'order_numbers',coalesce((select jsonb_agg(x.public_id order by x.public_id)
    from (select distinct coalesce(o.public_order_id,o.order_number) public_id from public.orders o
      where o.checkout_id=d.checkout_id and o.vendor_id=d.vendor_id) x),'[]'::jsonb),
  'status',d.status,'delivery_fee',d.delivery_fee,'currency',d.currency,
  'estimated_delivery_at',d.estimated_delivery_at,'eta_updated_at',d.eta_updated_at,'created_at',d.created_at,
  'seller_handover_confirmed_at',d.seller_handover_confirmed_at,
  'driver_pickup_confirmed_at',d.driver_pickup_confirmed_at,'driver_delivered_at',d.driver_delivered_at,
  'buyer_confirmed_at',d.buyer_confirmed_at,'proof_of_delivery_path',d.proof_of_delivery_path,
  'last_location',case when d.last_latitude is not null and d.last_longitude is not null
    then jsonb_build_object('latitude',d.last_latitude,'longitude',d.last_longitude,'updated_at',d.last_location_at) else null end,
  'destination',jsonb_build_object('name',c.recipient_name,'phone',c.recipient_phone,'address',c.delivery_address,
    'region',c.region,'district',c.district,'latitude',c.latitude,'longitude',c.longitude),
  'driver',case when dp.user_id is not null then jsonb_build_object('name',dp.full_name,'phone',dp.phone_number,
    'vehicle_type',dp.vehicle_type,'vehicle_registration',dp.vehicle_registration) else null end,
  'events',coalesce((select jsonb_agg(jsonb_build_object('event_type',e.event_type,'note',e.note,'created_at',e.created_at)
    order by e.created_at asc) from public.zune_delivery_events e
    where e.delivery_id=d.id and e.event_type<>'location_updated'),'[]'::jsonb)
 ) into v_result
 from public.order_deliveries d join public.order_checkouts c on c.id=d.checkout_id
 left join public.delivery_driver_profiles dp on dp.user_id=d.assigned_driver_id
 where d.id=p_delivery_id and c.buyer_id=auth.uid();
 if v_result is null then raise exception 'Delivery haijapatikana au si ya akaunti hii.'; end if;
 return v_result;
end; $$;
revoke all on function public.zune_delivery_buyer_tracking(uuid) from public,anon;
grant execute on function public.zune_delivery_buyer_tracking(uuid) to authenticated;
