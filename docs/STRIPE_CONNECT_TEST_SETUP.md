# Separate client payments: test-mode setup

CloseSync subscriptions remain on Paddle. Client service payments need each
business to be the merchant and receive payouts into its own Stripe account.
Stripe Connect **direct charges** on Standard connected accounts are the
planned model. Lovable can host the custom Edge Functions; that does not
establish Stripe platform approval or a completed payment flow.

## What is implemented

- `client_payment_accounts` stores one connected account per owner and mode.
  Its owner can read the row; only the service role can create or change it.
- `stripe-connect-account` authenticates the workspace owner, creates a
  **test-mode** Standard account with a stable Stripe idempotency key, and
  returns a Stripe-hosted onboarding link. It reads Stripe's current account
  state before reporting readiness. CloseSync never receives bank details.
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
response bodies. The exact provider rejection remains unconfirmed.

The error-handling repair records only the operation, HTTP status, stable error
code/type/parameter and Stripe request ID. Raw Stripe messages, email addresses,
keys and response payloads must never be logged or returned to the browser.
The screen maps known application error codes to recovery instructions and a
support reference, preserves the country and allows retry. A new hosted attempt
or the owner's original Stripe Workbench request log is still needed to prove
the root cause and successful onboarding; do not mark this flow complete yet.

## Still required before client checkout is enabled

- Build direct-charge proposal and retainer Checkout Sessions against the
  **owner's** connected account, deriving prices from committed records.
- Add a signed Connect webhook, durable event processing and atomic,
  tenant-checked payment effects. Test duplicate delivery, async success and
  failure, refunds, cancellation and onboarding. Never infer payment from the
  browser return URL alone.
- Complete the full hosted sandbox journey in Lovable with two isolated
  businesses. Verify payout ownership in Stripe before any live enablement.

Official references: [Stripe SaaS platforms](https://docs.stripe.com/connect/saas),
[Stripe accounts](https://docs.stripe.com/api/accounts),
[Account Links](https://docs.stripe.com/api/account_links),
[direct charges](https://docs.stripe.com/connect/direct-charges), and
[Connect webhooks](https://docs.stripe.com/connect/webhooks).
