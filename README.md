# ZUNE Delivery

Driver portal for the ZUNE marketplace delivery workflow. Built with vanilla HTML, CSS and JavaScript and connected to the shared Supabase project.

## Driver workflow
- Drivers register and submit an application for Admin review.
- Only approved, active drivers can receive delivery assignments.
- Drivers view assigned deliveries in `jobs.html`.
- Drivers confirm pickup, start transit and mark the parcel delivered.
- During transit, drivers can explicitly turn on GPS sharing. While the jobs page remains open, the app updates the driver's location every 20 seconds. GPS sharing stops when the driver turns it off or leaves the page.
- The jobs queue refreshes automatically every 30 seconds while the page is visible.

## Backend
- Supabase project: `rpkogiieegqgxqbzwxwo`
- Client uses the publishable key only.
- Delivery state changes use authenticated RPCs; the service-role key is never shipped to the browser.

## Main pages
- `index.html`: driver portal and registration entry point.
- `login.html`: driver sign-in.
- `jobs.html`: assigned delivery queue and delivery actions.

## Driver verification
- Drivers complete their profile and upload verification documents from `driver-documents.html`.
- Required documents: national ID, driver portrait, driving licence, vehicle registration card and valid vehicle insurance.
- Vehicle photo and vehicle-use authorization are optional/conditional supporting documents.
- Documents are stored in the private `zune-driver-documents` bucket. Each driver can access only their own files; Admin uses short-lived signed URLs for review.
- Admin approval is blocked until all five required document types have been individually approved.
