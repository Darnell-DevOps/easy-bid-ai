import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/components/settings/BusinessInformationSettings.tsx"),
  "utf8",
);

describe("Business information accessibility", () => {
  it("gives every reusable business field a unique labelled control", () => {
    const fieldIds = [...source.matchAll(/<Field\s+id="([^"]+)"/g)].map((match) => match[1]);

    expect(fieldIds).toHaveLength(21);
    expect(new Set(fieldIds).size).toBe(fieldIds.length);
    expect(source).not.toMatch(/<Field(?![^>]*\bid=)[^>]*>/);
    expect(source).toContain("<Label htmlFor={id}");

    for (const id of fieldIds) {
      const occurrences = source.match(new RegExp(`id="${id}"`, "g")) ?? [];
      expect(occurrences.length, id).toBeGreaterThanOrEqual(2);
    }
  });

  it("labels the business description and all Select triggers", () => {
    expect(source).toContain('htmlFor="business-info-description"');
    expect(source).toContain('id="business-info-description"');

    for (const id of [
      "business-info-proposal-expiry",
      "business-info-currency",
      "business-info-payment-terms",
      "business-info-tax-mode",
    ]) {
      expect(source).toContain(`<SelectTrigger id="${id}"`);
    }
  });

  it("connects validation and tax-treatment guidance to their controls", () => {
    for (const id of [
      "business-info-business-email",
      "business-info-business-phone",
      "business-info-website",
      "business-info-tax-rate",
    ]) {
      expect(source).toContain(`"${id}-error"`);
    }

    expect(source).toContain('id={`${id}-error`}');
    expect(source).toContain('aria-describedby="business-info-tax-mode-help"');
    expect(source).toContain('id="business-info-tax-mode-help"');
  });

  it("preserves validation, tax conversion, and business-branding persistence", () => {
    expect(source).toContain("const errors = useMemo(() => validate(data), [data])");
    expect(source).toContain('default_tax_rate: data.default_tax_rate === "" ? null : Number(data.default_tax_rate)');
    expect(source).toContain('.from("business_branding")');
    expect(source).toContain('.upsert(payload, { onConflict: "user_id" })');
  });
});
