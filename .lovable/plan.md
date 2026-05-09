# SMS Notifications (Twilio) — Layer 1 Only

Add Twilio SMS notifications for the four key booking events. WhatsApp and AI agent are explicitly deferred until there's revenue/demand to justify them.

## Scope — 4 SMS events

1. **Booking confirmed** → SMS to client (when public booking is created)
2. **Booking cancelled** → SMS to client (when host cancels in CalendarPage)
3. **24h reminder** → SMS to client (via existing booking-reminder cron)
4. **New booking alert** → SMS to host (you), so you get pinged on every fresh booking

Each event has a per-user on/off toggle. All four default OFF until the user enables them in Settings (no surprise SMS bills).

## Multi-tenancy model (start simple)

**Shared Twilio account, shared "from" number** owned by CloseSync.
- One Twilio connection at the workspace level.
- All users send from the same `+1...` number.
- Client SMS reads: `"Hi {client_name}, your meeting with {host_name} on {date} is confirmed. Reply STOP to opt out."` — host name is in the body, not the sender ID.
- Host alerts go to the host's own phone number stored on their profile.

This is the cheapest, fastest path. When a user later asks "I want my own number," we add a Pro tier with bring-your-own-Twilio (out of scope for this plan).

## Database changes

**`bookings`** — add column:
- `client_phone` (text, nullable) — collected on the public booking form

**`notification_preferences`** — new table (one row per user):
- `user_id` (unique)
- `host_phone` (text, nullable) — E.164, where host alerts go
- `sms_client_confirm` (bool, default false)
- `sms_client_cancel` (bool, default false)
- `sms_client_reminder` (bool, default false)
- `sms_host_new_booking` (bool, default false)
- RLS: owner-only CRUD

**`sms_send_log`** — new table (idempotency + audit + cost visibility):
- `user_id`, `recipient`, `template`, `status` (pending/sent/failed), `provider_id` (Twilio SID), `error`, `idempotency_key` (unique), `meta` jsonb
- RLS: owner-read-only (matches `email_send_log` pattern)

**`phone_suppressions`** — new table:
- `phone` (PK), `reason`, `created_at`
- Populated when Twilio reports STOP / undeliverable. No RLS needed (service-role-only writes).

## Edge function: `send-sms`

One internal function called by other edge functions and triggers.

- Validates input with Zod (`to`, `template`, `vars`, `user_id`, `idempotency_key`)
- Checks `notification_preferences` for the relevant toggle — bails if off
- Checks `phone_suppressions` — bails if suppressed
- Renders template (4 short templates, ~140 chars each, all include "Reply STOP to opt out")
- Calls Twilio gateway: `POST /Messages.json` with `URLSearchParams`
- Writes `sms_send_log` row (idempotent on `idempotency_key`)
- Returns `{ ok, sid }`

Twilio handles STOP/HELP automatically at the carrier level, but we still mirror suppressions locally to skip API calls.

## Wiring (3 touch points)

1. **`src/pages/PublicBookingPage.tsx`** — add optional phone field; after booking insert, invoke `send-sms` for `client_confirm` and `host_new_booking`.
2. **`src/pages/CalendarPage.tsx` `cancelBooking`** — invoke `send-sms` for `client_cancel` (mirrors the email we already added last session).
3. **`booking-reminder` cron edge function** — for each booking 24h out with a phone on file, invoke `send-sms` for `client_reminder`.

## UI

New section in **Settings → Notifications** (or extend existing settings page):
- Host phone input (E.164 with simple validation)
- Four toggles for the four events
- Small note: "SMS uses your CloseSync number. Standard SMS rates apply to your account when usage exceeds the free tier."

## Setup steps (in order)

1. Connect Twilio connector → user picks/creates a Twilio API Key in the picker.
2. Ask user for the **Twilio "from" phone number** (stored as a project secret `TWILIO_FROM_NUMBER`, since it's not part of the connector key).
3. Run migration (4 schema changes above).
4. Build `send-sms` edge function.
5. Wire the 3 touch points.
6. Add Settings UI.
7. Smoke-test end-to-end with a real phone number.

## Explicitly out of scope (deferred)

- WhatsApp channel (Layer 2)
- Inbound WhatsApp AI agent (Layer 3)
- Per-user Twilio numbers / bring-your-own-Twilio
- SMS for proposal/contract/retainer events (can add later same pattern)
- Two-way SMS replies / inbound webhook

## Cost expectations to set with the user

- US SMS: ~$0.0079 per segment outbound
- Twilio US number rental: ~$1.15/month
- Realistic cost for a user doing 50 bookings/month with all 4 toggles on: ~$1.50–2.00/month in SMS

## Build order

One round, in this order:
1. Twilio connector + `TWILIO_FROM_NUMBER` secret
2. Migration
3. `send-sms` edge function
4. Wire booking confirm + host alert in PublicBookingPage
5. Wire cancel in CalendarPage
6. Wire reminder in cron
7. Settings UI
8. Test
