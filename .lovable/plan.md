# Plan: Resend-powered transactional emails

Hostinger doesn't allow NS records on subdomains, so we'll use the **Resend connector** instead. Resend only needs standard TXT/CNAME records, which Hostinger fully supports.

## What you'll do (once, ~10 min)
1. Create a free Resend account at resend.com.
2. Add the domain `closesync.io` (or `notify.closesync.io`) in Resend → Domains.
3. Resend gives you ~4 records (SPF TXT, DKIM CNAMEs, optional DMARC TXT). Paste them into Hostinger's DNS manager.
4. Connect Resend in Lovable when prompted; verification typically completes in minutes.

## What I'll build

### 1. Connect Resend
- Call the Resend connector → exposes `RESEND_API_KEY` to edge functions.

### 2. Shared sender edge function
- New `supabase/functions/send-email/index.ts` — single entry point that:
  - Looks up a template by `templateName`
  - Renders HTML with passed `data` (recipient name, amount, links, etc.)
  - Sends via Resend gateway (`POST /emails`)
  - Logs send to a new `email_send_log` table (status, provider id, error)
  - Honors a new `email_suppressions` table (skips if recipient suppressed)
  - Idempotency via `idempotency_key` (unique index — duplicate inserts no-op)

### 3. Templates (premium dark-on-white, CloseSync brand)
HTML strings in `supabase/functions/_shared/email-templates/`:
- `welcome` — onboarding after signup
- `proposal-sent` — to client when proposal is sent
- `contract-signature-reminder` — to client when contract pending
- `payment-confirmation` — to client after successful payment
- `payment-failed` — to owner when retainer charge fails (T+0, T+3, final)
- `renewal-reminder` — to owner T-30 / T-14 / T-7
- `retainer-notification` — generic retainer status updates
- `booking-confirmation` — to client after booking
- `follow-up-reminder` — to owner for proposal follow-ups

Each template: minimal layout, brand mark, single CTA button, plain-text fallback.

### 4. Wire existing flows to send real emails (alongside in-app)
- **`retainer-recovery-cron`** — after each `retainer_reminders` upsert, also invoke `send-email` for the appropriate template (renewal_t30/14/7, payment_failed, payment_final). Keeps in-app reminder.
- **`payments-webhook`**:
  - `TransactionCompleted` (proposal) → `payment-confirmation` to client
  - `TransactionCompleted` (retainer) → `payment-confirmation` to client
  - `TransactionPaymentFailed` → `payment-failed` to owner
- **Proposal "send" action** (client code) → `proposal-sent` to client
- **Contract sent** → `contract-signature-reminder` to client (immediate); cron-based reminders deferred to v2
- **Onboarding signup** → `welcome` to user
- **Booking created** → `booking-confirmation` to client
- **Follow-up scheduled** → `follow-up-reminder` to owner at due time (cron)

### 5. Database (one migration)
```text
email_send_log(id, user_id, template, recipient, status, provider_id,
               error, idempotency_key UNIQUE, created_at)
email_suppressions(email PRIMARY KEY, reason, created_at)
```
RLS: owners read their own log rows; service role writes.

## Out of scope (for now)
- Marketing/broadcast emails
- Resend webhook for bounces/complaints (can add later to auto-populate suppressions)
- Custom unsubscribe page (Resend's default + a List-Unsubscribe header is enough at current volume)

## Order of operations
1. Migration (tables + RLS)
2. Resend connector
3. `send-email` function + templates
4. Wire cron + webhook + client triggers
5. Deploy + smoke test (send `welcome` to your own address)

After approval I'll start with the migration.