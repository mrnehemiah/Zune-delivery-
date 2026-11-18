-- Private driver onboarding documents. The bucket is intentionally not public.
alter table public.delivery_driver_profiles
  add column if not exists national_id_photo_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'zune-driver-documents',
  'zune-driver-documents',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp','application/pdf']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "ZUNE drivers upload own documents" on storage.objects;
create policy "ZUNE drivers upload own documents"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'zune-driver-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (select 1 from public.delivery_driver_profiles d where d.user_id = auth.uid() and d.status = 'pending')
);

drop policy if exists "ZUNE drivers view own documents and admins review" on storage.objects;
create policy "ZUNE drivers view own documents and admins review"
on storage.objects for select to authenticated
using (
  bucket_id = 'zune-driver-documents'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.zune_is_admin())
);

drop policy if exists "ZUNE drivers update own pending documents" on storage.objects;
create policy "ZUNE drivers update own pending documents"
on storage.objects for update to authenticated
using (
  bucket_id = 'zune-driver-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (select 1 from public.delivery_driver_profiles d where d.user_id = auth.uid() and d.status = 'pending')
)
with check (
  bucket_id = 'zune-driver-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (select 1 from public.delivery_driver_profiles d where d.user_id = auth.uid() and d.status = 'pending')
);

drop policy if exists "ZUNE drivers delete own pending documents" on storage.objects;
create policy "ZUNE drivers delete own pending documents"
on storage.objects for delete to authenticated
using (
  bucket_id = 'zune-driver-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (select 1 from public.delivery_driver_profiles d where d.user_id = auth.uid() and d.status = 'pending')
);
