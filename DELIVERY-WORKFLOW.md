# ZUNE Delivery workflow

This repository contains the driver portal (vanilla HTML/CSS/JavaScript + Supabase).

## Delivery confirmation workflow
1. Seller assigns an Admin-approved active driver to the seller's delivery row.
2. Seller confirms handover of the parcel.
3. Assigned driver confirms pickup, starts transit and uploads a private JPG/PNG/WEBP proof photo (maximum 8 MB) before marking delivered.
4. Buyer views the proof photo through a short-lived signed URL and confirms receipt in ZUNE Marketplace.
5. Only after buyer confirmation does the delivery enter `completed`. Admin records the driver's gross payout in the Driver Payouts panel. ZUNE automatically deducts the approved fixed 3% delivery commission and credits it to Admin Wallet after payment confirmation; the driver receives the remaining 97%. An open order dispute automatically places unpaid driver payouts on hold until Admin resolves it. No mobile-money transfer is sent automatically; `paid` is recorded only after Admin confirms the transfer was made.

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
- `jobs.html` / `jobs.js`: assigned jobs, pickup/transit confirmations, mandatory proof-photo upload before delivery, GPS sharing, refresh and sign-out
- `supabase-delivery-proof-of-delivery.sql`: private storage bucket, driver upload and buyer/Admin read policies, and RPC-enforced proof requirement

Driver accounts are created with Supabase Auth. After email confirmation (if enabled), the driver signs in; the portal creates the pending driver profile/application under the signed-in identity. Admin approval is required before the driver is listed as eligible for new assignments. The assignment RPC and Admin active-driver list use one expiry-aware eligibility function. The driver queue continues to show existing assigned deliveries so a driver can safely finish work already handed over. Eligibility requires: national ID, driver photo, vehicle registration and insurance are required; a driving licence is additionally required for motorized vehicles. License and insurance approvals must have a future expiry date. Motorized drivers must also have both `vehicle_registration` and `license_number` populated in their profile before new assignments are allowed; bicycles do not require a driving-license field.

## Driver account and vehicle changes
- Drivers can update their profile photo and submit a vehicle-detail change request from Account.
- The currently approved vehicle remains active until Admin approves the request in Admin → List ya Driver → Maombi ya kubadilisha chombo.
- Drivers cannot insert or alter review records directly; the request is stored through an authenticated, owner-bound RPC and reviewed through an Admin-only RPC.

## GPS and operational limitations
- Live GPS updates are sent every 20 seconds only while the delivery page is open, visible and the driver grants location permission. This portal does not claim background tracking. Proof photos are private: only the assigned driver, the buyer for that delivery and Admin can read them. The database refuses the driver's delivered transition until the uploaded proof object is saved and linked to that delivery.
- The driver wallet is read-only for drivers. It shows gross earnings, the automatic 3% Admin Wallet commission, net earnings, paid/pending amounts and any amount held by an open dispute. Admin records payouts; there is no driver withdrawal request or automated payout rail in this portal.

## Driver notifications
- `notifications.html` is the live notification inbox. It reads the existing `public.notifications` table under its owner-scoped RLS policies.
- Drivers can filter all/unread/read notifications, mark one or all as read, open the related portal page, and delete their own notification.
- The unread badge is shared across the driver's mobile navigation and updates through Supabase Realtime.
- Database triggers create notifications for delivery assignment/status changes, driver application review, document review, vehicle-change review and recorded driver payouts.
- Notifications are in-app only. Push, SMS and email delivery are not claimed by this portal.
- Database SQL source: `supabase-driver-notifications.sql`.
