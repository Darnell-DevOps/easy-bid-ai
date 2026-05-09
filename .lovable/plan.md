
# SMS + WhatsApp notifications + WhatsApp AI agent

Three layers, built in this order so each one is usable on its own.

---

## Layer 1 — SMS notifications (Twilio)

**Setup**
- Connect the Twilio connector (handles `TWILIO_API_KEY` automatically via the Lovable gateway — no manual secrets).
- Add settings fields so you can enter:
  - Your Twilio sender number (the "From" number)
  - Your own mobile number (for host alerts)
- Add a phone field to the public booking form. Optional by default; required if you want SMS confirmations enforced.

**Database**
- `bookings.client_phone` (text, nullable)
- `notification_preferences` table per user: toggles for `sms_client_confirm`, `sms_client_cancel`, `sms_client_reminder`, `sms_host_new_booking`, plus `host_phone` and `twilio_from_number`.
- `sms_send_log` table mirroring `email_send_log` (idempotency_key unique, status, provider_id, error).
- `phone_suppressions` table (opt-out list).

**Edge function: `send-sms`**
Mirrors `send-email`:
- Idempotency check on `sms_send_log`
- Suppression check
- Render short message from a named template (`booking-confirmation`, `booking-cancelled`, `booking-reminder`, `booking-host-alert`)
- POST to Twilio gateway `/Messages.json`
- Log result

**Wire-up points** (already exist for email — add SMS calls beside them):
- `PublicBookingPage.tsx` → on booking create → SMS to client + SMS to host
- `CalendarPage.tsx` `cancelBooking` → SMS to client
- `booking-reminder-cron` → also send SMS

**STOP / opt-out**: Twilio auto-handles STOP keywords; we listen for them via inbound webhook and write to `phone_suppressions`.

---

## Layer 2 — WhatsApp notifications

Same Twilio account, same `send-sms` function — just prefix `whatsapp:` on `To`/`From`. Add a `channel` arg (`sms` | `whatsapp`) and a `notification_preferences.whatsapp_*` toggle set.

**Important caveats** (Meta rules, not us):
- Sandbox works immediately for testing.
- Production requires a Twilio-approved WhatsApp sender + **pre-registered message templates** for any message sent outside a 24-hour customer window. We'll register 4 templates (confirmation, cancellation, reminder, host alert) with placeholders that match the email templates.
- I'll add a settings panel that shows template approval status and a "Use sandbox for now" toggle so you can test today.

---

## Layer 3 — Inbound WhatsApp AI agent

A client texts your WhatsApp number → AI replies → can answer FAQs, qualify leads, book meetings, or hand off to you.

**Flow**
```text
Client WhatsApp msg
   ↓
Twilio inbound webhook → edge function `whatsapp-agent`
   ↓
Look up / create conversation + lead
   ↓
Lovable AI Gateway (google/gemini-2.5-flash) with tools:
   • get_services_info        (reads your FAQ/service config)
   • check_availability       (queries booking_links + bookings)
   • create_booking           (writes a booking, sends confirmations)
   • save_lead_info           (upserts into clients table)
   • request_human_handoff    (flips conversation to "needs_attention", SMS-alerts you)
   ↓
Reply via Twilio WhatsApp send
   ↓
Persist message in conversation history
```

**Database**
- `wa_conversations` (id, user_id [host], client_phone, client_name nullable, lead_id nullable, status: `active`/`needs_attention`/`closed`, last_message_at, ai_enabled bool)
- `wa_messages` (conversation_id, role: `user`/`assistant`/`system`/`tool`, content, parts jsonb, created_at)
- `agent_settings` per user: business name, services blurb, FAQ entries, tone, default booking_link_id, handoff trigger phrases, after-hours behavior

**Edge functions**
- `whatsapp-agent` — Twilio webhook receiver + AI loop (uses Vercel AI SDK `generateText` with tools, `stopWhen: stepCountIs(50)`)
- `whatsapp-send` — outbound helper (extracted from `send-sms` for reuse)

**Frontend**
- New `/agent` page in dashboard:
  - **Settings tab**: configure business info, FAQs, default booking link, tone, handoff phrases, AI on/off per conversation
  - **Conversations tab**: list of WhatsApp threads, click into a thread to read full transcript, manually send a message, toggle AI off (handoff), mark closed
  - **Notifications**: when a thread flips to `needs_attention`, you get an SMS + in-app toast

**Safety rails**
- AI never books outside your configured booking link availability.
- AI confirms booking details with the client before calling `create_booking`.
- Rate limit per phone number (in-memory + DB) to prevent SMS pumping abuse.
- All tools are server-side; AI cannot access other users' data (every query scoped by `user_id` from the conversation).

---

## Settings & UX changes

- **Settings page** gets two new sections: "SMS & WhatsApp notifications" (channel toggles per event, sender numbers, host number) and "WhatsApp AI agent" (business info, FAQs, default booking link, AI on/off, handoff config).
- **Public booking form**: optional phone field with a "Text me a confirmation" checkbox.
- **Calendar page**: cancellation modal mentions which channels will notify the client.

---

## Build order (so you can use each piece as it lands)

1. Twilio connector + `send-sms` + booking confirmation/cancel/reminder/host alert SMS + settings UI. **(~1 round)**
2. Add WhatsApp channel to same function + sandbox testing + production template registration helper. **(~½ round)**
3. Inbound webhook + AI agent + conversations UI. **(1–2 rounds, biggest piece)**

---

## Technical details (skip if not interested)

- **Vercel AI SDK** with `@ai-sdk/openai-compatible` + Lovable AI Gateway (`google/gemini-2.5-flash` for cost; `gemini-2.5-pro` for hard cases). System prompt built from `agent_settings`.
- Tools defined with Zod schemas; `create_booking` reuses the same insert path as `PublicBookingPage` so it triggers existing email + SMS notifications automatically.
- Twilio webhooks signed-request verification using Twilio's signature header (no auth on the public webhook, but we verify `X-Twilio-Signature`).
- Reuse `buildIcs` from `src/lib/bookings.ts` so AI-created bookings still get calendar invites.
- `wa_conversations` + `wa_messages` RLS: only the host owner can read; webhook function uses service role.
- Inbound STOP/STOPALL/UNSUBSCRIBE → suppression list (Twilio also blocks at carrier level).

---

## What I need from you to start

- Confirm the build order (or tell me to do everything in one go).
- Confirm you want to start in Twilio sandbox for WhatsApp (instant) vs waiting on production sender approval (days).
- Confirm the AI model choice — Gemini 2.5 Flash is the sweet spot for this; say if you'd rather use GPT-5-mini or Gemini 2.5 Pro.
