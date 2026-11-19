# ZUNE Delivery

Standalone ZUNE delivery portal. This repository is kept separate from ZUNE Marketplace, ZUNE ACTS (Seller Center), and ZUNE Admin.

## Technology
- HTML, CSS and Vanilla JavaScript (no React/JSX)
- Shared Supabase project: `rpkogiieegqgxqbzwxwo`
- Supabase publishable key in browser only; never ship a service-role key
- Leaflet + OpenStreetMap for delivery maps

## Driver workflow
1. Driver registers independently or uses an Admin invitation.
2. Every application is reviewed by Admin before the driver can receive assignments.
3. Driver uploads the five required documents: national ID, driver portrait, driving licence/permit, vehicle registration card, and valid vehicle insurance.
4. Admin reviews each document. A driver must have an active profile and all required documents approved before assignments are available.
5. Seller selects an active approved driver and confirms parcel handover.
6. Driver confirms pickup, starts transit, shares GPS while the delivery page is open, and marks the parcel delivered.
7. Buyer confirms receipt. Only then does the delivery become completed.

## Main pages
- `index.html`: public landing page and buyer tracking entry
- `signup.html` / `signup.js`: driver self-registration and optional invitation code
- `login.html` / `login.js`: driver sign-in
- `dashboard.html` / `dashboard.js`: refreshed driver dashboard
- `driver-documents.html` / `driver-documents.js`: private document uploads and review status
- `jobs.html` / `jobs.js`: assignments, pickup/transit/delivery actions and GPS sharing
- `tracking.html` / `tracking.js`: buyer-only delivery status, map, timeline and receipt confirmation
- `supabase-delivery-workflow.sql`: delivery lifecycle RPCs and event log
- `supabase-buyer-tracking.sql`: buyer-authorized tracking RPC

## Required driver documents
The private `zune-driver-documents` bucket stores national ID, driver portrait, driving licence/permit, vehicle registration card and vehicle insurance. Vehicle photo and vehicle-use authorization are supporting documents where applicable. Admin review uses short-lived signed URLs.

## Integration boundaries
- Marketplace creates checkout and order-delivery records and owns buyer authentication.
- ZUNE ACTS handles seller-side driver selection and parcel handover.
- ZUNE Admin handles driver applications, document approval, invitations and operational oversight.
- This repository owns the driver portal and customer delivery tracking view.

## Current validation status
The dashboard and buyer tracking UI plus the buyer-scoped tracking RPC have been committed. The live end-to-end order lifecycle still requires a real test order: the current database contains 1 driver profile, 1 driver application, 0 driver documents and 0 delivery rows. Do not treat this as a completed production test until a real order has been assigned, handed over, tracked, delivered and buyer-confirmed.
