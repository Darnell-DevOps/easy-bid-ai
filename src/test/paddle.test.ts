import { afterEach, describe, expect, it, vi } from "vitest";

describe("Paddle loader", () => {
  afterEach(() => {
    document
      .querySelectorAll('script[src="https://cdn.paddle.com/paddle/v2/paddle.js"]')
      .forEach((script) => script.remove());
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("registers checkout callbacks through Initialize and Update", async () => {
    vi.stubEnv("VITE_PAYMENTS_CLIENT_TOKEN", "test_123456");
    const setEnvironment = vi.fn();
    const initialize = vi.fn();
    const update = vi.fn();
    Object.defineProperty(window, "Paddle", {
      configurable: true,
      writable: true,
      value: {
        Environment: { set: setEnvironment },
        Initialize: initialize,
        Update: update,
        Checkout: { open: vi.fn() },
      },
    });

    const { initializePaddle } = await import("@/lib/paddle");
    const firstCallback = vi.fn();
    const loading = initializePaddle(firstCallback);
    const script = document.querySelector<HTMLScriptElement>(
      'script[src="https://cdn.paddle.com/paddle/v2/paddle.js"]',
    );
    expect(script).not.toBeNull();
    script?.dispatchEvent(new Event("load"));
    await loading;

    expect(setEnvironment).toHaveBeenCalledWith("sandbox");
    expect(initialize).toHaveBeenCalledWith({
      token: "test_123456",
      eventCallback: firstCallback,
    });

    const secondCallback = vi.fn();
    await initializePaddle(secondCallback);
    expect(update).toHaveBeenCalledWith({ eventCallback: secondCallback });
  });
});
