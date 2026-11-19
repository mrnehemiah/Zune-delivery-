create or replace function public.zune_delivery_buyer_tracking(p_delivery_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_result jsonb;
begin
 if auth.uid() is null then raise exception 'Tafadhali ingia kwenye akaunti yako kwanza.'; end if;
 select jsonb_build_object(
  'delivery_id',d.id,'status',d.status,'delivery_fee',d.delivery_fee,'currency',d.currency,'created_at',d.created_at,
  'seller_handover_confirmed_at',d.seller_handover_confirmed_at,'driver_pickup_confirmed_at',d.driver_pickup_confirmed_at,
  'driver_delivered_at',d.driver_delivered_at,'buyer_confirmed_at',d.buyer_confirmed_at,
  'last_location',case when d.last_latitude is not null and d.last_longitude is not null then jsonb_build_object('latitude',d.last_latitude,'longitude',d.last_longitude,'updated_at',d.last_location_at) else null end,
  'destination',jsonb_build_object('name',c.recipient_name,'phone',c.recipient_phone,'address',c.delivery_address,'region',c.region,'district',c.district,'latitude',c.latitude,'longitude',c.longitude),
  'driver',case when dp.user_id is not null then jsonb_build_object('name',dp.full_name,'phone',dp.phone_number,'vehicle_type',dp.vehicle_type,'vehicle_registration',dp.vehicle_registration) else null end,
  'events',coalesce((select jsonb_agg(jsonb_build_object('event_type',e.event_type,'note',e.note,'created_at',e.created_at) order by e.created_at asc) from public.zune_delivery_events e where e.delivery_id=d.id and e.event_type<>'location_updated'),'[]'::jsonb)
 ) into v_result
 from public.order_deliveries d
 join public.order_checkouts c on c.id=d.checkout_id
 left join public.delivery_driver_profiles dp on dp.user_id=d.assigned_driver_id
 where d.id=p_delivery_id and c.buyer_id=auth.uid();
 if v_result is null then raise exception 'Delivery haijapatikana au si ya akaunti hii.'; end if;
 return v_result;
end; $$;
revoke all on function public.zune_delivery_buyer_tracking(uuid) from public,anon;
grant execute on function public.zune_delivery_buyer_tracking(uuid) to authenticated;