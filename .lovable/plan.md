# Stripe Connect alongside Paddle: architecture answer (read-only)

Nothing was changed. This plan records the answer and a sandbox-first path. Approving it does not start any work. It only records the answer until you ask for the build.

## 1. Can a custom Stripe Connect integration run alongside Paddle in this project?

**Confirmed: yes.**
- Paddle subscription billing uses its own connector keys (`PADDLE_SANDBOX_API_KEY` / `PADDLE_LIVE_API_KEY`), its own gateway route, and its own backend functions (`create-plan-checkout`, `payments-webhook`, and others).
- A custom Stripe integration would use its own project secrets and its own new backend functions. It would call Stripe's API directly, not through the Lovable connector gateway.
- You don't need to disconnect or replace Paddle. The two only need to be kept apart in code and data:
  - separate webhook functions
  - separate secret names
  - separate columns, e.g. a new `stripe_account_id` on the agency's settings and `stripe_payment_intent_id` / `stripe_checkout_session_id` on proposals and retainers, next to the existing `paddle_*` fields.

## 2. Does Lovable's built-in Stripe payments or its own-Stripe connector support Connect with many merchants?

- **Built-in Stripe payments: not supported for this, based on my platform knowledge (not confirmed from documentation).** It's designed for one merchant: the app owner sells to their customers. I have no tool for connected accounts, account links, or `Stripe-Account` direct charges. Treat Connect as unsupported there unless Lovable documentation says otherwise.
- **Own-Stripe (bring-your-own-key) integration: confirmed to be legacy only.** Lovable keeps it for backward compatibility and doesn't recommend it for new work. It stores one secret key and has no Connect-specific features. It's a single-key setup, the same thing you'd get by adding the key yourself.
- **Conclusion (my reasoning, not a platform statement):** direct charges with Stripe-hosted onboarding for each agency need a custom integration. That means your own platform Stripe account, its secret key stored as a project secret, and custom backend functions.

## 3. Owner-only steps (only the owner can do these)

1. Create a Stripe account at stripe.com as the platform business. No Lovable tool can create it.
2. In the Stripe Dashboard, turn on **Test mode**. Then open **Connect** and finish the platform profile:
   - business model: platform/marketplace
   - connected account type: Standard or Express with Stripe-hosted onboarding
   - who pays fees in direct charges: the connected account
3. In test mode, copy the **secret key** (`sk_test_...`). Use a restricted key only if it can manage Connect accounts, Account Links, Checkout Sessions and PaymentIntents.
4. After the webhook function exists, create a **Connect webhook endpoint** that points to it. Choose "Listen to events on connected accounts", then copy its signing secret (`whsec_...`).

## 4. Where the secrets and config go (confirmed mechanism)

- Server secrets go in **Project Settings -> Secrets** (Lovable Cloud backend-function secrets). The owner adds them there, or I request them with the secret-entry form during the build. They are never put in the browser config.
  - `STRIPE_CONNECT_SECRET_KEY` = `sk_test_...`
  - `STRIPE_CONNECT_WEBHOOK_SECRET` = `whsec_...`
  - optional `STRIPE_CONNECT_ENVIRONMENT` = `sandbox`, like the existing `PAYMENTS_ENVIRONMENT`
- The publishable key (`pk_test_...`) is only needed if we embed Stripe elements. It could go in the browser config file `src/config/public-client-config.ts`. With Stripe-hosted Checkout plus hosted onboarding, it isn't required.
- Don't reuse the Paddle secret names, and don't put Stripe keys in any `VITE_` variable.

## 5. Build outline (for later, only when you ask)

```text
Agency settings -> "Connect Stripe" -> edge fn creates account + Account Link -> Stripe-hosted onboarding
Client pays proposal -> edge fn creates Checkout Session with Stripe-Account header (direct charge)
Stripe Connect webhook -> verify signature -> mark proposal/retainer paid (idempotent, like payment-event-worker)
```
- Paddle stays in charge of CloseSync plan subscriptions.
- Each proposal or retainer uses a per-agency choice: Stripe if the agency has connected Stripe and is ready to charge, otherwise the current central Paddle checkout. Or Paddle could be retired for client payments later.

## Confirmed vs guessed

- **Confirmed:**
  - custom secrets and custom backend functions are supported
  - Paddle and a custom Stripe integration can coexist
  - the own-Stripe integration is legacy, with one key
  - the owner must create the Stripe account
- **Not confirmed (my reasoning):** that built-in Stripe payments can't do Connect. This comes from the available tools, not a documented statement.
