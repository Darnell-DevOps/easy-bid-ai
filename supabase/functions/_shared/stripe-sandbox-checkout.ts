import { isStripeAccountId, stripeRequest } from "./stripe-connect-request.ts";

const KIND = "closesync_sandbox_contract";
export const UUID_PATTERN = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
const SESSION_ID = /^cs_test_[A-Za-z0-9]+$/;
const PAYMENT_INTENT_ID = /^pi_[A-Za-z0-9]+$/;

export interface SandboxCheckout {
  id: string;
  contract_id: string;
  account_id: string;
  amount_cents: number;
  currency: string;
  return_origin: string;
  expires_at: number;
  status: "pending" | "failed" | "paid" | "expired";
  stripe_session_id: string | null;
}

interface StripeSession {
  id: string;
  url: string | null;
  livemode: boolean;
  status: "open" | "complete" | "expired";
  amount_total: number;
  currency: string;
  metadata?: { checkout_id?: string; kind?: string };
}

export async function getOrCreateSandboxSession(key: string, attempt: SandboxCheckout) {
  if (!key.startsWith("sk_test_") || !isStripeAccountId(attempt.account_id)) {
    throw new Error("Sandbox Stripe account required");
  }
  let session: StripeSession;
  if (attempt.stripe_session_id) {
    if (!SESSION_ID.test(attempt.stripe_session_id)) throw new Error("Invalid sandbox session");
    session = await stripeRequest<StripeSession>(key, `/checkout/sessions/${attempt.stripe_session_id}`, { account: attempt.account_id });
  } else {
    const returnUrl = new URL(`/dashboard/contracts/${attempt.contract_id}`, attempt.return_origin).href;
    const body = new URLSearchParams({
      mode: "payment",
      success_url: returnUrl,
      cancel_url: returnUrl,
      expires_at: String(attempt.expires_at),
      "adaptive_pricing[enabled]": "false",
      "payment_method_types[0]": "card",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": attempt.currency,
      "line_items[0][price_data][unit_amount]": String(attempt.amount_cents),
      "line_items[0][price_data][product_data][name]": "CloseSync contract test payment",
      "metadata[checkout_id]": attempt.id,
      "metadata[kind]": KIND,
      "payment_intent_data[metadata][checkout_id]": attempt.id,
      "payment_intent_data[metadata][kind]": KIND,
    });
    session = await stripeRequest<StripeSession>(key, "/checkout/sessions", {
      method: "POST", body, account: attempt.account_id, idempotencyKey: `sandbox-contract-${attempt.id}`,
    });
  }
  if (session.livemode !== false || !SESSION_ID.test(session.id) || session.amount_total !== attempt.amount_cents
    || session.currency !== attempt.currency || session.metadata?.checkout_id !== attempt.id || session.metadata?.kind !== KIND) {
    throw new Error("Stripe returned a different checkout");
  }
  const url = session.status === "open" && session.url ? new URL(session.url) : null;
  if (url && (url.origin !== "https://checkout.stripe.com" || url.username || url.password)) {
    throw new Error("Invalid Stripe checkout URL");
  }
  return { id: session.id, status: session.status, url: url?.href ?? null };
}

export async function verifyStripeWebhookSignature(body: string, header: string, secret: string, now = Date.now()) {
  if (!secret.startsWith("whsec_") || header.length > 4096) return false;
  const parts = header.split(",").map((part) => part.trim());
  const timestamps = parts.filter((part) => /^t=\d{1,12}$/.test(part));
  if (timestamps.length !== 1) return false;
  const timestamp = timestamps[0].slice(2);
  if (Math.abs(Math.floor(now / 1000) - Number(timestamp)) > 300) return false;
  const signatures = parts.filter((part) => /^v1=[\da-f]{64}$/i.test(part));
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const message = encoder.encode(`${timestamp}.${body}`);
  for (const signature of signatures) {
    const bytes = Uint8Array.from(signature.slice(3).match(/../g)!, (pair) => Number.parseInt(pair, 16));
    if (await crypto.subtle.verify("HMAC", key, bytes, message)) return true;
  }
  return false;
}

export function sandboxCheckoutEvent(event: unknown) {
  if (!event || typeof event !== "object") return null;
  const e = event as { id?: unknown; type?: unknown; account?: unknown; livemode?: unknown; data?: { object?: unknown } };
  if (e.livemode !== false || !isStripeAccountId(e.account) || typeof e.id !== "string" || !/^evt_[A-Za-z0-9]+$/.test(e.id)) return null;
  const object = e.data?.object;
  if (!object || typeof object !== "object") return null;
  const o = object as {
    id?: string; livemode?: boolean; mode?: string; payment_status?: string; status?: string;
    amount?: number; amount_total?: number; currency?: string; payment_intent?: string;
    metadata?: { kind?: string; checkout_id?: string };
  };
  const checkoutId = o.metadata?.checkout_id;
  if (o.livemode !== false || o.metadata?.kind !== KIND || typeof checkoutId !== "string" || !UUID_PATTERN.test(checkoutId)
    || typeof o.id !== "string" || typeof o.currency !== "string" || !["usd", "gbp", "eur"].includes(o.currency)) return null;

  const failed = e.type === "payment_intent.payment_failed" && PAYMENT_INTENT_ID.test(o.id);
  const isSession = o.mode === "payment" && SESSION_ID.test(o.id);
  const paid = isSession && e.type === "checkout.session.completed" && o.payment_status === "paid"
    && typeof o.payment_intent === "string" && PAYMENT_INTENT_ID.test(o.payment_intent);
  const expired = isSession && e.type === "checkout.session.expired" && o.status === "expired";
  const amount = failed ? o.amount : o.amount_total;
  if ((!failed && !paid && !expired) || typeof amount !== "number" || !Number.isInteger(amount) || amount < 50 || amount > 99999999) return null;
  return {
    _event_id: e.id,
    _checkout_id: checkoutId,
    _account_id: e.account,
    _amount_cents: amount,
    _currency: o.currency,
    _session_id: isSession ? o.id : null,
    _payment_intent_id: failed ? o.id : paid ? o.payment_intent! : null,
    _status: failed ? "failed" : paid ? "paid" : "expired",
  };
}
