import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FunctionsHttpError } from "@supabase/supabase-js";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } },
}));

import StripeConnectCard from "@/components/settings/StripeConnectCard";
import { interpretConnectResponse, safeStripeOnboardingUrl } from "@/lib/stripe-connect-status";

const ok = (data: unknown) => Promise.resolve({ data, error: null });

beforeEach(() => invoke.mockReset());

describe("interpretConnectResponse", () => {
  it("distinguishes each server state", () => {
    expect(interpretConnectResponse({ configured: false, connected: false, environment: "test" }).kind).toBe("not_configured");
    expect(interpretConnectResponse({ configured: true, connected: false, environment: "test" }).kind).toBe("unconnected");
    expect(interpretConnectResponse({ configured: true, connected: true, ready: false, environment: "test", chargesEnabled: true, payoutsEnabled: false }).kind).toBe("incomplete");
    expect(interpretConnectResponse({ configured: true, connected: true, ready: true, environment: "test", chargesEnabled: true, payoutsEnabled: true }).kind).toBe("ready");
  });

  it("never reports ready without explicit capabilities or in a non-test environment", () => {
    expect(interpretConnectResponse({ configured: true, connected: true, ready: true, environment: "test" }).kind).toBe("incomplete");
    expect(interpretConnectResponse({ configured: true, connected: true, ready: true, environment: "live", chargesEnabled: true, payoutsEnabled: true }).kind).toBe("error");
    expect(interpretConnectResponse(null).kind).toBe("error");
    expect(interpretConnectResponse({ error: "Private provider text" })).toEqual({ kind: "error", message: "We couldn't check your Stripe connection. Please retry." });
  });
});

describe("safeStripeOnboardingUrl", () => {
  it("accepts only https connect.stripe.com", () => {
    expect(safeStripeOnboardingUrl("https://connect.stripe.com/setup/s/abc")).toBe("https://connect.stripe.com/setup/s/abc");
    for (const bad of ["http://connect.stripe.com/x", "https://connect.stripe.com.evil.io/x", "https://evil.io/?connect.stripe.com", "javascript:alert(1)", "https://u:p@connect.stripe.com/x", 42]) {
      expect(safeStripeOnboardingUrl(bad)).toBeNull();
    }
  });
});

describe("StripeConnectCard", () => {
  it("requests status on load and shows not-configured without an action", async () => {
    invoke.mockReturnValueOnce(ok({ configured: false, connected: false, environment: "test" }));
    render(<StripeConnectCard redirect={vi.fn()} />);
    expect(await screen.findByText(/isn't set up for this CloseSync deployment/)).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith("stripe-connect-account", { body: { action: "status" } });
    expect(screen.queryByRole("button", { name: /Connect with Stripe/ })).toBeNull();
  });

  it("requires an explicitly selected country before onboarding", async () => {
    invoke.mockReturnValueOnce(ok({ configured: true, connected: false, environment: "test" }));
    render(<StripeConnectCard redirect={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /Connect with Stripe/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Select your business's legal country/);
    expect(screen.getByLabelText("Legal business country")).toHaveAttribute("aria-invalid", "true");
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("sends the selected country and redirects only to a validated Stripe URL", async () => {
    const redirect = vi.fn();
    invoke
      .mockReturnValueOnce(ok({ configured: true, connected: false, environment: "test" }))
      .mockReturnValueOnce(ok({ configured: true, connected: true, ready: false, environment: "test", url: "https://connect.stripe.com/setup/s/abc" }));
    render(<StripeConnectCard redirect={redirect} />);
    fireEvent.change(await screen.findByLabelText("Legal business country"), { target: { value: "GB" } });
    fireEvent.click(screen.getByRole("button", { name: /Connect with Stripe/ }));
    await waitFor(() => expect(redirect).toHaveBeenCalledWith("https://connect.stripe.com/setup/s/abc"));
    expect(invoke).toHaveBeenLastCalledWith("stripe-connect-account", { body: { action: "onboard", country: "GB" } });
  });

  it("refuses to redirect to an untrusted URL", async () => {
    const redirect = vi.fn();
    invoke
      .mockReturnValueOnce(ok({ configured: true, connected: true, ready: false, environment: "test", chargesEnabled: false, payoutsEnabled: false }))
      .mockReturnValueOnce(ok({ configured: true, connected: true, ready: false, environment: "test", url: "https://evil.example/phish" }));
    render(<StripeConnectCard redirect={redirect} />);
    fireEvent.click(await screen.findByRole("button", { name: /Continue Stripe setup/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/valid onboarding link/);
    expect(redirect).not.toHaveBeenCalled();
    expect(invoke).toHaveBeenLastCalledWith("stripe-connect-account", { body: { action: "onboard" } });
  });

  it("shows ready but explains checkout is still disabled", async () => {
    invoke.mockReturnValueOnce(ok({ configured: true, connected: true, ready: true, environment: "test", chargesEnabled: true, payoutsEnabled: true }));
    render(<StripeConnectCard redirect={vi.fn()} />);
    expect(await screen.findByText(/stays off until signed webhooks and payment tests/)).toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Stripe setup|Connect with Stripe/ })).toBeNull();
  });

  it("shows a retryable error when the status call fails", async () => {
    invoke.mockReturnValueOnce(Promise.resolve({ data: null, error: new Error("x") }));
    render(<StripeConnectCard redirect={vi.fn()} />);
    expect(await screen.findByText(/couldn't check your Stripe connection/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Refresh status/ })).toBeEnabled();
  });

  it("shows the safe non-2xx setup reason and reference, preserving the country for retry", async () => {
    const redirect = vi.fn();
    const response = new Response(JSON.stringify({
      error: "Sensitive raw provider message must not be displayed",
      code: "stripe_connect_setup_required", requestId: "req_testReference",
    }), { status: 502, headers: { "Content-Type": "application/json" } });
    invoke
      .mockReturnValueOnce(ok({ configured: true, connected: false, environment: "test" }))
      .mockResolvedValueOnce({ data: null, error: new FunctionsHttpError(response) })
      .mockReturnValueOnce(ok({ url: "https://connect.stripe.com/setup/s/retry" }));
    render(<StripeConnectCard redirect={redirect} />);
    fireEvent.change(await screen.findByLabelText("Legal business country"), { target: { value: "GB" } });
    fireEvent.click(screen.getByRole("button", { name: /Connect with Stripe/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/isn't enabled for CloseSync's Stripe account/);
    expect(screen.getByRole("alert")).toHaveTextContent("Reference: req_testReference.");
    expect(screen.getByRole("alert")).not.toHaveTextContent("Sensitive raw");
    expect(screen.getByLabelText("Legal business country")).toHaveValue("GB");
    expect(screen.getByLabelText("Legal business country")).not.toHaveAttribute("aria-invalid");
    expect(response.bodyUsed).toBe(false);
    await waitFor(() => expect(screen.getByRole("button", { name: /Connect with Stripe/ })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /Connect with Stripe/ }));
    await waitFor(() => expect(redirect).toHaveBeenCalledWith("https://connect.stripe.com/setup/s/retry"));
  });

  it.each([
    [401, "Your session has expired"],
    [429, "Too many setup attempts"],
    [502, "We couldn't start Stripe onboarding"],
  ])("recovers from an HTTP %s response with an unreadable body", async (status, message) => {
    invoke
      .mockReturnValueOnce(ok({ configured: true, connected: false, environment: "test" }))
      .mockResolvedValueOnce({ data: null, error: new FunctionsHttpError(new Response("not JSON", { status })) });
    render(<StripeConnectCard redirect={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText("Legal business country"), { target: { value: "GB" } });
    fireEvent.click(screen.getByRole("button", { name: /Connect with Stripe/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    await waitFor(() => expect(screen.getByRole("button", { name: /Connect with Stripe/ })).toBeEnabled());
  });

  it("falls back safely for network failures", async () => {
    invoke
      .mockReturnValueOnce(ok({ configured: true, connected: false, environment: "test" }))
      .mockRejectedValueOnce(new Error("private transport details"));
    render(<StripeConnectCard redirect={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText("Legal business country"), { target: { value: "GB" } });
    fireEvent.click(screen.getByRole("button", { name: /Connect with Stripe/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't start Stripe onboarding. Please retry.");
    expect(screen.getByRole("alert")).not.toHaveTextContent("private transport");
  });

  it("never asks for keys or bank details", () => {
    const src = readFileSync(resolve(process.cwd(), "src/components/settings/StripeConnectCard.tsx"), "utf8");
    expect(src).not.toMatch(/sk_(test|live)|api key|IBAN|sort code|routing number|account number/i);
  });

  it("no longer claims Paddle handles each business's client payments", () => {
    const src = readFileSync(resolve(process.cwd(), "src/components/settings/IntegrationsSettings.tsx"), "utf8");
    expect(src).not.toContain("Paddle processes plan billing, client payments and retainers");
    expect(src).toContain("<StripeConnectCard />");
  });
});
