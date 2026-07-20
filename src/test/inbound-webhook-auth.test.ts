import { describe, expect, it } from "vitest";
import {
  hasConfiguredInboundSecret,
  isInboundSecretValid,
} from "../../supabase/functions/_shared/inbound-auth.ts";

const generatedSecret = "a".repeat(48);

describe("inbound webhook shared-secret verification", () => {
  it("accepts only an exact shared-secret match", async () => {
    await expect(isInboundSecretValid(generatedSecret, generatedSecret)).resolves.toBe(true);
    await expect(isInboundSecretValid(generatedSecret, `${generatedSecret.slice(0, -1)}b`)).resolves.toBe(false);
  });

  it("fails closed when the stored secret is missing or malformed", async () => {
    expect(hasConfiguredInboundSecret(null)).toBe(false);
    expect(hasConfiguredInboundSecret("")).toBe(false);
    expect(hasConfiguredInboundSecret("too-short")).toBe(false);
    await expect(isInboundSecretValid(null, generatedSecret)).resolves.toBe(false);
  });

  it("rejects missing, non-string, and oversized supplied secrets", async () => {
    await expect(isInboundSecretValid(generatedSecret, null)).resolves.toBe(false);
    await expect(isInboundSecretValid(generatedSecret, { value: generatedSecret })).resolves.toBe(false);
    await expect(isInboundSecretValid(generatedSecret, "x".repeat(513))).resolves.toBe(false);
  });
});
