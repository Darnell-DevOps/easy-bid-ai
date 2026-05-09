# Smoke-test + Email Monitoring Dashboard

## Part 1 — Smoke-test the pipeline (no code changes)

Run these in order against the live `notify.closesync.io` sender. After each, I'll query `email_send_log` to confirm a row with `status='sent'` and a Resend `provider_id`.

1. **welcome** — sign up with a fresh test address (or trigger via the test panel below).
2. **proposal-sent** — open any draft proposal in `/dashboard/proposals`, change status to "Sent". The client must have an email on file.
3. **contract-signature-reminder** — on a contract in `/dashboard/contracts`, click "Mark sent".
4. **booking-confirmation** — visit your public booking link in incognito, book a slot.
5. **payment-confirmation / payment-failed** — covered by Paddle webhook; verify by replaying a sandbox event or trusting the existing webhook smoke test.
6. **renewal-reminder** — manually invoke `retainer-recovery-cron` and check that any retainer with end_date 6–31 days out produced a row.

To make this faster I'll add a tiny **"Send test email"** button in the Email Dashboard (owner-only) that lets you fire any of the 9 templates to your own address with sample data — no need to manufacture real proposals/bookings.

## Part 2 — Email Dashboard at `/dashboard/emails`

Owner-only page (gated to the currently signed-in user — they only see their own `email_send_log` rows, which RLS already enforces). No new roles table needed.

### Layout
```text
┌────────────────────────────────────────────────────────┐
│ Emails                          [Send test email ▼]   │
├────────────────────────────────────────────────────────┤
│ [24h] [7d] [30d] [Custom…]   Template ▾   Status ▾    │
├────────────────────────────────────────────────────────┤
│  Total   Sent   Failed   Suppressed                    │
│   142    138      3         1                          │
├────────────────────────────────────────────────────────┤
│ Time         Template           Recipient    Status    │
│ 2m ago       proposal-sent      a@b.com      ● Sent    │
│ 1h ago       payment-failed     c@d.com      ● Failed  │
│   └─ "402 insufficient_balance"                        │
│ …                                                      │
│                                            [< 1 2 >]   │
└────────────────────────────────────────────────────────┘
```

### Features (all included in v1)
- **Time-range filter**: 24h / 7d / 30d preset chips + custom date range. Default 7d.
- **Template filter**: dropdown populated from `SELECT DISTINCT template FROM email_send_log`.
- **Status filter**: All / Sent / Failed / Suppressed / Pending. Color-coded badges.
- **Summary stats** (4 cards): total, sent, failed, suppressed for the active filter window.
- **Log table**: paginated 50/page, sorted by `created_at DESC`. Columns: time (relative), template, recipient, status badge, error (expandable for failed rows). One row per email — `idempotency_key` is unique so no dedup pass needed.
- **Send test email**: dialog with template picker + recipient (defaults to your own email) + "Send". Calls existing `send-email` function with prefilled sample data per template. Logs land in the same dashboard so you can verify immediately.

### Routing & gating
- Add `/dashboard/emails` route inside `<AuthGuard>` in `src/App.tsx`.
- Add a sidebar link in `DashboardLayout.tsx` (under Settings).
- RLS on `email_send_log` already restricts SELECT to `auth.uid() = user_id`, so each owner sees only their own emails. No additional admin role required.

### Files to create/edit
- **New**: `src/pages/EmailsDashboard.tsx` — page component.
- **New**: `src/components/emails/EmailStatsCards.tsx`, `EmailLogTable.tsx`, `SendTestEmailDialog.tsx`.
- **Edit**: `src/App.tsx` (route), `src/components/DashboardLayout.tsx` (nav link).

### Out of scope (v1)
- Bounce/complaint webhook from Resend → auto-suppression. Can add later.
- CSV export, advanced search, per-recipient drill-down.
- Multi-tenant admin view across all users (current design is per-owner).

After approval I'll do the smoke-test prep first (add the test-send button) so the rest of the smoke test takes ~2 minutes from the dashboard.
