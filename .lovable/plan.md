
# WhatsApp Integration Plan

Two phases delivered together: (A) instant click-to-chat links everywhere a contact has a phone number, (B) Twilio-powered automated WhatsApp reminders for proposals, payments, contracts, and onboarding.

## Phase A — Click-to-chat (wa.me) across the lifecycle

### 1. Shared helper
Create `src/lib/whatsapp.ts`:
- `toE164Digits(phone)` — strip non-digits, drop leading `+`, validate length
- `waLink(phone, message?)` — returns `https://wa.me/<digits>?text=<encoded>` or null
- `buildWaMessage(template, vars)` — small templater for default messages per context (lead intro, proposal share, contract reminder, onboarding link, payment reminder)

### 2. Reusable UI component
`src/components/whatsapp/WhatsAppButton.tsx`:
- Props: `phone`, `message`, `variant` (icon | button | menu-item), `label`
- Renders disabled state with tooltip ("No phone on file") when phone missing
- Uses lucide `MessageCircle` + brand green accent badge consistent with dark theme tokens

### 3. Surfaces to add the button/menu item
- **Lead detail / LeadAssistant** — alongside call/email actions
- **LeadInbox** — row action
- **Client detail page** — header action bar + quick-actions card
- **Clients list** — row action menu
- **Proposal page (owner view)** — "Share via WhatsApp" with pre-filled link to the proposal + tracked via existing follow-up history (logs a `proposal_follow_ups` row with `scenario = 'manual_whatsapp'` if we want; decide in step 5)
- **Contracts** — "Send signing link via WhatsApp" on contract detail
- **Onboarding** — "Send onboarding form via WhatsApp" on onboarding session
- **Retainer / invoices** — "Send payment reminder via WhatsApp" on overdue retainer row

### 4. Default messages
Centralize in `whatsapp.ts` with merge-tag-style placeholders reusing existing client/proposal names. Each surface passes its context object.

## Phase B — Twilio automated WhatsApp sends

### 1. Connector
Use the Twilio App connector via `standard_connectors--connect` (connector_id `twilio`). User must already have an approved WhatsApp sender on their Twilio account (`whatsapp:+1...`). Surface a settings card explaining setup + sender number input.

### 2. Settings
New table `whatsapp_settings` (per user):
- `whatsapp_from` (E.164 with `whatsapp:` prefix)
- `enabled` boolean
- `auto_proposal_reminders`, `auto_payment_reminders`, `auto_contract_reminders`, `auto_onboarding_reminders` booleans
- RLS: owner-only; service_role full
UI: new "WhatsApp" section in `IntegrationsSettings.tsx` (connection status + sender) and toggles in `AutomationsSettings.tsx`.

### 3. Send pipeline
Shared edge helper `supabase/functions/_shared/whatsapp.ts`:
- `sendWhatsApp({ userId, to, body, idempotencyKey })`
- Loads user's `whatsapp_settings`, calls Twilio gateway `/Messages.json` with `To=whatsapp:+...`, `From=<whatsapp_from>`, `Body`
- Logs to `whatsapp_send_log` (new table: user_id, to, body, twilio_sid, status, error, idempotency_key UNIQUE, sent_at)
- Idempotency: skip if `idempotency_key` already present in last 5 minutes

### 4. New edge functions
- `whatsapp-send` — authenticated, owner-only manual send (used by UI "Send WhatsApp now" buttons that prefer API over wa.me when sender configured)
- `whatsapp-test` — sends a test message to a given number
- Extend existing crons to also dispatch WhatsApp when the respective auto toggle is on:
  - `proposal-follow-up-cron` → WhatsApp variant
  - `retainer-recovery-cron` → WhatsApp variant
  - Contract reminder cron (create `contract-reminder-cron` if not present, or piggy-back existing)
  - Onboarding reminder cron (same approach)

### 5. Proposal follow-up integration
Extend `proposal_follow_ups` schema with `channel` ('email' | 'whatsapp') so the existing FollowUpStatus card shows both. Update `FollowUpStatus.tsx` to render channel icon and filter history.

### 6. UI hooks
- On proposal/contract/onboarding/retainer pages, when Twilio is connected, the WhatsApp button offers two modes: "Open WhatsApp" (wa.me) and "Send via Twilio" (server send, logged, idempotent).
- Show last WhatsApp send timestamp on each entity card pulling from `whatsapp_send_log`.

## Migrations summary
1. `whatsapp_settings` table + RLS + GRANTs + updated_at trigger
2. `whatsapp_send_log` table + RLS + GRANTs + unique idempotency_key
3. Add `channel` column to `proposal_follow_ups` (default 'email')

## Files to create
- `src/lib/whatsapp.ts`
- `src/components/whatsapp/WhatsAppButton.tsx`
- `src/components/settings/WhatsAppSettings.tsx` (or section in IntegrationsSettings)
- `supabase/functions/_shared/whatsapp.ts`
- `supabase/functions/whatsapp-send/index.ts`
- `supabase/functions/whatsapp-test/index.ts`

## Files to edit
- Lead/Client/Proposal/Contract/Onboarding/Retainer pages — add WhatsApp button
- `IntegrationsSettings.tsx`, `AutomationsSettings.tsx` — WhatsApp config + toggles
- `proposal-follow-up-cron`, `retainer-recovery-cron` — WhatsApp dispatch
- `FollowUpStatus.tsx` — show channel
- `src/integrations/supabase/types.ts` — regenerated after migrations

## Out of scope (call out)
- Inbound WhatsApp webhooks / two-way conversations (separate phase; needs message storage UI)
- WhatsApp Business template approval workflow — user must manage templates in Twilio console; we send freeform within 24h session or pre-approved template strings they paste into settings

## Open prerequisite
User needs a Twilio account with an approved WhatsApp sender before Phase B sends will work. Phase A (wa.me) works immediately with no setup.
