# Proposal Auto Follow-Up

Currently `src/lib/follow-up.ts` derives the right follow-up scenario from a proposal's timestamps, and `FollowUpDialog` lets the user copy or open mailto. Nothing runs in the background. We'll add a scheduled job that mirrors how `retainer-recovery-cron` works for retainers, but for proposals — and it only fires when the user has opted in via Settings → Automations.

## What gets built

1. **`proposal_follow_ups` table** (idempotency log) — one row per `(proposal_id, scenario)` so the same nudge is never sent twice.
2. **`proposal-follow-up-cron` edge function** — hourly job that scans proposals, matches each one against `getFollowUpScenario`, checks the owner's automation prefs, and queues a send through the existing `send-email` function.
3. **pg_cron schedule** — runs every hour via `pg_net` (same pattern as `retainer-recovery-cron`).
4. **Two new default email templates** — `proposal-follow-up-nudge` and `proposal-payment-reminder`, registered with the existing transactional email registry. Bodies are derived from `buildFollowUpTemplate` so manual and auto follow-ups read identically.

## How it decides to send

For each proposal where `status IN ('sent','viewed','accepted')` and `client_paid = false`:

- Compute scenario via the shared logic in `src/lib/follow-up.ts` (port to the edge function as `_shared/follow-up.ts`).
- Skip if scenario is `none`.
- Skip if no `client_email` resolvable (proposal's linked client has no email).
- Map scenario → automation preference:
  - `not_viewed_24h` / `viewed_no_action_48h` → `proposal_follow_up`
  - `accepted_unpaid_24h` → `payment_follow_up_unpaid`
- Skip if that preference is `false` for the owner.
- Skip if a `proposal_follow_ups` row already exists for `(proposal_id, scenario)`.
- Otherwise: insert the log row, then invoke `send-email` with idempotency key `proposal-followup-{id}-{scenario}`.

## Owner visibility

- After sending, write a `user_notifications` row ("Follow-up sent to {client} — {scenario badge}") so the owner sees what the system did on their behalf.
- `ProposalView` and `PriorityActions` stay unchanged — manual follow-up button still works; the dialog will just show "Auto follow-up sent {time ago}" when a `proposal_follow_ups` row exists, so the user doesn't double-send.

## Technical notes

- New table:
  ```text
  proposal_follow_ups (id, user_id, proposal_id, scenario, sent_at)
  UNIQUE (proposal_id, scenario)
  ```
  RLS: owner can read; service_role full access; no anon.
- Cron: same migration pattern as `20260428071356_*` (uses `supabase--insert` so the URL/anon key aren't committed). Hourly cadence is enough — scenarios use 24/48h windows.
- Edge function uses service role; no JWT (internal cron). Errors are logged but never block the job.
- Reuses `send-email` so branding, sending domain, suppression, and DLQ behavior all match existing emails.

## Out of scope

- No new UI in Settings — the existing toggles `proposal_follow_up` and `payment_follow_up_unpaid` drive everything.
- No change to retainer dunning or contract reminders.
- No second follow-up per scenario; one send per `(proposal, scenario)` only.
