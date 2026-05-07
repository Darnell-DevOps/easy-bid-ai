## Production Readiness Audit

A focused, no-new-features pass to catch failures before real customers hit them. Three parallel checks, then a short remediation pass for whatever surfaces.

### 1. Security scan
Run the full backend security scanner against the Supabase project. It checks:
- Tables missing RLS
- Policies that are too permissive (e.g. `using (true)`)
- Exposed PII columns
- SECURITY DEFINER functions without `set search_path`
- Storage bucket misconfigurations
- Edge function auth gaps

Output: a categorized list of findings (critical / high / medium / low). I'll fix anything critical/high in the same pass and document medium/low for you to decide on.

### 2. Paddle webhook end-to-end check
The recovery layer depends on `payments-webhook` correctly handling the dunning path. I'll verify against the actual deployed function:

- Pull recent edge function logs for `payments-webhook` (live + sandbox) and look for: signature failures, missing `customData`, unhandled event types, RPC errors from `mark_proposal_paid`.
- Trace `transaction.payment_failed` → `retainers.has_failed_payment=true` → `retainer_reminders` upsert path.
- Verify `subscription.canceled` correctly flips status without orphaning invoices.
- Check that `retainer_invoices` rows get the right `status` transitions (`failed` → `recovered` → `paid`).
- Confirm `?env=sandbox` vs `?env=live` query param routing matches the registered webhook URLs.

If I find any silent failures, fix them in `supabase/functions/payments-webhook/index.ts` and re-test via `supabase--curl_edge_functions` or Paddle's simulation API.

### 3. Edge function log sweep
Check the last ~24h of logs for these functions and triage any errors:
- `payments-webhook`
- `retainer-recovery-cron`
- `create-proposal-checkout`
- `create-retainer-subscription`
- `retainer-portal-session`
- `retainer-recover-portal`
- `ai-coach-feed`
- `ai-deal-score`
- `ai-churn-risk`
- `ai-proposal-audit`
- `generate-proposal` / `generate-contract` / `generate-policy`
- `lead-response`

Focus on: 5xx responses, unhandled exceptions, CORS errors, missing env vars, RLS denials from the service role calls.

### 4. Remediation pass
Anything found in steps 1–3 gets fixed in priority order:
- Critical security → first
- Webhook bugs that drop money events → second
- Silent edge function errors → third
- Polish (better error messages, retry logic) → last

No design changes. No new features. Stability only.

### Deliverable
A short report with: what was scanned, what was found, what was fixed, what's left for you to decide on (e.g. "this RLS policy is intentionally permissive — confirm?"). Plus the updated files.

### Out of scope
- Empty states polish (separate pass)
- Mobile review (separate pass)
- Landing page conversion work (separate pass)
- Any new functionality

Approve and I'll run the three checks in parallel and report back with findings + fixes.
