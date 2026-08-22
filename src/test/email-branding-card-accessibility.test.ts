import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/components/emails/BrandingCard.tsx"),
  "utf8",
);

describe("email branding card accessibility", () => {
  it("announces the loading state", () => {
    expect(source).toMatch(/role="status" aria-live="polite"/);
    expect(source).toContain('<span className="sr-only">Loading email branding</span>');
  });

  it("provides unique IDs to each reusable branding field", () => {
    const fieldIds = [...source.matchAll(/<Field\s+id="([^"]+)"/g)].map(
      (match) => match[1],
    );

    expect(fieldIds).toEqual([
      "branding-business-name",
      "branding-sender-name",
      "branding-logo-url",
      "branding-sign-off",
    ]);
    expect(new Set(fieldIds).size).toBe(fieldIds.length);
    expect(source).toContain("<Label htmlFor={id}");
    expect(source).toContain("<Input id={id}");
  });

  it("groups and names both brand colour controls", () => {
    expect(source).toMatch(
      /role="group" aria-labelledby="branding-colour-label"/,
    );
    expect(source).toContain('id="branding-colour-label"');
    expect(source).toMatch(
      /id="branding-colour-picker"[\s\S]*?aria-label="Choose brand colour"/,
    );
    expect(source).toMatch(
      /id="branding-colour-value" aria-label="Brand colour hex value"/,
    );
  });

  it("labels and describes the reply-to email field", () => {
    expect(source).toContain(
      '<Label htmlFor="branding-reply-to" className="sr-only">Reply-to email address</Label>',
    );
    expect(source).toContain('id="branding-reply-to-help"');
    expect(source).toMatch(
      /id="branding-reply-to"[\s\S]*?type="email"[\s\S]*?autoComplete="email"[\s\S]*?aria-describedby="branding-reply-to-help"/,
    );
    expect(source).not.toMatch(/<Label(?![^>]*htmlFor)[^>]*>/);
  });

  it("announces reply-to verification status changes", () => {
    expect(source).toMatch(/<div role="status" aria-live="polite">/);
    expect(source).toContain("Pending verification");
    expect(source).toContain("Verified");
  });

  it("announces branding saves and verification requests", () => {
    expect(source).toMatch(
      /<Button size="sm" onClick=\{saveBranding\} disabled=\{saving\} aria-busy=\{saving\}/,
    );
    expect(source).toMatch(
      /<Button onClick=\{requestVerification\} disabled=\{verifying\} aria-busy=\{verifying\}/,
    );
  });

  it("hides every decorative icon", () => {
    const iconTags = [
      ...source.matchAll(/<(Loader2|Palette|Save|ShieldCheck|Mail)\b[^>]*>/g),
    ].map((match) => match[0]);

    expect(iconTags).toHaveLength(8);
    for (const iconTag of iconTags) {
      expect(iconTag).toContain('aria-hidden="true"');
    }
  });
});
