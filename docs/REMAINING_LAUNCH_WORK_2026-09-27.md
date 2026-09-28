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

## Launch gates, in priority order

1. **Customer payment arrangement:** resolve this before enabling live client
   payments. CloseSync subscriptions and each agency/freelancer's client service
   payments are different requirements. Both `create-proposal-checkout` and
   `create-retainer-subscription` currently use the central Paddle connection in
   `_shared/paddle.ts`; neither selects the business owner's merchant account.
   A read-only hosted schema check on 27 September found no columns named for
   merchant, Stripe, connected account, payout or payment provider. This is
   supporting evidence, not proof of all external account configuration.
   Paddle's current policy excludes standalone human services and products
   enabling non-Paddle sellers to sell to customers. Specific provider approval
   for this arrangement has not been established. Sandbox success is not approval.
   Finish by establishing the approved provider/account model, onboarding each
   business, and proving a payment belongs to the correct business and reaches
   its payout destination. Document fees, refunds, disputes and tax responsibility;
   test disabled/unverified accounts and cross-business access. Keep payments in
   sandbox until the model is resolved. Changing the global environment to live
   would affect SaaS billing; the client checkout endpoints now reject live-mode
   central-Paddle charges server-side. The owner reports no Stripe account yet.
   The proposed Stripe Connect direct-charge model and exact owner account step
   are in `.lovable/plan.md`. No Connect account or payout is configured.
2. **Email DNS and delivery:** finish the sender and inbound records in the
   DNS account identified in the hosted audit. Verify Resend sender status in
   its dashboard, then actually receive signup/reset, proposal, reminder and
   inbound mail with working links in controlled inboxes. The existing inbound
   handler expects a normalized top-level recipient/body and an alias secret.
   Resend's native `email.received` event requires raw-body signature verification
   and retrieval of the full email content; pointing that webhook directly at
   the existing handler does not establish compatibility. Confirm the actual
   hosted provider and implement/test its adapter, authentication, replay handling
   and tenant routing. Do not change the main-domain Google Workspace MX records.
3. **Complete hosted sandbox journey:** use two isolated test workspaces and
   controlled inboxes. Run enquiry, proposal delivery/opening, acceptance,
   client signature, owner countersignature and the executed PDF,
   successful payment, failed payment and retry, cancellation and onboarding.
   Verify correct record ownership, exactly-once payment effects, onboarding
   save/resume and rejection of cross-business record access. After changing
   the client payment architecture, repeat payment cases against that arrangement.
   Opening checkout and automated database tests are not proof of this journey.
   The credential-dependent signing test still needs a dedicated test account.
4. **Attachment malware scanning:** the owner confirms no scanner is configured.
   Check Lovable's actual hosted scanning capabilities first; storage alone is
   not evidence of malware scanning. If unavailable, approve a suitable private
   scanner or managed processor before connecting uploads. Keep uploads in a
   private quarantine bucket; allow only
   service-role access there. Scan actual bytes, reject oversized/encrypted or
   uninspectable archives, enforce archive expansion limits, and release files
   only after a clean result bound to their content hash. Scan legacy files too;
   revoke all bypassing direct-download policies and block replacement after a
   clean verdict. Timeouts or outages must keep files quarantined. Verify clean
   PDF/Office/ZIP fixtures, the standard EICAR test file, scanner outages and owner
   isolation before enabling. Existing MIME/size checks are not malware scanning.
   A smaller launch can defer attachments by disabling upload and unscanned
   download paths on the server and aligning the interface/marketing; this option
   has not been implemented or selected.
5. **Legal documents:** keep draft labels until supplied business identity, data
   practices, retention and subscription terms have appropriate review. A scanner
   provider and its processing location must be included in that data-flow audit.
6. **Launch operations:** after the payment model and legal pages are ready,
   complete provider approval and verify matching live client/server credentials,
   prices and signed webhooks through Lovable's hosted configuration. Test account
   recovery, tenant isolation, backup/restore procedures, failed-job visibility
   and reconciliation, and keyboard/screen-reader behavior while notifications
   are active. The Radix notification focus-guard follow-up remains open. Keep
   permanent trash purging disabled as requested. Local tests and sandbox checks
   do not satisfy these live operational gates.

## Lovable implementation boundary

Lovable confirms this project is published and its latest synced commit is
`1dfdb080d14cf6d35423451bb5fd1177d3cef6e9` at this follow-up inspection.
Use local code and tests for implementation, GitHub for verified source sync, and
Lovable for its managed deployment/configuration and hosted verification.

Lovable documents built-in Paddle and Stripe payments and connecting an existing
Stripe account. A central Stripe connection alone would have the same missing
per-business routing concern; those docs do not establish that this project has
a configured multi-merchant arrangement. Stripe Connect's SaaS model is a candidate
to evaluate because it supports businesses collecting from their own customers,
not a provider migration already chosen or implemented. Retain the existing SaaS
billing integration while evaluating a separate client-payment path. Do not
disconnect providers or change live credentials as part of this research.

Sources checked on 27 September 2026:
[Paddle acceptable use](https://www.paddle.com/help/start/intro-to-paddle/what-am-i-not-allowed-to-sell-on-paddle),
[Lovable payments](https://docs.lovable.dev/features/payments),
[Lovable existing Stripe account](https://docs.lovable.dev/integrations/stripe),
[Stripe Connect](https://docs.stripe.com/connect),
[Resend receiving](https://resend.com/docs/dashboard/receiving/introduction),
[Resend webhook verification](https://resend.com/docs/webhooks/verify-webhooks-requests),
[ICO privacy information](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-be-informed/).

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
The corrected final source release is `e3773a0`. All four
[CI jobs](https://github.com/Darnell-DevOps/easy-bid-ai/actions/runs/36349620840)
passed: the explicit app typecheck, 381 unit tests and production build; critical
Edge Function checks; the full migration rebuild and concurrency checks; and
77 browser cases. One credential-dependent sign/countersign case remains skipped.
Lovable production was published and checked directly: Free, £9 Starter and £29
Pro are visible, and both legal routes still show their draft notices. The signed-in
local Data & Exports screen also displays the paused automatic-deletion wording.
These checks do not replace real email delivery, a completed sandbox payment/signing
journey or malware-scanner validation. The six launch gates above remain open.
Database concurrency coverage uses eight independent PostgreSQL sessions in the
disposable CI database; the script has a fixed local connection and cannot target
the hosted database. No real client emails or live charges are used.

References: [Paddle delivery semantics](https://developer.paddle.com/webhooks/about/how-webhooks-work/),
[Paddle cancellation](https://developer.paddle.com/api-reference/subscriptions/cancel-subscription/),
[Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).
Upload deployment requirements follow the [OWASP file upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).
