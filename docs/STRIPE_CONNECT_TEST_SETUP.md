# Separate client payments: test-mode setup

CloseSync subscriptions remain on Paddle. Client service payments need each
business to be the merchant and receive payouts into its own Stripe account.
Stripe Connect **direct charges** on Accounts v2 merchants with full Dashboard
access and Stripe-owned processing fees/losses are the planned model (the
equivalent of the original Standard-account design). Lovable can host the custom Edge Functions; that does not
establish Stripe platform approval or a completed payment flow.

## What is implemented

- `client_payment_accounts` stores one connected account per owner and mode.
  Its owner can read the row; only the service role can create or change it.
- `stripe-connect-account` authenticates the workspace owner, creates a
  **test-mode** Accounts v2 merchant with a stable Stripe idempotency key, and
  returns a Stripe-hosted onboarding link. It reads Stripe's current account
  state before reporting readiness. CloseSync never receives bank details.
- Account creation uses JSON at `/v2/core/accounts`, pinned to the stable
  `2026-09-30.endive` version. Only the Merchant configuration is requested:
  CloseSync subscription billing stays on Paddle. Both fee/loss collectors are
  `stripe`, and Dashboard access is `full`; unexpected returned settings are
  rejected before saving. Identity/business/bank information stays in Stripe's
  onboarding flow rather than being invented or accepted by CloseSync.
- Readiness and hosted Account Links use Stripe's supported v1 representation
  of v2 accounts. This preserves the existing charge, payout and active-card
  checks and can still read any previously saved v1 accounts.
- The function accepts only `sk_test_` keys. A live key, absent key, missing
  return origin, disabled account, or missing payout/card capability cannot be
  treated as a ready merchant.
- The existing central Paddle client-payment path remains sandbox-only.
- Settings → Integrations includes the Stripe Connect test-mode card, country
  selection, onboarding redirect and a server-backed status refresh.

## Platform-owner setup in Lovable

1. Create the CloseSync Stripe platform account and enable Connect in **test
   mode**. Confirm Stripe permits this platform and the planned service sales,
   fees, refunds, disputes and country coverage. This requires the operator's
   real business details; do not put secrets or bank information in source or chat.
2. Set Lovable's server-side `STRIPE_CONNECT_SECRET_KEY` to the platform's
   Stripe **test** secret key and `STRIPE_CONNECT_APP_ORIGIN` to the actual
   published HTTPS origin (for example, `https://easy-bid-ai.lovable.app`).
   Do not set a live key. Deploy the migration and Edge Function through
   Lovable. Keep both values server-side.
3. From an authenticated test workspace, open Settings → Integrations,
   select the business's real legal country and choose **Connect with Stripe**.
   Complete Stripe's test onboarding, then refresh status on return. Repeat
   with a second test business to prove account isolation.

## Hosted failure investigation — 20 October 2026

Lovable's logs show three account-creation attempts on 18 October around
21:42–21:44 UTC failing with `Stripe request failed (400, unknown)`.
`client_payment_accounts` is empty. The function reached Stripe, so its test-key
format and return-origin checks passed; this does not prove platform registration
or account-creation permissions are complete. The old logger did not retain
Stripe's error type, parameter or request ID, and the UI discarded non-2xx
response bodies.

The owner then signed in to Stripe Workbench. Request `req_hVzIx7qKmNj1te`
confirmed that the **separate sandbox** rejects new `/v1/accounts` creation
because Accounts v1 support is disabled for this new integration. This request
was also a replay of a cached HTTP 400 response, not a fresh account creation.
The original Stripe test mode and the separate sandbox have different logs;
an empty search in the former did not mean the request was missing.

The repair switches creation to Accounts v2 rather than enabling the legacy
Accounts v1 policy. Its new, stable `closesync-connect-test-accounts-v2-<owner>`
idempotency namespace avoids replaying the confirmed failed v1 creation. It is
not randomised on retry. No saved account is replaced and no live key is enabled.

The error-handling repair records only the operation, HTTP status, stable error
code/type/parameter and Stripe request ID. Raw Stripe messages, email addresses,
keys and response payloads must never be logged or returned to the browser.
The screen maps known application error codes to recovery instructions and a
support reference, preserves the country and allows retry. The provider root
cause is now confirmed; a new owner-triggered hosted attempt is still required
to demonstrate successful v2 merchant creation and completed onboarding.

## Still required before client checkout is enabled

- Build direct-charge proposal and retainer Checkout Sessions against the
  **owner's** connected account, deriving prices from committed records.
- Add a signed Connect webhook, durable event processing and atomic,
  tenant-checked payment effects. Test duplicate delivery, async success and
  failure, refunds, cancellation and onboarding. Never infer payment from the
  browser return URL alone.
- Complete the full hosted sandbox journey in Lovable with two isolated
  businesses. Verify payout ownership in Stripe before any live enablement.

Official references: [Accounts v2](https://docs.stripe.com/connect/accounts-v2),
[v2 merchant configuration](https://docs.stripe.com/connect/accounts-v2/connected-account-configuration),
[v2 account creation](https://docs.stripe.com/api/v2/core/accounts/create),
[Stripe SaaS platforms](https://docs.stripe.com/connect/saas),
[Stripe accounts](https://docs.stripe.com/api/accounts),
[Account Links](https://docs.stripe.com/api/account_links),
[direct charges](https://docs.stripe.com/connect/direct-charges), and
[Connect webhooks](https://docs.stripe.com/connect/webhooks).
