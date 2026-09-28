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
3. From an authenticated test workspace, call `stripe-connect-account` with
   `{ "action": "onboard", "country": "GB" }` (replace `GB` with that
   business's real legal country), then follow the returned single-use URL.
   Call `{ "action": "status" }` on return. Repeat with a second test business
   to prove account isolation. The product UI for this flow is still pending.

## Still required before client checkout is enabled

- Build direct-charge proposal and retainer Checkout Sessions against the
  **owner's** connected account, deriving prices from committed records.
- Add a signed Connect webhook, durable event processing and atomic,
  tenant-checked payment effects. Test duplicate delivery, async success and
  failure, refunds, cancellation and onboarding. Never infer payment from the
  browser return URL alone.
- Add a merchant connection and status surface to workspace settings, then
  perform the full hosted sandbox journey in Lovable with two isolated
  businesses. Verify payout ownership in Stripe before any live enablement.

Official references: [Stripe SaaS platforms](https://docs.stripe.com/connect/saas),
[Stripe accounts](https://docs.stripe.com/api/accounts),
[Account Links](https://docs.stripe.com/api/account_links),
[direct charges](https://docs.stripe.com/connect/direct-charges), and
[Connect webhooks](https://docs.stripe.com/connect/webhooks).
