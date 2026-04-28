# Renewal & Payment Recovery

Add a proper recovery + renewal layer on top of the existing retainers system. Today we *detect* failures and "renewing soon" but never act on them or expose them to clients.

## What we'll build

### 1. Webhook upgrades (`payments-webhook`)
- Handle `past_due` subscription status (currently falls through as raw string).
- On `transaction.payment_failed`: write a `retainer_invoices` row with `status='failed'` + reason, increment retry counter.
- On `transaction.completed` for a retry: mark prior failed invoice `recovered_at`.
- New retainer fields: `payment_retry_count`, `payment_recovered_at`, `last_recovery_email_at`.

### 2. Client-facing recovery page
- New public route `/r/recover/:token` (uses existing `retainers.access_token`).
- Shows: "Hi {client}, the last payment for {retainer} didn't go through. Update your payment method to keep things running."
- Button calls `retainer-portal-session` (modified to accept token instead of auth) → opens Paddle customer portal in new tab.
- Token-gated, no login required.

### 3. Renewal automation
- New `retainer_reminders` table: `retainer_id`, `kind` (`renewal_t30|renewal_t14|renewal_t7|payment_failed|payment_final`), `scheduled_for`, `sent_at`, `channel`.
- Cron edge function `retainer-recovery-cron` (hourly): scans active retainers, queues reminders for renewal windows + dunning.
- "Generate renewal proposal" button on `RetainerDetail` → prefills `NewProposal` with retainer's client + service, links back via `proposal.client_id`.

### 4. Email delivery
- Use `setup_email_infra` + `scaffold_transactional_email` to provision the email queue.
- Three templates: `payment_failed_client`, `renewal_upcoming_client`, `payment_final_attempt_client`.
- Cron enqueues; existing `process-email-queue` sends.
- Each email links to `/r/recover/:token` (recovery) or includes a friendly renewal nudge.

### 5. Recovery dashboard
- New page `/dashboard/recovery` + sidebar nav entry.
- Two tabs: **Failed payments** (active dunning) and **Renewing soon** (≤30 days to `end_date`).
- Each row: client, amount, status badge (`Retrying` / `Final attempt` / `Recovered` / `Renewing in N days`), actions (Resend recovery email, Open portal link, Generate renewal proposal, Mark resolved).
- Replaces the inline banners on `RetainersWidget` with a "View recovery queue (N)" link.

### 6. Status surfacing
- `past_due` badge on `RetainerDetail` and `RetainersPage` rows.
- AI Coach Feed already reads `has_failed_payment`; extend prompt with retry count + days since failure for sharper recommendations.

## Files

**New**
- `src/pages/RecoveryDashboard.tsx`
- `src/pages/RetainerRecoverPage.tsx` (public)
- `src/components/recovery/RecoveryQueue.tsx`
- `src/components/recovery/RenewalQueue.tsx`
- `supabase/functions/retainer-recovery-cron/index.ts`
- `supabase/functions/retainer-recover-portal/index.ts` (token-based portal session)
- `supabase/migrations/<ts>_recovery.sql` (new columns + `retainer_reminders` table + RLS)
- 3 email template edge functions (via scaffold tool)

**Edited**
- `supabase/functions/payments-webhook/index.ts` — past_due, failed invoice rows, retry counter, recovery detection
- `src/pages/RetainerDetail.tsx` — past_due badge, "Generate renewal proposal" button, recovery link copy
- `src/components/dashboard/RetainersWidget.tsx` — link to recovery queue instead of inline lists
- `src/components/DashboardLayout.tsx` — Recovery nav item
- `src/App.tsx` — new routes
- `supabase/functions/ai-coach-feed/index.ts` + `ai-churn-risk/index.ts` — include retry count

## Setup steps (in order)
1. Migration: new table + columns.
2. `setup_email_infra` then `scaffold_transactional_email` (asks user for domain if not configured).
3. Webhook + cron + recovery edge functions.
4. UI pages.
5. Cron schedule via insert tool (hourly).

## Open question
Email sending requires a verified domain. If you don't have one yet I'll set up the infra and surface the domain-verification step; recovery dashboard + manual actions still work without email.
