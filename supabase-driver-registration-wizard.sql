-- ZUNE Delivery: additional driver onboarding fields.
-- Applied to Supabase project rpkogiieegqgxqbzwxwo.
alter table public.delivery_driver_profiles
  add column if not exists date_of_birth date,
  add column if not exists gender text,
  add column if not exists region text,
  add column if not exists district text,
  add column if not exists residential_area text,
  add column if not exists emergency_phone text,
  add column if not exists emergency_relation text,
  add column if not exists vehicle_ownership text;

alter table public.delivery_driver_profiles
  add constraint delivery_driver_profiles_vehicle_ownership_check
  check (vehicle_ownership is null or vehicle_ownership in ('owned','borrowed','rented','company'));

comment on column public.delivery_driver_profiles.emergency_phone is 'Private emergency contact supplied by the driver.';
comment on column public.delivery_driver_profiles.emergency_relation is 'Relationship of emergency contact to the driver.';
comment on column public.delivery_driver_profiles.vehicle_ownership is 'Driver-reported ownership category; supporting proof may be reviewed by Admin.';
