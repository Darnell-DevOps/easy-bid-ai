import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/components/settings/InboundEmailSettings.tsx"), "utf8");

describe("Inbound email settings accessibility", () => {
  it("associates the inbound address label, field, and guidance", () => {
    expect(source).toContain('htmlFor="inbound-email-address"');
    expect(source).toContain('id="inbound-email-address"');
    expect(source).toContain('aria-describedby="inbound-email-address-help"');
    expect(source).toContain('id="inbound-email-address-help"');
    expect(source).toContain('aria-label={copied ? "Inbound address copied" : "Copy inbound address"}');
    expect(source).not.toMatch(/<Label(?![^>]*htmlFor)[^>]*>/);
  });

  it("announces loading, empty, and digest-saving states", () => {
    expect(source).toContain('role="status" aria-live="polite"');
    expect(source).toContain("Loading inbound email settings");
    expect(source).toContain('<p role="status"');
    expect(source).toContain('aria-label="Email a daily digest of new leads"');
    expect(source).toContain('aria-busy={savingNotify}');
  });

  it("exposes the advanced instructions as a disclosure", () => {
    expect(source).toContain('aria-expanded={showAdvanced}');
    expect(source).toContain('aria-controls="inbound-email-setup-instructions"');
    expect(source).toContain('id="inbound-email-setup-instructions"');
  });

  it("preserves alias, clipboard, digest, webhook, and secret workflows", () => {
    expect(source).toContain('.select("slug, inbound_secret, notify_digest")');
    expect(source).toContain("await navigator.clipboard.writeText(fullAddress)");
    expect(source).toContain("setTimeout(() => setCopied(false), 1500)");
    expect(source).toContain('.update({ notify_digest: next })');
    expect(source).toContain("`${publicClientConfig.supabaseUrl}/functions/v1/inbound-email-webhook`");
    expect(source).toContain("Requests without an exact match are rejected.");
  });
});
