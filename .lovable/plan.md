# Client-payment account setup

Status (20 October 2026): the owner's signed-in Stripe Workbench confirms that request `req_hVzIx7qKmNj1te` was a cached HTTP 400 rejection because the separate sandbox blocks new Accounts v1 creation. The repair uses Accounts v2 merchant creation with full Dashboard access and Stripe-owned fees/losses, preserving stable per-owner idempotency, test-only credentials, existing readiness checks and hosted onboarding. Do not enable the legacy Accounts v1 policy. Hosted creation/onboarding still requires owner verification after deployment. No connected merchant, payout destination, successful onboarding or client checkout is verified. Paddle remains in sandbox for CloseSync subscriptions and existing test checkouts.

## Proposed account model

- Keep CloseSync SaaS subscription billing on its existing Paddle connection.
- Evaluate Stripe Connect for client service payments. Under Stripe-owned pricing with direct charges, each agency or freelancer is the merchant for its own client sales and receives funds in its connected account. Start with zero CloseSync transaction fee; the existing SaaS subscription remains the commercial model.
- Use Stripe-hosted onboarding for each business, and only open its client checkout after Stripe reports that the connected account can take charges. Never fall back to CloseSync's central Paddle account for live client payments.
- This is a proposed model until Stripe accepts the platform and supported business categories/countries. Sandbox checkout alone does not demonstrate approval or payout ownership.

## Lovable boundary

Lovable has Stripe and Paddle connectors available. Its published documentation describes built-in payments and a separate own-Stripe-account integration; the latter is not a documented multi-merchant Connect implementation and is described as an alternative to built-in payments. Do not disconnect the existing Paddle integration or use a standard single-merchant Stripe setup as a substitute for Connect. Custom Edge Functions and server-only secrets appear to be a possible integration path, but coexistence and secret setup for this exact project must be verified before implementation. Lovable hosting and deployment remain in place.

## Owner account step

The 20 October diagnostic check confirmed that Lovable's enabled built-in Stripe connector cannot inspect the request history for the owner's separate Connect sandbox. The owner subsequently signed into Stripe Workbench in the in-app browser, which proved the Accounts v1 policy rejection. Do not substitute another Stripe account or enable legacy v1 creation as a workaround. Keep test-only secrets in Lovable. Do not collect keys or full request payloads in chat. After deploying the v2 creation repair, the owner should retry from Settings → Integrations and complete Stripe's hosted sandbox onboarding.

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
