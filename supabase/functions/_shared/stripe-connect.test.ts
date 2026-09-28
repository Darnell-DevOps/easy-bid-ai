import {
  accountCanTakeClientPayments,
  connectReturnOrigin,
  getStripeConnectKey,
  isStripeAccountId,
  stripeRequest,
} from "./stripe-connect.ts";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

Deno.test("only test keys can initialize Connect", () => {
  const previous = Deno.env.get("STRIPE_CONNECT_SECRET_KEY");
  try {
    Deno.env.set("STRIPE_CONNECT_SECRET_KEY", "sk_live_unsafe");
    assert(getStripeConnectKey() === null, "live key must be blocked");
    Deno.env.set("STRIPE_CONNECT_SECRET_KEY", "sk_test_example");
    assert(getStripeConnectKey() === "sk_test_example", "test key should pass");
  } finally {
    if (previous === undefined) Deno.env.delete("STRIPE_CONNECT_SECRET_KEY");
    else Deno.env.set("STRIPE_CONNECT_SECRET_KEY", previous);
  }
});

Deno.test("merchant readiness requires charges, payouts and active card capability", () => {
  const ready = { charges_enabled: true, payouts_enabled: true, capabilities: { card_payments: "active" } };
  assert(accountCanTakeClientPayments(ready), "fully enabled merchant should pass");
  assert(!accountCanTakeClientPayments({ ...ready, payouts_enabled: false }), "missing payouts must block");
  assert(!accountCanTakeClientPayments({ ...ready, capabilities: { card_payments: "pending" } }), "pending card capability must block");
  assert(isStripeAccountId("acct_abc123"), "valid account id must pass");
  assert(!isStripeAccountId("acct_abc/other"), "unsafe account id must be rejected");
});

Deno.test("onboarding return origin must be a clean HTTPS origin", () => {
  const previous = Deno.env.get("STRIPE_CONNECT_APP_ORIGIN");
  try {
    for (const unsafe of ["http://example.com", "https://example.com/path", "https://user@example.com", "https://example.com/?next=evil"]) {
      Deno.env.set("STRIPE_CONNECT_APP_ORIGIN", unsafe);
      assert(connectReturnOrigin() === null, `${unsafe} must be rejected`);
    }
    Deno.env.set("STRIPE_CONNECT_APP_ORIGIN", "https://easy-bid-ai.lovable.app");
    assert(connectReturnOrigin() === "https://easy-bid-ai.lovable.app", "Lovable origin should pass");
  } finally {
    if (previous === undefined) Deno.env.delete("STRIPE_CONNECT_APP_ORIGIN");
    else Deno.env.set("STRIPE_CONNECT_APP_ORIGIN", previous);
  }
});

Deno.test("Stripe requests carry the server key and stable idempotency key", async () => {
  const originalFetch = globalThis.fetch;
  let seen: { url: string; authorization: string | null; idempotency: string | null; body: string } | null = null;
  try {
    globalThis.fetch = async (input, init) => {
      const headers = new Headers(init?.headers);
      seen = {
        url: String(input),
        authorization: headers.get("Authorization"),
        idempotency: headers.get("Idempotency-Key"),
        body: String(init?.body),
      };
      return Response.json({ id: "acct_abc123" });
    };
    const result = await stripeRequest<{ id: string }>("sk_test_private", "/accounts", {
      method: "POST", body: new URLSearchParams({ type: "standard" }), idempotencyKey: "one-owner-test",
    });
    assert(result.id === "acct_abc123", "Stripe account should be returned");
    const observation = seen as { url: string; authorization: string | null; idempotency: string | null; body: string } | null;
    if (!observation) throw new Error("Stripe request was not made");
    assert(observation.url === "https://api.stripe.com/v1/accounts", "must call Stripe API");
    assert(observation.authorization === "Bearer sk_test_private", "must authenticate server-side");
    assert(observation.idempotency === "one-owner-test", "must send idempotency key");
    assert(observation.body === "type=standard", "must send form encoded parameters");
  } finally { globalThis.fetch = originalFetch; }
});
