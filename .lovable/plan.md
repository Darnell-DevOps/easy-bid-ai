## Client Portal fixes

Two small tweaks in `src/pages/ClientPortal.tsx`, no logic beyond presentation.

### 1. Contract CTA wording after signing
On the agreement card (around line 760), the button currently reads "Review & sign contract" until signed and "View signed contract" after. Change the signed/executed state label to simply **"Review"** as requested.

- When `contract.status === "signed"` or `"executed"` → button label = `Review`
- Otherwise → keep `Review & sign contract`

### 2. Hide "Book your kickoff call" once a call is already booked
Two sections currently show a kickoff CTA:
- Post-payment card (~line 816): "Payment received — we're on it" + Book kickoff button
- Post-signature no-price card (~line 847): "Book your kickoff call"

Both should stop offering a booking action once the client has an active upcoming booking. `upcomingBooking` is already computed at line 474.

Changes:
- Post-payment card: keep the "Payment received" confirmation, but hide the Book button and swap the subtitle to a friendly "Your kickoff call is booked for <date/time>." when `upcomingBooking` exists.
- Post-signature kickoff card: hide the entire section when `upcomingBooking` exists (the Overview already surfaces the upcoming booking).

No changes to data fetching, RPCs, or other files.
