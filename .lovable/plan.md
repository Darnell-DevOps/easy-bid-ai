# Client-payment account setup

Status (28 September 2026): the owner has no Stripe account. No Stripe Connect account, API key, connected agency, or payout destination has been configured or verified. Paddle remains in sandbox for CloseSync subscriptions and existing test checkouts.

## Proposed account model

- Keep CloseSync SaaS subscription billing on its existing Paddle connection.
- Evaluate Stripe Connect for client service payments. Under Stripe-owned pricing with direct charges, each agency or freelancer is the merchant for its own client sales and receives funds in its connected account. Start with zero CloseSync transaction fee; the existing SaaS subscription remains the commercial model.
- Use Stripe-hosted onboarding for each business, and only open its client checkout after Stripe reports that the connected account can take charges. Never fall back to CloseSync's central Paddle account for live client payments.
- This is a proposed model until Stripe accepts the platform and supported business categories/countries. Sandbox checkout alone does not demonstrate approval or payout ownership.

## Lovable boundary

Lovable has Stripe and Paddle connectors available. Its published documentation describes built-in payments and a separate own-Stripe-account integration; the latter is not a documented multi-merchant Connect implementation and is described as an alternative to built-in payments. Do not disconnect the existing Paddle integration or use a standard single-merchant Stripe setup as a substitute for Connect. Custom Edge Functions and server-only secrets appear to be a possible integration path, but coexistence and secret setup for this exact project must be verified before implementation. Lovable hosting and deployment remain in place.

## Owner account step

The owner must create and verify a Stripe platform account and enable Connect in test mode, review Stripe's terms and fee/liability model, and supply any identity/business/payout details directly to Stripe. Do not put keys or bank details in chat or source control. Once the platform account exists and the custom integration path is verified, put test-only credentials in Lovable's secure project configuration. Create a connected-account webhook endpoint and enter its signing secret after the endpoint exists. Never switch the existing Paddle environment to live to test client payments.

## Engineering sequence after account setup

1. Persist the connected account ID and verification/charge status per CloseSync business, with owner-only read/write paths and no secret keys in database or browser.
2. Build Stripe-hosted connected-account onboarding and refresh status from Stripe server-side. Test two isolated businesses and disabled/unverified accounts.
3. Create proposal checkout sessions on the selected connected account, with server-calculated committed amount/currency and provider idempotency. Add retainer billing only after recurring-charge requirements and liability are confirmed.
4. Verify signed connected-account webhooks against raw bytes, store unique event IDs, resolve tenant and checkout ownership, apply paid/failed/refunded effects atomically, and test duplicate/out-of-order events.
5. Run a complete hosted sandbox journey and confirm each payment and refund appears under the correct connected business. Keep live client checkout closed until provider approval and payout ownership are demonstrated.

## Source-backed boundary

Stripe: https://docs.stripe.com/connect/saas and https://docs.stripe.com/connect/direct-charges.md?platform=web&ui=stripe-hosted
Lovable: https://docs.lovable.dev/features/payments and https://docs.lovable.dev/integrations/stripe
