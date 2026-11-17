# ZUNE Delivery workflow

This repository contains the driver portal (vanilla HTML/CSS/JavaScript + Supabase).

## Delivery confirmation workflow
1. Seller assigns an Admin-approved active driver to the seller's delivery row.
2. Seller confirms handover of the parcel.
3. Assigned driver confirms pickup, starts transit, and marks delivered.
4. Buyer confirms receipt in ZUNE Marketplace.
5. Only after buyer confirmation does the delivery enter `completed`; payout remains `awaiting_allocation` until ZUNE's approved payout split and payment rail are configured.

## Supabase
Project: `rpkogiieegqgxqbzwxwo`
Existing `order_deliveries` rows are extended with driver assignment, confirmation timestamps, GPS fields and payout state. `zune_delivery_events` stores an append-only timeline. RPCs enforce the actor at each step and RLS limits event reads to the buyer, seller, assigned driver and Admin.

## Pages
- `index.html`: welcome and driver dashboard
- `login.html` / `login.js`: dedicated driver sign-in
- `signup.html` / `signup.js`: dedicated driver registration and application submission
- `forgot-password.html` / `forgot-password.js`: request password recovery
- `reset-password.html` / `reset-password.js`: set a new password after the recovery link
- `auth-shared.js`: shared Supabase client and driver-application bootstrap
- `jobs.html` / `jobs.js`: assigned jobs, pickup/transit/delivery confirmations, GPS sharing, refresh and sign-out

Driver accounts are created with Supabase Auth. After email confirmation (if enabled), the driver signs in; the portal creates the pending driver profile/application under the signed-in identity. Admin approval is required before the driver queue RPC returns assignments.
