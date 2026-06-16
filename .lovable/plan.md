# Per-User Readiness Audit: WhatsApp & Reminders

Goal: verify every signed-in user can independently configure and use WhatsApp messaging, automated reminders, and audit logs — with full data isolation and no shared/global secrets blocking adoption.

## What I'll check

### 1. Settings & onboarding (per-user)
- `whatsapp_settings` row auto-created (or lazily upserted) per user; RLS scoped to `auth.uid()`
- `WhatsAppSettings.tsx` lets each user enter their own Twilio SID / token / WhatsApp-from number and per-scenario auto toggles
- Twilio creds stored per-user in DB (not as a single global Supabase secret) — confirm `whatsapp-send` + `_shared/whatsapp.ts` read from the row, not `Deno.env`
- Surface clear empty-state when a user hasn't configured Twilio yet

### 2. Manual send paths (per-user)
- `WhatsAppButton` works for users without Twilio configured (falls back to `wa.me`) and uses Twilio when configured
- `whatsapp-send` edge function authorizes the caller, loads that caller's settings, and logs to `whatsapp_send_log` with their `user_id`
- Verify on Lead detail, Client detail, Clients list, ContractDetail, ProposalView

### 3. Automated crons (per-user fan-out)
- `proposal-follow-up-cron`, `retainer-recovery-cron`, `contract-reminder-cron`, `onboarding-reminder-cron` iterate per-user records and pass the correct `user_id` into `sendWhatsAppFromCron`
- Each cron respects that user's `whatsapp_settings.enabled` + per-scenario toggle
- Idempotency keys include `user_id` or a unique row id so two users can't collide
- Cron schedules registered once (global) but processing is per-row/per-user

### 4. Audit + history visibility
- `reminder_audit_log` RLS: user sees only their own rows; service_role writes
- `whatsapp_send_log` RLS: user sees only their own rows
- `FollowUpStatus.tsx` query is scoped (RLS handles it) and renders per current user
- Add a quick UI surface in Settings for users to see their own recent WhatsApp + reminder audit entries (read-only) — confirm whether this exists or needs to be added

### 5. Grants & policies sanity
- `GRANT`s present on `whatsapp_settings`, `whatsapp_send_log`, `reminder_audit_log` for `authenticated` + `service_role`
- No policy accidentally uses `USING (true)` for cross-user reads
- Edge functions use service-role key server-side only

### 6. End-to-end smoke (read-only)
- Inspect a sample row per table to confirm `user_id` populated
- Check edge function logs for recent successes/failures across multiple users
- Confirm cron-scheduled jobs exist in `cron.job`

## Deliverable
A short report per area: PASS / GAP, with the exact file/policy/function to fix for any GAP. No code changes in this pass — fixes proposed as a follow-up plan once gaps are identified.

## Out of scope
- New features (e.g. inbound WhatsApp, message templates UI) unless a gap blocks per-user usage
- Visual redesign
