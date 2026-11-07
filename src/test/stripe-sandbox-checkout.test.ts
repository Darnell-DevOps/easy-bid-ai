import { createHmac, webcrypto } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getOrCreateSandboxSession, sandboxCheckoutEvent, verifyStripeWebhookSignature,
  type SandboxCheckout,
} from "../../supabase/functions/_shared/stripe-sandbox-checkout.ts";

const attempt: SandboxCheckout = {
  id: "00000000-0000-4000-8000-000000000001",
  contract_id: "00000000-0000-4000-8000-000000000002",
  account_id: "acct_TestMerchant1",
  amount_cents: 1500,
  currency: "gbp",
  return_origin: "https://test.example.invalid",
  expires_at: 2_000_000_000,
  status: "pending",
  stripe_session_id: null,
};
const stripeSession = {
  id: "cs_test_Fixture1", url: "https://checkout.stripe.com/c/pay/cs_test_Fixture1",
  livemode: false, status: "open", amount_total: 1500, currency: "gbp",
  metadata: { checkout_id: attempt.id, kind: "closesync_sandbox_contract" },
};

afterEach(() => vi.unstubAllGlobals());

describe("connected account sandbox checkout", () => {
  it("retries creation with the same idempotency key and reopens a bound session", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("response lost"))
      .mockImplementation(async () => Response.json(stripeSession));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getOrCreateSandboxSession("sk_test_fixture", attempt)).rejects.toThrow("response lost");
    await expect(getOrCreateSandboxSession("sk_test_fixture", attempt)).resolves.toMatchObject({ id: stripeSession.id, url: stripeSession.url });
    const [first, retry] = fetchMock.mock.calls;
    expect(new Headers(first[1]?.headers).get("Idempotency-Key")).toBe(`sandbox-contract-${attempt.id}`);
    expect(new Headers(retry[1]?.headers).get("Idempotency-Key")).toBe(new Headers(first[1]?.headers).get("Idempotency-Key"));
    expect(new Headers(retry[1]?.headers).get("Stripe-Account")).toBe(attempt.account_id);
    expect((retry[1]?.body as URLSearchParams).get("line_items[0][price_data][unit_amount]")).toBe("1500");
    expect(String(retry[1]?.body)).toBe(String(first[1]?.body));

    await getOrCreateSandboxSession("sk_test_fixture", { ...attempt, stripe_session_id: stripeSession.id, status: "failed" });
    expect(fetchMock.mock.calls[2][0]).toBe(`https://api.stripe.com/v1/checkout/sessions/${stripeSession.id}`);
    expect(fetchMock.mock.calls[2][1]?.method).toBe("GET");
  });

  it("rejects live keys and mismatched Stripe responses", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ ...stripeSession, amount_total: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getOrCreateSandboxSession("sk_live_fixture", attempt)).rejects.toThrow("Sandbox Stripe account required");
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(getOrCreateSandboxSession("sk_test_fixture", attempt)).rejects.toThrow("Stripe returned a different checkout");
  });

  it("verifies the original signed request and rejects modified or stale bodies", async () => {
    vi.stubGlobal("crypto", webcrypto);
    const secret = "whsec_fixture";
    const timestamp = 1_800_000_000;
    const body = '{ "message": "é" }';
    const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
    const header = `t=${timestamp},v1=${signature}`;
    await expect(verifyStripeWebhookSignature(body, header, secret, timestamp * 1000)).resolves.toBe(true);
    await expect(verifyStripeWebhookSignature(body.trim().replaceAll(" ", ""), header, secret, timestamp * 1000)).resolves.toBe(false);
    await expect(verifyStripeWebhookSignature(body, header, secret, (timestamp + 301) * 1000)).resolves.toBe(false);
  });

  it("routes paid and failed events only for matching test checkout objects", () => {
    const event = {
      id: "evt_Fixture1", type: "checkout.session.completed", livemode: false, account: attempt.account_id,
      data: { object: { ...stripeSession, mode: "payment", payment_status: "paid", payment_intent: "pi_Fixture1" } },
    };
    expect(sandboxCheckoutEvent(event)).toMatchObject({
      _checkout_id: attempt.id, _account_id: attempt.account_id, _status: "paid", _amount_cents: 1500,
    });
    expect(sandboxCheckoutEvent({ ...event, livemode: true })).toBeNull();
    expect(sandboxCheckoutEvent({ ...event, account: undefined })).toBeNull();
    expect(sandboxCheckoutEvent({ ...event, data: { object: { ...event.data.object, payment_status: "unpaid" } } })).toBeNull();
    expect(sandboxCheckoutEvent({
      ...event, type: "payment_intent.payment_failed", data: { object: {
        id: "pi_Fixture1", livemode: false, amount: 1500, currency: "gbp", metadata: stripeSession.metadata,
      } },
    })).toMatchObject({ _status: "failed", _payment_intent_id: "pi_Fixture1" });
  });
});
