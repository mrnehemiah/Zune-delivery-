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
