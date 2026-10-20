import { afterEach, describe, expect, it, vi } from "vitest";
import { createStripeConnectMerchant } from "../../supabase/functions/_shared/stripe-connect-account-create";
import { StripeRequestError } from "../../supabase/functions/_shared/stripe-connect-errors";

const owner = { userId: "owner-123", email: "merchant@example.test", country: "GB" };
const merchant = {
  id: "acct_merchant123", livemode: false, dashboard: "full",
  identity: { country: "GB" }, applied_configurations: ["merchant"],
  defaults: { responsibilities: { fees_collector: "stripe", losses_collector: "stripe" } },
};
afterEach(() => vi.unstubAllGlobals());

describe("Accounts v2 merchant creation", () => {
  it("uses JSON and the current API with separate merchants, Stripe fees and Stripe losses", async () => {
    const fetcher = vi.fn(async () => Response.json(merchant));
    vi.stubGlobal("fetch", fetcher);
    expect(await createStripeConnectMerchant("sk_test_example", owner)).toBe("acct_merchant123");
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.stripe.com/v2/core/accounts");
    expect(init.method).toBe("POST");
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer sk_test_example");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("Stripe-Version")).toBe("2026-09-30.endive");
    expect(JSON.parse(String(init.body))).toEqual({
      contact_email: owner.email, identity: { country: "gb" }, dashboard: "full",
      configuration: { merchant: { capabilities: { card_payments: { requested: true } } } },
      defaults: { responsibilities: { fees_collector: "stripe", losses_collector: "stripe" } },
      metadata: { closesync_user_id: owner.userId },
      include: ["identity", "defaults", "configuration.merchant"],
    });
  });

  it("keeps retries stable, separates owners and avoids the cached v1 request", async () => {
    const keys: Array<string | null> = [];
    vi.stubGlobal("fetch", vi.fn(async (_input, init: RequestInit) => {
      keys.push(new Headers(init.headers).get("Idempotency-Key"));
      return Response.json(merchant);
    }));
    await createStripeConnectMerchant("sk_test_example", owner);
    await createStripeConnectMerchant("sk_test_example", owner);
    await createStripeConnectMerchant("sk_test_example", { ...owner, userId: "owner-456" });
    expect(keys[0]).toBe("closesync-connect-test-accounts-v2-owner-123");
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[0]);
    expect(keys[0]).not.toBe(`closesync-connect-test-${owner.userId}`);
  });

  it.each([
    { livemode: true }, { livemode: undefined }, { id: "not-an-account" },
    { identity: { country: "US" } }, { identity: null }, { dashboard: "none" },
    { applied_configurations: ["customer"] },
    { defaults: { responsibilities: { fees_collector: "application", losses_collector: "stripe" } } },
    { defaults: { responsibilities: { fees_collector: "stripe", losses_collector: "application" } } },
  ])("refuses an unexpected account before it can be saved: %j", async (overrides) => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ...merchant, ...overrides })));
    await expect(createStripeConnectMerchant("sk_test_example", owner)).rejects.toThrow("unexpected merchant");
  });

  it("blocks live credentials without making a request", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(createStripeConnectMerchant("sk_live_example", owner)).rejects.toThrow("Only Stripe test");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("propagates safe provider diagnostics without retrying account creation blindly", async () => {
    const fetcher = vi.fn(async () => Response.json({ error: {
      code: "connect_profile_not_submitted", type: "invalid_request_error",
      message: "Private merchant@example.test",
    } }, { status: 400, headers: { "request-id": "req_v2test" } }));
    vi.stubGlobal("fetch", fetcher);
    const error = await createStripeConnectMerchant("sk_test_example", owner).catch((value) => value);
    expect(error).toBeInstanceOf(StripeRequestError);
    expect(error.diagnostics()).toMatchObject({ requestId: "req_v2test", reason: "stripe_connect_setup_required" });
    expect(JSON.stringify(error)).not.toContain("merchant@example.test");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
