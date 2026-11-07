import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { reportClientError } from "@/lib/error-reporting";
import { landingEventPayload } from "@/lib/landing-analytics";
import { readTelemetryJson, safeErrorReport, telemetryRoute } from "../../supabase/functions/_shared/telemetry-privacy";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn(async () => ({})) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));

describe("client error normalization", () => {
  it("sends only a known route template and error category from the browser", () => {
    window.history.replaceState(null, "", "/sign/canary-signing-token?email=canary%40example.invalid#secret");
    try {
      reportClientError(new TypeError("canary@example.invalid: private data"), "window_error");
      expect(invoke).toHaveBeenLastCalledWith("report-client-error", {
        body: { source: "window_error", path: "/sign/:token", code: "TypeError" },
      });
    } finally {
      window.history.replaceState(null, "", "/");
    }
  });

  it("drops sensitive and spoofed fields even when an old or malicious browser sends them directly", () => {
    expect(safeErrorReport({
      source: "react_boundary", code: "__proto__", path: "/r/recover/canary-token?email=canary@example.invalid",
      message: "private message", stack: "private stack", user_agent: "private agent", metadata: { secret: "canary" },
      user_id: "forged", severity: "critical",
    })).toEqual({
      source: "react_boundary", severity: "fatal", message: "Unknown client error", path: "/r/recover/:token",
      stack: null, user_agent: null, metadata: {},
    });
    expect(safeErrorReport({ source: "private-data" })).toBeNull();
    expect(telemetryRoute("/unknown/canary-token")).toBeNull();
    expect(telemetryRoute("https://example.invalid/sign/canary-token")).toBeNull();
  });

  it("enforces a body limit when a sender omits Content-Length", async () => {
    const request = new Request("https://example.invalid/telemetry", { method: "POST", body: JSON.stringify({ value: "a".repeat(50) }) });
    await expect(readTelemetryJson(request, 20)).rejects.toThrow("too large");
  });

  it("keeps only approved CTA locations and never keeps caller-supplied metadata", () => {
    expect(landingEventPayload("cta_click", { location: "hero", email: "canary@example.invalid" }))
      .toEqual({ event: "cta_click", path: "/", meta: { location: "hero" } });
    expect(landingEventPayload("cta_click", { location: "canary-token" })).toBeNull();
    expect(landingEventPayload("signup_view", { location: "canary-token" }))
      .toEqual({ event: "signup_view", path: "/signup", meta: {} });
  });

  it("uses atomic request accounting before accepting public error reports", () => {
    const edgeSource = readFileSync(resolve(process.cwd(), "supabase/functions/report-client-error/index.ts"), "utf8");

    expect(edgeSource).toContain("enforcePublicRateLimit(req");
    expect(edgeSource).toContain("ipLimit: { maxRequests: 20, windowSeconds: 5 * 60 }");
    expect(edgeSource).not.toContain('.select("id", { count: "exact", head: true })');
  });
});
