-- ZUNE Delivery driver notifications
-- Safe to re-run. Uses the existing public.notifications table and its owner-scoped RLS policies.
create or replace function private.zune_delivery_notify_driver(
 p_user_id uuid,p_type text,p_title_sw text,p_title_en text,p_body_sw text,p_body_en text,p_action_url text,p_data jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path=''
as $$
begin
 if p_user_id is null then return; end if;
 insert into public.notifications(user_id,type,title_sw,title_en,body_sw,body_en,action_url,data)
 values(p_user_id,coalesce(nullif(p_type,''),'delivery'),p_title_sw,p_title_en,p_body_sw,p_body_en,p_action_url,coalesce(p_data,'{}'::jsonb));
end; $$;
revoke all on function private.zune_delivery_notify_driver(uuid,text,text,text,text,text,text,jsonb) from public,anon,authenticated;

create or replace function private.zune_delivery_order_notification_trigger()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_driver uuid; v_status text; v_title_sw text; v_title_en text;
begin
 v_driver:=new.assigned_driver_id;
 if tg_op='INSERT' then
  if v_driver is not null then perform private.zune_delivery_notify_driver(v_driver,'delivery_assigned','Umepewa oda mpya','A new delivery was assigned to you','Oda mpya imeongezwa kwenye orodha ya kazi zako. Fungua Oda zangu kuona maelezo.','A new delivery has been added to your jobs. Open My Deliveries to view details.','./jobs.html',jsonb_build_object('delivery_id',new.id,'status',new.status)); end if;
  return new;
 end if;
 if new.assigned_driver_id is distinct from old.assigned_driver_id and v_driver is not null then
  perform private.zune_delivery_notify_driver(v_driver,'delivery_assigned','Umepewa oda mpya','A new delivery was assigned to you','Oda mpya imeongezwa kwenye orodha ya kazi zako. Fungua Oda zangu kuona maelezo.','A new delivery has been added to your jobs. Open My Deliveries to view details.','./jobs.html',jsonb_build_object('delivery_id',new.id,'status',new.status));
 elsif new.status is distinct from old.status and v_driver is not null and auth.uid() is distinct from v_driver then
  v_status:=coalesce(new.status,'');
  v_title_sw:=case v_status when 'ready_for_pickup' then 'Mzigo uko tayari kuchukuliwa' when 'picked_up' then 'Hali ya mzigo imesasishwa' when 'in_transit' then 'Safari ya delivery imesasishwa' when 'delivered' then 'Mzigo umefikishwa' when 'completed' then 'Delivery imekamilika' when 'cancelled' then 'Delivery imeghairiwa' else 'Hali ya oda imebadilika' end;
  v_title_en:=case v_status when 'ready_for_pickup' then 'Order ready for pickup' when 'picked_up' then 'Pickup status updated' when 'in_transit' then 'Delivery trip updated' when 'delivered' then 'Order marked as delivered' when 'completed' then 'Delivery completed' when 'cancelled' then 'Delivery cancelled' else 'Delivery status changed' end;
  perform private.zune_delivery_notify_driver(v_driver,'delivery_status',v_title_sw,v_title_en,'Fungua Oda zangu kuona hatua mpya ya delivery yako.','Open My Deliveries to see the latest delivery progress.','./jobs.html',jsonb_build_object('delivery_id',new.id,'status',new.status));
 end if;
 return new;
end; $$;
revoke all on function private.zune_delivery_order_notification_trigger() from public,anon,authenticated;
drop trigger if exists zune_delivery_order_notifications on public.order_deliveries;
create trigger zune_delivery_order_notifications after insert or update of assigned_driver_id,status on public.order_deliveries for each row execute function private.zune_delivery_order_notification_trigger();

create or replace function private.zune_delivery_application_notification_trigger()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if new.status is distinct from old.status and new.status in('approved','rejected') then
  perform private.zune_delivery_notify_driver(new.user_id,'application_'||new.status,
   case when new.status='approved' then 'Maombi ya dereva yameidhinishwa' else 'Maombi ya dereva yamekataliwa' end,
   case when new.status='approved' then 'Driver application approved' else 'Driver application rejected' end,
   case when new.status='approved' then 'Hongera! Akaunti yako ya dereva imeidhinishwa. Kamilisha nyaraka na taarifa zinazohitajika.' else 'Maombi yako hayajaidhinishwa. Fungua akaunti kuona maelezo na hatua zinazofuata.' end,
   case when new.status='approved' then 'Congratulations! Your driver account has been approved. Complete any remaining requirements.' else 'Your application was not approved. Open your account for details and next steps.' end,
   './profile.html',jsonb_build_object('application_id',new.id,'status',new.status,'review_note',new.review_note));
 end if; return new;
end; $$;
revoke all on function private.zune_delivery_application_notification_trigger() from public,anon,authenticated;
drop trigger if exists zune_delivery_application_notifications on public.delivery_driver_applications;
create trigger zune_delivery_application_notifications after update of status on public.delivery_driver_applications for each row execute function private.zune_delivery_application_notification_trigger();

create or replace function private.zune_delivery_document_notification_trigger()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if new.status is distinct from old.status and new.status in('approved','rejected') then
  perform private.zune_delivery_notify_driver(new.user_id,'document_'||new.status,
   case when new.status='approved' then 'Nyaraka imeidhinishwa' else 'Nyaraka zinahitaji marekebisho' end,
   case when new.status='approved' then 'Document approved' else 'Document needs attention' end,
   'Nyaraka: '||new.document_type||'. '||coalesce(new.review_note,'Fungua sehemu ya Nyaraka kuona hali.'),
   'Document: '||new.document_type||'. '||coalesce(new.review_note,'Open Documents to review its status.'),
   './driver-documents.html',jsonb_build_object('document_id',new.id,'document_type',new.document_type,'status',new.status));
 end if; return new;
end; $$;
revoke all on function private.zune_delivery_document_notification_trigger() from public,anon,authenticated;
drop trigger if exists zune_delivery_document_notifications on public.delivery_driver_documents;
create trigger zune_delivery_document_notifications after update of status on public.delivery_driver_documents for each row execute function private.zune_delivery_document_notification_trigger();

create or replace function private.zune_delivery_vehicle_request_notification_trigger()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if new.status is distinct from old.status and new.status in('approved','rejected') then
  perform private.zune_delivery_notify_driver(new.user_id,'vehicle_change_'||new.status,
   case when new.status='approved' then 'Mabadiliko ya chombo yameidhinishwa' else 'Ombi la mabadiliko ya chombo limekataliwa' end,
   case when new.status='approved' then 'Vehicle change approved' else 'Vehicle change request rejected' end,
   'Ombi lako la kubadilisha taarifa za chombo limepitiwa. '||coalesce(new.review_note,'Fungua Akaunti kuona maelezo.'),
   'Your vehicle change request has been reviewed. '||coalesce(new.review_note,'Open Account for details.'),
   './profile.html',jsonb_build_object('request_id',new.id,'status',new.status));
 end if; return new;
end; $$;
revoke all on function private.zune_delivery_vehicle_request_notification_trigger() from public,anon,authenticated;
drop trigger if exists zune_delivery_vehicle_request_notifications on public.delivery_driver_vehicle_change_requests;
create trigger zune_delivery_vehicle_request_notifications after update of status on public.delivery_driver_vehicle_change_requests for each row execute function private.zune_delivery_vehicle_request_notification_trigger();

create or replace function private.zune_delivery_payment_notification_trigger()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if tg_op='INSERT' then
  if new.status='paid' then perform private.zune_delivery_notify_driver(new.driver_id,'payment_paid','Malipo yamekamilika','Payment completed','Malipo ya delivery yamewekwa kuwa yamelipwa. Fungua Malipo kuona taarifa.','Your delivery payout has been marked as paid. Open Payments for details.','./payments.html',jsonb_build_object('payment_id',new.id,'delivery_id',new.delivery_id,'amount',new.amount,'deduction',new.deduction,'net_amount',new.net_amount)); end if;
 elsif new.status='paid' and old.status is distinct from new.status then
  perform private.zune_delivery_notify_driver(new.driver_id,'payment_paid','Malipo yamekamilika','Payment completed','Malipo ya delivery yamewekwa kuwa yamelipwa. Fungua Malipo kuona taarifa.','Your delivery payout has been marked as paid. Open Payments for details.','./payments.html',jsonb_build_object('payment_id',new.id,'delivery_id',new.delivery_id,'amount',new.amount,'deduction',new.deduction,'net_amount',new.net_amount));
 end if; return new;
end; $$;
revoke all on function private.zune_delivery_payment_notification_trigger() from public,anon,authenticated;
drop trigger if exists zune_delivery_payment_notifications on public.zune_driver_payment_records;
create trigger zune_delivery_payment_notifications after insert or update of status on public.zune_driver_payment_records for each row execute function private.zune_delivery_payment_notification_trigger();

create index if not exists notifications_user_created_idx on public.notifications(user_id,created_at desc);
