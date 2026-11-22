-- Applied to Supabase project rpkogiieegqgxqbzwxwo.
-- Enforce five approved, unexpired driver documents before assignment.
-- Add audited Admin suspend/restore control. No order rows are deleted.

create or replace function public.zune_delivery_driver_has_required_documents(p_driver_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
 select exists (
  select 1 from public.delivery_driver_profiles p
  where p.user_id=p_driver_id and not exists (
   select 1 from (values ('national_id'),('driver_photo'),('driving_license'),('vehicle_registration'),('vehicle_insurance')) required(doc_type)
   where (required.doc_type <> 'driving_license' or p.vehicle_type <> 'bicycle')
    and not exists (
     select 1 from public.delivery_driver_documents doc
     where doc.user_id=p.user_id and doc.document_type=required.doc_type and doc.status='approved'
      and ((required.doc_type in ('driving_license','vehicle_insurance') and doc.expiry_date is not null and doc.expiry_date >= current_date) or (required.doc_type not in ('driving_license','vehicle_insurance') and (doc.expiry_date is null or doc.expiry_date >= current_date)))
    )
  )
 );
$$;
revoke all on function public.zune_delivery_driver_has_required_documents(uuid) from public,anon,authenticated;

create or replace function public.zune_delivery_active_drivers()
returns table(driver_id uuid, full_name text, phone_number text, vehicle_type text, vehicle_registration text)
language plpgsql security definer set search_path = ''
as $$
begin
 if auth.uid() is null then raise exception 'Tafadhali ingia kwanza.'; end if;
 if not public.zune_is_admin() and not exists(select 1 from public.products p where p.vendor_id=auth.uid()) then raise exception 'Akaunti hii haina ruhusa ya kuona madereva.'; end if;
 return query select p.user_id,p.full_name,p.phone_number,p.vehicle_type,p.vehicle_registration from public.delivery_driver_profiles p where p.status='active' and public.zune_delivery_driver_has_required_documents(p.user_id) order by p.full_name;
end;
$$;

create or replace function public.zune_delivery_assign_driver(p_delivery_id uuid, p_driver_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare d public.order_deliveries%rowtype;
begin
 if auth.uid() is null then raise exception 'Tafadhali ingia kwanza.'; end if;
 select * into d from public.order_deliveries where id=p_delivery_id for update;
 if not found then raise exception 'Delivery haijapatikana.'; end if;
 if d.vendor_id<>auth.uid() and not public.zune_is_admin() then raise exception 'Huna ruhusa ya kupanga dereva wa oda hii.'; end if;
 if d.status not in ('pending','assigned') or d.seller_handover_confirmed_at is not null then raise exception 'Dereva hawezi kubadilishwa baada ya makabidhiano.'; end if;
 if not exists(select 1 from public.delivery_driver_profiles p where p.user_id=p_driver_id and p.status='active') or not public.zune_delivery_driver_has_required_documents(p_driver_id) then raise exception 'Dereva hajakamilisha idhini ya akaunti au nyaraka tano. Hawezi kupangiwa oda.'; end if;
 update public.order_deliveries set assigned_driver_id=p_driver_id,status='assigned' where id=p_delivery_id;
 insert into public.zune_delivery_events(delivery_id,actor_id,event_type,note) values(p_delivery_id,auth.uid(),'driver_assigned','Muuzaji amemchagua dereva aliyeidhinishwa.');
 return jsonb_build_object('ok',true,'delivery_id',p_delivery_id,'driver_id',p_driver_id,'status','assigned');
end;
$$;

create or replace function public.zune_admin_set_delivery_driver_status(p_driver_user_id uuid,p_status text,p_reason text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_old_status text; v_reason text;
begin
 if auth.uid() is null or not public.zune_is_admin() then raise exception 'Ni Admin Mkuu pekee anayeruhusiwa kufanya kitendo hiki.'; end if;
 if p_status not in ('active','suspended') then raise exception 'Hali inayoruhusiwa ni active au suspended.'; end if;
 v_reason:=nullif(trim(coalesce(p_reason,'')),'');
 if v_reason is null or length(v_reason)<5 then raise exception 'Andika sababu (angalau herufi 5).'; end if;
 select status into v_old_status from public.delivery_driver_profiles where user_id=p_driver_user_id for update;
 if not found then raise exception 'Dereva hajapatikana.'; end if;
 if p_status='active' and not public.zune_delivery_driver_has_required_documents(p_driver_user_id) then raise exception 'Dereva hawezi kurejeshwa: nyaraka tano lazima ziwe approved na zisizoisha muda.'; end if;
 update public.delivery_driver_profiles set status=p_status,updated_at=now() where user_id=p_driver_user_id;
 insert into public.delivery_driver_audit_logs(driver_user_id,performed_by,action,reason) values(p_driver_user_id,auth.uid(),case when p_status='suspended' then 'driver_suspended' else 'driver_restored' end,v_reason);
 return jsonb_build_object('ok',true,'driver_user_id',p_driver_user_id,'previous_status',v_old_status,'status',p_status);
end;
$$;
revoke all on function public.zune_delivery_active_drivers() from public,anon;
revoke all on function public.zune_delivery_assign_driver(uuid,uuid) from public,anon;
revoke all on function public.zune_admin_set_delivery_driver_status(uuid,text,text) from public,anon;
grant execute on function public.zune_delivery_active_drivers() to authenticated;
grant execute on function public.zune_delivery_assign_driver(uuid,uuid) to authenticated;
grant execute on function public.zune_admin_set_delivery_driver_status(uuid,text,text) to authenticated;
