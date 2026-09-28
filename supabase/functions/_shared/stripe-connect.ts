// Stripe Connect's platform key is separate from CloseSync's Paddle SaaS key.
// Client payments remain test-only until the connected merchant flow is proven.
export function getStripeConnectKey(): string | null {
  const key = Deno.env.get("STRIPE_CONNECT_SECRET_KEY") || "";
  return key.startsWith("sk_test_") ? key : null;
}

export function isStripeAccountId(value: unknown): value is string {
  return typeof value === "string" && /^acct_[A-Za-z0-9]+$/.test(value);
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

export async function stripeRequest<T>(
  key: string,
  path: string,
  options: { method?: "GET" | "POST"; body?: URLSearchParams; idempotencyKey?: string } = {},
): Promise<T> {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      ...(options.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
    },
    body: options.body,
  });
  const result = await response.json();
  if (!response.ok) {
    // Stripe error bodies can contain merchant PII; log a stable code only.
    throw new Error(`Stripe request failed (${response.status}, ${result?.error?.code || "unknown"})`);
  }
  return result as T;
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
