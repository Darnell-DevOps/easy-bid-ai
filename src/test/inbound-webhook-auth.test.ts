import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  hasConfiguredInboundSecret,
  isInboundSecretValid,
} from "../../supabase/functions/_shared/inbound-auth.ts";

const generatedSecret = "a".repeat(48);
const webhookSource = readFileSync(
  resolve(process.cwd(), "supabase/functions/inbound-email-webhook/index.ts"), "utf8");

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

  it("throttles anonymous attempts before parsing attacker-controlled JSON", () => {
    const throttleIndex = webhookSource.indexOf('source: "inbound-email-webhook-auth"');
    const parseIndex = webhookSource.indexOf("req.json()");

    expect(throttleIndex).toBeGreaterThan(-1);
    expect(throttleIndex).toBeLessThan(parseIndex);
    expect(webhookSource).toContain("ipLimit: { maxRequests: 120, windowSeconds: 5 * 60 }");
  });

  it("atomically limits only secret-authenticated deliveries per alias", () => {
    const secretCheckIndex = webhookSource.indexOf("if (!(await isInboundSecretValid");
    const deliveryLimitIndex = webhookSource.indexOf('source: "inbound-email-webhook-delivery"');

    expect(secretCheckIndex).toBeGreaterThan(-1);
    expect(secretCheckIndex).toBeLessThan(deliveryLimitIndex);
    expect(webhookSource).toContain("resource: slug");
    expect(webhookSource).toContain("resourceLimit: { maxRequests: 20, windowSeconds: 5 * 60 }");
    expect(webhookSource).not.toContain("rate_window_count");
  });
});
