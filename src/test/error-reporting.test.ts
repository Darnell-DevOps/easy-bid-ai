import { describe, expect, it } from "vitest";
import { toErrorDetails } from "@/lib/error-reporting";

describe("client error normalization", () => {
  it("keeps useful Error details", () => {
    const error = new Error("checkout failed");
    const details = toErrorDetails(error);
    expect(details.message).toBe("checkout failed");
    expect(details.stack).toContain("checkout failed");
  });

  it("handles strings and circular values safely", () => {
    expect(toErrorDetails("plain failure")).toEqual({ message: "plain failure", stack: null });
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(toErrorDetails(circular)).toEqual({ message: "Unknown client error", stack: null });
  });
});
