import { StripeRequestError } from "./stripe-connect-errors.ts";

export function isStripeAccountId(value: unknown): value is string {
  return typeof value === "string" && /^acct_[A-Za-z0-9]+$/.test(value);
}

export async function stripeRequest<T>(
  key: string,
  path: string,
  options: { method?: "GET" | "POST"; idempotencyKey?: string } & (
    | { api?: "v1"; body?: URLSearchParams }
    | { api: "v2"; body?: Record<string, unknown> }
  ) = {},
): Promise<T> {
  const v2 = options.api === "v2";
  const response = await fetch(`https://api.stripe.com/${v2 ? "v2" : "v1"}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      ...(v2 ? { "Stripe-Version": "2026-09-30.endive" } : {}),
      ...(options.body ? { "Content-Type": v2 ? "application/json" : "application/x-www-form-urlencoded" } : {}),
      ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
    },
    body: options.api === "v2" ? (options.body ? JSON.stringify(options.body) : undefined) : options.body,
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new StripeRequestError(response.status, result, response.headers.get("request-id"));
  }
  if (!result || typeof result !== "object") throw new Error("Stripe returned an invalid response");
  return result as T;
}
