# Launch follow-up

This follows the owner's ten-point research list. Payments remain sandbox,
permanent trash cleanup stays disabled, and CloseSync's legal pages remain drafts.

## Implemented in this source batch

- Durable, signature-verified Paddle event inbox with asynchronous processing,
  service-only claims, leases, retries and visible terminal failures.
- Retainer transaction uniqueness and atomic invoice, revenue, retry-count and
  recovery updates. Repeated delivery and interrupted workers cannot add revenue
  twice. A late failure cannot reverse an already-paid transaction.
- SaaS subscription reconciliation reads current Paddle state. Provider timestamps
  prevent older state from replacing newer entitlements.
- Atomic email reservation, tenant-scoped keys and immutable request fingerprints.
  Confirmed failures can retry; interrupted or ambiguous delivery is held for
  reconciliation. A provider idempotency header is sent as additional protection,
  but gateway forwarding has not been proven; correctness does not depend on it.
- Proposal and section output validation rejects malformed JSON, missing sections,
  incorrect journeys, mixed currency and inconsistent pricing/invoice totals. Raw
  AI text is no longer returned as a successful generation. Full generation needs
  an explicit project amount. Invalid output returns a retryable 502 error.
- Cancellation requests stop renewal at the billing-period boundary and display
  the paid-access end date. Only actual cancellation changes the entitlement.
- Starter is publicly presented at its existing £9/month price alongside Free
  and £29/month Pro. Retention copy states automatic deletion is paused.
- Onboarding claim and initialization commit together, so a worker crash cannot
  leave a newly-created onboarding form empty.

## Inputs and provider validation still needed

1. **Email DNS and delivery:** finish the sender and inbound records in the
   DNS account identified in the hosted audit. Verify Resend sender status in
   its dashboard, then actually receive signup/reset, proposal and inbound mail.
   Do not change the main-domain Google Workspace MX records.
2. **Complete sandbox journey:** use an isolated test workspace and controlled
   inbox. Run proposal acceptance, client signature, owner countersignature,
   successful payment, failed payment and retry, cancellation and onboarding.
   Opening checkout and automated database tests are not proof of this journey.
   The credential-dependent signing test still needs a dedicated test account.
3. **Attachment malware scanning:** the owner confirms no scanner is configured.
   Deploy a private ClamAV service or approve a managed scanning processor before
   connecting uploads. Keep uploads in a private quarantine bucket; allow only
   service-role access there. Scan actual bytes, reject oversized/encrypted or
   uninspectable archives, enforce archive expansion limits, and release files
   only after a clean result bound to their content hash. Scan legacy files too;
   revoke all bypassing direct-download policies and block replacement after a
   clean verdict. Timeouts or outages must keep files quarantined. Verify clean
   PDF/Office/ZIP fixtures, the standard EICAR test file, scanner outages and owner
   isolation before enabling. Existing MIME/size checks are not malware scanning.
4. **Legal documents:** keep draft labels until supplied business identity, data
   practices, retention and subscription terms have appropriate review. A scanner
   provider and its processing location must be included in that data-flow audit.

## Operational recovery

Use payment_webhook_events and automation-job health to investigate exhausted
retries. Reconcile against Paddle before requeueing. For an email_send_log row in
`sending` or `uncertain`, inspect provider delivery records before changing its
state. Mark it sent when accepted, or failed only after confirming non-delivery.
Never solve an uncertain outcome by creating a fresh operation key automatically.

## Verification

Local verification completed: `npm run check:launch` passed all 381 unit tests
and the production build; Deno checked all five changed public/internal function
entrypoints. Browser checks passed all 28 workspace cases and the new mobile
onboarding price, tax, failed-generation and retry case. The first CI browser run
passed 76 cases with one credential-dependent signing case skipped, and exposed
an outdated pricing selector; the corrected local public suite passed all 20 cases.
The onboarding accessibility scan runs after dismissing the notification; active
Radix toast focus guards are not covered by that scan and remain an accessibility
follow-up. Earlier failures during dependency restoration and form editing are
superseded by the clean workspace checks. CI rebuilt the full database and passed
the eight-session payment/email concurrency tests, rollback and subscription-ordering
checks. Hosted checks confirm the payment inbox and transaction index exist,
the queue is empty, the worker job is enabled, ordinary users cannot call the
financial/email claim RPCs, and the service role can apply payment effects.
Lovable applied the migration and deployed `payments-webhook`, `payment-event-worker`,
`send-email`, `generate-proposal` and `cancel-plan-subscription`. The worker rejects
unsigned scheduler calls with 401; the webhook rejects unsigned payloads with 400.
Natural dispatcher runs at 20:35 and 20:40 UTC reported an empty queue, no failures
and no errors. No emails, payments or financial event replays were triggered.

Hosted validation also caught an onboarding insert using three nonexistent
proposal columns. The save now stores amount, currency and tax settings only;
derived totals go to generation, where the server recalculates them. The mobile
retry regression verifies both payloads. `npm run typecheck` now explicitly checks
`tsconfig.app.json`, so schema errors cannot hide behind the empty root project.
The corrected final CI run and published UI verification are pending.
Database concurrency coverage uses eight independent PostgreSQL sessions in the
disposable CI database; the script has a fixed local connection and cannot target
the hosted database. No real client emails or live charges are used.

References: [Paddle delivery semantics](https://developer.paddle.com/webhooks/about/how-webhooks-work/),
[Paddle cancellation](https://developer.paddle.com/api-reference/subscriptions/cancel-subscription/),
[Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).
Upload deployment requirements follow the [OWASP file upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).
