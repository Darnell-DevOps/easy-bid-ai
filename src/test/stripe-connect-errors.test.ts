import { describe, expect, it } from "vitest";
import { StripeRequestError, stripeConnectFailure } from "../../supabase/functions/_shared/stripe-connect-errors";

describe("safe Stripe Connect errors", () => {
  it("keeps a request reference and error type when Stripe omits an error code", () => {
    const error = new StripeRequestError(400, { error: {
      type: "invalid_request_error", param: "capabilities",
      message: "Private merchant@example.test sk_test_neverExpose",
    } }, "req_abc123");
    expect(error.diagnostics()).toEqual({ status: 400, code: undefined, type: "invalid_request_error",
      param: "capabilities", requestId: "req_abc123", reason: "stripe_request_rejected" });
    expect(stripeConnectFailure(error)).toEqual({ code: "stripe_request_rejected",
      error: "Stripe rejected account setup. Contact CloseSync support.", requestId: "req_abc123" });
    expect(JSON.stringify(error)).not.toMatch(/merchant@|sk_test/);
    expect(error.message).not.toMatch(/merchant@|sk_test/);
  });

  it.each([
    [400, { message: "You can only create new accounts if you've signed up for Connect." }, "stripe_connect_setup_required"],
    [400, { code: "connect_profile_not_submitted" }, "stripe_connect_setup_required"],
    [400, { code: "accounts_v2_access_blocked" }, "stripe_connect_setup_required"],
    [400, { code: "platform_registration_required" }, "stripe_connect_setup_required"],
    [401, {}, "stripe_credentials_invalid"],
    [403, {}, "stripe_permission_denied"],
    [400, { param: "country" }, "stripe_country_rejected"],
    [400, { param: "identity.country" }, "stripe_country_rejected"],
    [429, {}, "stripe_temporarily_unavailable"],
    [503, {}, "stripe_temporarily_unavailable"],
  ])("classifies HTTP %s without exposing provider text", (status, body, code) => {
    const error = new StripeRequestError(status, { error: body }, "req_safe");
    expect(stripeConnectFailure(error).code).toBe(code);
  });

  it("drops untrusted diagnostic fields and arbitrary internal errors", () => {
    const error = new StripeRequestError(400, { error: {
      code: "person@example.test", param: "sk_test secret", type: "<script>",
    } }, "req_bad\nsecret");
    expect(error.diagnostics()).toEqual({ status: 400, code: undefined, type: undefined,
      param: undefined, requestId: undefined, reason: "stripe_request_rejected" });
    expect(stripeConnectFailure(new Error("private database details"))).toEqual({
      code: "connect_setup_failed", error: "Could not prepare the connected account. Please retry.",
    });
  });
});
