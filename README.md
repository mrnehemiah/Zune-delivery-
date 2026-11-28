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
6. Driver confirms pickup, starts transit, shares GPS while the delivery page is open, uploads a delivery-proof photo, and marks the parcel delivered.
7. Buyer views the private proof photo and confirms receipt. Only then does the delivery become completed.

## Main pages
- `index.html`: public landing page and buyer tracking entry
- `signup.html` / `signup.js`: driver self-registration and optional invitation code
- `login.html` / `login.js`: driver sign-in
- `dashboard.html` / `dashboard.js`: refreshed driver dashboard
- `driver-documents.html` / `driver-documents.js`: private document uploads and review status
- `jobs.html` / `jobs.js`: assignments, pickup/transit/delivery actions and GPS sharing
- `tracking.html` / `tracking.js`: buyer-only delivery status, map, timeline, private proof-of-delivery photo and receipt confirmation
- `supabase-delivery-proof-of-delivery.sql`: private driver-uploaded delivery evidence and buyer/Admin-only viewing
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
The driver dashboard, buyer tracking UI, buyer-scoped tracking RPC, driver wallet, and private proof-of-delivery photo workflow are committed. The shared database currently contains 1 driver profile, 1 driver application, 6 driver-document records, 4 delivery rows, and 3 driver payment records. A live end-to-end test using real buyer, seller and driver sessions is still required before production readiness.


## Driver eligibility and Admin controls (latest)
- The database migration `supabase-driver-eligibility-and-admin-controls.sql` is applied to the shared Supabase project.
- Seller/Admin driver lists now return only active drivers with all five required documents approved and not expired.
- Driver assignment independently checks the same five documents, so a direct RPC call cannot bypass document review.
- Admin suspend/restore is available through `zune_admin_set_delivery_driver_status(p_driver_user_id, p_status, p_reason)`. It is Admin-only, requires a reason, blocks restoration when a required document is missing/expired, and writes `delivery_driver_audit_logs`.
- The helper `zune_delivery_driver_has_required_documents(p_driver_id)` is internal and not executable by browser roles.

## Production test still required
The latest database audit reports 1 driver profile, 1 application, 6 document records (all currently approved), 4 delivery rows (1 assigned and 3 completed), and 3 driver payment records (all currently marked paid). These records show that the database has progressed beyond the older zero-document/zero-delivery snapshot, but they do not replace a fresh cross-account E2E test. Verify assignment, seller handover, driver acceptance/pickup, GPS updates, proof-photo upload and buyer-only viewing, buyer receipt confirmation, Admin payout recording, and driver-only wallet visibility using real accounts. Confirm the latest GitHub Pages deployment and Admin UI wiring for driver suspend/restore before calling the whole service production-ready.


## Guided driver registration rebuild
- The driver signup screen is now a four-step mobile-first wizard: account credentials, personal details, vehicle details, and final review/submit.
- The wizard preserves the optional Admin invitation code and sends email confirmation back to the Delivery login page.
- Date of birth, gender, region, district, residential area, emergency contact and vehicle ownership are persisted to the driver profile after first authenticated login.
- The migration `supabase-driver-registration-wizard.sql` adds the corresponding optional columns without deleting or rewriting existing driver data.
- NIDA front/back images are combined into one JPEG record to preserve the current `national_id` document type and existing Admin review workflow. A combined PDF is also accepted.
- Vehicle-use authorization becomes required when the saved vehicle ownership is not `owned`.
- Driver payout details are deliberately not collected during public signup. They should be added as a separate verified payout-method workflow after driver approval; never request a mobile-money PIN or OTP.
- The database's existing five-document assignment gate remains unchanged. Bicycle applicants are shown an Admin-reviewable evidence prompt rather than having required document cards hidden from the UI.
