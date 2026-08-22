import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/components/settings/DomainSettings.tsx"), "utf8");

describe("Domain settings accessibility", () => {
  it("associates and describes the custom-domain field", () => {
    expect(source).toContain('htmlFor="custom-domain"');
    expect(source).toContain('id="custom-domain"');
    expect(source).toContain('aria-describedby="custom-domain-help"');
    expect(source).toContain('id="custom-domain-help"');
    expect(source).toContain('autoCapitalize="none"');
    expect(source).toContain('autoCorrect="off"');
    expect(source).toContain("spellCheck={false}");
    expect(source).not.toMatch(/<Label(?![^>]*htmlFor)[^>]*>/);
  });

  it("names every domain-specific action", () => {
    expect(source).toContain('aria-label={`${row.verified ? "Re-check" : "Verify"} ${row.domain}`}');
    expect(source).toContain('aria-label={`Make ${row.domain} primary`}');
    expect(source).toContain('aria-label={`Remove ${row.domain}`}');
    expect(source).toContain('aria-label={`Copy CNAME host for ${row.domain}`}');
    expect(source).toContain('aria-label={`Copy CNAME target for ${row.domain}`}');
    expect(source).toContain('aria-label={`Copy TXT host for ${row.domain}`}');
    expect(source).toContain('aria-label={`Copy TXT value for ${row.domain}`}');
  });

  it("exposes loading, errors, and in-progress actions", () => {
    expect(source).toContain('role="status" aria-live="polite"');
    expect(source).toContain('<p role="alert"');
    expect(source).toContain('aria-busy={adding}');
    expect(source).toContain('aria-busy={verifyingId === row.id}');
  });

  it("preserves domain workflows and earlier switch naming", () => {
    expect(source).toContain('const domain = newDomain.trim().toLowerCase()');
    expect(source).toContain('.from("custom_domains" as any).insert({');
    expect(source).toContain('if (!confirm("Remove this domain?")) return');
    expect(source).toContain('supabase.functions.invoke("verify-custom-domain", { body: { id } })');
    expect(source).toContain('navigator.clipboard.writeText(text)');
    expect(source).toContain('update({ [field]: value })');
    expect(source).toContain('aria-label={`Use ${row.domain} for the client portal`}');
    expect(source).toContain('aria-label={`Use ${row.domain} for lead forms`}');
  });
});
