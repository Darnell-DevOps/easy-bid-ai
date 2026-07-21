import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  initializePaddle: vi.fn(),
  invoke: vi.fn(),
  isPaymentsConfigured: vi.fn(),
  isTestMode: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: mocks.invoke },
  },
}));

vi.mock("@/lib/paddle", () => ({
  initializePaddle: mocks.initializePaddle,
  isPaymentsConfigured: mocks.isPaymentsConfigured,
  isTestMode: mocks.isTestMode,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

import { useProposalCheckout } from "@/hooks/use-proposal-checkout";

describe("proposal checkout", () => {
  const checkoutOpen = vi.fn();

  beforeEach(() => {
    mocks.initializePaddle.mockReset();
    mocks.invoke.mockReset();
    mocks.isPaymentsConfigured.mockReset();
    mocks.isTestMode.mockReset();
    mocks.toast.mockReset();
    checkoutOpen.mockReset();

    mocks.isPaymentsConfigured.mockReturnValue(true);
    mocks.isTestMode.mockReturnValue(true);
    Object.defineProperty(window, "Paddle", {
      configurable: true,
      value: { Checkout: { open: checkoutOpen } },
    });
  });

  it("stops before calling the backend when payments are not configured", async () => {
    mocks.isPaymentsConfigured.mockReturnValue(false);
    const { result } = renderHook(() => useProposalCheckout());

    let opened: boolean | undefined;
    await act(async () => {
      opened = await result.current.openCheckout({ proposalId: "proposal-1" });
    });

    expect(opened).toBe(false);
    expect(result.current.available).toBe(false);
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.initializePaddle).not.toHaveBeenCalled();
    expect(checkoutOpen).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith({
      title: "Payments unavailable",
      description: "Payment system is not configured yet.",
      variant: "destructive",
    });
  });

  it("opens a sandbox checkout and handles confirmed payment", async () => {
    let eventCallback: ((event: { name?: string }) => void) | undefined;
    mocks.invoke.mockResolvedValue({
      data: { transactionId: "txn-sandbox" },
      error: null,
    });
    mocks.initializePaddle.mockImplementation(async (callback) => {
      eventCallback = callback;
    });
    const onPaid = vi.fn();
    const { result } = renderHook(() => useProposalCheckout());

    let opened: boolean | undefined;
    await act(async () => {
      opened = await result.current.openCheckout({
        proposalId: "proposal-2",
        clientEmail: "client@example.com",
        onPaid,
      });
    });

    expect(opened).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(mocks.invoke).toHaveBeenCalledWith("create-proposal-checkout", {
      body: { proposalId: "proposal-2", environment: "sandbox" },
    });
    expect(checkoutOpen).toHaveBeenCalledWith({
      transactionId: "txn-sandbox",
      customer: { email: "client@example.com" },
      settings: {
        displayMode: "overlay",
        variant: "one-page",
        successUrl: `${window.location.origin}${window.location.pathname}?paid=1`,
        allowLogout: false,
        theme: "dark",
      },
    });

    act(() => {
      eventCallback?.({ name: "checkout.completed" });
    });
    expect(onPaid).toHaveBeenCalledTimes(1);
    expect(mocks.toast).toHaveBeenCalledWith({
      title: "Payment complete",
      description: "Thanks! Your payment was received.",
    });
  });

  it("uses the live environment and omits an absent customer email", async () => {
    mocks.isTestMode.mockReturnValue(false);
    mocks.invoke.mockResolvedValue({ data: { transactionId: "txn-live" }, error: null });
    mocks.initializePaddle.mockResolvedValue(undefined);
    const { result } = renderHook(() => useProposalCheckout());

    await act(async () => {
      await result.current.openCheckout({ proposalId: "proposal-live" });
    });

    expect(mocks.invoke).toHaveBeenCalledWith("create-proposal-checkout", {
      body: { proposalId: "proposal-live", environment: "live" },
    });
    expect(checkoutOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: "txn-live",
        customer: undefined,
      }),
    );
  });

  it("does not initialize Paddle when transaction creation fails", async () => {
    mocks.invoke.mockResolvedValue({
      data: null,
      error: new Error("Checkout service unavailable"),
    });
    const { result } = renderHook(() => useProposalCheckout());

    let opened: boolean | undefined;
    await act(async () => {
      opened = await result.current.openCheckout({ proposalId: "proposal-3" });
    });

    expect(opened).toBe(false);
    expect(result.current.loading).toBe(false);
    expect(mocks.initializePaddle).not.toHaveBeenCalled();
    expect(checkoutOpen).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith({
      title: "Payment failed to start",
      description: "Checkout service unavailable",
      variant: "destructive",
    });
  });

  it("reports a Paddle open failure and always clears loading", async () => {
    mocks.invoke.mockResolvedValue({ data: { transactionId: "txn-bad" }, error: null });
    mocks.initializePaddle.mockResolvedValue(undefined);
    checkoutOpen.mockImplementation(() => {
      throw new Error("Paddle overlay failed");
    });
    const { result } = renderHook(() => useProposalCheckout());

    let opened: boolean | undefined;
    await act(async () => {
      opened = await result.current.openCheckout({ proposalId: "proposal-4" });
    });

    expect(opened).toBe(false);
    expect(result.current.loading).toBe(false);
    expect(mocks.toast).toHaveBeenCalledWith({
      title: "Payment failed to start",
      description: "Paddle overlay failed",
      variant: "destructive",
    });
  });
});
