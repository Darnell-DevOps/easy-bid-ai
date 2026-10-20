// Stripe Connect's platform key is separate from CloseSync's Paddle SaaS key.
// Client payments remain test-only until the connected merchant flow is proven.
export { isStripeAccountId, stripeRequest } from "./stripe-connect-request.ts";

export function getStripeConnectKey(): string | null {
  const key = Deno.env.get("STRIPE_CONNECT_SECRET_KEY") || "";
  return key.startsWith("sk_test_") ? key : null;
}

export function accountCanTakeClientPayments(account: {
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  capabilities?: { card_payments?: string };
}): boolean {
  return account.charges_enabled === true &&
    account.payouts_enabled === true &&
    account.capabilities?.card_payments === "active";
}

export function connectReturnOrigin(): string | null {
  const value = Deno.env.get("STRIPE_CONNECT_APP_ORIGIN") || "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash || url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}
