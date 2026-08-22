import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-captcha", () => ({ authCaptchaSiteKey: "test-site-key" }));

import AuthCaptcha from "@/components/auth/AuthCaptcha";

type TurnstileOptions = {
  callback: (token: string) => void;
  "error-callback": () => void;
  "expired-callback": () => void;
  "timeout-callback": () => void;
};

describe("authentication CAPTCHA accessibility", () => {
  let latestOptions: TurnstileOptions;
  let renderWidget: ReturnType<typeof vi.fn>;
  let removeWidget: ReturnType<typeof vi.fn>;
  let resetWidget: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.getElementById("cloudflare-turnstile-script")?.remove();
    renderWidget = vi.fn((_container: HTMLElement, options: TurnstileOptions) => {
      latestOptions = options;
      return "widget-1";
    });
    removeWidget = vi.fn();
    resetWidget = vi.fn();
    Object.defineProperty(window, "turnstile", {
      configurable: true,
      value: {
        ready: (callback: () => void) => callback(),
        render: renderWidget,
        remove: removeWidget,
        reset: resetWidget,
      },
    });
  });

  it("exposes its loading state before the challenge is ready", async () => {
    let releaseReady: (() => void) | undefined;
    window.turnstile!.ready = (callback) => {
      releaseReady = callback;
    };

    render(<AuthCaptcha action="login" onTokenChange={vi.fn()} />);

    const group = screen.getByRole("group", { name: "Security verification" });
    expect(group).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Loading security verification");

    await act(async () => releaseReady?.());

    await waitFor(() => expect(group).toHaveAttribute("aria-busy", "false"));
    expect(screen.queryByText("Loading security verification…")).not.toBeInTheDocument();
  });

  it("focuses a failed challenge and provides a working retry control", async () => {
    const onTokenChange = vi.fn();
    render(<AuthCaptcha action="signup" onTokenChange={onTokenChange} />);
    await waitFor(() => expect(renderWidget).toHaveBeenCalledOnce());

    act(() => latestOptions["error-callback"]());

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Security verification failed");
    await waitFor(() => expect(alert).toHaveFocus());
    expect(onTokenChange).toHaveBeenLastCalledWith(null);

    fireEvent.click(screen.getByRole("button", { name: "Retry security verification" }));

    await waitFor(() => expect(renderWidget).toHaveBeenCalledTimes(2));
    expect(removeWidget).toHaveBeenCalledWith("widget-1");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("announces expiry and keeps submission blocked until a fresh token is issued", async () => {
    const onTokenChange = vi.fn();
    render(<AuthCaptcha action="password-reset" onTokenChange={onTokenChange} />);
    await waitFor(() => expect(renderWidget).toHaveBeenCalledOnce());

    act(() => latestOptions.callback("valid-token"));
    expect(onTokenChange).toHaveBeenLastCalledWith("valid-token");

    act(() => latestOptions["expired-callback"]());

    expect(screen.getByRole("status")).toHaveTextContent(
      "Security verification expired. Complete the check again to continue.",
    );
    expect(onTokenChange).toHaveBeenLastCalledWith(null);
  });

  it("turns a challenge timeout into a focused, recoverable error", async () => {
    const onTokenChange = vi.fn();
    render(<AuthCaptcha action="login" onTokenChange={onTokenChange} />);
    await waitFor(() => expect(renderWidget).toHaveBeenCalledOnce());

    act(() => latestOptions["timeout-callback"]());

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Security verification timed out");
    await waitFor(() => expect(alert).toHaveFocus());
    expect(screen.getByRole("button", { name: "Retry security verification" })).toBeInTheDocument();
    expect(onTokenChange).toHaveBeenLastCalledWith(null);
  });

  it("removes a failed script so a network-load retry can start cleanly", async () => {
    const turnstileApi = window.turnstile;
    Reflect.deleteProperty(window, "turnstile");
    render(<AuthCaptcha action="login" onTokenChange={vi.fn()} />);

    const failedScript = await waitFor(() => {
      const script = document.getElementById("cloudflare-turnstile-script");
      expect(script).toBeInstanceOf(HTMLScriptElement);
      return script as HTMLScriptElement;
    });
    fireEvent.error(failedScript);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Security verification could not load");
    expect(document.getElementById("cloudflare-turnstile-script")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry security verification" }));
    const replacementScript = await waitFor(() => {
      const script = document.getElementById("cloudflare-turnstile-script");
      expect(script).toBeInstanceOf(HTMLScriptElement);
      expect(script).not.toBe(failedScript);
      return script as HTMLScriptElement;
    });

    Object.defineProperty(window, "turnstile", { configurable: true, value: turnstileApi });
    fireEvent.load(replacementScript);

    await waitFor(() => expect(renderWidget).toHaveBeenCalledOnce());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
