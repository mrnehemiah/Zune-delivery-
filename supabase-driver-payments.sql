-- ZUNE Driver Payments Dashboard
-- Driver earnings are sourced only from the configured driver_payout_amount on
-- buyer-confirmed completed deliveries. The buyer's delivery fee is NOT treated
-- as the driver's earnings. Payment records are written by Admin, never by drivers.

create table if not exists public.zune_driver_payment_records (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.profiles(id) on delete restrict,
  delivery_id uuid not null unique references public.order_deliveries(id) on delete restrict,
  amount numeric(14,2) not null check (amount >= 0),
  deduction numeric(14,2) not null default 0 check (deduction >= 0),
  net_amount numeric(14,2) not null check (net_amount >= 0),
  payment_method text check (payment_method in ('mpesa','airtel_money','mixx_by_yas','halopesa','bank','cash','manual')),
  payment_phone text,
  transaction_reference text,
  status text not null default 'pending' check (status in ('pending','processing','paid','rejected')),
  admin_note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  constraint zune_driver_payment_net_check check (net_amount = amount - deduction)
);

create index if not exists zune_driver_payment_records_driver_created_idx
  on public.zune_driver_payment_records(driver_id, created_at desc);

alter table public.zune_driver_payment_records enable row level security;

drop policy if exists zune_driver_payment_read_own_or_admin on public.zune_driver_payment_records;
create policy zune_driver_payment_read_own_or_admin
  on public.zune_driver_payment_records for select to authenticated
  using (driver_id = (select auth.uid()) or public.zune_is_admin());

drop policy if exists zune_driver_payment_admin_insert on public.zune_driver_payment_records;
create policy zune_driver_payment_admin_insert
  on public.zune_driver_payment_records for insert to authenticated
  with check (public.zune_is_admin() and created_by = (select auth.uid()));

drop policy if exists zune_driver_payment_admin_update on public.zune_driver_payment_records;
create policy zune_driver_payment_admin_update
  on public.zune_driver_payment_records for update to authenticated
  using (public.zune_is_admin()) with check (public.zune_is_admin());

grant select, insert, update on public.zune_driver_payment_records to authenticated;

create or replace function public.zune_driver_payment_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_earned numeric(14,2) := 0;
  v_paid numeric(14,2) := 0;
  v_paid_gross numeric(14,2) := 0;
  v_pending numeric(14,2) := 0;
  v_delivery_count integer := 0;
  v_payments jsonb := '[]'::jsonb;
  v_deliveries jsonb := '[]'::jsonb;
begin
  if v_uid is null then raise exception 'Tafadhali ingia kwanza.'; end if;
  if not exists (
    select 1 from public.delivery_driver_profiles p
    where p.user_id = v_uid and p.status = 'active'
  ) then raise exception 'Akaunti hii si dereva aliyeidhinishwa wa ZUNE Delivery.'; end if;

  select coalesce(sum(d.driver_payout_amount),0), count(*)
    into v_earned, v_delivery_count
  from public.order_deliveries d
  where d.assigned_driver_id = v_uid
    and d.status = 'completed'
    and d.buyer_confirmed_at is not null
;

  select coalesce(sum(p.net_amount),0), coalesce(sum(p.amount),0)
    into v_paid, v_paid_gross
  from public.zune_driver_payment_records p
  where p.driver_id = v_uid and p.status = 'paid';

  v_pending := greatest(v_earned - v_paid_gross, 0);

  select coalesce(jsonb_agg(x.obj order by x.created_at desc), '[]'::jsonb)
    into v_payments
  from (
    select jsonb_build_object(
      'id', p.id, 'delivery_id', p.delivery_id, 'amount', p.amount,
      'deduction', p.deduction, 'net_amount', p.net_amount,
      'payment_method', p.payment_method, 'payment_phone', p.payment_phone,
      'transaction_reference', p.transaction_reference, 'status', p.status,
      'admin_note', p.admin_note, 'created_at', p.created_at, 'paid_at', p.paid_at
    ) as obj, p.created_at
    from public.zune_driver_payment_records p
    where p.driver_id = v_uid
    order by p.created_at desc
    limit 100
  ) x;

  select coalesce(jsonb_agg(x.obj order by x.created_at desc), '[]'::jsonb)
    into v_deliveries
  from (
    select jsonb_build_object(
      'id', d.id, 'status', d.status, 'delivery_fee', d.delivery_fee,
      'driver_payout_amount', d.driver_payout_amount,
      'payout_status', d.payout_status, 'created_at', d.created_at,
      'buyer_confirmed_at', d.buyer_confirmed_at
    ) as obj, d.created_at
    from public.order_deliveries d
    where d.assigned_driver_id = v_uid
      and d.status in ('completed','delivered')
    order by d.created_at desc
    limit 100
  ) x;

  return jsonb_build_object(
    'currency','TZS',
    'totals', jsonb_build_object(
      'earned',v_earned,'paid',v_paid,'pending',v_pending,
      'completed_deliveries',v_delivery_count
    ),
    'payments',v_payments,
    'deliveries',v_deliveries
  );
end;
$$;

revoke all on function public.zune_driver_payment_dashboard() from public, anon;
grant execute on function public.zune_driver_payment_dashboard() to authenticated;


-- Admin-only recorder used by the separate ZUNE Admin dashboard integration.
-- One payment record per delivery prevents duplicate payouts.
create or replace function public.zune_admin_record_driver_payment(
  p_delivery_id uuid,
  p_amount numeric,
  p_deduction numeric default 0,
  p_payment_method text default 'manual',
  p_payment_phone text default null,
  p_transaction_reference text default null,
  p_status text default 'pending'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_driver_id uuid;
  v_payment_id uuid;
  v_net numeric(14,2);
begin
  if auth.uid() is null or not public.zune_is_admin() then
    raise exception 'Ni Admin Mkuu pekee anayeruhusiwa kurekodi malipo ya dereva.';
  end if;
  if p_amount is null or p_amount < 0 or coalesce(p_deduction,0) < 0 or coalesce(p_deduction,0) > p_amount then
    raise exception 'Kiasi au makato si sahihi.';
  end if;
  if p_status not in ('pending','processing','paid','rejected') then
    raise exception 'Hali ya malipo si sahihi.';
  end if;
  if p_payment_method not in ('mpesa','airtel_money','mixx_by_yas','halopesa','bank','cash','manual') then
    raise exception 'Njia ya malipo haijaruhusiwa.';
  end if;
  select d.assigned_driver_id into v_driver_id
  from public.order_deliveries d
  where d.id=p_delivery_id and d.status='completed' and d.buyer_confirmed_at is not null
  for update;
  if v_driver_id is null then
    raise exception 'Delivery haijakamilika au haijapangiwa dereva.';
  end if;
  v_net := p_amount - coalesce(p_deduction,0);
  update public.order_deliveries
    set driver_payout_amount=p_amount,
        payout_status=case when p_status='paid' then 'paid' else 'awaiting_payout' end
  where id=p_delivery_id;
  insert into public.zune_driver_payment_records(
    driver_id,delivery_id,amount,deduction,net_amount,payment_method,
    payment_phone,transaction_reference,status,created_by,paid_at
  ) values (
    v_driver_id,p_delivery_id,p_amount,coalesce(p_deduction,0),v_net,p_payment_method,
    nullif(trim(coalesce(p_payment_phone,'')),''),nullif(trim(coalesce(p_transaction_reference,'')),''),
    p_status,auth.uid(),case when p_status='paid' then now() else null end
  )
  on conflict (delivery_id) do update set
    amount=excluded.amount,deduction=excluded.deduction,net_amount=excluded.net_amount,
    payment_method=excluded.payment_method,payment_phone=excluded.payment_phone,
    transaction_reference=excluded.transaction_reference,status=excluded.status,
    created_by=excluded.created_by,paid_at=excluded.paid_at
  returning id into v_payment_id;
  return jsonb_build_object('ok',true,'payment_id',v_payment_id,'driver_id',v_driver_id,
    'delivery_id',p_delivery_id,'amount',p_amount,'net_amount',v_net,'status',p_status);
end;
$$;

revoke all on function public.zune_admin_record_driver_payment(uuid,numeric,numeric,text,text,text,text) from public, anon;
grant execute on function public.zune_admin_record_driver_payment(uuid,numeric,numeric,text,text,text,text) to authenticated;
